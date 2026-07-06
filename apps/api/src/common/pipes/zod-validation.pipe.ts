import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

function formatZodError(error: ZodError): { message: string; errors: { path: string; message: string }[] } {
  return {
    message: 'Validation failed',
    errors: error.issues.map((issue) => ({
      path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      message: issue.message,
    })),
  };
}

/** Schema-agnostic Zod pipe — reusable across all CRUD modules. */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(formatZodError(result.error));
    }
    return result.data;
  }
}
