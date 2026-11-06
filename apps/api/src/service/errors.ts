// The service's only signal for a rule failure; the error handler maps it to the envelope.
export class ValidationError extends Error {
  statusCode = 400;
  override name = 'ValidationError';
}

// The service's only not-found signal; statusOf in app.ts maps 404 to the NOT_FOUND envelope.
export class NotFoundError extends Error {
  statusCode = 404;
  override name = 'NotFoundError';
}
