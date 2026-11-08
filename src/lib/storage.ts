import { z } from 'zod'

export function readLocal<T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const result = schema.safeParse(JSON.parse(raw))
    return result.success ? result.data : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(
  key: string,
  value: string | boolean | string[],
): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage restrictions must not prevent in-memory preference changes.
  }
}
