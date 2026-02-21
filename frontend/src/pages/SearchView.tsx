import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  X,
  Circle,
  ArrowRight,
  FileText,
  Sparkles,
  Clock,
  ChevronRight,
} from 'lucide-react'
import GlassCard from '../components/ui/GlassCard'
import { mockSearchResults } from '../data/mock'
import type { SearchResult } from '../types'

const typeFilters = [
  { value: 'all', label: '全部' },
  { value: 'entity', label: '实体' },
  { value: 'relation', label: '关系' },
  { value: 'document', label: '文档' },
]

const typeIcons: Record<SearchResult['type'], typeof Circle> = {
  entity: Circle,
  relation: ArrowRight,
  document: FileText,
}

const typeColors: Record<SearchResult['type'], string> = {
  entity: '#007AFF',
  relation: '#34C759',
  document: '#FF9500',
}

const recentSearches = ['深度学习', 'Transformer', '神经网络', '注意力机制']

export default function SearchView() {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showRecent, setShowRecent] = useState(true)

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      setShowRecent(true)
      return
    }

    setIsSearching(true)
    setShowRecent(false)

    setTimeout(() => {
      const filtered = mockSearchResults.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setResults(filtered.length > 0 ? filtered : mockSearchResults)
      setIsSearching(false)
    }, 400)
  }

  const filteredResults =
    activeFilter === 'all'
      ? results
      : results.filter((r) => r.type === activeFilter)

  return (
    <div className="space-y-8 max-w-3xl mx-auto px-4">
      {/* Header */}
      <div className="text-center pt-8 pb-4">
        <motion.div
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#007AFF] to-[#5AC8FA] mb-4 shadow-lg shadow-[#007AFF]/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </motion.div>
        <h1 className="text-2xl font-semibold text-gray-800 mb-1">知识搜索</h1>
        <p className="text-gray-500 text-sm">搜索图谱中的实体、关系或文档</p>
      </div>

      {/* Search Bar */}
      <GlassCard className="p-2" variant="heavy">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 px-3">
            <Search className="w-5 h-5 text-gray-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                handleSearch(e.target.value)
              }}
              placeholder="输入关键词搜索..."
              className="flex-1 py-2.5 bg-transparent outline-none text-gray-800 placeholder:text-gray-400 min-w-0"
            />
            {query && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300 shrink-0"
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
            className="px-6 py-3 bg-[#007AFF] text-white rounded-xl font-medium text-[15px] flex items-center gap-2.5 shrink-0"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSearch(query)}
          >
            <Search className="w-5 h-5" />
            搜索
          </motion.button>
        </div>
      </GlassCard>

      {/* Recent Searches */}
      <AnimatePresence>
        {showRecent && !query && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500">最近搜索</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {recentSearches.map((term) => (
                <motion.button
                  key={term}
                  className="px-5 py-2.5 glass rounded-full text-[15px] text-gray-600 hover:text-gray-800 shadow-glass"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setQuery(term)
                    handleSearch(term)
                  }}
                >
                  {term}
                </motion.button>
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
            <Filter className="w-5 h-5 text-gray-400" />
            <div className="flex gap-2">
              {typeFilters.map((filter) => (
                <motion.button
                  key={filter.value}
                  className={`px-4 py-2 rounded-lg text-[15px] font-medium transition-colors ${
                    activeFilter === filter.value
                      ? 'bg-[#007AFF] text-white'
                      : 'text-gray-500 hover:bg-black/5'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </motion.button>
              ))}
            </div>
          </div>
          <span className="text-sm text-gray-400">找到 {filteredResults.length} 个结果</span>
        </motion.div>
      )}

      {/* Loading State */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <motion.div
            className="w-10 h-10 border-3 border-[#007AFF] border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {!isSearching && filteredResults.length > 0 && (
          <motion.div className="space-y-3">
            {filteredResults.map((result, index) => {
              const Icon = typeIcons[result.type]
              const color = typeColors[result.type]

              return (
                <motion.div
                  key={result.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <GlassCard className="p-4 cursor-pointer group" hover>
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + '15' }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-gray-800">{result.title}</h3>
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {result.type === 'entity' ? '实体' : result.type === 'relation' ? '关系' : '文档'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2 mb-2">{result.description}</p>

                        {/* Metadata */}
                        {result.metadata && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {Object.entries(result.metadata).map(([key, value]) => (
                              <span key={key} className="text-xs text-gray-400">
                                <span className="text-gray-300">{key}:</span> {value}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Relevance & Arrow */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${result.relevance * 100}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 w-8 text-right">
                            {Math.round(result.relevance * 100)}%
                          </span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!isSearching && query && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-300" />
          </div>
          <p className="text-gray-500">未找到与 "{query}" 相关的结果</p>
          <p className="text-sm text-gray-400 mt-1">尝试使用其他关键词搜索</p>
        </motion.div>
      )}
    </div>
  )
}
