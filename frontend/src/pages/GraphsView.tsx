import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Trash2,
  Loader2,
  Network,
  FileText,
  GitBranch,
  MoreHorizontal,
  Edit,
  CheckCircle2,
  X,
  RefreshCw,
  Eraser,
  AlertTriangle,
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { KnowledgeGraph } from '../types'
import { graphsApi } from '../services/api'

export default function GraphsView() {
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedGraph, setSelectedGraph] = useState<KnowledgeGraph | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [formErrors, setFormErrors] = useState<{ name?: string }>({})

  const fetchGraphs = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await graphsApi.list()
      setGraphs(data.graphs)
    } catch (error) {
      console.error('Failed to fetch graphs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchGraphs()
  }, [fetchGraphs])

  const validateForm = () => {
    const errors: { name?: string } = {}
    if (!formData.name.trim()) {
      errors.name = '请输入知识图谱名称'
    } else if (formData.name.trim().length < 2) {
      errors.name = '名称至少需要2个字符'
    } else if (formData.name.trim().length > 50) {
      errors.name = '名称不能超过50个字符'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return

    try {
      setIsCreating(true)
      await graphsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      })
      setShowCreateModal(false)
      setFormData({ name: '', description: '' })
      setFormErrors({})
      await fetchGraphs()
    } catch (error) {
      console.error('Create failed:', error)
      alert('创建失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedGraph || !validateForm()) return

    try {
      setIsCreating(true)
      await graphsApi.update(selectedGraph.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
      })
      setShowEditModal(false)
      setSelectedGraph(null)
      setFormData({ name: '', description: '' })
      setFormErrors({})
      await fetchGraphs()
    } catch (error) {
      console.error('Update failed:', error)
      alert('更新失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个知识图谱吗？删除后将无法恢复。')) return

    try {
      setIsDeleting(id)
      await graphsApi.delete(id)
      setGraphs((prev) => prev.filter((g) => g.id !== id))
      setMenuOpen(null)
    } catch (error) {
      console.error('Delete failed:', error)
      alert('删除失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsDeleting(null)
    }
  }

  const handleClear = async (id: string, name: string) => {
    const graph = graphs.find((g) => g.id === id)
    const docCount = graph?.document_count || 0

    if (!confirm(
      `确定要清空知识图谱"${name}"吗？\n\n` +
      `这将删除所有实体和关系，${docCount} 个关联文档将被重置为待处理状态。` +
      `\n\n此操作无法撤销！`
    )) return

    try {
      setIsClearing(id)
      const result = await graphsApi.clear(id)
      await fetchGraphs()
      setMenuOpen(null)
      alert(result.message)
    } catch (error) {
      console.error('Clear failed:', error)
      alert('清空失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsClearing(null)
    }
  }

  const openEditModal = (graph: KnowledgeGraph) => {
    setSelectedGraph(graph)
    setFormData({ name: graph.name, description: graph.description || '' })
    setFormErrors({})
    setShowEditModal(true)
    setMenuOpen(null)
  }

  const openCreateModal = () => {
    setFormData({ name: '', description: '' })
    setFormErrors({})
    setShowCreateModal(true)
  }

  const closeModal = () => {
    setShowCreateModal(false)
    setShowEditModal(false)
    setSelectedGraph(null)
    setFormData({ name: '', description: '' })
    setFormErrors({})
  }

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">知识图谱管理</h1>
          <p className="text-[#64748b] text-sm mt-0.5">创建和管理您的知识图谱</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            className="px-4 py-2 neo-btn-primary rounded-lg font-medium text-sm flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" />
            新建图谱
          </motion.button>
          <button
            onClick={fetchGraphs}
            disabled={isLoading}
            className="px-3 py-2 text-sm text-[#64748b] hover:text-[#f0f4f8] hover:bg-[#1a2332] rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <NeoCard className="p-5" hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00b4d8]/10 flex items-center justify-center">
              <Network className="w-5 h-5 text-[#00b4d8]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#f0f4f8]">{graphs.length}</p>
              <p className="text-xs text-[#64748b]">知识图谱</p>
            </div>
          </div>
        </NeoCard>
        <NeoCard className="p-5" hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#f0f4f8]">
                {graphs.reduce((sum, g) => sum + g.entity_count, 0)}
              </p>
              <p className="text-xs text-[#64748b]">实体总数</p>
            </div>
          </div>
        </NeoCard>
        <NeoCard className="p-5" hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#00c853]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#00c853]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#f0f4f8]">
                {graphs.reduce((sum, g) => sum + g.document_count, 0)}
              </p>
              <p className="text-xs text-[#64748b]">关联文档</p>
            </div>
          </div>
        </NeoCard>
        <NeoCard className="p-5" hover>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#a855f7]/10 flex items-center justify-center">
              <Network className="w-5 h-5 text-[#a855f7]" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-[#f0f4f8]">
                {graphs.reduce((sum, g) => sum + g.relation_count, 0)}
              </p>
              <p className="text-xs text-[#64748b]">关系总数</p>
            </div>
          </div>
        </NeoCard>
      </div>

      {/* Graph List */}
      <NeoCard className="flex-1 overflow-hidden" variant="elevated">
        {isLoading ? (
          <div className="h-full flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-[#64748b] animate-spin" />
          </div>
        ) : graphs.length > 0 ? (
          <div className="divide-y divide-[#2a3548]">
            {graphs.map((graph, index) => (
              <div
                key={graph.id}
                className="flex items-center gap-4 p-5 hover:bg-[#1a2332]/50 group"
                style={{ marginBottom: index < graphs.length - 1 ? '0' : '0', minHeight: '72px' }}
              >
                {/* Graph Icon */}
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#00b4d8]/20 to-[#0096c7]/20 flex items-center justify-center shrink-0 border border-[#00b4d8]/30">
                  <Network className="w-5 h-5 text-[#00b4d8]" />
                </div>

                {/* Graph Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-[#f0f4f8]">{graph.name}</h3>
                    {graph.is_default && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-[#00c853]/10 text-[#00c853]">
                        默认
                      </span>
                    )}
                  </div>
                  {graph.description && (
                    <p className="text-sm text-[#64748b] line-clamp-1">{graph.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-[#64748b]">
                    <span className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#3b82f6]" />
                      {graph.entity_count} 实体
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#a855f7]" />
                      {graph.relation_count} 关系
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-[#00c853]" />
                      {graph.document_count} 文档
                    </span>
                    <span>·</span>
                    <span>{new Date(graph.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="relative">
                  <motion.button
                    className="w-9 h-9 rounded-lg hover:bg-[#2a3548] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8] transition-all"
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen(menuOpen === graph.id ? null : graph.id)
                    }}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </motion.button>

                  {/* Dropdown Menu */}
                  <AnimatePresence>
                    {menuOpen === graph.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        className="absolute right-0 top-11 w-44 neo-card-elevated py-1.5 z-20"
                      >
                        <button
                          className="w-full px-4 py-2.5 text-left text-sm text-[#94a3b8] hover:bg-[#1a2332] hover:text-[#f0f4f8] flex items-center gap-2"
                          onClick={() => openEditModal(graph)}
                        >
                          <Edit className="w-4 h-4" />
                          编辑
                        </button>
                        <button
                          className="w-full px-4 py-2.5 text-left text-sm text-[#f59e0b] hover:bg-[#f59e0b]/10 flex items-center gap-2"
                          onClick={() => handleClear(graph.id, graph.name)}
                          disabled={isClearing === graph.id}
                        >
                          {isClearing === graph.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Eraser className="w-4 h-4" />
                          )}
                          清空数据
                        </button>
                        <div className="mx-4 my-1 border-t border-[#2a3548]" />
                        <button
                          className="w-full px-4 py-2.5 text-left text-sm text-[#f44336] hover:bg-[#f44336]/10 flex items-center gap-2"
                          onClick={() => handleDelete(graph.id)}
                          disabled={isDeleting === graph.id}
                        >
                          {isDeleting === graph.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          删除图谱
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mb-4 border border-[#2a3548]">
              <Network className="w-8 h-8 text-[#64748b]" />
            </div>
            <p className="text-[#94a3b8] mb-1">暂无知识图谱</p>
            <p className="text-sm text-[#64748b] mb-4">创建您的第一个知识图谱</p>
            <motion.button
              className="px-4 py-2 neo-btn-primary rounded-lg font-medium text-sm flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={openCreateModal}
            >
              <Plus className="w-4 h-4" />
              新建图谱
            </motion.button>
          </div>
        )}
      </NeoCard>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="neo-card-elevated p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[#f0f4f8]">新建知识图谱</h2>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={closeModal}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                    名称 <span className="text-[#f44336]">*</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full px-4 py-2.5 neo-input text-sm ${
                      formErrors.name ? 'border-[#f44336]' : ''
                    }`}
                    placeholder="输入知识图谱名称"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    maxLength={50}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-[#f44336] mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                    描述
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 neo-input text-sm resize-none"
                    placeholder="输入知识图谱描述（可选）"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-secondary rounded-lg font-medium text-sm"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={closeModal}
                  disabled={isCreating}
                >
                  取消
                </motion.button>
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-primary rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleCreate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      创建
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEditModal && selectedGraph && (
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              className="neo-card-elevated p-6 w-full max-w-md"
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-[#f0f4f8]">编辑知识图谱</h2>
                <motion.button
                  className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={closeModal}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                    名称 <span className="text-[#f44336]">*</span>
                  </label>
                  <input
                    type="text"
                    className={`w-full px-4 py-2.5 neo-input text-sm ${
                      formErrors.name ? 'border-[#f44336]' : ''
                    }`}
                    placeholder="输入知识图谱名称"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    maxLength={50}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-[#f44336] mt-1">{formErrors.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#94a3b8] mb-2">
                    描述
                  </label>
                  <textarea
                    className="w-full px-4 py-2.5 neo-input text-sm resize-none"
                    placeholder="输入知识图谱描述（可选）"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-secondary rounded-lg font-medium text-sm"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={closeModal}
                  disabled={isCreating}
                >
                  取消
                </motion.button>
                <motion.button
                  className="flex-1 px-4 py-2.5 neo-btn-primary rounded-lg font-medium text-sm flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleUpdate}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      保存
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
