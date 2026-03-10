import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../../../db/node_modules/@prisma/client';
import { ENV } from '../config/env';

const prismaAdapter = new PrismaPg({ connectionString: ENV.DATABASE_URL });
const prisma = new PrismaClient({ adapter: prismaAdapter });

export type GatewayTelemetryInput = {
  eventId: string;
  correlationId?: string | null;
  requestTs: Date;
  routeKey: string;
  routeClass: string;
  method: string;
  statusCode: number;
  durationMs: number;
  rateLimitOutcome: string;
  actorId?: string | null;
  actorRole?: Role | null;
  actorIdentityHash?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  is401: boolean;
  is403: boolean;
  is429: boolean;
  is5xx: boolean;
};

export class GatewayTelemetryRepository {
  async create(input: GatewayTelemetryInput): Promise<void> {
    await prisma.gatewayRequestTelemetry.create({
      data: {
        eventId: input.eventId,
        correlationId: input.correlationId ?? null,
        requestTs: input.requestTs,
        routeKey: input.routeKey,
        routeClass: input.routeClass,
        method: input.method,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        rateLimitOutcome: input.rateLimitOutcome,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        actorIdentityHash: input.actorIdentityHash ?? null,
        ipHash: input.ipHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        is401: input.is401,
        is403: input.is403,
        is429: input.is429,
        is5xx: input.is5xx,
      },
    });
  }
}
