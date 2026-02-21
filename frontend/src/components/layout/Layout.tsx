import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="min-h-screen flex bg-[#0a0e17]">
      {/* Neo4j 风格侧边栏 */}
      <Sidebar />
      {/* 主内容区域 */}
      <main className="flex-1 min-h-screen overflow-x-hidden">
        <div className="p-6 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
