import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.string().optional().default("3000"),
  MONGODB_URI: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (!cachedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errorSummaries = result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      throw new Error(`Environment configuration error: ${errorSummaries.join("; ")}`);
    }
    cachedEnv = result.data;
  }
  return cachedEnv;
}

/**
 * Safely retrieves and validates database URI at runtime.
 * Does not break build time when secrets are not yet injected.
 */
export function getRuntimeDatabaseUri(): string | null {
  const env = getEnv();
  const uri = env.MONGODB_URI || process.env.MONGODB_URI;
  if (!uri || uri.trim() === "") {
    return null;
  }
  return uri;
}

