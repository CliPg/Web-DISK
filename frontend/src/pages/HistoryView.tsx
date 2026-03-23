import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  FileText,
  Network,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Coins,
  TrendingUp,
  GitBranch,
  Calendar,
  Hash,
  X,
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { KGDocument } from '../types'
import { documentsApi, graphsApi } from '../services/api'

const statusConfig = {
  pending: {
    icon: Clock,
    label: '等待处理',
    color: 'text-neo-text-muted',
    bg: 'bg-[#64748b]/10',
    dotColor: '#64748b',
  },
  processing: {
    icon: Loader2,
    label: '处理中',
    color: 'text-[#00b4d8]',
    bg: 'bg-[#00b4d8]/10',
    dotColor: '#00b4d8',
  },
  completed: {
    icon: CheckCircle2,
    label: '已完成',
    color: 'text-[#00c853]',
    bg: 'bg-[#00c853]/10',
    dotColor: '#00c853',
  },
  error: {
    icon: AlertCircle,
    label: '处理失败',
    color: 'text-[#f44336]',
    bg: 'bg-[#f44336]/10',
    dotColor: '#f44336',
  },
}

const fileTypeConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pdf: { icon: '📄', color: '#f44336', bg: 'bg-[#f44336]/10' },
  docx: { icon: '📝', color: '#3b82f6', bg: 'bg-[#3b82f6]/10' },
  txt: { icon: '📃', color: '#64748b', bg: 'bg-[#64748b]/10' },
  md: { icon: '📋', color: '#a855f7', bg: 'bg-[#a855f7]/10' },
}

// 格式化数字
const formatNumber = (num: number): string => {
  if (num >= 10000) return `${(num / 10000).toFixed(1)}w`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`
  return num.toString()
}

// 解析后端返回的 UTC 时间字符串
const parseUTCTime = (timeStr: string): Date => {
  const s = timeStr.endsWith('Z') || timeStr.includes('+') || timeStr.includes('-', 10)
    ? timeStr
    : timeStr + 'Z'
  return new Date(s)
}

// 计算构建耗时
const calculateBuildTime = (taskStartedAt: string | undefined, taskCompletedAt: string | undefined): string => {
  if (!taskStartedAt) return '--'

  const start = parseUTCTime(taskStartedAt)
  if (isNaN(start.getTime())) return '--'

  const end = taskCompletedAt ? parseUTCTime(taskCompletedAt) : new Date()
  if (taskCompletedAt && isNaN(end.getTime())) return '--'

  const diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) return '--'

  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)

  if (diffMins > 0) {
    return `${diffMins}分${diffSecs % 60}秒`
  } else {
    return `${diffSecs}秒`
  }
}

export default function HistoryView() {
  const [documents, setDocuments] = useState<KGDocument[]>([])
  const [graphs, setGraphs] = useState<{ id: string; name: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDoc, setSelectedDoc] = useState<KGDocument | null>(null)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // 加载知识图谱列表（用于显示图谱名称）
  const fetchGraphs = useCallback(async () => {
    try {
      const data = await graphsApi.list()
      setGraphs(data.graphs)
    } catch (error) {
      console.error('Failed to fetch graphs:', error)
    }
  }, [])

  // 加载文档列表
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await documentsApi.list({ limit: 100, status: 'completed' })

      const docs: KGDocument[] = data.documents.map((doc) => {
        const graph = graphs.find((g) => g.id === doc.graph_id)
        return {
          id: doc.id,
          name: doc.original_filename,
          fileType: doc.filename.split('.').pop() as KGDocument['fileType'] || 'pdf',
          size: `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`,
          pages: 0,
          status: 'completed',
          progress: 100,
          uploadedAt: new Date(doc.created_at).toISOString().split('T')[0],
          taskId: doc.task_id,
          errorMessage: doc.error_message,
          filePath: doc.file_path,
          graphId: doc.graph_id,
          graphName: graph?.name,
          taskStartedAt: doc.task_started_at,
          taskCompletedAt: doc.task_completed_at,
          // Token 数据（从后端获取）
          inputTokens: doc.input_tokens || 0,
          outputTokens: doc.output_tokens || 0,
          totalTokens: doc.total_tokens || 0,
          // 从图谱统计获取实体和关系数量
          entities: 0,
          relations: 0,
        }
      })

      // 获取每个文档的实体和关系数量（从关联的图谱统计中获取）
      const docsWithStats = await Promise.all(
        docs.map(async (doc) => {
          if (doc.graphId) {
            try {
              const stats = await fetch(`http://localhost:8000/api/knowledge-graph/stats?graph_id=${doc.graphId}`)
                .then(r => r.json())
              return {
                ...doc,
                entities: stats.total_entities || 0,
                relations: stats.total_relations || 0,
              }
            } catch {
              return doc
            }
          }
          return doc
        })
      )

      setDocuments(docsWithStats)
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [graphs])

  // 刷新数据
  const refreshAll = useCallback(async () => {
    await fetchGraphs()
    await fetchDocuments()
  }, [fetchGraphs, fetchDocuments])

  // 初始加载
  useEffect(() => {
    fetchGraphs()
  }, [fetchGraphs])

  // 当 graphs 加载完成后，获取文档列表
  useEffect(() => {
    if (graphs.length > 0) {
      fetchDocuments()
    }
  }, [graphs, fetchDocuments])

  // 每秒更新当前时间，用于实时计算处理中文档的构建耗时
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // 计算统计数据
  const stats = [
    { key: 'all', label: '全部', value: documents.length, color: '#f0f4f8', icon: Hash },
    { key: 'entities', label: '实体总数', value: documents.reduce((sum, d) => sum + (d.entities || 0), 0), color: '#3b82f6', icon: Network },
    { key: 'relations', label: '关系总数', value: documents.reduce((sum, d) => sum + (d.relations || 0), 0), color: '#a855f7', icon: GitBranch },
  ]

  const totalTokens = documents.reduce((sum, d) => sum + (d.totalTokens || 0), 0)
  const totalInputTokens = documents.reduce((sum, d) => sum + (d.inputTokens || 0), 0)
  const totalOutputTokens = documents.reduce((sum, d) => sum + (d.outputTokens || 0), 0)

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neo-text">构建历史</h1>
          <p className="text-neo-text-muted text-sm mt-0.5">文档构建记录与统计信息</p>
        </div>
        <button
          onClick={refreshAll}
          disabled={isLoading}
          className="text-sm text-neo-text-muted hover:text-neo-text hover:bg-neo-surface-light rounded-lg transition-colors flex items-center gap-1.5"
          style={{ padding: '6px 12px 6px 16px' }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <NeoCard key={stat.key} className="p-5" hover>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${stat.color}20`, marginLeft: '4px' }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-neo-text">{stat.value}</p>
                <p className="text-xs text-neo-text-muted">{stat.label}</p>
              </div>
            </div>
          </NeoCard>
        ))}
        <NeoCard className="p-5" hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#f59e0b]/10 flex items-center justify-center shrink-0" style={{ marginLeft: '4px' }}>
              <Coins className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-neo-text">{formatNumber(totalTokens)}</p>
              <p className="text-xs text-neo-text-muted">总 Token</p>
            </div>
          </div>
        </NeoCard>
      </div>

      {/* Token Stats Breakdown */}
      {totalTokens > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <NeoCard className="p-4" hover>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center shrink-0" style={{ marginLeft: '4px' }}>
                <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neo-text">{formatNumber(totalInputTokens)}</p>
                <p className="text-xs text-neo-text-muted">输入 Tokens</p>
              </div>
            </div>
          </NeoCard>
          <NeoCard className="p-4" hover>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00c853]/10 flex items-center justify-center shrink-0" style={{ marginLeft: '4px' }}>
                <TrendingUp className="w-4 h-4 text-[#00c853]" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neo-text">{formatNumber(totalOutputTokens)}</p>
                <p className="text-xs text-neo-text-muted">输出 Tokens</p>
              </div>
            </div>
          </NeoCard>
        </div>
      )}

      {/* History List */}
      <NeoCard className="flex-1 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-neo-text-muted animate-spin" />
          </div>
        ) : documents.length > 0 ? (
          <div className="divide-y divide-[#2a3548]">
            {documents.map((doc, index) => {
              const fileConfig = fileTypeConfig[doc.fileType] || fileTypeConfig.pdf
              const buildTime = calculateBuildTime(doc.taskStartedAt, doc.taskCompletedAt)

              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-4 p-4 hover:bg-neo-surface-light/50 group transition-colors"
                  style={{ marginBottom: index < documents.length - 1 ? '8px' : '0', minHeight: '60px', paddingLeft: '8px', paddingRight: '8px' }}
                >
                  {/* File Icon */}
                  <div className={`w-12 h-12 rounded-lg ${fileConfig.bg} flex items-center justify-center text-xl shrink-0`}>
                    {fileConfig.icon}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-neo-text truncate">{doc.name}</h3>
                    </div>

                    {/* Meta Info */}
                    <div className="flex items-center gap-3 text-xs text-neo-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {doc.uploadedAt}
                      </span>
                      <span>·</span>
                      <span>{doc.size}</span>
                      <span>·</span>
                      <span>耗时: {buildTime}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neo-bg border border-neo-border">
                      <Network className="w-3 h-3 text-[#3b82f6]" />
                      <span className="text-neo-text-secondary">{doc.entities || 0} 实体</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neo-bg border border-neo-border">
                      <GitBranch className="w-3 h-3 text-[#a855f7]" />
                      <span className="text-neo-text-secondary">{doc.relations || 0} 关系</span>
                    </div>
                    {doc.totalTokens > 0 && (
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-neo-bg border border-neo-border">
                        <Coins className="w-3 h-3 text-[#f59e0b]" />
                        <span className="text-neo-text-secondary">{formatNumber(doc.totalTokens)} T</span>
                      </div>
                    )}
                  </div>

                  {/* Graph Name */}
                  {doc.graphName && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#00b4d8]/10 text-[#00b4d8] shrink-0">
                      <Network className="w-3 h-3" />
                      <span className="text-xs">{doc.graphName}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-xl bg-neo-surface-light flex items-center justify-center mb-4 border border-neo-border">
              <Clock className="w-8 h-8 text-neo-text-muted" />
            </div>
            <p className="text-neo-text-secondary mb-1">暂无构建历史</p>
            <p className="text-sm text-neo-text-muted">上传并处理文档后，这里将显示构建记录</p>
          </div>
        )}
      </NeoCard>

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
              className="neo-card-elevated w-full max-w-md"
              style={{ padding: '24px' }}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl ${fileTypeConfig[selectedDoc.fileType]?.bg || 'bg-neo-surface-light'} flex items-center justify-center text-3xl`}>
                    {fileTypeConfig[selectedDoc.fileType]?.icon || '📄'}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neo-text">{selectedDoc.name}</h2>
                    <p className="text-sm text-neo-text-muted">{selectedDoc.uploadedAt}</p>
                  </div>
                </div>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-neo-surface-light flex items-center justify-center text-neo-text-muted hover:text-neo-text shrink-0"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-4 rounded-lg bg-neo-bg border border-neo-border">
                  <p className="text-xs text-neo-text-muted mb-2">文件大小</p>
                  <p className="font-medium text-neo-text">{selectedDoc.size}</p>
                </div>
                <div className="p-4 rounded-lg bg-neo-bg border border-neo-border">
                  <p className="text-xs text-neo-text-muted mb-2">构建耗时</p>
                  <p className="font-medium text-neo-text">{calculateBuildTime(selectedDoc.taskStartedAt, selectedDoc.taskCompletedAt)}</p>
                </div>
                <div className="p-4 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/30">
                  <p className="text-xs text-[#3b82f6] mb-2">提取实体</p>
                  <p className="font-medium text-[#3b82f6]">{selectedDoc.entities || 0} 个</p>
                </div>
                <div className="p-4 rounded-lg bg-[#a855f7]/10 border border-[#a855f7]/30">
                  <p className="text-xs text-[#a855f7] mb-2">提取关系</p>
                  <p className="font-medium text-[#a855f7]">{selectedDoc.relations || 0} 个</p>
                </div>
              </div>

              {/* Token Info */}
              {(selectedDoc.inputTokens || selectedDoc.outputTokens || selectedDoc.totalTokens) && (
                <div className="p-4 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 mb-6">
                  <p className="text-xs text-[#f59e0b] mb-3">Token 消耗</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-neo-text-muted">输入</p>
                      <p className="font-medium text-neo-text">{formatNumber(selectedDoc.inputTokens || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neo-text-muted">输出</p>
                      <p className="font-medium text-neo-text">{formatNumber(selectedDoc.outputTokens || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neo-text-muted">总计</p>
                      <p className="font-medium text-[#f59e0b]">{formatNumber(selectedDoc.totalTokens || 0)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Graph Info */}
              {selectedDoc.graphName && (
                <div className="p-4 rounded-lg bg-[#00b4d8]/10 border border-[#00b4d8]/30 mb-6">
                  <p className="text-xs text-[#00b4d8] mb-2">所属图谱</p>
                  <div className="flex items-center gap-2">
                    <Network className="w-4 h-4 text-[#00b4d8]" />
                    <p className="font-medium text-neo-text">{selectedDoc.graphName}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  className="flex-1 neo-btn-secondary rounded-lg font-medium text-sm"
                  style={{ padding: '12px 16px' }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedDoc(null)}
                >
                  关闭
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
