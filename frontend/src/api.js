const TOKEN = 'hodari_token'
export const getToken = () => localStorage.getItem(TOKEN)
export const getRole = () => localStorage.getItem('hodari_role') || ''
export const mustChange = () => localStorage.getItem('hodari_must') === '1'
export const setMust = (v) => localStorage.setItem('hodari_must', v ? '1' : '0')
export const setSession = (t, name, role, must) => {
  localStorage.setItem(TOKEN, t); localStorage.setItem('hodari_name', name); localStorage.setItem('hodari_role', role); setMust(must)
}
export const clearSession = () => ['hodari_token', 'hodari_name', 'hodari_role', 'hodari_must'].forEach((k) => localStorage.removeItem(k))

export async function api(path, opts = {}) {
  const headers = {}
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (getToken()) headers.Authorization = 'Bearer ' + getToken()
  const r = await fetch('/api' + path, { ...opts, headers })
  if (r.status === 401 && path !== '/auth/login') { clearSession(); window.location.href = '/login' }
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    const d = e.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) && d[0] ? `${d[0].loc?.slice(-1)[0] ?? 'Field'}: ${d[0].msg}` : 'Invalid data, please check the form')
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
