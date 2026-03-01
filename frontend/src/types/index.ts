export interface KGNode {
  id: string
  label: string
  type: 'concept' | 'technology' | 'method' | 'application' | 'model'
  description?: string
  properties?: Record<string, string>
}

export interface KGEdge {
  id: string
  source: string
  target: string
  label: string
  description?: string
  properties?: Record<string, unknown>
}

export interface KGDocument {
  id: string
  name: string
  fileType: 'pdf' | 'docx' | 'txt' | 'md'
  size: string
  pages: number
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  uploadedAt: string
  entities?: number
  relations?: number
  taskId?: string
  errorMessage?: string
  filePath?: string
  graphId?: string
  graphName?: string
  // 任务时间信息（用于计算构建耗时）
  taskStartedAt?: string
  taskCompletedAt?: string
  // Token 消耗信息
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
}

export interface PipelineStage {
  id: string
  name: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  progress: number
  startTime?: string
  endTime?: string
  details?: string
}

export interface PipelineRun {
  id: string
  documentName: string
  stages: PipelineStage[]
  overallProgress: number
  status: 'running' | 'completed' | 'error'
  startTime: string
}

export interface SearchResult {
  id: string
  type: 'entity' | 'relation' | 'document'
  title: string
  description: string
  relevance: number
  metadata?: Record<string, string>
  // 新增字段用于后端返回数据
  name?: string
  label?: string
  labels?: string[]
  properties?: Record<string, unknown>
  related_entities?: RelatedEntity[]
  source_entity?: EntityRef
  target_entity?: EntityRef
}

export interface RelatedEntity {
  relation_type: string
  relation_name: string
  entity_id: string
  entity_name: string
  entity_labels: string[]
}

export interface EntityRef {
  id: string
  name: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'success'
  message: string
  source?: string
}

export interface KnowledgeGraph {
  id: string
  name: string
  description?: string
  entity_count: number
  relation_count: number
  document_count: number
  created_at: string
  updated_at: string
  is_default: boolean
}
