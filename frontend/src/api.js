export class ApiError extends Error {
  constructor(code, statusCode = 0) {
    super(code)
    this.code = code
    this.statusCode = statusCode
  }
}

export async function api(path, { token, method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new ApiError('network')
  }

  const payload = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event('store-auth-expired'))
      throw new ApiError('unauthorized', 401)
    }
    if (response.status === 403) throw new ApiError('forbidden', 403)
    if (response.status === 400 || response.status === 404 || response.status === 409) {
      throw new ApiError('invalid', response.status)
    }
    throw new ApiError('generic', response.status)
  }
  return payload
}

export function queryString(values) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) params.set(key, value)
  })
  const query = params.toString()
  return query ? `?${query}` : ''
}
