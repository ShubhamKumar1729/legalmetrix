import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/repository';
import { ensureBootstrapAdmin } from '../db/bootstrap';
import type { Role, User } from '@/types';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be set in production');
    }
    return 'legalmetrix-development-secret-change-me-32chars';
  }
  return secret;
}

const EXPIRES_IN = process.env.AUTH_EXPIRES_IN || '7d';
export const SESSION_COOKIE = 'legalmetrix_session';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  officialId: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

export function generateToken(user: SessionUser): string {
  return jwt.sign(user, getSecret(), { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): SessionUser | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as SessionUser & { iat: number; exp: number };
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      officialId: decoded.officialId || '',
    };
  } catch {
    return null;
  }
}

/**
 * Verifies credentials against the user collection.
 * There are no built-in or hard-coded accounts.
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: SessionUser; token: string } | null> {
  await ensureBootstrapAdmin();

  const normalized = email.trim().toLowerCase();
  const record = await db.users.findOne({ email: normalized });
  if (!record || !record.active) return null;

  const valid = await verifyPassword(password, record.passwordHash || '');
  if (!valid) return null;

  const sessionUser: SessionUser = {
    id: record.id,
    email: record.email,
    name: record.name,
    role: record.role,
    officialId: record.officialId,
  };

  await db.users
    .update(record.id, { lastLogin: new Date().toISOString() } as Partial<User & { passwordHash: string }>)
    .catch(() => null);

  return { user: sessionUser, token: generateToken(sessionUser) };
}

export async function getUserById(id: string): Promise<User | null> {
  const record = await db.users.get(id);
  if (!record) return null;
  const { passwordHash: _ignored, ...user } = record;
  return user as User;
}

export function publicUser(record: { passwordHash?: string } & Record<string, any>) {
  const { passwordHash: _ignored, ...rest } = record;
  return rest;
}
