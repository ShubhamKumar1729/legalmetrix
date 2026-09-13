'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, Loader2, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/client/api';

interface Reply {
  question: string;
  answer: string;
  groundedIn: string[];
  answered: boolean;
  inspectionId: string | null;
  needsInspection: boolean;
}

interface ThreadEntry extends Reply {
  id: string;
  mine: boolean;
}

const SUGGESTIONS = [
  'What failed this inspection?',
  'What needs review?',
  'Which rules were applied?',
  'Who reviewed this?',
];

/**
 * Reads answers from POST /api/assistant, which answers only from stored records.
 * The panel never composes an answer itself, so nothing here can invent a fact.
 */
export function AssistantPanel({ inspectionId }: { inspectionId?: string }) {
  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [thread.length, busy]);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setBusy(true);
    setError('');
    setThread((current) => [...current, { id: `q-${Date.now()}`, question: trimmed, answer: '', groundedIn: [], answered: true, inspectionId: null, needsInspection: false, mine: true }]);
    setQuestion('');

    try {
      const reply = await api.post<Reply>('/api/assistant', {
        question: trimmed,
        ...(inspectionId ? { inspectionId } : {}),
      });
      setThread((current) => [
        ...current,
        { id: `a-${Date.now()}`, mine: false, ...reply },
      ]);
    } catch (requestError) {
      setError(errorMessage(requestError, 'The assistant could not answer that.'));
      setThread((current) => current.slice(0, -1));
      setQuestion(trimmed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-0 bg-white shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> Compliance assistant
        </CardTitle>
        <CardDescription>
          Answers come from this inspection&rsquo;s stored record only. There is no language model here, so it
          will tell you when it does not know rather than guess.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div ref={listRef} className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {thread.length === 0 && (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              {inspectionId
                ? 'Ask about the outcome, the findings, or which rules were applied.'
                : 'Which inspection would you like me to look at?'}
            </p>
          )}

          {thread.map((entry) =>
            entry.mine ? (
              <div key={entry.id} className="ml-8 rounded-lg bg-slate-900 px-3 py-2 text-sm text-white">
                {entry.question}
              </div>
            ) : (
              <div key={entry.id} className="mr-8 rounded-lg border p-3 text-sm">
                <p className="whitespace-pre-line">{entry.answer}</p>
                {entry.groundedIn.length > 0 && (
                  <p className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
                    <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    From stored records: {entry.groundedIn.join(', ')}
                  </p>
                )}
              </div>
            )
          )}

          {busy && (
            <div className="mr-8 flex items-center gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the stored record…
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {thread.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="rounded-full text-xs"
                disabled={busy}
                onClick={() => void ask(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about this inspection…"
            aria-label="Ask the assistant"
            maxLength={500}
            className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" className="rounded-full" disabled={busy || question.trim().length === 0}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
