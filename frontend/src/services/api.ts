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
  async getStats(): Promise<{
    total_entities: number
    total_relations: number
    entity_types: Record<string, number>
    relation_types: Record<string, number>
  }> {
    const response = await fetch(`${API_BASE}/knowledge-graph/stats`)
    if (!response.ok) throw new Error('获取图谱统计失败')
    return response.json()
  },

  /**
   * 获取实体列表
   */
  async getEntities(limit = 100, offset = 0): Promise<{
    entities: Array<{
      id: string
      labels: string[]
      properties: Record<string, unknown>
    }>
    total: number
  }> {
    const response = await fetch(`${API_BASE}/knowledge-graph/entities?limit=${limit}&offset=${offset}`)
    if (!response.ok) throw new Error('获取实体列表失败')
    return response.json()
  },

  /**
   * 获取关系列表
   */
  async getRelations(limit = 100, offset = 0): Promise<{
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
    const response = await fetch(`${API_BASE}/knowledge-graph/relations?limit=${limit}&offset=${offset}`)
    if (!response.ok) throw new Error('获取关系列表失败')
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
}
