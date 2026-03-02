import path from 'node:path';
import { ENV } from '../config/env';
import { analysisRepository } from '../repository/analysis.repository';
import { AiFraudProvider } from './ai-provider';
import { AiSignal, FraudAnalysisInput, FraudAnalysisResult } from '../types/analysis';

const MIME_EXTENSION_ALLOWLIST: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/jpg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
};

const SUSPICIOUS_FILENAME_TERMS = ['edited', 'copy', 'scan', 'tmp', 'fake', 'draft'];

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

const mapDecision = (score: number): FraudAnalysisResult['decision'] => {
  if (score < ENV.AI_SCORE_CLEAR_THRESHOLD) return 'CLEAR';
  if (score >= ENV.AI_SCORE_BLOCK_THRESHOLD) return 'BLOCK';
  return 'REVIEW_REQUIRED';
};

export class RuleOnlyProvider implements AiFraudProvider {
  readonly name = 'rule_only';

  async analyze(input: FraudAnalysisInput): Promise<FraudAnalysisResult> {
    const signals: AiSignal[] = [];
    let score = 0;

    const normalizedMime = input.mimeType?.toLowerCase() ?? '';
    const extension = input.filename ? path.extname(input.filename).toLowerCase() : '';
    const allowedExtensions = MIME_EXTENSION_ALLOWLIST[normalizedMime] ?? [];
    if (extension && allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
      signals.push({
        signalId: 'mime_extension_mismatch',
        severity: 'HIGH',
        confidence: 0.96,
        evidence: `MIME ${normalizedMime} does not match extension ${extension}.`,
      });
      score += 0.45;
    }

    if (input.filename) {
      const lowered = input.filename.toLowerCase();
      const matchedKeyword = SUSPICIOUS_FILENAME_TERMS.find(term => lowered.includes(term));
      if (matchedKeyword) {
        signals.push({
          signalId: 'suspicious_filename_keyword',
          severity: 'MEDIUM',
          confidence: 0.72,
          evidence: `Filename contains suspicious keyword: ${matchedKeyword}.`,
        });
        score += 0.18;
      }
    }

    if (input.fileHash) {
      const duplicateStats = await analysisRepository.getDuplicateHashStats(
        input.fileHash,
        input.studentId,
        input.institutionId,
      );
      if (duplicateStats.duplicateCount > 1) {
        signals.push({
          signalId: 'duplicate_hash_reuse',
          severity: duplicateStats.crossStudentReuse ? 'HIGH' : 'MEDIUM',
          confidence: duplicateStats.crossStudentReuse ? 0.9 : 0.6,
          evidence: `Document hash appears ${duplicateStats.duplicateCount} times.`,
        });
        score += duplicateStats.crossStudentReuse ? 0.35 : 0.15;
      }
      if (duplicateStats.crossInstitutionReuse) {
        signals.push({
          signalId: 'cross_institution_hash_reuse',
          severity: 'HIGH',
          confidence: 0.92,
          evidence: 'Same file hash appears across multiple institutions.',
        });
        score += 0.3;
      }
    }

    const contentProbe = input.fileBytes.subarray(0, 8192).toString('latin1').toLowerCase();
    const suspiciousMetadataMatches = ['photoshop', 'gimp', 'paint', 'adobe illustrator'].filter(token =>
      contentProbe.includes(token),
    );
    if (suspiciousMetadataMatches.length > 0) {
      signals.push({
        signalId: 'metadata_editing_tool_detected',
        severity: 'MEDIUM',
        confidence: 0.68,
        evidence: `Detected editing tool signatures: ${suspiciousMetadataMatches.join(', ')}`,
      });
      score += 0.2;
    }

    const normalizedScore = clamp(score);
    const decision = mapDecision(normalizedScore);
    const status = decision === 'CLEAR' ? 'AUTO_CLEAR' : 'MANUAL_REVIEW_REQUIRED';

    return {
      decision,
      score: normalizedScore,
      status,
      model: ENV.AI_MODEL,
      modelVersion: ENV.AI_MODEL_VERSION,
      signals,
      report: {
        summary:
          decision === 'CLEAR'
            ? 'No high-risk document tampering indicators were detected.'
            : 'Risk indicators were detected. Manual institution review is required.',
        stages: {
          deterministicChecks: {
            mimeExtensionChecked: Boolean(input.mimeType && input.filename),
            duplicateHashChecked: Boolean(input.fileHash),
            metadataProbeBytes: Math.min(input.fileBytes.length, 8192),
          },
        },
      },
    };
  }
}

