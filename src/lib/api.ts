import { z } from 'zod'
import { apiErrorSchema } from '../../shared/api'
import { apiUrl } from './endpoints'

export interface ApiError extends Error { status: number }
export const createApiError = (message: string, status: number): ApiError =>
  Object.assign(new Error(message), { name: 'ApiError', status })

export const api = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> => {
  const signal = init?.signal ?? AbortSignal.timeout(10000)
  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw createApiError(
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
    throw createApiError(message, response.status)
  }
  try {
    return schema.parse(JSON.parse(text))
  } catch {
    throw createApiError(
      'The server returned an invalid response. Please retry.',
      response.status,
    )
  }
}
