"""
Evaluate an existing SACVS risk model artifact against a dataset.

Examples:
  python python/evaluate_risk_model.py --model artifacts/models/ml-risk-20260308041855.joblib --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv
  python python/evaluate_risk_model.py --model artifacts/models/ml-risk-20260308041855.joblib --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv --output artifacts/metrics/ml-risk-20260308041855_eval.json
"""

import argparse
import json
import os
from pathlib import Path

import joblib
import pandas as pd

from train_risk_models import (
    evaluate_scored_splits,
    print_evaluation_summary,
    score_with_bundle,
    time_split_with_optional_rebalance,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to a trained .joblib artifact")
    parser.add_argument("--input", required=True, help="Path to CSV dataset from dataset:extract")
    parser.add_argument("--output", default=None, help="Optional path to write a JSON evaluation report")
    parser.add_argument("--rebalance_eval_splits", action="store_true", help="Optionally shift split boundaries to try to preserve at least one positive in validation/test.")
    parser.add_argument("--min_eval_positives", type=int, default=1, help="Minimum positive count required in validation/test when rebalance is enabled.")
    args = parser.parse_args()

    bundle = joblib.load(args.model)
    df = pd.read_csv(args.input)
    if "eventTs" not in df.columns or "weakLabel" not in df.columns:
        raise ValueError("Dataset missing required columns: eventTs and weakLabel.")
    df["eventTs"] = pd.to_datetime(df["eventTs"], utc=True, errors="coerce")
    df = df.dropna(subset=["eventTs"]).reset_index(drop=True)

    train_df, valid_df, test_df, split_metadata = time_split_with_optional_rebalance(
        df,
        label_col="weakLabel",
        rebalance_eval_splits=args.rebalance_eval_splits,
        min_positive_count=args.min_eval_positives,
    )

    _, _, valid_scores = score_with_bundle(bundle, valid_df)
    _, _, test_scores = score_with_bundle(bundle, test_df)

    threshold_high = float(bundle["thresholds"]["high"])
    threshold_critical = float(bundle["thresholds"]["critical"])

    metrics = evaluate_scored_splits(
        train_df=train_df,
        valid_df=valid_df,
        test_df=test_df,
        valid_scores=valid_scores,
        test_scores=test_scores,
        threshold_high=threshold_high,
        threshold_critical=threshold_critical,
        label_col="weakLabel",
    )
    metrics["split_metadata"] = split_metadata
    metrics["threshold_high"] = threshold_high
    metrics["threshold_critical"] = threshold_critical
    metrics["model_path"] = args.model
    metrics["dataset_path"] = args.input

    output_path = args.output
    if not output_path:
        model_stem = Path(args.model).stem
        output_path = os.path.join("artifacts", "metrics", f"{model_stem}_evaluation.json")

    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print(f"Evaluation report: {output_path}")
    print_evaluation_summary(metrics, [])


if __name__ == "__main__":
    main()
