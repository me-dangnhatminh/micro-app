import { registerAs } from '@nestjs/config';
import z from 'zod';

const configSchema = z.object({
  type: z.string().default('postgresql'),
  port: z.coerce.number().default(5432),
  host: z.string().default('localhost'),
  username: z.string().default('postgres'),
  password: z.string().default('postgres'),
  database: z.string().default('postgres'),
});

export default registerAs('db', () => {
  const valid = configSchema.safeParse({
    type: process.env.DB_TYPE,
    port: process.env.DB_PORT,
    host: process.env.DB_HOST,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
  if (valid.success) return valid.data;
  const msg = valid.error.errors.map((err) => err.message).join(', ');
  throw new Error(`Invalid 'db' config: ${msg}`);
});
