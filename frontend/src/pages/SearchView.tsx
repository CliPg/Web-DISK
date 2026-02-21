import { useState } from 'react'
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
} from 'lucide-react'
import NeoCard from '../components/ui/GlassCard'
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
  entity: '#3b82f6',
  relation: '#22c55e',
  document: '#f59e0b',
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
    <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center pt-4">
        <motion.div
          className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-[#00b4d8] to-[#0096c7] mb-4 shadow-lg"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <Sparkles className="w-7 h-7 text-white" />
        </motion.div>
        <h1 className="text-2xl font-semibold text-[#f0f4f8] mb-1">知识搜索</h1>
        <p className="text-[#64748b] text-sm">搜索图谱中的实体、关系或文档</p>
      </div>

      {/* Search Bar */}
      <NeoCard className="p-2" variant="elevated">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-3 px-4">
            <Search className="w-5 h-5 text-[#64748b] shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                handleSearch(e.target.value)
              }}
              placeholder="输入关键词搜索..."
              className="flex-1 py-3 bg-transparent outline-none text-[#f0f4f8] placeholder:text-[#64748b] min-w-0"
            />
            {query && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-[#2a3548] flex items-center justify-center text-[#94a3b8] hover:bg-[#3b4a61] hover:text-[#f0f4f8] shrink-0"
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
            className="px-6 py-3 neo-btn-primary rounded-lg font-medium text-sm flex items-center gap-2.5 shrink-0"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSearch(query)}
          >
            <Search className="w-4 h-4" />
            搜索
          </motion.button>
        </div>
      </NeoCard>

      {/* Recent Searches */}
      <AnimatePresence>
        {showRecent && !query && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[#64748b]" />
              <span className="text-sm text-[#64748b]">最近搜索</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {recentSearches.map((term) => (
                <motion.button
                  key={term}
                  className="px-4 py-2 neo-card rounded-lg text-sm text-[#94a3b8] hover:text-[#f0f4f8] hover:border-[#3b4a61]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
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
            <Filter className="w-4 h-4 text-[#64748b]" />
            <div className="flex gap-2">
              {typeFilters.map((filter) => (
                <motion.button
                  key={filter.value}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeFilter === filter.value
                      ? 'bg-[#00b4d8] text-white'
                      : 'text-[#94a3b8] hover:bg-[#1a2332] hover:text-[#f0f4f8]'
                  }`}
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
        <div className="flex items-center justify-center py-12">
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
          <motion.div className="space-y-3 flex-1 overflow-y-auto pb-4">
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
                  <NeoCard className="p-4 cursor-pointer group" hover>
                    <div className="flex items-start gap-4">
                      {/* Type Icon */}
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: color + '20' }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-[#f0f4f8]">{result.title}</h3>
                          <span
                            className="px-2 py-0.5 rounded-md text-xs font-medium text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {result.type === 'entity' ? '实体' : result.type === 'relation' ? '关系' : '文档'}
                          </span>
                        </div>
                        <p className="text-sm text-[#94a3b8] line-clamp-2 mb-2">{result.description}</p>

                        {/* Metadata */}
                        {result.metadata && (
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
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!isSearching && query && results.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <div className="w-16 h-16 rounded-xl bg-[#1a2332] flex items-center justify-center mx-auto mb-4 border border-[#2a3548]">
            <Search className="w-8 h-8 text-[#64748b]" />
          </div>
          <p className="text-[#94a3b8]">未找到与 "{query}" 相关的结果</p>
          <p className="text-sm text-[#64748b] mt-1">尝试使用其他关键词搜索</p>
        </motion.div>
      )}
    </div>
  )
}
