import { HEALTH_PATH, TODOS_PATH } from '@todo/contract';
import { describe, expect, it } from 'vitest';

import { ROUTES } from './server.js';

describe('api placeholder', () => {
  it('resolves @todo/contract from the api workspace', () => {
    expect(ROUTES.todos).toBe(TODOS_PATH);
    expect(ROUTES.health).toBe(HEALTH_PATH);
  });
});
