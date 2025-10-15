import { motion, AnimatePresence } from 'framer-motion';
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
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{scale: 0.95, opacity:0}} 
        animate={{scale: 1, opacity:1}} 
        exit={{scale: 0.95, opacity:0}} 
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] max-w-[720px] z-50"
      >
        <Card className="p-6" onClick={(e)=>e.stopPropagation()}>
          {children}
        </Card>
      </motion.div>
    </>,
    document.body
  )
}