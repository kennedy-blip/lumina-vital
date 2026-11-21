import React from 'react';
import { motion, type Transition } from 'framer-motion';

export const LUMINA_SPRING: Transition = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.8,
};

interface PrismGlassCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  interactive?: boolean;
  layoutId?: string;
  onClick?: () => void;
}

export const PrismGlassCard: React.FC<PrismGlassCardProps> = ({
  children,
  className = '',
  innerClassName = '',
  interactive = false,
  layoutId,
  onClick,
}) => {
  return (
    <motion.div
      layoutId={layoutId}
      transition={LUMINA_SPRING}
      whileHover={interactive ? { scale: 1.015, y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.96 } : undefined}
      onClick={onClick}
      className={`lv-prism-outer ${interactive ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      <div className={`lv-glass-inner lv-specular-sheen h-full ${innerClassName}`}>
        <div className="relative z-10 h-full">{children}</div>
      </div>
    </motion.div>
  );
};
