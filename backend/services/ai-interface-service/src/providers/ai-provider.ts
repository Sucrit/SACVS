import { FraudAnalysisInput, FraudAnalysisResult } from '../types/analysis';

export interface AiFraudProvider {
  readonly name: string;
  analyze(input: FraudAnalysisInput): Promise<FraudAnalysisResult>;
}

