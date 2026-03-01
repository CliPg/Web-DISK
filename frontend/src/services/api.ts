const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api'

/**
 * 文档API服务
 */
export const documentsApi = {
  /**
   * 上传文档
   */
  async upload(file: File, graphId?: string): Promise<{
    document_id: string
    filename: string
    task_id: string
    status: string
  }> {
    const formData = new FormData()
    formData.append('file', file)
    if (graphId) {
      formData.append('graph_id', graphId)
    }

    const response = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '上传失败')
    }

    return response.json()
  },

  /**
   * 获取文档列表
   */
  async list(params?: {
    skip?: number
    limit?: number
    status?: string
  }): Promise<{
    documents: Array<{
      id: string
      filename: string
      original_filename: string
      file_path: string
      file_size: number
      status: string
      task_id?: string
      error_message?: string
      created_at: string
      updated_at: string
      completed_at?: string
      graph_id?: string
      task_started_at?: string
      task_completed_at?: string
      input_tokens?: number
      output_tokens?: number
      total_tokens?: number
    }>
    total: number
  }> {
    const query = new URLSearchParams()
    if (params?.skip) query.append('skip', params.skip.toString())
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.status) query.append('status', params.status)

    const response = await fetch(`${API_BASE}/documents${query.toString() ? `?${query}` : ''}`)
    if (!response.ok) throw new Error('获取文档列表失败')
    return response.json()
  },

  /**
   * 获取单个文档详情
   */
  async get(id: string): Promise<{
    id: string
    filename: string
    original_filename: string
    file_path: string
    file_size: number
    status: string
    task_id?: string
    error_message?: string
    created_at: string
    updated_at: string
    completed_at?: string
    graph_id?: string
    input_tokens?: number
    output_tokens?: number
    total_tokens?: number
  }> {
    const response = await fetch(`${API_BASE}/documents/${id}`)
    if (!response.ok) throw new Error('获取文档详情失败')
    return response.json()
  },

  /**
   * 删除文档
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) throw new Error('删除文档失败')
    return response.json()
  },

  /**
   * 开始处理文档
   */
  async startProcessing(id: string): Promise<{
    message: string
    task_id: string
    celery_task_id: string
  }> {
    const response = await fetch(`${API_BASE}/documents/${id}/start`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '开始处理失败')
    }
    return response.json()
  },
}

/**
 * 任务API服务
 */
export const tasksApi = {
  /**
   * 获取任务详情
   */
  async get(taskId: string): Promise<{
    id: string
    document_id: string
    status: string
    progress: number
    current_step: string
    message: string
    error_message?: string
    created_at: string
    started_at?: string
    updated_at: string
    completed_at?: string
  }> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}`)
    if (!response.ok) throw new Error('获取任务详情失败')
    return response.json()
  },

  /**
   * 取消任务
   */
  async cancel(taskId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/tasks/${taskId}/cancel`, {
      method: 'POST',
    })
    if (!response.ok) throw new Error('取消任务失败')
    return response.json()
  },

  /**
   * 订阅任务进度（SSE）
   */
  subscribeProgress(
    taskId: string,
    onProgress: (data: {
      task_id: string
      status: string
      progress: number
      current_step: string
      message: string
      error?: string
    }) => void,
    onComplete: (status: string) => void,
    onError: (error: string) => void
  ): () => void {
    const eventSource = new EventSource(`${API_BASE}/tasks/${taskId}/stream`)

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data)
        onProgress(data)
      } catch (err) {
        console.error('Failed to parse progress data:', err)
      }
    })

    eventSource.addEventListener('complete', (e) => {
      try {
        const data = JSON.parse(e.data)
        onComplete(data.status)
      } catch (err) {
        console.error('Failed to parse complete data:', err)
      }
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      onError('连接中断')
      eventSource.close()
    })

    // 返回取消订阅函数
    return () => eventSource.close()
  },
}

/**
 * 知识图谱API服务
 */
export const kgApi = {
  /**
   * 获取知识图谱统计
   */
  async getStats(graphId?: string): Promise<{
    total_entities: number
    total_relations: number
    entity_types: Record<string, number>
    relation_types: Record<string, number>
  }> {
    const url = graphId
      ? `${API_BASE}/knowledge-graph/stats?graph_id=${graphId}`
      : `${API_BASE}/knowledge-graph/stats`
    const response = await fetch(url)
    if (!response.ok) throw new Error('获取图谱统计失败')
    return response.json()
  },

  /**
   * 获取实体列表
   */
  async getEntities(graphId: string, limit = 100, offset = 0, orderByRelationCount = false): Promise<{
    entities: Array<{
      id: string
      labels: string[]
      properties: Record<string, unknown>
    }>
    total: number
  }> {
    const params = new URLSearchParams({
      graph_id: graphId,
      limit: limit.toString(),
      offset: offset.toString(),
    })
    if (orderByRelationCount) {
      params.append('order_by_relation_count', 'true')
    }
    const response = await fetch(`${API_BASE}/knowledge-graph/entities?${params}`)
    if (!response.ok) throw new Error('获取实体列表失败')
    return response.json()
  },

  /**
   * 获取关系列表
   */
  async getRelations(graphId: string, limit = 100, offset = 0): Promise<{
    relations: Array<{
      start_id: string
      start_labels: string[]
      end_id: string
      end_labels: string[]
      type: string
      properties: Record<string, unknown>
    }>
    total: number
  }> {
    const response = await fetch(`${API_BASE}/knowledge-graph/relations?graph_id=${graphId}&limit=${limit}&offset=${offset}`)
    if (!response.ok) throw new Error('获取关系列表失败')
    return response.json()
  },

  /**
   * 搜索知识图谱
   */
  async searchKnowledgeGraph(graphId: string, query: string, searchType = 'all', limit = 20): Promise<{
    results: Array<{
      id: string
      type: 'entity' | 'relation'
      name: string
      label: string
      description: string
      labels: string[]
      properties: Record<string, unknown>
      related_entities?: Array<{
        relation_type: string
        relation_name: string
        entity_id: string
        entity_name: string
        entity_labels: string[]
      }>
      source_entity?: { id: string; name: string }
      target_entity?: { id: string; name: string }
      relevance: number
    }>
    total: number
  }> {
    const params = new URLSearchParams({
      graph_id: graphId,
      query: query,
      search_type: searchType,
      limit: limit.toString(),
    })
    const response = await fetch(`${API_BASE}/knowledge-graph/search?${params}`)
    if (!response.ok) throw new Error('搜索知识图谱失败')
    return response.json()
  },

  /**
   * 语义相似度搜索
   */
  async searchSimilarEntities(graphId: string, query: string, limit = 10): Promise<{
    results: Array<{
      id: string
      type: 'entity'
      name: string
      label: string
      description: string
      labels: string[]
      properties: Record<string, unknown>
      relevance: number
    }>
    total: number
  }> {
    const response = await fetch(`${API_BASE}/knowledge-graph/search/similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        graph_id: graphId,
        query: query,
        limit: limit,
      }),
    })
    if (!response.ok) throw new Error('语义搜索失败')
    return response.json()
  },

  /**
   * 获取关联实体
   */
  async getRelatedEntities(graphId: string, entityId: string, depth = 1): Promise<{
    related_entities: Array<{
      id: string
      name: string
      label: string
      description: string
      labels: string[]
      properties: Record<string, unknown>
      connection_count: number
    }>
    total: number
  }> {
    const response = await fetch(
      `${API_BASE}/knowledge-graph/entities/${entityId}/related?graph_id=${graphId}&depth=${depth}`
    )
    if (!response.ok) throw new Error('获取关联实体失败')
    return response.json()
  },
}

/**
 * 知识图谱管理API服务
 */
export const graphsApi = {
  /**
   * 获取知识图谱列表
   */
  async list(): Promise<{
    graphs: Array<{
      id: string
      name: string
      description?: string
      entity_count: number
      relation_count: number
      document_count: number
      created_at: string
      updated_at: string
      is_default: boolean
    }>
  }> {
    const response = await fetch(`${API_BASE}/graphs`)
    if (!response.ok) throw new Error('获取知识图谱列表失败')
    return response.json()
  },

  /**
   * 创建知识图谱
   */
  async create(data: {
    name: string
    description?: string
  }): Promise<{
    id: string
    name: string
    description?: string
    created_at: string
  }> {
    const response = await fetch(`${API_BASE}/graphs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '创建知识图谱失败')
    }
    return response.json()
  },

  /**
   * 删除知识图谱
   */
  async delete(id: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/graphs/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '删除知识图谱失败')
    }
    return response.json()
  },

  /**
   * 更新知识图谱
   */
  async update(id: string, data: {
    name?: string
    description?: string
  }): Promise<{
    id: string
    name: string
    description?: string
    updated_at: string
  }> {
    const response = await fetch(`${API_BASE}/graphs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '更新知识图谱失败')
    }
    return response.json()
  },

  /**
   * 清空知识图谱
   */
  async clear(id: string): Promise<{
    message: string
    reset_documents: number
  }> {
    const response = await fetch(`${API_BASE}/graphs/${id}/clear`, {
      method: 'POST',
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || '清空知识图谱失败')
    }
    return response.json()
  },
}
