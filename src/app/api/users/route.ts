import { NextResponse } from 'next/server';
import { memoryDB, seedMemoryDB } from '@/lib/db/memory-store';

export async function GET() {
  await seedMemoryDB();
  const users = memoryDB.users.all();
  return NextResponse.json({ success: true, data: users });
}
