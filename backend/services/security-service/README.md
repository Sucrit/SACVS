# SACVS Security Service (ML Shadow Layer)

This service is intentionally **offline/shadow-only** for now.

## What is implemented

1. Metadata-only feature extraction from existing audit + step-up metadata.
2. Shadow risk scoring pipeline that writes:
   - `RiskFeatureSnapshot`
   - `RiskEventRecord`
3. Model registry table (`RiskModelVersion`) + registration script.
4. Python training scripts for:
   - Supervised tabular model: **LightGBM (fallback: XGBoost)**
   - Unsupervised anomaly model: **Isolation Forest**
   - Weighted ensemble output contract.
5. Dataset extraction that prefers analyst-reviewed `RiskEventRecord.reviewStatus`
   labels (`CONFIRMED_ABUSE`, `BENIGN`) over weak seeds when available.

## What is not implemented (by design)

1. No enforcement in live request path.
2. No blocking/quarantine based on ML output.
3. No content-based document ML (OCR/classification).

## Setup

```bash
cd backend/services/security-service
npm install
cp .env.example .env
```

Make sure `DATABASE_URL` points to the same SACVS DB.

## 1) Extract training dataset

```bash
npm run dataset:extract
# optional:
# npm run dataset:extract -- --lookbackHours=4320 --output=risk_dataset_custom.csv
```

Output goes to `./artifacts`.

Artifact layout:
- `artifacts/datasets/`
- `artifacts/models/`
- `artifacts/metrics/`
- `artifacts/manifests/`

## 2) Train offline models

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r python/requirements.txt
python python/train_risk_models.py --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv --output_dir artifacts
```

Artifacts produced:
- `models/<version>.joblib`
- `metrics/<version>_metrics.json`
- `manifests/model_manifest.json`

Training metrics now include:
- ranking metrics (`valid_pr_auc`, `test_pr_auc`, `precision_at_top5pct`, `recall_at_top5pct`)
- classification metrics (`accuracy`, `precision`, `recall`, `f1`, confusion matrices)
- validation-selected threshold used for locked test reporting

If validation or test lacks class balance, classification metrics are written as `null`
and `evaluation_blocked_reasons` explains why.

## 2b) Evaluate an existing trained artifact in VS Code

```bash
python python/evaluate_risk_model.py --model artifacts/models/ml-risk-YYYYMMDDHHMMSS.joblib --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv

# optional:
# python python/evaluate_risk_model.py --model artifacts/models/ml-risk-YYYYMMDDHHMMSS.joblib --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv --output artifacts/metrics/custom_eval.json
# python python/train_risk_models.py --input artifacts/datasets/risk_dataset_YYYY-MM-DD.csv --output_dir artifacts --rebalance_eval_splits
```

This prints a terminal summary and writes a JSON evaluation report under `artifacts/metrics/`.

## 3) Register trained model metadata in DB

```bash
npm run model:register -- --manifest=artifacts/manifests/model_manifest.json
```

## 4) Run shadow scoring job

```bash
npm run shadow:score
# optional:
# npm run shadow:score -- --lookbackMinutes=30 --modelVersion=shadow-heuristic-v1
```

This inserts risk records only and does not affect request decisions.

## Output contract

Risk result shape is stored in `RiskEventRecord` and mirrors:

```ts
type RiskScoreResult = {
  riskScore: number; // 0-100
  riskBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  topSignals: string[];
  modelVersion: string;
  inferenceTs: string;
}
```

## Suggested ops workflow

1. Keep production in shadow mode.
2. Triage `HIGH` and `CRITICAL` records in ops review.
3. Update review status (`CONFIRMED_ABUSE` / `BENIGN` / `UNCERTAIN`) for future label quality.
4. Retrain weekly initially.
5. Do not move beyond shadow mode until validation and test splits contain enough
   positive reviewed events to produce meaningful precision and recall metrics.
