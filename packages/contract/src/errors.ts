import Type, { type Static } from 'typebox';

// Fixed code set (AD-3); no TypeScript enum.
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorBodySchema = Type.Object(
  {
    code: Type.Union([
      Type.Literal(ErrorCode.VALIDATION_ERROR),
      Type.Literal(ErrorCode.NOT_FOUND),
      Type.Literal(ErrorCode.INTERNAL_ERROR),
    ]),
    message: Type.String(),
  },
  { additionalProperties: false },
);

export type ErrorBody = Static<typeof ErrorBodySchema>;

export const HealthBodySchema = Type.Object(
  { status: Type.Union([Type.Literal('ok'), Type.Literal('degraded')]) },
  { additionalProperties: false },
);

export type HealthBody = Static<typeof HealthBodySchema>;
