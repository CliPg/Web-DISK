import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Trash2,
  RefreshCw,
  Eye,
  X,
  FolderOpen,
} from 'lucide-react'
import GlassCard from '../components/ui/GlassCard'
import { mockDocuments } from '../data/mock'
import type { KGDocument } from '../types'

const statusConfig = {
  pending: {
    icon: Clock,
    label: '等待处理',
    color: 'text-gray-400',
    bg: 'bg-gray-100',
    dotColor: '#8E8E93',
    animate: false,
  },
  processing: {
    icon: Loader2,
    label: '处理中',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    dotColor: '#007AFF',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-green-500',
    bg: 'bg-green-50',
    dotColor: '#34C759',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: '处理失败',
    color: 'text-red-500',
    bg: 'bg-red-50',
    dotColor: '#FF3B30',
    animate: false,
  },
}

const fileTypeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pdf: { icon: '📄', color: '#FF3B30', bg: 'bg-red-50' },
  docx: { icon: '📝', color: '#007AFF', bg: 'bg-blue-50' },
  txt: { icon: '📃', color: '#8E8E93', bg: 'bg-gray-50' },
  md: { icon: '📋', color: '#AF52DE', bg: 'bg-purple-50' },
}

export default function DocumentsView() {
  const [documents, setDocuments] = useState<KGDocument[]>(mockDocuments)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<KGDocument | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach((file) => {
      const newDoc: KGDocument = {
        id: `d${Date.now()}-${Math.random()}`,
        name: file.name,
        fileType: file.name.split('.').pop() as KGDocument['fileType'],
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        pages: Math.floor(Math.random() * 100) + 10,
        status: 'pending',
        progress: 0,
        uploadedAt: new Date().toISOString().split('T')[0],
      }
      setDocuments((prev) => [newDoc, ...prev])
    })
  }

  const handleDelete = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setMenuOpen(null)
  }

  const handleRetry = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, status: 'pending' as const, progress: 0 } : d
      )
    )
    setMenuOpen(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const newDoc: KGDocument = {
        id: `d${Date.now()}-${Math.random()}`,
        name: file.name,
        fileType: file.name.split('.').pop() as KGDocument['fileType'],
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        pages: Math.floor(Math.random() * 100) + 10,
        status: 'pending',
        progress: 0,
        uploadedAt: new Date().toISOString().split('T')[0],
      }
      setDocuments((prev) => [newDoc, ...prev])
    })
  }

  const stats = [
    { key: 'all', label: '全部', value: documents.length, color: '#1d1d1f' },
    { key: 'processing', label: '处理中', value: documents.filter((d) => d.status === 'processing').length, color: '#007AFF' },
    { key: 'completed', label: '已完成', value: documents.filter((d) => d.status === 'completed').length, color: '#34C759' },
    { key: 'pending', label: '待处理', value: documents.filter((d) => d.status === 'pending').length, color: '#8E8E93' },
  ]

  const filteredDocuments = activeFilter === 'all' 
    ? documents 
    : documents.filter((d) => d.status === activeFilter)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">文档管理</h1>
          <p className="text-gray-500 mt-1">上传和管理您的知识文档</p>
        </div>
        <motion.button
          className="px-6 py-3 bg-[#007AFF] text-white rounded-xl font-medium text-[15px] flex items-center gap-2.5 shadow-lg shadow-[#007AFF]/25"
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-5 h-5" />
          上传文档
        </motion.button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Area - 更大更明显 */}
      <GlassCard
        className={`p-8 border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? 'border-[#007AFF] bg-[#007AFF]/5 scale-[1.01]'
            : 'border-gray-200/60 hover:border-gray-300/80'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-6">
          <motion.div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              isDragging ? 'bg-[#007AFF]/10' : 'bg-gray-100'
            }`}
            animate={{ scale: isDragging ? 1.15 : 1, rotate: isDragging ? 5 : 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Upload className={`w-8 h-8 ${isDragging ? 'text-[#007AFF]' : 'text-gray-400'}`} />
          </motion.div>
          <p className="text-gray-800 font-medium text-lg mb-2">拖拽文件到此处上传</p>
          <p className="text-sm text-gray-400 mb-4">支持 PDF、DOCX、TXT、Markdown 格式</p>
          <motion.button
            className="px-5 py-2.5 text-[15px] text-[#007AFF] font-medium rounded-xl hover:bg-[#007AFF]/5 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            或点击选择文件
          </motion.button>
        </div>
      </GlassCard>

      {/* Stats & Filter Tabs - 合并为一体 */}
      <div className="flex items-center gap-2 p-2 glass rounded-2xl w-fit">
        {stats.map((stat) => (
          <motion.button
            key={stat.key}
            className={`px-5 py-3 rounded-xl flex items-center gap-3 transition-all ${
              activeFilter === stat.key
                ? 'bg-white shadow-sm'
                : 'hover:bg-white/50'
            }`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveFilter(stat.key)}
          >
            <span className={`text-[15px] ${activeFilter === stat.key ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
              {stat.label}
            </span>
            <span
              className={`text-[15px] font-semibold px-2.5 py-1 rounded-lg ${
                activeFilter === stat.key ? 'bg-gray-100' : 'bg-transparent'
              }`}
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Document List - 表格式布局更整洁 */}
      {filteredDocuments.length > 0 ? (
        <GlassCard className="overflow-hidden" variant="heavy">
          <div className="divide-y divide-gray-100">
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((doc, index) => {
                const status = statusConfig[doc.status]
                const StatusIcon = status.icon
                const fileConfig = fileTypeConfig[doc.fileType] || fileTypeConfig.txt

                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className="flex items-center gap-5 p-5 hover:bg-black/[0.02] transition-colors group"
                  >
                    {/* File Icon */}
                    <div className={`w-12 h-12 rounded-xl ${fileConfig.bg} flex items-center justify-center text-2xl shrink-0`}>
                      {fileConfig.icon}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate mb-1">{doc.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-400">
                        <span>{doc.size}</span>
                        <span>·</span>
                        <span>{doc.pages} 页</span>
                        <span>·</span>
                        <span>{doc.uploadedAt}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-6 shrink-0">
                      {/* Progress or Status Badge */}
                      {doc.status === 'processing' ? (
                        <div className="flex items-center gap-3 w-32">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-[#007AFF] rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${doc.progress}%` }}
                            />
                          </div>
                          <span className="text-sm text-[#007AFF] font-medium w-10 text-right">{doc.progress}%</span>
                        </div>
                      ) : (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${status.bg}`}>
                          <StatusIcon className={`w-4 h-4 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                          <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                        </div>
                      )}

                      {/* Extracted Stats */}
                      {doc.status === 'completed' && doc.entities && (
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
                            <span className="text-gray-500">{doc.entities} 实体</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                            <span className="text-gray-500">{doc.relations} 关系</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="relative">
                        <motion.button
                          className="w-9 h-9 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuOpen(menuOpen === doc.id ? null : doc.id)
                          }}
                        >
                          <MoreHorizontal className="w-5 h-5" />
                        </motion.button>

                        {/* Dropdown Menu */}
                        <AnimatePresence>
                          {menuOpen === doc.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute right-0 top-11 w-40 glass-heavy shadow-glass-lg rounded-xl py-2 z-20"
                            >
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-black/5 flex items-center gap-3"
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setMenuOpen(null)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                查看详情
                              </button>
                              {doc.status === 'error' && (
                                <button
                                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-black/5 flex items-center gap-3"
                                  onClick={() => handleRetry(doc.id)}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  重新处理
                                </button>
                              )}
                              <button
                                className="w-full px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-3"
                                onClick={() => handleDelete(doc.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                删除
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </GlassCard>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-10 h-10 text-gray-300" />
          </div>
          <p className="text-gray-500 text-lg mb-1">暂无文档</p>
          <p className="text-sm text-gray-400">上传您的第一个文档开始构建知识图谱</p>
        </motion.div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              className="glass-heavy shadow-glass-lg rounded-2xl p-8 w-full max-w-lg"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className={`w-16 h-16 rounded-xl ${fileTypeConfig[selectedDoc.fileType]?.bg || 'bg-gray-100'} flex items-center justify-center text-4xl`}>
                  {fileTypeConfig[selectedDoc.fileType]?.icon || '📄'}
                </div>
                <motion.button
                  className="w-9 h-9 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mb-2">{selectedDoc.name}</h2>
              <p className="text-sm text-gray-500 mb-8">上传于 {selectedDoc.uploadedAt}</p>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">文件大小</p>
                  <p className="font-semibold text-gray-700">{selectedDoc.size}</p>
                </div>
                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">页数</p>
                  <p className="font-semibold text-gray-700">{selectedDoc.pages} 页</p>
                </div>
                {selectedDoc.entities && (
                  <>
                    <div className="p-4 rounded-xl bg-blue-50">
                      <p className="text-xs text-blue-400 mb-1">提取实体</p>
                      <p className="font-semibold text-blue-600">{selectedDoc.entities} 个</p>
                    </div>
                    <div className="p-4 rounded-xl bg-green-50">
                      <p className="text-xs text-green-400 mb-1">提取关系</p>
                      <p className="font-semibold text-green-600">{selectedDoc.relations} 个</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-4">
                <motion.button
                  className="flex-1 px-5 py-3 bg-[#007AFF] text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-[#007AFF]/20"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4" />
                  查看图谱
                </motion.button>
                <motion.button
                  className="px-5 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  重新处理
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
