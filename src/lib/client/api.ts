export interface ApiError {
  code?: string;
  message: string;
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.status = status;
    this.code = error.code;
  }
}

async function handle(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiRequestError(res.status, body?.error || { message: 'Request failed' });
  }
  return body.data;
}

export const api = {
  get: <T = any>(path: string) => fetch(path, { cache: 'no-store' }).then(handle) as Promise<T>,
  post: <T = any>(path: string, body?: unknown) =>
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    }).then(handle) as Promise<T>,
  patch: <T = any>(path: string, body: unknown) =>
    fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle) as Promise<T>,
};

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}
