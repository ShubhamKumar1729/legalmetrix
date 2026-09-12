import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/auth';
import { withSessionCookie } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/audit';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid official email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = loginSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message || 'Invalid input' } },
        { status: 400 }
      );
    }

    const result = await authenticateUser(parsed.data.email, parsed.data.password);
    if (!result) {
      return NextResponse.json(
        { success: false, error: { code: 'AUTH_FAILED', message: 'Email or password is incorrect. Demo accounts are listed below the login form.' } },
        { status: 401 }
      );
    }

    await logAudit({
      userId: result.user.id,
      userName: result.user.name,
      role: result.user.role,
      action: 'LOGIN',
      resource: 'AUTH',
      resourceId: result.user.id,
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const res = NextResponse.json({ success: true, data: { user: result.user, token: result.token } });
    // httpOnly cookie → all later API calls from the browser are authenticated server-side
    return withSessionCookie(res, result.token);
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Login failed. Please try again.' } },
      { status: 500 }
    );
  }
}
