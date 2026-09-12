import bcrypt from 'bcryptjs';
import { memoryDB, seedMemoryDB } from '../db/memory-store';
import { connectDB, isDBConnected } from '../db/connection';
import { UserModel } from '../db/models';
import { signSession, type SessionUser } from './session';
import type { Role, User } from '@/types';

export type { SessionUser };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * For users created directly in MongoDB we ensure a known default password
 * exists in demo environments. Demo accounts use the hash below.
 */
export const DEMO_PASSWORD = 'Gov@2026';
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

export async function ensureDefaultUsers() {
  await seedMemoryDB();
  try {
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      const count = await UserModel.countDocuments();
      if (count === 0) {
        await UserModel.create(
          (['admin@gov.in', 'officer@gov.in', 'reviewer@gov.in', 'analyst@gov.in'] as const).map((email, i) => {
            const seeded = memoryDB.users.all().find(u => u.email === email);
            return {
              email,
              name: seeded?.name || email.split('@')[0],
              officialId: seeded?.officialId || `GOV-DEMO-${i}`,
              role: (seeded?.role || 'ENFORCEMENT_OFFICER') as Role,
              department: seeded?.department || 'Legal Metrology',
              passwordHash: DEFAULT_PASSWORD_HASH,
              active: true,
            };
          })
        );
      }
    }
  } catch (e) {
    console.warn('ensureDefaultUsers mongo error', e);
  }
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: SessionUser; token: string } | null> {
  await ensureDefaultUsers();
  const normalizedEmail = (email || '').trim().toLowerCase();

  // 1) In-memory store (demo / MongoDB unavailable)
  const memUser = await memoryDB.users.findOne({ email: normalizedEmail } as any);
  if (memUser && memUser.active) {
    const hash = (memUser as any).passwordHash || DEFAULT_PASSWORD_HASH;
    if (await verifyPassword(password, hash)) {
      const sessionUser: SessionUser = {
        id: memUser.id,
        email: memUser.email,
        name: memUser.name,
        role: memUser.role,
        officialId: memUser.officialId,
      };
      return { user: sessionUser, token: signSession(sessionUser) };
    }
  }

  // 2) MongoDB (when reachable)
  try {
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      const dbUser: any = await UserModel.findOne({ email: normalizedEmail, active: true });
      if (dbUser && (await verifyPassword(password, dbUser.passwordHash))) {
        const sessionUser: SessionUser = {
          id: dbUser._id.toString(),
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role as Role,
          officialId: dbUser.officialId,
        };
        dbUser.lastLogin = new Date();
        await dbUser.save();
        return { user: sessionUser, token: signSession(sessionUser) };
      }
    }
  } catch (e) {
    console.warn('Mongo auth failed, memory result stands', e);
  }

  return null;
}

export async function getUserById(id: string): Promise<User | null> {
  await seedMemoryDB();
  const mem = await memoryDB.users.findById(id);
  if (mem) return mem;
  try {
    const connected = await connectDB();
    if (connected && isDBConnected()) {
      const dbUser: any = await UserModel.findById(id);
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
