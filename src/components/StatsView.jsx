import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, SectionTitle } from './ui';
import { BarChart3, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';

export function StatsView({ tasks }) {
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
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-3">
        <SectionTitle><BarChart3 className="h-4 w-4" /> สถิติภาพรวม</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="text-2xl font-bold">{totalTasks}</div>
            <div className="text-sm text-slate-500">งานทั้งหมด</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/50">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{doneTasks}</div>
            <div className="text-sm text-emerald-500">เสร็จแล้ว</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/50">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{doingTasks}</div>
            <div className="text-sm text-amber-500">กำลังทำ</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="text-2xl font-bold">{donePercentage}%</div>
            <div className="text-sm text-slate-500">ความสำเร็จ</div>
          </div>
        </div>
      </Card>

      <Card className="md:col-span-1 lg:col-span-2 h-80">
        <SectionTitle><TrendingUp className="h-4 w-4" /> งานที่เสร็จใน 7 วันล่าสุด</SectionTitle>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={tasksCompletedLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ backgroundColor: 'rgba(30,41,59,0.8)', border: 'none', borderRadius: '0.75rem' }} />
            <Bar dataKey="count" fill="#818cf8" name="จำนวนงาน" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="md:col-span-1 lg:col-span-1 h-80">
        <SectionTitle><CheckCircle className="h-4 w-4" /> งานตามความสำคัญ</SectionTitle>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={priorityData} layout="vertical" margin={{ top: 5, right: 20, left: -10, bottom: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={50} />
            <Tooltip cursor={{ fill: 'rgba(128,128,128,0.1)' }} contentStyle={{ backgroundColor: 'rgba(30,41,59,0.8)', border: 'none', borderRadius: '0.75rem' }} />
            <Bar dataKey="count" name="จำนวนงาน" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

