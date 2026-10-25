import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { api } from './api'
import { btn, field } from './ui'

export const TONE = {
  blue: 'from-blue-700 to-sky-400', emerald: 'from-emerald-700 to-teal-400', amber: 'from-amber-600 to-yellow-400',
  rose: 'from-rose-700 to-pink-400', violet: 'from-violet-700 to-purple-400', sky: 'from-sky-700 to-cyan-400',
}
export const EVENT_TONE = {
  Exam: 'bg-red-100 text-red-700', Holiday: 'bg-emerald-100 text-emerald-700', Meeting: 'bg-amber-100 text-amber-700',
  Event: 'bg-blue-100 text-brand', Assignment: 'bg-violet-100 text-violet-700', Quiz: 'bg-sky-100 text-sky-700',
}
export const STATE_TONE = {
  'To do': 'bg-blue-100 text-brand', Overdue: 'bg-red-100 text-red-700', Submitted: 'bg-emerald-100 text-emerald-700',
  Late: 'bg-amber-100 text-amber-700', Graded: 'bg-violet-100 text-violet-700',
}
export const fmt = (d) => (d ? d.split('-').reverse().join('/') : '')
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '')
export const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

export const ClassSelect = ({ classes, value, onChange, all }) => (
  <select className={field} value={value} onChange={onChange}>
    {all && <option value="">{all}</option>}
    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}
  </select>
)

export const Actions = ({ onClose, busy, label = 'Save' }) => (
  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
    <button type="button" onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Cancel</button>
    <button disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{label}</button>
  </div>
)

export const Tabs = ({ list, value, onChange }) => (
  <div className="mb-5 flex gap-6 overflow-x-auto border-b border-slate-200">
    {list.map(([k, label]) => (
      <button key={k} onClick={() => onChange(k)} className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition ${value === k ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>))}
  </div>
)

export const Pill = ({ tone, children }) => <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>{children}</span>

// generic "send a JSON body" helper used by modal forms
export function useSave(ui, done) {
  const [busy, setBusy] = useState(false)
  return [busy, async (path, method, body, okMsg) => {
    setBusy(true)
    try { await api(path, { method, body: JSON.stringify(body) }); ui.success(okMsg); done() } catch (x) { ui.error('Could not save', x.message); setBusy(false) }
  }]
}
