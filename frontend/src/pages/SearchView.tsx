import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  X,
  Circle,
  ArrowRight,
  FileText,
  Clock,
  ChevronRight,
  Sparkles,
  Network,
  ChevronDown,
  Loader2,
  Trash2,
  Info,
  Link2,
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
import type { SearchResult, KnowledgeGraph } from '../types'
import { kgApi, graphsApi } from '../services/api'
import { useSelectedGraph } from '../hooks/useSelectedGraph'

// localStorage keys
const SEARCH_STATE_KEY = 'searchViewState'
const RECENT_SEARCHES_KEY = 'recentSearches'

const typeFilters = [
  { value: 'all', label: '全部' },
  { value: 'entity', label: '实体' },
  { value: 'relation', label: '关系' },
]

const typeIcons: Record<SearchResult['type'], typeof Circle> = {
  entity: Circle,
  relation: ArrowRight,
  document: FileText,
}

const typeColors: Record<SearchResult['type'], string> = {
  entity: '#3b82f6',
  relation: '#22c55e',
  document: '#f59e0b',
}

// 搜索结果转换为 SearchResult 格式
function transformSearchResult(result: any): SearchResult {
  const baseResult: SearchResult = {
    id: result.id,
    type: result.type,
    title: result.name || result.label || '未命名',
    description: result.description || '暂无描述',
    relevance: result.relevance || 1,
  }

  // 添加元数据
  if (result.related_entities && result.related_entities.length > 0) {
    baseResult.metadata = {
      '关联实体': result.related_entities.length.toString(),
    }
  }

  if (result.source_entity || result.target_entity) {
    baseResult.metadata = {
      ...baseResult.metadata,
      '起始实体': result.source_entity?.name || '-',
      '目标实体': result.target_entity?.name || '-',
    }
  }

  // 保存原始数据
  baseResult.name = result.name
  baseResult.label = result.label
  baseResult.labels = result.labels
  baseResult.properties = result.properties
  baseResult.related_entities = result.related_entities
  baseResult.source_entity = result.source_entity
  baseResult.target_entity = result.target_entity

  return baseResult
}

export default function SearchView() {
  // 知识图谱选择相关状态
  const [graphs, setGraphs] = useState<KnowledgeGraph[]>([])
  const [graphDropdownOpen, setGraphDropdownOpen] = useState(false)

  // 使用持久化的选择 hook
  const { selectedGraphId, setSelectedGraphId } = useSelectedGraph(graphs)

  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [showRecent, setShowRecent] = useState(true)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
      return saved ? JSON.parse(saved) : ['深度学习', 'Transformer', '神经网络', '注意力机制']
    }
    return ['深度学习', 'Transformer', '神经网络', '注意力机制']
  })

  // 防抖定时器
  const debounceTimerRef = useRef<number | null>(null)
  // 是否已加载保存的状态
  const [stateLoaded, setStateLoaded] = useState(false)

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

  // 保存搜索状态到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stateToSave = {
        query,
        activeFilter,
        results,
        showRecent,
        timestamp: Date.now(),
      }
      localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(stateToSave))
    }
  }, [query, activeFilter, results, showRecent])

  // 保存最近搜索到 localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches))
    }
  }, [recentSearches])

  // 加载保存的搜索状态（只在组件挂载时执行一次）
  useEffect(() => {
    if (stateLoaded) return

    if (typeof window !== 'undefined') {
      const savedState = localStorage.getItem(SEARCH_STATE_KEY)
      if (savedState) {
        try {
          const state = JSON.parse(savedState)
          // 只在最近30分钟内的状态才恢复
          const thirtyMinutes = 30 * 60 * 1000
          if (state.timestamp && Date.now() - state.timestamp < thirtyMinutes) {
            setQuery(state.query || '')
            setActiveFilter(state.activeFilter || 'all')
            setResults(state.results || [])
            setShowRecent(state.showRecent ?? true)
          }
        } catch (e) {
          console.error('Failed to load saved state:', e)
        }
      }
    }
    setStateLoaded(true)
  }, [])

  // 删除单个搜索记录
  const deleteRecentSearch = useCallback((term: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setRecentSearches(prev => prev.filter(t => t !== term))
  }, [])

  // 清空所有搜索记录
  const clearAllRecentSearches = useCallback(() => {
    setRecentSearches([])
  }, [])

  // 处理点击搜索结果
  const handleResultClick = useCallback((result: SearchResult) => {
    setSelectedResult(result)
  }, [])

  // 关闭详情面板
  const closeDetailPanel = useCallback(() => {
    setSelectedResult(null)
  }, [])

  // 执行搜索
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!selectedGraphId) {
      console.warn('No graph selected')
      setIsSearching(false)
      return
    }

    if (!searchQuery.trim()) {
      setResults([])
      setShowRecent(true)
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    setShowRecent(false)

    try {
      const data = await kgApi.searchKnowledgeGraph(
        selectedGraphId,
        searchQuery,
        activeFilter === 'all' ? 'all' : activeFilter,
        50
      )

      const transformedResults = data.results.map(transformSearchResult)
      setResults(transformedResults)

      // 添加到最近搜索（去重并限制数量）
      setRecentSearches(prev => {
        const filtered = prev.filter(t => t !== searchQuery)
        return [searchQuery, ...filtered].slice(0, 8)
      })
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setIsSearching(false)
    }
  }, [selectedGraphId, activeFilter])

  // 处理搜索输入（带防抖）
  const handleSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!searchQuery.trim()) {
      setResults([])
      setShowRecent(true)
      return
    }

    debounceTimerRef.current = window.setTimeout(() => {
      performSearch(searchQuery)
    }, 400)
  }, [performSearch])

  // 处理快速搜索按钮点击
  const handleQuickSearch = useCallback((term: string) => {
    setQuery(term)
    performSearch(term)
  }, [performSearch])

  // 处理筛选器变化
  useEffect(() => {
    if (query.trim()) {
      performSearch(query)
    }
  }, [activeFilter])

  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((r) => r.type === activeFilter)

  const selectedGraph = graphs.find(g => g.id === selectedGraphId)

  return (
    <div className="h-full flex flex-col gap-6" style={{ maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto', position: 'relative' }}>
      {/* Graph Selector - 左上角绝对定位 */}
      <div className="absolute top-0 left-0 z-10" style={{ marginTop: '16px' }}>
        <div className="relative graph-selector" style={{ width: '220px' }}>
          <motion.button
            className="w-full flex items-center gap-2 neo-card rounded-lg text-sm justify-between hover:border-[#00b4d8]/50 transition-colors"
            style={{ padding: '8px 12px' }}
            onClick={() => setGraphDropdownOpen(!graphDropdownOpen)}
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-[#00b4d8]/20 flex items-center justify-center">
                <Network className="w-3 h-3 text-[#00b4d8]" />
              </div>
              <span className="text-[#f0f4f8] truncate">
                {selectedGraph ? selectedGraph.name : '选择知识图谱'}
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#64748b] transition-transform shrink-0 ${graphDropdownOpen ? 'rotate-180' : ''}`} />
          </motion.button>

          <AnimatePresence>
            {graphDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute top-full left-0 right-0 mt-2 neo-card-elevated rounded-lg z-20 max-h-[240px] overflow-y-auto"
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
                      // 清空搜索结果
                      setResults([])
                      setQuery('')
                      setShowRecent(true)
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
                {graphs.length === 0 && (
                  <div className="text-center py-4 text-[#64748b] text-sm">
                    暂无知识图谱
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Header */}
      <div className="text-center" style={{ paddingTop: '16px' }}>
        <motion.div
          className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-[#00b4d8] to-[#0096c7] shadow-lg"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ padding: '8px', marginBottom: '16px' }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </motion.div>
        <h1 className="text-2xl font-semibold text-[#f0f4f8]" style={{ marginBottom: '4px' }}>知识搜索</h1>
        <div className="flex items-center justify-center gap-2">
          <p className="text-[#64748b] text-sm">搜索图谱中的实体或关系</p>
        </div>
      </div>

      {/* Search Bar */}
      <NeoCard variant="elevated" style={{ padding: '2px' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3" style={{ padding: '0 12px', flex: 1 }}>
            <Search className="w-4 h-4 text-[#64748b] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="输入关键词搜索..."
              className="flex-1 bg-transparent outline-none text-[#f0f4f8] placeholder:text-[#64748b] min-w-0"
              style={{ paddingTop: '8px', paddingBottom: '8px', fontSize: '14px' }}
              disabled={!selectedGraphId}
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-[#00b4d8] animate-spin shrink-0" />
            )}
            {query && !isSearching && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-[#2a3548] flex items-center justify-center text-[#94a3b8] hover:bg-[#3b4a61] hover:text-[#f0f4f8] shrink-0"
                style={{ padding: '4px' }}
                onClick={() => {
                  setQuery('')
                  setResults([])
                  setShowRecent(true)
                }}
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </div>
          <motion.button
            className="neo-btn-primary rounded-lg font-medium text-sm flex items-center gap-2 shrink-0"
            style={{ padding: '4px 12px' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => performSearch(query)}
            disabled={!selectedGraphId || !query.trim()}
          >
            <Search className="w-4 h-4" />
            搜索
          </motion.button>
        </div>
      </NeoCard>

      {/* Recent Searches */}
      <AnimatePresence>
        {showRecent && !query && recentSearches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#64748b]" />
                <span className="text-sm text-[#64748b]">最近搜索</span>
              </div>
              <motion.button
                className="text-xs text-[#64748b] hover:text-[#f0f4f8] flex items-center gap-1 transition-colors"
                onClick={clearAllRecentSearches}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 className="w-3 h-3" />
                清空
              </motion.button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <motion.div
                  key={term}
                  className="neo-card rounded-lg flex items-center gap-2 group"
                  whileHover={{ scale: 1.02 }}
                  style={{ padding: '6px 10px' }}
                >
                  <button
                    className="text-sm text-[#94a3b8] hover:text-[#f0f4f8] flex-1"
                    onClick={() => handleQuickSearch(term)}
                    disabled={!selectedGraphId}
                  >
                    {term}
                  </button>
                  <motion.button
                    className="w-5 h-5 rounded flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8] hover:bg-[#2a3548] opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => deleteRecentSearch(term, e)}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-3 h-3" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters & Count */}
      {results.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-between gap-4 flex-wrap"
        >
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-[#64748b]" />
            <div className="flex gap-2">
              {typeFilters.map((filter) => (
                <motion.button
                  key={filter.value}
                  className={`rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === filter.value
                      ? 'bg-[#00b4d8] text-white'
                      : 'text-[#94a3b8] hover:bg-[#1a2332] hover:text-[#f0f4f8]'
                  }`}
                  style={{ padding: '8px 12px' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </motion.button>
              ))}
            </div>
          </div>
          <span className="text-sm text-[#64748b]">找到 {filteredResults.length} 个结果</span>
        </motion.div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="flex items-center justify-center" style={{ padding: '48px 0' }}>
          <motion.div
            className="w-10 h-10 border-3 border-[#00b4d8] border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {!isSearching && filteredResults.length > 0 && (
          <div className="flex-1 flex gap-4 overflow-hidden">
            <motion.div
              className="flex-1 overflow-y-auto"
              style={{ paddingBottom: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {filteredResults.map((result, index) => {
                const Icon = typeIcons[result.type]
                const color = typeColors[result.type]
                const isSelected = selectedResult?.id === result.id

                return (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <NeoCard
                      className="cursor-pointer group"
                      hover
                      style={{ padding: '16px', borderColor: isSelected ? color : undefined }}
                      onClick={() => handleResultClick(result)}
                    >
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + '20', padding: '8px' }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-[#f0f4f8]">{result.title}</h3>
                          <span
                            className="rounded-md text-xs font-medium text-white shrink-0"
                            style={{ backgroundColor: color, padding: '2px 8px' }}
                          >
                            {result.type === 'entity' ? '实体' : result.type === 'relation' ? '关系' : '文档'}
                          </span>
                        </div>
                        <p className="text-sm text-[#94a3b8] line-clamp-2" style={{ marginBottom: '8px' }}>{result.description}</p>

                        {/* Related Entities (for entity type) */}
                        {result.type === 'entity' && result.related_entities && result.related_entities.length > 0 && (
                          <div className="flex flex-wrap gap-2" style={{ marginBottom: '8px' }}>
                            <span className="text-xs text-[#64748b]">关联:</span>
                            {result.related_entities.slice(0, 4).map((rel, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded bg-[#1a2332] text-[#94a3b8] border border-[#2a3548]"
                              >
                                {rel.relation_type} → {rel.entity_name}
                              </span>
                            ))}
                            {result.related_entities.length > 4 && (
                              <span className="text-xs text-[#64748b]">
                                +{result.related_entities.length - 4} 更多
                              </span>
                            )}
                          </div>
                        )}

                        {/* Relation source/target (for relation type) */}
                        {result.type === 'relation' && (
                          <div className="flex items-center gap-2 text-sm" style={{ marginBottom: '8px' }}>
                            {result.source_entity && (
                              <span className="text-xs px-2 py-0.5 rounded bg-[#1a2332] text-[#94a3b8]">
                                {result.source_entity.name}
                              </span>
                            )}
                            <ArrowRight className="w-3 h-3 text-[#22c55e]" />
                            {result.target_entity && (
                              <span className="text-xs px-2 py-0.5 rounded bg-[#1a2332] text-[#94a3b8]">
                                {result.target_entity.name}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Metadata */}
                        {result.metadata && Object.keys(result.metadata).length > 0 && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {Object.entries(result.metadata).map(([key, value]) => (
                              <span key={key} className="text-xs text-[#64748b]">
                                <span className="text-[#4b5563]">{key}:</span> {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Relevance & Arrow */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#1a2332] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${result.relevance * 100}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-xs text-[#64748b] w-8 text-right">
                            {Math.round(result.relevance * 100)}%
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#3b4a61] group-hover:text-[#00b4d8] group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </NeoCard>
                </motion.div>
              )
            })}
            </motion.div>

            {/* Detail Panel */}
            <AnimatePresence mode="wait">
              {selectedResult ? (
                <motion.div
                  key="detail-panel"
                  initial={{ opacity: 0, x: 20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 360 }}
                  exit={{ opacity: 0, x: 20, width: 0 }}
                  transition={{ duration: 0.25 }}
                  className="shrink-0"
                >
                  <NeoCard className="h-full p-5" variant="elevated" style={{ width: '340px', overflowY: 'auto' }}>
                    {/* Header */}
                    <div className="flex items-start justify-between" style={{ marginBottom: '20px' }}>
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: typeColors[selectedResult.type] }}
                      >
                        <Info className="w-5 h-5 text-white" />
                      </div>
                      <motion.button
                        className="w-8 h-8 rounded-lg hover:bg-[#1a2332] flex items-center justify-center text-[#64748b] hover:text-[#f0f4f8]"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={closeDetailPanel}
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Title & Type */}
                    <h2 className="text-lg font-semibold text-[#f0f4f8]" style={{ marginBottom: '8px' }}>
                      {selectedResult.title}
                    </h2>
                    <span
                      className="inline-block px-2.5 py-1 rounded-md text-xs font-medium text-white"
                      style={{ backgroundColor: typeColors[selectedResult.type], marginBottom: '16px' }}
                    >
                      {selectedResult.type === 'entity' ? '实体' : '关系'}
                    </span>

                    {/* Description */}
                    <p className="text-sm text-[#94a3b8] leading-relaxed" style={{ marginBottom: '24px' }}>
                      {selectedResult.description || '暂无描述'}
                    </p>

                    {/* Related Entities (for entity type) */}
                    {selectedResult.type === 'entity' && selectedResult.related_entities && selectedResult.related_entities.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-[#f0f4f8] flex items-center gap-2" style={{ marginBottom: '12px' }}>
                          <Link2 className="w-4 h-4 text-[#00b4d8]" />
                          关联实体 ({selectedResult.related_entities.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                          {selectedResult.related_entities.map((rel, idx) => (
                            <motion.div
                              key={idx}
                              className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] hover:bg-[#111827] border border-[#2a3548] hover:border-[#3b4a61] cursor-pointer transition-all"
                              whileHover={{ x: 2 }}
                            >
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{
                                  backgroundColor: '#3b82f620',
                                }}
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{
                                    backgroundColor: '#3b82f6',
                                  }}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[#f0f4f8] truncate">
                                  {rel.entity_name}
                                </p>
                                <p className="text-xs text-[#64748b]" style={{ marginTop: '2px' }}>
                                  {rel.relation_type || rel.relation_name}
                                </p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Relation Details (for relation type) */}
                    {selectedResult.type === 'relation' && (
                      <div>
                        <h3 className="text-sm font-medium text-[#f0f4f8] flex items-center gap-2" style={{ marginBottom: '12px' }}>
                          <Link2 className="w-4 h-4 text-[#00b4d8]" />
                          连接实体
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {selectedResult.source_entity && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f620' }}>
                                <Circle className="w-3 h-3" style={{ color: '#3b82f6' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#64748b]">起始实体</p>
                                <p className="text-sm font-medium text-[#f0f4f8]">
                                  {selectedResult.source_entity.name}
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="flex justify-center">
                            <ArrowRight className="w-5 h-5 text-[#22c55e]" />
                          </div>
                          {selectedResult.target_entity && (
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0a0e17] border border-[#2a3548]">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f620' }}>
                                <Circle className="w-3 h-3" style={{ color: '#3b82f6' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-[#64748b]">目标实体</p>
                                <p className="text-sm font-medium text-[#f0f4f8]">
                                  {selectedResult.target_entity.name}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Properties */}
                    {selectedResult.properties && Object.keys(selectedResult.properties).length > 0 && (
                      <div style={{ marginTop: '24px' }}>
                        <h3 className="text-sm font-medium text-[#f0f4f8] flex items-center gap-2" style={{ marginBottom: '12px' }}>
                          <Info className="w-4 h-4 text-[#00b4d8]" />
                          属性信息
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {Object.entries(selectedResult.properties)
                            .filter(([key]) => !['name', 'label', 'description', 'embedding', 'graph_id'].includes(key))
                            .slice(0, 10)
                            .map(([key, value]) => (
                            <div key={key} className="flex justify-between text-sm">
                              <span className="text-[#64748b]">{key}:</span>
                              <span className="text-[#94a3b8] text-right max-w-[180px] truncate">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Labels */}
                    {selectedResult.labels && selectedResult.labels.length > 0 && (
                      <div style={{ marginTop: '16px' }}>
                        <div className="flex flex-wrap gap-2">
                          {selectedResult.labels.map((label) => (
                            <span
                              key={label}
                              className="px-2 py-1 rounded-md text-xs bg-[#1a2332] text-[#94a3b8] border border-[#2a3548]"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </NeoCard>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ width: '0' }}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!isSearching && query && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
          style={{ padding: '64px 0' }}
        >
          <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mx-auto border border-[#2a3548]" style={{ padding: '12px', marginBottom: '16px' }}>
            <Search className="w-8 h-8 text-[#64748b]" />
          </div>
          <p className="text-[#94a3b8]">未找到与 "{query}" 相关的结果</p>
          <p className="text-sm text-[#64748b]" style={{ marginTop: '4px' }}>尝试使用其他关键词搜索</p>
        </motion.div>
      )}

      {/* No Graph Selected State */}
      {!selectedGraphId && !isSearching && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center flex-1 flex items-center justify-center"
          style={{ padding: '64px 0' }}
        >
          <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mx-auto border border-[#2a3548]" style={{ padding: '12px', marginBottom: '16px' }}>
            <Network className="w-8 h-8 text-[#64748b]" />
          </div>
          <p className="text-[#94a3b8]">请先选择一个知识图谱</p>
          <p className="text-sm text-[#64748b]" style={{ marginTop: '4px' }}>从左上角下拉菜单中选择要搜索的知识图谱</p>
        </motion.div>
      )}
    </div>
  )
}
