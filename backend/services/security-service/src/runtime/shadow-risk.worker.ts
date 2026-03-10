import { ENV } from '../config/env';
import { realtimeClient } from '../client/realtime.client';
import { RiskRepository } from '../repository/risk.repository';
import { ShadowRiskService } from '../service/shadow-risk.service';

export class ShadowRiskWorker {
  private readonly repository = new RiskRepository();
  private readonly shadowRiskService = new ShadowRiskService(this.repository);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastProcessedAt: Date | null = null;
  private lastRunStartedAt: Date | null = null;
  private lastRunCompletedAt: Date | null = null;
  private lastSuccessfulRunAt: Date | null = null;
  private lastFailureAt: Date | null = null;
  private lastErrorMessage: string | null = null;
  private lastInsertedCount = 0;
  private lastScannedCount = 0;
  private lastTelemetryCleanupAt: Date | null = null;

  start(): void {
    console.log(
      `[security-service] Shadow risk worker enabled intervalMs=${ENV.RISK_SHADOW_INTERVAL_MS} overlapMinutes=${ENV.RISK_SHADOW_OVERLAP_MINUTES} batchLimit=${ENV.RISK_SHADOW_BATCH_LIMIT}`,
    );

    void this.runOnce();
    this.intervalRef = setInterval(() => {
      void this.runOnce();
    }, ENV.RISK_SHADOW_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  getStatus() {
    return {
      autorunEnabled: ENV.RISK_SHADOW_AUTORUN,
      isRunning: this.isRunning,
      intervalMs: ENV.RISK_SHADOW_INTERVAL_MS,
      overlapMinutes: ENV.RISK_SHADOW_OVERLAP_MINUTES,
      batchLimit: ENV.RISK_SHADOW_BATCH_LIMIT,
      telemetryRetentionDays: ENV.GATEWAY_TELEMETRY_RETENTION_DAYS,
      telemetryCleanupIntervalMs: ENV.GATEWAY_TELEMETRY_CLEANUP_INTERVAL_MS,
      lastProcessedAt: this.lastProcessedAt,
      lastRunStartedAt: this.lastRunStartedAt,
      lastRunCompletedAt: this.lastRunCompletedAt,
      lastSuccessfulRunAt: this.lastSuccessfulRunAt,
      lastFailureAt: this.lastFailureAt,
      lastErrorMessage: this.lastErrorMessage,
      lastInsertedCount: this.lastInsertedCount,
      lastScannedCount: this.lastScannedCount,
      lastTelemetryCleanupAt: this.lastTelemetryCleanupAt,
    };
  }

  private async resolveSince(): Promise<Date> {
    const overlapMs = ENV.RISK_SHADOW_OVERLAP_MINUTES * 60_000;
    const baseline = this.lastProcessedAt ?? (await this.repository.getLatestProcessedObservedAt());

    if (baseline) {
      return new Date(baseline.getTime() - overlapMs);
    }

    return new Date(Date.now() - ENV.RISK_SHADOW_LOOKBACK_MINUTES * 60_000);
  }

  private async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const startedAt = Date.now();
    this.lastRunStartedAt = new Date();
    this.lastErrorMessage = null;

    try {
      const since = await this.resolveSince();
      const result = await this.shadowRiskService.run({
        since,
        modelVersion: 'shadow-heuristic-v1',
        limit: ENV.RISK_SHADOW_BATCH_LIMIT,
      });

      if (result.latestObservedAt) {
        this.lastProcessedAt = result.latestObservedAt;
      }
      this.lastRunCompletedAt = new Date();
      this.lastSuccessfulRunAt = this.lastRunCompletedAt;
      this.lastInsertedCount = result.inserted;
      this.lastScannedCount = result.scanned;

      if (result.inserted > 0) {
        console.log(
          `[security-service] Shadow risk pass inserted=${result.inserted} scanned=${result.scanned} skipped=${result.skipped} durationMs=${Date.now() - startedAt} lastCursor=${result.latestObservedAt?.toISOString() ?? 'n/a'}`,
        );
        await realtimeClient.publish({
          domain: 'security',
          action: 'SECURITY_RISK_EVENTS_UPDATED',
          scope: {
            roles: ['ADMIN'],
          },
          payload: {
            insertedCount: result.inserted,
            latestInferenceTs: result.inferenceTs.toISOString(),
            lastObservedAt: result.latestObservedAt?.toISOString() ?? null,
          },
        });
      }

      await this.cleanupGatewayTelemetryIfNeeded();
    } catch (error) {
      this.lastRunCompletedAt = new Date();
      this.lastFailureAt = this.lastRunCompletedAt;
      this.lastErrorMessage = error instanceof Error ? error.message : 'Unknown worker failure';
      console.error('[security-service] Shadow risk worker pass failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async cleanupGatewayTelemetryIfNeeded(): Promise<void> {
    const now = Date.now();
    if (
      this.lastTelemetryCleanupAt &&
      now - this.lastTelemetryCleanupAt.getTime() < ENV.GATEWAY_TELEMETRY_CLEANUP_INTERVAL_MS
    ) {
      return;
    }

    const cutoff = new Date(now - ENV.GATEWAY_TELEMETRY_RETENTION_DAYS * 24 * 60 * 60_000);
    const deletedCount = await this.repository.deleteGatewayTelemetryOlderThan(cutoff);
    this.lastTelemetryCleanupAt = new Date(now);

    if (deletedCount > 0) {
      console.log(
        `[security-service] Gateway telemetry cleanup deleted=${deletedCount} cutoff=${cutoff.toISOString()}`,
      );
    }
  }
}

export const shadowRiskWorker = new ShadowRiskWorker();
