import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, isResponse } from '@/lib/auth/session';
import { db } from '@/lib/db/repository';
import { answerQuestion, NOTHING_SELECTED_PROMPT } from '@/lib/assistant/assistant';

const bodySchema = z.object({
  question: z.string().trim().min(1, 'Ask a question first.').max(500),
  /** Optional. Without it the assistant asks which inspection to look at. */
  inspectionId: z.string().optional(),
});

/**
 * Answers strictly from stored records. The assistant holds no model and no memory of
 * its own, so it cannot answer about an inspection it was not given.
 */
export async function POST(req: NextRequest) {
  const user = requirePermission('inspection:read');
  if (isResponse(user)) return user;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'A question of 1–500 characters is required.' } },
      { status: 400 }
    );
  }

  let inspection = null;
  if (parsed.inspectionId) {
    inspection =
      (await db.inspections.get(parsed.inspectionId)) ||
      (await db.inspections.findOne({ inspectionNumber: parsed.inspectionId }));
    if (!inspection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'That inspection could not be found.' } },
        { status: 404 }
      );
    }
  }

  const rules = inspection
    ? await db.rules.list({ status: 'PUBLISHED', enabled: true }, { limit: 500 })
    : [];

  const reply = answerQuestion(parsed.question, { inspection, rules });

  return NextResponse.json({
    success: true,
    data: {
      question: parsed.question,
      answer: reply.answer,
      groundedIn: reply.groundedIn,
      answered: reply.answered,
      inspectionId: inspection?.id || null,
      // Stated plainly so nobody mistakes this for a language model's opinion.
      source: 'stored-records',
      needsInspection: !inspection && reply.answer === NOTHING_SELECTED_PROMPT,
    },
  });
}
