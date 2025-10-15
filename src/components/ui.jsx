import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Brutalist UI Components
export const Button = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`
    inline-flex items-center justify-center gap-2 
    px-4 py-3 text-base font-semibold
    bg-black text-white dark:bg-white dark:text-black
    border-2 border-black dark:border-white
    rounded-lg
    transition-colors disabled:opacity-60
    ${className}
  `} {...props} />
);

export const GhostButton = ({ as: Comp = 'button', className = '', ...props }) => (
  <Comp className={`
    inline-flex items-center justify-center gap-2 
    px-3 py-2 text-sm font-medium
    border border-current
    rounded-lg
    bg-transparent
    transition-colors
    ${className}
  `} {...props} />
);

export const Input = React.forwardRef((props, ref) => (
  <input ref={ref} {...props} className={`
    w-full px-3 py-2 text-sm 
    border border-current
    bg-transparent
    rounded-md
    outline-none focus:ring-2 focus:ring-indigo-400
    placeholder:text-black/50 dark:placeholder:text-white/50
    transition-colors
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
        border border-current
        bg-transparent
        rounded-md
        outline-none focus:ring-2 focus:ring-indigo-400
        placeholder:text-black/50 dark:placeholder:text-white/50
        transition-colors resize-none overflow-y-hidden
        ${props.className || ''}
      `} 
    />
  );
};

export const Select = (props) => (
  <select {...props} className={`
    w-full px-3 py-2 text-sm
    border border-current
    bg-transparent
    rounded-md
    outline-none focus:ring-2 focus:ring-indigo-400
    transition-colors
    ${props.className || ''}
  `} />
);

export const Card = ({ className = '', ...props }) => (
  <motion.div 
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.18 }}
    className={`
      bg-white dark:bg-black
      border border-current
      p-4 mb-3
      rounded-xl
      transition-all
      ${className}
    `} 
    {...props} 
  />
);

export const SectionTitle = ({children}) => (
  <motion.div 
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.18 }}
    className="
      text-lg md:text-2xl font-bold md:font-black font-sans 
      mb-4 flex items-center gap-2
    ">
    {children}
  </motion.div>
);

export const Badge = ({children, className=''}) => (
  <span className={`
    inline-flex items-center gap-1 px-2 
    text-xs font-semibold
    border rounded-md
    ${className}
  `}>
    {children}
  </span>
);

export const Progress = ({value=0}) => (
  <div className="w-full h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
    <motion.div 
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100,Math.max(0,value))}%` }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="h-full bg-indigo-600 relative"
    >
      <span className="absolute right-0 top-1/2 -translate-y-1/2 px-1 text-[10px] font-mono text-white">
        {value}%
      </span>
    </motion.div>
  </div>
);

