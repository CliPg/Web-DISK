import type { KGNode, KGEdge, KGDocument, PipelineRun, SearchResult, LogEntry } from '../types'

/* ────────────────── Knowledge Graph ────────────────── */

export const mockNodes: KGNode[] = [
  { id: '1',  label: '人工智能',     type: 'concept',     description: '人工智能是计算机科学的一个分支，致力于创建能够模拟人类智能的系统。' },
  { id: '2',  label: '机器学习',     type: 'concept',     description: '机器学习是人工智能的核心方法，通过数据驱动的方式让计算机自动学习和改进。' },
  { id: '3',  label: '深度学习',     type: 'technology',  description: '深度学习是机器学习的子领域，使用多层神经网络进行特征学习和模式识别。' },
  { id: '4',  label: '神经网络',     type: 'technology',  description: '神经网络是一种模仿生物神经网络结构和功能的计算模型。' },
  { id: '5',  label: 'Transformer',  type: 'model',       description: 'Transformer 是一种基于自注意力机制的深度学习架构，广泛应用于 NLP 领域。' },
  { id: '6',  label: '注意力机制',   type: 'method',      description: '注意力机制允许模型动态地关注输入序列的不同部分，提升建模能力。' },
  { id: '7',  label: 'CNN',          type: 'model',       description: '卷积神经网络，擅长处理网格结构数据如图像，在计算机视觉领域广泛应用。' },
  { id: '8',  label: 'RNN',          type: 'model',       description: '循环神经网络，适用于处理序列数据，具有记忆能力。' },
  { id: '9',  label: '自然语言处理', type: 'application', description: '自然语言处理（NLP）是人工智能的重要应用领域，使机器能理解人类语言。' },
  { id: '10', label: '计算机视觉',   type: 'application', description: '计算机视觉使机器能够理解和处理视觉信息，广泛应用于图像识别。' },
  { id: '11', label: 'GPT',          type: 'model',       description: '生成式预训练变换器，用于文本生成和理解任务的大语言模型。' },
  { id: '12', label: 'BERT',         type: 'model',       description: '双向编码器表示，用于语言理解任务的预训练模型。' },
  { id: '13', label: '反向传播',     type: 'method',      description: '反向传播算法是训练神经网络的核心方法，通过梯度下降优化参数。' },
  { id: '14', label: '强化学习',     type: 'concept',     description: '强化学习通过智能体与环境的交互来学习最优策略。' },
  { id: '15', label: '知识图谱',     type: 'technology',  description: '知识图谱是一种用图结构表示和组织知识的技术，支持推理与检索。' },
]

export const mockEdges: KGEdge[] = [
  { id: 'e1',  source: '1',  target: '2',  label: '包含' },
  { id: 'e2',  source: '2',  target: '3',  label: '子领域' },
  { id: 'e3',  source: '3',  target: '4',  label: '基于' },
  { id: 'e4',  source: '4',  target: '7',  label: '变体' },
  { id: 'e5',  source: '4',  target: '8',  label: '变体' },
  { id: 'e6',  source: '3',  target: '5',  label: '发展出' },
  { id: 'e7',  source: '5',  target: '6',  label: '核心机制' },
  { id: 'e8',  source: '5',  target: '11', label: '衍生' },
  { id: 'e9',  source: '5',  target: '12', label: '衍生' },
  { id: 'e10', source: '9',  target: '11', label: '应用于' },
  { id: 'e11', source: '9',  target: '12', label: '应用于' },
  { id: 'e12', source: '10', target: '7',  label: '应用于' },
  { id: 'e13', source: '4',  target: '13', label: '训练方法' },
  { id: 'e14', source: '2',  target: '14', label: '包含' },
  { id: 'e15', source: '1',  target: '15', label: '相关技术' },
  { id: 'e16', source: '1',  target: '9',  label: '应用领域' },
  { id: 'e17', source: '1',  target: '10', label: '应用领域' },
  { id: 'e18', source: '8',  target: '9',  label: '用于' },
]

/* ────────────────── Documents ────────────────── */

export const mockDocuments: KGDocument[] = [
  { id: 'd1', name: '深度学习基础教程',     fileType: 'pdf',  size: '12.4 MB', pages: 128, status: 'completed',  progress: 100, uploadedAt: '2024-01-15', entities: 156, relations: 89 },
  { id: 'd2', name: 'Transformer架构详解',   fileType: 'pdf',  size: '5.8 MB',  pages: 56,  status: 'completed',  progress: 100, uploadedAt: '2024-01-18', entities: 78,  relations: 45 },
  { id: 'd3', name: '自然语言处理综述',     fileType: 'pdf',  size: '8.2 MB',  pages: 89,  status: 'processing', progress: 65,  uploadedAt: '2024-01-20', entities: 52,  relations: 30 },
  { id: 'd4', name: '计算机视觉导论',       fileType: 'pdf',  size: '18.6 MB', pages: 234, status: 'pending',    progress: 0,   uploadedAt: '2024-01-22' },
  { id: 'd5', name: '强化学习算法汇总',     fileType: 'pdf',  size: '14.1 MB', pages: 167, status: 'error',      progress: 32,  uploadedAt: '2024-01-19' },
  { id: 'd6', name: '注意力机制研究进展',   fileType: 'pdf',  size: '3.9 MB',  pages: 45,  status: 'completed',  progress: 100, uploadedAt: '2024-01-16', entities: 34,  relations: 21 },
]

/* ────────────────── Pipeline ────────────────── */

export const mockPipelineRun: PipelineRun = {
  id: 'p1',
  documentName: '自然语言处理综述.pdf',
  overallProgress: 52,
  status: 'running',
  startTime: '2024-01-20 14:00:00',
  stages: [
    { id: 's1', name: '文档解析', description: '解析PDF文档，提取文本内容',       status: 'completed', progress: 100, startTime: '14:00:12', endTime: '14:02:45', details: '成功解析 89 页文档' },
    { id: 's2', name: '文本分块', description: '将长文本分割为语义完整的片段',     status: 'completed', progress: 100, startTime: '14:02:46', endTime: '14:03:58', details: '生成 24 个文本块' },
    { id: 's3', name: '实体提取', description: '从文本中识别和提取关键实体',       status: 'completed', progress: 100, startTime: '14:03:59', endTime: '14:15:30', details: '提取了 52 个实体' },
    { id: 's4', name: '关系提取', description: '分析实体之间的语义关系',           status: 'running',   progress: 65,  startTime: '14:15:31', details: '正在处理第 16/24 个文本块' },
    { id: 's5', name: '知识融合', description: '合并和去重提取的知识三元组',       status: 'pending',   progress: 0 },
    { id: 's6', name: '图谱构建', description: '将知识写入图数据库',               status: 'pending',   progress: 0 },
  ],
}

/* ────────────────── Search ────────────────── */

export const mockSearchResults: SearchResult[] = [
  { id: 'sr1', type: 'entity',   title: '深度学习',                description: '深度学习是机器学习的子领域，使用多层神经网络进行特征学习和模式识别。在近年来取得了显著突破。', relevance: 0.95, metadata: { 类型: '技术', 来源: '深度学习基础教程.pdf' } },
  { id: 'sr2', type: 'relation', title: 'Transformer → 注意力机制', description: '关系：核心机制。Transformer 架构的核心创新在于多头自注意力机制的引入。',                  relevance: 0.88, metadata: { 关系: '核心机制', 来源: 'Transformer架构详解.pdf' } },
  { id: 'sr3', type: 'entity',   title: '神经网络',                description: '神经网络是一种模仿生物神经网络结构和功能的计算模型，由大量节点相互连接构成。',               relevance: 0.82, metadata: { 类型: '技术', 来源: '深度学习基础教程.pdf' } },
  { id: 'sr4', type: 'document', title: '深度学习基础教程.pdf',     description: '包含 128 页关于深度学习的基础知识，已提取 156 个实体和 89 个关系。',                        relevance: 0.78, metadata: { 页数: '128', 实体数: '156' } },
  { id: 'sr5', type: 'relation', title: '深度学习 → 神经网络',      description: '关系：基于。深度学习的核心思想建立在多层神经网络的基础之上。',                              relevance: 0.75, metadata: { 关系: '基于', 来源: '深度学习基础教程.pdf' } },
  { id: 'sr6', type: 'entity',   title: 'CNN',                     description: '卷积神经网络，擅长处理网格结构数据如图像，在计算机视觉领域广泛应用。',                       relevance: 0.71, metadata: { 类型: '模型', 来源: '计算机视觉导论.pdf' } },
]

/* ────────────────── Logs ────────────────── */

export const mockLogs: LogEntry[] = [
  { id: 'l1',  timestamp: '14:32:15', level: 'info',    message: '正在提取第 16 个文本块的关系…',                   source: '关系提取器' },
  { id: 'l2',  timestamp: '14:31:42', level: 'success', message: '第 15 个文本块关系提取完成，发现 3 个新关系',       source: '关系提取器' },
  { id: 'l3',  timestamp: '14:30:58', level: 'info',    message: '第 15 个文本块开始关系提取',                       source: '关系提取器' },
  { id: 'l4',  timestamp: '14:28:15', level: 'warning', message: '第 14 个文本块中发现可能的重复实体：自然语言处理 ≈ NLP', source: '关系提取器' },
  { id: 'l5',  timestamp: '14:25:30', level: 'success', message: '第 13 个文本块处理完成',                           source: '关系提取器' },
  { id: 'l6',  timestamp: '14:20:00', level: 'info',    message: '关系提取阶段进度: 50%',                            source: '流程管理器' },
  { id: 'l7',  timestamp: '14:15:31', level: 'info',    message: '开始关系提取阶段',                                 source: '流程管理器' },
  { id: 'l8',  timestamp: '14:15:30', level: 'success', message: '实体提取阶段完成，共提取 52 个实体',                source: '实体提取器' },
  { id: 'l9',  timestamp: '14:03:59', level: 'info',    message: '开始实体提取阶段',                                 source: '流程管理器' },
  { id: 'l10', timestamp: '14:03:58', level: 'success', message: '文本分块完成，共生成 24 个文本块',                   source: '文本分块器' },
]
