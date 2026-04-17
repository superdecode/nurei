/** Same-origin fetch including cookies (needed for some browsers / admin session). */
export function fetchWithCredentials(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, credentials: 'include' })
}
