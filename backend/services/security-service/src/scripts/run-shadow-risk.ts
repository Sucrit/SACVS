import { ENV } from '../config/env';
import { ShadowRiskService } from '../service/shadow-risk.service';
import { parseArgs } from './helpers';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const parsedLookbackMinutes =
    typeof args.lookbackMinutes === 'string' ? Number(args.lookbackMinutes) : NaN;
  const lookbackMinutes = Number.isFinite(parsedLookbackMinutes)
    ? parsedLookbackMinutes
    : ENV.RISK_SHADOW_LOOKBACK_MINUTES;
  const modelVersion = args.modelVersion ?? 'shadow-heuristic-v1';
  const parsedBatchLimit = typeof args.batchLimit === 'string' ? Number(args.batchLimit) : NaN;
  const batchLimit = Number.isFinite(parsedBatchLimit)
    ? parsedBatchLimit
    : ENV.RISK_SHADOW_BATCH_LIMIT;

  const since = new Date(Date.now() - lookbackMinutes * 60_000);
  const service = new ShadowRiskService();
  const result = await service.run({
    since,
    modelVersion,
    limit: batchLimit,
  });

  console.log(
    `Shadow scoring completed. scanned=${result.scanned} inserted=${result.inserted} skipped=${result.skipped} lookbackMinutes=${lookbackMinutes} batchLimit=${batchLimit}`,
  );
}

main().catch((error) => {
  console.error('shadow:score failed', error);
  process.exit(1);
});
