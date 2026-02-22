import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  StopCircle,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileText,
  X,
  Network,
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import { documentsApi, tasksApi } from '../services/api'
import { useNavigate } from 'react-router-dom'

// 定义处理阶段配置
const PIPELINE_STAGES = [
  { id: 'distill', name: 'PDF蒸馏', description: '从PDF文档中提取文本内容' },
  { id: 'extract', name: '知识抽取', description: '抽取实体和关系' },
  { id: 'merge', name: '图谱合并', description: '增量合并到知识图谱' },
  { id: 'persist', name: '持久化', description: '保存到Neo4j数据库' },
]

const stageStatusConfig = {
  pending: {
    icon: Circle,
    color: '#64748b',
    bg: 'bg-[#64748b]/10',
    text: '等待中',
    animate: false,
  },
  running: {
    icon: Loader2,
    color: '#00b4d8',
    bg: 'bg-[#00b4d8]/10',
    text: '进行中',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: '#00c853',
    bg: 'bg-[#00c853]/10',
    text: '已完成',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    color: '#f44336',
    bg: 'bg-[#f44336]/10',
    text: '错误',
    animate: false,
  },
}

// 后端进度到前端阶段的映射
function mapProgressToStages(progress: number, currentStep: string) {
  const stages = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    status: 'pending' as 'pending' | 'running' | 'completed' | 'error',
    progress: 0,
  }))

  // 根据进度确定阶段状态
  if (progress >= 100) {
    stages.forEach((s) => s.status = 'completed')
  } else if (progress > 0) {
    // 计算当前阶段
    const stageIndex = Math.floor(progress / 25) // 0-3
    stages.forEach((s, i) => {
      if (i < stageIndex) {
        s.status = 'completed'
        s.progress = 100
      } else if (i === stageIndex) {
        s.status = 'running'
        s.progress = Math.round((progress % 25) * 4)
      }
    })
  }

  return stages
}

export default function PipelineView() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [currentTask, setCurrentTask] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: string; level: string; message: string }>>([])
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [entitiesCount, setEntitiesCount] = useState(0)
  const [relationsCount, setRelationsCount] = useState(0)

  const startTimeRef = useRef<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 加载处理中的文档
  const fetchProcessingDocuments = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await documentsApi.list({ limit: 50 })
      const processingDocs = data.documents.filter(
        (d) => d.status === 'processing' || d.status === 'pending'
      )
      setDocuments(processingDocs)

      // 自动选择第一个处理中的文档
      if (processingDocs.length > 0 && !selectedDocId) {
        const doc = processingDocs.find((d) => d.status === 'processing') || processingDocs[0]
        if (doc) {
          await selectDocument(doc.id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedDocId])

  // 选择文档并订阅任务进度
  const selectDocument = async (docId: string) => {
    // 清理之前的订阅
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
      unsubscribeRef.current = null
    }

    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    setSelectedDocId(docId)
    const doc = documents.find((d) => d.id === docId)
    if (doc?.task_id) {
      await subscribeToTask(doc.task_id)
    }
  }

  // 订阅任务进度
  const subscribeToTask = async (taskId: string) => {
    try {
      // 先获取当前任务状态
      const task = await tasksApi.get(taskId)
      setCurrentTask(task)

      // 设置开始时间
      if (task.status === 'processing' || task.status === 'pending') {
        startTimeRef.current = new Date(task.created_at)
        // 启动计时器
        timerRef.current = setInterval(() => {
          if (startTimeRef.current) {
            setElapsedTime(Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000))
          }
        }, 1000)
      }

      // 添加初始日志
      setLogs([{
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        message: `任务状态: ${task.message}`,
      }])

      // 订阅SSE进度
      const unsubscribe = tasksApi.subscribeProgress(
        taskId,
        (data) => {
          // 更新任务状态
          setCurrentTask({
            ...data,
            progress: Math.round(data.progress * 100),
          })

          // 更新实体和关系计数（这些字段可能由后端动态添加）
          const extendedData = data as typeof data & { entities_count?: number; relations_count?: number }
          if (extendedData.entities_count !== undefined) {
            setEntitiesCount(extendedData.entities_count)
          }
          if (extendedData.relations_count !== undefined) {
            setRelationsCount(extendedData.relations_count)
          }

          // 添加日志
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString(),
              level: 'info',
              message: data.message || data.current_step,
            },
          ].slice(-50)) // 保留最近50条
        },
        (status) => {
          // 任务完成
          if (timerRef.current) {
            clearInterval(timerRef.current)
          }
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString(),
              level: status === 'completed' ? 'success' : 'error',
              message: status === 'completed' ? '知识图谱构建完成！' : '处理失败',
            },
          ])
          // 刷新文档列表
          fetchProcessingDocuments()
        },
        (error) => {
          setLogs((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              timestamp: new Date().toLocaleTimeString(),
              level: 'error',
              message: error,
            },
          ])
        }
      )

      unsubscribeRef.current = unsubscribe
    } catch (error) {
      console.error('Failed to subscribe to task:', error)
    }
  }

  // 开始处理
  const handleStart = async (docId: string) => {
    try {
      const result = await documentsApi.startProcessing(docId)
      await selectDocument(docId)
      // 刷新文档列表
      fetchProcessingDocuments()
    } catch (error) {
      alert('开始处理失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 取消处理
  const handleCancel = async () => {
    if (!currentTask || !selectedDocId) return

    try {
      await tasksApi.cancel(currentTask.id)

      // 清理
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      setLogs((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          timestamp: new Date().toLocaleTimeString(),
          level: 'warning',
          message: '任务已取消',
        },
      ])

      // 刷新文档列表
      fetchProcessingDocuments()
    } catch (error) {
      alert('取消失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 初始加载
  useEffect(() => {
    fetchProcessingDocuments()

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // 构建阶段数据
  const stages = currentTask
    ? mapProgressToStages(currentTask.progress, currentTask.current_step)
    : PIPELINE_STAGES.map((s) => ({ ...s, status: 'pending' as const, progress: 0 }))

  const overallProgress = currentTask?.progress || 0
  const completedStages = stages.filter((s) => s.status === 'completed').length
  const currentDoc = documents.find((d) => d.id === selectedDocId)

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">流程监控</h1>
          <p className="text-[#64748b] text-sm mt-0.5">实时追踪知识抽取进度</p>
        </div>
        <div className="flex items-center gap-2">
          {currentDoc && (
            <span className="text-sm text-[#94a3b8]">{currentDoc.original_filename}</span>
          )}
          <div className="text-sm text-[#00b4d8] font-mono">{formatTime(elapsedTime)}</div>
        </div>
      </div>

      {/* Current Task Card */}
      {currentDoc ? (
        <NeoCard className="p-5" variant="elevated">
          <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0 border border-[#00b4d8]/30">
                <FileText className="w-6 h-6 text-[#00b4d8]" />
              </div>
              <div>
                <h2 className="font-semibold text-[#f0f4f8]">{currentDoc.original_filename}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4 text-[#64748b]" />
                  <span className="text-sm text-[#64748b]">
                    {currentTask?.message || '准备处理...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#00b4d8]">{overallProgress}%</div>
              <div className="text-sm text-[#64748b]">
                {completedStages}/{stages.length} 阶段完成
              </div>
              {/* 实时统计 */}
              {(entitiesCount > 0 || relationsCount > 0) && (
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <Network className="w-3.5 h-3.5 text-[#00c853]" />
                  <span className="text-[#94a3b8]">{entitiesCount} 实体 · {relationsCount} 关系</span>
                </div>
              )}
            </div>
          </div>

          {/* Overall Progress Bar */}
          <div className="h-2 neo-progress">
            <motion.div
              className="neo-progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </NeoCard>
      ) : (
        <NeoCard className="p-8 flex flex-col items-center justify-center text-center" variant="elevated">
          <div className="w-14 h-14 rounded-xl bg-[#1a2332] flex items-center justify-center mb-4 border border-[#2a3548]">
            <FileText className="w-6 h-6 text-[#64748b]" />
          </div>
          <p className="text-[#94a3b8]">暂无运行中的流程</p>
          <p className="text-sm text-[#64748b] mt-1">
            {documents.length > 0 ? '选择一个待处理的文档开始构建' : '上传文档后，处理流程将在此处显示'}
          </p>
        </NeoCard>
      )}

      {/* Two Column Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-0">
        {/* Pipeline Stages */}
        <div className="space-y-3 overflow-y-auto">
          <h3 className="text-sm font-medium text-[#64748b] mb-2">处理阶段</h3>
          {stages.map((stage, index) => {
            const config = stageStatusConfig[stage.status]
            const StatusIcon = config.icon
            const isExpanded = expandedStage === stage.id
            const isActive = stage.status === 'running'

            return (
              <motion.div
                key={stage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <NeoCard className={`overflow-hidden ${isActive ? 'ring-1 ring-[#00b4d8]/30' : ''}`}>
                  {/* Stage Header */}
                  <div
                    className="p-4 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedStage(isExpanded ? null : stage.id)}
                  >
                    {/* Step Number & Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
                        <StatusIcon
                          className={`w-4 h-4 ${config.animate ? 'animate-spin' : ''}`}
                          style={{ color: config.color }}
                        />
                      </div>
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                        style={{
                          backgroundColor: stage.status === 'completed' ? config.color : '#1a2332',
                          color: stage.status === 'completed' ? 'white' : '#64748b',
                          border: stage.status !== 'completed' ? '1px solid #2a3548' : 'none',
                        }}
                      >
                        {index + 1}
                      </div>
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-[#f0f4f8] truncate">{stage.name}</h3>
                      <p className="text-sm text-[#64748b] truncate">{stage.description}</p>
                    </div>

                    {/* Progress / Time */}
                    <div className="text-right shrink-0">
                      {stage.status === 'running' && (
                        <span className="text-[#00b4d8] font-medium">{stage.progress}%</span>
                      )}
                      {stage.status === 'completed' && (
                        <span className="text-sm text-[#00c853]">已完成</span>
                      )}
                      {stage.status === 'pending' && (
                        <span className="text-sm text-[#64748b]">等待中</span>
                      )}
                    </div>

                    {/* Expand Icon */}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-[#64748b] shrink-0" />
                    </motion.div>
                  </div>

                  {/* Progress Bar for Running Stage */}
                  {stage.status === 'running' && (
                    <div className="px-4 pb-3">
                      <div className="h-1.5 neo-progress">
                        <motion.div
                          className="neo-progress-bar"
                          initial={{ width: 0 }}
                          animate={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-[#2a3548] overflow-hidden"
                      >
                        <div className="p-4 bg-[#0a0e17]/50">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-[#64748b] mb-1">状态</p>
                              <p className="text-sm font-medium" style={{ color: config.color }}>
                                {config.text}
                              </p>
                            </div>
                            {startTimeRef.current && (
                              <div>
                                <p className="text-xs text-[#64748b] mb-1">已用时间</p>
                                <p className="text-sm text-[#94a3b8]">{formatTime(elapsedTime)}</p>
                              </div>
                            )}
                            {stage.status === 'completed' && (
                              <div>
                                <p className="text-xs text-[#64748b] mb-1">状态</p>
                                <p className="text-sm text-[#00c853]">已完成</p>
                              </div>
                            )}
                          </div>
                          {currentTask?.current_step && (
                            <div className="p-3 rounded-lg bg-[#111827] border border-[#2a3548]">
                              <p className="text-sm text-[#94a3b8]">{currentTask.current_step}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </NeoCard>
              </motion.div>
            )
          })}
        </div>

        {/* Activity Log */}
        <div className="flex flex-col min-h-0">
          <NeoCard className="p-5 flex-1 flex flex-col" variant="elevated">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#00b4d8]" />
                <h3 className="font-medium text-[#f0f4f8]">活动日志</h3>
              </div>
              {logs.length > 0 && (
                <button
                  className="text-sm text-[#f44336] hover:text-[#f44336]/80 flex items-center gap-1"
                  onClick={() => setLogs([])}
                >
                  <X className="w-4 h-4" />
                  清空
                </button>
              )}
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
              {logs.length > 0 ? (
                <AnimatePresence>
                  {logs.map((log, index) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-start gap-3 py-2 border-b border-[#2a3548] last:border-0"
                    >
                      <span className="text-xs text-[#64748b] font-mono w-14 shrink-0">{log.timestamp}</span>
                      <div
                        className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                          log.level === 'info' ? 'bg-[#00b4d8]/10 text-[#00b4d8]' :
                          log.level === 'success' ? 'bg-[#00c853]/10 text-[#00c853]' :
                          log.level === 'warning' ? 'bg-[#ff9800]/10 text-[#ff9800]' :
                          log.level === 'error' ? 'bg-[#f44336]/10 text-[#f44336]' :
                          'bg-[#64748b]/10 text-[#64748b]'
                        }`}
                      >
                        {log.level.toUpperCase().slice(0, 4)}
                      </div>
                      <p className="text-sm text-[#94a3b8] flex-1 min-w-0">{log.message}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                <div className="flex items-center justify-center h-full py-8">
                  <p className="text-sm text-[#64748b]">暂无日志</p>
                </div>
              )}
            </div>
          </NeoCard>
        </div>
      </div>

      {/* Documents Selector */}
      {documents.length > 0 && !selectedDocId && (
        <NeoCard className="p-4" variant="elevated">
          <p className="text-sm text-[#64748b] mb-3">选择要处理的文档：</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documents.map((doc) => (
              <motion.button
                key={doc.id}
                className="p-3 rounded-lg bg-[#1a2332] hover:bg-[#2a3548] border border-[#2a3548] text-left transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleStart(doc.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#f0f4f8] truncate">{doc.original_filename}</span>
                  <Play className="w-4 h-4 text-[#00c853] shrink-0" />
                </div>
              </motion.button>
            ))}
          </div>
        </NeoCard>
      )}

      {/* Cancel Button for Running Task */}
      {currentTask?.status === 'processing' && (
        <motion.button
          className="fixed bottom-6 right-6 px-4 py-2 neo-btn-secondary rounded-lg flex items-center gap-2 shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCancel}
        >
          <StopCircle className="w-4 h-4 text-[#f44336]" />
          取消构建
        </motion.button>
      )}

      {/* View Graph Button for Completed Task */}
      {currentTask?.status === 'completed' && (
        <motion.button
          className="fixed bottom-6 right-6 px-4 py-2 neo-btn-primary rounded-lg flex items-center gap-2 shadow-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/')}
        >
          <Network className="w-4 h-4" />
          查看知识图谱
        </motion.button>
      )}
    </div>
  )
}
