import { z } from 'zod';

/** Raw action inputs are strings (or empty). Zod validates + coerces them. */
export const inputsSchema = z.object({
  config: z.string().min(1, 'the `config` input is required'),
  specVersion: z.string().min(1).optional(),
  // GitHub passes booleans as the strings "true"/"false"; empty = not set.
  regression: z
    .enum(['', 'true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
  failOn: z.enum(['error', 'warning']).optional(),
  junitFile: z.string().min(1).optional(),
});

export type ActionInputs = z.infer<typeof inputsSchema>;

export function parseInputs(raw: {
  config: string;
  specVersion?: string;
  regression?: string;
  failOn?: string;
  junitFile?: string;
}): ActionInputs {
  return inputsSchema.parse(raw);
}
