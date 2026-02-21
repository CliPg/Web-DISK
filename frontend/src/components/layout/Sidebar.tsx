import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Share2,
  FileText,
  Search,
  Activity,
  Settings,
  Database,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { icon: Share2, label: 'Visualize', path: '/'},
  { icon: FileText, label: 'Document', path: '/documents'},
  { icon: Search, label: 'Search', path: '/search'},
  { icon: Activity, label: 'Monitor', path: '/pipeline'},
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="neo-sidebar h-screen w-[260px] flex flex-col sticky top-0 left-0 z-50">
      {/* Logo Header */}
      <div className="px-6 py-8 border-b border-[#2a3548]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00b4d8] to-[#0096c7] flex items-center justify-center shadow-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f0f4f8]">DISK</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-5 py-6 space-y-3">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left transition-all duration-200 group ${
                isActive
                  ? 'bg-[#00b4d8]/10 text-[#00b4d8] border border-[#00b4d8]/30'
                  : 'text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1a2332]'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#00b4d8]' : ''}`}
                strokeWidth={isActive ? 2 : 1.5}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-[#64748b] truncate">{item.description}</div>
              </div>
              {isActive && (
                <ChevronRight className="w-4 h-4 text-[#00b4d8] shrink-0" />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Stats Section */}
      <div className="px-5 py-6 border-t border-[#2a3548]">
        <div className="neo-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b]">图谱状态</span>
            <span className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-2xl font-semibold text-[#f0f4f8]">15</div>
              <div className="text-xs text-[#64748b] mt-1.5">实体数量</div>
            </div>
            <div>
              <div className="text-2xl font-semibold text-[#f0f4f8]">18</div>
              <div className="text-xs text-[#64748b] mt-1.5">关系数量</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Settings */}
      <div className="px-5 py-5 border-t border-[#2a3548]">
        <motion.button
          className="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1a2332] transition-colors duration-200"
          whileTap={{ scale: 0.98 }}
        >
          <Settings className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-sm font-medium">设置</span>
        </motion.button>
      </div>
    </aside>
  )
}
