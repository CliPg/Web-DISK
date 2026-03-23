import { useState, useRef, useEffect, useCallback } from 'react'
import { useSelectedGraph } from '../hooks/useSelectedGraph'
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
  Play,
  StopCircle,
  ChevronDown,
  Network,
  CheckSquare,
  Square,
  Zap,
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { KGDocument } from '../types'
import type { KnowledgeGraph } from '../types'
import { documentsApi, tasksApi, graphsApi } from '../services/api'

const statusConfig = {
  pending: {
    icon: Clock,
    label: '等待处理',
    color: 'text-neo-text-muted',
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

// 后端状态到前端状态的映射
const mapBackendStatus = (status: string): KGDocument['status'] => {
  switch (status) {
    case 'pending':
    case 'uploading':
      return 'pending'
    case 'processing':
      return 'processing'
    case 'completed':
      return 'completed'
    case 'failed':
      return 'error'
    default:
      return 'pending'
  }
}

export default function DocumentsView() {
  const [documents, setDocuments] = useState<KGDocument[]>([])
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([])
  const [graphDropdownOpen, setGraphDropdownOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<KGDocument | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [currentTime, setCurrentTime] = useState(Date.now())  // 用于实时更新构建耗时
  const [isBatchBuilding, setIsBatchBuilding] = useState(false)  // 批量构建中
  const [isBatchSelectMode, setIsBatchSelectMode] = useState(false)  // 批量选择模式
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())  // 批量选中的文档ID
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 存储任务取消订阅的函数
  const unsubscribeRefs = useRef<Map<string, () => void>>(new Map())

  // 使用持久化的选择 hook
  const { selectedGraphId, setSelectedGraphId } = useSelectedGraph(graphs)

  // 加载知识图谱列表
  const fetchGraphs = useCallback(async () => {
    try {
      const data = await graphsApi.list()
      setGraphs(data.graphs)
    } catch (error) {
      console.error('Failed to fetch graphs:', error)
    }
  }, [])

  // 刷新所有数据
  const refreshAll = useCallback(async () => {
    await fetchGraphs()
  }, [fetchGraphs])

  // 解析后端返回的 UTC 时间字符串（后端用 datetime.utcnow() 存储，无时区标记）
  const parseUTCTime = (timeStr: string): Date => {
    const s = timeStr.endsWith('Z') || timeStr.includes('+') || timeStr.includes('-', 10)
      ? timeStr
      : timeStr + 'Z'
    return new Date(s)
  }

  // 计算构建耗时
  const calculateBuildTime = useCallback((taskStartedAt: string | undefined, taskCompletedAt: string | undefined, status: KGDocument['status']): string => {
    console.log('calculateBuildTime called:', { taskStartedAt, taskCompletedAt, status, currentTime })

    // 只有任务开始处理后才计算耗时
    if (!taskStartedAt) return '--'
    if (status === 'pending') return '--'

    const start = parseUTCTime(taskStartedAt)
    console.log('start date:', start, 'getTime():', start.getTime(), 'isNaN:', isNaN(start.getTime()))

    // 检查日期是否有效
    if (isNaN(start.getTime())) {
      console.error('Invalid taskStartedAt:', taskStartedAt)
      return '--'
    }

    // 对于已完成的任务，使用完成时间；对于处理中的任务，使用当前时间
    const end = taskCompletedAt ? parseUTCTime(taskCompletedAt) : new Date(currentTime)
    console.log('end date:', end, 'getTime():', end.getTime())

    if (taskCompletedAt && isNaN(end.getTime())) {
      console.error('Invalid taskCompletedAt:', taskCompletedAt)
      return '--'
    }

    const diffMs = end.getTime() - start.getTime()
    console.log('diffMs:', diffMs)

    // 如果差值小于0，返回 --
    if (diffMs < 0) return '--'

    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)

    console.log('result:', { diffSecs, diffMins, formatted: diffMins > 0 ? `${diffMins}分${diffSecs % 60}秒` : `${diffSecs}秒` })

    if (diffMins > 0) {
      return `${diffMins}分${diffSecs % 60}秒`
    } else {
      return `${diffSecs}秒`
    }
  }, [currentTime])

  // 加载文档列表（依赖于 graphs 数据）
  const fetchDocuments = useCallback(async () => {
    // 确保 graphs 已经加载完成
    if (graphs.length === 0) {
      return
    }

    try {
      setIsLoading(true)
      const data = await documentsApi.list({ limit: 100 })

      console.log('Fetched documents:', data.documents)
      console.log('Available graphs:', graphs)

      const docs: KGDocument[] = data.documents.map((doc) => {
        // 查找关联的知识图谱名称
        const graph = doc.graph_id ? graphs.find((g) => g.id === doc.graph_id) : undefined
        return {
          id: doc.id,
          name: doc.original_filename,
          fileType: doc.filename.split('.').pop() as KGDocument['fileType'] || 'pdf',
          size: `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`,
          pages: 0, // 后端暂未提供页数
          status: mapBackendStatus(doc.status),
          progress: 0,
          uploadedAt: new Date(doc.created_at).toISOString().split('T')[0],
          taskId: doc.task_id,
          errorMessage: doc.error_message,
          filePath: doc.file_path,
          graphId: doc.graph_id,
          graphName: graph?.name,
          taskStartedAt: doc.task_started_at,
          taskCompletedAt: doc.task_completed_at,
        }
      })

      console.log('Processed documents:', docs)
      setDocuments(docs)

      // 为处理中的文档订阅进度更新
      docs.forEach((doc) => {
        if (doc.taskId && doc.status === 'processing') {
          subscribeToTaskProgress(doc.taskId, doc.id)
        }
      })
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [graphs])

  // 订阅任务进度
  const subscribeToTaskProgress = (taskId: string, docId: string) => {
    // 如果已有订阅，先取消
    const existingUnsubscribe = unsubscribeRefs.current.get(docId)
    if (existingUnsubscribe) {
      existingUnsubscribe()
    }

    const unsubscribe = tasksApi.subscribeProgress(
      taskId,
      (data) => {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? {
                  ...d,
                  status: mapBackendStatus(data.status),
                  progress: Math.round(data.progress * 100),
                }
              : d
          )
        )
      },
      (status) => {
        // 任务完成，刷新文档列表
        fetchDocuments()
      },
      (error) => {
        console.error('Task progress error:', error)
      }
    )

    unsubscribeRefs.current.set(docId, unsubscribe)
  }

  // 初始加载文档列表和知识图谱
  useEffect(() => {
    fetchGraphs()

    // 清理函数：取消所有订阅
    return () => {
      unsubscribeRefs.current.forEach((unsubscribe) => unsubscribe())
      unsubscribeRefs.current.clear()
    }
  }, [])

  // 当 graphs 加载完成后，获取文档列表以关联图谱名称
  useEffect(() => {
    if (graphs.length > 0) {
      fetchDocuments()
    }
  }, [graphs])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.graph-dropdown')) {
        setGraphDropdownOpen(false)
      }
    }

    if (graphDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [graphDropdownOpen])

  // 每秒更新当前时间，用于实时计算处理中文档的构建耗时
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)

    for (const file of files) {
      await uploadFile(file)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // 重置input以允许再次选择相同文件
    e.target.value = ''

    for (const file of files) {
      await uploadFile(file)
    }
  }

  const uploadFile = async (file: File) => {
    // 检查文件类型
    const validExtensions = ['pdf', 'docx', 'txt', 'md']
    const fileExt = file.name.split('.').pop()?.toLowerCase()
    if (!validExtensions.includes(fileExt || '')) {
      alert('不支持的文件类型')
      return
    }

    // 获取当前选中的知识图谱信息
    const currentGraph = graphs.find((g) => g.id === selectedGraphId)

    // 创建临时文档显示上传中状态
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const tempDoc: KGDocument = {
      id: tempId,
      name: file.name,
      fileType: fileExt as KGDocument['fileType'] || 'pdf',
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      pages: 0,
      status: 'pending',
      progress: 0,
      uploadedAt: new Date().toISOString().split('T')[0],
      graphId: selectedGraphId ?? undefined,
      graphName: currentGraph?.name,
    }

    setDocuments((prev) => [tempDoc, ...prev])
    setIsUploading(true)

    try {
      // 调用上传API，传递选中的知识图谱ID
      const result = await documentsApi.upload(file, selectedGraphId ?? undefined)

      // 上传成功，更新文档信息并订阅任务进度
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? {
                ...d,
                id: result.document_id,
                taskId: result.task_id,
                status: mapBackendStatus(result.status),
              }
            : d
        )
      )

      // 订阅任务进度
      subscribeToTaskProgress(result.task_id, result.document_id)
    } catch (error) {
      console.error('Upload failed:', error)
      // 上传失败，显示错误状态
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === tempId
            ? { ...d, status: 'error', errorMessage: error instanceof Error ? error.message : '上传失败' }
            : d
        )
      )
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await documentsApi.delete(id)

      // 取消该文档的任务订阅
      const unsubscribe = unsubscribeRefs.current.get(id)
      if (unsubscribe) {
        unsubscribe()
        unsubscribeRefs.current.delete(id)
      }

      // 从列表中移除
      setDocuments((prev) => prev.filter((d) => d.id !== id))
      setMenuOpen(null)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('删除失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const handleRetry = async (id: string) => {
    // 重新处理功能 - 开始构建
    await handleStartProcessing(id)
    setMenuOpen(null)
  }

  const handleStartProcessing = async (id: string) => {
    try {
      const result = await documentsApi.startProcessing(id)

      // 更新文档状态
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: 'processing', progress: 0, taskId: result.task_id }
            : d
        )
      )

      // 订阅任务进度
      subscribeToTaskProgress(result.task_id, id)

      setMenuOpen(null)
    } catch (error) {
      console.error('Start processing failed:', error)
      alert('开始处理失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  const handleCancelProcessing = async (id: string) => {
    if (!confirm('确定要取消处理吗？')) return

    try {
      if (!id) return

      // 取消任务订阅
      const unsubscribe = unsubscribeRefs.current.get(id)
      if (unsubscribe) {
        unsubscribe()
        unsubscribeRefs.current.delete(id)
      }

      // 调用取消API
      const doc = documents.find((d) => d.id === id)
      if (doc?.taskId) {
        await tasksApi.cancel(doc.taskId)
      }

      // 更新文档状态
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, status: 'pending', progress: 0 }
            : d
        )
      )

      setMenuOpen(null)
    } catch (error) {
      console.error('Cancel failed:', error)
      alert('取消失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 批量构建函数
  const handleBatchBuild = () => {
    const pendingDocs = documents.filter((d) => d.status === 'pending' || d.status === 'error')
    if (pendingDocs.length === 0) {
      alert('没有可构建的文档')
      return
    }
    // 打开批量选择弹窗，不默认选中任何文档
    setIsBatchSelectMode(true)
    setSelectedDocIds(new Set())
  }

  // 关闭批量选择弹窗
  const handleCloseBatchSelect = () => {
    setIsBatchSelectMode(false)
    setSelectedDocIds(new Set())
  }

  // 全选/取消全选
  const handleToggleSelectAll = () => {
    const pendingDocs = documents.filter((d) => d.status === 'pending' || d.status === 'error')
    if (selectedDocIds.size === pendingDocs.length) {
      setSelectedDocIds(new Set())
    } else {
      setSelectedDocIds(new Set(pendingDocs.map((d) => d.id)))
    }
  }

  // 执行批量构建
  const handleExecuteBatchBuild = async () => {
    if (selectedDocIds.size === 0) {
      alert('请至少选择一个文档')
      return
    }

    setIsBatchBuilding(true)
    setIsBatchSelectMode(false)

    try {
      const result = await documentsApi.batchBuild(
        Array.from(selectedDocIds),
        selectedGraphId ?? undefined
      )

      // 更新选中文档的状态为处理中
      setDocuments((prev) =>
        prev.map((d) =>
          selectedDocIds.has(d.id)
            ? { ...d, status: 'processing', progress: 0 }
            : d
        )
      )

      setSelectedDocIds(new Set())

      // 刷新文档列表
      await fetchDocuments()

      alert(`批量构建已开始，共 ${selectedDocIds.size} 个文档`)
    } catch (error) {
      console.error('Batch build failed:', error)
      alert('批量构建失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsBatchBuilding(false)
    }
  }

  // 切换单个文档选择
  const handleToggleSelectDocument = (docId: string) => {
    setSelectedDocIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neo-text">文档管理</h1>
          <p className="text-neo-text-muted text-sm mt-0.5">上传和管理您的知识文档</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept=".pdf,.docx,.txt,.md"
            onChange={handleFileSelect}
          />
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="text-sm text-neo-text-muted hover:text-neo-text hover:bg-neo-surface-light rounded-lg transition-colors flex items-center gap-1.5"
            style={{ padding: '6px 10px 6px 14px' }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Upload Area */}
      <NeoCard
        className={`p-6 border-2 border-dashed transition-all duration-300 ${
          isDragging
            ? 'border-[#00b4d8] bg-[#00b4d8]/5'
            : 'border-neo-border hover:border-neo-border-light'
        } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Graph Selector */}
        {graphs.length > 0 && (
          <div className="mb-5 flex items-center gap-3 graph-dropdown" style={{ paddingTop: '8px', paddingLeft: '8px' }}>
            <span className="text-sm text-neo-text-secondary whitespace-nowrap">上传到:</span>
            <div className="relative">
              <motion.button
                className="flex items-center gap-2 neo-card rounded-lg text-sm min-w-[180px] justify-between hover:border-[#00b4d8]/50 transition-colors"
                style={{ padding: '8px 10px' }}
                onClick={() => setGraphDropdownOpen(!graphDropdownOpen)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-[#00b4d8]/20 flex items-center justify-center">
                    <Network className="w-3 h-3 text-[#00b4d8]" />
                  </div>
                  <span className="text-neo-text">
                    {graphs.find((g) => g.id === selectedGraphId)?.name || '选择知识图谱'}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-neo-text-muted transition-transform ${graphDropdownOpen ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {graphDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 mt-2 w-full neo-card-elevated rounded-lg z-10"
                    style={{ padding: '8px 8px' }}
                  >
                    {graphs.map((graph) => (
                      <button
                        key={graph.id}
                        className="w-full text-left text-sm flex items-center gap-2 whitespace-nowrap rounded-lg transition-all hover:bg-[#232d3f]"
                        style={{ padding: '6px 10px' }}
                        onClick={() => {
                          setSelectedGraphId(graph.id)
                          setGraphDropdownOpen(false)
                        }}
                      >
                        <div className="w-5 h-5 rounded bg-[#00b4d8]/20 flex items-center justify-center shrink-0">
                          <Network className="w-3 h-3 text-[#00b4d8]" />
                        </div>
                        <span className="text-neo-text truncate">{graph.name}</span>
                        {selectedGraphId === graph.id && (
                          <CheckCircle2 className="w-4 h-4 text-[#00c853] ml-auto shrink-0" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        <div className="flex flex-col items-center justify-center py-4">
          <motion.div
            className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${
              isDragging ? 'bg-[#00b4d8]/10' : 'bg-neo-surface-light'
            } border border-neo-border`}
            animate={{ scale: isDragging ? 1.1 : 1 }}
          >
            <Upload className={`w-6 h-6 ${isDragging ? 'text-[#00b4d8]' : 'text-neo-text-muted'}`} />
          </motion.div>
          <p className="text-neo-text font-medium mb-1">拖拽文件到此处上传</p>
          <p className="text-sm text-neo-text-muted mb-3">支持 PDF、DOCX、TXT、Markdown 格式</p>
          <motion.button
            className="px-4 py-2 text-sm text-[#00b4d8] font-medium rounded-lg hover:bg-[#00b4d8]/10 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? '上传中...' : '或点击选择文件'}
          </motion.button>
        </div>
      </NeoCard>

      {/* Stats & Filter Tabs */}
      <div className="flex items-center gap-2 neo-card" style={{ padding: '12px' }}>
        {stats.map((stat) => (
          <button
            key={stat.key}
            type="button"
            style={{ minWidth: '100px', minHeight: '36px', padding: '12px 30px' }}
            className={`rounded-lg flex items-center justify-center gap-2 ${
              activeFilter === stat.key
                ? 'bg-neo-surface-light border border-neo-border'
                : 'hover:bg-neo-surface-light/50'
            }`}
            onClick={() => setActiveFilter(stat.key)}
          >
            <span className={`text-sm ${activeFilter === stat.key ? 'text-neo-text font-medium' : 'text-neo-text-secondary'}`}>
              {stat.label}
            </span>
            <span
              className={`text-sm font-semibold px-2 py-0.5 rounded-md ${
                activeFilter === stat.key ? 'bg-neo-bg' : 'bg-transparent'
              }`}
              style={{ color: stat.color }}
            >
              {stat.value}
            </span>
          </button>
        ))}
        {/* 批量构建按钮 */}
        {stats.find(s => s.key === 'pending')?.value && stats.find(s => s.key === 'pending')!.value > 0 && (
          <motion.button
            onClick={handleBatchBuild}
            disabled={isBatchBuilding}
            className="rounded-lg flex items-center justify-center gap-2 bg-[#00c853]/10 hover:bg-[#00c853]/20 text-[#00c853] transition-colors"
            style={{ minWidth: '120px', minHeight: '36px', padding: '12px 20px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Zap className={`w-4 h-4 ${isBatchBuilding ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium">
              {isBatchBuilding ? '批量构建中...' : '批量构建'}
            </span>
          </motion.button>
        )}
      </div>

      {/* Document List */}
      <NeoCard className="flex-1 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-neo-text-muted animate-spin" />
          </div>
        ) : filteredDocuments.length > 0 ? (
          <div className="divide-y divide-[#2a3548]">
            {filteredDocuments.map((doc, index) => {
              const status = statusConfig[doc.status]
              const StatusIcon = status.icon
              const fileConfig = fileTypeConfig[doc.fileType] || fileTypeConfig.txt

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 hover:bg-neo-surface-light/50 group"
                  style={{ marginBottom: index < filteredDocuments.length - 1 ? '8px' : '0', minHeight: '60px', paddingLeft: '8px' }}
                >
                    {/* File Icon */}
                    <div className={`w-12 h-12 rounded-lg ${fileConfig.bg} flex items-center justify-center text-xl shrink-0`}>
                      {fileConfig.icon}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-medium text-neo-text truncate">{doc.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neo-text-muted">
                        <span>{doc.size}</span>
                        {doc.pages > 0 && (
                          <>
                            <span>·</span>
                            <span>{doc.pages} 页</span>
                          </>
                        )}
                        <span>·</span>
                        <span>构建耗时: {calculateBuildTime(doc.taskStartedAt, doc.taskCompletedAt, doc.status)}</span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Graph Name Badge */}
                      {doc.graphName && (
                        <span className="shrink-0 px-2 py-0.5 text-xs rounded-md bg-[#00b4d8]/10 text-[#00b4d8] flex items-center gap-1">
                          <Network className="w-3 h-3" />
                          {doc.graphName}
                        </span>
                      )}

                      {/* Start/Cancel Button - for pending or processing documents */}
                      {(doc.status === 'pending' || doc.status === 'error') && (
                        <motion.button
                          className="w-8 h-8 rounded-lg bg-[#00c853]/20 hover:bg-[#00c853]/30 flex items-center justify-center text-[#00c853] transition-all"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleStartProcessing(doc.id)}
                          title="开始构建"
                        >
                          <Play className="w-4 h-4" />
                        </motion.button>
                      )}

                      {doc.status === 'processing' && (
                        <>
                          <div className="flex items-center gap-2 w-28">
                            <div className="flex-1 h-1.5 neo-progress overflow-hidden">
                              <div
                                className="neo-progress-bar transition-all duration-300"
                                style={{ width: `${doc.progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-[#00b4d8] font-medium w-9 text-right">{doc.progress}%</span>
                          </div>
                          <motion.button
                            className="w-8 h-8 rounded-lg bg-[#f44336]/20 hover:bg-[#f44336]/30 flex items-center justify-center text-[#f44336] transition-all"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCancelProcessing(doc.id)}
                            title="取消构建"
                          >
                            <StopCircle className="w-4 h-4" />
                          </motion.button>
                        </>
                      )}

                      {/* Status Badge - for completed documents */}
                      {doc.status !== 'pending' && doc.status !== 'processing' && doc.status !== 'error' && (
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
                            <span className="text-neo-text-secondary">{doc.entities} 实体</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
                            <span className="text-neo-text-secondary">{doc.relations} 关系</span>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="relative">
                        <motion.button
                          className="w-8 h-8 rounded-lg hover:bg-[#2a3548] flex items-center justify-center text-neo-text-muted hover:text-neo-text opacity-0 group-hover:opacity-100 transition-all"
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
                                className="w-full px-3 py-2 text-left text-sm text-neo-text-secondary hover:bg-neo-surface-light hover:text-neo-text flex items-center gap-2"
                                onClick={() => {
                                  setSelectedDoc(doc)
                                  setMenuOpen(null)
                                }}
                              >
                                <Eye className="w-4 h-4" />
                                查看详情
                              </button>
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
                  </div>
                )
              })}
            </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-xl bg-neo-surface-light flex items-center justify-center mb-4 border border-neo-border">
              <FolderOpen className="w-8 h-8 text-neo-text-muted" />
            </div>
            <p className="text-neo-text-secondary mb-1">暂无文档</p>
            <p className="text-sm text-neo-text-muted">上传您的第一个文档开始构建知识图谱</p>
          </div>
        )}
      </NeoCard>

      {/* Batch Select Modal */}
      <AnimatePresence>
        {isBatchSelectMode && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseBatchSelect}
          >
            <motion.div
              className="neo-card-elevated w-full max-w-2xl max-h-[70vh] flex flex-col"
              style={{ padding: '20px' }}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                <div>
                  <h2 className="text-lg font-semibold text-neo-text">批量构建文档</h2>
                  <p className="text-sm text-neo-text-muted mt-1">选择要构建的文档</p>
                </div>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-neo-surface-light flex items-center justify-center text-neo-text-muted hover:text-neo-text"
                  style={{ padding: '4px' }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCloseBatchSelect}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Selection Actions */}
              <div className="flex items-center justify-between rounded-lg bg-neo-bg border border-neo-border" style={{ padding: '10px 14px', marginBottom: '16px' }}>
                <div className="flex items-center gap-3">
                  <motion.button
                    onClick={handleToggleSelectAll}
                    className="text-sm text-[#00b4d8] hover:text-[#00c853] flex items-center gap-2 transition-colors"
                    style={{ padding: '4px 8px' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {selectedDocIds.size === documents.filter((d) => d.status === 'pending' || d.status === 'error').length ? (
                      <>
                        <CheckSquare className="w-4 h-4" />
                        取消全选
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4" />
                        全选
                      </>
                    )}
                  </motion.button>
                  <span className="text-sm text-neo-text-muted">
                    已选择 <span className="text-[#00b4d8] font-medium">{selectedDocIds.size}</span> 个文档
                  </span>
                </div>
              </div>

              {/* Document List */}
              <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px', paddingLeft: '4px', paddingRight: '4px', marginBottom: '20px' }}>
                {documents.filter((d) => d.status === 'pending' || d.status === 'error').map((doc, index) => {
                  const fileConfig = fileTypeConfig[doc.fileType] || fileTypeConfig.pdf
                  const isSelected = selectedDocIds.has(doc.id)
                  return (
                    <motion.button
                      key={doc.id}
                      onClick={() => handleToggleSelectDocument(doc.id)}
                      className={`w-full flex items-center gap-4 rounded-lg border transition-all text-left ${
                        isSelected
                          ? 'bg-[#00b4d8]/10 border-[#00b4d8]/30'
                          : 'bg-neo-bg border-neo-border hover:border-neo-border-light'
                      }`}
                      style={{ padding: '12px 16px', marginBottom: index < documents.filter((d) => d.status === 'pending' || d.status === 'error').length - 1 ? '8px' : '0' }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <div className={`w-10 h-10 rounded-lg ${fileConfig.bg} flex items-center justify-center text-xl shrink-0`} style={{ marginLeft: '2px' }}>
                        {fileConfig.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-neo-text truncate">{doc.name}</h3>
                        <p className="text-xs text-neo-text-muted">{doc.size}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-[#00b4d8] shrink-0" style={{ marginRight: '2px' }} />
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3" style={{ paddingLeft: '4px', paddingRight: '4px' }}>
                <motion.button
                  onClick={handleCloseBatchSelect}
                  className="text-sm text-neo-text-muted hover:text-neo-text hover:bg-neo-surface-light rounded-lg transition-colors"
                  style={{ padding: '10px 18px' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  取消
                </motion.button>
                <motion.button
                  onClick={handleExecuteBatchBuild}
                  disabled={selectedDocIds.size === 0 || isBatchBuilding}
                  className="text-sm bg-[#00c853] hover:bg-[#00c853]/80 text-white rounded-lg transition-colors flex items-center gap-2"
                  style={{ padding: '10px 18px' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Zap className={`w-4 h-4 ${isBatchBuilding ? 'animate-pulse' : ''}`} />
                  {isBatchBuilding ? '构建中...' : `开始构建 (${selectedDocIds.size})`}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <div className={`w-14 h-14 rounded-xl ${fileTypeConfig[selectedDoc.fileType]?.bg || 'bg-neo-surface-light'} flex items-center justify-center text-3xl`}>
                  {fileTypeConfig[selectedDoc.fileType]?.icon || '📄'}
                </div>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-neo-surface-light flex items-center justify-center text-neo-text-muted hover:text-neo-text"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <h2 className="text-lg font-semibold text-neo-text mb-1">{selectedDoc.name}</h2>
              <p className="text-sm text-neo-text-muted mb-6">上传于 {selectedDoc.uploadedAt}</p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-neo-bg border border-neo-border">
                  <p className="text-xs text-neo-text-muted mb-0.5">文件大小</p>
                  <p className="font-medium text-neo-text">{selectedDoc.size}</p>
                </div>
                <div className="p-3 rounded-lg bg-neo-bg border border-neo-border">
                  <p className="text-xs text-neo-text-muted mb-0.5">状态</p>
                  <p className="font-medium text-neo-text">{statusConfig[selectedDoc.status].label}</p>
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

              {selectedDoc.errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-[#f44336]/10 border border-[#f44336]/30">
                  <p className="text-xs text-[#f44336]">{selectedDoc.errorMessage}</p>
                </div>
              )}

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-primary rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    // TODO: 跳转到知识图谱视图
                    setSelectedDoc(null)
                  }}
                >
                  <FileText className="w-4 h-4" />
                  查看图谱
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
