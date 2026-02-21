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
import NeoCard from '../components/ui/GlassCard'
import { mockPipelineRun, mockLogs } from '../data/mock'
import type { LogEntry } from '../types'

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

const logLevelConfig = {
  info: { color: '#00b4d8', bg: 'bg-[#00b4d8]/10' },
  warning: { color: '#ff9800', bg: 'bg-[#ff9800]/10' },
  error: { color: '#f44336', bg: 'bg-[#f44336]/10' },
  success: { color: '#00c853', bg: 'bg-[#00c853]/10' },
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
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">流程监控</h1>
          <p className="text-[#64748b] text-sm mt-0.5">实时追踪知识抽取进度</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              isPaused ? 'neo-btn-primary' : 'neo-btn-secondary'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsPaused(!isPaused)}
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4 text-[#94a3b8]" />}
          </motion.button>
          <motion.button
            className="w-9 h-9 neo-btn-secondary rounded-lg flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-4 h-4 text-[#94a3b8]" />
          </motion.button>
        </div>
      </div>

      {/* Current Task Card */}
      <NeoCard className="p-5" variant="elevated">
        <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00b4d8]/10 flex items-center justify-center shrink-0 border border-[#00b4d8]/30">
              <FileText className="w-6 h-6 text-[#00b4d8]" />
            </div>
            <div>
              <h2 className="font-semibold text-[#f0f4f8]">{pipeline.documentName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-4 h-4 text-[#64748b]" />
                <span className="text-sm text-[#64748b]">开始于 {pipeline.startTime}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-[#00b4d8]">{pipeline.overallProgress}%</div>
            <div className="text-sm text-[#64748b]">
              {completedStages}/{pipeline.stages.length} 阶段完成
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="h-2 neo-progress">
          <motion.div
            className="neo-progress-bar"
            initial={{ width: 0 }}
            animate={{ width: `${pipeline.overallProgress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </NeoCard>

      {/* Two Column Layout */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-0">
        {/* Pipeline Stages */}
        <div className="space-y-3 overflow-y-auto">
          <h3 className="text-sm font-medium text-[#64748b] mb-2">处理阶段</h3>
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
                      {stage.status === 'completed' && stage.endTime && (
                        <span className="text-sm text-[#64748b]">{stage.endTime}</span>
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
                            {stage.startTime && (
                              <div>
                                <p className="text-xs text-[#64748b] mb-1">开始时间</p>
                                <p className="text-sm text-[#94a3b8]">{stage.startTime}</p>
                              </div>
                            )}
                            {stage.endTime && (
                              <div>
                                <p className="text-xs text-[#64748b] mb-1">结束时间</p>
                                <p className="text-sm text-[#94a3b8]">{stage.endTime}</p>
                              </div>
                            )}
                          </div>
                          {stage.details && (
                            <div className="p-3 rounded-lg bg-[#111827] border border-[#2a3548]">
                              <p className="text-sm text-[#94a3b8]">{stage.details}</p>
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
              <motion.button
                className="text-sm text-[#00b4d8] flex items-center gap-1"
                whileHover={{ scale: 1.02 }}
                onClick={() => setShowAllLogs(!showAllLogs)}
              >
                {showAllLogs ? '收起' : '查看全部'}
                {showAllLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </motion.button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto">
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
                      className="flex items-start gap-3 py-2 border-b border-[#2a3548] last:border-0"
                    >
                      <span className="text-xs text-[#64748b] font-mono w-14 shrink-0">{log.timestamp}</span>
                      <div
                        className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${levelConfig.bg}`}
                        style={{ color: levelConfig.color }}
                      >
                        {log.level.toUpperCase().slice(0, 4)}
                      </div>
                      <p className="text-sm text-[#94a3b8] flex-1 min-w-0">{log.message}</p>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </NeoCard>
        </div>
      </div>
    </div>
  )
}
