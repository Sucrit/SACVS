from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
from typing import Any, Optional
import json
import os
from pathlib import Path

import pandas as pd

# define request schema
class ScoreRequest(BaseModel):
    credentialId: str
    title: Optional[str] = None
    filename: Optional[str] = None
    mimeType: Optional[str] = None
    fileHash: Optional[str] = None
    fileBase64: Optional[str] = None

class Signal(BaseModel):
    signalId: str
    severity: str
    confidence: float
    evidence: str

class ScoreResponse(BaseModel):
    riskScore: float
    summary: str
    signals: list[Signal]
    model: str
    modelVersion: str


class HealthResponse(BaseModel):
    status: str
    modelLoaded: bool
    model: str
    version: str
    featureColumns: list[str]

app = FastAPI()

MODEL_PATH = os.environ.get("MODEL_PATH", "models/fraud.pkl")
MODEL_METADATA_PATH = os.environ.get("MODEL_METADATA_PATH", "models/fraud_metadata.json")
model = None
model_metadata: dict[str, Any] = {
    "model_name": "logistic-regression-fraud-v1",
    "model_version": "v1",
    "feature_columns": [
        "credential_type",
        "credential_status",
        "mime_type",
        "filename_len",
        "has_file_hash",
        "duplicate_hash_count",
        "cross_institution_hash_reuse",
        "ai_score_prev",
        "issuer_role",
        "student_status",
    ],
}


def load_metadata() -> None:
    global model_metadata
    metadata_path = Path(MODEL_METADATA_PATH)
    if not metadata_path.exists():
        return

    try:
        parsed = json.loads(metadata_path.read_text(encoding="utf-8"))
        feature_columns = parsed.get("feature_columns") or parsed.get("required_columns")
        if isinstance(feature_columns, list):
            parsed["feature_columns"] = [column for column in feature_columns if column != "label_fraud"]
        model_metadata = {
            **model_metadata,
            **parsed,
        }
    except Exception as error:
        print(f"Failed to load model metadata: {error}")

@app.on_event("startup")
def load_model():
    global model
    load_metadata()
    try:
        model = joblib.load(MODEL_PATH)
        print(f"Loaded model from {MODEL_PATH}")
    except Exception as e:
        print("Failed to load model:", e)
        model = None


def build_feature_row(req: ScoreRequest) -> dict[str, Any]:
    return {
        "credential_type": "CERTIFICATE",
        "credential_status": "PENDING",
        "mime_type": req.mimeType or "unknown",
        "filename_len": len(req.filename or ""),
        "has_file_hash": 1 if req.fileHash else 0,
        "duplicate_hash_count": 0,
        "cross_institution_hash_reuse": 0,
        "ai_score_prev": 0.0,
        "issuer_role": "INSTITUTION",
        "student_status": "APPROVED",
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok" if model is not None else "degraded",
        modelLoaded=model is not None,
        model=model_metadata.get("model_name", "logistic-regression-fraud-v1"),
        version=model_metadata.get("model_version", "v1"),
        featureColumns=model_metadata.get("feature_columns", []),
    )

@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not available")

    feature_columns = model_metadata.get("feature_columns", [])
    feature_row = build_feature_row(req)
    payload = {column: feature_row.get(column) for column in feature_columns}
    features = pd.DataFrame([payload], columns=feature_columns)

    try:
        prob = float(model.predict_proba(features)[0][1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # simple signal example
    signals = []
    if prob > 0.7:
        signals.append(Signal(signalId="high_risk", severity="HIGH", confidence=prob, evidence="score > 0.7"))

    return ScoreResponse(
        riskScore=prob,
        summary="ML model prediction",
        signals=signals,
        model=model_metadata.get("model_name", "logistic-regression-fraud-v1"),
        modelVersion=model_metadata.get("model_version", "v1"),
    )
