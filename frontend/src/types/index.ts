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
