import React, { useState, useEffect } from 'react'
import { CheckCircle, Clock, Loader, Sparkles, Image, FileText, Calendar, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ContentProgress = ({ isVisible, onComplete }) => {
  const [progress, setProgress] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!isVisible) return

    let eventSource = null

    const setupSSE = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        
        if (!session?.session?.access_token) return

        // Create Server-Sent Events connection with token as query parameter
        const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
        eventSource = new EventSource(`${API_BASE_URL}/content/progress-stream?token=${session.session.access_token}`)

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'keepalive') {
              return // Ignore keepalive messages
            }

            setProgress(data)
            setIsGenerating(data.is_generating)
            
            if (!data.is_generating && onComplete) {
              onComplete()
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('SSE error:', error)
          // Reconnect after 3 seconds
          setTimeout(setupSSE, 3000)
        }

      } catch (error) {
        console.error('Error setting up SSE:', error)
      }
    }

    setupSSE()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [isVisible, onComplete])

  if (!isVisible || !isGenerating) return null

  const getStepIcon = (step) => {
    const icons = {
      initializing: <Loader className="w-5 h-5 animate-spin" />,
      loading_profile: <Target className="w-5 h-5" />,
      campaign_created: <Calendar className="w-5 h-5" />,
      generating_content: <FileText className="w-5 h-5" />,
      generating_images: <Image className="w-5 h-5" />,
      storing_content: <CheckCircle className="w-5 h-5" />,
      completed: <CheckCircle className="w-5 h-5" />
    }
    return icons[step] || <Clock className="w-5 h-5" />
  }

  const getStepName = (step) => {
    const names = {
      initializing: "Initializing",
      loading_profile: "Loading Profile",
      campaign_created: "Campaign Created",
      generating_content: "Generating Content",
      generating_images: "Creating Images",
      storing_content: "Storing Content",
      completed: "Completed"
    }
    return names[step] || step
  }

  const getStepColor = (step) => {
    const colors = {
      initializing: "text-blue-600",
      loading_profile: "text-purple-600",
      campaign_created: "text-green-600",
      generating_content: "text-orange-600",
      generating_images: "text-pink-600",
      storing_content: "text-indigo-600",
      completed: "text-green-600"
    }
    return colors[step] || "text-gray-600"
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-pink-600" />
              <h3 className="text-lg font-semibold text-gray-900">Generating Content</h3>
            </div>
            
            {progress && (
              <div className="flex items-center space-x-2">
                <div className={`${getStepColor(progress.step)}`}>
                  {getStepIcon(progress.step)}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {getStepName(progress.step)}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {progress && (
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {progress.percentage}%
                </div>
                <div className="text-xs text-gray-500">
                  {progress.current_platform && `Platform: ${progress.current_platform}`}
                  {progress.details && (
                    <div className="mt-1 text-purple-600 font-medium">
                      {progress.details}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress?.percentage || 0}%` }}
            ></div>
          </div>
        </div>

        {/* Step Details */}
        {progress && progress.details && (
          <div className="mt-3">
            <p className="text-sm text-gray-600">{progress.details}</p>
          </div>
        )}

        {/* Platform Progress */}
        {progress && progress.total_platforms > 0 && (
          <div className="mt-3 flex items-center space-x-2">
            <span className="text-xs text-gray-500">Platforms:</span>
            <div className="flex space-x-1">
              {Array.from({ length: progress.total_platforms }, (_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < (progress.completed_platforms || 0)
                      ? 'bg-green-500'
                      : i === (progress.completed_platforms || 0)
                      ? 'bg-pink-500 animate-pulse'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {progress.completed_platforms || 0} / {progress.total_platforms}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentProgress
