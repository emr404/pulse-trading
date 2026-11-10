// Public service addresses only. Provider secrets belong on the backend.
const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const apiUrl = (path: string): string => `${apiOrigin}${path}`
export const socketUrl = (): string => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const url = new URL('/ws', apiOrigin || location.origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.href
}
