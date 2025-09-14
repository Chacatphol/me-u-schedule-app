import React, { useEffect, useRef } from "react";

export const Button = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] bg-slate-900 text-white dark:bg-white dark:text-slate-900 whitespace-nowrap ${className}`} {...props} />
);

export const GhostButton = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm transition-colors active:scale-[0.98] border border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 whitespace-nowrap ${className}`} {...props} />
);

export const Input = React.forwardRef((props, ref) => <input ref={ref} {...props} className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow ${props.className || ''}`} />)

export const Textarea = (props) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = '0px';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [props.value]);

  return (
    <textarea ref={textareaRef} rows={1} {...props} className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow resize-none overflow-y-hidden ${props.className || ''}`} />
  );
};

export const Select = (props) => <select {...props} className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-shadow ${props.className || ''}`} />
export const Card = ({ className = '', ...props }) => <div className={`rounded-3xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 backdrop-blur-xl p-4 shadow-sm ${className}`} {...props} />
export const SectionTitle = ({children}) => <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">{children}</div>
export const Badge = ({children, className=''}) => <span className={`px-2 py-0.5 rounded-full text-xs border ${className}`} >{children}</span>
export const Progress = ({value=0}) => (
  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
    <div className="h-full bg-indigo-500" style={{width:`${Math.min(100,Math.max(0,value))}%`}} />
  </div>
)

