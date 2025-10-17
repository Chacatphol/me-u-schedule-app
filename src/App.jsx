import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { format, isToday, isPast, addMinutes, addHours, addDays, differenceInMinutes, differenceInHours, differenceInDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, add, isSameMonth, isSameDay, subDays, eachDayOfInterval } from "date-fns";
import { createPortal } from "react-dom";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { Plus, Calendar as CalendarIcon, Bell, Trash2, Pencil, Check, CheckCircle, TimerReset, Upload, Download, ChevronLeft, ChevronRight, Link as LinkIcon, ListTodo, Sparkles, Folder, LayoutGrid, Layers, RefreshCw, Sun, Moon, BarChart3, LogOut, User, Flame, TrendingUp, Search, Filter, Menu, Circle, Minus, Flag, Clock } from "lucide-react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth } from "./firebase"; // Import auth
import { Button, GhostButton, Input, Textarea, Select, Card, SectionTitle, Badge, Progress } from './components/ui.jsx';

// --- Data layer ---
const initialState = {
  theme: 'auto',
  subjects: [], // {id, name, color}
  tasks: [], // {id, subjectId, title, detail, startAt|null, dueAt|null, taskType:'deadline'|'event', link, status:'todo'|'doing'|'done', category:'เรียน'|'งาน'|'ส่วนตัว', reminders:[{type:'minutes'|'hours'|'days', amount:number}], createdAt, updatedAt}
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
  const mins = Math.max(0, differenceInMinutes(due, new Date()))
  if(mins>=1440){ const d = Math.floor(mins/1440); return `เหลือ ${d} วัน` }
  if(mins>=60){ const h = Math.floor(mins/60); return `เหลือ ${h} ชม.` }
  return `เหลือ ${mins} นาที`
}

function statusBadge(s){
  const map = { todo:'ยังไม่ทำ', doing:'กำลังทำ', done:'เสร็จแล้ว' }
  const cls = s==='done'? 'border-emerald-400 text-emerald-600 dark:text-emerald-300' : s==='doing'? 'border-amber-400 text-amber-600 dark:text-amber-300' : 'border-slate-300 text-slate-500 dark:text-slate-300'
  return <Badge className={cls}>{map[s]}</Badge>
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
    arr = [...arr].sort((a, b) => {
      if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
      if (a.dueAt) return -1; // a has due date, b doesn't, a comes first
      if (b.dueAt) return 1;  // b has due date, a doesn't, b comes first
      return new Date(b.createdAt) - new Date(a.createdAt); // both have no due date, sort by creation
    });
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
    { key: 'settings', label: 'ตั้งค่า', icon: Layers },
  ];

  return (
    <div className="min-h-screen text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-950 font-sans">
      {/* Brutalist Design - Raw pattern background */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          backgroundSize: '30px 30px'
        }}></div>
      </div>
      
  <div className="md:flex pb-16 md:pb-0">
        {/* Sidebar for Desktop - Brutalist Style */}
  <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-black border-r-4 border-black dark:border-white p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img src="/logo.svg" alt="FlowO Logo" className="h-9" />
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
  <main className="flex-1 px-4 py-6 md:p-8">
          {/* Mobile Header */}
          <header className="md:hidden flex items-center justify-between mb-4">
            <img src="/logo.svg" alt="FlowO Logo" className="h-8" />
            <GhostButton onClick={() => signOut(auth)} className="!px-2"><LogOut className="h-4 w-4" /></GhostButton>
          </header>

          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.12 }}>
              {view === 'dashboard' && <Dashboard state={state} tasks={tasks} dueSoon={dueSoon} progressToday={progressToday} lazyScore={lazyScore} setView={setView} setSelectedSubject={setSelectedSubject} />}
              {view === 'tasks' && <TasksView state={state} dispatch={dispatch} tasks={tasks} filteredTasks={filteredTasks} setQuery={setQuery} query={query} selectedSubject={selectedSubject} setSelectedSubject={setSelectedSubject} />}
              {view === 'settings' && <Settings state={state} dispatch={dispatch} userId={user?.uid} />}
            </motion.div>
          </AnimatePresence>
        </main>

      {/* Floating Action Buttons for Tasks View */}
      {view === 'tasks' && (
        <div className="fixed right-4 bottom-20 md:bottom-6 flex flex-col items-end gap-3 z-30">
          <div className="flex flex-col gap-2 w-max">
            {/* This part needs state from TasksView, so we'll need to lift state up or pass it down */}
            {/* For now, let's just move the AddTaskButton */}
            <div className="w-full">
              <AddTaskButton subjects={state.subjects} onAdd={(payload) => dispatch({ type: 'addTask', payload })} />
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Mobile Bottom Navigation */}
  <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-200/50 dark:border-slate-800/50 p-1">
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
  // start with no date selected to avoid opening the date modal on app load
  const [modalDate, setModalDate] = useState(null);
  const [scheduleDate, setScheduleDate] = useState(new Date());

  // Calendar setup
  const [calendarCursor, setCalendarCursor] = useState(new Date());

  const start = startOfMonth(calendarCursor);
  const end = endOfMonth(calendarCursor);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(start, {weekStartsOn: 1}),
    end: endOfWeek(end, {weekStartsOn: 1})
  });

  // Group tasks by date for calendar
  const tasksByDate = tasks.reduce((acc, task) => {
    if (!task.dueAt) return acc;
    const dateKey = format(new Date(task.dueAt), 'yyyy-MM-dd');
    acc[dateKey] = acc[dateKey] || [];
    acc[dateKey].push(task);
    return acc;
  }, {});

  const handleDateSelect = (day) => {
    setModalDate(day);
    setScheduleDate(day);
  };

  const getTaskTypeForDay = (day) => {
    const tasksOnDay = tasksByDate[format(day, 'yyyy-MM-dd')] || [];
    if (tasksOnDay.some(t => t.taskType === 'event')) return 'event';
    if (tasksOnDay.some(t => t.taskType === 'deadline' || !t.taskType)) return 'deadline';
    return null;
  };

  const scheduleItems = useMemo(() => {
    const items = [];
    const dayTasks = (tasksByDate[format(scheduleDate, 'yyyy-MM-dd')] || [])
      .sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : -1) - (b.dueAt ? new Date(b.dueAt).getTime() : -1));

    const allDayTasks = dayTasks.filter(t => !t.dueAt);
    if (allDayTasks.length > 0) {
      items.push({ type: 'all-day', tasks: allDayTasks });
    }

    const timedTasks = dayTasks.filter(t => t.dueAt);
    let lastEventEnd = new Date(scheduleDate).setHours(0, 0, 0, 0);

    timedTasks.forEach(task => {
      const taskStart = new Date(task.dueAt).getTime();
      if (taskStart > lastEventEnd) {
        const freeMinutes = differenceInMinutes(taskStart, lastEventEnd);
        if (freeMinutes > 15) { // Only show free time if it's significant
          items.push({ type: 'free', start: lastEventEnd, end: taskStart, duration: freeMinutes });
        }
      }
      const taskEnd = addMinutes(taskStart, task.duration || 60).getTime();
      items.push({ type: 'task', task });
      lastEventEnd = taskEnd;
    });

    const endOfDay = new Date(scheduleDate).setHours(23, 59, 59, 999);
    if (endOfDay > lastEventEnd) {
      const freeMinutes = differenceInMinutes(endOfDay, lastEventEnd);
      if (freeMinutes > 15) {
        items.push({ type: 'free', start: lastEventEnd, end: endOfDay, duration: freeMinutes });
      }
    }

    return items;
  }, [scheduleDate, tasksByDate]);

  const formatFreeTime = (minutes) => {
    if (minutes < 60) return `${minutes} นาที`;
    return `${Math.floor(minutes / 60)} ชม. ${minutes % 60 > 0 ? minutes % 60 + ' นาที' : ''}`;
  };

  return (
    <div className="space-y-6">
      {/* Urgent / Due Soon (top column) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle><Flame className="h-4 w-4"/> งานที่ด่วนใกล้ถึง</SectionTitle>
          <div className="text-sm text-slate-500">จัดเรียงตามกำหนดส่ง</div>
        </div>

        <div className="space-y-3">
          {dueSoon.length > 0 ? dueSoon.map(task => (
            <div key={task.id} className="p-3 rounded-lg bg-white/60 dark:bg-slate-800/50 flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{task.title}</div>
                <div className="text-xs text-slate-500">{task.subjectName || 'ไม่มีวิชา'} • {task.dueAt ? format(new Date(task.dueAt), "d MMM HH:mm", {locale: th}) : 'ไม่ระบุเวลา'}</div>
              </div>
              <div className="ml-3 flex flex-col items-end gap-2">
                {statusBadge(task.status)}
              </div>
            </div>
          )) : (
            <div className="text-slate-500 text-center py-6">ไม่มีงานด่วนใกล้ถึง</div>
          )}
        </div>
      </Card>

      {/* Calendar (middle column) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle><CalendarIcon className="h-4 w-4"/> ปฏิทิน</SectionTitle>
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setCalendarCursor(add(calendarCursor, {months: -1}))}>
              <ChevronLeft className="h-4 w-4"/>
            </GhostButton>
            <div className="text-sm font-medium w-32 text-center">
              {format(calendarCursor, 'MMMM yyyy', {locale: th})}
            </div>
            <GhostButton onClick={() => setCalendarCursor(add(calendarCursor, {months: 1}))}>
              <ChevronRight className="h-4 w-4"/>
            </GhostButton>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500 mb-2">
          {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(d => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayTasks = tasksByDate[dateKey] || [];
            const taskTypeOnDay = getTaskTypeForDay(day);
            const isCurrentMonth = isSameMonth(day, calendarCursor);

            return (
              <div
                key={dateKey}
                onClick={() => handleDateSelect(day)}
                className={`
                  aspect-square p-1 rounded-lg cursor-pointer
                  transition-all duration-200
                  border border-slate-200/50 dark:border-slate-700/50
                  backdrop-blur-sm
                  ${dayTasks.length > 0 ? 'scale-100' : 'scale-90 opacity-70'}
                  ${isCurrentMonth 
                    ? 'bg-white/60 dark:bg-slate-900/40 hover:bg-white/80 dark:hover:bg-slate-800/60'
                    : 'opacity-40'}
                  ${isSameDay(day, new Date()) ? 'ring-2 ring-indigo-400' : ''}
                `}
              >
                <div className={`text-xs mb-1 ${isSameDay(day, new Date()) ? 'font-semibold text-indigo-600' : ''}`}>
                  {format(day, 'd')}
                </div>
                <div className="flex justify-center items-end h-4">
                  {taskTypeOnDay === 'event' && <div className="h-1.5 w-1.5 bg-green-500 rounded-full"></div>}
                  {taskTypeOnDay === 'deadline' && <div className="h-0.5 w-4/5 bg-blue-500"></div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Day Schedule (bottom column) */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle><TimerReset className="h-4 w-4"/> ตารางงานวันนี้</SectionTitle>
          <div className="flex items-center gap-2">
            <GhostButton onClick={() => setScheduleDate(subDays(scheduleDate, 1))}>
              <ChevronLeft className="h-4 w-4"/>
            </GhostButton>
            <div className="text-sm font-medium w-32 text-center">
              {format(scheduleDate, 'EEEE d MMM', {locale: th})}
            </div>
            <GhostButton onClick={() => setScheduleDate(addDays(scheduleDate, 1))}>
              <ChevronRight className="h-4 w-4"/>
            </GhostButton>
          </div>
        </div>

        <div className="space-y-1">
          {scheduleItems.length > 0 ? scheduleItems.map((item, index) => {
            if (item.type === 'task') {
              const { task } = item;
              const start = new Date(task.dueAt);
              const isEvent = task.taskType === 'event';
              return (
                <div key={task.id} className="flex gap-4">
                  <div className="text-xs text-slate-400 w-12 text-right pt-2">{format(start, 'HH:mm')}</div>
                  <div className={`flex-1 p-3 rounded-lg border ${isEvent ? 'border-green-500' : 'border-blue-500'}`} style={{ backgroundColor: hexToRgba(isEvent ? '#22c55e' : '#3b82f6', 0.1) }}>
                    <div className="font-medium text-sm">{task.title}</div>
                    <div className="text-xs text-slate-500">{task.subjectName}</div>
                  </div>
                </div>
              );
            }
            if (item.type === 'free') {
              return (
                <div key={`free-${index}`} className="flex items-center gap-4 h-8">
                  <div className="text-xs text-slate-400 w-12 text-right"></div>
                  <div className="flex-1 flex items-center">
                    <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-slate-700 relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-slate-100 dark:bg-slate-900 px-2 text-xs text-slate-400">
                        ว่าง {formatFreeTime(item.duration)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (item.type === 'all-day') {
              return (
                <div key="all-day" className="mb-2">
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-2">งานที่ต้องทำ (ทั้งวัน)</div>
                  {item.tasks.map(t => (
                    <div key={t.id} className="p-2 rounded-lg bg-slate-100/80 dark:bg-slate-800/80 mb-1 text-sm">{t.title}</div>
                  ))}
                </div>
              );
            }
            return null;
          }) : (
            <div className="text-slate-500 text-center py-8">ไม่มีงานในวันนี้</div>
          )}
        </div>
      </Card>

      {/* Task List Modal for Selected Date */}
      <AnimatePresence>
        {modalDate && (
          <Modal onClose={() => setModalDate(null)}>
            <div className="text-lg font-semibold mb-4">
              งานวันที่ {format(modalDate, 'd MMMM yyyy', {locale: th})}
            </div>
            {tasksByDate[format(modalDate, 'yyyy-MM-dd')]?.length > 0 ? (
              <div className="space-y-2">
                {tasksByDate[format(modalDate, 'yyyy-MM-dd')].map(task => (
                  <div key={task.id} onClick={() => { setView('tasks'); setSelectedSubject(null); }}
                       className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-slate-500">{task.subjectName}</div>
                      </div>
                      <div className="flex gap-2">{statusBadge(task.status)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-center py-8">ไม่มีงานในวันนี้</div>
            )}
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function TasksView({state, dispatch, tasks, filteredTasks, setQuery, query, selectedSubject, setSelectedSubject}){
  const nameRef = useRef(null);
  const colorRef = useRef(null);
  const [isAddingSubject, setAddingSubject] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState(new Set());
  const [editingTask, setEditingTask] = useState(null);

  const subjectTasksCount = useMemo(() => 
    Object.fromEntries(state.subjects.map(s => [s.id, tasks.filter(t => t.subjectId === s.id).length])), 
    [tasks, state.subjects]
  );

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
      setSelectedSubject(null);
    }
  };

  const toggleTaskSelection = (taskId) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId);
    } else {
      newSelected.add(taskId);
    }
    setSelectedTasks(newSelected);
  };

  const handleDeleteSelected = () => {
    if (confirm(`ลบงานที่เลือก ${selectedTasks.size} งาน?`)) {
      selectedTasks.forEach(id => dispatch({ type: 'deleteTask', id }));
      setSelectedTasks(new Set());
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header with Search */}
      <div className="sticky top-0 z-20 bg-slate-100/80 dark:bg-slate-950/80 backdrop-blur-xl p-4 -mx-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="ค้นหางาน..." 
            value={query} 
            onChange={e => setQuery(e.target.value)} 
            className="pl-9 w-full shadow-lg"
          />
        </div>
      </div>

      {/* Subject Filters */}
      <div className="sticky top-20 z-10 -mx-4 px-4 py-2 bg-slate-100/60 dark:bg-slate-950/60 backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          <GhostButton 
            onClick={() => setSelectedSubject(null)} 
            className={`transition-all ${!selectedSubject ? 'bg-white/80 dark:bg-slate-800/80 shadow-lg scale-110' : ''}`}
          >
            ทั้งหมด
          </GhostButton>
          {state.subjects.map(s => (
            <GhostButton 
              key={s.id} 
              onClick={() => setSelectedSubject(s.id)} 
              className={`relative transition-all
                ${selectedSubject === s.id ? 'bg-white/80 dark:bg-slate-800/80 shadow-lg scale-110' : ''}
                ${selectedSubject === s.id ? 'after:absolute after:left-1/2 after:-bottom-6 after:w-4 after:h-6 after:bg-gradient-to-b after:from-white/80 after:to-transparent dark:after:from-slate-800/80 after:-translate-x-1/2' : ''}
              `}
            >
              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} />
              {s.name}
              <Badge className="ml-1 !px-1.5">{subjectTasksCount[s.id] || 0}</Badge>
            </GhostButton>
          ))}
          <GhostButton onClick={() => setAddingSubject(true)} className="!px-2 ml-auto">
            <Plus className="h-4 w-4" />
          </GhostButton>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-2">
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
              <TaskItem 
                task={t}
                selected={selectedTasks.has(t.id)}
                onSelect={() => toggleTaskSelection(t.id)}
                onEdit={() => setEditingTask(t)}
                onUpdate={(payload) => dispatch({ type: 'updateTask', payload })}
                onDelete={(id) => dispatch({ type: 'deleteTask', id })}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {filteredTasks.length === 0 && 
          <div className="text-center text-slate-500 py-10">ไม่มีงานที่ตรงกับเงื่อนไข</div>
        }
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isAddingSubject && (
          <Modal onClose={() => setAddingSubject(false)}>
            <div className="text-lg font-semibold mb-4">เพิ่มรายวิชาใหม่</div>
            <div className="space-y-3">
              <Input placeholder="ชื่อรายวิชา/โปรเจกต์" ref={nameRef} />
              <div className="flex items-center gap-2">
                <Input type="color" defaultValue="#6366f1" ref={colorRef} className="w-16 h-10 p-1" />
                <Button onClick={addSubject} className="flex-1"><Plus className="h-4 w-4" /> เพิ่ม</Button>
              </div>
            </div>
          </Modal>
        )}
        {editingTask && (
          <Modal onClose={() => setEditingTask(null)}>
            <TaskEditForm 
              task={editingTask} 
              subjects={state.subjects}
              onSave={(payload) => {
                dispatch({ type: 'updateTask', payload });
                setEditingTask(null);
              }}
              onClose={() => setEditingTask(null)}
            />
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
    title:'', detail: '', startAt: '', dueAt: '', link: '', status:'todo', category:'เรียน', reminders:[], taskType: 'deadline'
  })
  useEffect(()=>{ if(subjects.length && !form.subjectId) setForm(f=>({...f, subjectId: subjects[0].id})) },[subjects])

  const submit = ()=>{
    if(!form.title) return alert('ใส่ชื่องานก่อนนะ')
    const payload = { ...form, priority: 'med', id:uid(), createdAt:Date.now(), updatedAt:Date.now(), startAt: form.startAt ? new Date(form.startAt).toISOString() : null, dueAt: form.dueAt? new Date(form.dueAt).toISOString(): null, detail: form.detail || '', link: form.link || '' }
    onAdd(payload)
    setOpen(false)
    setForm(f=>({...f, title:'', detail:'', startAt: '', dueAt:'', link:'', status:'todo', reminders:[], taskType: 'deadline'}))
  }

  return (
    <>
      <Button onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/> เพิ่มงาน</Button>
      <AnimatePresence>
        {open && (
          <Modal onClose={()=>setOpen(false)}>
            <div className="text-lg font-semibold mb-4 px-2">เพิ่มงานใหม่</div>
            <div className="px-2 mb-4">
              <label className="text-xs text-slate-500 mb-1 block">ประเภท</label>
              <div className="flex gap-2">
                <Button onClick={() => setForm({...form, taskType: 'deadline'})} className={`flex-1 ${form.taskType === 'deadline' ? '' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>📝 งาน</Button>
                <Button onClick={() => setForm({...form, taskType: 'event'})} className={`flex-1 ${form.taskType === 'event' ? '' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>🗓️ นัดหมาย</Button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(85vh-8rem)] px-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">รายวิชา</label>
                  <div className="custom-select-wrapper">
                    <Select value={form.subjectId} onChange={e=>setForm({...form, subjectId:e.target.value})}>
                      {subjects.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs">ชื่องาน</label>
                  <Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="เช่น Assignment บทที่ 3" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs">รายละเอียด</label>
                  <Textarea value={form.detail} onChange={e=>setForm({...form, detail:e.target.value})} placeholder="โน้ตย่อย หรือ checklist คร่าวๆ" />
                </div>
                <div className={`md:col-span-2 grid grid-cols-1 ${form.taskType === 'deadline' ? 'md:grid-cols-2' : ''} gap-4`}>
                  {form.taskType === 'deadline' && (
                    <div>
                      <label className="text-xs">วันที่เริ่มทำงาน (ว่างได้)</label>
                      <Input 
                        type="datetime-local" 
                        value={form.startAt} 
                        onChange={e=>setForm({...form, startAt:e.target.value})}
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-xs">{form.taskType === 'deadline' ? 'กำหนดส่ง (วันสุดท้าย)' : 'วันที่นัดหมาย'}</label>
                    <Input 
                      type="datetime-local" 
                      value={form.dueAt} 
                      onChange={e=>setForm({...form, dueAt:e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs">ลิงก์ที่เกี่ยวข้อง</label>
                  <Input value={form.link} onChange={e=>setForm({...form, link:e.target.value})} placeholder="วางลิงก์เอกสาร" />
                </div>
                <div>
                  <label className="text-xs">หมวดหมู่</label>
                  <div className="custom-select-wrapper">
                    <Select value={form.category} onChange={e=>setForm({...form, category:e.target.value})}>
                      <option value="เรียน">เรียน</option>
                      <option value="งาน">งาน</option>
                      <option value="ส่วนตัว">ส่วนตัว</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs">สถานะ</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { value: 'todo', label: 'ยังไม่ทำ' },
                      { value: 'doing', label: 'กำลังทำ' },
                      { value: 'done', label: 'เสร็จแล้ว' },
                    ].map(s => (
                      <GhostButton key={s.value} onClick={() => setForm({ ...form, status: s.value })} className={form.status === s.value ? 'bg-slate-50 dark:bg-slate-800' : ''}>
                        {s.label}
                      </GhostButton>
                    ))}
                  </div>
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
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <GhostButton onClick={()=>setOpen(false)}>ยกเลิก</GhostButton>
                <Button onClick={submit}><Check className="h-4 w-4"/> บันทึก</Button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  )
}

function TaskItem({task, onUpdate, onDelete}){
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({...task, taskType: task.taskType || 'deadline', startAt: task.startAt ? format(new Date(task.startAt), "yyyy-MM-dd'T'HH:mm") : '', dueAt: task.dueAt? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : ''})
  useEffect(()=> setForm({...task, taskType: task.taskType || 'deadline', startAt: task.startAt ? format(new Date(task.startAt), "yyyy-MM-dd'T'HH:mm") : '', dueAt: task.dueAt? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm") : '', detail: task.detail || '', link: task.link || ''}), [task])

  const [showDetailModal, setShowDetailModal] = useState(false)
  const save = ()=>{
    const payload = {...form, startAt: form.startAt ? new Date(form.startAt).toISOString() : null, dueAt: form.dueAt? new Date(form.dueAt).toISOString(): null, detail: form.detail || '', link: form.link || ''}
    onUpdate(payload)
    setEditing(false)
  }

  const handleStatusChange = (e) => {
    e.stopPropagation(); // หยุดไม่ให้ event ส่งผลกระทบกับส่วนอื่น
    const statuses = ['todo', 'doing', 'done'];
    const currentIndex = statuses.indexOf(task.status);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];

    onUpdate({ ...task, status: nextStatus });
  };

  // สร้างคลาสสำหรับไล่เฉดสีตามสถานะของงาน
  const statusGradientClass =
    task.status === 'done'
      ? 'bg-gradient-to-l from-emerald-400/10' // สีเขียวสำหรับ "เสร็จแล้ว"
      : task.status === 'doing'
      ? 'bg-gradient-to-l from-amber-400/10' // สีส้มสำหรับ "กำลังทำ"
      : ''; // ไม่มีสีสำหรับ "ยังไม่ทำ"

  const needsTruncationButton = task.detail && task.detail.length > 150; // Heuristic for showing "View More"
  const isEvent = task.taskType === 'event';

  return (
    <Card className={statusGradientClass}>
      <div className="flex items-start gap-4">
        {/* Status Toggle Button */}
        <button onClick={handleStatusChange} className="flex-shrink-0 mt-1 transition-transform active:scale-90" title="คลิกเพื่อเปลี่ยนสถานะ">
          {task.status === 'done' && <CheckCircle className="h-6 w-6 text-emerald-500" />}
          {task.status === 'doing' && <div className="h-6 w-6 rounded-full border-2 border-amber-500 flex items-center justify-center"><Minus className="h-4 w-4 text-amber-500"/></div>}
          {task.status === 'todo' && <Circle className="h-6 w-6 text-slate-300 dark:text-slate-600" />}
        </button>

        {/* Task Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium truncate">{task.title}</div>
            {task.subjectName && <Badge className="border-slate-300 text-slate-500"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{background:task.subjectColor}}/> {task.subjectName}</Badge>}
          </div>
          {task.detail && (
            <div className={`text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap line-clamp-4`}>
              {task.detail}
            </div>
          )}
          <div className="mt-2">
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              {task.dueAt ? (
                isEvent ? (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> นัดหมาย: {format(new Date(task.dueAt), "d MMM yy HH:mm", {locale: th})}</span>
                ) : (
                  <>
                    <span className="flex items-center gap-1"><Flag className="h-3 w-3"/> กำหนดส่ง: {format(new Date(task.dueAt), "d MMM yy HH:mm", {locale: th})}</span>
                    <span>• {isPast(new Date(task.dueAt))? 'เลยกำหนดแล้ว' : timeLeftLabel(task.dueAt)}</span>
                  </>
                )
              ) : <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3"/> ไม่มีวันส่ง</span>}
              {task.link && <a href={task.link} target="_blank" className="inline-flex items-center gap-1 underline"><LinkIcon className="h-3 w-3"/> ลิงก์งาน</a>}
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <GhostButton onClick={()=> setEditing(true)}><Pencil className="h-4 w-4"/></GhostButton>
          <GhostButton onClick={()=> onDelete(task.id)}><Trash2 className="h-4 w-4"/></GhostButton>
        </div>
      </div>

      <AnimatePresence>
        {editing && (
          <Modal onClose={()=>setEditing(false)}>
            <div className="px-2 mb-4">
              <label className="text-xs text-slate-500 mb-1 block">ประเภท</label>
              <div className="flex gap-2">
                <Button onClick={() => setForm({...form, taskType: 'deadline'})} className={`flex-1 ${form.taskType === 'deadline' ? '' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>📝 งาน</Button>
                <Button onClick={() => setForm({...form, taskType: 'event'})} className={`flex-1 ${form.taskType === 'event' ? '' : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>🗓️ นัดหมาย</Button>
              </div>
            </div>
            <div className="text-lg font-semibold mb-2">อัปเดตงาน</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs">สถานะ</label>
                <div className="custom-select-wrapper">
                  <Select value={form.status} onChange={e=>setForm({...form, status: e.target.value})}>
                    <option value="todo">ยังไม่ทำ</option><option value="doing">กำลังทำ</option><option value="done">เสร็จแล้ว</option>
                  </Select></div>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">ชื่องาน</label>
                <Input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} className="w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">รายละเอียด</label>
                <Textarea value={form.detail||''} onChange={e=>setForm({...form, detail:e.target.value})} />
              </div>
              <div className={`md:col-span-2 grid grid-cols-1 ${form.taskType === 'deadline' ? 'md:grid-cols-2' : ''} gap-3`}>
                {form.taskType === 'deadline' && (
                  <div>
                    <label className="text-xs">วันที่เริ่มทำงาน (ว่างได้)</label>
                    <Input 
                      type="datetime-local" 
                      value={form.startAt||''} 
                      onChange={e=>setForm({...form, startAt:e.target.value})}
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs">{form.taskType === 'deadline' ? 'กำหนดส่ง (วันสุดท้าย)' : 'วันที่นัดหมาย'}</label>
                  <Input type="datetime-local" value={form.dueAt||''} onChange={e=>setForm({...form, dueAt:e.target.value})} className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-xs">ลิงก์</label>
                <Input value={form.link||''} onChange={e=>setForm({...form, link:e.target.value})} className="w-full" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">เตือนก่อน</label>
                <ReminderPicker value={form.reminders||[]} onChange={(reminders)=> setForm({...form, reminders})} />
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





function Settings({state, dispatch, userId}){
  const fileRef = useRef(null)

  const exportData = ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'flowo-data.json'
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
        <h1 className="text-3xl font-bold font-display">ยินดีต้อนรับสู่ FlowO</h1>
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
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/45 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Centering container: ensures symmetric top/bottom spacing and centers content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 8 }}
          transition={{ duration: 0.18 }}
          className="w-[92%] sm:w-[80%] md:w-[720px] mx-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Scrollable area: max-height keeps equal margins and allows internal scrolling when content is tall */}
          <div className="max-h-[calc(100vh-4rem)] w-full overflow-y-auto rounded-2xl">
            <Card className="p-4 md:p-6 rounded-2xl">
              {children}
            </Card>
          </div>
        </motion.div>
      </div>
    </>,
    document.body
  )
}
