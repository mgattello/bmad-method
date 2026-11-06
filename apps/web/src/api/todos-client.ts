import { ErrorCode, TODOS_PATH, todoPath, type Todo, type UpdateTodoBody } from '@todo/contract';

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode };

const KNOWN_CODES: readonly string[] = Object.values(ErrorCode);

function failure(): ApiResult<never> {
  return { ok: false, code: ErrorCode.INTERNAL_ERROR };
}

// Envelope code when the body carries a known one; anything else is INTERNAL_ERROR.
function envelopeCode(body: unknown): ErrorCode {
  if (typeof body !== 'object' || body === null || !('code' in body))
    return ErrorCode.INTERNAL_ERROR;
  const { code } = body;
  return typeof code === 'string' && KNOWN_CODES.includes(code)
    ? (code as ErrorCode)
    : ErrorCode.INTERNAL_ERROR;
}

function isTodo(body: unknown): body is Todo {
  return typeof body === 'object' && body !== null && 'id' in body && typeof body.id === 'string';
}

// Never throws or rejects past this boundary.
export async function listTodos(): Promise<ApiResult<Todo[]>> {
  try {
    const res = await fetch(TODOS_PATH, { headers: { accept: 'application/json' } });
    const body: unknown = await res.json().catch(() => undefined);
    if (res.ok) return Array.isArray(body) ? { ok: true, data: body as Todo[] } : failure();
    return { ok: false, code: envelopeCode(body) };
  } catch {
    return failure();
  }
}

// The only place the web talks to POST; the caller trims first.
export async function createTodo(description: string): Promise<ApiResult<Todo>> {
  try {
    const res = await fetch(TODOS_PATH, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ description }),
    });
    const body: unknown = await res.json().catch(() => undefined);
    if (res.ok) return isTodo(body) ? { ok: true, data: body } : failure();
    return { ok: false, code: envelopeCode(body) };
  } catch {
    return failure();
  }
}

// The only place the web talks to PATCH; takes a full UpdateTodoBody so later edits reuse it.
export async function updateTodo(id: string, patch: UpdateTodoBody): Promise<ApiResult<Todo>> {
  try {
    const res = await fetch(todoPath(id), {
      method: 'PATCH',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const body: unknown = await res.json().catch(() => undefined);
    if (res.ok) return isTodo(body) ? { ok: true, data: body } : failure();
    return { ok: false, code: envelopeCode(body) };
  } catch {
    return failure();
  }
}
