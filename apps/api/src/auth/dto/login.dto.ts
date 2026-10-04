import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1).max(254),
  // bcrypt reads 72 bytes at most; the cap only keeps oversized bodies out.
  password: z.string().min(1).max(200),
  /** When true, issue a persistent cookie with role-specific expiry. Defaults to false. */
  rememberMe: z.boolean().optional(),
});

export type LoginDto = z.infer<typeof loginSchema>;
