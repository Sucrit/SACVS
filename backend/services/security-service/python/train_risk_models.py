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
from sklearn.metrics import average_precision_score, precision_recall_curve
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


def time_split(df: pd.DataFrame, train_ratio=0.7, valid_ratio=0.15):
    df = df.sort_values("eventTs").reset_index(drop=True)
    n = len(df)
    train_end = int(n * train_ratio)
    valid_end = int(n * (train_ratio + valid_ratio))
    train = df.iloc[:train_end]
    valid = df.iloc[train_end:valid_end]
    test = df.iloc[valid_end:]
    return train, valid, test


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

    # Prevent collapsed bands on tiny or low-variance datasets.
    minimum_gap = 0.05
    if critical <= high:
        critical = min(0.99, high + minimum_gap)
    if critical - high < minimum_gap:
        critical = min(0.99, high + minimum_gap)
    if high >= critical:
        high = max(0.0, critical - minimum_gap)

    return high, critical


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to CSV dataset from dataset:extract.")
    parser.add_argument("--output_dir", required=True, help="Where artifacts will be written.")
    parser.add_argument("--version", default=None, help="Optional model version override.")
    parser.add_argument("--supervised_weight", type=float, default=0.75)
    parser.add_argument("--anomaly_weight", type=float, default=0.25)
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

    train_df, valid_df, test_df = time_split(df)

    label_col = "weakLabel"
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

    preprocessor = ColumnTransformer(
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
        # Convert to risk-like scale (higher => more anomalous)
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

    valid_pr_auc = float(average_precision_score(y_valid, valid_blended)) if len(y_valid) else 0.0
    test_pr_auc = float(average_precision_score(y_test, test_blended)) if len(y_test) else 0.0
    precision_top5, recall_top5 = recall_at_top_k(y_test, test_blended, top_pct=0.05) if len(y_test) else (0.0, 0.0)

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

    metrics = {
        "valid_pr_auc": valid_pr_auc,
        "test_pr_auc": test_pr_auc,
        "precision_at_top5pct": precision_top5,
        "recall_at_top5pct": recall_top5,
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
    if data_warnings:
        print(f"Warnings: {', '.join(data_warnings)}")


if __name__ == "__main__":
    main()
