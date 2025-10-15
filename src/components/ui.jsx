import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Brutalist UI Components
export const Button = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`
    inline-flex items-center justify-center gap-2 
    px-4 py-2.5 text-sm font-black uppercase tracking-wide
    bg-black text-white dark:bg-white dark:text-black
    border-2 border-black dark:border-white
    transform hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0_0_rgba(255,255,255,1)]
    transition-all active:translate-y-0 active:shadow-none
    ${className}
  `} {...props} />
);

export const GhostButton = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`
    inline-flex items-center justify-center gap-2 
    px-3.5 py-2 text-sm font-black uppercase tracking-wide
    border-2 border-black dark:border-white
    hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black
    transform hover:-translate-y-0.5 
    transition-all active:translate-y-0
    ${className}
  `} {...props} />
);

export const Input = React.forwardRef((props, ref) => (
  <input ref={ref} {...props} className={`
    w-full px-3 py-2 text-sm 
    border-2 border-black dark:border-white
    bg-transparent
    font-mono
    outline-none focus:ring-0
    focus:bg-white dark:focus:bg-black
    placeholder:text-black/50 dark:placeholder:text-white/50
    transform hover:-translate-y-0.5 focus:-translate-y-0.5
    transition-all
    ${props.className || ''}
  `} />
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
      className={`
        w-full px-3 py-2 text-sm
        border-2 border-black dark:border-white
        bg-transparent
        font-mono
        outline-none focus:ring-0
        focus:bg-white dark:focus:bg-black
        placeholder:text-black/50 dark:placeholder:text-white/50
        transform hover:-translate-y-0.5 focus:-translate-y-0.5
        transition-all resize-none overflow-y-hidden
        ${props.className || ''}
      `} 
    />
  );
};

export const Select = (props) => (
  <select {...props} className={`
    w-full px-3 py-2 text-sm
    border-2 border-black dark:border-white
    bg-transparent
    font-mono
    outline-none focus:ring-0
    focus:bg-white dark:focus:bg-black
    transform hover:-translate-y-0.5 focus:-translate-y-0.5
    transition-all
    ${props.className || ''}
  `} />
);

export const Card = ({ className = '', ...props }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.2 }}
    className={`
      bg-white dark:bg-black
      border-2 border-black dark:border-white
      p-6 mb-4
      transform hover:-translate-y-0.5 
      hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0_0_rgba(255,255,255,1)]
      transition-all
      ${className}
    `} 
    {...props} 
  />
);

export const SectionTitle = ({children}) => (
  <motion.div 
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.2 }}
    className="
      text-2xl font-black font-mono uppercase 
      mb-6 flex items-center gap-2
      transform -skew-x-6
    ">
    {children}
  </motion.div>
);

export const Badge = ({children, className=''}) => (
  <span className={`
    inline-flex items-center gap-1 px-2 
    text-xs font-black uppercase tracking-wider
    border-2 border-current
    transform -skew-x-6
    ${className}
  `}>
    {children}
  </span>
);

export const Progress = ({value=0}) => (
  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 border-2 border-black dark:border-white overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100,Math.max(0,value))}%` }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-full bg-black dark:bg-white relative"
    >
      <span className="absolute right-0 top-1/2 -translate-y-1/2 px-1 text-[10px] font-mono text-white dark:text-black">
        {value}%
      </span>
    </motion.div>
  </div>
);

