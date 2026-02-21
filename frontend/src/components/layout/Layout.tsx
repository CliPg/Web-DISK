import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="min-h-screen flex">
      {/* 固定宽度的侧边栏容器 */}
      <div className="w-[72px] shrink-0">
        <Sidebar />
      </div>
      {/* 主内容区域 */}
      <main className="flex-1 min-h-screen overflow-x-hidden">
        <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
