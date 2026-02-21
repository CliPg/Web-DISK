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
  { icon: Share2, label: '图谱可视化', path: '/', description: '浏览知识图谱' },
  { icon: FileText, label: '文档管理', path: '/documents', description: '管理知识文档' },
  { icon: Search, label: '知识搜索', path: '/search', description: '搜索实体关系' },
  { icon: Activity, label: '流程监控', path: '/pipeline', description: '查看处理进度' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="neo-sidebar h-screen w-[260px] flex flex-col sticky top-0 left-0 z-50">
      {/* Logo Header */}
      <div className="p-5 border-b border-[#2a3548]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00b4d8] to-[#0096c7] flex items-center justify-center shadow-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#f0f4f8]">DISK</h1>
            <p className="text-xs text-[#64748b]">知识图谱工作台</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-[#64748b] uppercase tracking-wider">
            主要功能
          </span>
        </div>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
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
      <div className="p-4 border-t border-[#2a3548]">
        <div className="neo-card p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#64748b]">图谱状态</span>
            <span className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-lg font-semibold text-[#f0f4f8]">15</div>
              <div className="text-xs text-[#64748b]">实体数量</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-[#f0f4f8]">18</div>
              <div className="text-xs text-[#64748b]">关系数量</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Settings */}
      <div className="p-3 border-t border-[#2a3548]">
        <motion.button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[#94a3b8] hover:text-[#f0f4f8] hover:bg-[#1a2332] transition-colors duration-200"
          whileTap={{ scale: 0.98 }}
        >
          <Settings className="w-5 h-5" strokeWidth={1.5} />
          <span className="text-sm font-medium">设置</span>
        </motion.button>
      </div>
    </aside>
  )
}
