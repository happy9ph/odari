const TOKEN = 'hodari_token'
export const getToken = () => localStorage.getItem(TOKEN)
export const setSession = (t, name) => { localStorage.setItem(TOKEN, t); localStorage.setItem('hodari_name', name) }
export const clearSession = () => ['hodari_token', 'hodari_name'].forEach((k) => localStorage.removeItem(k))

export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (getToken()) headers.Authorization = 'Bearer ' + getToken()
  const r = await fetch('/api' + path, { ...opts, headers })
  if (r.status === 401 && path !== '/auth/login') { clearSession(); window.location.href = '/login' }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error(typeof e.detail === 'string' ? e.detail : 'Invalid data, please check the form')
  }
  return r.status === 204 ? null : r.json()
}

export async function download(path, filename) {
  const r = await fetch('/api' + path, { headers: { Authorization: 'Bearer ' + getToken() } })
  if (!r.ok) throw new Error('Download failed')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(await r.blob())
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
