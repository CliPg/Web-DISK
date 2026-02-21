import { motion } from 'framer-motion'
import type { ComponentProps, ReactNode } from 'react'

type MotionDivProps = ComponentProps<typeof motion.div>

interface GlassCardProps extends MotionDivProps {
  variant?: 'default' | 'heavy'
  hover?: boolean
  children: ReactNode
}

export default function GlassCard({
  children,
  className = '',
  variant = 'default',
  hover = false,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={`${variant === 'heavy' ? 'glass-heavy' : 'glass'} shadow-glass rounded-2xl ${className}`}
      whileHover={hover ? { y: -2, scale: 1.005 } : undefined}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
