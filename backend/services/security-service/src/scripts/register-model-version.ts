import fs from 'fs';
import path from 'path';
import { Prisma, RiskModelType } from '../../../../db/node_modules/@prisma/client';
import { RiskRepository } from '../repository/risk.repository';
import { parseArgs } from './helpers';

type ModelManifest = {
  modelVersion: string;
  modelType: 'SUPERVISED' | 'ANOMALY' | 'ENSEMBLE';
  description?: string;
  featureSchema?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
  artifactPath?: string;
  isActive?: boolean;
};

function toRiskModelType(value: ModelManifest['modelType']): RiskModelType {
  if (value === 'SUPERVISED') return RiskModelType.SUPERVISED;
  if (value === 'ANOMALY') return RiskModelType.ANOMALY;
  return RiskModelType.ENSEMBLE;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : path.resolve(process.cwd(), 'artifacts', 'manifests', 'model_manifest.json');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as ModelManifest;
  if (!manifest.modelVersion || !manifest.modelType) {
    throw new Error('Manifest must include modelVersion and modelType.');
  }

  const repository = new RiskRepository();
  const record = await repository.upsertModelVersion({
    modelVersion: manifest.modelVersion,
    modelType: toRiskModelType(manifest.modelType),
    description: manifest.description ?? null,
    featureSchema: (manifest.featureSchema ?? null) as Prisma.InputJsonValue | null,
    metrics: (manifest.metrics ?? null) as Prisma.InputJsonValue | null,
    artifactPath: manifest.artifactPath ?? null,
    isActive: manifest.isActive ?? false,
  });

  // eslint-disable-next-line no-console
  console.log(
    `Registered model version ${manifest.modelVersion} (id=${record.id}, active=${Boolean(
      manifest.isActive,
    )}).`,
  );
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('model:register failed', error);
  process.exit(1);
});
