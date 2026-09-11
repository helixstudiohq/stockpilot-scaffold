import { z } from "zod";

/**
 * Environment-based configuration.
 * All runtime configuration is validated once at startup; anything optional
 * falls back to a safe default so the app boots without extra setup.
 */

const envSchema = z.object({
  /** Base URL of the FastAPI backend (empty = not wired up yet). */
  VITE_API_URL: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  // Fail loudly and early: configuration errors should never surface as
  // mysterious runtime bugs deep inside a screen.
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
