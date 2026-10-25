import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, FileText, Video, Link2, StickyNote, ClipboardCheck, HelpCircle, Library, Award, UserCheck, ExternalLink,
  Paperclip, Download, Check, X, Loader2, Send, GraduationCap, Play, Clock } from 'lucide-react'
import { api, download } from './api'
import { btn, field, Modal, Skeleton, useUI } from './ui'
import { Header, Card, Empty, Stat } from './App'
import { TONE, EVENT_TONE, STATE_TONE, Pill, Tabs, fmt, fmtDateTime } from './shared'

const KINDS = { Lesson: BookOpen, File: FileText, Video, Link: Link2, Note: StickyNote }
const fmtScore = (v) => (v == null ? '-' : `${Math.round(v * 100) / 100}`)

/* ------------------------------------------------------------------ DASHBOARD */
export function StudentDashboard() {
  const ui = useUI()
  const nav = useNavigate()
  const [d, setD] = useState(null)
  useEffect(() => { api('/me/overview').then(setD).catch((e) => ui.error('Could not load your dashboard', e.message)) }, [])
  if (!d) return <><Header title="My dashboard" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 !rounded-2xl" />)}</div></>
  const s = d.student
  return (
    <>
      <Header title="My dashboard" sub={`Welcome back, ${s.full_name.split(' ')[0]}.`} />
      <div className="pattern pop mb-6 flex flex-wrap items-center gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-brand p-6 text-white shadow-card sm:p-7">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><GraduationCap size={30} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold tracking-tight sm:text-2xl">{s.full_name}</div>
          <div className="mt-1 text-sm text-blue-100/90">{s.student_number} · {s.class_name}</div>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-white/15"><div className="text-[11px] uppercase tracking-wider text-blue-200/80">Attendance (30 days)</div><div className="text-xl font-extrabold">{d.attendance_rate == null ? '-' : `${d.attendance_rate}%`}</div></div>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        <Stat label="Courses" value={d.courses} Icon={Library} tone="bg-violet-50 text-violet-600" />
        <Stat label={d.overdue ? `To do (${d.overdue} overdue)` : 'Assignments to do'} value={d.todo} Icon={ClipboardCheck} tone={d.overdue ? 'bg-red-100 text-red-700' : 'bg-sky-50 text-sky-600'} />
        <Stat label="Quizzes available" value={d.quizzes_open} Icon={HelpCircle} tone="bg-amber-100 text-amber-700" />
        <Stat label="Average (/20)" value={d.average ?? 0} Icon={Award} tone="bg-emerald-100 text-emerald-700" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Latest announcements">
          {!d.announcements.length ? <Empty text="No announcements yet" /> : (
            <div className="space-y-3">{d.announcements.map((a) => (
              <div key={a.id} className="rounded-xl p-3.5 ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-navy-800">{a.title}</span><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand">{a.class_name}</span></div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p></div>))}</div>)}
        </Card>
        <Card title="Upcoming deadlines">
          {!d.upcoming.length ? <Empty text="Nothing due soon" /> : (
            <div className="space-y-2.5">{d.upcoming.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-100">
                <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{fmt(e.day)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800">{e.title}</span>
                <Pill tone={EVENT_TONE[e.kind]}>{e.kind}</Pill></div>))}</div>)}
        </Card>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => nav('/assignments')} className={btn + ' bg-brand'}><ClipboardCheck size={17} />My assignments</button>
        <button onClick={() => nav('/quizzes')} className={btn + ' bg-sky-600'}><HelpCircle size={17} />My quizzes</button>
        <button onClick={() => nav('/grades')} className={btn + ' bg-emerald-600'}><Award size={17} />My grades</button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ ASSIGNMENTS */
export function SubmitModal({ a, onClose, onSaved }) {
  const ui = useUI()
  const [content, setContent] = useState(a.content || '')
  const [link, setLink] = useState(a.link || '')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    const fd = new FormData()
    fd.append('content', content); fd.append('link', link)
    if (file) fd.append('file', file)
    try { await api(`/me/assignments/${a.id}/submit`, { method: 'POST', body: fd }); ui.success('Work submitted', a.title); onSaved() }
    catch (x) { ui.error('Could not submit', x.message); setBusy(false) }
  }
  return (
    <Modal title={a.title} onClose={onClose}>
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span>{a.course_title}</span><span>·</span><span>Due {fmt(a.due_date)}</span><span>·</span><span>/{a.max_score}</span><Pill tone={STATE_TONE[a.state]}>{a.state}</Pill>
      </div>
      {a.description && <p className="mb-4 whitespace-pre-line rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600">{a.description}</p>}
      {a.locked ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-violet-50 p-4 text-violet-700 ring-1 ring-violet-100"><div className="text-xs font-semibold uppercase tracking-wider">Your score</div><div className="text-3xl font-extrabold">{fmtScore(a.score)} <span className="text-base font-semibold">/ {a.max_score}</span></div></div>
          {a.feedback && <div className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600"><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Teacher feedback</div>{a.feedback}</div>}
          <p className="text-xs text-slate-400">This assignment is graded and can no longer be changed.</p>
          <button onClick={onClose} className={btn + ' w-full !text-slate-600 bg-slate-100 shadow-none'}>Close</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {a.submitted_at && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Last submitted {fmtDateTime(a.submitted_at)}. Sending again replaces your previous work.</div>}
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Your answer</span><textarea rows={5} className={field} placeholder="Write your answer here" value={content} onChange={(e) => setContent(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Link (optional)</span><input type="url" className={field} placeholder="https://..." value={link} onChange={(e) => setLink(e.target.value)} /></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">File (optional, 10 MB max)</span>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.zip" onChange={(e) => setFile(e.target.files[0] || null)} className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand hover:file:bg-blue-100" />
            {a.file_name && !file && <span className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500"><Paperclip size={13} />Current file: {a.file_name}</span>}</label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Cancel</button>
            <button disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Submit work</button>
          </div>
        </form>)}
    </Modal>
  )
}

function AssignmentRow({ a, onOpen, showCourse }) {
  return (
    <button onClick={() => onOpen(a)} className="flex w-full flex-wrap items-center gap-3 rounded-xl p-4 text-left ring-1 ring-slate-100 transition hover:bg-slate-50/80">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><ClipboardCheck size={20} /></span>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-navy-800">{a.title}</div>
        <div className="text-xs text-slate-500">{showCourse && `${a.course_title} · `}Due {fmt(a.due_date)}{a.score != null && a.state === 'Graded' && ` · ${fmtScore(a.score)}/${a.max_score}`}</div>
      </div>
      <Pill tone={STATE_TONE[a.state]}>{a.state}</Pill>
    </button>
  )
}

export function MyAssignments() {
  const ui = useUI()
  const [rows, setRows] = useState(null)
  const [tab, setTab] = useState('todo')
  const [open, setOpen] = useState(null)
  const load = () => api('/me/assignments').then(setRows).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { load() }, [])
  const groups = { todo: (a) => ['To do', 'Overdue'].includes(a.state), done: (a) => ['Submitted', 'Late'].includes(a.state), graded: (a) => a.state === 'Graded', all: () => true }
  const count = (k) => (rows || []).filter(groups[k]).length
  const shown = (rows || []).filter(groups[tab])
  return (
    <>
      <Header title="My assignments" sub="Submit your work before the deadline and follow your marks." />
      <Tabs value={tab} onChange={setTab} list={[['todo', `To do (${count('todo')})`], ['done', `Submitted (${count('done')})`], ['graded', `Graded (${count('graded')})`], ['all', 'All']]} />
      <Card>
        {!rows ? <Skeleton className="h-40" /> : !shown.length ? <Empty text={tab === 'todo' ? 'You are all caught up.' : 'Nothing here yet.'} /> : (
          <div className="space-y-3">{shown.map((a) => <AssignmentRow key={a.id} a={a} showCourse onOpen={setOpen} />)}</div>)}
      </Card>
      {open && <SubmitModal a={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load() }} />}
    </>
  )
}

/* ------------------------------------------------------------------ COURSE VIEW */
export function StudentCourse() {
  const { id } = useParams()
  const ui = useUI(), nav = useNavigate()
  const [c, setC] = useState(null)
  const [tab, setTab] = useState('content')
  const [open, setOpen] = useState(null)
  const load = () => api(`/me/courses/${id}`).then(setC).catch((e) => { ui.error('Course not available', e.message); nav('/courses') })
  useEffect(() => { load() }, [id])
  if (!c) return <><Header title="Course" /><Skeleton className="h-64 !rounded-2xl" /></>
  return (
    <>
      <button onClick={() => nav('/courses')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={16} />All courses</button>
      <div className={`pattern pop mb-6 overflow-hidden rounded-2xl bg-gradient-to-br ${TONE[c.color] || TONE.blue} p-6 text-white shadow-card sm:p-8`}>
        <div className="inline-flex rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold tracking-wide">{c.code} · {c.class_name}</div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{c.title}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">{c.description || 'No description.'}</p>
        <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"><GraduationCap size={16} />{c.teacher || 'No teacher assigned'}</p>
      </div>
      <Tabs value={tab} onChange={setTab} list={[['content', `Content (${c.content.length})`], ['assign', `Assignments (${c.assignment_list.length})`], ['quiz', `Quizzes (${c.quiz_list.length})`]]} />
      {tab === 'content' && (
        <Card>{!c.content.length ? <Empty text="Your teacher has not added content yet." /> : (
          <div className="space-y-3">{c.content.map((i) => {
            const Icon = KINDS[i.kind] || BookOpen
            return (
              <div key={i.id} className="flex items-start gap-3.5 rounded-xl p-4 ring-1 ring-slate-100">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><Icon size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy-800">{i.title}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{i.kind}</span></div>
                  {i.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-500">{i.body}</p>}
                  {i.url && <a href={i.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 break-all text-sm font-semibold text-brand hover:underline"><ExternalLink size={14} />{i.url}</a>}
                </div>
              </div>)
          })}</div>)}</Card>)}
      {tab === 'assign' && (
        <Card>{!c.assignment_list.length ? <Empty text="No assignments in this course yet." /> : (
          <div className="space-y-3">{c.assignment_list.map((a) => <AssignmentRow key={a.id} a={a} onOpen={setOpen} />)}</div>)}</Card>)}
      {tab === 'quiz' && <Card><QuizList rows={c.quiz_list} /></Card>}
      {open && <SubmitModal a={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load() }} />}
    </>
  )
}

/* ------------------------------------------------------------------ QUIZZES */
function QuizList({ rows, showCourse }) {
  const nav = useNavigate()
  if (!rows.length) return <Empty text="No quizzes available yet." />
  return (
    <div className="space-y-3">{rows.map((q) => (
      <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-xl p-4 ring-1 ring-slate-100">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><HelpCircle size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-navy-800">{q.title}</div>
          <div className="text-xs text-slate-500">{showCourse && `${q.course_title} · `}{q.questions} question(s) · {q.total_points} pt · {q.attempts_used}/{q.max_attempts} attempt(s){q.due_date && ` · closes ${fmt(q.due_date)}`}{q.best != null && ` · best ${fmtScore(q.best)}/${q.total_points}`}</div>
        </div>
        {q.closed && !q.attempts_used ? <Pill tone="bg-slate-200 text-slate-600">Closed</Pill>
          : <button onClick={() => nav(`/quizzes/${q.id}`)} className={btn + (q.can_attempt ? ' bg-brand' : ' !text-slate-600 bg-slate-100 shadow-none')}>{q.can_attempt ? <><Play size={15} />{q.attempts_used ? 'Try again' : 'Start'}</> : 'Review'}</button>}
      </div>))}</div>
  )
}

export function MyQuizzes() {
  const ui = useUI()
  const [rows, setRows] = useState(null)
  useEffect(() => { api('/me/quizzes').then(setRows).catch((e) => ui.error('Loading failed', e.message)) }, [])
  return (
    <>
      <Header title="My quizzes" sub="Answer online and get your result instantly." />
      <Card>{!rows ? <Skeleton className="h-40" /> : <QuizList rows={rows} showCourse />}</Card>
    </>
  )
}

function Review({ items }) {
  return (
    <div className="space-y-4">{items.map((x, i) => {
      const ok = x.chosen_id === x.correct_id
      return (
        <div key={x.question_id} className={`rounded-xl p-4 ring-1 ${ok ? 'ring-emerald-200' : 'ring-red-200'}`}>
          <div className="mb-3 flex items-start gap-3">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}>{ok ? <Check size={15} /> : <X size={15} />}</span>
            <div className="min-w-0 flex-1 font-semibold text-navy-800">{i + 1}. {x.text}</div>
            <span className="shrink-0 text-sm font-bold text-slate-500">{x.earned}/{x.points}</span>
          </div>
          <div className="space-y-1.5 pl-10">{x.options.map((o) => (
            <div key={o.id} className={`rounded-lg px-3 py-2 text-sm ${o.id === x.correct_id ? 'bg-emerald-50 font-semibold text-emerald-700' : o.id === x.chosen_id ? 'bg-red-50 text-red-700' : 'text-slate-500'}`}>
              {o.text}{o.id === x.correct_id && '  (correct answer)'}{o.id === x.chosen_id && o.id !== x.correct_id && '  (your answer)'}</div>))}
            {x.chosen_id == null && <div className="text-xs font-semibold text-red-500">No answer given</div>}
          </div>
        </div>)
    })}</div>
  )
}

export function QuizTake() {
  const { id } = useParams()
  const ui = useUI(), nav = useNavigate()
  const [q, setQ] = useState(null)
  const [mode, setMode] = useState('intro')
  const [ans, setAns] = useState({})
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const load = () => api(`/me/quizzes/${id}`).then(setQ).catch((e) => { ui.error('Quiz not available', e.message); nav('/quizzes') })
  useEffect(() => { load() }, [id])
  if (!q) return <><Header title="Quiz" /><Skeleton className="h-64 !rounded-2xl" /></>

  const answered = Object.keys(ans).length
  const submit = async () => {
    if (answered < q.question_list.length && !(await ui.confirm({ title: 'Submit with unanswered questions?', message: `${q.question_list.length - answered} question(s) have no answer and will score zero.`, confirmText: 'Submit' }))) return
    setBusy(true)
    try { setRes(await api(`/me/quizzes/${id}/attempt`, { method: 'POST', body: JSON.stringify({ answers: ans }) })); setMode('result'); setAns({}); load() }
    catch (x) { ui.error('Could not submit', x.message) } finally { setBusy(false) }
  }
  const last = q.attempts[q.attempts.length - 1]
  const result = res ? { score: res.score, max: res.max_score, review: res.review } : last ? { score: last.score, max: last.max_score, review: q.last_review } : null
  const view = mode === 'taking' ? 'taking' : mode === 'result' || (!q.can_attempt && result) ? 'result' : 'intro'
  const pct = result && result.max ? Math.round((result.score / result.max) * 100) : 0

  return (
    <>
      <button onClick={() => nav('/quizzes')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><ArrowLeft size={16} />All quizzes</button>
      <Header title={q.title} sub={q.course_title} />

      {view === 'intro' && (
        <Card>
          {q.description && <p className="mb-4 whitespace-pre-line text-sm text-slate-600">{q.description}</p>}
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            {[['Questions', q.questions], ['Total points', q.total_points], ['Attempts left', Math.max(q.max_attempts - q.attempts_used, 0)]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="text-xs font-medium text-slate-500">{l}</div><div className="mt-1 text-2xl font-extrabold text-navy-800">{v}</div></div>))}
          </div>
          {q.due_date && <p className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Clock size={15} />Closes on {fmt(q.due_date)}</p>}
          {q.closed ? <Empty text="This quiz is closed." /> : <button onClick={() => { setAns({}); setMode('taking') }} className={btn + ' bg-brand'}><Play size={16} />Start quiz</button>}
        </Card>)}

      {view === 'taking' && (
        <div className="space-y-4">
          {q.question_list.map((x, i) => (
            <Card key={x.id}>
              <div className="mb-3 flex items-start justify-between gap-3"><div className="font-semibold text-navy-800">{i + 1}. {x.text}</div><span className="shrink-0 text-xs font-semibold text-slate-400">{x.points} pt</span></div>
              <div className="space-y-2">{x.options.map((o) => (
                <label key={o.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-sm ring-1 transition ${ans[x.id] === o.id ? 'bg-blue-50 font-semibold text-brand ring-brand' : 'ring-slate-200 hover:bg-slate-50'}`}>
                  <input type="radio" name={`q${x.id}`} checked={ans[x.id] === o.id} onChange={() => setAns({ ...ans, [x.id]: o.id })} className="h-4 w-4 accent-blue-600" />{o.text}</label>))}</div>
            </Card>))}
          <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200/70">
            <span className="text-sm font-semibold text-slate-500">{answered} / {q.question_list.length} answered</span>
            <button onClick={submit} disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}Submit quiz</button>
          </div>
        </div>)}

      {view === 'result' && result && (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-wrap items-center gap-5">
              <div className={`grid h-24 w-24 place-items-center rounded-full text-2xl font-extrabold ring-8 ${pct >= 50 ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : 'bg-red-50 text-red-600 ring-red-100'}`}>{pct}%</div>
              <div className="min-w-0 flex-1"><div className="text-sm font-medium text-slate-500">Your score</div><div className="text-3xl font-extrabold text-navy-800">{fmtScore(result.score)} <span className="text-lg font-semibold text-slate-400">/ {result.max}</span></div>
                <div className="mt-1 text-xs text-slate-500">{q.attempts_used}/{q.max_attempts} attempt(s) used</div></div>
              {q.can_attempt && <button onClick={() => { setRes(null); setAns({}); setMode('taking') }} className={btn + ' bg-brand'}><Play size={16} />Try again</button>}
            </div>
          </Card>
          <Card title="Correction">{result.review ? <Review items={result.review} /> : <Empty text="No review available." />}</Card>
        </div>)}
    </>
  )
}

/* ------------------------------------------------------------------ GRADES */
export function MyGrades() {
  const ui = useUI()
  const [d, setD] = useState(null)
  useEffect(() => { api('/me/grades').then(setD).catch((e) => ui.error('Loading failed', e.message)) }, [])
  const tone = (v) => (v == null ? 'text-slate-400' : v < 10 ? 'text-red-500' : v < 14 ? 'text-amber-600' : 'text-emerald-600')
  return (
    <>
      <Header title="My grades" sub="Your scores out of 20, by subject and term." />
      <Card>
        {!d ? <Skeleton className="h-64" /> : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-4">
              <div className="rounded-xl bg-emerald-50 px-5 py-3 ring-1 ring-emerald-100"><div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Overall average</div><div className="text-3xl font-extrabold text-emerald-700">{d.overall == null ? '-' : d.overall} <span className="text-base font-semibold">/ 20</span></div></div>
              <button onClick={() => download('/me/report-card.pdf', 'report-card.pdf').catch((x) => ui.error('Download failed', x.message))} className={btn + ' ml-auto bg-brand'}><Download size={17} />Download report card</button>
            </div>
            <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3.5 font-semibold">Subject</th>{d.terms.map((t) => <th key={t} className="px-4 py-3.5 text-center font-semibold">{t}</th>)}<th className="px-4 py-3.5 text-center font-semibold">Average</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{d.subjects.map((s) => (
                  <tr key={s.subject}><td className="px-4 py-3 font-semibold text-navy-800">{s.subject}</td>
                    {d.terms.map((t) => <td key={t} className={`px-4 py-3 text-center font-semibold ${tone(s.scores[t])}`}>{fmtScore(s.scores[t])}</td>)}
                    <td className={`px-4 py-3 text-center font-extrabold ${tone(s.average)}`}>{fmtScore(s.average)}</td></tr>))}</tbody>
              </table>
            </div>
          </>)}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ ATTENDANCE */
const ATT_BG = { Present: 'bg-emerald-500', Absent: 'bg-red-500', Late: 'bg-amber-500', Excused: 'bg-sky-500' }

export function MyAttendance() {
  const ui = useUI()
  const [d, setD] = useState(null)
  useEffect(() => { api('/me/attendance').then(setD).catch((e) => ui.error('Loading failed', e.message)) }, [])
  return (
    <>
      <Header title="My attendance" sub="Your presence record for the school year." />
      {!d ? <Skeleton className="h-64 !rounded-2xl" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 sm:gap-5">
            <Stat label="Attendance rate (%)" value={d.summary.rate ?? 0} Icon={UserCheck} tone="bg-emerald-100 text-emerald-700" />
            {[['Present', d.summary.present], ['Late', d.summary.late], ['Absent', d.summary.absent], ['Excused', d.summary.excused]].map(([l, v]) => (
              <div key={l} className="pop flex items-center gap-3 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70"><i className={`h-3 w-3 rounded-full ${ATT_BG[l]}`} /><div><div className="text-sm font-medium text-slate-500">{l}</div><div className="text-2xl font-extrabold text-navy-800">{v}</div></div></div>))}
          </div>
          <Card title="Last 30 school days" className="mt-5">
            {!d.recent.length ? <Empty text="No attendance recorded yet." /> : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{d.recent.map((r) => (
                <div key={r.day} className="flex items-center justify-between rounded-xl p-3 ring-1 ring-slate-100"><span className="text-sm font-semibold text-slate-600">{fmt(r.day)}</span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-navy-800"><i className={`h-2.5 w-2.5 rounded-full ${ATT_BG[r.status]}`} />{r.status}</span></div>))}</div>)}
          </Card>
        </>)}
    </>
  )
}
