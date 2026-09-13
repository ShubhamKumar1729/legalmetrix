import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, isResponse, badRequest, unauthorized } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { hashPassword, publicUser } from '@/lib/auth/auth';
import { logAudit } from '@/lib/audit/audit';
import type { Role } from '@/types';

const ROLES: Role[] = ['SUPER_ADMIN', 'REGULATORY_ADMIN', 'ENFORCEMENT_OFFICER', 'REVIEWER', 'ANALYST', 'AUDITOR'];

const createUserSchema = z.object({
  email: z.string().email('A valid email is required'),
  name: z.string().min(2, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(ROLES as [Role, ...Role[]]),
  officialId: z.string().default(''),
  department: z.string().default(''),
});

export async function GET() {
  const user = requirePermission('user:read');
  if (isResponse(user)) return user;

  const users = await db.users.list({}, { sortDescBy: 'createdAt' });
  return NextResponse.json({ success: true, data: { users: users.map(publicUser), total: users.length } });
}

/** Administrators create accounts here — there are no built-in accounts in the codebase. */
export async function POST(req: NextRequest) {
  const actor = requirePermission('user:write');
  if (isResponse(actor)) return actor;

  const body = await req.json().catch(() => ({}));
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues.map((i) => i.message).join(' '));

  const email = parsed.data.email.toLowerCase();
  if (await db.users.findOne({ email })) {
    return badRequest('An account with that email already exists.');
  }

  const created = await db.users.create({
    email,
    name: parsed.data.name,
    officialId: parsed.data.officialId,
    department: parsed.data.department,
    role: parsed.data.role,
    passwordHash: await hashPassword(parsed.data.password),
    active: true,
    createdAt: new Date().toISOString(),
  });

  await logAudit({
    userId: actor.id,
    userName: actor.name,
    role: actor.role,
    action: 'USER_CREATED',
    resource: 'USER',
    resourceId: created.id,
    newValue: { email, role: parsed.data.role },
  });

  return NextResponse.json({ success: true, data: publicUser(created) }, { status: 201 });
}
