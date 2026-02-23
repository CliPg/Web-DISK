import { useState, useEffect, useRef } from 'react'
import type { KnowledgeGraph } from '../types'

const STORAGE_KEY = 'selectedGraphId'

/**
 * 知识图谱选择的持久化 Hook
 * 自动保存选择到 localStorage，并在页面加载时恢复
 */
export function useSelectedGraph(graphs: KnowledgeGraph[]) {
  // 使用 ref 跟踪是否已经初始化过，避免重复设置
  const isInitialized = useRef(false)

  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(() => {
    // 初始化时从 localStorage 读取
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved
    }
    return null
  })

  // 当 graphs 加载完成后，如果没有保存的选择或者保存的选择不存在，则选择默认图谱
  useEffect(() => {
    if (graphs.length === 0) return

    // 如果已经初始化过，跳过
    if (isInitialized.current) {
      isInitialized.current = true
      return
    }

    const savedId = localStorage.getItem(STORAGE_KEY)
    const graphExists = savedId && graphs.some((g) => g.id === savedId)

    if (graphExists) {
      // 使用保存的选择（不需要再次设置，因为 useState 已经读取了）
      isInitialized.current = true
    } else {
      // 选择默认图谱或第一个图谱
      const defaultGraph = graphs.find((g) => g.is_default)
      const graphToSelect = defaultGraph || graphs[0]
      setSelectedGraphId(graphToSelect.id)
      localStorage.setItem(STORAGE_KEY, graphToSelect.id)
      isInitialized.current = true
    }
  }, [graphs])

  // 包装 setSelectedGraphId，同时更新 localStorage
  const handleSetSelectedGraphId = (graphId: string) => {
    setSelectedGraphId(graphId)
    localStorage.setItem(STORAGE_KEY, graphId)
  }

  return {
    selectedGraphId,
    setSelectedGraphId: handleSetSelectedGraphId,
  }
}
