import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/repository';
import type { AuditLog, Role } from '@/types';

export interface AuditEvent {
  userId: string;
  userName: string;
  role: Role;
  action: string;
  resource: string;
  resourceId: string;
  oldValue?: any;
  newValue?: any;
  ip?: string;
  comment?: string;
}

/** Writes a real audit record. Nothing is ever synthesised here. */
export async function logAudit(event: AuditEvent): Promise<AuditLog> {
  const entry: AuditLog = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  try {
    await db.auditLogs.create(entry);
  } catch (error) {
    console.warn('[audit] failed to persist audit entry:', (error as Error).message);
  }

  return entry;
}

export async function getAuditLogs(filters: {
  resource?: string;
  resourceId?: string;
  userId?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AuditLog[]> {
  const query: Record<string, any> = {};
  if (filters.resource) query.resource = filters.resource;
  if (filters.resourceId) query.resourceId = filters.resourceId;
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;

  return db.auditLogs.list(query, { sortDescBy: 'timestamp', limit: filters.limit ?? 100 });
}
