import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Card } from './ui';

export function Modal({children, onClose}){
  useEffect(()=>{
    const onKey = (e)=>{ if(e.key==='Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  },[onClose])

  return createPortal(
    <>
      <motion.div 
        initial={{opacity:0}} 
        animate={{opacity:1}} 
        exit={{opacity:0}} 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{opacity:0, y: 8}} 
        animate={{opacity:1, y: 0}} 
        exit={{opacity:0, y: 8}} 
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] md:w-[90%] max-w-[720px] z-50 max-h-[90vh] overflow-y-auto rounded-lg p-4 md:p-6"
      >
        <Card className="p-4 md:p-6" onClick={(e)=>e.stopPropagation()}>
          {children}
        </Card>
      </motion.div>
    </>,
    document.body
  )
}