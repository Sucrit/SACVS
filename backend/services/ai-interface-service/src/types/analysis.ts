export type AiDecision = 'PENDING' | 'CLEAR' | 'REVIEW_REQUIRED' | 'BLOCK' | 'FAILED';

export interface AiSignal {
  signalId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  evidence: string;
}

export interface FraudAnalysisInput {
  credentialId: string;
  studentId: string;
  institutionId: string | null;
  title: string;
  filename: string | null;
  mimeType: string | null;
  fileHash: string | null;
  fileBytes: Buffer;
}

export interface FraudAnalysisResult {
  decision: AiDecision;
  score: number;
  status: string;
  model: string;
  modelVersion: string;
  signals: AiSignal[];
  report: {
    summary: string;
    stages: Record<string, unknown>;
  };
}

