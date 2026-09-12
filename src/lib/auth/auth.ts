import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { memoryDB, seedMemoryDB } from '../db/memory-store';
import { connectDB, isDBConnected } from '../db/connection';
import { UserModel } from '../db/models';
import type { Role, User } from '@/types';

const SECRET = process.env.AUTH_SECRET || 'dev-secret-key-for-sih-26034-must-be-32-chars-long';
const EXPIRES_IN = process.env.AUTH_EXPIRES_IN || '7d';

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
  return bcrypt.compare(password, hash);
}

export function generateToken(user: SessionUser): string {
  return jwt.sign(user, SECRET, { expiresIn: EXPIRES_IN } as any);
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

// Ensure default users exist
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('Gov@2026', 10);

export async function ensureDefaultUsers() {
  await seedMemoryDB();
  // In-memory users already seeded, but ensure password hash exists in model layer
  // For MongoDB path, create if not exists
  try {
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      const count = await UserModel.countDocuments();
      if (count === 0) {
        await UserModel.create([
          {
            email: 'admin@gov.in',
            name: 'Super Administrator',
            officialId: 'GOV-SA-001',
            role: 'SUPER_ADMIN',
            department: 'Department of Consumer Affairs',
            passwordHash: DEFAULT_PASSWORD_HASH,
            active: true,
          },
          {
            email: 'officer@gov.in',
            name: 'Rajesh Kumar',
            officialId: 'GOV-EO-042',
            role: 'ENFORCEMENT_OFFICER',
            department: 'Legal Metrology - Punjab',
            passwordHash: DEFAULT_PASSWORD_HASH,
            active: true,
          },
          {
            email: 'reviewer@gov.in',
            name: 'Priya Sharma',
            officialId: 'GOV-RV-018',
            role: 'REVIEWER',
            department: 'Legal Metrology - Central',
            passwordHash: DEFAULT_PASSWORD_HASH,
            active: true,
          },
          {
            email: 'analyst@gov.in',
            name: 'Amit Patel',
            officialId: 'GOV-AN-007',
            role: 'ANALYST',
            department: 'Enforcement Analytics',
            passwordHash: DEFAULT_PASSWORD_HASH,
            active: true,
          },
        ]);
      }
    }
  } catch (e) {
    console.warn('ensureDefaultUsers mongo error', e);
  }
}

export async function authenticateUser(email: string, password: string): Promise<{ user: SessionUser; token: string } | null> {
  await ensureDefaultUsers();

  // Try memory first (demo mode)
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const memUser = await memoryDB.users.findOne({ email } as any);
    if (memUser) {
      // For demo, accept Gov@2026 or any password if user exists, but verify against known
      const valid = password === 'Gov@2026' || await verifyPassword(password, DEFAULT_PASSWORD_HASH);
      if (valid) {
        const sessionUser: SessionUser = {
          id: memUser.id,
          email: memUser.email,
          name: memUser.name,
          role: memUser.role,
          officialId: memUser.officialId,
        };
        const token = generateToken(sessionUser);
        return { user: sessionUser, token };
      }
    }
  }

  // Try MongoDB
  try {
    const connected = await connectDB();
    if (connected) {
      const dbUser = await UserModel.findOne({ email, active: true });
      if (dbUser) {
        const valid = await verifyPassword(password, dbUser.passwordHash);
        if (valid) {
          const sessionUser: SessionUser = {
            id: dbUser._id.toString(),
            email: dbUser.email,
            name: dbUser.name,
            role: dbUser.role as Role,
            officialId: dbUser.officialId,
          };
          const token = generateToken(sessionUser);
          // Update lastLogin
          dbUser.lastLogin = new Date();
          await dbUser.save();
          return { user: sessionUser, token };
        }
      }
    }
  } catch (e) {
    console.warn('Mongo auth failed, fallback to memory', e);
  }

  // Final fallback: check memory with hash
  const memUser = await memoryDB.users.findOne({ email } as any);
  if (memUser) {
    // Accept demo password
    if (password === 'Gov@2026') {
      const sessionUser: SessionUser = {
        id: memUser.id,
        email: memUser.email,
        name: memUser.name,
        role: memUser.role,
        officialId: memUser.officialId,
      };
      const token = generateToken(sessionUser);
      return { user: sessionUser, token };
    }
  }

  return null;
}

export async function getUserById(id: string): Promise<User | null> {
  await seedMemoryDB();
  const mem = await memoryDB.users.findById(id);
  if (mem) return mem;
  try {
    const connected = await connectDB();
    if (connected) {
      const dbUser = await UserModel.findById(id);
      if (dbUser) {
        return {
          id: dbUser._id.toString(),
          email: dbUser.email,
          name: dbUser.name,
          officialId: dbUser.officialId,
          role: dbUser.role as Role,
          department: dbUser.department,
          active: dbUser.active,
          lastLogin: dbUser.lastLogin?.toISOString(),
          createdAt: dbUser.createdAt.toISOString(),
        };
      }
    }
  } catch {}
  return null;
}
