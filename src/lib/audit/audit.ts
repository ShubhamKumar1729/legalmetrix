import { memoryDB, seedMemoryDB } from '../db/memory-store';
import { connectDB, isDBConnected } from '../db/connection';
import { AuditLogModel } from '../db/models';
import type { AuditLog, Role } from '@/types';
import { v4 as uuidv4 } from 'uuid';

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

export async function logAudit(event: AuditEvent): Promise<AuditLog> {
  await seedMemoryDB();
  const auditLog: AuditLog = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Store in memory
  await memoryDB.auditLogs.create(auditLog);

  // Try MongoDB
  try {
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      await AuditLogModel.create({
        timestamp: new Date(auditLog.timestamp),
        userId: auditLog.userId,
        userName: auditLog.userName,
        role: auditLog.role,
        action: auditLog.action,
        resource: auditLog.resource,
        resourceId: auditLog.resourceId,
        oldValue: auditLog.oldValue,
        newValue: auditLog.newValue,
        ip: auditLog.ip,
        comment: auditLog.comment,
      });
    }
  } catch (e) {
    console.warn('Audit log MongoDB failed', e);
  }

  console.log(`[AUDIT] ${event.action} on ${event.resource}:${event.resourceId} by ${event.userName}`);
  return auditLog;
}

export async function getAuditLogs(filters: {
  resource?: string;
  resourceId?: string;
  userId?: string;
  action?: string;
  limit?: number;
  skip?: number;
} = {}): Promise<AuditLog[]> {
  await seedMemoryDB();
  
  let logs = memoryDB.auditLogs.all();

  if (filters.resource) logs = logs.filter(l => l.resource === filters.resource);
  if (filters.resourceId) logs = logs.filter(l => l.resourceId === filters.resourceId);
  if (filters.userId) logs = logs.filter(l => l.userId === filters.userId);
  if (filters.action) logs = logs.filter(l => l.action === filters.action);

  logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (filters.skip) logs = logs.slice(filters.skip);
  if (filters.limit) logs = logs.slice(0, filters.limit);

  return logs;
}
