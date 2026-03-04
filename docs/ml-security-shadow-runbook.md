# SACVS ML Security Shadow Runbook

## Purpose
Run ML risk scoring as a second-layer signal without changing runtime authorization/decision logic.

## Preconditions
1. DB migration `20260304213000_add_ml_risk_shadow_layer` is applied.
2. `backend/services/security-service` dependencies are installed.
3. Existing audit + step-up events are being written by services.

## Run sequence
1. Extract features:
   - `npm run dataset:extract`
2. Train model offline:
   - `python python/train_risk_models.py --input ... --output_dir artifacts`
3. Register model metadata:
   - `npm run model:register -- --manifest=artifacts/model_manifest.json`
4. Run shadow scorer:
   - `npm run shadow:score`

## Review workflow
1. Query `RiskEventRecord` for `HIGH`/`CRITICAL`.
2. Review supporting context from `RiskFeatureSnapshot`.
3. Update `reviewStatus`:
   - `CONFIRMED_ABUSE`
   - `BENIGN`
   - `UNCERTAIN`

## Guardrails
1. Never log raw OTP/token values in ML datasets.
2. Keep data metadata-only (no document bytes, no OCR payloads).
3. Keep enforcement disabled until KPI gates are met.

## Initial KPI targets before any enforcement
1. Precision@Top5% >= 0.70
2. Recall@Top5% >= 0.45
3. Role-level false-positive drift within acceptable thresholds.
