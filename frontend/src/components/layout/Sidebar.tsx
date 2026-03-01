import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Share2,
  FileText,
  Search,
  Activity,
  Settings,
  Database,
  Network,
  Clock,
  History,
} from 'lucide-react'

const navItems = [
  { icon: Share2, label: 'Visualize', path: '/'},
  { icon: Network, label: 'Graphs', path: '/graphs'},
  { icon: FileText, label: 'Document', path: '/documents'},
  { icon: Search, label: 'Search', path: '/search'},
  { icon: Clock, label: 'History', path: '/history'},
  { icon: Activity, label: 'Monitor', path: '/pipeline'},
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="neo-sidebar h-screen w-[240px] flex flex-col sticky top-0 left-0 z-50">
      {/* Logo Header */}
      <div className="px-6 py-10 min-h-[48px] border-b border-[#2a3548] flex items-center">
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
      <nav className="flex-1 pl-2 pr-4 py-6 space-y-5">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ marginBottom: '4px', marginTop: index === 0 ? '8px' : '0', width: 'calc(100% - 4px)', paddingLeft: '18px' }}
              className={`flex items-center gap-5 px-3 py-5 min-h-[44px] rounded-xl text-left transition-all duration-200 group relative ${
                isActive
                  ? 'bg-[#00b4d8]/10 text-[#00b4d8]'
                  : 'text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1a2332]'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#00b4d8]' : ''}`}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-base">{item.label}</div>
              </div>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#00b4d8] rounded-r-full" />
              )}
            </motion.button>
          )
        })}
      </nav>
    </aside>
  )
}
