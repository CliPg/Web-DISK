import { motion } from 'framer-motion'
import type { ComponentProps, ReactNode } from 'react'

type MotionDivProps = ComponentProps<typeof motion.div>

interface NeoCardProps extends MotionDivProps {
  variant?: 'default' | 'elevated'
  hover?: boolean
  children: ReactNode
}

export default function NeoCard({
  children,
  className = '',
  variant = 'default',
  hover = false,
  ...props
}: NeoCardProps) {
  return (
    <motion.div
      className={`${variant === 'elevated' ? 'neo-card-elevated' : 'neo-card'} ${className}`}
      whileHover={hover ? { y: -2, borderColor: '#3b4a61' } : undefined}
      transition={{ duration: 0.2 }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
