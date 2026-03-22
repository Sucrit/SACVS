"""
Training entrypoint for the SACVS security shadow model.

Typical usage:
  python python/train_risk_models.py --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv --output_dir artifacts

This script now writes both ranking metrics and a full binary-classification
evaluation report when the validation/test splits contain enough class balance.
"""

import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def build_supervised_estimator():
    try:
        from lightgbm import LGBMClassifier

        return "lightgbm", LGBMClassifier(
            n_estimators=220,
            learning_rate=0.06,
            max_depth=-1,
            num_leaves=31,
            min_child_samples=30,
            subsample=0.85,
            colsample_bytree=0.8,
            random_state=42,
        )
    except Exception:
        from xgboost import XGBClassifier

        return "xgboost", XGBClassifier(
            n_estimators=220,
            learning_rate=0.06,
            max_depth=6,
            subsample=0.85,
            colsample_bytree=0.8,
            objective="binary:logistic",
            eval_metric="logloss",
            random_state=42,
        )


def default_split_indices(n, train_ratio=0.7, valid_ratio=0.15):
    train_end = int(n * train_ratio)
    valid_end = int(n * (train_ratio + valid_ratio))
    return train_end, valid_end


def time_split(df: pd.DataFrame, train_ratio=0.7, valid_ratio=0.15):
    df = df.sort_values("eventTs").reset_index(drop=True)
    train_end, valid_end = default_split_indices(len(df), train_ratio=train_ratio, valid_ratio=valid_ratio)
    train = df.iloc[:train_end]
    valid = df.iloc[train_end:valid_end]
    test = df.iloc[valid_end:]
    return train, valid, test


def split_has_minimum_class_balance(split_df: pd.DataFrame, label_col: str, min_positive_count=1) -> bool:
    if len(split_df) == 0:
        return False
    positives = int(split_df[label_col].astype(int).sum())
    negatives = int(len(split_df) - positives)
    return positives >= min_positive_count and negatives >= 1


def time_split_with_optional_rebalance(
    df: pd.DataFrame,
    label_col: str,
    train_ratio=0.7,
    valid_ratio=0.15,
    rebalance_eval_splits=False,
    min_positive_count=1,
):
    df = df.sort_values("eventTs").reset_index(drop=True)
    default_train_end, default_valid_end = default_split_indices(
        len(df),
        train_ratio=train_ratio,
        valid_ratio=valid_ratio,
    )

    if not rebalance_eval_splits:
        return (
            df.iloc[:default_train_end],
            df.iloc[default_train_end:default_valid_end],
            df.iloc[default_valid_end:],
            {
                "rebalance_applied": False,
                "reason": "disabled",
            },
        )

    n = len(df)
    min_train_rows = max(1, int(n * 0.5))
    min_valid_rows = max(1, int(n * 0.1))
    min_test_rows = max(1, int(n * 0.1))

    candidates = []
    for train_end in range(min_train_rows, n - min_valid_rows - min_test_rows + 1):
        for valid_end in range(train_end + min_valid_rows, n - min_test_rows + 1):
            train_df = df.iloc[:train_end]
            valid_df = df.iloc[train_end:valid_end]
            test_df = df.iloc[valid_end:]
            if not split_has_minimum_class_balance(valid_df, label_col, min_positive_count):
                continue
            if not split_has_minimum_class_balance(test_df, label_col, min_positive_count):
                continue
            distance = abs(train_end - default_train_end) + abs(valid_end - default_valid_end)
            candidates.append((distance, train_end, valid_end))

    if not candidates:
        return (
            df.iloc[:default_train_end],
            df.iloc[default_train_end:default_valid_end],
            df.iloc[default_valid_end:],
            {
                "rebalance_applied": False,
                "reason": "no_valid_rebalanced_split_found",
            },
        )

    _, chosen_train_end, chosen_valid_end = min(candidates, key=lambda item: item[0])
    return (
        df.iloc[:chosen_train_end],
        df.iloc[chosen_train_end:chosen_valid_end],
        df.iloc[chosen_valid_end:],
        {
            "rebalance_applied": True,
            "reason": "minimum_positive_count_satisfied",
            "train_end": chosen_train_end,
            "valid_end": chosen_valid_end,
            "default_train_end": default_train_end,
            "default_valid_end": default_valid_end,
            "min_positive_count": min_positive_count,
        },
    )


def recall_at_top_k(y_true, y_score, top_pct=0.05):
    if len(y_true) == 0:
        return 0.0, 0.0
    k = max(1, int(len(y_true) * top_pct))
    order = np.argsort(-y_score)
    idx = order[:k]
    selected = y_true.iloc[idx]
    positives = y_true.sum()
    precision = float(selected.mean()) if len(selected) else 0.0
    recall = float(selected.sum() / positives) if positives > 0 else 0.0
    return precision, recall


def derive_ordered_thresholds(valid_scores, default_high=0.7, default_critical=0.85):
    if len(valid_scores) == 0:
        return default_high, default_critical

    high = float(np.quantile(valid_scores, 0.85))
    critical = float(np.quantile(valid_scores, 0.95))

    minimum_gap = 0.05
    if critical <= high:
        critical = min(0.99, high + minimum_gap)
    if critical - high < minimum_gap:
        critical = min(0.99, high + minimum_gap)
    if high >= critical:
        high = max(0.0, critical - minimum_gap)

    return high, critical


def evaluate_split_balance(y_true: pd.Series, split_name: str):
    reasons = []
    positives = int(y_true.sum())
    negatives = int(len(y_true) - positives)

    if len(y_true) == 0:
        reasons.append(f"{split_name}_split_empty")
    if positives == 0:
        reasons.append(f"no_positive_labels_in_{split_name}_split")
    if negatives == 0:
        reasons.append(f"no_negative_labels_in_{split_name}_split")

    return {
        "reasons": reasons,
        "positive_count": positives,
        "negative_count": negatives,
    }


def select_best_f1_threshold(y_true: pd.Series, y_score: np.ndarray):
    balance = evaluate_split_balance(y_true, "validation")
    if balance["reasons"]:
        return None, balance["reasons"]

    precision, recall, thresholds = precision_recall_curve(y_true, y_score)
    if len(thresholds) == 0:
        return None, ["validation_threshold_selection_unavailable"]

    f1_values = []
    for idx, threshold in enumerate(thresholds):
        p = precision[idx]
        r = recall[idx]
        denom = p + r
        f1_values.append((2 * p * r / denom) if denom > 0 else 0.0)

    best_idx = int(np.argmax(f1_values))
    return float(thresholds[best_idx]), []


def compute_binary_metrics(y_true: pd.Series, y_score: np.ndarray, threshold: float, split_name: str):
    balance = evaluate_split_balance(y_true, split_name)
    if balance["reasons"]:
        return {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "confusion_matrix": None,
            "support_positive": balance["positive_count"],
            "support_negative": balance["negative_count"],
            "blocked_reasons": balance["reasons"],
        }

    y_pred = (y_score >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
        "support_positive": balance["positive_count"],
        "support_negative": balance["negative_count"],
        "blocked_reasons": [],
    }


def build_feature_columns(df: pd.DataFrame, label_col: str):
    categorical_cols = ["action", "actorRole", "targetType"]
    ignored_cols = [
        "eventId",
        "eventTs",
        "actorId",
        "targetId",
        "ipHash",
        "userAgentHash",
        "seedSignals",
        "labelSource",
        "reviewStatus",
        "reviewReasonCode",
        label_col,
    ]
    numeric_cols = [c for c in df.columns if c not in ignored_cols and c not in categorical_cols]
    return numeric_cols, categorical_cols


def build_preprocessor(numeric_cols, categorical_cols):
    return ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="constant", fill_value=0)),
                        ("scaler", StandardScaler(with_mean=False)),
                    ]
                ),
                numeric_cols,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("ohe", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_cols,
            ),
        ]
    )


def score_with_bundle(bundle, df: pd.DataFrame):
    model_cols = bundle["numeric_cols"] + bundle["categorical_cols"]
    X = df[model_cols]
    supervised = bundle["supervised_pipeline"].predict_proba(X)[:, 1] if len(X) else np.array([])
    transformed = bundle["preprocessor"].transform(X) if len(X) else None
    anomaly_raw = bundle["anomaly_model"].decision_function(transformed) if transformed is not None else np.array([])
    anomaly = 1 / (1 + np.exp(anomaly_raw * 4)) if len(supervised) else np.array([])
    weights = bundle["weights"]
    blended = (
        supervised * weights["supervised"] + anomaly * weights["anomaly"]
        if len(supervised)
        else np.array([])
    )
    return supervised, anomaly, blended


def evaluate_scored_splits(
    train_df: pd.DataFrame,
    valid_df: pd.DataFrame,
    test_df: pd.DataFrame,
    valid_scores: np.ndarray,
    test_scores: np.ndarray,
    threshold_high: float,
    threshold_critical: float,
    label_col: str,
):
    y_valid = valid_df[label_col].astype(int)
    y_test = test_df[label_col].astype(int)

    valid_pr_auc = float(average_precision_score(y_valid, valid_scores)) if len(y_valid) and y_valid.sum() > 0 else 0.0
    test_pr_auc = float(average_precision_score(y_test, test_scores)) if len(y_test) and y_test.sum() > 0 else 0.0
    precision_top5, recall_top5 = recall_at_top_k(y_test, test_scores, top_pct=0.05) if len(y_test) else (0.0, 0.0)

    validation_selected_threshold, validation_threshold_blocked = select_best_f1_threshold(y_valid, valid_scores)
    valid_classification = (
        compute_binary_metrics(y_valid, valid_scores, validation_selected_threshold, "validation")
        if validation_selected_threshold is not None
        else {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "confusion_matrix": None,
            "support_positive": int(y_valid.sum()),
            "support_negative": int(len(y_valid) - y_valid.sum()),
            "blocked_reasons": validation_threshold_blocked,
        }
    )
    test_classification = (
        compute_binary_metrics(y_test, test_scores, validation_selected_threshold, "test")
        if validation_selected_threshold is not None
        else {
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "confusion_matrix": None,
            "support_positive": int(y_test.sum()),
            "support_negative": int(len(y_test) - y_test.sum()),
            "blocked_reasons": ["validation_threshold_selection_blocked"],
        }
    )

    comparison_metrics = {
        "threshold_high": compute_binary_metrics(y_test, test_scores, threshold_high, "test"),
        "threshold_critical": compute_binary_metrics(y_test, test_scores, threshold_critical, "test"),
    }

    evaluation_blocked_reasons = sorted(
        set(
            validation_threshold_blocked
            + valid_classification.get("blocked_reasons", [])
            + test_classification.get("blocked_reasons", [])
        )
    )
    if evaluation_blocked_reasons:
        evaluation_blocked_reasons.append("insufficient_class_balance_for_classification_metrics")
        evaluation_blocked_reasons = sorted(set(evaluation_blocked_reasons))

    return {
        "valid_pr_auc": valid_pr_auc,
        "test_pr_auc": test_pr_auc,
        "precision_at_top5pct": precision_top5,
        "recall_at_top5pct": recall_top5,
        "validation_selected_threshold": validation_selected_threshold,
        "valid_accuracy": valid_classification["accuracy"],
        "valid_precision": valid_classification["precision"],
        "valid_recall": valid_classification["recall"],
        "valid_f1": valid_classification["f1"],
        "valid_confusion_matrix": valid_classification["confusion_matrix"],
        "valid_support_positive": valid_classification["support_positive"],
        "valid_support_negative": valid_classification["support_negative"],
        "test_accuracy": test_classification["accuracy"],
        "test_precision": test_classification["precision"],
        "test_recall": test_classification["recall"],
        "test_f1": test_classification["f1"],
        "test_confusion_matrix": test_classification["confusion_matrix"],
        "test_support_positive": test_classification["support_positive"],
        "test_support_negative": test_classification["support_negative"],
        "comparison_metrics": comparison_metrics,
        "evaluation_blocked_reasons": evaluation_blocked_reasons,
    }


def print_evaluation_summary(metrics, data_warnings):
    print(f"Validation-selected threshold: {metrics['validation_selected_threshold']}")
    print(f"Test accuracy: {metrics['test_accuracy']}")
    print(f"Test precision: {metrics['test_precision']}")
    print(f"Test recall: {metrics['test_recall']}")
    print(f"Test F1: {metrics['test_f1']}")
    if metrics.get("evaluation_blocked_reasons"):
        print(f"Evaluation blocked reasons: {', '.join(metrics['evaluation_blocked_reasons'])}")
    if data_warnings:
        print(f"Warnings: {', '.join(data_warnings)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to CSV dataset from dataset:extract.")
    parser.add_argument("--output_dir", required=True, help="Where artifacts will be written.")
    parser.add_argument("--version", default=None, help="Optional model version override.")
    parser.add_argument("--supervised_weight", type=float, default=0.75)
    parser.add_argument("--anomaly_weight", type=float, default=0.25)
    parser.add_argument("--rebalance_eval_splits", action="store_true", help="Optionally shift split boundaries to try to preserve at least one positive in validation/test.")
    parser.add_argument("--min_eval_positives", type=int, default=1, help="Minimum positive count required in validation/test when rebalance is enabled.")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    models_dir = os.path.join(args.output_dir, "models")
    metrics_dir = os.path.join(args.output_dir, "metrics")
    manifests_dir = os.path.join(args.output_dir, "manifests")
    for directory in (models_dir, metrics_dir, manifests_dir):
        os.makedirs(directory, exist_ok=True)

    df = pd.read_csv(args.input)
    if "eventTs" not in df.columns or "weakLabel" not in df.columns:
        raise ValueError("Dataset missing required columns: eventTs and weakLabel.")
    df["eventTs"] = pd.to_datetime(df["eventTs"], utc=True, errors="coerce")
    df = df.dropna(subset=["eventTs"]).reset_index(drop=True)

    label_col = "weakLabel"
    train_df, valid_df, test_df, split_metadata = time_split_with_optional_rebalance(
        df,
        label_col=label_col,
        rebalance_eval_splits=args.rebalance_eval_splits,
        min_positive_count=args.min_eval_positives,
    )

    numeric_cols, categorical_cols = build_feature_columns(df, label_col)
    preprocessor = build_preprocessor(numeric_cols, categorical_cols)

    model_name, supervised_estimator = build_supervised_estimator()
    supervised_pipeline = Pipeline(steps=[("prep", preprocessor), ("clf", supervised_estimator)])

    X_train = train_df[numeric_cols + categorical_cols]
    y_train = train_df[label_col].astype(int)
    X_valid = valid_df[numeric_cols + categorical_cols]
    y_valid = valid_df[label_col].astype(int)
    X_test = test_df[numeric_cols + categorical_cols]
    y_test = test_df[label_col].astype(int)
    train_positive_count = int(y_train.sum())
    valid_positive_count = int(y_valid.sum())
    test_positive_count = int(y_test.sum())
    reviewed_train_positive_count = int(
        ((train_df["labelSource"] == "analyst_review") & (train_df[label_col].astype(int) == 1)).sum()
    )
    reviewed_valid_positive_count = int(
        ((valid_df["labelSource"] == "analyst_review") & (valid_df[label_col].astype(int) == 1)).sum()
    )
    reviewed_test_positive_count = int(
        ((test_df["labelSource"] == "analyst_review") & (test_df[label_col].astype(int) == 1)).sum()
    )

    supervised_pipeline.fit(X_train, y_train)
    valid_supervised = supervised_pipeline.predict_proba(X_valid)[:, 1] if len(X_valid) else np.array([])
    test_supervised = supervised_pipeline.predict_proba(X_test)[:, 1] if len(X_test) else np.array([])

    transformed_train = preprocessor.fit_transform(X_train)
    transformed_valid = preprocessor.transform(X_valid) if len(X_valid) else None
    transformed_test = preprocessor.transform(X_test) if len(X_test) else None

    anomaly_model = IsolationForest(
        n_estimators=160,
        contamination=0.03,
        random_state=42,
    )
    anomaly_model.fit(transformed_train)

    def anomaly_to_score(transformed):
        if transformed is None:
            return np.array([])
        raw = anomaly_model.decision_function(transformed)
        return 1 / (1 + np.exp(raw * 4))

    valid_anomaly = anomaly_to_score(transformed_valid)
    test_anomaly = anomaly_to_score(transformed_test)

    valid_blended = (
        valid_supervised * args.supervised_weight + valid_anomaly * args.anomaly_weight
        if len(valid_supervised)
        else np.array([])
    )
    test_blended = (
        test_supervised * args.supervised_weight + test_anomaly * args.anomaly_weight
        if len(test_supervised)
        else np.array([])
    )

    threshold_high, threshold_critical = derive_ordered_thresholds(valid_blended)
    data_warnings = []
    if train_positive_count < 20:
        data_warnings.append("low_positive_count_train")
    if valid_positive_count == 0:
        data_warnings.append("no_positive_labels_in_validation_split")
    if test_positive_count == 0:
        data_warnings.append("no_positive_labels_in_test_split")
    if reviewed_train_positive_count < 10:
        data_warnings.append("low_reviewed_positive_count_train")
    if reviewed_valid_positive_count == 0:
        data_warnings.append("no_reviewed_positive_labels_in_validation_split")
    if reviewed_test_positive_count == 0:
        data_warnings.append("no_reviewed_positive_labels_in_test_split")
    if split_metadata.get("rebalance_applied") is False and split_metadata.get("reason") == "no_valid_rebalanced_split_found":
        data_warnings.append("rebalance_eval_split_unavailable")

    version = args.version or f"ml-risk-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    artifact_bundle = {
        "supervised_model_name": model_name,
        "supervised_pipeline": supervised_pipeline,
        "anomaly_model": anomaly_model,
        "preprocessor": preprocessor,
        "numeric_cols": numeric_cols,
        "categorical_cols": categorical_cols,
        "weights": {
            "supervised": args.supervised_weight,
            "anomaly": args.anomaly_weight,
        },
        "thresholds": {
            "high": threshold_high,
            "critical": threshold_critical,
        },
    }

    artifact_path = os.path.join(models_dir, f"{version}.joblib")
    joblib.dump(artifact_bundle, artifact_path)

    top_features = []
    try:
        clf = supervised_pipeline.named_steps["clf"]
        importances = clf.feature_importances_
        feature_names = supervised_pipeline.named_steps["prep"].get_feature_names_out()
        pairs = sorted(zip(feature_names, importances), key=lambda x: x[1], reverse=True)
        top_features = [name for name, _ in pairs[:12]]
    except Exception:
        top_features = ["feature_importance_unavailable"]

    evaluation_metrics = evaluate_scored_splits(
        train_df=train_df,
        valid_df=valid_df,
        test_df=test_df,
        valid_scores=valid_blended,
        test_scores=test_blended,
        threshold_high=threshold_high,
        threshold_critical=threshold_critical,
        label_col=label_col,
    )

    metrics = {
        **evaluation_metrics,
        "train_rows": int(len(train_df)),
        "valid_rows": int(len(valid_df)),
        "test_rows": int(len(test_df)),
        "train_positive_count": train_positive_count,
        "valid_positive_count": valid_positive_count,
        "test_positive_count": test_positive_count,
        "reviewed_train_positive_count": reviewed_train_positive_count,
        "reviewed_valid_positive_count": reviewed_valid_positive_count,
        "reviewed_test_positive_count": reviewed_test_positive_count,
        "threshold_high": threshold_high,
        "threshold_critical": threshold_critical,
        "data_warnings": data_warnings,
        "split_metadata": split_metadata,
    }

    metrics_path = os.path.join(metrics_dir, f"{version}_metrics.json")
    with open(metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    manifest = {
        "modelVersion": version,
        "modelType": "ENSEMBLE",
        "description": "SACVS metadata-only shadow model (LightGBM/XGBoost + IsolationForest).",
        "featureSchema": {**{name: "number" for name in numeric_cols}, **{name: "category" for name in categorical_cols}},
        "metrics": {**metrics, "top_features": top_features},
        "artifactPath": artifact_path,
        "isActive": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    manifest_path = os.path.join(manifests_dir, "model_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Model trained: {version}")
    print(f"Artifact: {artifact_path}")
    print(f"Manifest: {manifest_path}")
    print(f"Metrics: {metrics_path}")
    print_evaluation_summary(metrics, data_warnings)


if __name__ == "__main__":
    main()
