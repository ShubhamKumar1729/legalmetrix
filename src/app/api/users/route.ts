import { NextRequest, NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';
import { guardRequest, getSessionUser } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/audit';
import { hashPassword } from '@/lib/auth/auth';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import type { Role } from '@/types';


export async function GET(req: NextRequest) {
  const denied = guardRequest(req, 'user:read');
  if (denied) return denied;
  await seedMemoryDB();
  const users = memoryDB.users.all().map(({ passwordHash, ...u }: any) => u);
  return NextResponse.json({ success: true, data: users });
}

const createUserSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  officialId: z.string().min(3, 'Official ID is required'),
  role: z.enum(['SUPER_ADMIN', 'REGULATORY_ADMIN', 'ENFORCEMENT_OFFICER', 'REVIEWER', 'ANALYST', 'AUDITOR']),
  department: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(req: NextRequest) {
  const denied = guardRequest(req, 'user:write');
  if (denied) return denied;
  const session = getSessionUser(req)!;

  const parsed = createUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.errors[0]?.message || 'Invalid input' } },
      { status: 400 }
    );
  }
  const data = parsed.data;
  await seedMemoryDB();

  if (memoryDB.users.all().some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
    return NextResponse.json({ success: false, error: { message: 'A user with this email already exists' } }, { status: 409 });
  }
  if (memoryDB.users.all().some(u => u.officialId === data.officialId)) {
    return NextResponse.json({ success: false, error: { message: 'This Official ID is already taken' } }, { status: 409 });
  }

  const user = await memoryDB.users.create({
    id: uuidv4(),
    email: data.email.toLowerCase(),
    name: data.name,
    officialId: data.officialId,
    role: data.role as Role,
    department: data.department || '',
    active: true,
    createdAt: new Date().toISOString(),
    passwordHash: await hashPassword(data.password),
  } as any);

  await logAudit({
    userId: session.id, userName: session.name, role: session.role,
    action: 'USER_CREATED', resource: 'USER', resourceId: user.id,
    newValue: { email: user.email, role: user.role },
  });

  const { passwordHash, ...safe } = user as any;
  return NextResponse.json({ success: true, data: safe });
}

const patchUserSchema = z.object({
  id: z.string().min(1),
  active: z.boolean().optional(),
  role: z.enum(['SUPER_ADMIN', 'REGULATORY_ADMIN', 'ENFORCEMENT_OFFICER', 'REVIEWER', 'ANALYST', 'AUDITOR']).optional(),
});

export async function PATCH(req: NextRequest) {
  const denied = guardRequest(req, 'user:write');
  if (denied) return denied;
  const session = getSessionUser(req)!;

  const parsed = patchUserSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { message: 'Invalid input' } }, { status: 400 });
  }
  await seedMemoryDB();
  const existing = await memoryDB.users.findById(parsed.data.id);
  if (!existing) {
    return NextResponse.json({ success: false, error: { message: 'User not found' } }, { status: 404 });
  }

  const updated = await memoryDB.users.update(existing.id, {
    ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}),
    ...(parsed.data.role ? { role: parsed.data.role as Role } : {}),
  } as any);

  await logAudit({
    userId: session.id, userName: session.name, role: session.role,
    action: 'USER_UPDATED', resource: 'USER', resourceId: existing.id,
    oldValue: { active: existing.active, role: existing.role },
    newValue: { active: (updated as any)?.active, role: (updated as any)?.role },
  });

  const { passwordHash, ...safe } = (updated || {}) as any;
  return NextResponse.json({ success: true, data: safe });
}

