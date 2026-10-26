// The service's only signal for a rule failure; the error handler maps it to the envelope.
export class ValidationError extends Error {
  statusCode = 400;
  override name = 'ValidationError';
}
