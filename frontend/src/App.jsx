import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Outlet, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Home, Users, School, LogOut, Plus, Search, Eye, EyeOff, Pencil, Trash2, Lock, User, GraduationCap,
  UserPlus, X, Save, ChevronLeft, ChevronRight, Loader2, Menu, SearchX, Sun, Moon, FileText, FileSpreadsheet, ClipboardList,
  BookOpen, UserCheck, Megaphone, CalendarDays, KeyRound, Library, ClipboardCheck, HelpCircle, ShieldCheck } from 'lucide-react'
import { api, getToken, getRole, mustChange, setMust, setSession, clearSession, download } from './api'
import { btn, field, Modal, Skeleton, useCountUp, useUI, useTheme } from './ui'
import { Grades } from './pages2'
import { Courses, CourseDetail, Attendance, Announcements, CalendarPage } from './pages3'
import { UsersPage } from './pages4'
import { StudentDashboard, MyAssignments, MyQuizzes, QuizTake, MyGrades, MyAttendance } from './pages5'
import { EVENT_TONE } from './shared'

const fmtDate = (d) => d.split('-').reverse().join('/')
const userName = () => localStorage.getItem('hodari_name') || 'Admin'
const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' }
const greet = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }

const Logo = ({ dark }) => (
  <div className="flex items-center gap-3">
    <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-sky-400 shadow-lg shadow-brand/30"><GraduationCap className="text-white" size={22} /></div>
    <div className="leading-tight">
      <div className={`font-display text-[15px] font-extrabold tracking-tight ${dark ? 'text-navy-800' : 'text-white'}`}>Hodari School</div>
      <div className={`text-[11px] font-medium ${dark ? 'text-slate-500' : 'text-blue-200/80'}`}>Knowledge Builds a Better Future</div>
    </div>
  </div>
)
const Avatar = ({ size = 'h-9 w-9' }) => <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-sky-400 text-sm font-bold text-white`}>{userName()[0].toUpperCase()}</span>

const FEATURES = [
  [Users, 'Student records', 'Registrations, classes and report cards'],
  [Library, 'Courses and assignments', 'Content, deadlines and marking in one place'],
  [UserCheck, 'Attendance', 'Daily registers and attendance statistics'],
  [Megaphone, 'Announcements', 'Keep the whole school informed'],
]

function Login() {
  const nav = useNavigate(), ui = useUI()
  const [f, setF] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  if (getToken()) return <Navigate to="/" replace />
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify(f) })
      setSession(r.access_token, r.full_name, r.role, r.must_change_password); ui.success('Welcome back', `Signed in as ${r.full_name}`); nav('/')
    } catch (x) { ui.error('Sign-in failed', x.message) } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="pattern relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-brand p-12 text-white lg:flex">
        <Logo />
        <div className="max-w-xl">
          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">School management and learning, in one platform.</h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-blue-100/90">Everything your administration needs to run classes, follow students and keep families informed.</p>
          <ul className="mt-10 grid gap-3.5 sm:grid-cols-2">
            {FEATURES.map(([I, t, d]) => (
              <li key={t} className="flex gap-3 rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15"><I size={20} /></span>
                <div><div className="text-sm font-semibold">{t}</div><div className="mt-0.5 text-xs leading-relaxed text-blue-100/80">{d}</div></div>
              </li>))}
          </ul>
        </div>
        <div className="text-xs text-blue-200/70">© {new Date().getFullYear()} Hodari School. All rights reserved.</div>
      </div>
      <div className="flex items-center justify-center bg-slate-50 p-5 sm:p-8">
        <form onSubmit={submit} className="pop w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/70 sm:p-9">
          <div className="lg:hidden"><Logo dark /></div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-navy-800">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Teachers and administrators use their username. Students use their student number.</p>
          </div>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Username</span>
            <div className="relative"><User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input className={field + ' pl-10'} placeholder="Username or student number" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required autoFocus autoComplete="username" /></div></label>
          <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">Password</span>
            <div className="relative"><Lock size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
              <input className={field + ' pl-10 pr-10'} type={show ? 'text' : 'password'} placeholder="Your password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="current-password" />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-3 text-slate-400 hover:text-slate-600">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          <button disabled={busy} className={btn + ' w-full bg-brand py-3 shadow-lg shadow-brand/25'}>{busy && <Loader2 className="animate-spin" size={16} />}Sign in</button>
          <p className="text-center text-xs text-slate-400">Hodari School management platform</p>
        </form>
      </div>
    </div>
  )
}

const NAV = {
  admin: [
    ['Overview', [['/', 'Dashboard', Home]]],
    ['Academics', [['/students', 'Students', Users], ['/classes', 'Classes', School], ['/courses', 'Courses', Library], ['/grades', 'Grades', ClipboardList], ['/attendance', 'Attendance', UserCheck]]],
    ['Communication', [['/announcements', 'Announcements', Megaphone], ['/calendar', 'Calendar', CalendarDays]]],
    ['Administration', [['/users', 'Users', ShieldCheck]]],
  ],
  teacher: [
    ['Overview', [['/', 'Dashboard', Home]]],
    ['Teaching', [['/courses', 'My courses', Library], ['/students', 'My students', Users], ['/classes', 'My classes', School], ['/grades', 'Grades', ClipboardList], ['/attendance', 'Attendance', UserCheck]]],
    ['Communication', [['/announcements', 'Announcements', Megaphone], ['/calendar', 'Calendar', CalendarDays]]],
  ],
  student: [
    ['Overview', [['/', 'Dashboard', Home]]],
    ['Learning', [['/courses', 'My courses', Library], ['/assignments', 'Assignments', ClipboardCheck], ['/quizzes', 'Quizzes', HelpCircle]]],
    ['My record', [['/grades', 'Grades', ClipboardList], ['/attendance', 'Attendance', UserCheck]]],
    ['Communication', [['/announcements', 'Announcements', Megaphone], ['/calendar', 'Calendar', CalendarDays]]],
  ],
}

function PasswordForm({ onClose, onDone, current = true }) {
  const ui = useUI()
  const [f, setF] = useState({ current_password: '', new_password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (f.new_password !== f.confirm) return ui.error('Passwords do not match', 'Type the same new password twice.')
    setBusy(true)
    try {
      await api('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: f.current_password, new_password: f.new_password }) })
      setMust(false); ui.success('Password updated', 'Use your new password next time.'); onDone ? onDone() : onClose()
    } catch (x) { ui.error('Could not change password', x.message); setBusy(false) }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  return (
    <form onSubmit={submit} className="space-y-4">
      <Label t={current === 'temp' ? 'Current (temporary) password' : 'Current password'}><input type="password" className={field} value={f.current_password} onChange={set('current_password')} required autoComplete="current-password" /></Label>
      <Label t="New password (min. 6 characters)"><input type="password" minLength={6} className={field} value={f.new_password} onChange={set('new_password')} required autoComplete="new-password" /></Label>
      <Label t="Confirm new password"><input type="password" minLength={6} className={field} value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" /></Label>
      <button disabled={busy} className={btn + ' w-full bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Update password</button>
    </form>
  )
}

function ForcePassword({ onDone }) {
  const nav = useNavigate(), ui = useUI()
  const out = () => { clearSession(); ui.info('Logged out'); nav('/login') }
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
      <div className="pop w-full max-w-md space-y-5 rounded-2xl bg-white p-7 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/70 sm:p-9">
        <Logo dark />
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-navy-800">Choose a new password</h2>
          <p className="mt-1 text-sm text-slate-500">Your account uses a temporary password. Pick a personal one to continue. It cannot be 12345.</p>
        </div>
        <PasswordForm current="temp" onDone={onDone} />
        <button onClick={out} className="w-full text-center text-sm text-slate-500 hover:underline">Sign out</button>
      </div>
    </div>
  )
}

function Layout() {
  const nav = useNavigate(), ui = useUI(), loc = useLocation()
  const [open, setOpen] = useState(false)
  const [pwd, setPwd] = useState(false)
  const [forced, setForced] = useState(mustChange())
  const { dark, toggle } = useTheme()
  useEffect(() => setOpen(false), [loc.pathname])
  if (!getToken()) return <Navigate to="/login" replace />
  if (forced) return <ForcePassword onDone={() => setForced(false)} />
  const out = () => { clearSession(); ui.info('Logged out', 'See you soon!'); nav('/login') }
  const side = (
    <>
      <Logo />
      <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pr-1">
        {(NAV[getRole()] || NAV.student).map(([title, links]) => (
          <div key={title}>
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-blue-300/60">{title}</div>
            <div className="space-y-0.5">
              {links.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-blue-100/80 hover:bg-white/5 hover:text-white'}`}>
                  {({ isActive }) => <>{isActive && <i className="absolute -left-5 bottom-1.5 top-1.5 w-1 rounded-r-full bg-sky-400" />}<Icon size={18} className={isActive ? 'text-sky-300' : 'text-blue-200/70'} />{label}</>}
                </NavLink>))}
            </div>
          </div>))}
      </nav>
      <div className="mt-4 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3"><Avatar /><div className="min-w-0 flex-1 text-sm"><div className="truncate font-semibold">{userName()}</div><div className="text-xs text-blue-200">{ROLE_LABEL[getRole()] || ""}</div></div><button onClick={() => setPwd(true)} aria-label="Change password" title="Change password" className="rounded-lg p-2 text-blue-100 hover:bg-white/10"><KeyRound size={17} /></button><button onClick={toggle} aria-label="Toggle theme" className="rounded-lg p-2 text-blue-100 hover:bg-white/10">{dark ? <Sun size={17} /> : <Moon size={17} />}</button></div>
        <button onClick={out} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 py-2 text-sm text-blue-50 transition hover:bg-red-500"><LogOut size={16} />Logout</button>
      </div>
    </>
  )
  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-navy-900 to-[#06173a] p-5 text-white lg:flex">{side}</aside>
      {open && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="slide absolute left-0 top-0 flex h-full w-72 flex-col bg-gradient-to-b from-navy-900 to-[#06173a] p-5 text-white">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-1.5 text-blue-200 hover:bg-white/10"><X size={20} /></button>{side}</aside>
        </div>)}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-lg lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu" className="rounded-xl p-2 text-navy-800 ring-1 ring-slate-200"><Menu size={20} /></button>
          <Logo dark /><div className="ml-auto flex items-center gap-2"><button onClick={toggle} aria-label="Toggle theme" className="rounded-xl p-2 text-navy-800 ring-1 ring-slate-200">{dark ? <Sun size={18} /> : <Moon size={18} />}</button><Avatar /></div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
        {pwd && <Modal title="Change password" onClose={() => setPwd(false)} small><PasswordForm onClose={() => setPwd(false)} /></Modal>}
      </div>
    </div>
  )
}

export const Header = ({ title, sub }) => (
  <div className="mb-7 flex items-start justify-between gap-4">
    <div><h1 className="text-2xl font-extrabold tracking-tight text-navy-800 sm:text-[28px]">{title}</h1>{sub && <p className="mt-1 text-sm text-slate-500">{sub}</p>}</div>
    <div className="hidden items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-4 text-sm shadow-sm ring-1 ring-slate-200/70 sm:flex"><Avatar size="h-8 w-8" /><span className="font-medium text-slate-700">{userName()}</span></div>
  </div>
)
export const Card = ({ title, children, className = '' }) => (
  <div className={`pop rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 sm:p-6 ${className}`}>
    {title && <h2 className="mb-4 text-base font-bold text-navy-800">{title}</h2>}{children}</div>
)
const Th = ({ list }) => <tr>{list.map((h) => <th key={h} className="px-4 py-3.5 font-semibold">{h}</th>)}</tr>
export const Badge = ({ s }) => <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}><i className="h-1.5 w-1.5 rounded-full bg-current" />{s}</span>
export const IconBtn = ({ c, Icon, label, ...p }) => <button aria-label={label} title={label} {...p} className={`grid h-9 w-9 place-items-center rounded-xl text-white shadow-sm transition hover:scale-110 hover:brightness-110 ${c}`}><Icon size={16} /></button>
export const Label = ({ t, children }) => <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-600">{t} *</span>{children}</label>
export const Empty = ({ text }) => <div className="grid place-items-center gap-3 py-14 text-slate-400"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100"><SearchX size={26} /></span><span className="text-sm font-medium text-slate-500">{text}</span></div>

export function Stat({ label, value, Icon, tone }) {
  const v = useCountUp(value)
  return (
    <div className="pop flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-200/70 transition hover:-translate-y-0.5">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={22} /></div>
      <div className="min-w-0"><div className="truncate text-sm font-medium text-slate-500">{label}</div><div className="font-display text-3xl font-extrabold leading-tight text-navy-800">{v}</div></div>
    </div>)
}

function Dashboard() {
  const nav = useNavigate(), ui = useUI()
  const [d, setD] = useState(null)
  const [o, setO] = useState(null)
  useEffect(() => {
    api('/dashboard').then(setD).catch((e) => ui.error('Could not load dashboard', e.message))
    api('/lms/overview').then(setO).catch(() => {})
  }, [])
  const stats = d && [
    ['Total Students', d.total_students, Users, 'bg-blue-50 text-brand ring-blue-100'],
    ['Total Classes', d.total_classes, School, 'bg-emerald-50 text-emerald-600 ring-emerald-100'],
    ['Recent Registrations', d.recent_registrations, UserPlus, 'bg-amber-50 text-amber-600 ring-amber-100']]
  const max = d ? Math.max(4, ...d.by_class.map((c) => c.count)) : 1
  const top = Math.ceil(max / 2) * 2
  return (
    <>
      <Header title="Dashboard" sub={`${greet()}, ${userName()}. Here is an overview of your school.`} />
      <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
        {d ? stats.map(([l, v, I, t]) => <Stat key={l} label={l} value={v} Icon={I} tone={t} />) : [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 !rounded-2xl" />)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card title="Students by Class" className="lg:col-span-2">
          {d ? (
            <div className="relative h-64 pl-7">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="absolute inset-x-0 flex items-center gap-2 text-[11px] text-slate-400" style={{ bottom: `calc(${i * 25}% * .85 + 24px)` }}>
                  <span className="w-5 text-right">{Math.round((top / 4) * i)}</span><i className="h-px flex-1 bg-slate-100" /></div>))}
              <div className="relative flex h-full items-end gap-2 pb-6 sm:gap-5">
                {d.by_class.map((c) => (
                  <div key={c.name} className="group relative flex h-full flex-1 flex-col justify-end text-center">
                    <span className="mb-1 text-xs font-bold text-navy-800 opacity-0 transition group-hover:opacity-100">{c.count}</span>
                    <div className="rounded-t-xl bg-gradient-to-t from-brand to-sky-400 transition-all duration-700 group-hover:brightness-110" style={{ height: `${(c.count / top) * 85}%`, minHeight: 4 }} />
                    <span className="absolute -bottom-0 left-0 right-0 text-xs text-slate-500">{c.name}</span>
                  </div>))}
              </div>
            </div>) : <Skeleton className="h-64" />}
        </Card>
        <Card title="Quick Actions">
          <div className="space-y-3">
            {getRole() === 'admin' ? <>
              <button onClick={() => nav('/students?new=1')} className={btn + ' w-full bg-emerald-600 py-3'}><Plus size={18} />Register New Student</button>
              <button onClick={() => nav('/users')} className={btn + ' w-full bg-brand py-3'}><ShieldCheck size={18} />Manage Users</button>
              <button onClick={() => nav('/courses')} className={btn + ' w-full !text-brand bg-blue-50 py-3 ring-1 ring-blue-100 shadow-none'}><Library size={18} />Manage Courses</button>
            </> : <>
              <button onClick={() => nav('/attendance')} className={btn + ' w-full bg-emerald-600 py-3'}><UserCheck size={18} />Take Attendance</button>
              <button onClick={() => nav('/courses')} className={btn + ' w-full bg-brand py-3'}><Library size={18} />My Courses</button>
              <button onClick={() => nav('/grades')} className={btn + ' w-full !text-brand bg-blue-50 py-3 ring-1 ring-blue-100 shadow-none'}><ClipboardList size={18} />Enter Grades</button>
            </>}
          </div>
        </Card>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        {o ? [
          ['Courses', o.courses, Library, 'bg-violet-50 text-violet-600 ring-violet-100'],
          ['Open assignments', o.open_assignments, ClipboardCheck, 'bg-sky-50 text-sky-600 ring-sky-100'],
          ['To grade', o.to_grade, ClipboardList, 'bg-amber-50 text-amber-600 ring-amber-100'],
          ['Attendance (30 d, %)', o.attendance_rate ?? 0, UserCheck, 'bg-emerald-50 text-emerald-600 ring-emerald-100']].map(([l, v, I, t]) => <Stat key={l} label={l} value={v} Icon={I} tone={t} />)
          : [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 !rounded-2xl" />)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Latest announcements">
          {!o ? <Skeleton className="h-32" /> : !o.announcements.length ? <Empty text="No announcements yet" /> : (
            <div className="space-y-3">{o.announcements.map((a) => (
              <div key={a.id} className="rounded-2xl p-3.5 ring-1 ring-slate-100">
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-navy-800">{a.title}</span><span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-brand">{a.class_name}</span></div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.body}</p></div>))}</div>)}
        </Card>
        <Card title="Upcoming">
          {!o ? <Skeleton className="h-32" /> : !o.upcoming.length ? <Empty text="Nothing scheduled" /> : (
            <div className="space-y-2.5">{o.upcoming.map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl p-3 ring-1 ring-slate-100">
                <span className="w-20 shrink-0 text-xs font-semibold text-slate-500">{fmtDate(e.day)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy-800">{e.title}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${EVENT_TONE[e.kind]}`}>{e.kind}</span></div>))}</div>)}
        </Card>
      </div>
    </>
  )
}

function StudentForm({ student, classes, onSaved, onClose }) {
  const ui = useUI()
  const [f, setF] = useState(student || { student_number: '', full_name: '', birth_date: '', guardian_name: '', class_id: '', status: 'Active' })
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  useEffect(() => { if (!student) api('/students/next-number').then((r) => setF((x) => ({ ...x, student_number: r.student_number }))) }, [])
  const submit = async (e) => {
    e.preventDefault(); setBusy(true)
    try {
      await api(student ? `/students/${student.id}` : '/students', { method: student ? 'PUT' : 'POST', body: JSON.stringify({ ...f, class_id: Number(f.class_id) }) })
      onSaved(student ? 'Student updated' : 'Student registered', f.full_name)
    } catch (x) { ui.error('Could not save', x.message); setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Label t="Student Number"><input className={field} value={f.student_number} onChange={set('student_number')} required /></Label>
        <Label t="Date of Birth"><input type="date" max={new Date().toISOString().slice(0, 10)} className={field} value={f.birth_date} onChange={set('birth_date')} required /></Label>
      </div>
      <Label t="Full Name"><input className={field} placeholder="e.g. Jean Dupont" value={f.full_name} onChange={set('full_name')} required /></Label>
      <Label t="Guardian Name"><input className={field} placeholder="e.g. M. Dupont" value={f.guardian_name} onChange={set('guardian_name')} required /></Label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Label t="Class"><select className={field} value={f.class_id} onChange={set('class_id')} required>
          <option value="">Select class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.academic_year})</option>)}</select></Label>
        <Label t="Status"><select className={field} value={f.status} onChange={set('status')}><option>Active</option><option>Inactive</option></select></Label>
      </div>
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={btn + ' !text-slate-600 bg-slate-100 shadow-none'}>Cancel</button>
        <button disabled={busy} className={btn + ' bg-brand'}>{busy ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}Save</button>
      </div>
    </form>
  )
}

function Students() {
  const ui = useUI()
  const [sp, setSp] = useSearchParams()
  const [data, setData] = useState({ items: [], total: 0, size: 5 })
  const [loading, setLoading] = useState(true)
  const [classes, setClasses] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const admin = getRole() === 'admin'
  const [modal, setModal] = useState(sp.get('new') && admin ? { mode: 'add' } : null)
  const load = () => api(`/students?q=${encodeURIComponent(q)}&page=${page}`).then(setData).catch((e) => ui.error('Loading failed', e.message)).finally(() => setLoading(false))
  useEffect(() => { api('/classes').then(setClasses) }, [])
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [q, page])
  useEffect(() => { setPage(1) }, [q])
  const close = () => { setModal(null); if (sp.get('new')) setSp({}) }
  const saved = (title, name) => { close(); ui.success(title, name); load() }
  const del = async (s) => {
    if (!(await ui.confirm({ title: 'Delete this student?', message: `${s.full_name} will be permanently removed. This cannot be undone.`, confirmText: 'Delete' }))) return
    try { await api(`/students/${s.id}`, { method: 'DELETE' }); ui.success('Student deleted', s.full_name); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  const pages = Math.max(1, Math.ceil(data.total / data.size))
  const from = data.total ? (page - 1) * data.size + 1 : 0
  const getCard = (s) => download(`/report-card/${s.id}.pdf`, `report-card-${s.student_number}.pdf`).catch((x) => ui.error('Download failed', x.message))
  const exp = (ext) => download(`/export/students.${ext}?q=${encodeURIComponent(q)}`, `students.${ext}`).then(() => ui.success('Export ready', `students.${ext}`)).catch((x) => ui.error('Export failed', x.message))
  const resetPw = async (s) => {
    if (!(await ui.confirm({ title: `Reset password for ${s.full_name}?`, message: 'The password goes back to 12345 and the student must change it at the next sign-in.', confirmText: 'Reset' }))) return
    try { const r = await api(`/students/${s.id}/reset-password`, { method: 'POST' }); ui.success('Password reset', `Sign in with ${r.username} / ${r.temporary_password}`) } catch (x) { ui.error('Could not reset', x.message) }
  }
  const actions = (s) => (
    <div className="flex gap-2">
      <IconBtn c="bg-brand" Icon={Eye} label="View" onClick={() => setModal({ mode: 'view', s })} />
      <IconBtn c="bg-emerald-500" Icon={FileText} label="Report card" onClick={() => getCard(s)} />
      {admin && <IconBtn c="bg-violet-500" Icon={KeyRound} label="Reset password" onClick={() => resetPw(s)} />}
      {admin && <IconBtn c="bg-amber-400" Icon={Pencil} label="Edit" onClick={() => setModal({ mode: 'edit', s })} />}
      {admin && <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(s)} />}</div>)
  return (
    <>
      <Header title={admin ? 'Students' : 'My students'} sub={admin ? 'Register, search and manage student records.' : 'Students of the classes you teach.'} />
      <Card>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          {admin && <button onClick={() => setModal({ mode: 'add' })} className={btn + ' bg-brand'}><Plus size={18} />Add Student</button>}
          <div className="flex gap-2">
            <button onClick={() => exp('xlsx')} className={btn + ' flex-1 bg-emerald-600'}><FileSpreadsheet size={17} />Excel</button>
            <button onClick={() => exp('pdf')} className={btn + ' flex-1 bg-red-500'}><FileText size={17} />PDF</button></div>
          <div className="relative flex-1 sm:ml-auto sm:max-w-md">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input className={field + ' pl-10 pr-9'} placeholder="Search by name or number..." value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button onClick={() => setQ('')} aria-label="Clear" className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"><X size={18} /></button>}
          </div>
        </div>
        {loading ? <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          : !data.items.length ? <Empty text={q ? `No student matches “${q}”` : 'No students registered yet'} /> : (
            <>
              <div className="hidden overflow-x-auto rounded-2xl ring-1 ring-slate-100 md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><Th list={['#', 'Student Number', 'Full Name', 'Class', 'Date of Birth', 'Status', 'Actions']} /></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.items.map((s, i) => (
                      <tr key={s.id} className="transition hover:bg-blue-50/40">
                        <td className="px-4 py-3 text-slate-400">{from + i}</td>
                        <td className="px-4 py-3 font-medium">{s.student_number}</td>
                        <td className="px-4 py-3 font-semibold text-navy-800">{s.full_name}</td>
                        <td className="px-4 py-3">{s.class_name}</td>
                        <td className="px-4 py-3">{fmtDate(s.birth_date)}</td>
                        <td className="px-4 py-3"><Badge s={s.status} /></td>
                        <td className="px-4 py-3">{actions(s)}</td></tr>))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {data.items.map((s) => (
                  <div key={s.id} className="rounded-2xl p-4 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-blue-50 font-bold text-brand">{s.full_name[0]}</span>
                        <div><div className="font-bold text-navy-800">{s.full_name}</div><div className="text-xs text-slate-500">{s.student_number} · {s.class_name}</div></div></div>
                      <Badge s={s.status} /></div>
                    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-slate-500">Born {fmtDate(s.birth_date)}</span>{actions(s)}</div>
                  </div>))}
              </div>
            </>)}
        <div className="mt-5 flex flex-col items-center justify-between gap-3 text-sm text-slate-500 sm:flex-row">
          <span>Showing {from} to {Math.min(page * data.size, data.total)} of {data.total} students</span>
          <div className="flex gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-slate-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((n) => (
              <button key={n} onClick={() => setPage(n)} className={`h-9 w-9 rounded-xl font-semibold ${n === page ? 'bg-brand text-white shadow-md shadow-brand/30' : 'ring-1 ring-slate-200 hover:bg-slate-50'}`}>{n}</button>))}
            <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-xl ring-1 ring-slate-200 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </Card>
      {modal && modal.mode !== 'view' && (
        <Modal title={modal.mode === 'add' ? 'Register New Student' : 'Edit Student'} onClose={close}>
          <StudentForm student={modal.s} classes={classes} onSaved={saved} onClose={close} /></Modal>)}
      {modal?.mode === 'view' && (
        <Modal title="Student Details" onClose={close}>
          <div className="mb-4 flex items-center gap-4"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-sky-400 text-2xl font-bold text-white">{modal.s.full_name[0]}</span>
            <div><div className="text-lg font-bold text-navy-800">{modal.s.full_name}</div><Badge s={modal.s.status} /></div></div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Student Number', modal.s.student_number], ['Class', modal.s.class_name], ['Date of Birth', fmtDate(modal.s.birth_date)], ['Guardian', modal.s.guardian_name]].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-slate-50 p-3.5"><dt className="text-xs text-slate-400">{k}</dt><dd className="mt-0.5 font-semibold text-navy-800">{v}</dd></div>))}
          </dl>
        </Modal>)}
    </>
  )
}

const YEARS = ['2025 - 2026', '2026 - 2027', '2027 - 2028']

function Classes() {
  const ui = useUI()
  const admin = getRole() === 'admin'
  const [rows, setRows] = useState(null)
  const [f, setF] = useState({ name: '', academic_year: '' })
  const [editing, setEditing] = useState(null)
  const load = () => api('/classes').then(setRows)
  useEffect(() => { load() }, [])
  const reset = () => { setF({ name: '', academic_year: '' }); setEditing(null) }
  const submit = async (e) => {
    e.preventDefault()
    try {
      await api(editing ? `/classes/${editing}` : '/classes', { method: editing ? 'PUT' : 'POST', body: JSON.stringify(f) })
      ui.success(editing ? 'Class updated' : 'Class added', f.name); reset(); load()
    } catch (x) { ui.error('Could not save class', x.message) }
  }
  const del = async (c) => {
    if (!(await ui.confirm({ title: `Delete class ${c.name}?`, message: 'Classes that still contain students cannot be deleted.', confirmText: 'Delete' }))) return
    try { await api(`/classes/${c.id}`, { method: 'DELETE' }); ui.success('Class deleted', c.name); load() } catch (x) { ui.error('Could not delete', x.message) }
  }
  return (
    <>
      <Header title="Class Management" sub="Organise students by class and academic year." />
      <div className={`grid gap-5 ${admin ? 'lg:grid-cols-[360px_1fr]' : ''}`}>
        {admin && <Card title={editing ? 'Edit Class' : 'Add New Class'} className="self-start">
          <form onSubmit={submit} className="space-y-4">
            <Label t="Class Name"><input className={field} placeholder="e.g. 6e A" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Label>
            <Label t="Academic Year"><select className={field} value={f.academic_year} onChange={(e) => setF({ ...f, academic_year: e.target.value })} required>
              <option value="">Select year</option>{YEARS.map((y) => <option key={y}>{y}</option>)}</select></Label>
            <button className={btn + ' w-full bg-brand'}><Save size={16} />Save Class</button>
            {editing && <button type="button" onClick={reset} className="w-full text-sm text-slate-500 hover:underline">Cancel edit</button>}
          </form>
        </Card>}
        <Card title="Existing Classes">
          {!rows ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
            : !rows.length ? <Empty text="No classes yet. Add your first class." /> : (
              <div className="space-y-3">
                {rows.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-2xl p-3.5 ring-1 ring-slate-100 transition hover:bg-blue-50/40 hover:ring-blue-100 sm:gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-sm font-bold text-brand">{i + 1}</span>
                    <div className="min-w-0 flex-1"><div className="truncate font-bold text-navy-800">{c.name}</div><div className="text-xs text-slate-500">{c.academic_year}</div></div>
                    <span className="hidden rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-brand sm:block">{c.student_count} students</span>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-brand sm:hidden">{c.student_count}</span>
                    <div className={`flex gap-2 ${admin ? '' : 'hidden'}`}>
                      <IconBtn c="bg-amber-400" Icon={Pencil} label="Edit" onClick={() => { setEditing(c.id); setF({ name: c.name, academic_year: c.academic_year }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
                      <IconBtn c="bg-red-500" Icon={Trash2} label="Delete" onClick={() => del(c)} /></div>
                  </div>))}
              </div>)}
        </Card>
      </div>
    </>
  )
}

const Only = ({ roles, children }) => (roles.includes(getRole()) ? children : <Navigate to="/" replace />)
const byRole = (staff, student) => () => (getRole() === 'student' ? student : staff)
const Home_ = byRole(<Dashboard />, <StudentDashboard />)
const AttendanceRoute = byRole(<Attendance />, <MyAttendance />)
const GradesRoute = byRole(<Grades />, <MyGrades />)

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Home_ />} />
        <Route path="students" element={<Only roles={['admin', 'teacher']}><Students /></Only>} />
        <Route path="classes" element={<Only roles={['admin', 'teacher']}><Classes /></Only>} />
        <Route path="users" element={<Only roles={['admin']}><UsersPage /></Only>} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="attendance" element={<AttendanceRoute />} />
        <Route path="grades" element={<GradesRoute />} />
        <Route path="assignments" element={<Only roles={['student']}><MyAssignments /></Only>} />
        <Route path="quizzes" element={<Only roles={['student']}><MyQuizzes /></Only>} />
        <Route path="quizzes/:id" element={<Only roles={['student']}><QuizTake /></Only>} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="calendar" element={<CalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
