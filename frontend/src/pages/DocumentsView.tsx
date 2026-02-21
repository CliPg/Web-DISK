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
import NeoCard from '../components/ui/GlassCard'
import { mockDocuments } from '../data/mock'
import type { KGDocument } from '../types'

const statusConfig = {
  pending: {
    icon: Clock,
    label: '等待处理',
    color: 'text-[#64748b]',
    bg: 'bg-[#64748b]/10',
    dotColor: '#64748b',
    animate: false,
  },
  processing: {
    icon: Loader2,
    label: '处理中',
    color: 'text-[#00b4d8]',
    bg: 'bg-[#00b4d8]/10',
    dotColor: '#00b4d8',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-[#00c853]',
    bg: 'bg-[#00c853]/10',
    dotColor: '#00c853',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: '处理失败',
    color: 'text-[#f44336]',
    bg: 'bg-[#f44336]/10',
    dotColor: '#f44336',
    animate: false,
  },
}

const fileTypeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pdf: { icon: '📄', color: '#f44336', bg: 'bg-[#f44336]/10' },
  docx: { icon: '📝', color: '#3b82f6', bg: 'bg-[#3b82f6]/10' },
  txt: { icon: '📃', color: '#64748b', bg: 'bg-[#64748b]/10' },
  md: { icon: '📋', color: '#a855f7', bg: 'bg-[#a855f7]/10' },
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
    { key: 'all', label: '全部', value: documents.length, color: '#f0f4f8' },
    { key: 'processing', label: '处理中', value: documents.filter((d) => d.status === 'processing').length, color: '#00b4d8' },
    { key: 'completed', label: '已完成', value: documents.filter((d) => d.status === 'completed').length, color: '#00c853' },
    { key: 'pending', label: '待处理', value: documents.filter((d) => d.status === 'pending').length, color: '#64748b' },
  ]

  const filteredDocuments = activeFilter === 'all' 
    ? documents 
    : documents.filter((d) => d.status === activeFilter)

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">文档管理</h1>
          <p className="text-[#64748b] text-sm mt-0.5">上传和管理您的知识文档</p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          accept=".pdf,.docx,.txt,.md"
          onChange={handleFileSelect}
        />
      </div>

      {/* Upload Area */}
      <NeoCard
        className={`p-6 border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? 'border-[#00b4d8] bg-[#00b4d8]/5'
            : 'border-[#2a3548] hover:border-[#3b4a61]'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center py-4">
          <motion.div
            className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
              isDragging ? 'bg-[#00b4d8]/10' : 'bg-[#1a2332]'
            } border border-[#2a3548]`}
            animate={{ scale: isDragging ? 1.1 : 1 }}
          >
            <Upload className={`w-6 h-6 ${isDragging ? 'text-[#00b4d8]' : 'text-[#64748b]'}`} />
          </motion.div>
          <p className="text-[#f0f4f8] font-medium mb-1">拖拽文件到此处上传</p>
          <p className="text-sm text-[#64748b] mb-3">支持 PDF、DOCX、TXT、Markdown 格式</p>
          <motion.button
            className="px-4 py-2 text-sm text-[#00b4d8] font-medium rounded-lg hover:bg-[#00b4d8]/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
          >
            或点击选择文件
          </motion.button>
        </div>
      </NeoCard>

      {/* Stats & Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 neo-card">
        {stats.map((stat) => (
          <motion.button
            key={stat.key}
            style={{ minWidth: '100px' }}
            className={`px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeFilter === stat.key
                ? 'bg-[#1a2332] border border-[#2a3548]'
                : 'hover:bg-[#1a2332]/50'
            }`}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveFilter(stat.key)}
          >
            <span className={`text-sm ${activeFilter === stat.key ? 'text-[#f0f4f8] font-medium' : 'text-[#94a3b8]'}`}>
              {stat.label}
            </span>
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded-md ${
                activeFilter === stat.key ? 'bg-[#0a0e17]' : 'bg-transparent'
              }`}
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Document List */}
      {filteredDocuments.length > 0 ? (
        <NeoCard className="flex-1 overflow-hidden" variant="elevated">
          <div className="divide-y divide-[#2a3548]">
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
                    className="flex items-center gap-4 p-4 hover:bg-[#1a2332]/50 transition-colors group"
                    style={{ marginBottom: index < filteredDocuments.length - 1 ? '8px' : '0' }}
                  >
                    {/* File Icon */}
                    <div className={`w-11 h-11 rounded-lg ${fileConfig.bg} flex items-center justify-center text-xl shrink-0`}>
                      {fileConfig.icon}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#f0f4f8] truncate mb-0.5">{doc.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-[#64748b]">
                        <span>{doc.size}</span>
                        <span>·</span>
                        <span>{doc.pages} 页</span>
                        <span>·</span>
                        <span>{doc.uploadedAt}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Progress or Status Badge */}
                      {doc.status === 'processing' ? (
                        <div className="flex items-center gap-2 w-28">
                          <div className="flex-1 h-1.5 neo-progress overflow-hidden">
                            <motion.div
                              className="neo-progress-bar"
                              initial={{ width: 0 }}
                              animate={{ width: `${doc.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#00b4d8] font-medium w-9 text-right">{doc.progress}%</span>
                        </div>
                      ) : (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md ${status.bg}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${status.color} ${status.animate ? 'animate-spin' : ''}`} />
                          <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                        </div>
                      )}

                      {/* Extracted Stats */}
                      {doc.status === 'completed' && doc.entities && (
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]" />
                            <span className="text-[#94a3b8]">{doc.entities} 实体</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
                            <span className="text-[#94a3b8]">{doc.relations} 关系</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="relative">
                        <motion.button
                          className="w-8 h-8 rounded-lg hover:bg-[#2a3548] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8] opacity-0 group-hover:opacity-100 transition-all"
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
                              initial={{ opacity: 0, scale: 0.95, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -5 }}
                              className="absolute right-0 top-10 w-36 neo-card-elevated py-1.5 z-20"
                            >
                              <button
                                className="w-full px-3 py-2 text-left text-sm text-[#94a3b8] hover:bg-[#1a2332] hover:text-[#f0f4f8] flex items-center gap-2"
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
                                  className="w-full px-3 py-2 text-left text-sm text-[#94a3b8] hover:bg-[#1a2332] hover:text-[#f0f4f8] flex items-center gap-2"
                                  onClick={() => handleRetry(doc.id)}
                                >
                                  <RefreshCw className="w-4 h-4" />
                                  重新处理
                                </button>
                              )}
                              <button
                                className="w-full px-3 py-2 text-left text-sm text-[#f44336] hover:bg-[#f44336]/10 flex items-center gap-2"
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
        </NeoCard>
      ) : (
        /* Empty State */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col items-center justify-center"
        >
          <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mb-4 border border-[#2a3548]">
            <FolderOpen className="w-8 h-8 text-[#64748b]" />
          </div>
          <p className="text-[#94a3b8] mb-1">暂无文档</p>
          <p className="text-sm text-[#64748b]">上传您的第一个文档开始构建知识图谱</p>
        </motion.div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedDoc && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedDoc(null)}
          >
            <motion.div
              className="neo-card-elevated p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-5">
                <div className={`w-14 h-14 rounded-xl ${fileTypeConfig[selectedDoc.fileType]?.bg || 'bg-[#1a2332]'} flex items-center justify-center text-3xl`}>
                  {fileTypeConfig[selectedDoc.fileType]?.icon || '📄'}
                </div>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <h2 className="text-lg font-semibold text-[#f0f4f8] mb-1">{selectedDoc.name}</h2>
              <p className="text-sm text-[#64748b] mb-6">上传于 {selectedDoc.uploadedAt}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                  <p className="text-xs text-[#64748b] mb-0.5">文件大小</p>
                  <p className="font-medium text-[#f0f4f8]">{selectedDoc.size}</p>
                </div>
                <div className="p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                  <p className="text-xs text-[#64748b] mb-0.5">页数</p>
                  <p className="font-medium text-[#f0f4f8]">{selectedDoc.pages} 页</p>
                </div>
                {selectedDoc.entities && (
                  <>
                    <div className="p-3 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30">
                      <p className="text-xs text-[#3b82f6] mb-0.5">提取实体</p>
                      <p className="font-medium text-[#3b82f6]">{selectedDoc.entities} 个</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#00c853]/10 border border-[#00c853]/30">
                      <p className="text-xs text-[#00c853] mb-0.5">提取关系</p>
                      <p className="font-medium text-[#00c853]">{selectedDoc.relations} 个</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-primary rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <FileText className="w-4 h-4" />
                  查看图谱
                </motion.button>
                <motion.button
                  className="px-4 py-2.5 neo-btn-secondary rounded-lg font-medium text-sm"
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
