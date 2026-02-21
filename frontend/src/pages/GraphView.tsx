import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, X, Info, Link2 } from 'lucide-react'
import GlassCard from '../components/ui/GlassCard'
import { mockNodes, mockEdges } from '../data/mock'
import type { KGNode } from '../types'

interface NodePosition {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

const nodeColors: Record<KGNode['type'], { bg: string; border: string; text: string }> = {
  concept:     { bg: '#007AFF', border: '#0055CC', text: '#FFFFFF' },
  technology:  { bg: '#34C759', border: '#248A3D', text: '#FFFFFF' },
  method:      { bg: '#FF9500', border: '#C93400', text: '#FFFFFF' },
  application: { bg: '#AF52DE', border: '#8944AB', text: '#FFFFFF' },
  model:       { bg: '#FF2D55', border: '#D70015', text: '#FFFFFF' },
}

const typeLabels: Record<KGNode['type'], string> = {
  concept: '概念',
  technology: '技术',
  method: '方法',
  application: '应用',
  model: '模型',
}

export default function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<NodePosition[]>([])
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const animationRef = useRef<number | undefined>(undefined)

  // Initialize positions
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setDimensions({ width, height })

      const initialPositions = mockNodes.map((node, i) => {
        const angle = (i / mockNodes.length) * Math.PI * 2
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

    // Delay to ensure container is rendered
    const timer = setTimeout(updateDimensions, 100)
    window.addEventListener('resize', updateDimensions)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

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
        mockEdges.forEach((edge) => {
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
          // Boundary constraints
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
    mockEdges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target)
      if (edge.target === nodeId) connected.add(edge.source)
    })
    return connected
  }

  const connectedToHovered = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">知识图谱</h1>
          <p className="text-gray-500 mt-1">
            {mockNodes.length} 个实体 · {mockEdges.length} 个关系
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4">
          {Object.entries(nodeColors).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors.bg }}
              />
              <span className="text-sm text-gray-500">{typeLabels[type as KGNode['type']]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6" style={{ height: 'calc(100vh - 180px)' }}>
        {/* Graph Area */}
        <GlassCard className="flex-1 relative overflow-hidden" variant="heavy">
          {/* Zoom Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
            <motion.button
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-glass"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            >
              <ZoomIn className="w-4 h-4" />
            </motion.button>
            <motion.button
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-glass"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            >
              <ZoomOut className="w-4 h-4" />
            </motion.button>
            <motion.button
              className="w-9 h-9 glass rounded-lg flex items-center justify-center text-gray-600 hover:text-gray-800 shadow-glass"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setZoom(1)}
            >
              <Maximize2 className="w-4 h-4" />
            </motion.button>
          </div>

          {/* SVG Canvas */}
          <div ref={containerRef} className="w-full h-full">
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
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Edges */}
              <g>
                {mockEdges.map((edge) => {
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
                        stroke={isHighlighted ? '#007AFF' : '#cbd5e1'}
                        strokeWidth={isHighlighted ? 2 : 1}
                        opacity={hoveredNode && !isHighlighted ? 0.2 : 1}
                        markerEnd="url(#arrowhead)"
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      {isHighlighted && (
                        <text
                          x={midX}
                          y={midY - 8}
                          textAnchor="middle"
                          fill="#007AFF"
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
                {mockNodes.map((node) => {
                  const pos = getPosition(node.id)
                  const colors = nodeColors[node.type]
                  const isHovered = hoveredNode === node.id
                  const isConnected = connectedToHovered.has(node.id)
                  const isDimmed = hoveredNode && !isHovered && !isConnected

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
                      opacity={isDimmed ? 0.25 : 1}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={() => setSelectedNode(node)}
                    >
                      <circle
                        r={isHovered ? 26 : 22}
                        fill={colors.bg}
                        stroke={isHovered ? '#fff' : colors.border}
                        strokeWidth={isHovered ? 3 : 2}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        fill={colors.text}
                        fontSize="10"
                        fontWeight="500"
                      >
                        {node.label.length > 4 ? node.label.slice(0, 4) + '…' : node.label}
                      </text>
                    </g>
                  )
                })}
              </g>
            </svg>
          </div>
        </GlassCard>

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
              <GlassCard className="h-full p-5 w-80" variant="heavy">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: nodeColors[selectedNode.type].bg }}
                  >
                    <Info className="w-5 h-5 text-white" />
                  </div>
                  <motion.button
                    className="w-8 h-8 rounded-lg hover:bg-black/5 flex items-center justify-center text-gray-400 hover:text-gray-600"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedNode(null)}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>

                <h2 className="text-lg font-semibold text-gray-800 mb-1">
                  {selectedNode.label}
                </h2>
                <span
                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium text-white mb-4"
                  style={{ backgroundColor: nodeColors[selectedNode.type].bg }}
                >
                  {typeLabels[selectedNode.type]}
                </span>

                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  {selectedNode.description || '暂无描述信息'}
                </p>

                {/* Related nodes */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Link2 className="w-4 h-4" />
                    关联实体
                  </h3>
                  <div className="space-y-2 max-h-[280px] overflow-y-auto">
                    {mockEdges
                      .filter(
                        (e) =>
                          e.source === selectedNode.id || e.target === selectedNode.id
                      )
                      .slice(0, 6)
                      .map((edge) => {
                        const relatedId =
                          edge.source === selectedNode.id ? edge.target : edge.source
                        const relatedNode = mockNodes.find((n) => n.id === relatedId)
                        if (!relatedNode) return null
                        return (
                          <motion.div
                            key={edge.id}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] cursor-pointer transition-colors"
                            whileHover={{ x: 2 }}
                            onClick={() => setSelectedNode(relatedNode)}
                          >
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center"
                              style={{
                                backgroundColor: nodeColors[relatedNode.type].bg + '20',
                              }}
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full"
                                style={{
                                  backgroundColor: nodeColors[relatedNode.type].bg,
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-700 truncate">
                                {relatedNode.label}
                              </p>
                              <p className="text-xs text-gray-400">{edge.label}</p>
                            </div>
                          </motion.div>
                        )
                      })}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-80 shrink-0"
            >
              <GlassCard className="h-full p-5 flex flex-col items-center justify-center text-center" variant="default">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                  <Info className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">点击图谱中的节点</p>
                <p className="text-gray-400 text-sm">查看详细信息</p>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
