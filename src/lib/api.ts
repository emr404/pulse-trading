import { z } from 'zod'
import { apiErrorSchema } from '../../shared/api'
import { apiUrl } from './endpoints'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const signal = init?.signal ?? AbortSignal.timeout(10000)
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new ApiError(
      'Unable to reach the server. Check your connection and retry.',
      0,
    )
  }
  const text = await response.text()
  if (!response.ok) {
    let message = `Request failed (${response.status}). Please try again.`
    try {
      const result = apiErrorSchema.safeParse(JSON.parse(text))
      if (result.success) message = result.data.error
    } catch {
      // Proxies may return HTML instead of the API's JSON error envelope.
    }
    throw new ApiError(message, response.status)
  }
  try {
    return schema.parse(JSON.parse(text))
  } catch {
    throw new ApiError(
      'The server returned an invalid response. Please retry.',
      response.status,
    )
  }
}
