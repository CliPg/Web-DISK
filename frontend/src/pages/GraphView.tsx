import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, X, Info, Link2, Layers, Download, RefreshCw } from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { KGNode, KGEdge } from '../types'
import { kgApi } from '../services/api'

interface NodePosition {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

const nodeColors: Record<KGNode['type'], { bg: string; border: string; glow: string }> = {
  concept:     { bg: '#3b82f6', border: '#60a5fa', glow: 'rgba(59, 130, 246, 0.4)' },
  technology:  { bg: '#22c55e', border: '#4ade80', glow: 'rgba(34, 197, 94, 0.4)' },
  method:      { bg: '#f59e0b', border: '#fbbf24', glow: 'rgba(245, 158, 11, 0.4)' },
  application: { bg: '#a855f7', border: '#c084fc', glow: 'rgba(168, 85, 247, 0.4)' },
  model:       { bg: '#ec4899', border: '#f472b6', glow: 'rgba(236, 72, 153, 0.4)' },
}

const typeLabels: Record<KGNode['type'], string> = {
  concept: '概念',
  technology: '技术',
  method: '方法',
  application: '应用',
  model: '模型',
}

// 将后端实体类型映射到前端节点类型
function mapNodeType(labels: string[]): KGNode['type'] {
  const labelStr = labels.join(' ').toLowerCase()
  if (labelStr.includes('technology') || labelStr.includes('技术')) return 'technology'
  if (labelStr.includes('method') || labelStr.includes('方法')) return 'method'
  if (labelStr.includes('application') || labelStr.includes('应用')) return 'application'
  if (labelStr.includes('model') || labelStr.includes('模型')) return 'model'
  return 'concept'
}

// 从 Neo4j 属性中提取节点名称
function extractNodeName(properties: Record<string, unknown>, labels: string[]): string {
  // 尝试从 properties 中获取 name 字段
  if (typeof properties.name === 'string') return properties.name
  if (typeof properties.label === 'string') return properties.label
  if (typeof properties.title === 'string') return properties.title
  // 使用第一个 label 作为后备
  return labels[0] || 'Unknown'
}

// 转换后端实体数据为前端节点格式
function transformEntities(entities: Array<{ id: string; labels: string[]; properties: Record<string, unknown> }>): KGNode[] {
  return entities.map(entity => ({
    id: entity.id,
    label: extractNodeName(entity.properties, entity.labels),
    type: mapNodeType(entity.labels),
    description: typeof entity.properties.description === 'string' ? entity.properties.description : undefined,
    properties: entity.properties as Record<string, string>,
  }))
}

// 转换后端关系数据为前端边格式
function transformRelations(relations: Array<{ start_id: string; end_id: string; type: string; properties: Record<string, unknown> }>): KGEdge[] {
  return relations.map((rel, index) => ({
    id: `edge-${rel.start_id}-${rel.end_id}-${index}`,
    source: rel.start_id,
    target: rel.end_id,
    label: rel.type,
  }))
}

export default function GraphView() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<KGNode[]>([])
  const [edges, setEdges] = useState<KGEdge[]>([])
  const [positions, setPositions] = useState<NodePosition[]>([])
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const animationRef = useRef<number | undefined>(undefined)

  // Load knowledge graph data on mount
  useEffect(() => {
    const loadGraphData = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // 并行加载实体和关系
        const [entitiesData, relationsData] = await Promise.all([
          kgApi.getEntities(500, 0),
          kgApi.getRelations(500, 0),
        ])

        // 转换数据格式
        const transformedNodes = transformEntities(entitiesData.entities)
        const transformedEdges = transformRelations(relationsData.relations)

        setNodes(transformedNodes)
        setEdges(transformedEdges)
      } catch (error) {
        console.error('Failed to load graph data:', error)
        setLoadError('加载知识图谱数据失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadGraphData()
  }, [])

  // Initialize positions
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setDimensions({ width, height })

      const initialPositions = nodes.map((node, i) => {
        const angle = (i / nodes.length) * Math.PI * 2
        const radius = Math.min(width, height) * 0.28
        return {
          id: node.id,
          x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
          y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
        }
      })
      setPositions(initialPositions)
    }

    const timer = setTimeout(updateDimensions, 100)
    window.addEventListener('resize', updateDimensions)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [nodes])

  // Force simulation
  useEffect(() => {
    if (positions.length === 0) return

    const simulate = () => {
      setPositions((prev) => {
        const next = prev.map((p) => ({ ...p }))

        // Repulsion between nodes
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x
            const dy = next[j].y - next[i].y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = 1800 / (dist * dist)
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            next[i].vx -= fx
            next[i].vy -= fy
            next[j].vx += fx
            next[j].vy += fy
          }
        }

        // Attraction along edges
        edges.forEach((edge) => {
          const source = next.find((n) => n.id === edge.source)
          const target = next.find((n) => n.id === edge.target)
          if (source && target) {
            const dx = target.x - source.x
            const dy = target.y - source.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = (dist - 100) * 0.015
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            source.vx += fx
            source.vy += fy
            target.vx -= fx
            target.vy -= fy
          }
        })

        // Center gravity
        const centerX = dimensions.width / 2
        const centerY = dimensions.height / 2
        next.forEach((n) => {
          n.vx += (centerX - n.x) * 0.003
          n.vy += (centerY - n.y) * 0.003
        })

        // Apply velocity with damping
        next.forEach((n) => {
          n.vx *= 0.88
          n.vy *= 0.88
          n.x += n.vx
          n.y += n.vy
          n.x = Math.max(50, Math.min(dimensions.width - 50, n.x))
          n.y = Math.max(50, Math.min(dimensions.height - 50, n.y))
        })

        return next
      })

      animationRef.current = requestAnimationFrame(simulate)
    }

    animationRef.current = requestAnimationFrame(simulate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [positions.length, dimensions])

  const getPosition = useCallback(
    (id: string) => positions.find((p) => p.id === id) || { x: 0, y: 0 },
    [positions]
  )

  const getConnectedNodes = (nodeId: string) => {
    const connected = new Set<string>()
    edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target)
      if (edge.target === nodeId) connected.add(edge.source)
    })
    return connected
  }

  const connectedToHovered = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>()

  // Refresh graph data
  const handleRefresh = async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const [entitiesData, relationsData] = await Promise.all([
        kgApi.getEntities(500, 0),
        kgApi.getRelations(500, 0),
      ])

      const transformedNodes = transformEntities(entitiesData.entities)
      const transformedEdges = transformRelations(relationsData.relations)

      setNodes(transformedNodes)
      setEdges(transformedEdges)
    } catch (error) {
      console.error('Failed to refresh graph data:', error)
      setLoadError('加载知识图谱数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">知识图谱</h1>
          <p className="text-[#64748b] text-sm mt-0.5">
            {nodes.length} 个实体 · {edges.length} 个关系
          </p>
        </div>
        {/* Legend and Actions */}
        <div className="flex items-center gap-4">
          {/* Refresh Button */}
          <motion.button
            className="px-3 py-1.5 neo-btn-secondary rounded-lg flex items-center gap-2 text-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </motion.button>
          {/* Legend */}
          <div className="flex items-center gap-4 px-4 py-2 neo-card">
            {Object.entries(nodeColors).map(([type, colors]) => (
              <div key={type} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.bg }}
                />
                <span className="text-xs text-[#94a3b8]">{typeLabels[type as KGNode['type']]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-[#00b4d8] animate-spin mx-auto mb-3" />
            <p className="text-[#94a3b8]">加载知识图谱中...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {loadError && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mx-auto mb-4 border border-[#2a3548]">
              <Info className="w-8 h-8 text-[#64748b]" />
            </div>
            <p className="text-[#94a3b8] mb-2">{loadError}</p>
            <motion.button
              className="px-4 py-2 neo-btn-primary rounded-lg inline-flex items-center gap-2 text-sm mt-4"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4" />
              重试
            </motion.button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !loadError && (
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Graph Area */}
          <NeoCard className="flex-1 relative overflow-hidden p-0" variant="elevated">
            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
              <motion.button
                className="w-9 h-9 neo-btn-secondary flex items-center justify-center"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            >
              <ZoomIn className="w-4 h-4 text-[#94a3b8]" />
            </motion.button>
            <motion.button
              className="w-9 h-9 neo-btn-secondary flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            >
              <ZoomOut className="w-4 h-4 text-[#94a3b8]" />
            </motion.button>
            <motion.button
              className="w-9 h-9 neo-btn-secondary flex items-center justify-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="w-4 h-4 text-[#94a3b8]" />
            </motion.button>
          </div>

          {/* Graph Info Badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-[#0a0e17]/80 rounded-lg border border-[#2a3548]">
            <Layers className="w-4 h-4 text-[#00b4d8]" />
            <span className="text-xs text-[#94a3b8]">缩放: {Math.round(zoom * 100)}%</span>
          </div>

          {/* SVG Canvas */}
          <div ref={containerRef} className="w-full h-full bg-[#0a0e17]">
            <svg
              width="100%"
              height="100%"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#3b4a61" />
                </marker>
                <marker
                  id="arrowhead-active"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3.5, 0 7" fill="#00b4d8" />
                </marker>
                {/* Glow filter */}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid pattern */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2332" strokeWidth="0.5" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Edges */}
              <g>
                {edges.map((edge) => {
                  const source = getPosition(edge.source)
                  const target = getPosition(edge.target)
                  const isHighlighted =
                    hoveredNode === edge.source || hoveredNode === edge.target
                  const midX = (source.x + target.x) / 2
                  const midY = (source.y + target.y) / 2

                  return (
                    <g key={edge.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={isHighlighted ? '#00b4d8' : '#2a3548'}
                        strokeWidth={isHighlighted ? 2 : 1}
                        opacity={hoveredNode && !isHighlighted ? 0.15 : 1}
                        markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      {isHighlighted && (
                        <text
                          x={midX}
                          y={midY - 8}
                          textAnchor="middle"
                          fill="#00b4d8"
                          fontSize="11"
                          fontWeight="500"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </g>

              {/* Nodes */}
              <g>
                {nodes.map((node) => {
                  const pos = getPosition(node.id)
                  const colors = nodeColors[node.type]
                  const isHovered = hoveredNode === node.id
                  const isConnected = connectedToHovered.has(node.id)
                  const isDimmed = hoveredNode && !isHovered && !isConnected
                  const isSelected = selectedNode?.id === node.id

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      opacity={isDimmed ? 0.2 : 1}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => setSelectedNode(node)}
                      filter={isHovered || isSelected ? 'url(#glow)' : undefined}
                    >
                      <circle
                        r={isHovered ? 28 : 24}
                        fill={colors.bg}
                        stroke={isSelected ? '#00b4d8' : colors.border}
                        strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.5}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        fill="#fff"
                        fontSize="10"
                        fontWeight="600"
                      >
                        {node.label.length > 4 ? node.label.slice(0, 4) + '…' : node.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        </NeoCard>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedNode ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0"
            >
              <NeoCard className="h-full p-5 w-80" variant="elevated">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: nodeColors[selectedNode.type].bg }}
                  >
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <motion.button
                    className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedNode(null)}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>

                <h2 className="text-lg font-semibold text-[#f0f4f8] mb-2">
                  {selectedNode.label}
                </h2>
                <span
                  className="inline-block px-2.5 py-1 rounded-md text-xs font-medium text-white mb-4"
                  style={{ backgroundColor: nodeColors[selectedNode.type].bg }}
                >
                  {typeLabels[selectedNode.type]}
                </span>

                <p className="text-sm text-[#94a3b8] leading-relaxed mb-6">
                  {selectedNode.description || '暂无描述信息'}
                </p>

                {/* Related nodes */}
                <div>
                  <h3 className="text-sm font-medium text-[#f0f4f8] mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-[#00b4d8]" />
                    关联实体
                  </h3>
                  <div className="space-y-2 max-h-[240px] overflow-y-auto">
                    {edges
                      .filter(
                        (e) =>
                          e.source === selectedNode.id || e.target === selectedNode.id
                      )
                      .slice(0, 6)
                      .map((edge) => {
                        const relatedId =
                          edge.source === selectedNode.id ? edge.target : edge.source
                        const relatedNode = nodes.find((n) => n.id === relatedId)
                        if (!relatedNode) return null
                        return (
                          <motion.div
                            key={edge.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] hover:bg-[#111827] border border-[#2a3548] hover:border-[#3b4a61] cursor-pointer transition-all"
                            whileHover={{ x: 2 }}
                            onClick={() => setSelectedNode(relatedNode)}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: nodeColors[relatedNode.type].bg + '20',
                              }}
                            >
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{
                                  backgroundColor: nodeColors[relatedNode.type].bg,
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#f0f4f8] truncate">
                                {relatedNode.label}
                              </p>
                              <p className="text-xs text-[#64748b]">{edge.label}</p>
                            </div>
                          </motion.div>
                        )
                      })}
                  </div>
                </div>
              </NeoCard>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-80 shrink-0"
            >
              <NeoCard className="h-full p-5 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-xl bg-[#1a2332] flex items-center justify-center mb-4 border border-[#2a3548]">
                  <Info className="w-6 h-6 text-[#64748b]" />
                </div>
                <p className="text-[#94a3b8] text-sm mb-1">点击图谱中的节点</p>
                <p className="text-[#64748b] text-sm">查看详细信息</p>
              </NeoCard>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}
    </div>
  )
}
