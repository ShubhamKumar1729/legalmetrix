import type { Role, SimpleRole } from '@/types';

export type Permission =
  | 'inspection:create'
  | 'inspection:read'
  | 'inspection:update'
  | 'inspection:delete'
  | 'review:read'
  | 'review:write'
  | 'product:read'
  | 'rule:read'
  | 'rule:write'
  | 'rule:publish'
  | 'analytics:read'
  | 'report:read'
  | 'report:write'
  | 'user:read'
  | 'user:write'
  | 'audit:read'
  | 'config:read'
  | 'config:write'
  | 'ecommerce:analyze';

const ALL: Permission[] = [
  'inspection:create','inspection:read','inspection:update','inspection:delete',
  'review:read','review:write',
  'product:read',
  'rule:read','rule:write','rule:publish',
  'analytics:read',
  'report:read','report:write',
  'user:read','user:write',
  'audit:read',
  'config:read','config:write',
  'ecommerce:analyze',
];

const rolePermissions: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  REGULATORY_ADMIN: [
    'inspection:read','inspection:update',
    'review:read','review:write',
    'product:read',
    'rule:read','rule:write','rule:publish',
    'analytics:read',
    'report:read','report:write',
    'audit:read',
    'config:read','config:write',
  ],
  ENFORCEMENT_OFFICER: [
    'inspection:create','inspection:read','inspection:update',
    'review:read','review:write',
    'product:read',
    'rule:read',
    'report:read','report:write',
    'ecommerce:analyze',
  ],
  REVIEWER: [
    'inspection:read','inspection:update',
    'review:read','review:write',
    'product:read',
    'rule:read',
    'report:read','report:write',
  ],
  ANALYST: [
    'inspection:read',
    'product:read',
    'analytics:read',
    'report:read','report:write',
    'rule:read',
    'ecommerce:analyze',
  ],
  AUDITOR: [
    'inspection:read',
    'product:read',
    'rule:read',
    'report:read',
    'audit:read',
    'analytics:read',
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return rolePermissions[role] ?? [];
}

/**
 * The three roles the interface talks about. Additional backend roles are mapped onto
 * one of these so ordinary users never have to reason about the full matrix.
 */
export function simpleRole(role: Role): SimpleRole {
  if (role === 'REVIEWER') return 'REVIEWER';
  if (role === 'SUPER_ADMIN' || role === 'REGULATORY_ADMIN') return 'ADMIN';
  return 'INSPECTOR';
}

export const SIMPLE_ROLE_LABEL: Record<SimpleRole, string> = {
  INSPECTOR: 'Inspector',
  REVIEWER: 'Reviewer',
  ADMIN: 'Administrator',
};

export const SIMPLE_ROLE_DESCRIPTION: Record<SimpleRole, string> = {
  INSPECTOR: 'Captures packages and submits inspections',
  REVIEWER: 'Reviews uncertain or flagged findings',
  ADMIN: 'Manages rules, users and system configuration',
};

export const ADMIN_ROLES: Role[] = ['SUPER_ADMIN', 'REGULATORY_ADMIN'];

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role) || role === 'AUDITOR';
}
