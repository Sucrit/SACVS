import argparse
import json
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd


def to_band(score_0_100, high_threshold_0_1, critical_threshold_0_1):
    normalized = score_0_100 / 100.0
    if normalized >= critical_threshold_0_1:
        return "CRITICAL"
    if normalized >= high_threshold_0_1:
        return "HIGH"
    if score_0_100 >= 40:
        return "MEDIUM"
    return "LOW"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to .joblib artifact")
    parser.add_argument("--input", required=True, help="Path to CSV dataset")
    parser.add_argument("--output", required=True, help="Path to JSON lines predictions")
    args = parser.parse_args()

    bundle = joblib.load(args.model)
    df = pd.read_csv(args.input)
    model_cols = bundle["numeric_cols"] + bundle["categorical_cols"]
    X = df[model_cols]

    supervised = bundle["supervised_pipeline"].predict_proba(X)[:, 1]
    transformed = bundle["preprocessor"].transform(X)
    anomaly_raw = bundle["anomaly_model"].decision_function(transformed)
    anomaly = 1 / (1 + np.exp(anomaly_raw * 4))

    weights = bundle["weights"]
    blended = supervised * weights["supervised"] + anomaly * weights["anomaly"]

    high_threshold = bundle["thresholds"]["high"]
    critical_threshold = bundle["thresholds"]["critical"]

    lines = []
    for idx, row in df.iterrows():
        score_0_100 = float(max(0, min(100, blended[idx] * 100)))
        lines.append(
            {
                "eventId": row.get("eventId"),
                "riskScore": round(score_0_100, 2),
                "riskBand": to_band(score_0_100, high_threshold, critical_threshold),
                "modelVersion": args.model.split("/")[-1].replace(".joblib", ""),
                "inferenceTs": datetime.now(timezone.utc).isoformat(),
            }
        )

    with open(args.output, "w", encoding="utf-8") as f:
        for line in lines:
            f.write(json.dumps(line) + "\n")

    print(f"Scored {len(lines)} rows -> {args.output}")


if __name__ == "__main__":
    main()
