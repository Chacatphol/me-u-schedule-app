import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Modern Smartify-like UI primitives (mobile-first, glass accents, indigo accent)
export const Button = ({ as: Comp = 'button', className = '', children, ...props }) => (
  <Comp
    className={`inline-flex items-center justify-center gap-2 select-none
      px-4 py-3 text-sm md:text-base font-semibold rounded-2xl
      bg-gradient-to-br from-indigo-600 to-indigo-500 text-white
      shadow-lg shadow-indigo-500/25 hover:shadow-xl active:scale-95
      focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2
      transition-all disabled:opacity-60 ${className}`}
    {...props}
  >
    {children}
  </Comp>
);

export const GhostButton = ({ as: Comp = 'button', className = '', children, ...props }) => (
  <Comp
    className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg
      bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm border border-white/10 text-slate-700 dark:text-slate-200
      hover:bg-white/60 dark:hover:bg-slate-800/60 active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-300
      transition ${className}`}
    {...props}
  >
    {children}
  </Comp>
);

export const Input = React.forwardRef((props, ref) => (
  <input
    ref={ref}
    {...props}
    className={`w-full px-3 py-2 text-sm md:text-base rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm
      border border-white/10 dark:border-slate-800/60 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
      placeholder:text-slate-400 dark:placeholder:text-slate-500 transition ${props.className || ''}`}
  />
));

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
    <textarea
      ref={textareaRef}
      rows={1}
      {...props}
      className={`w-full px-3 py-2 text-sm md:text-base rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm
        border border-white/10 dark:border-slate-800/60 outline-none focus:ring-2 focus:ring-indigo-400 transition resize-none overflow-y-hidden
        ${props.className || ''}`}
    />
  );
};

export const Select = (props) => (
  <select
    {...props}
    className={`w-full px-3 py-2 text-sm md:text-base rounded-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm
      border border-white/10 dark:border-slate-800/60 outline-none focus:ring-2 focus:ring-indigo-400 transition ${props.className || ''}`}
  />
);

export const Card = ({ className = '', children, ...props }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.995 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.18 }}
    className={`bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border border-white/10 dark:border-slate-800/40
      p-4 md:p-6 mb-3 rounded-2xl shadow-sm ${className}`}
    {...props}
  >
    {children}
  </motion.div>
);

export const SectionTitle = ({children}) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.18 }}
    className="text-lg md:text-2xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100"
  >
    {children}
  </motion.div>
);

export const Badge = ({children, className=''}) => (
  <span className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-semibold rounded-full bg-white/20 dark:bg-slate-800/30 border border-white/5 ${className}`}>
    {children}
  </span>
);

export const Progress = ({value=0}) => (
  <div className="w-full h-3 bg-slate-200/60 dark:bg-slate-800/40 rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100,Math.max(0,value))}%` }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 relative"
    >
      <span className="absolute right-1 top-1/2 -translate-y-1/2 px-1 text-[10px] font-mono text-white">
        {value}%
      </span>
    </motion.div>
  </div>
);
  

