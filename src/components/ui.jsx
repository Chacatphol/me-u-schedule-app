import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export const Button = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold 
    shadow-float hover:shadow-glass transition-all active:scale-[0.98] 
    bg-gradient-subtle from-primary-500 to-primary-600 text-white 
    dark:from-primary-400 dark:to-primary-500 whitespace-nowrap ${className}`} {...props} />
);

export const GhostButton = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm 
    transition-all active:scale-[0.98] border border-slate-200/30 dark:border-slate-700/30 
    backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 
    hover:bg-white/50 dark:hover:bg-slate-800/50 
    shadow-subtle hover:shadow-float
    whitespace-nowrap ${className}`} {...props} />
);

export const Input = React.forwardRef((props, ref) => (
  <input ref={ref} {...props} className={`w-full rounded-xl 
    border border-slate-200/50 dark:border-slate-700/50 
    bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
    px-3 py-2 text-sm outline-none 
    focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 
    shadow-subtle focus:shadow-float
    transition-all ${props.className || ''}`} />
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
    <textarea ref={textareaRef} rows={1} {...props} 
      className={`w-full rounded-xl 
      border border-slate-200/50 dark:border-slate-700/50 
      bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
      px-3 py-2 text-sm outline-none 
      focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 
      shadow-subtle focus:shadow-float
      transition-all resize-none overflow-y-hidden ${props.className || ''}`} />
  );
};

export const Select = (props) => (
  <select {...props} className={`w-full rounded-xl 
    border border-slate-200/50 dark:border-slate-700/50 
    bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm
    px-3 py-2 text-sm outline-none 
    focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/50 
    shadow-subtle focus:shadow-float
    transition-all ${props.className || ''}`} />
);

export const Card = ({ className = '', ...props }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`rounded-3xl 
      border border-slate-200/30 dark:border-slate-800/30 
      bg-white/70 dark:bg-slate-900/50 
      backdrop-blur-xl p-6 
      shadow-glass-sm hover:shadow-glass 
      transition-all duration-300 ${className}`} 
    {...props} 
  />
);

export const SectionTitle = ({children}) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.3 }}
    className="font-display font-semibold text-lg mb-4 
      bg-gradient-to-r from-primary-600 to-primary-400 
      bg-clip-text text-transparent 
      flex items-center gap-2">
    {children}
  </motion.div>
);

export const Badge = ({children, className=''}) => (
  <span className={`px-2 py-0.5 rounded-full text-xs 
    border border-slate-200/30 dark:border-slate-700/30 
    backdrop-blur-sm bg-white/30 dark:bg-slate-900/30 
    shadow-subtle ${className}`}>
    {children}
  </span>
);

export const Progress = ({value=0}) => (
  <div className="w-full h-2 rounded-full bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm overflow-hidden shadow-subtle">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100,Math.max(0,value))}%` }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-full bg-gradient-to-r from-primary-500 to-primary-400" 
    />
  </div>
);

