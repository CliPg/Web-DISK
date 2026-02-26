import { useState, useEffect, useRef, useCallback } from 'react'
import { useSelectedGraph } from '../hooks/useSelectedGraph'
import { motion, AnimatePresence } from 'framer-motion'
import { ZoomIn, ZoomOut, Maximize2, X, Info, Link2, Layers, Download, RefreshCw, FileJson, Image as ImageIcon, ChevronDown, Network } from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { KGNode, KGEdge } from '../types'
import type { KnowledgeGraph } from '../types'
import { kgApi, graphsApi } from '../services/api'

interface NodePosition {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

interface DragState {
  isDragging: boolean
  nodeId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

interface CanvasState {
  panX: number
  panY: number
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
    description: typeof rel.properties.description === 'string' ? rel.properties.description : undefined,
    properties: rel.properties,
  }))
}

export default function GraphView() {
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<KGNode[]>([])
  const [edges, setEdges] = useState<KGEdge[]>([])
  // 保存实际的实体和关系总数（不受筛选影响）
  const [totalEntityCount, setTotalEntityCount] = useState(0)
  const [totalRelationCount, setTotalRelationCount] = useState(0)
  const positionsRef = useRef<NodePosition[]>([])
  const [positions, setPositions] = useState<NodePosition[]>([])
  const [selectedNode, setSelectedNode] = useState<KGNode | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<KGEdge | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const animationRef = useRef<number | undefined>(undefined)
  const edgesRef = useRef<KGEdge[]>([])
  const dimensionsRef = useRef({ width: 800, height: 600 })

  // 拖拽状态
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    nodeId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
  })
  const dragStateRef = useRef<DragState>(dragState)
  const dragStartPositionRef = useRef<{ x: number; y: number } | null>(null)

  // 画布平移状态
  const [canvasState, setCanvasState] = useState<CanvasState>({
    panX: 0,
    panY: 0,
  })
  const canvasStateRef = useRef<CanvasState>(canvasState)
  const [isCanvasDragging, setIsCanvasDragging] = useState(false)
  const canvasDragStartRef = useRef<{ x: number; y: number } | null>(null)

  // 知识图谱选择相关状态
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([])
  const [graphDropdownOpen, setGraphDropdownOpen] = useState(false)

  // 使用持久化的选择 hook
  const { selectedGraphId, setSelectedGraphId } = useSelectedGraph(graphs)

  // 加载知识图谱列表
  useEffect(() => {
    const loadGraphs = async () => {
      try {
        const data = await graphsApi.list()
        setGraphs(data.graphs)
      } catch (error) {
        console.error('Failed to load graphs:', error)
      }
    }
    loadGraphs()
  }, [])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.graph-selector')) {
        setGraphDropdownOpen(false)
      }
    }

    if (graphDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [graphDropdownOpen])

  // 同步拖拽状态到 ref
  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  // 同步画布状态到 ref
  useEffect(() => {
    canvasStateRef.current = canvasState
  }, [canvasState])

  // 处理拖拽的鼠标移动事件
  useEffect(() => {
    if (!dragState.isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentDrag = dragStateRef.current
      if (!currentDrag.isDragging || currentDrag.nodeId === null) return

      setPositions((prevPositions) =>
        prevPositions.map((pos) =>
          pos.id === currentDrag.nodeId
            ? {
                ...pos,
                x: e.clientX - currentDrag.offsetX,
                y: e.clientY - currentDrag.offsetY,
                vx: 0,
                vy: 0,
              }
            : pos
        )
      )
    }

    const handleMouseUp = () => {
      setDragState((prev) => ({
        ...prev,
        isDragging: false,
        nodeId: null,
      }))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState.isDragging])

  // 处理画布拖拽
  useEffect(() => {
    if (!isCanvasDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const startPos = canvasDragStartRef.current
      if (!startPos) return

      const deltaX = e.clientX - startPos.x
      const deltaY = e.clientY - startPos.y

      setCanvasState((prev) => ({
        panX: prev.panX + deltaX,
        panY: prev.panY + deltaY,
      }))

      // 更新起始位置
      canvasDragStartRef.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseUp = () => {
      setIsCanvasDragging(false)
      canvasDragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isCanvasDragging])

  // Load knowledge graph data when selected graph changes
  useEffect(() => {
    if (!selectedGraphId) return

    const loadGraphData = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // 从 graphs 列表中获取当前图谱的实际统计数据
        const currentGraph = graphs.find(g => g.id === selectedGraphId)
        const actualEntityCount = currentGraph?.entity_count || 0
        const actualRelationCount = currentGraph?.relation_count || 0

        // 保存实际的实体和关系总数
        setTotalEntityCount(actualEntityCount)
        setTotalRelationCount(actualRelationCount)

        // 并行加载实体和关系，传入 graph_id
        // 注意：API 限制最大 limit=500，所以我们最多能获取 500 个数据
        const [entitiesData, relationsData] = await Promise.all([
          kgApi.getEntities(selectedGraphId, 500, 0),
          kgApi.getRelations(selectedGraphId, 500, 0),
        ])

        // 转换数据格式
        let transformedNodes = transformEntities(entitiesData.entities)
        let transformedEdges = transformRelations(relationsData.relations)

        // 当实际实体数量超过100时，只显示关系数量最多的50个实体
        if (actualEntityCount > 100) {
          // 统计每个实体的关系数量
          const nodeRelationCount = new Map<string, number>()
          for (const edge of transformedEdges) {
            nodeRelationCount.set(edge.source, (nodeRelationCount.get(edge.source) || 0) + 1)
            nodeRelationCount.set(edge.target, (nodeRelationCount.get(edge.target) || 0) + 1)
          }

          // 按关系数量排序，取前50个
          const topNodeIds = Array.from(nodeRelationCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([nodeId]) => nodeId)

          // 如果不足50个，补充没有关系的节点
          if (topNodeIds.length < 50) {
            const remainingNodes = transformedNodes
              .filter(node => !topNodeIds.includes(node.id))
              .slice(0, 50 - topNodeIds.length)
            topNodeIds.push(...remainingNodes.map(node => node.id))
          }

          // 过滤节点和边，只保留相关的
          const nodeSet = new Set(topNodeIds)
          transformedNodes = transformedNodes.filter(node => nodeSet.has(node.id))
          transformedEdges = transformedEdges.filter(edge =>
            nodeSet.has(edge.source) && nodeSet.has(edge.target)
          )

          console.log(`实体数量超过100 (实际${actualEntityCount}个，已加载${entitiesData.entities.length}个)，已筛选显示关系数量最多的${transformedNodes.length}个实体`)
        }

        setNodes(transformedNodes)
        setEdges(transformedEdges)
        edgesRef.current = transformedEdges
      } catch (error) {
        console.error('Failed to load graph data:', error)
        setLoadError('加载知识图谱数据失败')
      } finally {
        setIsLoading(false)
      }
    }

    loadGraphData()
  }, [selectedGraphId, graphs])

  // Initialize positions
  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setDimensions({ width, height })
      dimensionsRef.current = { width, height }

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
      positionsRef.current = initialPositions
    }

    const timer = setTimeout(updateDimensions, 100)
    window.addEventListener('resize', updateDimensions)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [nodes])

  // Force simulation - 使用 ref 避免依赖问题
  useEffect(() => {
    if (positions.length === 0) return

    let stableFrames = 0
    let frameCount = 0
    let isRunning = true
    const maxFrames = 600 // 最多运行 600 帧（约 10 秒）

    // 检查是否正在拖拽
    const isDraggingNode = () => dragStateRef.current.isDragging
    const getDraggingNodeId = () => dragStateRef.current.nodeId

    // 根据节点数量动态调整参数
    const nodeCount = positions.length
    const repulsionForce = Math.max(500, 3000 - nodeCount * 10) // 节点越多，斥力越小
    const idealDistance = Math.max(80, 150 - nodeCount * 0.5) // 节点越多，理想距离越小
    const attractionStrength = 0.008 // 弹簧强度
    const centerGravity = 0.002 // 中心引力
    const damping = 0.85 // 阻尼（越大收敛越快）

    const simulate = () => {
      if (!isRunning) return

      // 拖拽时暂停模拟
      if (isDraggingNode()) {
        animationRef.current = requestAnimationFrame(simulate)
        return
      }

      const currentEdges = edgesRef.current
      const currentDimensions = dimensionsRef.current
      const draggingNodeId = getDraggingNodeId()

      // 直接修改 ref 中的位置
      const next = positionsRef.current.map((p) => ({ ...p }))
      let totalVelocity = 0

      // Repulsion between nodes (斥力)
      for (let i = 0; i < next.length; i++) {
        // 跳过正在拖拽的节点
        if (next[i].id === draggingNodeId) continue

        for (let j = i + 1; j < next.length; j++) {
          // 跳过正在拖拽的节点
          if (next[j].id === draggingNodeId) continue

          const dx = next[j].x - next[i].x
          const dy = next[j].y - next[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsionForce / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          next[i].vx -= fx
          next[i].vy -= fy
          next[j].vx += fx
          next[j].vy += fy
        }
      }

      // Attraction along edges (弹簧引力)
      currentEdges.forEach((edge) => {
        const source = next.find((n) => n.id === edge.source)
        const target = next.find((n) => n.id === edge.target)
        if (source && target) {
          const dx = target.x - source.x
          const dy = target.y - source.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = (dist - idealDistance) * attractionStrength
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force

          // 只对非拖拽节点应用力
          if (source.id !== draggingNodeId) {
            source.vx += fx
            source.vy += fy
          }
          if (target.id !== draggingNodeId) {
            target.vx -= fx
            target.vy -= fy
          }
        }
      })

      // Center gravity (中心引力)
      const centerX = currentDimensions.width / 2
      const centerY = currentDimensions.height / 2
      next.forEach((n) => {
        if (n.id !== draggingNodeId) {
          n.vx += (centerX - n.x) * centerGravity
          n.vy += (centerY - n.y) * centerGravity
        }
      })

      // Apply velocity with damping (应用速度和阻尼)
      next.forEach((n) => {
        if (n.id !== draggingNodeId) {
          n.vx *= damping
          n.vy *= damping
          n.x += n.vx
          n.y += n.vy
          n.x = Math.max(50, Math.min(currentDimensions.width - 50, n.x))
          n.y = Math.max(50, Math.min(currentDimensions.height - 50, n.y))
          totalVelocity += Math.abs(n.vx) + Math.abs(n.vy)
        }
      })

      positionsRef.current = next

      frameCount++
      const avgVelocity = totalVelocity / next.length

      // 随着时间降低稳定阈值，初期更容易判定为稳定
      const dynamicThreshold = Math.max(0.05, 0.5 - frameCount * 0.001)

      // 检查是否稳定
      if (avgVelocity < dynamicThreshold) {
        stableFrames++
      } else {
        stableFrames = Math.max(0, stableFrames - 1) // 不稳定时减少计数
      }

      // 更新状态用于渲染
      setPositions(next)

      // 达到稳定帧数或超过最大帧数时停止
      if (stableFrames > 30 || frameCount >= maxFrames) {
        isRunning = false
        console.log(`Simulation stabilized after ${frameCount} frames`)
        return
      }

      animationRef.current = requestAnimationFrame(simulate)
    }

    animationRef.current = requestAnimationFrame(simulate)

    return () => {
      isRunning = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [positions.length])

  const getPosition = useCallback(
    (id: string) => positions.find((p) => p.id === id) || { x: 0, y: 0 },
    [positions]
  )

  // 开始拖拽节点
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation()
      const pos = getPosition(nodeId)
      dragStartPositionRef.current = { x: pos.x, y: pos.y }
      setDragState({
        isDragging: true,
        nodeId,
        startX: pos.x,
        startY: pos.y,
        offsetX: e.clientX - pos.x,
        offsetY: e.clientY - pos.y,
      })
    },
    [getPosition]
  )

  // 处理节点点击（区分拖拽和点击）
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: KGNode) => {
      e.stopPropagation()
      const pos = getPosition(node.id)
      const startPos = dragStartPositionRef.current
      const hasMoved = startPos && (Math.abs(pos.x - startPos.x) > 5 || Math.abs(pos.y - startPos.y) > 5)

      if (!hasMoved) {
        setSelectedNode(node)
        setSelectedEdge(null)
      }
    },
    [getPosition]
  )

  // 画布鼠标按下事件
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // 只在左键点击时响应
    if (e.button !== 0) return
    // 如果正在拖拽节点，不触发画布拖拽
    if (dragState.isDragging) return
    // 检查点击的是否是节点或边
    const target = e.target as SVGElement
    if (target.closest('g[data-node]')) return
    if (target.closest('line')) return

    // 清除选择
    setSelectedNode(null)
    setSelectedEdge(null)

    setIsCanvasDragging(true)
    canvasDragStartRef.current = { x: e.clientX, y: e.clientY }
  }, [dragState.isDragging])

  // 重置画布位置
  const handleResetCanvas = useCallback(() => {
    setCanvasState({ panX: 0, panY: 0 })
    setZoom(1)
  }, [])

  const getConnectedNodes = (nodeId: string) => {
    const connected = new Set<string>()
    edges.forEach((edge) => {
      if (edge.source === nodeId) connected.add(edge.target)
      if (edge.target === nodeId) connected.add(edge.source)
    })
    return connected
  }

  const getConnectedNodesForEdge = (edgeId: string) => {
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return new Set<string>()
    return new Set([edge.source, edge.target])
  }

  const connectedToHovered = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>()
  const connectedToSelectedEdge = selectedEdge ? getConnectedNodesForEdge(selectedEdge.id) : new Set<string>()

  // Refresh graph data
  const handleRefresh = async () => {
    if (!selectedGraphId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      const [entitiesData, relationsData] = await Promise.all([
        kgApi.getEntities(selectedGraphId, 500, 0),
        kgApi.getRelations(selectedGraphId, 500, 0),
      ])

      const transformedNodes = transformEntities(entitiesData.entities)
      const transformedEdges = transformRelations(relationsData.relations)

      setNodes(transformedNodes)
      setEdges(transformedEdges)
      edgesRef.current = transformedEdges
    } catch (error) {
      console.error('Failed to refresh graph data:', error)
      setLoadError('加载知识图谱数据失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 导出 JSON
  const handleExportJSON = () => {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalEntities: nodes.length,
        totalRelations: edges.length,
      },
      entities: nodes.map(node => ({
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        properties: node.properties,
      })),
      relations: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `knowledge-graph-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 导出 PNG 图片
  const handleExportPNG = useCallback(() => {
    const svgElement = containerRef.current?.querySelector('svg')
    if (!svgElement) return

    // 获取 SVG 的边界框
    const bbox = svgElement.getBoundingClientRect()
    const scaleX = zoom
    const scaleY = zoom

    // 创建克隆的 SVG 用于导出
    const clone = svgElement.cloneNode(true) as SVGSVGElement
    clone.setAttribute('width', `${bbox.width * scaleX}`)
    clone.setAttribute('height', `${bbox.height * scaleY}`)
    clone.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`)
    clone.style.transform = ''

    // 将 SVG 转换为字符串
    const svgData = new XMLSerializer().serializeToString(clone)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)

    // 使用 Canvas 转换为 PNG
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = bbox.width * scaleX * 2 // 2x 分辨率
      canvas.height = bbox.height * scaleY * 2
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // 填充深色背景
        ctx.fillStyle = '#0a0e17'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // 导出 PNG
        canvas.toBlob((blob) => {
          if (blob) {
            const pngUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = pngUrl
            a.download = `knowledge-graph-${new Date().toISOString().slice(0, 10)}.png`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(pngUrl)
          }
        })
      }
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      console.error('Failed to load SVG for export')
    }
    img.src = url
  }, [zoom, nodes, edges])

  // 检查是否有数据可导出
  const hasData = nodes.length > 0 || edges.length > 0


  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#f0f4f8]">知识图谱</h1>
          <p className="text-[#64748b] text-sm mt-0.5">
            {totalEntityCount} 个实体 · {totalRelationCount} 个关系
          </p>
        </div>

        {/* Legend and Actions */}
        <div className="flex items-center gap-4">
          {/* Graph Selector */}
          <div className="relative graph-selector">
            <motion.button
              className="flex items-center gap-2 neo-card rounded-lg text-sm min-w-[180px] justify-between hover:border-[#00b4d8]/50 transition-colors"
              style={{ padding: '6px 10px' }}
              onClick={() => setGraphDropdownOpen(!graphDropdownOpen)}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-[#00b4d8]/20 flex items-center justify-center">
                  <Network className="w-3 h-3 text-[#00b4d8]" />
                </div>
                <span className="text-[#f0f4f8] truncate max-w-[120px]">
                  {graphs.find((g) => g.id === selectedGraphId)?.name || '加载中...'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#64748b] transition-transform ${graphDropdownOpen ? 'rotate-180' : ''}`} />
            </motion.button>

              <AnimatePresence>
                {graphDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full right-0 mt-2 w-full neo-card-elevated rounded-lg z-20 max-h-[300px] overflow-y-auto"
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
                        <span className="text-[#f0f4f8] truncate">{graph.name}</span>
                        {graph.is_default && (
                          <span className="px-1.5 py-0.5 text-xs bg-[#00c853]/20 text-[#00c853] rounded shrink-0">默认</span>
                        )}
                        {selectedGraphId === graph.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#00c853] ml-auto shrink-0" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <motion.button
              className="neo-btn-secondary rounded-lg flex items-center gap-2 text-sm"
              style={{ padding: '6px 20px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportJSON}
              disabled={!hasData || isLoading}
              title="导出为 JSON 文件"
            >
              <FileJson className="w-4 h-4" />
              JSON
            </motion.button>
            <motion.button
              className="neo-btn-secondary rounded-lg flex items-center gap-2 text-sm"
              style={{ padding: '6px 20px' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleExportPNG}
              disabled={!hasData || isLoading}
              title="导出为 PNG 图片"
            >
              <ImageIcon className="w-4 h-4" />
              PNG
            </motion.button>
          </div>
          {/* Refresh Button */}
          <motion.button
            className="neo-btn-secondary rounded-lg flex items-center gap-2 text-sm"
            style={{ padding: '6px 20px' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </motion.button>
          {/* Legend */}
          <div
            className="flex items-center gap-4 neo-card"
            style={{ padding: '8px 16px' }}
          >
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
              onClick={handleResetCanvas}
              title="重置视图"
            >
              <Maximize2 className="w-4 h-4 text-[#94a3b8]" />
            </motion.button>
          </div>

          {/* Graph Info Badge */}
          <div
            className="absolute top-4 left-4 flex items-center gap-2 bg-[#0a0e17]/80 rounded-lg border border-[#2a3548]"
            style={{ padding: '8px 16px' }}
          >
            <Layers className="w-4 h-4 text-[#00b4d8]" />
            <span className="text-xs text-[#94a3b8]">缩放: {Math.round(zoom * 100)}%</span>
          </div>

          {/* SVG Canvas */}
          <div ref={containerRef} className="w-full h-full bg-[#0a0e17] overflow-hidden">
            <svg
              width="100%"
              height="100%"
              style={{ cursor: isCanvasDragging ? 'grabbing' : 'grab' }}
              onMouseDown={handleCanvasMouseDown}
            >
              {/* 无限背景网格 - 使用 patternTransform 实现无限滚动 */}
              <defs>
                <pattern
                  id="grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                  patternTransform={`translate(${canvasState.panX % 40}, ${canvasState.panY % 40})`}
                >
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a2332" strokeWidth="0.5" />
                </pattern>
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
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g
                style={{
                  transform: `translate(${canvasState.panX}px, ${canvasState.panY}px) scale(${zoom})`,
                  transformOrigin: 'center',
                }}
              >
              {/* Edges */}
              <g>
                {edges.map((edge) => {
                  const source = getPosition(edge.source)
                  const target = getPosition(edge.target)
                  const isEdgeSelected = selectedEdge?.id === edge.id
                  const isHighlighted =
                    hoveredNode === edge.source || hoveredNode === edge.target ||
                    hoveredEdge === edge.id || isEdgeSelected
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
                        strokeWidth={isEdgeSelected ? 3 : isHighlighted ? 2 : 1}
                        opacity={hoveredNode && !isHighlighted ? 0.15 : 1}
                        markerEnd={isHighlighted ? 'url(#arrowhead-active)' : 'url(#arrowhead)'}
                        style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                        onMouseEnter={() => setHoveredEdge(edge.id)}
                        onMouseLeave={() => setHoveredEdge(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEdge(edge)
                          setSelectedNode(null)
                        }}
                      />
                      {isHighlighted && (
                        <text
                          x={midX}
                          y={midY - 8}
                          textAnchor="middle"
                          fill="#00b4d8"
                          fontSize="11"
                          fontWeight="500"
                          pointerEvents="none"
                          style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
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
                  const isConnectedToEdge = connectedToSelectedEdge.has(node.id)
                  const isDimmed = hoveredNode && !isHovered && !isConnected
                  const isSelected = selectedNode?.id === node.id
                  const isDragging = dragState.nodeId === node.id

                  return (
                    <g
                      key={node.id}
                      data-node
                      transform={`translate(${pos.x}, ${pos.y})`}
                      style={{
                        cursor: dragState.isDragging ? 'grabbing' : 'grab',
                        transition: 'opacity 0.2s ease'
                      }}
                      opacity={isDimmed ? 0.2 : 1}
                      onMouseEnter={() => !dragState.isDragging && setHoveredNode(node.id)}
                      onMouseLeave={() => !dragState.isDragging && setHoveredNode(null)}
                      onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                      onClick={(e) => handleNodeClick(e, node)}
                      filter={isHovered || isSelected || isDragging || isConnectedToEdge ? 'url(#glow)' : undefined}
                    >
                      <circle
                        r={isHovered || isDragging || isConnectedToEdge ? 28 : 24}
                        fill={colors.bg}
                        stroke={isSelected || isDragging || isConnectedToEdge ? '#00b4d8' : colors.border}
                        strokeWidth={isSelected || isDragging || isConnectedToEdge ? 3 : isHovered ? 2 : 1.5}
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        fill="#fff"
                        fontSize="10"
                        fontWeight="600"
                        pointerEvents="none"
                      >
                        {node.label.length > 4 ? node.label.slice(0, 4) + '…' : node.label}
                      </text>
                    </g>
                  )
                })}
              </g>
              </g>
            </svg>
          </div>
        </NeoCard>

        {/* Detail Panel */}
        <AnimatePresence mode="wait">
          {selectedNode ? (
            <motion.div
              key="node-detail"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0"
            >
              <NeoCard className="h-full p-5 w-80" variant="elevated">
                <div className="flex items-start justify-between" style={{ marginBottom: '20px' }}>
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
                    onClick={() => { setSelectedNode(null); setSelectedEdge(null) }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>

                <h2 className="text-lg font-semibold text-[#f0f4f8]" style={{ marginBottom: '8px' }}>
                  {selectedNode.label}
                </h2>
                <span
                  className="inline-block px-2.5 py-1 rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: nodeColors[selectedNode.type].bg, marginBottom: '16px' }}
                >
                  {typeLabels[selectedNode.type]}
                </span>

                <p className="text-sm text-[#94a3b8] leading-relaxed" style={{ marginBottom: '28px' }}>
                  {selectedNode.description || '暂无描述信息'}
                </p>

                {/* Related nodes */}
                <div>
                  <h3 className="text-sm font-medium text-[#f0f4f8] flex items-center gap-2" style={{ marginBottom: '12px' }}>
                    <Link2 className="w-4 h-4 text-[#00b4d8]" />
                    关联实体
                  </h3>
                  <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                            onClick={() => { setSelectedNode(relatedNode); setSelectedEdge(null) }}
                          >
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
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
                              <p className="text-xs text-[#64748b]" style={{ marginTop: '2px' }}>{edge.label}</p>
                            </div>
                          </motion.div>
                        )
                      })}
                  </div>
                </div>
              </NeoCard>
            </motion.div>
          ) : selectedEdge ? (
            <motion.div
              key="edge-detail"
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 320 }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              transition={{ duration: 0.25 }}
              className="shrink-0"
            >
              <NeoCard className="h-full p-5 w-80" variant="elevated">
                <div className="flex items-start justify-between" style={{ marginBottom: '20px' }}>
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: '#00b4d8' }}
                  >
                    <Link2 className="w-5 h-5 text-white" />
                  </div>
                  <motion.button
                    className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { setSelectedEdge(null) }}
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>

                <h2 className="text-lg font-semibold text-[#f0f4f8]" style={{ marginBottom: '8px' }}>
                  {selectedEdge.label}
                </h2>
                <span
                  className="inline-block px-2.5 py-1 rounded-md text-xs font-medium text-white"
                  style={{ backgroundColor: '#00b4d8', marginBottom: '16px' }}
                >
                  关系
                </span>

                {selectedEdge.description && (
                  <p className="text-sm text-[#94a3b8] leading-relaxed" style={{ marginBottom: '24px' }}>
                    {selectedEdge.description}
                  </p>
                )}

                {/* Connected entities */}
                <div>
                  <h3 className="text-sm font-medium text-[#f0f4f8] flex items-center gap-2" style={{ marginBottom: '12px' }}>
                    <Info className="w-4 h-4 text-[#00b4d8]" />
                    连接实体
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {nodes.find(n => n.id === selectedEdge.source) && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: nodeColors[nodes.find(n => n.id === selectedEdge.source)!.type].bg + '20',
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: nodeColors[nodes.find(n => n.id === selectedEdge.source)!.type].bg,
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#64748b]">起始实体</p>
                          <p className="text-sm font-medium text-[#f0f4f8]">
                            {nodes.find(n => n.id === selectedEdge.source)?.label}
                          </p>
                        </div>
                      </div>
                    )}
                    {nodes.find(n => n.id === selectedEdge.target) && (
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: nodeColors[nodes.find(n => n.id === selectedEdge.target)!.type].bg + '20',
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: nodeColors[nodes.find(n => n.id === selectedEdge.target)!.type].bg,
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#64748b]">目标实体</p>
                          <p className="text-sm font-medium text-[#f0f4f8]">
                            {nodes.find(n => n.id === selectedEdge.target)?.label}
                          </p>
                        </div>
                      </div>
                    )}
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
                <p className="text-[#94a3b8] text-sm mb-1">点击图谱中的节点或关系</p>
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
