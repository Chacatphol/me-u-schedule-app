import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { format, isToday, isPast, addMinutes, addHours, addDays, differenceInMinutes, differenceInHours, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, add, isSameMonth, isSameDay, subDays } from "date-fns";
import { createPortal } from "react-dom";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Plus, Calendar as CalendarIcon, Bell, Trash2, Pencil, Check, CheckCircle, TimerReset, Upload, Download, ChevronLeft, ChevronRight, Link as LinkIcon, ListTodo, Sparkles, Folder, LayoutGrid, Layers, RefreshCw, Sun, Moon, BarChart3, LogOut, User, Flame, TrendingUp, Search, Filter, Menu } from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth } from "./firebase"; // Import auth
import { Button, GhostButton, Input, Textarea, Select, Card, SectionTitle, Badge, Progress } from './components/ui.jsx';

// --- Data layer ---
const initialState = {
  theme: 'auto',
  subjects: [], // {id, name, color}
  tasks: [], // {id, subjectId, title, detail, dueAt|null, link, status:'todo'|'doing'|'done', progress:0-100, priority:'low'|'med'|'high', category:'เรียน'|'งาน'|'ส่วนตัว', reminders:[{type:'minutes'|'hours'|'days', amount:number}], createdAt, updatedAt}
  lastLogin: null,
  loginStreak: 0,
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
        lastLogin: loaded.lastLogin || null,
        loginStreak: loaded.loginStreak || 0,
      };
    }
    case 'addSubject': return { ...state, subjects:[...state.subjects, action.payload] }
    case 'updateSubject': return { ...state, subjects: state.subjects.map(s=>s.id===action.payload.id? {...s,...action.payload}:s) }
    case 'deleteSubject': return { ...state, subjects: state.subjects.filter(s=>s.id!==action.id), tasks: state.tasks.filter(t=>t.subjectId!==action.id) }
    case 'addTask': return { ...state, tasks:[...state.tasks, action.payload] }
    case 'updateTask': return { ...state, tasks: state.tasks.map(t=>t.id===action.payload.id? {...t,...action.payload, updatedAt:Date.now()}:t) }
    case 'deleteTask': return { ...state, tasks: state.tasks.filter(t=>t.id!==action.id) }
    case 'setTheme': return { ...state, theme: action.value }
    case 'updateLoginStreak': return { ...state, lastLogin: action.payload.lastLogin, loginStreak: action.payload.loginStreak }
    case 'reset': return initialState
    default: return state
  }
}

// --- Helpers ---
const uid = () => Math.random().toString(36).slice(2,9)
const hexToRgba = (hex, alpha = 1) => {
  if (!hex || !/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) return '';
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  return `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${alpha})`;
};

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
        const data = docSnap.data();
        dispatch({ type: 'load', payload: data });

        // Check and update login streak
        const today = format(new Date(), 'yyyy-MM-dd');
        const lastLoginDate = data.lastLogin ? format(new Date(data.lastLogin), 'yyyy-MM-dd') : null;
        
        if (lastLoginDate !== today) {
            const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd');
            const newStreak = lastLoginDate === yesterday ? (data.loginStreak || 0) + 1 : 1;
            dispatch({ type: 'updateLoginStreak', payload: { lastLogin: new Date().toISOString(), loginStreak: newStreak } });
        }

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

function getUrgencyStyle(dueAt) {
  if (!dueAt) return { gradientClass: '', textColorClass: 'text-slate-500', showFire: false };

  const hoursLeft = differenceInHours(new Date(dueAt), new Date());

  if (hoursLeft <= 6) { // Very urgent, less than 6 hours or overdue
    return { gradientClass: 'bg-gradient-to-b from-red-500 to-orange-400', textColorClass: 'text-red-500 dark:text-red-400', showFire: true };
  }
  if (hoursLeft <= 24) { // Urgent, less than 24 hours
    return { gradientClass: 'bg-gradient-to-b from-orange-500 to-amber-400', textColorClass: 'text-orange-500 dark:text-orange-400', showFire: false };
  }
  if (hoursLeft <= 168) { // Upcoming, less than 7 days
    return { gradientClass: 'bg-gradient-to-b from-amber-400 to-yellow-300', textColorClass: 'text-amber-500 dark:text-amber-400', showFire: false };
  }
  // Not urgent
  return { gradientClass: '', textColorClass: 'text-slate-500', showFire: false };
}

// --- Main App ---
export default function App(){
  const [user, setUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [state, dispatch] = usePersistentState(user?.uid);
  const [view, setView] = useState('dashboard') // dashboard | tasks | calendar | settings
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
    return <div className="h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">กำลังโหลด...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { key: 'tasks', label: 'Tasks', icon: ListTodo },
    { key: 'calendar', label: 'ปฏิทิน', icon: CalendarIcon },
    { key: 'settings', label: 'ตั้งค่า', icon: Layers },
  ];

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-950 font-sans">
      {/* Aurora Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-purple-400/20 dark:bg-purple-500/10 rounded-full filter blur-3xl animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 dark:bg-indigo-500/10 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] bg-pink-400/20 dark:bg-pink-500/10 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
      </div>
      
      <div className="md:flex pb-24 md:pb-0">
        {/* Sidebar for Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg border-r border-slate-200/50 dark:border-slate-800/50 p-4">
          <div className="flex items-center gap-3 mb-8">
            <motion.div initial={{rotate:-8, scale:0.9}} animate={{rotate:0, scale:1}} className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="h-5 w-5" />
            </motion.div>
            <div>
              <div className="text-xl font-bold font-display">ME-U</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Your Schedule</div>
            </div>
          </div>
          <nav className="flex-1 space-y-2">
            {navItems.map(({ key, label, icon: Icon }) => (
              <a key={key} href="#" onClick={(e) => { e.preventDefault(); setView(key); }}
                 className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${view === key ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md' : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'}`}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="mt-auto">
            <div className="flex items-center gap-2 text-sm p-2 rounded-xl bg-slate-200/50 dark:bg-slate-800/50">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || user.email} className="h-8 w-8 rounded-full" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-slate-300 dark:bg-slate-700 flex items-center justify-center">
                  <User className="h-4 w-4 text-slate-500" />
                </div>
              )}
              <span className="truncate flex-1 font-medium">{user.displayName || user.email}</span>
              <GhostButton onClick={() => signOut(auth)} className="!px-2"><LogOut className="h-4 w-4" /></GhostButton>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8">
          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between mb-4">
             <div className="flex items-center gap-3">
              <motion.div initial={{rotate:-8, scale:0.9}} animate={{rotate:0, scale:1}} className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="h-5 w-5" />
              </motion.div>
              <div className="text-xl font-bold font-display">ME-U</div>
            </div>
            <img src={user.photoURL} alt={user.displayName || user.email} className="h-8 w-8 rounded-full" />
          </header>

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.2 }}>
              {view === 'dashboard' && <Dashboard state={state} tasks={tasks} dueSoon={dueSoon} progressToday={progressToday} lazyScore={lazyScore} setView={setView} setSelectedSubject={setSelectedSubject} />}
              {view === 'tasks' && <TasksView state={state} dispatch={dispatch} tasks={tasks} filteredTasks={filteredTasks} setQuery={setQuery} query={query} selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject} />}
              {view === 'calendar' && <CalendarView tasks={tasks} subjects={state.subjects} setView={setView} />}
              {view === 'settings' && <Settings state={state} dispatch={dispatch} userId={user?.uid} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/70 dark:bg-slate-950/70 backdrop-blur-lg border-t border-slate-200/50 dark:border-slate-800/50 p-2">
        <div className="flex items-center justify-around">
          {navItems.map(({ key, label, icon: Icon }) => (
            <a key={key} href="#" onClick={(e) => { e.preventDefault(); setView(key); }}
               className={`flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-all ${view === key ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
              <Icon className="h-6 w-6" />
              <span className="text-xs mt-1">{label}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function Dashboard({state, tasks, dueSoon, progressToday, lazyScore, setView, setSelectedSubject}){
  // Calculate stats
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'done').length;
  const doingTasks = tasks.filter(t => t.status === 'doing').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;
  const donePercentage = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const tasksByPriority = tasks.reduce((acc, task) => {
    acc[task.priority] = (acc[task.priority] || 0) + 1;
    return acc;
  }, { high: 0, med: 0, low: 0 });

  const tasksCompletedLast7Days = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), i);
    const formattedDate = format(date, 'MMM d');
    const count = tasks.filter(t => t.status === 'done' && t.updatedAt && format(new Date(t.updatedAt), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')).length;
    return { date: formattedDate, count };
  }).reverse();

  const priorityData = [
    { name: 'ด่วน', count: tasksByPriority.high, fill: '#ef4444' },
    { name: 'สำคัญ', count: tasksByPriority.med, fill: '#6366f1' },
    { name: 'ทั่วไป', count: tasksByPriority.low, fill: '#64748b' },
  ];

  return (
    <div className="space-y-6">
      {/* Dashboard Overview */}
      <Card>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Left Side - Combined Stats */}
          <div className="space-y-6">
            {/* Streak and Progress Combined */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                    <Flame className="h-8 w-8 text-white"/>
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-800 rounded-full px-2 py-0.5 border border-orange-200 dark:border-orange-900 shadow-md">
                    <div className="text-sm font-semibold text-orange-500">{state.loginStreak}d</div>
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-lg">Streak ต่อเนื่อง</div>
                  <div className="text-sm text-slate-500">เข้าใช้งานทุกวัน!</div>
                </div>
              </div>
              {/* Today's Progress Ring */}
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div>
                    <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{progressToday}%</div>
                    <div className="text-xs text-slate-500 text-center">วันนี้</div>
                  </div>
                </div>
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    strokeWidth="7"
                    className="stroke-slate-200 dark:stroke-slate-700"
                  />
                  <circle
                    cx="40" cy="40" r="36"
                    fill="none"
                    strokeWidth="7"
                    strokeDasharray={`${2 * Math.PI * 36}`}
                    strokeDashoffset={`${(2 * Math.PI * 36) * (1 - progressToday / 100)}`}
                    className="stroke-indigo-500 transition-all duration-1000"
                    style={{ strokeLinecap: 'round' }}
                  />
                </svg>
              </div>
            </div>

            {/* Task Status Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border border-emerald-200 dark:border-emerald-800 text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{doneTasks}</div>
                <div className="text-sm text-emerald-800 dark:text-emerald-300">เสร็จแล้ว</div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30 border border-amber-200 dark:border-amber-800 text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{doingTasks}</div>
                <div className="text-sm text-amber-800 dark:text-amber-300">กำลังทำ</div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30 border border-slate-200 dark:border-slate-800 text-center">
                <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{todoTasks}</div>
                <div className="text-sm text-slate-800 dark:text-slate-300">ยังไม่ทำ</div>
              </div>
            </div>
          </div>

          {/* Right Side - Performance Stats */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-lg font-semibold">ประสิทธิภาพโดยรวม</div>
                <div className="text-sm text-slate-500">จากงานทั้งหมด {totalTasks} งาน</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{donePercentage}%</div>
                <div className="text-sm text-slate-500">ความสำเร็จ</div>
              </div>
            </div>

            {/* Productivity Score */}
            <div className="mt-6 h-64">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium">ความขยันวันนี้</div>
                <div className="text-sm font-semibold text-indigo-500">{100 - lazyScore}%</div>
              </div>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                  style={{ width: `${100 - lazyScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Upcoming Tasks */}
      <Card>
        <SectionTitle><TimerReset className="h-4 w-4"/> งานที่ใกล้ถึงกำหนด</SectionTitle>
        {dueSoon.length===0 && <div className="text-sm text-slate-500">ยังไม่มีงานเร่ง รีแล็กซ์ได้หน่อย 🎈</div>}
        <div className="space-y-3">
          {dueSoon.map(t=> {
            const urgency = getUrgencyStyle(t.dueAt);
            return (
            <div key={t.id} className="relative p-3 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between overflow-hidden hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div className={`absolute inset-y-0 left-0 w-1.5 ${urgency.gradientClass}`} />
              <div className="min-w-0 pl-2 flex-grow">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {urgency.showFire && <Flame className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <span>{t.title}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {t.subjectName || 'ไม่ระบุวิชา'} • ส่ง {format(new Date(t.dueAt), "d MMM yyyy HH:mm", {locale: th})}
                </div>
                <div className={`text-xs font-semibold ${urgency.textColorClass}`}>
                  {isPast(new Date(t.dueAt)) ? 'เลยกำหนดแล้ว' : timeLeftLabel(t.dueAt)}
                </div>
                <div className="mt-2"><Progress value={t.progress||0} /></div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-3 flex-shrink-0">
                {statusBadge(t.status)}
                {priorityBadge(t.priority)}
              </div>
            </div>
            )
          })}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4 justify-center md:justify-start">
        <Button onClick={()=>{ setView('tasks'); setSelectedSubject(null) }}><Plus className="h-4 w-4"/> เพิ่มงาน</Button>
        <GhostButton onClick={()=> setView('calendar')}><CalendarIcon className="h-4 w-4"/> ดูปฏิทิน</GhostButton>
      </div>
    </div>
  )
}

function TasksView({state, dispatch, tasks, filteredTasks, setQuery, query, selectedSubject, setSelectedSubject}){
  const nameRef = useRef(null);
  const colorRef = useRef(null);
  const [isAddingSubject, setAddingSubject] = useState(false);

  const subjectTasksCount = useMemo(() => Object.fromEntries(state.subjects.map(s => [s.id, tasks.filter(t => t.subjectId === s.id).length])), [tasks, state.subjects]);

  const addSubject = ()=>{
    const name = nameRef.current.value.trim();
    if(!name) return;
    dispatch({type:'addSubject', payload:{id:uid(), name, color: colorRef.current.value}});
    nameRef.current.value = '';
    setAddingSubject(false);
  };

  const handleEditSubject = () => {
    if (!selectedSubject) return;
    const subject = state.subjects.find(s => s.id === selectedSubject);
    if (subject) {
      const name = prompt('แก้ไขชื่อรายวิชา', subject.name);
      if (name && name.trim()) {
        dispatch({ type: 'updateSubject', payload: { ...subject, name: name.trim() } });
      }
    }
  };

  const handleDeleteSubject = () => {
    if (!selectedSubject) return;
    if (confirm('ลบรายวิชานี้และงานทั้งหมด?')) {
      dispatch({ type: 'deleteSubject', id: selectedSubject });
      setSelectedSubject(null); // Clear selection after deletion
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold font-display">Tasks</h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="ค้นหางาน..." value={query} onChange={e => setQuery(e.target.value)} className="pl-9 w-full" />
          </div>
          <AddTaskButton subjects={state.subjects} onAdd={(payload) => dispatch({ type: 'addTask', payload })} />
        </div>
      </div>

      {/* Subject Filters & Management */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Filter className="h-4 w-4" />
            <span>Filter by Subject</span>
          </div>
          <GhostButton onClick={() => setAddingSubject(true)} className="!px-2"><Plus className="h-4 w-4" /></GhostButton>
        </div>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={() => setSelectedSubject(null)} className={!selectedSubject ? 'bg-white dark:bg-slate-800' : ''}>All Subjects</GhostButton>
          {state.subjects.map(s => (
            <GhostButton key={s.id} onClick={() => setSelectedSubject(s.id)} className={`relative group ${selectedSubject === s.id ? 'bg-white dark:bg-slate-800' : ''}`}>
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
              {s.name}
              <Badge className="ml-1 !px-1.5">{subjectTasksCount[s.id] || 0}</Badge>
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded-md text-xs">
                <button onClick={(e) => { e.stopPropagation(); handleEditSubject(s.id); }} className="p-1 hover:bg-slate-700 rounded-md"><Pencil className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSubject(s.id); }} className="p-1 hover:bg-slate-700 rounded-md"><Trash2 className="h-3 w-3" /></button>
              </div>
            </GhostButton>
          ))}
        </div>
      </Card>

      {/* Task List */}
      <div className="space-y-4">
        <AnimatePresence>
          {filteredTasks.map(t=> (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <TaskItem task={t} onUpdate={(p)=>dispatch({type:'updateTask', payload:p})} onDelete={(id)=>dispatch({type:'deleteTask', id})} />
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredTasks.length === 0 && <div className="text-center text-slate-500 py-10">ไม่มีงานที่ตรงกับเงื่อนไข</div>}
      </div>

      <AnimatePresence>
        {isAddingSubject && (
          <Modal onClose={() => setAddingSubject(false)}>
            <div className="text-lg font-semibold mb-2">เพิ่มรายวิชาใหม่</div>
            <div className="space-y-3">
              <Input placeholder="ชื่อรายวิชา/โปรเจกต์" ref={nameRef} />
              <div className="flex items-center gap-2">
                <Input type="color" defaultValue="#6366f1" ref={colorRef} className="w-16 h-10 p-1" />
                <Button onClick={addSubject} className="flex-1"><Plus className="h-4 w-4" /> เพิ่ม</Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
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
                <Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="เช่น Assignment บทที่ 3" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">รายละเอียด</label>
                <Textarea value={form.detail} onChange={e=>setForm({...form, detail:e.target.value})} placeholder="โน้ตย่อย หรือ checklist คร่าวๆ" />
              </div>
              <div>
                <label className="text-xs">กำหนดส่ง (ว่างได้)</label>
                <Input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form, dueAt:e.target.value})} />
              </div>
              <div>
                <label className="text-xs">ลิงก์ที่เกี่ยวข้อง</label>
                <Input value={form.link} onChange={e=>setForm({...form, link:e.target.value})} placeholder="วางลิงก์เอกสาร" />
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
              <GhostButton onClick={()=>setOpen(false)}>ยกเลิก</GhoastButton>
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

  const [showDetailModal, setShowDetailModal] = useState(false)
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

  // สร้างคลาสสำหรับไล่เฉดสีตามสถานะของงาน
  const statusGradientClass =
    task.status === 'done'
      ? 'bg-gradient-to-l from-emerald-400/10' // สีเขียวสำหรับ "เสร็จแล้ว"
      : task.status === 'doing'
      ? 'bg-gradient-to-l from-amber-400/10' // สีส้มสำหรับ "กำลังทำ"
      : ''; // ไม่มีสีสำหรับ "ยังไม่ทำ"

  const needsTruncationButton = task.detail && task.detail.length > 150; // Heuristic for showing "View More"

  return (
    <Card className={statusGradientClass}>
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
          {task.detail && (
            <>
              <div className={`text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap line-clamp-4`}>
                {task.detail}
              </div>
              {task.detail && task.detail.length > 150 && ( // Check if truncation is needed
                <button onClick={() => setShowDetailModal(true)} className="text-xs text-indigo-500 hover:underline mt-1">
                  ดูรายละเอียด
                </button>
              )}
            </>
          )}
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
                <Textarea value={form.detail||''} onChange={e=>setForm({...form, detail:e.target.value})} />
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
        {showDetailModal && (
          <TaskDetailModal task={task} onClose={() => setShowDetailModal(false)} />
        )}
      </AnimatePresence>
    </Card>
  )
}

function TaskDetailModal({ task, onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="text-lg font-semibold mb-2">รายละเอียดงาน</div>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-slate-500">ชื่องาน</label>
          <div className="font-medium">{task.title}</div>
        </div>
        {task.detail && (
          <div>
            <label className="text-xs text-slate-500">รายละเอียด</label>
            <div className="whitespace-pre-wrap">{task.detail}</div>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500">กำหนดส่ง</label>
          <div className="flex items-center gap-2">
            {task.dueAt ? (
              <>
                <CalendarIcon className="h-4 w-4 text-slate-500"/>
                <span>{format(new Date(task.dueAt), "d MMM yyyy HH:mm", {locale: th})}</span>
                <span className="text-sm text-slate-500">• {isPast(new Date(task.dueAt)) ? 'เลยกำหนดแล้ว' : timeLeftLabel(task.dueAt)}</span>
              </>
            ) : (
              <span className="text-slate-500">ไม่มีวันส่ง</span>
            )}
          </div>
        </div>
        {task.link && (
          <div>
            <label className="text-xs text-slate-500">ลิงก์ที่เกี่ยวข้อง</label>
            <a href={task.link} target="_blank" className="text-indigo-500 hover:underline flex items-center gap-1">
              <LinkIcon className="h-4 w-4"/> {task.link}
            </a>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>ปิด</Button>
      </div>
    </Modal>
  );
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

// Modal สำหรับแสดงรายการงานในวันที่เลือกจากปฏิทิน
function TaskModal({ date, tasks, onClose }) {
  // กรองงานเฉพาะวันที่ถูกเลือก
  const tasksForDate = tasks.filter(task => task.dueAt && isSameDay(new Date(task.dueAt), date));

  return (
    <Modal onClose={onClose}>
      <div className="text-lg font-semibold mb-4">
        งานวันที่ {format(date, 'd MMMM yyyy', { locale: th })}
      </div>
      {tasksForDate.length > 0 ? (
        <ul className="space-y-2">
          {tasksForDate.map(task => (
            <li key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
              <div>
                <div className="font-medium">{task.title}</div>
                {task.subjectName && <div className="text-xs text-slate-500">{task.subjectName}</div>}
              </div>
              {statusBadge(task.status)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-slate-500">ไม่มีงานในวันนี้</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={onClose}>ปิด</Button>
      </div>
    </Modal>
  );
}

function CalendarView({tasks, subjects, setView}){
  const [cursor, setCursor] = useState(new Date())
  // State สำหรับเก็บวันที่ที่ผู้ใช้คลิก เพื่อแสดง Modal
  const [selectedDate, setSelectedDate] = useState(null)

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
              // ส่วนของ Cell ในแต่ละวัน
              <div key={key} onClick={() => setSelectedDate(d)} className={`min-h-28 rounded-2xl border p-2 shadow-sm ${isSameMonth(d,cursor)? 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/30' : 'opacity-40 border-dashed'} cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50`}>
                <div className={`text-xs mb-1 ${isSameDay(d,new Date())? 'font-semibold text-indigo-600' : ''}`}>{format(d,'d')}</div>
                <div className="space-y-1">
                  {items.slice(0,2).map(b=> (
                    <div key={b.id} className="text-[11px] px-2 py-1 rounded-lg border truncate" style={{borderColor: b.subjectColor||'#e2e8f0'}}>
                      {b.title}
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
      {/* ย้าย AnimatePresence มาไว้ตรงนี้ เพื่อให้ Modal แสดงผลครอบคลุมทั้งหน้าจอ */}
      <AnimatePresence>
        {selectedDate && (
          <TaskModal date={selectedDate} tasks={tasks} onClose={() => setSelectedDate(null)} />
        )}
      </AnimatePresence>
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
      <Card className="sm:col-span-2">
        <SectionTitle>ธีม</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'auto'})} className={state.theme==='auto'? 'bg-slate-50 dark:bg-slate-800':''}><RefreshCw className="h-4 w-4"/> อัตโนมัติ</GhostButton>
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'light'})} className={state.theme==='light'? 'bg-slate-50 dark:bg-slate-800':''}><Sun className="h-4 w-4"/> สว่าง</GhostButton>
          <GhostButton onClick={()=>dispatch({type:'setTheme', value:'dark'})} className={state.theme==='dark'? 'bg-slate-50 dark:bg-slate-800':''}><Moon className="h-4 w-4"/> มืด</GhostButton>
        </div>
      </Card>

      <Card className="sm:col-span-1">
        <SectionTitle>สำรอง/กู้คืน</SectionTitle>
        <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
          <Button onClick={exportData}><Download className="h-4 w-4"/> ส่งออก JSON</Button>
          <GhostButton onClick={()=>fileRef.current?.click()}><Upload className="h-4 w-4"/> นำเข้า JSON</GhostButton>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
        </div>
        <div className="mt-3 text-xs text-slate-500">ข้อมูลจะถูกบันทึกออนไลน์อัตโนมัติ</div>
      </Card>

      <Card className="sm:col-span-1">
        <SectionTitle>ล้างข้อมูลทั้งหมด</SectionTitle>
        <div className="flex flex-col items-start">
          <Button className="bg-rose-600 hover:bg-rose-700 dark:text-white" onClick={handleClearData}>ล้างข้อมูล</Button>
          <p className="text-xs text-slate-500 mt-2">การกระทำนี้จะลบข้อมูลทั้งหมดในบัญชีของคุณอย่างถาวร</p>
        </div>
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
    <div className="h-screen flex flex-col items-center justify-center gap-8 bg-slate-100 dark:bg-slate-950 p-4">
      <div className="text-center">
        <motion.div initial={{rotate:-8, scale:0.9}} animate={{rotate:0, scale:1}} className="inline-block h-20 w-20 mb-4 rounded-3xl bg-indigo-600 text-white items-center justify-center shadow-lg shadow-indigo-500/30">
          <Sparkles className="h-12 w-12 m-4" />
        </motion.div>
        <h1 className="text-3xl font-bold font-display">ยินดีต้อนรับสู่ ME-U</h1>
        <p className="text-slate-500 mt-2">จัดการตารางงานและชีวิตให้ง่ายขึ้น</p>
      </div>
      <Button onClick={handleSignIn} className="!px-6 !py-3 !text-base"><User className="h-5 w-5" /> เข้าสู่ระบบด้วย Google</Button>
    </div>
  );
}

function Modal({children, onClose}){
  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onClose() }

    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  },[onClose])

  return createPortal(
    <>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div initial={{y:30, opacity:0}} animate={{y:0, opacity:1}} exit={{y:20, opacity:0}} className="fixed inset-x-0 bottom-0 md:bottom-auto md:top-20 mx-auto w-full md:w-[95%] md:max-w-[720px] z-50 max-h-[90vh] md:max-h-[85vh] overflow-y-auto rounded-t-3xl md:rounded-3xl">
        <Card className="p-5" onClick={(e)=>e.stopPropagation()}>
          {children}
        </Card>
      </motion.div>
    </>,
    document.body
  )
}
