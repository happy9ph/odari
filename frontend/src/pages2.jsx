import { useEffect, useState } from 'react'
import { Save, Loader2, Users, TrendingUp } from 'lucide-react'
import { api } from './api'
import { btn, field, Skeleton, useUI } from './ui'
import { Header, Card, Empty } from './App'

const tone = (v) => (v == null || v === '' ? 'text-slate-400' : v < 10 ? 'text-red-500' : v >= 14 ? 'text-emerald-600' : 'text-amber-600')

export function Grades() {
  const ui = useUI()
  const [meta, setMeta] = useState(null)
  const [classes, setClasses] = useState([])
  const [sel, setSel] = useState({ class_id: '', subject: '', term: '' })
  const [rows, setRows] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    Promise.all([api('/meta'), api('/classes')]).then(([m, c]) => {
      setMeta(m); setClasses(c); setSel({ class_id: c[0]?.id || '', subject: m.subjects[0], term: m.terms[0] })
    }).catch((e) => ui.error('Loading failed', e.message))
  }, [])
  useEffect(() => {
    if (!sel.class_id) return
    setRows(null); setDirty(false)
    api(`/grades?class_id=${sel.class_id}&subject=${encodeURIComponent(sel.subject)}&term=${encodeURIComponent(sel.term)}`).then(setRows)
  }, [sel])
  const pick = (k) => (e) => setSel({ ...sel, [k]: e.target.value })
  const setScore = (id, v) => { setDirty(true); setRows((r) => r.map((x) => (x.student_id === id ? { ...x, score: v } : x))) }
  const save = async () => {
    setBusy(true)
    try {
      await api('/grades', { method: 'PUT', body: JSON.stringify({ subject: sel.subject, term: sel.term, scores: rows.map((r) => ({ student_id: r.student_id, score: r.score === '' || r.score == null ? null : Number(r.score) })) }) })
      ui.success('Grades saved', `${sel.subject} · ${sel.term}`); setDirty(false)
    } catch (x) { ui.error('Could not save grades', x.message) } finally { setBusy(false) }
  }
  const vals = (rows || []).filter((r) => r.score !== '' && r.score != null).map((r) => Number(r.score))
  const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : '—'
  return (
    <>
      <Header title="Grades" sub="Enter and review scores by class, subject and term (out of 20)." />
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className={field} value={sel.class_id} onChange={pick('class_id')}>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}</select>
          <select className={field} value={sel.subject} onChange={pick('subject')}>{meta?.subjects.map((s) => <option key={s}>{s}</option>)}</select>
          <select className={field} value={sel.term} onChange={pick('term')}>{meta?.terms.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-semibold text-brand"><Users size={14} />{rows?.length ?? 0} students</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-600"><TrendingUp size={14} />Class average: {avg}</span>
          <button onClick={save} disabled={!dirty || busy} className={btn + ' ml-auto w-full bg-brand sm:w-auto'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save grades</button>
        </div>
        <div className="mt-4 space-y-2.5">
          {!rows ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />) : !rows.length ? <Empty text="No students in this class" /> : rows.map((r) => (
            <div key={r.student_id} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100 transition hover:bg-blue-50/40">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand">{r.full_name[0]}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold text-navy-800">{r.full_name}</div><div className="text-xs text-slate-500">{r.student_number}</div></div>
              <input type="number" min="0" max="20" step="0.25" placeholder="—" value={r.score ?? ''} onChange={(e) => setScore(r.student_id, e.target.value)}
                className={`${field} !w-24 text-center text-base font-bold ${tone(r.score)}`} />
              <span className="hidden text-sm text-slate-400 sm:block">/ 20</span>
            </div>))}
        </div>
      </Card>
    </>
  )
}
