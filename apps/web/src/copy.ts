import { DESCRIPTION_MAX, type ErrorCode } from '@todo/contract';

// Single home for user-facing copy; the server message is never rendered.
export const errorCopy: Record<
  'load' | 'create' | 'toggle' | 'delete',
  Record<ErrorCode, string>
> = {
  load: {
    INTERNAL_ERROR: "We couldn't load your todos. Check your connection and try again.",
    NOT_FOUND: "We couldn't find your todo list. Try again.",
    VALIDATION_ERROR: "We couldn't load your todos because the request was rejected. Try again.",
  },
  create: {
    VALIDATION_ERROR: `Enter a todo of 1 to ${DESCRIPTION_MAX} characters.`,
    INTERNAL_ERROR: "We couldn't add your todo. Check your connection and try again.",
    NOT_FOUND: "We couldn't add your todo. Try again.",
  },
  toggle: {
    INTERNAL_ERROR: "We couldn't update your todo. Check your connection and try again.",
    NOT_FOUND: 'That todo no longer exists, so it was removed from your list.',
    VALIDATION_ERROR: "We couldn't update your todo because the request was rejected. Try again.",
  },
  delete: {
    INTERNAL_ERROR: "We couldn't delete your todo. Check your connection and try again.",
    NOT_FOUND: 'That todo no longer exists, so it was removed from your list.',
    VALIDATION_ERROR: "We couldn't delete your todo because the request was rejected. Try again.",
  },
};

export const emptyStateCopy = 'No todos yet. Add your first one above.';

export const loadingCopy = 'Loading your todos';

export const retryLabel = 'Retry';

export const addLabel = 'Add';
