import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/auth';
import { logAudit } from '@/lib/audit/audit';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Email and password required' } }, { status: 400 });
    }

    const result = await authenticateUser(email, password);

    if (!result) {
      return NextResponse.json({ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } }, { status: 401 });
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

    return NextResponse.json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
      }
    });
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json({ success: false, error: { code: 'SERVER_ERROR', message: 'Login failed' } }, { status: 500 });
  }
}
