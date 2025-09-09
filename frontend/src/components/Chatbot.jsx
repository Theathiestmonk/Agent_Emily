import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { Send, Bot, User, Loader2, Calendar, BarChart3, TrendingUp, Lightbulb, Mic, Sparkles } from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const Chatbot = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)
    setIsStreaming(true)

    // Create a placeholder bot message for streaming with dots
    const botMessageId = Date.now() + 1
    const botMessage = {
      id: botMessageId,
      type: 'bot',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true
    }

    setMessages(prev => [...prev, botMessage])

    try {
      const authToken = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/chatbot/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: inputMessage,
          user_id: user?.id
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body reader available')
      }

      let buffer = ''
      let isDone = false

      while (!isDone) {
        const { done, value } = await reader.read()
        
        if (done) {
          isDone = true
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.done) {
                isDone = true
                setIsStreaming(false)
                break
              }
              
              if (data.content) {
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === botMessageId 
                      ? { ...msg, content: msg.content + data.content, isStreaming: false }
                      : msg
                  )
                )
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }

    } catch (error) {
      console.error('Error sending message:', error)
      showError('Failed to send message', error.message)
      
      // Update the bot message with error
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, content: 'Sorry, I encountered an error. Please try again.' }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const suggestedActions = [
    {
      title: "Scheduled Posts",
      icon: Calendar,
      color: "text-pink-600",
      bgColor: "bg-pink-50",
      borderColor: "border-pink-200",
      hoverColor: "hover:bg-pink-100",
      onClick: () => setInputMessage("What's my next scheduled post?")
    },
    {
      title: "Performance Insights", 
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      hoverColor: "hover:bg-purple-100",
      onClick: () => setInputMessage("How are my posts performing?")
    },
    {
      title: "Industry Trends",
      icon: TrendingUp,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      hoverColor: "hover:bg-indigo-100",
      onClick: () => setInputMessage("What are the latest trends in my industry?")
    },
    {
      title: "Content Strategy",
      icon: Lightbulb,
      color: "text-violet-600",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      hoverColor: "hover:bg-violet-100",
      onClick: () => setInputMessage("Help me with my content strategy")
    }
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex justify-center items-center h-full">
            <div className="text-center max-w-2xl">
              {/* AI Assistant Icon */}
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              
              {/* Main Heading */}
              <h1 className="text-3xl font-bold text-gray-900 mb-4">How can I help you today?</h1>
              
              {/* Descriptive Text */}
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                I'm Emily, your AI marketing assistant. I can help you with strategy, content creation, performance analysis, and much more. What would you like to work on?
              </p>
              
              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                {suggestedActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className={`flex items-center space-x-3 p-4 ${action.bgColor} border ${action.borderColor} rounded-2xl ${action.hoverColor} transition-colors text-left`}
                  >
                    <action.icon className={`w-5 h-5 ${action.color}`} />
                    <span className="text-gray-800 font-medium">{action.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} max-w-4xl mx-auto`}
          >
            <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.type === 'user' 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`rounded-lg px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                  : 'bg-gradient-to-r from-pink-50 to-purple-50 text-gray-900 border border-pink-200'
              }`}>
                {message.content ? (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                ) : message.isStreaming ? (
                  <div className="flex items-center space-x-1">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && !isStreaming && (
          <div className="flex justify-start max-w-4xl mx-auto">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-100 to-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg px-4 py-3">
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Emily..."
              className="w-full px-6 py-4 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:border-purple-300 outline-none text-sm pr-20"
              disabled={isLoading || isStreaming}
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <button className="p-2 text-purple-500 hover:text-purple-700 transition-colors">
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading || isStreaming}
                className="p-2 text-purple-500 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Chatbot
