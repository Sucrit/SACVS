import { NotificationType, Prisma } from '../../../../db/node_modules/@prisma/client';

export interface ListNotificationsQueryDto {
  read?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CreateSystemNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Prisma.InputJsonValue | null;
}

export interface UpdateNotificationReadDto {
  read: boolean;
}

export type InstitutionNotificationTarget = 'ALL' | 'APPROVED_ONLY' | 'SUSPENDED_ONLY';

export interface CreateInstitutionBroadcastDto {
  target: InstitutionNotificationTarget;
  title: string;
  message: string;
}
