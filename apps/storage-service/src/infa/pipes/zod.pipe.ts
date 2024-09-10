import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import * as z from 'zod';

@Injectable()
export class ZodValidator implements PipeTransform {
  constructor(private readonly schema: z.ZodType<any>) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    const msg = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new BadRequestException(msg);
  }
}

export const zodValidate =
  <TSchema extends z.ZodType<any>>(schema: TSchema) =>
  (data: any): z.infer<TSchema> => {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const msg = result.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new BadRequestException(msg);
  };

export function useZodPipe<T = unknown>(schema: z.ZodType<T>) {
  return new ZodValidator(schema);
}
