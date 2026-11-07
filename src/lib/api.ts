import { apiUrl } from './endpoints'
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10000),
  })
  const body: unknown = await response.json()
  if (!response.ok)
    throw new Error(
      typeof body === 'object' && body !== null && 'error' in body
        ? String(body.error)
        : 'Request failed. Please try again.',
    )
  return body as T
}
