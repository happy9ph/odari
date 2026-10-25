import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Pencil, KeyRound, Search, Copy, Check, ShieldAlert, Loader2, Save, X, HelpCircle, BarChart3, Eye, EyeOff } from 'lucide-react'
import { api } from './api'
import { btn, field, Modal, Skeleton, useUI } from './ui'
import { Header, Card, Empty, Label, IconBtn } from './App'
import { Actions, Pill, Tabs, fmt, todayStr, useSave } from './shared'

/* ------------------------------------------------------------------ USERS (admin) */
function Credentials({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = `Username: ${data.username}\nPassword: ${data.temporary_password}`
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard unavailable */ } }
  return (
    <Modal title="Account credentials" onClose={onClose} small>
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Username</div>
          <div className="mt-0.5 font-mono text-base font-bold text-navy-800">{data.username}</div>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Temporary password</div>
          <div className="mt-0.5 font-mono text-base font-bold text-navy-800">{data.temporary_password}</div>
        </div>
        <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" /><span>Write this down now: the password is shown only once. The user must choose a new password at first sign-in.</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={copy} className={btn + ' bg-brand'}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}</button>
          <button onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Done</button>
        </div>
      </div>
    </Modal>
  )
}

function UserForm({ role, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState({ full_name: '', username: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try { onSaved(await api('/users', { method: 'POST', body: JSON.stringify({ ...f, role, username: f.username.trim() || null }) })) }
    catch (x) { ui.error('Could not create the account', x.message); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Label t="Full name"><input className={field} placeholder="e.g. Prof. Mwansa" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required autoFocus /></Label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Username{role === 'admin' ? ' *' : ' (optional)'}</span>
        <input className={field} placeholder={role === 'teacher' ? 'Leave empty to generate (t.mwansa)' : 'e.g. registrar'} value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required={role === 'admin'} /></label>
      <p className="text-xs text-slate-500">A random temporary password is generated. The user must change it at first sign-in.</p>
      <Actions onClose={onClose} busy={busy} label="Create account" />
    </form>
  )
}

export function UsersPage() {
  const ui = useUI()
  const [tab, setTab] = useState('teacher')
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const load = () => api(`/users?role=${tab}`).then(setRows).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { setRows(null); load() }, [tab])
  const shown = useMemo(() => (rows || []).filter((u) => `${u.full_name} ${u.username}`.toLowerCase().includes(q.toLowerCase())), [rows, q])

  const reset = async (u) => {
    const extra = u.role === 'student' ? 'The password goes back to 12345.' : 'A new temporary password is generated.'
    if (!(await ui.confirm({ title: `Reset password for ${u.full_name}?`, message: `${extra} They must change it at next sign-in.`, confirmText: 'Reset' }))) return
    try { setModal({ t: 'cred', data: await api(`/users/${u.id}/reset-password`, { method: 'POST' }) }); load() } catch (x) { ui.error('Could not reset the password', x.message) }
  }
  const del = async (u) => {
    if (!(await ui.confirm({ title: `Delete ${u.full_name}?`, message: 'This account will be removed. Their courses stay but lose their teacher.', confirmText: 'Delete' }))) return
    try { await api(`/users/${u.id}`, { method: 'DELETE' }); ui.success('Account deleted'); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  const rename = async (u) => { setModal({ t: 'edit', u }) }

  return (
    <>
      <Header title="Users" sub="Manage teacher, administrator and student accounts." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setQ('') }} list={[['teacher', 'Teachers'], ['admin', 'Administrators'], ['student', 'Students']]} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" /><input className={field + ' pl-10'} placeholder="Search name or username" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {tab !== 'student' && <button onClick={() => setModal({ t: 'add' })} className={btn + ' bg-brand'}><Plus size={18} />Add {tab === 'teacher' ? 'teacher' : 'administrator'}</button>}
        </div>
        <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
          {!rows ? <Skeleton className="h-48" /> : !shown.length ? <Empty text="No accounts found" /> : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Name', 'Username', tab === 'teacher' ? 'Courses' : '', 'Status', ''].map((h, i) => <th key={i} className="px-4 py-3.5 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{shown.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-navy-800">{u.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{u.username}</td>
                  <td className="px-4 py-3 text-slate-500">{u.courses ?? ''}</td>
                  <td className="px-4 py-3">{u.locked ? <Pill tone="bg-red-100 text-red-700">Locked</Pill> : u.must_change_password ? <Pill tone="bg-amber-100 text-amber-700">Password change pending</Pill> : <Pill tone="bg-emerald-100 text-emerald-700">Active</Pill>}</td>
                  <td className="px-4 py-3"><div className="flex justify-end gap-2">
                    <IconBtn c="bg-brand" Icon={KeyRound} label="Reset password" onClick={() => reset(u)} />
                    {u.role !== 'student' && <IconBtn c="bg-amber-400" Icon={Pencil} label="Edit name" onClick={() => rename(u)} />}
                    {u.role !== 'student' && <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(u)} />}
                  </div></td>
                </tr>))}</tbody>
            </table>)}
        </div>
      </Card>
      {modal?.t === 'add' && <Modal title={`Add ${tab === 'teacher' ? 'teacher' : 'administrator'}`} onClose={() => setModal(null)}><UserForm role={tab} onClose={() => setModal(null)} onSaved={(d) => { setModal({ t: 'cred', data: d }); load() }} /></Modal>}
      {modal?.t === 'edit' && <EditName u={modal.u} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
      {modal?.t === 'cred' && <Credentials data={modal.data} onClose={() => setModal(null)} />}
    </>
  )
}

function EditName({ u, onClose, onSaved }) {
  const ui = useUI()
  const [name, setName] = useState(u.full_name)
  const [busy, save] = useSave(ui, onSaved)
  return (
    <Modal title="Edit account" onClose={onClose} small>
      <form onSubmit={(e) => { e.preventDefault(); save(`/users/${u.id}`, 'PUT', { full_name: name }, 'Account updated') }} className="space-y-4">
        <Label t="Full name"><input className={field} value={name} onChange={(e) => setName(e.target.value)} required autoFocus /></Label>
        <Actions onClose={onClose} busy={busy} />
      </form>
    </Modal>
  )
}

/* ------------------------------------------------------------------ QUIZZES (teacher / admin) */
const blankQ = () => ({ text: '', points: 1, options: [{ text: '', is_correct: true }, { text: '', is_correct: false }] })
const trueFalse = () => ({ text: '', points: 1, options: [{ text: 'True', is_correct: true }, { text: 'False', is_correct: false }] })

function QuizForm({ courseId, quizId, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState(quizId ? null : { title: '', description: '', due_date: '', max_attempts: 1, published: false, questions: [blankQ()] })
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!quizId) return
    api(`/quizzes/${quizId}`).then((q) => {
      setLocked(q.has_attempts)
      setF({ title: q.title, description: q.description, due_date: q.due_date || '', max_attempts: q.max_attempts, published: q.published,
        questions: q.question_list.map((x) => ({ text: x.text, points: x.points, options: x.options.map((o) => ({ text: o.text, is_correct: o.is_correct })) })) })
    }).catch((e) => { ui.error('Could not load the quiz', e.message); onClose() })
  }, [])
  if (!f) return <Modal title="Edit quiz" onClose={onClose} wide><Skeleton className="h-48" /></Modal>

  const setQ = (i, patch) => setF({ ...f, questions: f.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) })
  const setOpt = (i, j, patch) => setQ(i, { options: f.questions[i].options.map((o, k) => (k === j ? { ...o, ...patch } : o)) })
  const setCorrect = (i, j) => setQ(i, { options: f.questions[i].options.map((o, k) => ({ ...o, is_correct: k === j })) })
  const addOpt = (i) => setQ(i, { options: [...f.questions[i].options, { text: '', is_correct: false }] })
  const delOpt = (i, j) => {
    const opts = f.questions[i].options.filter((_, k) => k !== j)
    if (!opts.some((o) => o.is_correct)) opts[0].is_correct = true
    setQ(i, { options: opts })
  }
  const total = f.questions.reduce((a, q) => a + (Number(q.points) || 0), 0)

  const submit = async (e) => {
    e.preventDefault()
    for (const [i, q] of f.questions.entries()) {
      if (!q.text.trim()) return ui.error('Question incomplete', `Write the text of question ${i + 1}.`)
      if (q.options.some((o) => !o.text.trim())) return ui.error('Question incomplete', `Fill in every answer of question ${i + 1}.`)
    }
    setBusy(true)
    const body = { ...f, due_date: f.due_date || null, max_attempts: Number(f.max_attempts), questions: f.questions.map((q) => ({ ...q, points: Number(q.points) })) }
    try {
      await api(quizId ? `/quizzes/${quizId}` : `/courses/${courseId}/quizzes`, { method: quizId ? 'PUT' : 'POST', body: JSON.stringify(body) })
      ui.success(quizId ? 'Quiz updated' : 'Quiz created', f.published ? 'Students can see it now.' : 'It is saved as a draft.'); onSaved()
    } catch (x) { ui.error('Could not save the quiz', x.message); setBusy(false) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <Modal title={quizId ? 'Edit quiz' : 'New quiz'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_170px_130px]">
          <Label t="Title"><input className={field} value={f.title} onChange={set('title')} required autoFocus /></Label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Closes on</span><input type="date" min={todayStr()} className={field} value={f.due_date} onChange={set('due_date')} /></label>
          <Label t="Attempts"><input type="number" min="1" max="10" className={field} value={f.max_attempts} onChange={set('max_attempts')} required /></Label>
        </div>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Instructions</span><textarea rows={2} className={field} value={f.description} onChange={set('description')} /></label>
        {locked && <div className="flex gap-2.5 rounded-xl bg-amber-50 p-3 text-sm text-amber-700"><ShieldAlert size={18} className="mt-0.5 shrink-0" />Students have already taken this quiz, so its questions are locked. You can still change the title, deadline, attempts and visibility.</div>}

        <fieldset disabled={locked} className="space-y-4">
          {f.questions.map((q, i) => (
            <div key={i} className="rounded-2xl p-4 ring-1 ring-slate-200">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-brand">{i + 1}</span>
                <input className={field} placeholder="Type the question" value={q.text} onChange={(e) => setQ(i, { text: e.target.value })} />
                <input type="number" min="0.5" step="0.5" aria-label="Points" title="Points" className={field + ' !w-20 text-center'} value={q.points} onChange={(e) => setQ(i, { points: e.target.value })} />
                {f.questions.length > 1 && <button type="button" aria-label="Remove question" onClick={() => setF({ ...f, questions: f.questions.filter((_, k) => k !== i) })} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={17} /></button>}
              </div>
              <div className="space-y-2 pl-11">
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <input type="radio" name={`q${i}`} checked={o.is_correct} onChange={() => setCorrect(i, j)} aria-label="Correct answer" className="h-4 w-4 accent-emerald-600" />
                    <input className={field + (o.is_correct ? ' !border-emerald-400' : '')} placeholder={`Answer ${j + 1}`} value={o.text} onChange={(e) => setOpt(i, j, { text: e.target.value })} />
                    {q.options.length > 2 && <button type="button" aria-label="Remove answer" onClick={() => delOpt(i, j)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"><X size={16} /></button>}
                  </div>))}
                {q.options.length < 6 && <button type="button" onClick={() => addOpt(i)} className="text-sm font-semibold text-brand hover:underline">Add an answer</button>}
                <p className="text-xs text-slate-400">Select the round button next to the correct answer.</p>
              </div>
            </div>))}
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={() => setF({ ...f, questions: [...f.questions, blankQ()] })} className={btn + ' bg-emerald-600'}><Plus size={16} />Multiple choice</button>
            <button type="button" onClick={() => setF({ ...f, questions: [...f.questions, trueFalse()] })} className={btn + ' bg-sky-600'}><Plus size={16} />True / false</button>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} />Visible to students</label>
          <span className="text-sm font-semibold text-slate-500">{f.questions.length} question(s) · {total} point(s)</span>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Cancel</button>
          <button disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save quiz</button>
        </div>
      </form>
    </Modal>
  )
}

function QuizResults({ quiz, onClose }) {
  const ui = useUI()
  const [d, setD] = useState(null)
  useEffect(() => { api(`/quizzes/${quiz.id}/results`).then(setD).catch((e) => { ui.error('Could not load results', e.message); onClose() }) }, [])
  return (
    <Modal title={`${quiz.title} - results`} onClose={onClose} wide>
      {!d ? <Skeleton className="h-48" /> : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Students who took it', `${d.quiz.students_attempted}/${d.rows.length}`], ['Class average', d.quiz.avg_percent == null ? '-' : `${d.quiz.avg_percent}%`], ['Total points', d.total]].map(([l, v]) => (
              <div key={l} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100"><div className="text-xs font-medium text-slate-500">{l}</div><div className="mt-1 text-2xl font-extrabold text-navy-800">{v}</div></div>))}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-bold text-navy-800">Success rate per question</h4>
            <div className="space-y-2.5">{d.questions.map((x, i) => (
              <div key={x.id}>
                <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-slate-600">{i + 1}. {x.text}</span><span className="shrink-0 font-semibold text-navy-800">{x.percent == null ? '-' : `${x.percent}%`}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><i className={`block h-full rounded-full ${x.percent == null ? '' : x.percent < 50 ? 'bg-red-500' : x.percent < 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${x.percent || 0}%` }} /></div>
              </div>))}</div>
          </div>
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
            <table className="w-full min-w-[460px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr>{['Student', 'Attempts', 'Best score'].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{d.rows.map((r) => (
                <tr key={r.student_id}><td className="px-4 py-2.5 font-semibold text-navy-800">{r.full_name}</td><td className="px-4 py-2.5">{r.attempts}</td>
                  <td className="px-4 py-2.5 font-bold">{r.best == null ? <span className="font-normal text-slate-400">Not taken</span> : `${r.best} / ${d.total}`}</td></tr>))}</tbody>
            </table>
          </div>
        </div>)}
    </Modal>
  )
}

export function QuizzesTab({ course }) {
  const ui = useUI()
  const [rows, setRows] = useState(null)
  const [modal, setModal] = useState(null)
  const load = () => api(`/courses/${course.id}/quizzes`).then(setRows).catch((e) => ui.error('Loading failed', e.message))
  useEffect(() => { load() }, [course.id])
  const close = () => setModal(null)
  const after = () => { close(); load() }
  const toggle = async (q) => { try { const r = await api(`/quizzes/${q.id}/publish`, { method: 'POST' }); ui.success(r.published ? 'Quiz published' : 'Quiz hidden', q.title); load() } catch (x) { ui.error('Failed', x.message) } }
  const del = async (q) => {
    if (!(await ui.confirm({ title: 'Delete this quiz?', message: `${q.title} and all student attempts will be removed.`, confirmText: 'Delete' }))) return
    try { await api(`/quizzes/${q.id}`, { method: 'DELETE' }); ui.success('Quiz deleted'); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  return (
    <Card>
      <button onClick={() => setModal({ t: 'form' })} className={btn + ' mb-4 bg-brand'}><Plus size={18} />New quiz</button>
      {!rows ? <Skeleton className="h-28" /> : !rows.length ? <Empty text="No quizzes yet. Build your first quiz." /> : (
        <div className="space-y-3">{rows.map((q) => (
          <div key={q.id} className="rounded-2xl p-4 ring-1 ring-slate-100">
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-sky-600"><HelpCircle size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-navy-800">{q.title}</span>
                  <Pill tone={q.published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>{q.published ? 'Published' : 'Draft'}</Pill></div>
                <div className="mt-0.5 text-xs text-slate-500">{q.questions} question(s) · {q.total_points} pt · {q.max_attempts} attempt(s){q.due_date && ` · closes ${fmt(q.due_date)}`} · {q.students_attempted} student(s) took it{q.avg_percent != null && ` · avg ${q.avg_percent}%`}</div>
              </div>
              <div className="flex gap-2">
                <IconBtn c="bg-violet-500" Icon={BarChart3} label="Results" onClick={() => setModal({ t: 'res', q })} />
                <IconBtn c="bg-sky-500" Icon={q.published ? EyeOff : Eye} label={q.published ? 'Hide from students' : 'Publish'} onClick={() => toggle(q)} />
                <IconBtn c="bg-amber-400" Icon={Pencil} label="Edit" onClick={() => setModal({ t: 'form', id: q.id })} />
                <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(q)} />
              </div>
            </div>
          </div>))}</div>)}
      {modal?.t === 'form' && <QuizForm courseId={course.id} quizId={modal.id} onClose={close} onSaved={after} />}
      {modal?.t === 'res' && <QuizResults quiz={modal.q} onClose={close} />}
    </Card>
  )
}
