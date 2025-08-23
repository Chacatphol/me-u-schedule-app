import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { format, isToday, isPast, addMinutes, addHours, addDays, differenceInMinutes, differenceInHours, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, add, isSameMonth, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar as CalendarIcon, Bell, Trash2, Pencil, Check, TimerReset, Upload, Download, ChevronLeft, ChevronRight, Link as LinkIcon, ListTodo, Sparkles, Folder, LayoutGrid, Layers, RefreshCw, Sun, Moon, BarChart3, LogOut, User } from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth } from "./firebase"; // Import auth


// --- Simple in-file UI kit using Tailwind + a few tiny helpers ---
const Button = ({ as:Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-slate-900 text-white dark:bg-white dark:text-slate-900 whitespace-nowrap ${className}`} {...props} />
);
const GhostButton = ({ as:Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-colors active:scale-[0.98] border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 whitespace-nowrap ${className}`} {...props} />
);
const Input = (props) => <input {...props} className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring focus:ring-indigo-200 ${props.className||''}`} />
const Textarea = (props) => <textarea {...props} className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring focus:ring-indigo-200 ${props.className||''}`} />
const Select = (props) => <select {...props} className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring focus:ring-indigo-200 ${props.className||''}`} />
const Card = ({ className='', ...props }) => <div className={`rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-4 ${className}`} {...props} />
const SectionTitle = ({children}) => <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">{children}</div>
const Badge = ({children, className=''}) => <span className={`px-2 py-0.5 rounded-full text-xs border ${className}`} >{children}</span>
const Progress = ({value=0}) => (
  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
    <div className="h-full bg-indigo-500" style={{width:`${Math.min(100,Math.max(0,value))}%`}} />
  </div>
)

// --- Data layer ---
const initialState = {
  theme: 'auto',
  subjects: [], // {id, name, color}
  tasks: [], // {id, subjectId, title, detail, dueAt|null, link, status:'todo'|'doing'|'done', progress:0-100, priority:'low'|'med'|'high', category:'เรียน'|'งาน'|'ส่วนตัว', reminders:[{type:'minutes'|'hours'|'days', amount:number}], createdAt, updatedAt}
}

function reducer(state, action){
  switch(action.type){
    case 'load': {
      const loaded = action.payload;
      // Ensure loaded is an object and not null, otherwise reset to initial state
      if (typeof loaded !== 'object' || loaded === null) {
        return initialState;
      }
      return {
        ...initialState,
        subjects: Array.isArray(loaded.subjects) ? loaded.subjects.filter(s => s && typeof s === 'object') : [],
        tasks: Array.isArray(loaded.tasks) ? loaded.tasks.filter(t => t && typeof t === 'object') : [],
        theme: loaded.theme || 'auto',
      };
    }
    case 'addSubject': return { ...state, subjects:[...state.subjects, action.payload] }
    case 'updateSubject': return { ...state, subjects: state.subjects.map(s=>s.id===action.payload.id? {...s,...action.payload}:s) }
    case 'deleteSubject': return { ...state, subjects: state.subjects.filter(s=>s.id!==action.id), tasks: state.tasks.filter(t=>t.subjectId!==action.id) }
    case 'addTask': return { ...state, tasks:[...state.tasks, action.payload] }
    case 'updateTask': return { ...state, tasks: state.tasks.map(t=>t.id===action.payload.id? {...t,...action.payload, updatedAt:Date.now()}:t) }
    case 'deleteTask': return { ...state, tasks: state.tasks.filter(t=>t.id!==action.id) }
    case 'setTheme': return { ...state, theme: action.value }
    case 'reset': return initialState
    default: return state
  }
}

// --- Helpers ---
const uid = () => Math.random().toString(36).slice(2,9)

// --- Data layer (Firebase) with Auth ---
function usePersistentState(userId){
  const [state, dispatch] = useReducer(reducer, initialState);

  // Load data from Firestore when userId changes
  useEffect(() => {
    if (!userId) {
      dispatch({ type: 'reset' }); // Reset state if no user is logged in
      return;
    }
    const docRef = doc(db, "schedules", userId);

    // Use onSnapshot for real-time updates
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        dispatch({ type: 'load', payload: docSnap.data() });
      } else {
        console.log("User document not found, will create a new one on first save.");
        dispatch({ type: 'reset' }); // Start with a clean slate
      }
    }, (error) => {
      console.error("Error listening to document:", error);
    });

    // Cleanup function when component unmounts or userId changes
    return () => unsubscribe();
  }, [userId]);

  // Save data to Firestore whenever state changes
  useEffect(() => {
    // Prevent writing initial empty state or if user is not logged in
    if (!userId || state === initialState) {
      return;
    }
    const docRef = doc(db, "schedules", userId);
    setDoc(docRef, state, { merge: true })
      .then(() => {
        // Optional: console.log("Document successfully written!");
      }).catch(error => {
        console.error("Error writing document: ", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองอีกครั้ง");
      });
  }, [state, userId]);

  return [state, dispatch];
}

function scheduleReminder(task){
  if(!('Notification' in window)) return
  if(Notification.permission !== 'granted') return
  if(!task.dueAt || !task.reminders?.length) return
  const due = new Date(task.dueAt)
  task.reminders.forEach(r=>{
    let when = new Date(due)
    if(r.type==='minutes') when = addMinutes(due, -r.amount)
    if(r.type==='hours') when = addHours(due, -r.amount)
    if(r.type==='days') when = addDays(due, -r.amount)
    const delay = when.getTime() - Date.now()
    if(delay>0){
      setTimeout(()=>{
        new Notification(`ใกล้ถึงกำหนด: ${task.title}`, { body: task.subjectName?`วิชา: ${task.subjectName}`:undefined })
      }, Math.min(delay, 2147483647)) // clamp
    }
  })
}

function timeLeftLabel(dueAt){
  const due = new Date(dueAt)
  const mins = Math.max(0, Math.round((due.getTime()-Date.now())/60000))
  if(mins>=1440){ const d = Math.floor(mins/1440); return `เหลือ ${d} วัน` }
  if(mins>=60){ const h = Math.floor(mins/60); return `เหลือ ${h} ชม.` }
  return `เหลือ ${mins} นาที`
}

function statusBadge(s){
  const map = { todo:'ยังไม่ทำ', doing:'กำลังทำ', done:'เสร็จแล้ว' }
  const cls = s==='done'? 'border-emerald-400 text-emerald-600 dark:text-emerald-300' : s==='doing'? 'border-amber-400 text-amber-600 dark:text-amber-300' : 'border-slate-300 text-slate-500 dark:text-slate-300'
  return <Badge className={cls}>{map[s]}</Badge>
}

function priorityBadge(p){
  const txt = p==='high'? 'ด่วน' : p==='med'? 'สำคัญ' : 'ทั่วไป'
  const cls = p==='high'? 'border-rose-400 text-rose-600 dark:text-rose-300' : p==='med'? 'border-indigo-400 text-indigo-600 dark:text-indigo-300' : 'border-slate-300 text-slate-500 dark:text-slate-300'
  return <Badge className={cls}>{txt}</Badge>
}

// --- Main App ---
export default function App(){
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [state, dispatch] = usePersistentState(user?.uid);
  const [view, setView] = useState('dashboard') // dashboard | subjects | calendar | settings
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [query, setQuery] = useState('')
  const [nowTick, setNowTick] = useState(0)

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // tick every 30s for countdown labels
  useEffect(()=>{ const t = setInterval(()=> setNowTick(x=>x+1), 30000); return ()=>clearInterval(t) },[])

  // theme
  useEffect(()=>{
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = state.theme==='dark' || (state.theme==='auto' && prefersDark)
    root.classList.toggle('dark', dark)
  },[state.theme])

  // derived
  const subjectsMap = useMemo(()=> Object.fromEntries(state.subjects.map(s=>[s.id,s])),[state.subjects])
  const tasks = useMemo(()=> state.tasks.map(t=> ({...t, subjectName: subjectsMap[t.subjectId]?.name, subjectColor: subjectsMap[t.subjectId]?.color})), [state.tasks, subjectsMap])

  // stats
  const todayTasks = tasks.filter(t=> t.dueAt && isToday(new Date(t.dueAt)))
  const progressToday = todayTasks.length? Math.round(todayTasks.reduce((a,t)=>a+(t.progress||0),0)/todayTasks.length) : (tasks.length? Math.round(tasks.reduce((a,t)=>a+(t.progress||0),0)/tasks.length):0)
  const doneCount = tasks.filter(t=>t.status==='done').length
  const lazyScore = Math.max(0, 100 - progressToday) // playful metric

  // due soon list
  const dueSoon = tasks
    .filter(t=> t.dueAt && t.status!=='done')
    .sort((a,b)=> new Date(a.dueAt) - new Date(b.dueAt))
    .slice(0,5)

  const filteredTasks = useMemo(()=>{
    let arr = tasks
    if(selectedSubject) arr = arr.filter(t=>t.subjectId===selectedSubject)
    if(query.trim()) arr = arr.filter(t=> (t.title+" "+(t.detail||'')).toLowerCase().includes(query.toLowerCase()))
    // sort: with due first ascending, then without due, then status
    arr = [...arr].sort((a,b)=>{
      const ad = a.dueAt?1:0, bd = b.dueAt?1:0
      if(ad!==bd) return bd - ad // with due first
      if(a.dueAt && b.dueAt){ return new Date(a.dueAt) - new Date(b.dueAt) }
      // fallback by priority then progress
      const priOrder = {high:0, med:1, low:2}
      if(priOrder[a.priority]!==priOrder[b.priority]) return priOrder[a.priority]-priOrder[b.priority]
      return (a.progress||0) - (b.progress||0)
    })
    return arr
  },[tasks, selectedSubject, query])

  // request notification permission once
  useEffect(()=>{
    if('Notification' in window && Notification.permission==='default'){
      // ask politely after short delay
      const h = setTimeout(()=> Notification.requestPermission(), 1000)
      return ()=>clearTimeout(h)
    }
  },[])

  // schedule reminders for tasks when added/updated
  useEffect(()=>{ tasks.forEach(scheduleReminder) }, [tasks])

  if (loadingAuth) {
    return <div className="h-screen flex items-center justify-center">กำลังโหลด...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100">
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        <Header user={user} state={state} dispatch={dispatch} view={view} setView={setView} />

        {view==='dashboard' && (
          <Dashboard
            state={state}
            tasks={tasks}
            dueSoon={dueSoon}
            progressToday={progressToday}
            lazyScore={lazyScore}
            setView={setView}
            setSelectedSubject={setSelectedSubject}
          />
        )}

        {view==='subjects' && (
          <SubjectsView state={state} dispatch={dispatch} tasks={tasks} filteredTasks={filteredTasks} setQuery={setQuery} query={query} setSelectedSubject={setSelectedSubject} selectedSubject={selectedSubject} />
        )}

        {view==='calendar' && (
          <CalendarView tasks={tasks} subjects={state.subjects} setView={setView} />
        )}

        {view==='settings' && (
          <Settings state={state} dispatch={dispatch} userId={user?.uid} />
        )}
      </div>
    </div>
  )
}

function Header({user, state, dispatch, view, setView}){
  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { key: 'subjects', label: 'รายวิชา', icon: Folder },
    { key: 'calendar', label: 'ปฏิทิน', icon: CalendarIcon },
    { key: 'settings', label: 'ตั้งค่า', icon: Layers },
  ];

  return (
    <header className="sticky top-0 z-30 w-full bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 mb-4 md:mb-6">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        {/* Top Bar: Logo and User Profile */}
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <motion.div initial={{rotate:-8, scale:0.9}} animate={{rotate:0, scale:1}} className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-xl font-bold">ME-U</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">บันทึกตารางงานแบบน่ารัก แต่จริงจัง</div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map(({ key, label, icon: Icon }) => (
              <GhostButton key={key} onClick={()=>setView(key)} className={view===key? 'bg-white dark:bg-slate-800' : ''}><Icon className="h-4 w-4"/>{label}</GhostButton>
            ))}
          </nav>

          {/* User Profile - always on top right */}
          <div className="flex items-center gap-2 text-sm">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || user.email} className="h-8 w-8 rounded-full" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="h-4 w-4 text-slate-500" />
              </div>
            )}
            <span className="hidden lg:inline">{user.displayName || user.email}</span>
            <GhostButton onClick={()=>signOut(auth)} className="!px-2"><LogOut className="h-4 w-4"/></GhostButton>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - below top bar */}
      <nav className="md:hidden p-2 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center justify-around">
          {navItems.map(({ key, label, icon: Icon }) => (
            <GhostButton key={key} onClick={()=>setView(key)} className={`flex-col h-16 w-20 ${view===key? 'bg-white dark:bg-slate-800' : ''}`}><Icon className="h-5 w-5"/><span className="text-xs">{label}</span></GhostButton>
          ))}
        </div>
      </nav>
    </header>
  )
}

function Dashboard({state, tasks, dueSoon, progressToday, lazyScore, setView, setSelectedSubject}){
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="md:col-span-2">
        <SectionTitle><TimerReset className="h-4 w-4"/> งานที่ใกล้ถึงกำหนด</SectionTitle>
        {dueSoon.length===0 && <div className="text-sm text-slate-500">ยังไม่มีงานเร่ง รีแล็กซ์ได้หน่อย 🎈</div>}
        <div className="space-y-3">
          {dueSoon.map(t=> (
            <div key={t.id} className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-xs text-slate-500 truncate">{t.subjectName || 'ไม่ระบุวิชา'} • ส่ง {format(new Date(t.dueAt), "d MMM yyyy HH:mm", {locale: th})} • {timeLeftLabel(t.dueAt)}</div>
                <div className="mt-2"><Progress value={t.progress||0} /></div>
              </div>
              <div className="flex items-center gap-2 ml-3">
                {priorityBadge(t.priority)}
                {statusBadge(t.status)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle><BarChart3 className="h-4 w-4"/> ภาพรวมวันนี้</SectionTitle>
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-24 h-24 rounded-full border-8 border-slate-200 dark:border-slate-800 flex items-center justify-center text-xl font-bold">
            {progressToday}%
          </div>
          <div className="text-sm">
            <div>ขยันวันนี้: <span className="font-semibold">{100 - lazyScore}%</span></div>
            <div className="text-slate-500">คะแนนขี้เกียจ: {lazyScore}</div>
            <div className="text-slate-500">งานเสร็จแล้ว: {tasks.filter(t=>t.status==='done').length}</div>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">Tip: ทำงานด่วนให้เสร็จก่อน แล้วค่อยเก็บงานย่อย 🧠</div>
        <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
          <Button onClick={()=>{ setView('subjects'); setSelectedSubject(null) }}><Plus className="h-4 w-4"/> เพิ่มงาน</Button>
          <GhostButton onClick={()=> setView('calendar')}><CalendarIcon className="h-4 w-4"/> ดูปฏิทิน</GhostButton>
        </div>
      </Card>
    </div>
  )
}

function SubjectsView({state, dispatch, tasks, filteredTasks, setQuery, query, selectedSubject, setSelectedSubject}){
  const nameRef = useRef('')
  const colorRef = useRef('#6366f1')

  const subjectTasksCount = (sid)=> tasks.filter(t=>t.subjectId===sid).length

  const addSubject = ()=>{
    const name = nameRef.current.value.trim()
    if(!name) return
    dispatch({type:'addSubject', payload:{id:uid(), name, color: colorRef.current.value}})
    nameRef.current.value = ''
  }

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card>
        <SectionTitle><Folder className="h-4 w-4"/> รายวิชา/โปรเจกต์</SectionTitle>
        <div className="space-y-2 mb-3 max-h-72 overflow-auto pr-1">
          {state.subjects.map(s=> (
            <div key={s.id} className={`p-2 rounded-xl border flex items-center justify-between ${selectedSubject===s.id? 'bg-slate-50 dark:bg-slate-800' : ''}`}
                 onClick={()=> setSelectedSubject(s.id)}>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{background:s.color}} />
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-slate-500">{subjectTasksCount(s.id)} งาน</div>
              </div>
              <div className="flex items-center gap-1">
                <GhostButton onClick={(e)=>{e.stopPropagation(); const name = prompt('แก้ไขชื่อรายวิชา', s.name); if(name){ dispatch({type:'updateSubject', payload:{...s, name}}) }}}><Pencil className="h-4 w-4"/></GhostButton>
                <GhostButton onClick={(e)=>{e.stopPropagation(); if(confirm('ลบรายวิชานี้และงานทั้งหมด?')) dispatch({type:'deleteSubject', id:s.id})}}><Trash2 className="h-4 w-4"/></GhostButton>
              </div>
            </div>
          ))}
          {state.subjects.length===0 && <div className="text-xs text-slate-500">ยังไม่มีรายวิชา กดเพิ่มด้านล่างได้เลย</div>}
        </div>
        <div className="space-y-2">
          <Input placeholder="ชื่อรายวิชา/โปรเจกต์" ref={nameRef} className="w-full" />
          <div className="flex items-center gap-2">
            <Input type="color" defaultValue="#6366f1" ref={colorRef} className="w-16 h-10 p-1" />
            <Button onClick={addSubject} className="flex-1"><Plus className="h-4 w-4"/> เพิ่มรายวิชา</Button>
          </div>
        </div>
      </Card>

      <div className="md:col-span-2 space-y-3">
        <Card>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <SectionTitle><ListTodo className="h-4 w-4"/> งานทั้งหมด {selectedSubject? `ของวิชา: ${state.subjects.find(s=>s.id===selectedSubject)?.name}`: ''}</SectionTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="ค้นหางาน..." value={query} onChange={e=>setQuery(e.target.value)} className="flex-1 md:w-auto md:w-64" />
              <AddTaskButton subjects={state.subjects} onAdd={(payload)=> dispatch({type:'addTask', payload})} />
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {filteredTasks.map(t=> (
            <TaskItem key={t.id} task={t} onUpdate={(p)=>dispatch({type:'updateTask', payload:p})} onDelete={(id)=>dispatch({type:'deleteTask', id})} />
          ))}
          {filteredTasks.length===0 && <Card className="text-sm text-slate-500">ยังไม่มีงาน ลองเพิ่มงานใหม่ดูน้า</Card>}
        </div>
      </div>
    </div>
  )
}

function AddTaskButton({subjects, onAdd}){
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    subjectId: subjects[0]?.id || '',
    title:'', detail:'', dueAt:'', link:'', status:'todo', progress:0, priority:'med', category:'เรียน', reminders:[]
  })
  useEffect(()=>{ if(subjects.length && !form.subjectId) setForm(f=>({...f, subjectId: subjects[0].id})) },[subjects])

  const submit = ()=>{
    if(!form.title) return alert('ใส่ชื่องานก่อนนะ')
    const payload = { ...form, id:uid(), createdAt:Date.now(), updatedAt:Date.now(), dueAt: form.dueAt? new Date(form.dueAt).toISOString(): null }
    onAdd(payload)
    setOpen(false)
    setForm(f=>({...f, title:'', detail:'', dueAt:'', link:'', status:'todo', progress:0, reminders:[]}))
  }

  return (
    <>
      <Button onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/> เพิ่มงาน</Button>
      <AnimatePresence>
        {open && (
          <Modal onClose={()=>setOpen(false)}>
            <div className="text-lg font-semibold mb-2">เพิ่มงานใหม่</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs">รายวิชา</label>
                <Select value={form.subjectId} onChange={e=>setForm({...form, subjectId:e.target.value})}>
                  {subjects.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-xs">ความสำคัญ</label>
                <Select value={form.priority} onChange={e=>setForm({...form, priority:e.target.value})}>
                  <option value="high">ด่วน</option>
                  <option value="med">สำคัญ</option>
                  <option value="low">ทั่วไป</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">ชื่องาน</label>
                <Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="เช่น Assignment บทที่ 3" className="w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">รายละเอียด</label>
                <Textarea rows={3} value={form.detail} onChange={e=>setForm({...form, detail:e.target.value})} placeholder="โน้ตย่อย หรือ checklist คร่าวๆ" />
              </div>
              <div>
                <label className="text-xs">กำหนดส่ง (ว่างได้)</label>
                <Input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form, dueAt:e.target.value})} className="w-full" />
              </div>
              <div>
                <label className="text-xs">ลิงก์ที่เกี่ยวข้อง</label>
                <Input value={form.link} onChange={e=>setForm({...form, link:e.target.value})} placeholder="วางลิงก์เอกสาร" className="w-full" />
              </div>
              <div>
                <label className="text-xs">หมวดหมู่</label>
                <Select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
                  <option value="เรียน">เรียน</option>
                  <option value="งาน">งาน</option>
                  <option value="ส่วนตัว">ส่วนตัว</option>
                </Select>
              </div>
              <div>
                <label className="text-xs">สถานะ</label>
                <Select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
                  <option value="todo">ยังไม่ทำ</option>
                  <option value="doing">กำลังทำ</option>
                  <option value="done">เสร็จแล้ว</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">เตือนก่อน (เลือกหลายอันได้)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    {label:'15 นาที', type:'minutes', amount:15},
                    {label:'1 ชม.', type:'hours', amount:1},
                    {label:'1 วัน', type:'days', amount:1},
                  ].map(r=> (
                    <GhostButton key={r.label} onClick={()=>{
                      setForm(f=> ({...f, reminders: f.reminders.some(x=>x.type===r.type && x.amount===r.amount) ? f.reminders.filter(x=>!(x.type===r.type && x.amount===r.amount)) : [...f.reminders, r]}))
                    }} className={form.reminders.some(x=>x.type===r.type && x.amount===r.amount)? 'bg-slate-50 dark:bg-slate-800' : ''}>
                      <Bell className="h-4 w-4"/> {r.label}
                    </GhostButton>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">ความคืบหน้า: {form.progress}%</label>
                <input type="range" min={0} max={100} value={form.progress} onChange={e=>setForm({...form, progress: Number(e.target.value)})} className="w-full" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <GhostButton onClick={()=>setOpen(false)}>ยกเลิก</GhostButton>
              <Button onClick={submit}><Check className="h-4 w-4"/> บันทึก</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

function TaskItem({task, onUpdate, onDelete}){
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({...task, dueAt: task.dueAt? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : ''})
  useEffect(()=> setForm({...task, dueAt: task.dueAt? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : ''}), [task])

  const save = ()=>{
    const payload = {...form, dueAt: form.dueAt? new Date(form.dueAt).toISOString(): null}
    onUpdate(payload)
    setEditing(false)
  }

  const handleStatusChange = () => {
    const statuses = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    let newProgress = task.progress || 0;
    if (nextStatus === 'done') {
      newProgress = 100;
    } else if (task.status === 'done' && nextStatus === 'todo') {
      // When cycling from 'done' back to 'todo', reset progress.
      newProgress = 0;
    }

    onUpdate({ ...task, status: nextStatus, progress: newProgress });
  };

  return (
    <Card className="">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium truncate">{task.title}</div>
            {priorityBadge(task.priority)}
            <button onClick={handleStatusChange} className="transition-transform active:scale-95" title="คลิกเพื่อเปลี่ยนสถานะ">
              {statusBadge(task.status)}
            </button>
            {task.subjectName && <Badge className="border-slate-300 text-slate-500"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{background:task.subjectColor}}/> {task.subjectName}</Badge>}
          </div>
          {task.detail && <div className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{task.detail}</div>}
          <div className="mt-2">
            <Progress value={task.progress||0} />
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              {task.dueAt ? (
                <>
                  <CalendarIcon className="h-3 w-3"/> ส่ง {format(new Date(task.dueAt), "d MMM yyyy HH:mm", {locale: th})}
                  <span>• {isPast(new Date(task.dueAt))? 'เลยกำหนดแล้ว' : timeLeftLabel(task.dueAt)}</span>
                </>
              ) : <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> ไม่มีวันส่ง</span>}
              {task.link && <a href={task.link} target="_blank" className="inline-flex items-center gap-1 underline"><LinkIcon className="h-3 w-3"/> ลิงก์งาน</a>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton onClick={()=> setEditing(true)}><Pencil className="h-4 w-4"/></GhostButton>
          <GhostButton onClick={()=> onDelete(task.id)}><Trash2 className="h-4 w-4"/></GhostButton>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <Modal onClose={()=>setEditing(false)}>
            <div className="text-lg font-semibold mb-2">อัปเดตงาน</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs">สถานะ</label>
                <Select value={form.status} onChange={e=>setForm({...form, status:e.target.value})}>
                  <option value="todo">ยังไม่ทำ</option>
                  <option value="doing">กำลังทำ</option>
                  <option value="done">เสร็จแล้ว</option>
                </Select>
              </div>
              <div>
                <label className="text-xs">ความสำคัญ</label>
                <Select value={form.priority} onChange={e=>setForm({...form, priority:e.target.value})}>
                  <option value="high">ด่วน</option>
                  <option value="med">สำคัญ</option>
                  <option value="low">ทั่วไป</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">ชื่องาน</label>
                <Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} className="w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">รายละเอียด</label>
                <Textarea rows={3} value={form.detail||''} onChange={e=>setForm({...form, detail:e.target.value})} />
              </div>
              <div>
                <label className="text-xs">กำหนดส่ง (ว่างได้)</label>
                <Input type="datetime-local" value={form.dueAt||''} onChange={e=>setForm({...form, dueAt:e.target.value})} className="w-full" />
              </div>
              <div>
                <label className="text-xs">ลิงก์</label>
                <Input value={form.link||''} onChange={e=>setForm({...form, link:e.target.value})} className="w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">เตือนก่อน</label>
                <ReminderPicker value={form.reminders||[]} onChange={(reminders)=> setForm({...form, reminders})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">ความคืบหน้า: {form.progress}%</label>
                <input type="range" min={0} max={100} value={form.progress||0} onChange={e=>setForm({...form, progress: Number(e.target.value)})} className="w-full" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <GhostButton onClick={()=>setEditing(false)}>ยกเลิก</GhostButton>
              <Button onClick={save}><Check className="h-4 w-4"/> บันทึก</Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </Card>
  )
}

function ReminderPicker({value, onChange}){
  const items = [
    {label:'15 นาที', type:'minutes', amount:15},
    {label:'30 นาที', type:'minutes', amount:30},
    {label:'1 ชม.', type:'hours', amount:1},
    {label:'3 ชม.', type:'hours', amount:3},
    {label:'1 วัน', type:'days', amount:1},
  ]
  const toggle = (it)=>{
    const exists = value.some(x=>x.type===it.type && x.amount===it.amount)
    onChange(exists? value.filter(x=>!(x.type===it.type && x.amount===it.amount)) : [...value, it])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it=> (
        <GhostButton key={it.label} onClick={()=>toggle(it)} className={value.some(x=>x.type===it.type && x.amount===it.amount)? 'bg-slate-50 dark:bg-slate-800' : ''}>
          <Bell className="h-4 w-4"/> {it.label}
        </GhostButton>
      ))}
    </div>
  )
}

function CalendarView({tasks, subjects, setView}){
  const [cursor, setCursor] = useState(new Date())
  const start = startOfWeek(startOfMonth(cursor), {weekStartsOn:1})
  const end = endOfWeek(endOfMonth(cursor), {weekStartsOn:1})
  const days = []
  for(let d=new Date(start); d<=end; d=add(d,{days:1})) days.push(new Date(d))

  const byDay = tasks.reduce((acc,t)=>{
    if(!t.dueAt) return acc
    const k = format(new Date(t.dueAt), 'yyyy-MM-dd')
    acc[k] = acc[k] || []
    acc[k].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <SectionTitle><CalendarIcon className="h-4 w-4"/> ปฏิทิน</SectionTitle>
          <div className="flex items-center gap-2">
            <GhostButton onClick={()=> setCursor(add(cursor,{months:-1}))}><ChevronLeft className="h-4 w-4"/></GhostButton>
            <div className="text-sm font-medium w-40 text-center">{format(cursor, 'MMMM yyyy', {locale: th})}</div>
            <GhostButton onClick={()=> setCursor(add(cursor,{months:1}))}><ChevronRight className="h-4 w-4"/></GhostButton>
          </div>
        </div>
      </Card>
      <Card>
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2 min-w-[21rem]">
            {["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map(d=>(<div key={d}>{d}</div>))}
          </div>
          <div className="grid grid-cols-7 gap-1 min-w-[21rem]">
          {days.map(d=>{
            const key = format(d,'yyyy-MM-dd')
            const items = byDay[key]||[]
            return (
              <div key={key} className={`min-h-28 rounded-2xl border p-2 ${isSameMonth(d,cursor)? 'border-slate-200 dark:border-slate-700' : 'opacity-40 border-dashed'}`}>
                <div className={`text-xs mb-1 ${isSameDay(d,new Date())? 'font-semibold text-indigo-600' : ''}`}>{format(d,'d')}</div>
                <div className="space-y-1">
                  {items.slice(0,2).map(t=> (
                    <div key={t.id} className="text-[11px] px-2 py-1 rounded-lg border truncate" style={{borderColor: t.subjectColor||'#e2e8f0'}}>
                      {t.title}
                    </div>
                  ))}
                  {items.length>2 && <div className="text-[11px] text-slate-500 mt-1">+{items.length-2} งาน</div>}
                </div>
              </div>
            )
          })}
          </div>
        </div>
      </Card>
    </div>
  )
}

function Settings({state, dispatch, userId}){
  const fileRef = useRef(null)

  const exportData = ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'meu-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const importData = (e)=>{
    const file = e.target.files?.[0]
    if(!file) return
    const reader = new FileReader()
    reader.onload = (ev)=>{
      try{
        const data = JSON.parse(ev.target.result);
        dispatch({type: 'load', payload: data});
        alert('นำเข้าข้อมูลสำเร็จ!');
      }catch{
        alert('ไฟล์ไม่ถูกต้อง');
      }
    }
    reader.readAsText(file)
  }

  const handleClearData = () => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      if (!userId) return;
      const docRef = doc(db, "schedules", userId);
      // เขียนทับข้อมูลบน Firebase ด้วย state เริ่มต้น (ว่างเปล่า)
      setDoc(docRef, initialState)
        .then(() => {
          alert('ล้างข้อมูลสำเร็จแล้ว!');
          // onSnapshot จะอัปเดตหน้าจอให้โดยอัตโนมัติ
        })
        .catch(error => {
          console.error("Error clearing document: ", error);
          alert("เกิดข้อผิดพลาดในการล้างข้อมูล");
        });
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <SectionTitle>ธีม</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'auto'})} className={state.theme==='auto'? 'bg-slate-50 dark:bg-slate-800':''}><RefreshCw className="h-4 w-4"/> อัตโนมัติ</GhostButton>
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'light'})} className={state.theme==='light'? 'bg-slate-50 dark:bg-slate-800':''}><Sun className="h-4 w-4"/> สว่าง</GhostButton>
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'dark'})} className={state.theme==='dark'? 'bg-slate-50 dark:bg-slate-800':''}><Moon className="h-4 w-4"/> มืด</GhostButton>
        </div>
      </Card>

      <Card>
        <SectionTitle>สำรอง/กู้คืน</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          <Button onClick={exportData}><Download className="h-4 w-4"/> ส่งออก JSON</Button>
          <GhostButton onClick={()=>fileRef.current?.click()}><Upload className="h-4 w-4"/> นำเข้า JSON</GhostButton>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
        </div>
        <div className="mt-3 text-xs text-slate-500">ข้อมูลจะถูกบันทึกออนไลน์อัตโนมัติ</div>
      </Card>

      <Card className="md:col-span-2">
        <SectionTitle>ล้างข้อมูลทั้งหมด</SectionTitle>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleClearData}>ล้างข้อมูล</Button>
      </Card>
    </div>
  )
}

function LoginScreen() {
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Error signing in with Google", error);
      alert("เกิดข้อผิดพลาดในการล็อกอิน: " + error.message);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">ยินดีต้อนรับสู่ ME-U Schedule</h1>
      <Button onClick={handleSignIn}><User className="h-4 w-4" /> เข้าสู่ระบบด้วย Google</Button>
    </div>
  );
}

function Modal({children, onClose}){
  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onClose() }

    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  },[onClose])

  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div initial={{y:30, opacity:0}} animate={{y:0, opacity:1}} exit={{y:20, opacity:0}} className="fixed inset-x-0 top-14 md:top-28 mx-auto w-[95%] md:w-[720px] z-50">
        <Card className="p-5" onClick={(e)=>e.stopPropagation()}>
          {children}
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
