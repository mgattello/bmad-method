// Path constants (AD-1); the api mounts under API_PREFIX, web and e2e call the full paths.
export const API_PREFIX = '/api/v1';

export const TODOS_PATH = `${API_PREFIX}/todos`;

export const HEALTH_PATH = `${API_PREFIX}/health`;

export function todoPath(id: string): string {
  return `${TODOS_PATH}/${encodeURIComponent(id)}`;
}
