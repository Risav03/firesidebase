'use client'

import { ReactNode } from 'react';
import { MdClose } from 'react-icons/md';
import { AnimatePresence, motion } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, maxWidth = 'max-w-md' }: ModalProps) {
  return (
    <AnimatePresence mode="wait" >
      {isOpen && (
        <motion.div 
          key="modal-container"
          className="fixed inset-0 flex items-center h-screen justify-center z-50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div 
            className="absolute inset-0 bg-black bg-opacity-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          
          {/* Modal content */}
          <motion.div 
            className={`bg-black/50 backdrop-blur-lg border border-orange-500/50 rounded-lg p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto relative z-10`}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Close button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <MdClose size={24} />
            </button>
            
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}