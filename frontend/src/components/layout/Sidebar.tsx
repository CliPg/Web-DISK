import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Share2,
  FileText,
  Search,
  Activity,
  Settings,
  Sparkles,
} from 'lucide-react'

const navItems = [
  { icon: Share2,   label: '图谱可视化', path: '/' },
  { icon: FileText, label: '文档管理',   path: '/documents' },
  { icon: Search,   label: '知识搜索',   path: '/search' },
  { icon: Activity, label: '流程监控',   path: '/pipeline' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="glass-sidebar h-screen w-[72px] flex flex-col items-center py-6 gap-2 fixed left-0 top-0 z-50">
      {/* Logo */}
      <motion.div
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#007AFF] to-[#5AC8FA] flex items-center justify-center mb-6 cursor-pointer shadow-lg shadow-[#007AFF]/20"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/')}
      >
        <Sparkles className="w-5 h-5 text-white" />
      </motion.div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 group ${
                isActive
                  ? 'bg-[#007AFF]/10 text-[#007AFF]'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-black/5'
              }`}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
            >
              <item.icon className="w-[20px] h-[20px]" strokeWidth={isActive ? 2 : 1.5} />

              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#007AFF] rounded-r-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                />
              )}

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-xl z-50">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-800" />
              </div>
            </motion.button>
          )
        })}
      </nav>

      {/* Bottom settings */}
      <motion.button
        className="w-11 h-11 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-black/5 transition-colors duration-200"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
      >
        <Settings className="w-[20px] h-[20px]" strokeWidth={1.5} />
      </motion.button>
    </aside>
  )
}
