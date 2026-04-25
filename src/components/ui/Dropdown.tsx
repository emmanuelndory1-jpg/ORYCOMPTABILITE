import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

import { useLocation } from 'react-router-dom';

interface DropdownProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export function Dropdown({ trigger, children, className, align = 'right', width = 'w-64' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, alignTo: align });

  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const updatePosition = () => {
        if (!containerRef.current || !dropdownRef.current) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const dropdownRect = dropdownRef.current.getBoundingClientRect();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        let finalAlign = align;
        
        // Horizontal check
        if (align === 'right' && rect.right - dropdownRect.width < 0) {
          finalAlign = 'left';
        } else if (align === 'left' && rect.left + dropdownRect.width > screenWidth) {
          finalAlign = 'right';
        } else if (align === 'center') {
          const centerLeft = rect.left + rect.width / 2 - dropdownRect.width / 2;
          if (centerLeft < 0) finalAlign = 'left';
          else if (centerLeft + dropdownRect.width > screenWidth) finalAlign = 'right';
        }
        
        // Vertical check
        const spaceBelow = screenHeight - rect.bottom;
        const spaceAbove = rect.top;
        const isUpward = spaceBelow < dropdownRect.height + 20 && spaceAbove > spaceBelow;

        setCoords({
          top: isUpward ? -Math.min(dropdownRect.height, spaceAbove - 20) - 8 : rect.height + 8,
          left: 0,
          alignTo: finalAlign
        });
      };

      updatePosition();
      // Add a small delay to ensure ref measurements are accurate after animation start
      const timeout = setTimeout(updatePosition, 10);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, align]);

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, scale: 0.95, y: coords.top > 0 ? -5 : 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: coords.top > 0 ? -5 : 5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ 
              top: coords.top,
              position: 'absolute'
            }}
            className={cn(
              "z-50 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col",
              width,
              coords.alignTo === 'right' ? "right-0" : coords.alignTo === 'left' ? "left-0" : "left-1/2 -translate-x-1/2"
            )}
          >
            <div 
              onClick={() => setIsOpen(false)}
              className="max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
            >
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
