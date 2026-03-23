import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  Share2,
  FileText,
  Search,
  Activity,
  Database,
  Network,
  Clock,
  MessageSquare,
  Sun,
  Moon,
} from 'lucide-react'

const navItems = [
  { icon: Share2, label: 'Visualize', path: '/'},
  { icon: Network, label: 'Graphs', path: '/graphs'},
  { icon: FileText, label: 'Document', path: '/documents'},
  { icon: Search, label: 'Search', path: '/search'},
  { icon: Clock, label: 'History', path: '/history'},
  { icon: Activity, label: 'Monitor', path: '/pipeline'},
  { icon: MessageSquare, label: 'Chat', path: '/chat'},
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  )

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <aside className="neo-sidebar h-screen w-[240px] flex flex-col sticky top-0 left-0 z-50">
      {/* Logo Header */}
      <div className="px-6 py-10 min-h-[48px] border-b border-neo-border flex items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neo-accent to-neo-accent-dark flex items-center justify-center shadow-lg">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neo-text">DISK</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 pl-2 pr-4 py-6 space-y-2 overflow-y-auto">
        {navItems.map((item, index) => {
          const isActive = location.pathname === item.path
          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ width: 'calc(100% - 4px)', paddingLeft: '18px' }}
              className={`flex items-center gap-5 px-3 py-4 min-h-[44px] rounded-xl text-left transition-all duration-200 group relative ${
                isActive
                  ? 'bg-neo-accent/10 text-neo-accent'
                  : 'text-neo-text-secondary hover:text-neo-text hover:bg-neo-surface-light'
              }`}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon
                className={`w-5 h-5 shrink-0 ${isActive ? 'text-neo-accent' : ''}`}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-base">{item.label}</div>
              </div>
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-neo-accent rounded-r-full" />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Theme Toggle Button */}
      <div className="p-4 border-t border-neo-border">
        <motion.button
          onClick={toggleTheme}
          className="w-full flex items-center gap-5 px-5 py-4 rounded-xl text-neo-text-secondary hover:text-neo-text hover:bg-neo-surface-light transition-all duration-200"
          whileTap={{ scale: 0.95 }}
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span className="font-medium text-base">深色模式</span>
            </>
          ) : (
            <>
              <Sun className="w-5 h-5 shrink-0" strokeWidth={1.5} />
              <span className="font-medium text-base">浅色模式</span>
            </>
          )}
        </motion.button>
      </div>
    </aside>
  )
}
