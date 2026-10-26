import type { ErrorCode } from '@todo/contract';

// Single home for user-facing copy; the server message is never rendered.
export const errorCopy: Record<'load', Record<ErrorCode, string>> = {
  load: {
    INTERNAL_ERROR: "We couldn't load your todos. Check your connection and try again.",
    NOT_FOUND: "We couldn't find your todo list. Try again.",
    VALIDATION_ERROR: "We couldn't load your todos because the request was rejected. Try again.",
  },
};

export const emptyStateCopy = 'No todos yet. Add your first one above.';

export const loadingCopy = 'Loading your todos';

export const retryLabel = 'Retry';
