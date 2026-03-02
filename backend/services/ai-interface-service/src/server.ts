import app from './app';
import { ENV } from './config/env';
import { ANALYZE_JOB_NAME, pgBoss } from './queue/boss';
import { analysisService } from './service/analysis.service';

interface AnalyzeJobData {
  jobId?: string;
  credentialId?: string;
  reason?: 'CREATE' | 'REISSUE' | 'REANALYZE';
}

const bootstrap = async () => {
  await pgBoss.start();
  await pgBoss.work<AnalyzeJobData>(
    ANALYZE_JOB_NAME,
    {
      batchSize: Math.max(1, ENV.AI_QUEUE_CONCURRENCY),
      pollingIntervalSeconds: 1,
    },
    async jobs => {
      for (const job of jobs) {
        const data = (job.data ?? {}) as AnalyzeJobData;
        if (!data.jobId || !data.credentialId) {
          throw new Error('Invalid analyze job payload.');
        }

        await analysisService.processAnalyzeJob({
          jobId: data.jobId,
          credentialId: data.credentialId,
          reason: data.reason ?? 'CREATE',
        });
      }
    },
  );

  app.listen(ENV.PORT, '0.0.0.0', () => {
    console.log(`AI interface service running on port ${ENV.PORT}`);
  });
};

bootstrap().catch(error => {
  console.error('Failed to bootstrap ai-interface-service:', error);
  process.exit(1);
});
