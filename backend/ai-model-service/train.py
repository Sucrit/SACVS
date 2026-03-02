import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


REQUIRED_COLUMNS = [
    'label_fraud',
    'credential_type',
    'credential_status',
    'mime_type',
    'filename_len',
    'has_file_hash',
    'duplicate_hash_count',
    'cross_institution_hash_reuse',
    'ai_score_prev',
    'issuer_role',
    'student_status',
]

NUMERIC_COLUMNS = [
    'filename_len',
    'has_file_hash',
    'duplicate_hash_count',
    'cross_institution_hash_reuse',
    'ai_score_prev',
]

CATEGORICAL_COLUMNS = [
    'credential_type',
    'credential_status',
    'mime_type',
    'issuer_role',
    'student_status',
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Train a beginner-friendly fraud model (logistic regression).')
    parser.add_argument('--data', default='data/fraud_dataset.csv', help='Path to training CSV file')
    parser.add_argument('--out-model', default='models/fraud.pkl', help='Path to output model file')
    parser.add_argument('--out-metrics', default='models/fraud_metrics.json', help='Path to output metrics JSON')
    parser.add_argument('--out-metadata', default='models/fraud_metadata.json', help='Path to output metadata JSON')
    parser.add_argument('--model-name', default='logistic-regression-fraud-v1', help='Model name metadata')
    parser.add_argument('--model-version', default='v1', help='Model version metadata')
    parser.add_argument('--test-size', type=float, default=0.2, help='Test split ratio')
    parser.add_argument('--random-state', type=int, default=42, help='Random seed')
    return parser.parse_args()


def ensure_required_columns(df: pd.DataFrame) -> None:
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f'Missing required columns: {missing}')


def build_pipeline() -> Pipeline:
    numeric_pipeline = Pipeline(
        steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value=0)),
            ('scaler', StandardScaler()),
        ],
    )

    categorical_pipeline = Pipeline(
        steps=[
            ('imputer', SimpleImputer(strategy='constant', fill_value='UNKNOWN')),
            ('encoder', OneHotEncoder(handle_unknown='ignore')),
        ],
    )

    preprocess = ColumnTransformer(
        transformers=[
            ('num', numeric_pipeline, NUMERIC_COLUMNS),
            ('cat', categorical_pipeline, CATEGORICAL_COLUMNS),
        ],
    )

    return Pipeline(
        steps=[
            ('preprocess', preprocess),
            ('model', LogisticRegression(max_iter=1500, class_weight='balanced')),
        ],
    )


def main() -> None:
    args = parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        raise FileNotFoundError(f'Dataset not found: {data_path}')

    df = pd.read_csv(data_path)
    ensure_required_columns(df)

    y = df['label_fraud'].astype(int)
    if y.nunique() < 2:
        raise ValueError('label_fraud must contain at least two classes (0 and 1).')

    X = df.drop(columns=['label_fraud'])

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
        stratify=y,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    probabilities = pipeline.predict_proba(X_test)[:, 1]

    metrics = {
        'rows_total': int(len(df)),
        'rows_train': int(len(X_train)),
        'rows_test': int(len(X_test)),
        'accuracy': float(accuracy_score(y_test, predictions)),
        'precision': float(precision_score(y_test, predictions, zero_division=0)),
        'recall': float(recall_score(y_test, predictions, zero_division=0)),
        'f1': float(f1_score(y_test, predictions, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_test, probabilities)),
        'report': classification_report(y_test, predictions, zero_division=0, output_dict=True),
        'required_columns': REQUIRED_COLUMNS,
    }

    metadata = {
        'model_name': args.model_name,
        'model_version': args.model_version,
        'feature_columns': [column for column in REQUIRED_COLUMNS if column != 'label_fraud'],
        'numeric_columns': NUMERIC_COLUMNS,
        'categorical_columns': CATEGORICAL_COLUMNS,
        'target_column': 'label_fraud',
    }

    out_model = Path(args.out_model)
    out_metrics = Path(args.out_metrics)
    out_metadata = Path(args.out_metadata)
    out_model.parent.mkdir(parents=True, exist_ok=True)
    out_metrics.parent.mkdir(parents=True, exist_ok=True)
    out_metadata.parent.mkdir(parents=True, exist_ok=True)

    joblib.dump(pipeline, out_model)
    out_metrics.write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    out_metadata.write_text(json.dumps(metadata, indent=2), encoding='utf-8')

    print('Training complete.')
    print(f'Model saved to: {out_model}')
    print(f'Metrics saved to: {out_metrics}')
    print(f'Metadata saved to: {out_metadata}')
    print(f"Accuracy={metrics['accuracy']:.4f}, Precision={metrics['precision']:.4f}, Recall={metrics['recall']:.4f}, F1={metrics['f1']:.4f}, ROC_AUC={metrics['roc_auc']:.4f}")


if __name__ == '__main__':
    main()
