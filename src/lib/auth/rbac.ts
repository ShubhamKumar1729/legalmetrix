import type { Role } from '@/types';

export type Permission =
  | 'inspection:create'
  | 'inspection:read'
  | 'inspection:update'
  | 'inspection:delete'
  | 'review:read'
  | 'review:write'
  | 'product:read'
  | 'product:history'
  | 'rule:read'
  | 'rule:write'
  | 'rule:publish'
  | 'analytics:read'
  | 'report:read'
  | 'report:write'
  | 'report:download'
  | 'user:read'
  | 'user:write'
  | 'audit:read'
  | 'config:read'
  | 'config:write'
  | 'ecommerce:analyze';

const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'inspection:create','inspection:read','inspection:update','inspection:delete',
    'review:read','review:write',
    'product:read','product:history',
    'rule:read','rule:write','rule:publish',
    'analytics:read',
    'report:read','report:write','report:download',
    'user:read','user:write',
    'audit:read',
    'config:read','config:write',
    'ecommerce:analyze'
  ],
  REGULATORY_ADMIN: [
    'inspection:read',
    'product:read','product:history',
    'rule:read','rule:write','rule:publish',
    'analytics:read',
    'report:read',
    'config:read','config:write',
    'audit:read'
  ],
  ENFORCEMENT_OFFICER: [
    'inspection:create','inspection:read','inspection:update',
    'product:read',
    'report:read','report:write',
    'ecommerce:analyze',
    'rule:read'
  ],
  REVIEWER: [
    'inspection:read','inspection:update',
    'review:read','review:write',
    'product:read','product:history',
    'report:read','report:write',
    'rule:read'
  ],
  ANALYST: [
    'inspection:read',
    'product:read','product:history',
    'analytics:read',
    'report:read','report:download',
    'rule:read',
    'ecommerce:analyze'
  ],
  AUDITOR: [
    'inspection:read',
    'product:read','product:history',
    'rule:read',
    'report:read',
    'audit:read',
    'analytics:read'
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) || false;
}

export function canAccessRoute(role: Role, path: string): boolean {
  // Public routes
  if (path === '/' || path.startsWith('/login')) return true;

  // Role-based route mapping
  if (path.startsWith('/app/admin')) {
    return ['SUPER_ADMIN','REGULATORY_ADMIN'].includes(role) || (role === 'AUDITOR' && path.includes('audit-log'));
  }
  if (path.startsWith('/app/rules') || path.startsWith('/app/rule-versions')) {
    return hasPermission(role, 'rule:read');
  }
  if (path.startsWith('/app/review')) {
    return hasPermission(role, 'review:read');
  }
  if (path.startsWith('/app/analytics')) {
    return hasPermission(role, 'analytics:read');
  }
  // All authenticated can access dashboard, scan, products, reports, ecommerce
  return true;
}
