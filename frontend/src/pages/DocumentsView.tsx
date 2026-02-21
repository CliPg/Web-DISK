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
    animate: false,
  },
  processing: {
    icon: Loader2,
    label: '处理中',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-green-500',
    bg: 'bg-green-50',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: '处理失败',
    color: 'text-red-500',
    bg: 'bg-red-50',
    animate: false,
  },
}

const fileTypeIcons: Record<string, string> = {
  pdf: '📄',
  docx: '📝',
  txt: '📃',
  md: '📋',
}

export default function DocumentsView() {
  const [documents, setDocuments] = useState<KGDocument[]>(mockDocuments)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<KGDocument | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">文档管理</h1>
          <p className="text-gray-500 mt-1">上传和管理您的知识文档</p>
        </div>
        <motion.button
          className="px-4 py-2.5 bg-[#007AFF] text-white rounded-xl font-medium flex items-center gap-2 shadow-lg shadow-[#007AFF]/20"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4" />
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '全部文档', value: documents.length, color: '#1d1d1f' },
          { label: '处理中', value: documents.filter((d) => d.status === 'processing').length, color: '#007AFF' },
          { label: '已完成', value: documents.filter((d) => d.status === 'completed').length, color: '#34C759' },
          { label: '待处理', value: documents.filter((d) => d.status === 'pending').length, color: '#8E8E93' },
        ].map((stat) => (
          <GlassCard key={stat.label} className="p-4" hover>
            <p className="text-sm text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-semibold" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Upload Area */}
      <GlassCard
        className={`p-6 border-2 border-dashed transition-colors duration-200 ${
          isDragging
            ? 'border-[#007AFF] bg-[#007AFF]/5'
            : 'border-gray-200/60 hover:border-gray-300'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-4">
          <motion.div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
              isDragging ? 'bg-[#007AFF]/10' : 'bg-gray-100'
            }`}
            animate={{ scale: isDragging ? 1.1 : 1 }}
          >
            <Upload className={`w-7 h-7 ${isDragging ? 'text-[#007AFF]' : 'text-gray-400'}`} />
          </motion.div>
          <p className="text-gray-700 font-medium mb-1">拖拽文件到此处上传</p>
          <p className="text-sm text-gray-400">支持 PDF、DOCX、TXT、MD 格式</p>
        </div>
      </GlassCard>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {documents.map((doc, index) => {
            const status = statusConfig[doc.status]
            const StatusIcon = status.icon

            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.03 }}
              >
                <GlassCard className="p-4 relative group" hover>
                  {/* Menu Button */}
                  <div className="absolute top-3 right-3 z-10">
                    <motion.button
                      className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(menuOpen === doc.id ? null : doc.id)
                      }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </motion.button>

                    {/* Dropdown Menu */}
                    <AnimatePresence>
                      {menuOpen === doc.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-0 top-10 w-36 glass-heavy shadow-glass-lg rounded-xl py-1.5 z-20"
                        >
                          <button
                            className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-black/5 flex items-center gap-2"
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
                              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-black/5 flex items-center gap-2"
                              onClick={() => handleRetry(doc.id)}
                            >
                              <RefreshCw className="w-4 h-4" />
                              重新处理
                            </button>
                          )}
                          <button
                            className="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            删除
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* File Icon & Info */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
                      {fileTypeIcons[doc.fileType] || '📄'}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="font-medium text-gray-800 truncate">{doc.name}</h3>
                      <p className="text-sm text-gray-400">{doc.size} · {doc.pages} 页</p>
                    </div>
                  </div>

                  {/* Status & Progress */}
                  <div className="flex items-center justify-between mb-2">
                    <div className={`flex items-center gap-1.5 ${status.color}`}>
                      <StatusIcon className={`w-4 h-4 ${status.animate ? 'animate-spin' : ''}`} />
                      <span className="text-sm font-medium">{status.label}</span>
                    </div>
                    {doc.status === 'processing' && (
                      <span className="text-sm text-gray-500">{doc.progress}%</span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {(doc.status === 'processing' || doc.status === 'completed') && (
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          doc.status === 'completed' ? 'bg-green-500' : 'bg-[#007AFF]'
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${doc.progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  )}

                  {/* Extracted Info */}
                  {doc.status === 'completed' && doc.entities && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
                        <span className="text-xs text-gray-500">{doc.entities} 实体</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#34C759]" />
                        <span className="text-xs text-gray-500">{doc.relations} 关系</span>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              className="glass-heavy shadow-glass-lg rounded-2xl p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-3xl">
                  {fileTypeIcons[selectedDoc.fileType] || '📄'}
                </div>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mb-1">{selectedDoc.name}</h2>
              <p className="text-sm text-gray-500 mb-6">上传于 {selectedDoc.uploadedAt}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">文件大小</p>
                  <p className="font-medium text-gray-700">{selectedDoc.size}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50">
                  <p className="text-xs text-gray-400 mb-1">页数</p>
                  <p className="font-medium text-gray-700">{selectedDoc.pages} 页</p>
                </div>
                {selectedDoc.entities && (
                  <>
                    <div className="p-3 rounded-xl bg-blue-50">
                      <p className="text-xs text-blue-400 mb-1">提取实体</p>
                      <p className="font-medium text-blue-600">{selectedDoc.entities} 个</p>
                    </div>
                    <div className="p-3 rounded-xl bg-green-50">
                      <p className="text-xs text-green-400 mb-1">提取关系</p>
                      <p className="font-medium text-green-600">{selectedDoc.relations} 个</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 px-4 py-2.5 bg-[#007AFF] text-white rounded-xl font-medium flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4" />
                  查看图谱
                </motion.button>
                <motion.button
                  className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
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
