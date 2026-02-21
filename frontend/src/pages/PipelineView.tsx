import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Terminal,
  FileText,
} from 'lucide-react'
import GlassCard from '../components/ui/GlassCard'
import { mockPipelineRun, mockLogs } from '../data/mock'
import type { LogEntry } from '../types'

const stageStatusConfig = {
  pending: {
    icon: Circle,
    color: '#8E8E93',
    bg: 'bg-gray-100',
    text: '等待中',
    animate: false,
  },
  running: {
    icon: Loader2,
    color: '#007AFF',
    bg: 'bg-blue-50',
    text: '进行中',
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    color: '#34C759',
    bg: 'bg-green-50',
    text: '已完成',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    color: '#FF3B30',
    bg: 'bg-red-50',
    text: '错误',
    animate: false,
  },
}

const logLevelConfig = {
  info: { color: '#007AFF', bg: 'bg-blue-50' },
  warning: { color: '#FF9500', bg: 'bg-orange-50' },
  error: { color: '#FF3B30', bg: 'bg-red-50' },
  success: { color: '#34C759', bg: 'bg-green-50' },
}

export default function PipelineView() {
  const [pipeline, setPipeline] = useState(mockPipelineRun)
  const [logs] = useState<LogEntry[]>(mockLogs)
  const [expandedStage, setExpandedStage] = useState<string | null>('s4')
  const [isPaused, setIsPaused] = useState(false)
  const [showAllLogs, setShowAllLogs] = useState(false)

  // Simulate progress
  useEffect(() => {
    if (isPaused || pipeline.status !== 'running') return

    const interval = setInterval(() => {
      setPipeline((prev) => {
        const stages = prev.stages.map((stage) => {
          if (stage.status === 'running' && stage.progress < 100) {
            const newProgress = Math.min(100, stage.progress + Math.random() * 3)
            return { ...stage, progress: Math.round(newProgress) }
          }
          return stage
        })

        const overallProgress = stages.reduce((sum, s) => sum + s.progress / stages.length, 0)

        return {
          ...prev,
          stages,
          overallProgress: Math.round(overallProgress),
        }
      })
    }, 500)

    return () => clearInterval(interval)
  }, [isPaused, pipeline.status])

  const completedStages = pipeline.stages.filter((s) => s.status === 'completed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">流程监控</h1>
          <p className="text-gray-500 mt-1">实时追踪知识抽取进度</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-glass ${
              isPaused ? 'bg-[#007AFF] text-white' : 'glass text-gray-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </motion.button>
          <motion.button
            className="w-10 h-10 glass rounded-xl flex items-center justify-center text-gray-600 shadow-glass"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Current Task Card */}
      <GlassCard className="p-5" variant="heavy">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#007AFF]/10 flex items-center justify-center shrink-0">
              <FileText className="w-6 h-6 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">{pipeline.documentName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">开始于 {pipeline.startTime}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-[#007AFF]">{pipeline.overallProgress}%</div>
            <div className="text-sm text-gray-500">
              {completedStages}/{pipeline.stages.length} 阶段完成
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-[#007AFF] to-[#5AC8FA] rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${pipeline.overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </GlassCard>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Pipeline Stages */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 mb-2">处理阶段</h3>
          {pipeline.stages.map((stage, index) => {
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
                <GlassCard className={`overflow-hidden ${isActive ? 'ring-2 ring-[#007AFF]/20' : ''}`}>
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
                          backgroundColor: stage.status === 'completed' ? config.color : '#e5e5ea',
                          color: stage.status === 'completed' ? 'white' : '#8e8e93',
                        }}
                      >
                        {index + 1}
                      </div>
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-800 truncate">{stage.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{stage.description}</p>
                    </div>

                    {/* Progress / Time */}
                    <div className="text-right shrink-0">
                      {stage.status === 'running' && (
                        <span className="text-[#007AFF] font-medium">{stage.progress}%</span>
                      )}
                      {stage.status === 'completed' && stage.endTime && (
                        <span className="text-sm text-gray-400">{stage.endTime}</span>
                      )}
                      {stage.status === 'pending' && (
                        <span className="text-sm text-gray-400">等待中</span>
                      )}
                    </div>

                    {/* Expand Icon */}
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                    </motion.div>
                  </div>

                  {/* Progress Bar for Running Stage */}
                  {stage.status === 'running' && (
                    <div className="px-4 pb-3">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-[#007AFF] rounded-full"
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
                        className="border-t border-gray-100 overflow-hidden"
                      >
                        <div className="p-4 bg-gray-50/50">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-400 mb-1">状态</p>
                              <p className="text-sm font-medium" style={{ color: config.color }}>
                                {config.text}
                              </p>
                            </div>
                            {stage.startTime && (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">开始时间</p>
                                <p className="text-sm text-gray-700">{stage.startTime}</p>
                              </div>
                            )}
                            {stage.endTime && (
                              <div>
                                <p className="text-xs text-gray-400 mb-1">结束时间</p>
                                <p className="text-sm text-gray-700">{stage.endTime}</p>
                              </div>
                            )}
                          </div>
                          {stage.details && (
                            <div className="p-3 rounded-lg bg-white border border-gray-100">
                              <p className="text-sm text-gray-600">{stage.details}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            )
          })}
        </div>

        {/* Activity Log */}
        <div>
          <GlassCard className="p-5 h-fit" variant="heavy">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gray-600" />
                <h3 className="font-medium text-gray-800">活动日志</h3>
              </div>
              <motion.button
                className="text-sm text-[#007AFF] flex items-center gap-1"
                whileHover={{ scale: 1.02 }}
                onClick={() => setShowAllLogs(!showAllLogs)}
              >
                {showAllLogs ? '收起' : '查看全部'}
                {showAllLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </motion.button>
            </div>

            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <AnimatePresence>
                {(showAllLogs ? logs : logs.slice(0, 6)).map((log, index) => {
                  const levelConfig = logLevelConfig[log.level]
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
                    >
                      <span className="text-xs text-gray-400 font-mono w-14 shrink-0">{log.timestamp}</span>
                      <div
                        className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${levelConfig.bg}`}
                        style={{ color: levelConfig.color }}
                      >
                        {log.level.toUpperCase().slice(0, 4)}
                      </div>
                      <p className="text-sm text-gray-600 flex-1 min-w-0">{log.message}</p>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  )
}
