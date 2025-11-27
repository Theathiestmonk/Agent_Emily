import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { Send, User, Mic, Sparkles, Bot, Copy, Reply, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContentCard from './ContentCard'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const Chatbot = React.forwardRef(({ profile, isCallActive = false, callStatus = 'idle', onSpeakingChange, messageFilter = 'all', onOpenCustomContent, isModalOpen = false }, ref) => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState(new Set())
  const [expandedEmailBoxes, setExpandedEmailBoxes] = useState(new Set())
  const [hoveredMessageId, setHoveredMessageId] = useState(null)
  const [replyingToMessage, setReplyingToMessage] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isLoadingConversationsRef = useRef(false)
  const recognitionRef = useRef(null)
  const synthesisRef = useRef(null)
  const isListeningRef = useRef(false)
  const currentAudioRef = useRef(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const inputRecognitionRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, isCallActive, isModalOpen])

  // Text-to-speech for bot responses using OpenAI TTS
  const speakText = async (text) => {
    if (isCallActive && callStatus === 'connected') {
      try {
        // Cancel any ongoing speech
        if (currentAudioRef.current) {
          currentAudioRef.current.pause()
          currentAudioRef.current = null
        }
        
        const authToken = await getAuthToken()
        if (!authToken) {
          console.error('No auth token available for TTS')
          return
        }
        
        // Call backend TTS endpoint
        const response = await fetch(`${API_BASE_URL}/chatbot/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ text })
        })
        
        if (!response.ok) {
          throw new Error(`TTS request failed: ${response.status}`)
        }
        
        // Get audio blob
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        audio.controls = false // Hide audio controls
        audio.style.display = 'none' // Hide audio element
        currentAudioRef.current = audio
        
        audio.onplay = () => {
          setIsSpeaking(true)
          if (onSpeakingChange) onSpeakingChange(true)
        }
        
        audio.onended = () => {
          setIsSpeaking(false)
          if (onSpeakingChange) onSpeakingChange(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
          // Resume listening after speech ends
          if (isCallActive && isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start()
            } catch (e) {
              console.log('Recognition already started')
            }
          }
        }
        
        audio.onerror = () => {
          setIsSpeaking(false)
          if (onSpeakingChange) onSpeakingChange(false)
          URL.revokeObjectURL(audioUrl)
          currentAudioRef.current = null
        }
        
        await audio.play()
      } catch (error) {
        console.error('Error with TTS:', error)
        setIsSpeaking(false)
        if (onSpeakingChange) onSpeakingChange(false)
      }
    }
  }

  // Initialize speech recognition when call is active
  useEffect(() => {
    if (isCallActive && callStatus === 'connected') {
      // Initialize Speech Recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'en-US'
        
        recognition.onresult = (event) => {
          const transcript = event.results[event.results.length - 1][0].transcript
          if (transcript.trim()) {
            setInputMessage(transcript)
            // Auto-send after a short delay
            setTimeout(() => {
              sendMessage(transcript)
            }, 500)
          }
        }
        
        recognition.onerror = (event) => {
          console.error('Speech recognition error:', event.error)
          if (event.error === 'no-speech') {
            // Restart listening if no speech detected
            if (isListeningRef.current && isCallActive) {
              setTimeout(() => {
                try {
                  recognition.start()
                } catch (e) {
                  console.log('Recognition already started')
                }
              }, 1000)
            }
          }
        }
        
        recognition.onend = () => {
          // Restart listening if call is still active
          if (isCallActive && isListeningRef.current) {
            setTimeout(() => {
              try {
                recognition.start()
              } catch (e) {
                console.log('Recognition already started')
              }
            }, 500)
          }
        }
        
        recognitionRef.current = recognition
        isListeningRef.current = true
        recognition.start()
      }
    } else {
      // Stop recognition when call ends
      if (recognitionRef.current) {
        isListeningRef.current = false
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Recognition already stopped')
        }
        recognitionRef.current = null
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        isListeningRef.current = false
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Recognition already stopped')
        }
        recognitionRef.current = null
      }
    }
  }, [isCallActive, callStatus])

  // Load today's conversations when component mounts or when profile/user changes
  useEffect(() => {
    if (profile && user && !isLoadingConversationsRef.current) {
      loadTodayConversations()
    }
  }, [profile?.id, user?.id]) // Reload when profile or user changes

  // Subscribe to new chatbot messages via Supabase realtime
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('chatbot_conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chatbot_conversations',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newMessage = payload.new
          const metadata = newMessage.metadata || {}
          const isChase = metadata.sender === 'chase'
          const isLeo = metadata.sender === 'leo'
          
          // Only add if it's a new message (not already in messages)
          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some(msg => 
              msg.conversationId === newMessage.id || 
              (msg.id && msg.id === `conv-${newMessage.id}`)
            )
            
            if (exists) return prev
            
            // Add new message
            const messageObj = {
              id: `conv-${newMessage.id}`,
              conversationId: newMessage.id,
              type: newMessage.message_type === 'user' ? 'user' : 'bot',
              content: newMessage.content,
              timestamp: newMessage.created_at,
              isNew: true,
              scheduledMessageId: metadata.scheduled_message_id || null,
              isChase: isChase,
              isLeo: isLeo,
              leoMetadata: isLeo ? {
                postData: metadata.post_data,
                scheduledDate: metadata.scheduled_date,
                scheduledTime: metadata.scheduled_time
              } : null,
              chaseMetadata: isChase ? {
                leadId: metadata.lead_id,
                leadName: metadata.lead_name,
                emailContent: metadata.email_content,
                emailSubject: metadata.email_subject
              } : null
            }
            
            // Remove isNew flag after animation
            setTimeout(() => {
              setMessages(current => current.map(msg => 
                msg.id === messageObj.id && msg.isNew
                  ? { ...msg, isNew: false }
                  : msg
              ))
            }, 400)
            
            return [...prev, messageObj]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Cleanup input recognition on unmount
  useEffect(() => {
    return () => {
      if (inputRecognitionRef.current) {
        try {
          inputRecognitionRef.current.stop()
        } catch (e) {
          // Ignore errors on cleanup
        }
        inputRecognitionRef.current = null
      }
    }
  }, [])

  const loadTodayConversations = async () => {
    // Prevent concurrent loads
    if (isLoadingConversationsRef.current) {
      return
    }
    
    isLoadingConversationsRef.current = true
    
    try {
      const authToken = await getAuthToken()
      
      if (!authToken) {
        console.error('No auth token available')
        isLoadingConversationsRef.current = false
        return
      }
      
      // Fetch today's conversations
      const response = await fetch(`${API_BASE_URL}/chatbot/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Failed to fetch conversations:', response.status, errorText)
        isLoadingConversationsRef.current = false
        // Still try to fetch scheduled messages
        fetchScheduledMessages()
        return
      }

      const data = await response.json()
      console.log('Conversations response:', data)
      
      if (data.success && data.conversations) {
        if (data.conversations.length > 0) {
          // Convert conversations to message format
          const conversationMessages = data.conversations.map(conv => {
            const metadata = conv.metadata || {}
            const isChase = metadata.sender === 'chase'
            const isLeo = metadata.sender === 'leo'
            const isEmily = conv.message_type === 'bot' && !isChase && !isLeo
            return {
            id: `conv-${conv.id}`,
            conversationId: conv.id, // Store Supabase ID for deletion
            type: conv.message_type === 'user' ? 'user' : 'bot',
            content: conv.content,
            timestamp: conv.created_at,
            isNew: false,
              scheduledMessageId: metadata.scheduled_message_id || null,
              isChase: isChase,
              isLeo: isLeo,
              isEmily: isEmily,
              leoMetadata: isLeo ? {
                postData: metadata.post_data,
                scheduledDate: metadata.scheduled_date,
                scheduledTime: metadata.scheduled_time
              } : null,
              chaseMetadata: isChase ? {
                leadId: metadata.lead_id,
                leadName: metadata.lead_name,
                emailContent: metadata.email_content,
                emailSubject: metadata.email_subject
              } : null
            }
          })
          
          // Remove duplicates based on scheduled_message_id
          const seenScheduledIds = new Set()
          const uniqueMessages = []
          for (const msg of conversationMessages) {
            if (msg.scheduledMessageId) {
              if (seenScheduledIds.has(msg.scheduledMessageId)) {
                continue // Skip duplicate
              }
              seenScheduledIds.add(msg.scheduledMessageId)
            }
            uniqueMessages.push(msg)
          }
          
          // Sort by timestamp (oldest first)
          uniqueMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          
          console.log('Setting messages:', uniqueMessages.length, 'messages')
          setMessages(uniqueMessages)
        } else {
          console.log('No conversations found for today - will generate scheduled messages up to current time')
          // If no conversations, start with empty array
          setMessages([])
          // Trigger generation of scheduled messages up to current time
          try {
            const generateResponse = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages/generate-today`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              }
            })
            
            if (generateResponse.ok) {
              const generateData = await generateResponse.json()
              console.log('Generated messages:', generateData)
              // After generating, fetch scheduled messages to display them
              setTimeout(() => fetchScheduledMessages(), 500)
              isLoadingConversationsRef.current = false
              return // Exit early, fetchScheduledMessages will be called
            }
          } catch (error) {
            console.error('Error generating messages:', error)
          }
        }
      } else {
        console.error('Invalid response format:', data)
        setMessages([])
      }
      
      // Then fetch and display scheduled messages
      fetchScheduledMessages()
      
    } catch (error) {
      console.error('Error loading conversations:', error)
      // Still try to fetch scheduled messages
      fetchScheduledMessages()
    } finally {
      isLoadingConversationsRef.current = false
    }
  }

  // Detect if user wants to create social media post
  const detectSocialMediaPostIntent = (message) => {
    const messageLower = message.toLowerCase()
    const keywords = [
      'create post', 'create a post', 'make a post', 'make post',
      'generate post', 'generate a post', 'new post', 'create content',
      'generate content', 'create social media post', 'social media post',
      'create instagram post', 'create facebook post', 'create linkedin post',
      'create twitter post', 'post for', 'i want to post', 'help me create',
      'create a social', 'make a social', 'generate social', 'write a post',
      'draft a post', 'create post for', 'post about', 'create content for'
    ]
    return keywords.some(keyword => messageLower.includes(keyword))
  }

  const sendMessage = async (messageText = null) => {
    const messageToSend = messageText || inputMessage
    if (!messageToSend.trim() || isLoading) return

    // Check if user wants to create social media post
    if (onOpenCustomContent && detectSocialMediaPostIntent(messageToSend)) {
      // Open custom content chatbot modal
      onOpenCustomContent()
      // Add a quick response message
      const quickResponse = {
        id: Date.now(),
        type: 'bot',
        content: "Please pick this up '@leo'",
        timestamp: new Date().toISOString(),
        isEmily: true
      }
      setMessages(prev => [...prev, {
        id: Date.now() - 1,
        type: 'user',
        content: messageToSend,
        timestamp: new Date().toISOString()
      }, quickResponse])
      setInputMessage('')
      return
    }

    // Build message content with reply context if replying
    let finalMessage = messageToSend
    if (replyingToMessage) {
      finalMessage = `[Replying to: "${replyingToMessage.content.substring(0, 100)}${replyingToMessage.content.length > 100 ? '...' : ''}"]\n\n${messageToSend}`
    }

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString(),
      replyingTo: replyingToMessage
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setReplyingToMessage(null) // Clear reply context after sending
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
      
      // Use non-streaming endpoint when in call to avoid TTS issues
      const endpoint = isCallActive && callStatus === 'connected' 
        ? `${API_BASE_URL}/chatbot/chat` 
        : `${API_BASE_URL}/chatbot/chat/stream`
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: finalMessage,
          user_id: user?.id,
          conversation_history: messages
            .filter(msg => (msg.type === 'user' || msg.type === 'bot') && msg.content && msg.content.trim()) // Include all user and bot messages with content (including greeting)
            .map(msg => ({
              type: msg.type,
              content: msg.content,
              role: msg.type === 'user' ? 'user' : 'assistant'
            }))
            .slice(0, -1) // Exclude the current placeholder bot message
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // Handle non-streaming response (when in call)
      if (isCallActive && callStatus === 'connected') {
        const data = await response.json()
        const botResponse = data.response || data.content || ''
        const cleanContent = botResponse.replace(/🔍.*?\n|📅.*?\n|🔍.*?\n|✅.*?\n|📝.*?\n|❌.*?\n|📊.*?\n|📈.*?\n|🤖.*?\n|✨.*?\n|---CLEAR_PROGRESS---.*?\n/g, '').trim()
        
        // Update bot message with full response
        setMessages(prev => 
          prev.map(msg => 
            msg.id === botMessageId 
              ? { ...msg, content: cleanContent, isStreaming: false }
              : msg
          )
        )
        
        // Speak the response once
        if (cleanContent) {
          speakText(cleanContent)
        }
      } else {
        // Handle streaming response (normal mode)
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
                // Check if this is a clear progress command
                if (data.content.includes('---CLEAR_PROGRESS---')) {
                  // Clear the progress messages by removing lines that look like progress
                  setMessages(prev => 
                      prev.map(msg => {
                        if (msg.id === botMessageId) {
                          const finalContent = msg.content.replace(/🔍.*?\n|📅.*?\n|🔍.*?\n|✅.*?\n|📝.*?\n|❌.*?\n|📊.*?\n|📈.*?\n|🤖.*?\n|✨.*?\n|---CLEAR_PROGRESS---.*?\n/g, '').trim()
                          return { 
                            ...msg, 
                            content: finalContent,
                            isStreaming: false 
                          }
                        }
                        return msg
                      })
                  )
                } else {
                  setMessages(prev => 
                      prev.map(msg => {
                        if (msg.id === botMessageId) {
                          const updatedContent = msg.content + data.content
                          return { ...msg, content: updatedContent, isStreaming: false }
                        }
                        return msg
                      })
                  )
                }
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
              }
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

  const fetchScheduledMessages = async () => {
    try {
      const authToken = await getAuthToken()
      
      // First, check if messages exist for today
      const response = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Scheduled messages response:', data)
        
        // If no messages exist for today, generate them
        if (data.success && (!data.messages || data.messages.length === 0)) {
          console.log('No scheduled messages found, generating...')
          try {
            const generateResponse = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages/generate-today`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              }
            })
            
            if (generateResponse.ok) {
              const generateData = await generateResponse.json()
              if (generateData.success && generateData.messages && generateData.messages.length > 0) {
                // Fetch again to get the newly generated messages
                const newResponse = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages`, {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  }
                })
                
                if (newResponse.ok) {
                  const newData = await newResponse.json()
                  if (newData.success && newData.messages && newData.messages.length > 0) {
                    displayScheduledMessages(newData.messages, authToken)
                    return
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error generating today\'s messages:', error)
            // Continue to try displaying any existing messages
          }
        }
        
        // Display existing messages if any
        if (data.success && data.messages && data.messages.length > 0) {
          console.log(`Displaying ${data.messages.length} scheduled messages`)
          displayScheduledMessages(data.messages, authToken)
        } else {
          console.log('No scheduled messages to display')
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled messages:', error)
      // Silently fail - don't show error to user
    }
  }

  const displayScheduledMessages = (messages, authToken) => {
    if (!messages || messages.length === 0) return
    
    setMessages(prev => {
      // Get existing scheduled message IDs from both scheduled messages and conversations
      const existingScheduledIds = new Set()
      prev.forEach(msg => {
        if (msg.scheduledMessageId) {
          existingScheduledIds.add(msg.scheduledMessageId)
        }
      })
      
      // Filter out messages that are already displayed
      const newScheduledMessages = messages.filter(msg => 
        !existingScheduledIds.has(msg.id)
      )
      
      if (newScheduledMessages.length === 0) {
        return prev // No new messages to add
      }
      
      // Convert scheduled messages to message format
      const scheduledMessageObjects = newScheduledMessages.map(scheduledMsg => {
        const metadata = scheduledMsg.metadata || {}
        const isChase = metadata.sender === 'chase'
        const isLeo = metadata.sender === 'leo'
        const isEmily = !isChase && !isLeo
        return {
        id: `scheduled-${scheduledMsg.id}`,
        type: 'bot',
        content: scheduledMsg.content,
        timestamp: scheduledMsg.scheduled_time || new Date().toISOString(),
        isNew: true,
          scheduledMessageId: scheduledMsg.id,
          isChase: isChase,
          isLeo: isLeo,
          isEmily: isEmily,
          chaseMetadata: isChase ? {
            leadId: metadata.lead_id,
            leadName: metadata.lead_name,
            emailContent: metadata.email_content,
            emailSubject: metadata.email_subject
          } : null
        }
      })
      
      // Merge with existing messages
      const allMessages = [...prev, ...scheduledMessageObjects]
      
      // Remove duplicates based on scheduledMessageId
      const uniqueMessages = []
      const seenScheduledIds = new Set()
      const seenContentHashes = new Set()
      
      for (const msg of allMessages) {
        // Check by scheduled message ID first (most reliable)
        if (msg.scheduledMessageId) {
          if (seenScheduledIds.has(msg.scheduledMessageId)) {
            continue // Skip duplicate
          }
          seenScheduledIds.add(msg.scheduledMessageId)
          uniqueMessages.push(msg)
          continue
        }
        
        // For non-scheduled messages, check by content and timestamp
        const contentHash = `${msg.content?.substring(0, 200)}_${msg.timestamp?.substring(0, 16)}` // First 200 chars + date part
        if (seenContentHashes.has(contentHash)) {
          continue // Skip duplicate
        }
        seenContentHashes.add(contentHash)
        uniqueMessages.push(msg)
      }
      
      // Sort all messages chronologically by timestamp
      uniqueMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime()
        const timeB = new Date(b.timestamp || 0).getTime()
        return timeA - timeB
      })
      
      // Remove animation flags after a delay
      setTimeout(() => {
        setMessages(current => current.map(msg => 
          scheduledMessageObjects.some(sm => sm.id === msg.id) && msg.isNew
            ? { ...msg, isNew: false }
            : msg
        ))
      }, 400)
      
      // Mark scheduled messages as delivered (only if not already delivered)
      newScheduledMessages.forEach(scheduledMsg => {
        // Only mark as delivered if it's not already delivered
        if (!scheduledMsg.is_delivered) {
          setTimeout(async () => {
            try {
              await fetch(`${API_BASE_URL}/chatbot/scheduled-messages/${scheduledMsg.id}/deliver`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authToken}`
                }
              })
            } catch (error) {
              console.error('Error delivering scheduled message:', error)
            }
          }, 100)
        } else {
          console.log(`Message ${scheduledMsg.id} already delivered, skipping deliver call`)
        }
      })
      
      return uniqueMessages
    })
  }

  // Note: Key handling is now done in textarea onKeyDown

  const toggleMessageExpansion = (messageId) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const shouldShowReadMore = (content) => {
    if (!content) return false
    // Check if content has more than 9 lines or is longer than ~500 characters (rough estimate)
    const lineCount = content.split('\n').length
    const charCount = content.length
    return lineCount > 9 || charCount > 500
  }

  const handleCopyMessage = async (content) => {
    try {
      await navigator.clipboard.writeText(content)
      showSuccess('Message copied to clipboard')
    } catch (error) {
      console.error('Failed to copy:', error)
      showError('Failed to copy message')
    }
  }

  const handleReplyToMessage = (message) => {
    setReplyingToMessage(message)
    setInputMessage('')
  }

  const handleMicClick = () => {
    if (isListening) {
      // Stop listening
      if (inputRecognitionRef.current) {
        inputRecognitionRef.current.stop()
        setIsListening(false)
      }
      return
    }

    // Check if browser supports speech recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showError('Speech recognition not supported', 'Your browser does not support speech recognition. Please use Chrome, Edge, or Safari.')
      return
    }

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      // Update input with interim results
      if (interimTranscript) {
        setInputMessage(finalTranscript + interimTranscript)
      }

      // If we have final results, send the message
      if (finalTranscript.trim()) {
        setInputMessage(finalTranscript.trim())
        recognition.stop()
        setIsListening(false)
        // Send the message after a short delay
        setTimeout(() => {
          sendMessage(finalTranscript.trim())
        }, 100)
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      
      if (event.error === 'not-allowed') {
        showError('Microphone permission denied', 'Please allow microphone access to use speech-to-text.')
      } else if (event.error === 'no-speech') {
        showError('No speech detected', 'Please try speaking again.')
      } else {
        showError('Speech recognition error', event.error)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    inputRecognitionRef.current = recognition
    
    try {
      recognition.start()
    } catch (error) {
      console.error('Error starting recognition:', error)
      showError('Failed to start speech recognition', error.message)
      setIsListening(false)
    }
  }

  const handleDeleteMessage = async (message) => {
    if (!message.conversationId) {
      // If it's a local message (not saved to Supabase), just remove from UI
      setMessages(prev => prev.filter(msg => msg.id !== message.id))
      return
    }

    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_BASE_URL}/chatbot/conversations/${message.conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete message')
      }

      // Remove from UI
      setMessages(prev => prev.filter(msg => msg.id !== message.id))
      showSuccess('Message deleted')
    } catch (error) {
      console.error('Error deleting message:', error)
      showError('Failed to delete message')
    }
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    
    const messageDate = new Date(timestamp)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())
    
    // If message is from today, show only time
    if (messageDay.getTime() === today.getTime()) {
      return messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit'
      })
    }
    
    // If message is from yesterday, show "Yesterday" and time
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (messageDay.getTime() === yesterday.getTime()) {
      return `Yesterday ${messageDate.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit'
      })}`
    }
    
    // Otherwise show date and time
    return messageDate.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  // Expose loadConversations method via ref
  React.useImperativeHandle(ref, () => ({
    loadConversations: (messages) => {
      setMessages(messages)
      // Scroll to bottom after loading
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
      }, 100)
    },
    startCall: () => {
      // Call already started via useEffect
      console.log('Call started')
    },
    endCall: () => {
      // Stop recognition
      if (recognitionRef.current) {
        isListeningRef.current = false
        try {
          recognitionRef.current.stop()
        } catch (e) {
          console.log('Recognition already stopped')
        }
        recognitionRef.current = null
      }
      // Cancel any ongoing speech
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }))

  return (
    <div className="flex flex-col bg-gray-50" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 messages-container" style={{ overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        {messages
          .filter(message => {
            if (messageFilter === 'all') return true
            if (messageFilter === 'emily') return message.isEmily
            if (messageFilter === 'chase') return message.isChase
            if (messageFilter === 'leo') return message.isLeo
            return true
          })
          .map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.type === 'user' ? 'items-end' : 'items-start'} w-full px-4 ${message.isNew ? 'animate-slide-in' : ''}`}
          >
            <div className={`flex items-start gap-2 max-w-[50%] ${message.type === 'user' ? 'justify-end flex-row-reverse' : 'justify-start'}`}>
              {/* Icon */}
              <div className={`flex-shrink-0 ${message.type === 'user' ? 'order-2' : ''}`}>
                {message.type === 'user' ? (
                  profile?.logo_url ? (
                    <img 
                      src={profile.logo_url} 
                      alt="User" 
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )
                ) : (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-md ${
                    message.isChase 
                      ? 'bg-gradient-to-br from-blue-400 to-blue-600' 
                      : 'bg-gradient-to-br from-pink-400 to-purple-500'
                  }`}>
                    <span className="text-white font-bold text-sm">
                      {message.isChase ? 'C' : message.isLeo ? 'L' : 'E'}
                    </span>
                  </div>
                )}
              </div>
              {/* Message Bubble */}
              <div 
                className={`px-4 py-3 rounded-lg relative group message-bubble ${
                  message.type === 'user'
                    ? 'bg-pink-500 text-white'
                    : 'bg-white text-black chatbot-bubble-shadow'
                }`}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
              >
                {/* Agent Name - Only show for bot messages, inside bubble at top */}
                {message.type === 'bot' && (
                  <div className="mb-2">
                    <span className="text-xs font-medium text-purple-600">
                      {message.isChase ? 'Chase' : message.isLeo ? 'Leo' : 'Emily'}
                    </span>
                  </div>
                )}
                {/* Hover Actions */}
                {hoveredMessageId === message.id && (
                  <div className={`absolute ${message.type === 'user' ? 'left-0 -left-24' : 'right-0 -right-24'} top-0 flex gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-10`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCopyMessage(message.content)
                      }}
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                      title="Copy"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleReplyToMessage(message)
                      }}
                      className="p-2 hover:bg-gray-100 rounded transition-colors"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4 text-gray-600" />
                    </button>
                  <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm('Are you sure you want to delete this message?')) {
                          handleDeleteMessage(message)
                        }
                      }}
                      className="p-2 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
              </div>
                )}
                
                {/* Reply Indicator */}
                {message.replyingTo && (
                  <div className={`mb-2 pb-2 border-b ${message.type === 'user' ? 'border-white/30' : 'border-gray-200'}`}>
                    <div className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                      Replying to: {message.replyingTo.content.substring(0, 50)}...
            </div>
          </div>
        )}
                {message.content ? (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                    <div className={expandedMessages.has(message.id) ? '' : 'message-content-truncated'}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className={`mb-2 last:mb-0 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</p>,
                        h1: ({ children }) => <h1 className={`text-lg font-bold mb-2 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h1>,
                        h2: ({ children }) => <h2 className={`text-base font-semibold mb-2 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h2>,
                        h3: ({ children }) => <h3 className={`text-sm font-semibold mb-1 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className={message.type === 'user' ? 'text-white' : 'text-black'}>{children}</li>,
                        code: ({ children, className }) => {
                          const isInline = !className?.includes('language-')
                          return isInline ? (
                            <code className={`px-1 py-0.5 rounded text-xs font-mono ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</code>
                          ) : (
                            <code className={`block p-2 rounded text-xs font-mono overflow-x-auto ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</code>
                          )
                        },
                        pre: ({ children }) => <pre className={`p-2 rounded text-xs font-mono overflow-x-auto mb-2 ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</pre>,
                        blockquote: ({ children }) => <blockquote className={`border-l-4 pl-3 italic mb-2 ${message.type === 'user' ? 'border-white/30 text-white/90' : 'border-purple-400 text-black/80'}`}>{children}</blockquote>,
                        strong: ({ children }) => <strong className={`font-semibold ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</strong>,
                        em: ({ children }) => <em className={`italic ${message.type === 'user' ? 'text-white/90' : 'text-black/80'}`}>{children}</em>,
                        a: ({ children, href }) => {
                          // Handle lead links - navigate to leads dashboard
                          if (href && href.startsWith('leads/')) {
                            const leadId = href.replace('leads/', '')
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  navigate(`/leads?leadId=${leadId}`)
                                }}
                                className={`underline cursor-pointer ${message.type === 'user' ? 'text-white hover:text-white/80' : 'text-purple-700 hover:text-purple-800'}`}
                              >
                                {children}
                              </button>
                            )
                          }
                          // Regular links
                          return (
                            <a 
                              href={href} 
                              className={`underline ${message.type === 'user' ? 'text-white hover:text-white/80' : 'text-purple-700 hover:text-purple-800'}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          )
                        },
                        table: ({ children }) => <div className="overflow-x-auto mb-2"><table className={`min-w-full border rounded ${message.type === 'user' ? 'border-white/30' : 'border-purple-300'}`}>{children}</table></div>,
                        th: ({ children }) => <th className={`border px-2 py-1 text-left text-xs font-semibold ${message.type === 'user' ? 'border-white/30 bg-white/10 text-white' : 'border-purple-300 bg-purple-100 text-black'}`}>{children}</th>,
                        td: ({ children }) => <td className={`border px-2 py-1 text-xs ${message.type === 'user' ? 'border-white/30 text-white/90' : 'border-purple-300 text-black/90'}`}>{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    </div>
                    {shouldShowReadMore(message.content) ? (
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <button
                          onClick={() => toggleMessageExpansion(message.id)}
                          className={`text-xs ${message.type === 'user' ? 'text-blue-300 hover:text-blue-200' : 'text-purple-700 hover:text-purple-800'}`}
                        >
                          {expandedMessages.has(message.id) ? 'Read less' : 'Read more'}
                        </button>
                        {message.timestamp && (
                          <div className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                            {formatTime(message.timestamp)}
                          </div>
                        )}
                      </div>
                    ) : message.timestamp ? (
                      <div className="mt-2">
                        <div className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Email Content Box for Chase Messages */}
                    {message.isChase && message.chaseMetadata && message.chaseMetadata.emailContent && (
                      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedEmailBoxes(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(message.id)) {
                                newSet.delete(message.id)
                              } else {
                                newSet.add(message.id)
                              }
                              return newSet
                            })
                          }}
                          className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-gray-700 mb-1">
                              {message.chaseMetadata.emailSubject || 'Email Content'}
                            </div>
                            {!expandedEmailBoxes.has(message.id) && (
                              <div className="text-xs text-gray-500 line-clamp-3">
                                {message.chaseMetadata.emailContent.replace(/<[^>]*>/g, '').substring(0, 150)}...
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 ml-2">
                            {expandedEmailBoxes.has(message.id) ? '▼' : '▶'}
                          </span>
                        </button>
                        {expandedEmailBoxes.has(message.id) && (
                          <div className="px-3 py-2 bg-white border-t border-gray-200">
                            <div 
                              className="text-xs text-gray-700 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: message.chaseMetadata.emailContent }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Post Card for Leo Messages */}
                    {message.isLeo && message.leoMetadata && message.leoMetadata.postData && (
                      <div className="mt-3">
                        <ContentCard
                          content={message.leoMetadata.postData}
                          platform={message.leoMetadata.postData.platform}
                          contentType={message.leoMetadata.postData.post_type || message.leoMetadata.postData.content_type || 'post'}
                        />
                        {message.leoMetadata.scheduledDate && message.leoMetadata.scheduledTime && (
                          <div className="mt-2 text-xs text-gray-600">
                            This post is scheduled at {message.leoMetadata.scheduledDate} and {message.leoMetadata.scheduledTime}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : message.isStreaming ? (
                  <div className="flex items-center space-x-1">
                    <span className={`text-lg ${message.type === 'user' ? 'text-white' : 'text-black'}`}>.</span>
                    <span className={`text-lg typing-dot-1 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>.</span>
                    <span className={`text-lg typing-dot-2 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>.</span>
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none">
                    <div className={expandedMessages.has(message.id) ? '' : 'message-content-truncated'}>
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className={`mb-2 last:mb-0 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</p>,
                        h1: ({ children }) => <h1 className={`text-lg font-bold mb-2 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h1>,
                        h2: ({ children }) => <h2 className={`text-base font-semibold mb-2 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h2>,
                        h3: ({ children }) => <h3 className={`text-sm font-semibold mb-1 ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</h3>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li className={message.type === 'user' ? 'text-white' : 'text-black'}>{children}</li>,
                        code: ({ children, className }) => {
                          const isInline = !className?.includes('language-')
                          return isInline ? (
                            <code className={`px-1 py-0.5 rounded text-xs font-mono ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</code>
                          ) : (
                            <code className={`block p-2 rounded text-xs font-mono overflow-x-auto ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</code>
                          )
                        },
                        pre: ({ children }) => <pre className={`p-2 rounded text-xs font-mono overflow-x-auto mb-2 ${message.type === 'user' ? 'bg-white/20 text-white' : 'bg-purple-300 text-black'}`}>{children}</pre>,
                        blockquote: ({ children }) => <blockquote className={`border-l-4 pl-3 italic mb-2 ${message.type === 'user' ? 'border-white/30 text-white/90' : 'border-purple-400 text-black/80'}`}>{children}</blockquote>,
                        strong: ({ children }) => <strong className={`font-semibold ${message.type === 'user' ? 'text-white' : 'text-black'}`}>{children}</strong>,
                        em: ({ children }) => <em className={`italic ${message.type === 'user' ? 'text-white/90' : 'text-black/80'}`}>{children}</em>,
                        a: ({ children, href }) => {
                          // Handle lead links - navigate to leads dashboard
                          if (href && href.startsWith('leads/')) {
                            const leadId = href.replace('leads/', '')
                            return (
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  navigate(`/leads?leadId=${leadId}`)
                                }}
                                className={`underline cursor-pointer ${message.type === 'user' ? 'text-white hover:text-white/80' : 'text-purple-700 hover:text-purple-800'}`}
                              >
                                {children}
                              </button>
                            )
                          }
                          // Regular links
                          return (
                            <a 
                              href={href} 
                              className={`underline ${message.type === 'user' ? 'text-white hover:text-white/80' : 'text-purple-700 hover:text-purple-800'}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          )
                        },
                        table: ({ children }) => <div className="overflow-x-auto mb-2"><table className={`min-w-full border rounded ${message.type === 'user' ? 'border-white/30' : 'border-purple-300'}`}>{children}</table></div>,
                        th: ({ children }) => <th className={`border px-2 py-1 text-left text-xs font-semibold ${message.type === 'user' ? 'border-white/30 bg-white/10 text-white' : 'border-purple-300 bg-purple-100 text-black'}`}>{children}</th>,
                        td: ({ children }) => <td className={`border px-2 py-1 text-xs ${message.type === 'user' ? 'border-white/30 text-white/90' : 'border-purple-300 text-black/90'}`}>{children}</td>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    </div>
                    {shouldShowReadMore(message.content) ? (
                      <div className="flex items-center justify-between mt-2 gap-2">
                        <button
                          onClick={() => toggleMessageExpansion(message.id)}
                          className={`text-xs ${message.type === 'user' ? 'text-blue-300 hover:text-blue-200' : 'text-purple-700 hover:text-purple-800'}`}
                        >
                          {expandedMessages.has(message.id) ? 'Read less' : 'Read more'}
                        </button>
                        {message.timestamp && (
                          <div className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                            {formatTime(message.timestamp)}
                          </div>
                        )}
                      </div>
                    ) : message.timestamp ? (
                      <div className="mt-2">
                        <div className={`text-xs ${message.type === 'user' ? 'text-white/70' : 'text-gray-500'}`}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    ) : null}
                    
                    {/* Email Content Box for Chase Messages */}
                    {message.isChase && message.chaseMetadata && message.chaseMetadata.emailContent && (
                      <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          onClick={() => {
                            setExpandedEmailBoxes(prev => {
                              const newSet = new Set(prev)
                              if (newSet.has(message.id)) {
                                newSet.delete(message.id)
                              } else {
                                newSet.add(message.id)
                              }
                              return newSet
                            })
                          }}
                          className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-gray-700 mb-1">
                              {message.chaseMetadata.emailSubject || 'Email Content'}
                            </div>
                            {!expandedEmailBoxes.has(message.id) && (
                              <div className="text-xs text-gray-500 line-clamp-3">
                                {message.chaseMetadata.emailContent.replace(/<[^>]*>/g, '').substring(0, 150)}...
                  </div>
                )}
              </div>
                          <span className="text-xs text-gray-500 ml-2">
                            {expandedEmailBoxes.has(message.id) ? '▼' : '▶'}
                          </span>
                        </button>
                        {expandedEmailBoxes.has(message.id) && (
                          <div className="px-3 py-2 bg-white border-t border-gray-200">
                            <div 
                              className="text-xs text-gray-700 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: message.chaseMetadata.emailContent }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Post Card for Leo Messages */}
                    {message.isLeo && message.leoMetadata && message.leoMetadata.postData && (
                      <div className="mt-3">
                        <ContentCard
                          content={message.leoMetadata.postData}
                          platform={message.leoMetadata.postData.platform}
                          contentType={message.leoMetadata.postData.post_type || message.leoMetadata.postData.content_type || 'post'}
                        />
                        {message.leoMetadata.scheduledDate && message.leoMetadata.scheduledTime && (
                          <div className="mt-2 text-xs text-gray-600">
                            This post is scheduled at {message.leoMetadata.scheduledDate} and {message.leoMetadata.scheduledTime}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && !isStreaming && (
          <div className="flex justify-start w-full px-4">
            <div className="bg-white rounded-lg px-4 py-3 chatbot-bubble-shadow">
              <div className="flex items-center space-x-1">
                <span className="text-black text-lg">.</span>
                <span className="text-black text-lg typing-dot-1">.</span>
                <span className="text-black text-lg typing-dot-2">.</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input - Fixed at bottom */}
      <div className="bg-white px-4 border-t border-gray-200 z-10" style={{ 
        flexShrink: 0,
        flexGrow: 0,
        paddingTop: '12px',
        paddingBottom: '12px'
      }}>
        <div className="w-full">
          <div className="relative">
            <div className="relative w-full">
              {replyingToMessage && (
                <div className="absolute left-4 top-2 text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded flex items-center gap-2 z-10">
                  <span>Replying to: {replyingToMessage.content.substring(0, 40)}...</span>
                  <button
                    onClick={() => setReplyingToMessage(null)}
                    className="text-purple-400 hover:text-purple-600 font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => {
                  setInputMessage(e.target.value)
                  // Auto-resize textarea
                  e.target.style.height = 'auto'
                  const lineHeight = 24 // Approximate line height in pixels
                  const maxHeight = lineHeight * 4 // 4 rows max
                  const newHeight = Math.min(e.target.scrollHeight, maxHeight)
                  e.target.style.height = `${newHeight}px`
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={replyingToMessage ? `Replying to: ${replyingToMessage.content.substring(0, 30)}...` : "Ask Emily..."}
                className={`w-full px-6 py-4 bg-white border border-pink-200 rounded-2xl focus:ring-0 focus:border-transparent outline-none text-sm pr-20 placeholder:text-gray-400 resize-none overflow-y-auto ${replyingToMessage ? 'pt-8' : ''}`}
                style={{ minHeight: '56px', maxHeight: '96px' }} // 1 row min, 4 rows max (24px * 4 = 96px)
                disabled={isLoading || isStreaming}
                rows={1}
              />
            </div>
            <div className="absolute right-3 bottom-3 flex items-center space-x-2">
              <button 
                onClick={handleMicClick}
                disabled={isLoading || isStreaming}
                className={`p-2 transition-colors ${
                  isListening 
                    ? 'text-red-500 hover:text-red-700 animate-pulse' 
                    : 'text-purple-500 hover:text-purple-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                <Mic className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (inputMessage.trim() && !isLoading && !isStreaming) {
                    sendMessage()
                  }
                }}
                disabled={!inputMessage.trim() || isLoading || isStreaming}
                className="p-2 text-purple-500 hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% {
            opacity: 0.3;
          }
          30% {
            opacity: 1;
          }
        }
        
        .typing-dot-1 {
          animation: typing-dot 1.4s infinite;
          animation-delay: 0s;
        }
        
        .typing-dot-2 {
          animation: typing-dot 1.4s infinite;
          animation-delay: 0.2s;
        }
        
        @keyframes slide-in {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slide-in {
          animation: slide-in 0.4s ease-out;
        }
        
        .message-content-truncated {
          display: -webkit-box;
          -webkit-line-clamp: 9;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .messages-container {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        
        .messages-container::-webkit-scrollbar {
          display: none; /* Chrome, Safari, Opera */
        }
        
        .chatbot-bubble-shadow {
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
        }
        
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  )
})

export default Chatbot
