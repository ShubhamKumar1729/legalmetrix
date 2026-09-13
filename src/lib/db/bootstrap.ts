/**
 * Bootstrap account provisioning.
 *
 * The application ships with NO user accounts. The first administrator can be created
 * in one of two ways:
 *
 *   1. Set BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD (plus the optional
 *      BOOTSTRAP_ADMIN_NAME) in the environment. The account is created on first
 *      startup if — and only if — no user exists yet.
 *   2. Ask an existing administrator to create the account from Admin → Users.
 *
 * Credentials are never stored in source control, and the bootstrap account is never
 * re-created after it has been removed.
 */
import { db } from './repository';
import { hashPassword } from '@/lib/auth/auth';
import type { Role } from '@/types';

export interface BootstrapSettings {
  configured: boolean;
  email?: string;
  name?: string;
  role: Role;
}

let bootstrapChecked = false;

export function getBootstrapSettings(): BootstrapSettings {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const configured = Boolean(email && password);
  return {
    configured,
    email: configured ? email : undefined,
    name: (process.env.BOOTSTRAP_ADMIN_NAME || '').trim() || undefined,
    role: (process.env.BOOTSTRAP_ADMIN_ROLE as Role) || 'SUPER_ADMIN',
  };
}

/** Creates the bootstrap administrator on an empty user collection. Idempotent. */
export async function ensureBootstrapAdmin(): Promise<{ created: boolean; email?: string }> {
  if (bootstrapChecked) return { created: false };

  const settings = getBootstrapSettings();
  if (!settings.configured) {
    bootstrapChecked = true;
    return { created: false };
  }

  try {
    const existing = await db.users.count();
    if (existing > 0) {
      bootstrapChecked = true;
      return { created: false };
    }

    const email = settings.email!.toLowerCase();
    const alreadyPresent = await db.users.findOne({ email });
    if (alreadyPresent) {
      bootstrapChecked = true;
      return { created: false };
    }

    await db.users.create({
      email,
      name: settings.name || email.split('@')[0],
      officialId: process.env.BOOTSTRAP_ADMIN_OFFICIAL_ID || '',
      role: settings.role,
      department: process.env.BOOTSTRAP_ADMIN_DEPARTMENT || '',
      passwordHash: await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD!),
      active: true,
      createdAt: new Date().toISOString(),
    });

    bootstrapChecked = true;
    console.info(`[auth] bootstrap administrator created (${email})`);
    return { created: true, email };
  } catch (error) {
    console.warn('[auth] bootstrap administrator could not be created:', (error as Error).message);
    return { created: false };
  }
}
