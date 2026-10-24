import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X, Trash2 } from 'lucide-react'

export const btn = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/25 active:scale-[.98] disabled:pointer-events-none disabled:opacity-60'
export const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm shadow-slate-900/[.02] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand focus:ring-4 focus:ring-brand/15'

const Ctx = createContext(null)
export const useUI = () => useContext(Ctx)

const TYPES = {
  success: [CheckCircle2, 'text-emerald-600', 'border-emerald-500', 'bg-emerald-500', 'bg-emerald-50'],
  error: [XCircle, 'text-red-600', 'border-red-500', 'bg-red-500', 'bg-red-50'],
  info: [Info, 'text-brand', 'border-brand', 'bg-brand', 'bg-blue-50'],
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dialog, setDialog] = useState(null)
  const n = useRef(0)
  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const push = useCallback((type) => (title, msg) => {
    const id = ++n.current
    setToasts((t) => [...t.slice(-3), { id, type, title, msg }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])
  const value = useMemo(() => ({
    success: push('success'), error: push('error'), info: push('info'),
    confirm: (o) => new Promise((res) => setDialog({ ...o, res })),
  }), [push])
  const answer = (v) => { dialog.res(v); setDialog(null) }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col gap-3 sm:inset-x-auto sm:bottom-auto sm:right-6 sm:top-6 sm:w-[380px]">
        {toasts.map((t) => {
          const [Icon, text, border, bar, soft] = TYPES[t.type]
          return (
            <div key={t.id} role="status" className={`slide pointer-events-auto relative overflow-hidden rounded-xl border-l-4 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 ${border}`}>
              <div className="flex items-start gap-3 p-4 pr-3">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${soft} ${text}`}><Icon size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5 text-navy-800">{t.title}</p>
                  {t.msg && <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{t.msg}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} aria-label="Close" className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X size={15} /></button>
              </div>
              <i className={`absolute bottom-0 left-0 h-0.5 opacity-60 ${bar}`} style={{ animation: 'shrink 4s linear forwards' }} />
            </div>
          )
        })}
      </div>
      {dialog && (
        <Modal onClose={() => answer(false)} small>
          <div className="text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500 ring-8 ring-red-50/60"><Trash2 size={22} /></span>
            <h3 className="mt-5 text-lg font-bold text-navy-800">{dialog.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{dialog.message}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => answer(false)} className={btn + ' !text-slate-700 bg-slate-100 shadow-none hover:!bg-slate-200'}>Cancel</button>
              <button onClick={() => answer(true)} className={btn + ' bg-red-500'}>{dialog.confirmText || 'Confirm'}</button>
            </div>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  )
}

export function Modal({ title, onClose, children, small, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [])
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-900/50 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" onMouseDown={(e) => e.stopPropagation()}
        className={`sheet max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl ${small ? 'sm:max-w-sm' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        {title && (
          <div className="-mx-6 -mt-6 mb-5 flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-lg font-bold text-navy-800">{title}</h3>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><X size={20} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />

export function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf
    const t0 = performance.now()
    const f = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(f)
    }
    raf = requestAnimationFrame(f)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return v
}

const saved = localStorage.getItem('hodari_theme')
document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches)

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('hodari_theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((d) => !d) }
}
