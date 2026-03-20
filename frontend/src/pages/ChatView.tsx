import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, User, Bot, Trash2, Loader2, Sparkles } from 'lucide-react'
import { chatApi } from '../services/api'
import type { ChatMessage } from '../types'
import GlassCard from '../components/ui/GlassCard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    
    setMessages(updatedMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await chatApi.chat(updatedMessages)
      const assistantMessage = response.choices[0].message as ChatMessage
      setMessages([...updatedMessages, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages([...updatedMessages, { 
        role: 'assistant', 
        content: '抱歉，我遇到了一些问题。请检查后端连接或 LLM_API_KEY 配置。' 
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const clearHistory = () => {
    setMessages([])
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] max-w-5xl mx-auto w-full p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00b4d8] to-[#0096c7] flex items-center justify-center shadow-lg shadow-[#00b4d8]/20">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#f0f4f8] tracking-tight">AI Assistant</h1>
            <p className="text-sm text-[#94a3b8]">DISK 知识图谱智能助手</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[#94a3b8] hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="text-sm font-medium">清空对话</span>
        </button>
      </div>

      {/* Chat Container */}
      <GlassCard className="flex-1 flex flex-col overflow-hidden border-[#2a3548]/50 mb-4">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#2a3548]">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#00b4d8]/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#00b4d8]" />
              </div>
              <div className="max-w-md">
                <h2 className="text-xl font-semibold text-[#f0f4f8] mb-2">你好！我是 DISK 助手</h2>
                <p className="text-[#94a3b8]">
                  你可以问我关于知识图谱、文档处理或者系统功能的问题。
                  我会根据你提供的上下文为你提供精准的解答。
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={index}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${
                  msg.role === 'user' 
                    ? 'bg-[#1a2332] border border-[#2a3548]' 
                    : 'bg-[#00b4d8]/10 border border-[#00b4d8]/20'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-[#94a3b8]" />
                  ) : (
                    <Bot className="w-5 h-5 text-[#00b4d8]" />
                  )}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  msg.role === 'user'
                    ? 'bg-[#00b4d8] text-white rounded-tr-none'
                    : 'bg-[#1a2332] text-[#f0f4f8] border border-[#2a3548] rounded-tl-none'
                }`}>
                  <div className={`prose prose-invert max-w-none prose-sm sm:prose-base ${
                    msg.role === 'user' ? 'prose-p:text-white prose-p:my-0' : 'prose-p:text-[#f0f4f8]'
                  }`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-lg !my-4 !bg-[#0d121a]"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={`${className} bg-black/30 rounded px-1.5 py-0.5 font-mono text-sm`} {...props}>
                              {children}
                            </code>
                          )
                        },
                        // 自定义链接样式，确保在深色背景下可见
                        a: ({ node, ...props }) => <a className="text-[#00b4d8] hover:underline" {...props} />,
                        // 自定义表格样式
                        table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="min-w-full divide-y divide-[#2a3548] border border-[#2a3548]" {...props} /></div>,
                        th: ({ node, ...props }) => <th className="px-4 py-2 bg-[#0d121a] text-left text-xs font-medium text-[#94a3b8] uppercase tracking-wider whitespace-normal" {...props} />,
                        td: ({ node, ...props }) => <td className="px-4 py-2 whitespace-normal text-sm border-t border-[#2a3548] break-words" {...props} />,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#00b4d8]/10 border border-[#00b4d8]/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-[#00b4d8]" />
              </div>
              <div className="bg-[#1a2332] text-[#f0f4f8] border border-[#2a3548] rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#00b4d8]" />
                <span className="text-sm text-[#94a3b8]">思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-[#2a3548]/50 bg-[#0d121a]/50">
          <div className="relative flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入你的问题..."
              className="flex-1 bg-[#1a2332] border border-[#2a3548] text-[#f0f4f8] rounded-xl px-4 py-3 focus:outline-none focus:border-[#00b4d8] transition-colors placeholder:text-[#4a5568]"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className={`p-3 rounded-xl transition-all duration-200 ${
                !input.trim() || isLoading
                  ? 'bg-[#1a2332] text-[#4a5568] cursor-not-allowed'
                  : 'bg-[#00b4d8] text-white shadow-lg shadow-[#00b4d8]/20 hover:scale-105 active:scale-95'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[#4a5568]">
            AI 助手可能会产生错误的信息，请核实重要内容。
          </p>
        </div>
      </GlassCard>
    </div>
  )
}
