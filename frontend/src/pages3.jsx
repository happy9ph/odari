import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, Save, Loader2, Trash2, Pencil, BookOpen, FileText, Video, Link2, StickyNote, ChevronLeft, ChevronRight,
  Pin, PinOff, ArrowLeft, CheckCheck, ClipboardCheck, ExternalLink, Users, Library, GraduationCap } from 'lucide-react'
import { api } from './api'
import { btn, field, Modal, Skeleton, useUI } from './ui'
import { Header, Card, Empty, Label, IconBtn, Badge } from './App'

const TONE = {
  blue: 'from-blue-700 to-sky-400', emerald: 'from-emerald-700 to-teal-400', amber: 'from-amber-600 to-yellow-400',
  rose: 'from-rose-700 to-pink-400', violet: 'from-violet-700 to-purple-400', sky: 'from-sky-700 to-cyan-400',
}
const SWATCH = { blue: 'bg-blue-600', emerald: 'bg-emerald-600', amber: 'bg-amber-500', rose: 'bg-rose-600', violet: 'bg-violet-600', sky: 'bg-sky-500' }
export const EVENT_TONE = {
  Exam: 'bg-red-100 text-red-700', Holiday: 'bg-emerald-100 text-emerald-700', Meeting: 'bg-amber-100 text-amber-700',
  Event: 'bg-blue-100 text-brand', Assignment: 'bg-violet-100 text-violet-700',
}
const KINDS = { Lesson: BookOpen, File: FileText, Video, Link: Link2, Note: StickyNote }
const SUB = ['Missing', 'Submitted', 'Late']
const SUB_TONE = { Missing: 'text-red-500', Submitted: 'text-emerald-600', Late: 'text-amber-600' }
const ATT = { Present: 'bg-emerald-500', Absent: 'bg-red-500', Late: 'bg-amber-500', Excused: 'bg-sky-500' }
const fmt = (d) => d.split('-').reverse().join('/')
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const ClassSelect = ({ classes, value, onChange, all }) => (
  <select className={field} value={value} onChange={onChange}>
    {all && <option value="">{all}</option>}
    {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}
  </select>
)
const Actions = ({ onClose, busy, label = 'Save' }) => (
  <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
    <button type="button" onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Cancel</button>
    <button disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}{label}</button>
  </div>
)
const Tabs = ({ list, value, onChange }) => (
  <div className="mb-5 flex gap-6 overflow-x-auto border-b border-slate-200">
    {list.map(([k, label]) => (
      <button key={k} onClick={() => onChange(k)} className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition ${value === k ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{label}</button>))}
  </div>
)

// generic "submit a JSON form" helper
function useSave(ui, done) {
  const [busy, setBusy] = useState(false)
  return [busy, async (path, method, body, okMsg) => {
    setBusy(true)
    try { await api(path, { method, body: JSON.stringify(body) }); ui.success(okMsg); done() } catch (x) { ui.error('Could not save', x.message); setBusy(false) }
  }]
}

/* ------------------------------------------------------------------ COURSES */
function CourseForm({ course, classes, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState(course ? { title: course.title, code: course.code, class_id: course.class_id, teacher: course.teacher, description: course.description, color: course.color }
    : { title: '', code: '', class_id: classes[0]?.id || '', teacher: '', description: '', color: 'blue' })
  const [busy, save] = useSave(ui, onSaved)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(course ? `/courses/${course.id}` : '/courses', course ? 'PUT' : 'POST', { ...f, class_id: Number(f.class_id) }, course ? 'Course updated' : 'Course created') }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
        <Label t="Title"><input className={field} placeholder="e.g. Mathematics - 6e A" value={f.title} onChange={set('title')} required /></Label>
        <Label t="Code"><input className={field} placeholder="MAT-6A" value={f.code} onChange={set('code')} required /></Label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label t="Class"><ClassSelect classes={classes} value={f.class_id} onChange={set('class_id')} /></Label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Teacher</span><input className={field} placeholder="e.g. Prof. Kalala" value={f.teacher} onChange={set('teacher')} /></label>
      </div>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Description</span><textarea rows={3} className={field} value={f.description} onChange={set('description')} /></label>
      <div className="flex items-center gap-2.5"><span className="text-sm font-medium text-slate-600">Colour</span>
        {Object.keys(SWATCH).map((c) => <button type="button" key={c} aria-label={c} onClick={() => setF({ ...f, color: c })} className={`h-7 w-7 rounded-full ${SWATCH[c]} ${f.color === c ? 'ring-4 ring-brand/30' : ''}`} />)}</div>
      <Actions onClose={onClose} busy={busy} />
    </form>
  )
}

export function Courses() {
  const ui = useUI(), nav = useNavigate()
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [cls, setCls] = useState('')
  const [modal, setModal] = useState(false)
  const load = () => api('/courses' + (cls ? `?class_id=${cls}` : '')).then(setRows).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { api('/classes').then(setClasses) }, [])
  useEffect(() => { setRows(null); load() }, [cls])
  return (
    <>
      <Header title="Courses" sub="Course pages with lessons, resources and assignments for every class." />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <button onClick={() => setModal(true)} className={btn + ' bg-brand'}><Plus size={18} />New course</button>
        <div className="sm:ml-auto sm:w-64"><ClassSelect classes={classes} value={cls} onChange={(e) => setCls(e.target.value)} all="All classes" /></div>
      </div>
      {!rows ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 !rounded-2xl" />)}</div>
        : !rows.length ? <Card><Empty text="No courses yet. Create your first course." /></Card> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((c) => (
              <button key={c.id} onClick={() => nav(`/courses/${c.id}`)} className="pop group overflow-hidden rounded-2xl bg-white text-left shadow-card ring-1 ring-slate-200/70 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10">
                <div className={`pattern bg-gradient-to-br ${TONE[c.color] || TONE.blue} p-5 text-white`}>
                  <div className="flex items-center justify-between"><span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wide">{c.code}</span><span className="grid h-9 w-9 place-items-center rounded-lg bg-white/20"><Library size={18} /></span></div>
                  <div className="mt-7 text-lg font-extrabold leading-snug">{c.title}</div>
                  <div className="mt-0.5 text-xs text-white/80">{c.class_name}</div></div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-sm text-slate-500"><GraduationCap size={16} className="shrink-0 text-slate-400" /><span className="truncate">{c.teacher || 'No teacher assigned'}</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
                    {[[Users, c.students, 'Students'], [BookOpen, c.items, 'Resources'], [ClipboardCheck, c.assignments, 'Assignments']].map(([I, n, l]) => (
                      <div key={l}><I size={15} className="mx-auto mb-1 text-slate-400" /><div className="font-display text-lg font-extrabold leading-none text-navy-800">{n}</div><div className="mt-1 text-[11px] text-slate-500">{l}</div></div>))}
                  </div>
                </div>
              </button>))}
          </div>)}
      {modal && <Modal title="New course" onClose={() => setModal(false)}><CourseForm classes={classes} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} /></Modal>}
    </>
  )
}

function ItemForm({ courseId, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState({ kind: 'Lesson', title: '', body: '', url: '' })
  const [busy, save] = useSave(ui, onSaved)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(`/courses/${courseId}/items`, 'POST', f, 'Content added') }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <Label t="Type"><select className={field} value={f.kind} onChange={set('kind')}>{Object.keys(KINDS).map((k) => <option key={k}>{k}</option>)}</select></Label>
        <Label t="Title"><input className={field} value={f.title} onChange={set('title')} required autoFocus /></Label>
      </div>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Text / instructions</span><textarea rows={4} className={field} value={f.body} onChange={set('body')} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Link (optional)</span><input type="url" className={field} placeholder="https://..." value={f.url} onChange={set('url')} /></label>
      <Actions onClose={onClose} busy={busy} />
    </form>
  )
}

function AssignmentForm({ courseId, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState({ title: '', description: '', due_date: todayStr(), max_score: 20 })
  const [busy, save] = useSave(ui, onSaved)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(`/courses/${courseId}/assignments`, 'POST', { ...f, max_score: Number(f.max_score) }, 'Assignment created') }} className="space-y-4">
      <Label t="Title"><input className={field} value={f.title} onChange={set('title')} required autoFocus /></Label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Instructions</span><textarea rows={3} className={field} value={f.description} onChange={set('description')} /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label t="Due date"><input type="date" className={field} value={f.due_date} onChange={set('due_date')} required /></Label>
        <Label t="Max score"><input type="number" min="1" step="0.5" className={field} value={f.max_score} onChange={set('max_score')} required /></Label>
      </div>
      <Actions onClose={onClose} busy={busy} />
    </form>
  )
}

function Marking({ a, onClose, onSaved }) {
  const ui = useUI()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api(`/assignments/${a.id}/submissions`).then((r) => setRows(r.rows)).catch((e) => ui.error('Loading failed', e.message)) }, [])
  const upd = (id, patch) => setRows((r) => r.map((x) => (x.student_id === id ? { ...x, ...patch } : x)))
  const save = async () => {
    setBusy(true)
    try {
      await api(`/assignments/${a.id}/submissions`, { method: 'PUT', body: JSON.stringify(rows.map((r) => ({
        student_id: r.student_id, status: r.status, score: r.score === '' || r.score == null ? null : Number(r.score), feedback: r.feedback || '' }))) })
      ui.success('Marks saved', a.title); onSaved()
    } catch (x) { ui.error('Could not save marks', x.message); setBusy(false) }
  }
  return (
    <Modal title={`${a.title} - marking`} onClose={onClose} wide>
      <p className="-mt-3 mb-4 text-sm text-slate-500">Due {fmt(a.due_date)} · scored out of {a.max_score}</p>
      <div className="space-y-2.5">
        {!rows ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />) : !rows.length ? <Empty text="No students in this class" /> : rows.map((r) => (
          <div key={r.student_id} className="flex flex-wrap items-center gap-2.5 rounded-2xl p-3 ring-1 ring-slate-100">
            <div className="min-w-0 basis-full sm:basis-48"><div className="truncate font-semibold text-navy-800">{r.full_name}</div><div className="text-xs text-slate-500">{r.student_number}</div></div>
            <select className={`${field} !w-32 font-semibold ${SUB_TONE[r.status]}`} value={r.status} onChange={(e) => upd(r.student_id, { status: e.target.value })}>{SUB.map((s) => <option key={s}>{s}</option>)}</select>
            <input type="number" min="0" max={a.max_score} step="0.25" placeholder="Score" value={r.score ?? ''} className={`${field} !w-24 text-center font-bold`}
              onChange={(e) => upd(r.student_id, { score: e.target.value, status: r.status === 'Missing' && e.target.value !== '' ? 'Submitted' : r.status })} />
            <input className={field + ' min-w-0 flex-1 basis-40'} placeholder="Feedback (optional)" value={r.feedback || ''} onChange={(e) => upd(r.student_id, { feedback: e.target.value })} />
          </div>))}
      </div>
      <div className="mt-5 flex justify-end"><button onClick={save} disabled={!rows || busy} className={btn + ' w-full bg-brand sm:w-auto'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save marks</button></div>
    </Modal>
  )
}

export function CourseDetail() {
  const { id } = useParams()
  const ui = useUI(), nav = useNavigate()
  const [c, setC] = useState(null)
  const [classes, setClasses] = useState([])
  const [tab, setTab] = useState('content')
  const [modal, setModal] = useState(null)
  const load = () => api(`/courses/${id}`).then(setC).catch((e) => { ui.error('Course not found', e.message); nav('/courses') })
  useEffect(() => { load(); api('/classes').then(setClasses) }, [id])
  const close = () => setModal(null)
  const after = () => { close(); load() }
  const remove = async (path, title, msg) => {
    if (!(await ui.confirm({ title, message: msg, confirmText: 'Delete' }))) return
    try { await api(path, { method: 'DELETE' }); ui.success('Deleted'); path.startsWith('/courses') ? nav('/courses') : load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  if (!c) return <><Header title="Course" /><Skeleton className="h-64 !rounded-2xl" /></>
  return (
    <>
      <button onClick={() => nav('/courses')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={16} />All courses</button>
      <div className={`pattern pop mb-6 flex flex-wrap items-start gap-4 overflow-hidden rounded-2xl bg-gradient-to-br ${TONE[c.color] || TONE.blue} p-6 text-white shadow-card sm:p-8`}>
        <div className="min-w-0 flex-1">
          <div className="inline-flex rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wide">{c.code} · {c.class_name}</div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-sm opacity-90">{c.description || 'No description.'}</p>
          <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"><GraduationCap size={16} />{c.teacher || 'No teacher assigned'}</p></div>
        <div className="flex gap-2">
          <IconBtn c="bg-white/20" Icon={Pencil} label="Edit course" onClick={() => setModal({ t: 'edit' })} />
          <IconBtn c="bg-red-500" Icon={Trash2} label="Delete course" onClick={() => remove(`/courses/${c.id}`, `Delete ${c.title}?`, 'Its content, assignments and marks will be permanently removed.')} /></div>
      </div>
      <Tabs value={tab} onChange={setTab} list={[['content', `Content (${c.content.length})`], ['assign', `Assignments (${c.assignment_list.length})`], ['people', `Participants (${c.participants.length})`]]} />

      {tab === 'content' && (
        <Card>
          <button onClick={() => setModal({ t: 'item' })} className={btn + ' mb-4 bg-brand'}><Plus size={18} />Add content</button>
          {!c.content.length ? <Empty text="No content yet. Add a lesson, file or video." /> : (
            <div className="space-y-3">{c.content.map((i) => {
              const Icon = KINDS[i.kind] || BookOpen
              return (
                <div key={i.id} className="flex items-start gap-3.5 rounded-2xl p-4 ring-1 ring-slate-100">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy-800">{i.title}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{i.kind}</span></div>
                    {i.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{i.body}</p>}
                    {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 break-all text-sm font-semibold text-brand hover:underline"><ExternalLink size={14} />{i.url}</a>}</div>
                  <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => remove(`/items/${i.id}`, 'Delete this content?', i.title)} />
                </div>)
            })}</div>)}
        </Card>)}

      {tab === 'assign' && (
        <Card>
          <button onClick={() => setModal({ t: 'asg' })} className={btn + ' mb-4 bg-brand'}><Plus size={18} />New assignment</button>
          {!c.assignment_list.length ? <Empty text="No assignments yet." /> : (
            <div className="space-y-3">{c.assignment_list.map((a) => (
              <div key={a.id} className="rounded-2xl p-4 ring-1 ring-slate-100">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><ClipboardCheck size={20} /></span>
                  <div className="min-w-0 flex-1"><div className="font-bold text-navy-800">{a.title}</div>
                    <div className="text-xs text-slate-500">Due {fmt(a.due_date)} · /{a.max_score} {a.overdue && <span className="font-semibold text-red-500">· closed</span>}</div></div>
                  <button onClick={() => setModal({ t: 'mark', a })} className={btn + ' bg-emerald-600'}>Mark & review</button>
                  <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => remove(`/assignments/${a.id}`, 'Delete this assignment?', `${a.title} and all marks will be removed.`)} /></div>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><i className="block h-full rounded-full bg-brand" style={{ width: `${a.total ? (a.submitted / a.total) * 100 : 0}%` }} /></div>
                  <span>{a.submitted}/{a.total} submitted · {a.graded} graded</span></div>
              </div>))}</div>)}
        </Card>)}

      {tab === 'people' && (
        <Card>
          {!c.participants.length ? <Empty text="No students in this class yet." /> : (
            <div className="grid gap-2.5 sm:grid-cols-2">{c.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand">{p.full_name[0]}</span>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold text-navy-800">{p.full_name}</div><div className="text-xs text-slate-500">{p.student_number}</div></div><Badge s={p.status} /></div>))}</div>)}
        </Card>)}

      {modal?.t === 'edit' && <Modal title="Edit course" onClose={close}><CourseForm course={c} classes={classes} onClose={close} onSaved={after} /></Modal>}
      {modal?.t === 'item' && <Modal title="Add content" onClose={close}><ItemForm courseId={c.id} onClose={close} onSaved={after} /></Modal>}
      {modal?.t === 'asg' && <Modal title="New assignment" onClose={close}><AssignmentForm courseId={c.id} onClose={close} onSaved={after} /></Modal>}
      {modal?.t === 'mark' && <Marking a={modal.a} onClose={close} onSaved={after} />}
    </>
  )
}

/* ------------------------------------------------------------------ ATTENDANCE */
export function Attendance() {
  const ui = useUI()
  const [classes, setClasses] = useState([])
  const [cid, setCid] = useState('')
  const [day, setDay] = useState(todayStr())
  const [tab, setTab] = useState('daily')
  const [rows, setRows] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api('/classes').then((c) => { setClasses(c); setCid(c[0]?.id || '') }) }, [])
  useEffect(() => {
    if (!cid) return
    setRows(null); setDirty(false)
    api(tab === 'daily' ? `/attendance?class_id=${cid}&day=${day}` : `/attendance/summary?class_id=${cid}`).then(setRows).catch((e) => ui.error('Loading failed', e.message))
  }, [cid, day, tab])
  const setStatus = (id, s) => { setDirty(true); setRows((r) => r.map((x) => (x.student_id === id ? { ...x, status: x.status === s ? null : s } : x))) }
  const allPresent = () => { setDirty(true); setRows((r) => r.map((x) => ({ ...x, status: 'Present' }))) }
  const save = async () => {
    setBusy(true)
    try {
      await api('/attendance', { method: 'PUT', body: JSON.stringify({ day, records: rows.map((r) => ({ student_id: r.student_id, status: r.status })) }) })
      ui.success('Attendance saved', fmt(day)); setDirty(false)
    } catch (x) { ui.error('Could not save', x.message) } finally { setBusy(false) }
  }
  const count = (s) => (rows || []).filter((r) => r.status === s).length
  return (
    <>
      <Header title="Attendance" sub="Take the daily register and follow attendance rates per class." />
      <Tabs value={tab} onChange={setTab} list={[['daily', 'Daily register'], ['summary', 'Summary']]} />
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <ClassSelect classes={classes} value={cid} onChange={(e) => setCid(e.target.value)} />
          {tab === 'daily' && <input type="date" max={todayStr()} className={field} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />}
        </div>
        {tab === 'daily' ? (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
              {Object.keys(ATT).map((s) => <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1"><i className={`h-2 w-2 rounded-full ${ATT[s]}`} />{s} {count(s)}</span>)}
              <button onClick={allPresent} disabled={!rows?.length} className={btn + ' ml-auto bg-emerald-600'}><CheckCheck size={16} />All present</button>
              <button onClick={save} disabled={!dirty || busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save</button>
            </div>
            <div className="mt-4 space-y-2.5">
              {!rows ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />) : !rows.length ? <Empty text="No students in this class" /> : rows.map((r) => (
                <div key={r.student_id} className="flex flex-wrap items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-50 text-sm font-bold text-brand">{r.full_name[0]}</span>
                  <div className="min-w-0 flex-1 basis-36"><div className="truncate font-semibold text-navy-800">{r.full_name}</div><div className="text-xs text-slate-500">{r.student_number}</div></div>
                  <div className="flex gap-1.5">{Object.keys(ATT).map((s) => (
                    <button key={s} onClick={() => setStatus(r.student_id, s)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${r.status === s ? ATT[s] + ' text-white shadow-sm' : 'text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'}`}>{s}</button>))}</div>
                </div>))}
            </div>
          </>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-2xl ring-1 ring-slate-100">
            {!rows ? <Skeleton className="h-40" /> : !rows.length ? <Empty text="No students in this class" /> : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Student', 'Present', 'Late', 'Absent', 'Excused', 'Rate'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{rows.map((r) => (
                  <tr key={r.student_id}><td className="px-4 py-3 font-semibold text-navy-800">{r.full_name}</td>
                    <td className="px-4 py-3">{r.present}</td><td className="px-4 py-3">{r.late}</td><td className="px-4 py-3">{r.absent}</td><td className="px-4 py-3">{r.excused}</td>
                    <td className={`px-4 py-3 font-extrabold ${r.rate == null ? 'text-slate-400' : r.rate < 80 ? 'text-red-500' : r.rate < 90 ? 'text-amber-600' : 'text-emerald-600'}`}>{r.rate == null ? '—' : `${r.rate}%`}</td></tr>))}</tbody>
              </table>)}
          </div>)}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ ANNOUNCEMENTS */
function AnnouncementForm({ classes, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState({ title: '', body: '', class_id: '', pinned: false })
  const [busy, save] = useSave(ui, onSaved)
  return (
    <form onSubmit={(e) => { e.preventDefault(); save('/announcements', 'POST', { ...f, class_id: f.class_id ? Number(f.class_id) : null }, 'Announcement published') }} className="space-y-4">
      <Label t="Title"><input className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} required autoFocus /></Label>
      <Label t="Message"><textarea rows={5} className={field} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} required /></Label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Audience</span><ClassSelect classes={classes} value={f.class_id} onChange={(e) => setF({ ...f, class_id: e.target.value })} all="All classes" /></label>
      <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} />Pin to the top</label>
      <Actions onClose={onClose} busy={busy} label="Publish" />
    </form>
  )
}

export function Announcements() {
  const ui = useUI()
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [modal, setModal] = useState(false)
  const load = () => api('/announcements').then(setRows).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { load(); api('/classes').then(setClasses) }, [])
  const pin = (a) => api(`/announcements/${a.id}/pin`, { method: 'PUT' }).then(load).catch((x) => ui.error('Failed', x.message))
  const del = async (a) => {
    if (!(await ui.confirm({ title: 'Delete this announcement?', message: a.title, confirmText: 'Delete' }))) return
    try { await api(`/announcements/${a.id}`, { method: 'DELETE' }); ui.success('Announcement deleted'); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  return (
    <>
      <Header title="Announcements" sub="Publish news for the whole school or for a single class." />
      <button onClick={() => setModal(true)} className={btn + ' mb-5 bg-brand'}><Plus size={18} />New announcement</button>
      {!rows ? <div className="space-y-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 !rounded-2xl" />)}</div>
        : !rows.length ? <Card><Empty text="No announcements yet." /></Card> : (
          <div className="space-y-4">{rows.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">{a.pinned && <Pin size={15} className="text-amber-500" />}<h3 className="text-lg font-bold text-navy-800">{a.title}</h3>
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand">{a.class_name}</span></div>
                  <div className="mt-0.5 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString()}</div>
                  <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{a.body}</p></div>
                <div className="flex gap-2"><IconBtn c="bg-amber-400" Icon={a.pinned ? PinOff : Pin} label={a.pinned ? 'Unpin' : 'Pin'} onClick={() => pin(a)} />
                  <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(a)} /></div>
              </div>
            </Card>))}</div>)}
      {modal && <Modal title="New announcement" onClose={() => setModal(false)}><AnnouncementForm classes={classes} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} /></Modal>}
    </>
  )
}

/* ------------------------------------------------------------------ CALENDAR */
function EventForm({ day, classes, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState({ title: '', day, kind: 'Event', class_id: '' })
  const [busy, save] = useSave(ui, onSaved)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form onSubmit={(e) => { e.preventDefault(); save('/events', 'POST', { ...f, class_id: f.class_id ? Number(f.class_id) : null }, 'Event added') }} className="space-y-4">
      <Label t="Title"><input className={field} value={f.title} onChange={set('title')} required autoFocus /></Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label t="Date"><input type="date" className={field} value={f.day} onChange={set('day')} required /></Label>
        <Label t="Type"><select className={field} value={f.kind} onChange={set('kind')}>{['Exam', 'Holiday', 'Meeting', 'Event'].map((k) => <option key={k}>{k}</option>)}</select></Label>
      </div>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Class</span><ClassSelect classes={classes} value={f.class_id} onChange={set('class_id')} all="All classes" /></label>
      <Actions onClose={onClose} busy={busy} />
    </form>
  )
}

export function CalendarPage() {
  const ui = useUI()
  const [ym, setYm] = useState(todayStr().slice(0, 7))
  const [ev, setEv] = useState(null)
  const [classes, setClasses] = useState([])
  const [modal, setModal] = useState(null)
  const [y, m] = ym.split('-').map(Number)
  const load = () => api(`/calendar?month=${ym}`).then(setEv).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { api('/classes').then(setClasses) }, [])
  useEffect(() => { setEv(null); load() }, [ym])
  const shift = (k) => { const d = new Date(y, m - 1 + k, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const pad = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const total = new Date(y, m, 0).getDate()
  const cells = [...Array(pad).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)]
  const key = (n) => `${ym}-${String(n).padStart(2, '0')}`
  const today = todayStr()
  const del = async (e) => {
    if (!(await ui.confirm({ title: 'Delete this event?', message: e.title, confirmText: 'Delete' }))) return
    try { await api(`/events/${e.id}`, { method: 'DELETE' }); ui.success('Event deleted'); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  return (
    <>
      <Header title="Calendar" sub="Exams, holidays, meetings and assignment deadlines." />
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <h2 className="min-w-40 text-center text-lg font-bold text-navy-800">{new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button onClick={() => shift(1)} aria-label="Next month" className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-slate-200 hover:bg-slate-50"><ChevronRight size={16} /></button>
          <button onClick={() => setModal({ day: today })} className={btn + ' ml-auto bg-brand'}><Plus size={18} />Add event</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((n, i) => {
            if (!n) return <div key={i} />
            const list = (ev || []).filter((e) => e.day === key(n))
            return (
              <button key={i} onClick={() => setModal({ day: key(n) })} className={`min-h-16 rounded-xl p-1.5 text-left ring-1 transition hover:bg-blue-50/40 sm:min-h-24 ${key(n) === today ? 'ring-2 ring-brand' : 'ring-slate-100'}`}>
                <div className={`text-xs font-bold ${key(n) === today ? 'text-brand' : 'text-slate-500'}`}>{n}</div>
                <div className="mt-1 hidden space-y-0.5 sm:block">{list.slice(0, 2).map((e, j) => <div key={j} className={`truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ${EVENT_TONE[e.kind]}`}>{e.title}</div>)}{list.length > 2 && <div className="text-[10px] text-slate-400">+{list.length - 2} more</div>}</div>
                <div className="mt-1 flex gap-0.5 sm:hidden">{list.slice(0, 3).map((e, j) => <i key={j} className={`h-1.5 w-1.5 rounded-full ${EVENT_TONE[e.kind].split(' ')[0]}`} />)}</div>
              </button>)
          })}
        </div>
      </Card>
      <Card title="This month" className="mt-5">
        {!ev ? <Skeleton className="h-24" /> : !ev.length ? <Empty text="Nothing scheduled this month." /> : (
          <div className="space-y-2.5">{ev.map((e, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
              <span className="w-24 shrink-0 text-sm font-semibold text-slate-500">{fmt(e.day)}</span>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold text-navy-800">{e.title}</div><div className="text-xs text-slate-500">{e.class_name}</div></div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EVENT_TONE[e.kind]}`}>{e.kind}</span>
              {e.deletable && <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(e)} />}</div>))}</div>)}
      </Card>
      {modal && <Modal title="Add event" onClose={() => setModal(null)}><EventForm day={modal.day} classes={classes} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} /></Modal>}
    </>
  )
}
