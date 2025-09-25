import React, { useState, useEffect } from 'react'
import { X, Sparkles, CheckCircle, Clock, Loader, Image, FileText, Calendar, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ContentGenerationModal = ({ isVisible, onClose, onComplete }) => {
  const [progress, setProgress] = useState(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Reset state when modal becomes visible
  useEffect(() => {
    if (isVisible) {
      setProgress(null)
      setIsGenerating(false)
    }
  }, [isVisible])

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

  if (!isVisible) return null

  const getStepIcon = (step) => {
    const icons = {
      initializing: <Loader className="w-6 h-6 animate-spin" />,
      loading_profile: <Target className="w-6 h-6" />,
      campaign_created: <Calendar className="w-6 h-6" />,
      generating_content: <FileText className="w-6 h-6" />,
      generating_images: <Image className="w-6 h-6" />,
      storing_content: <CheckCircle className="w-6 h-6" />,
      completed: <CheckCircle className="w-6 h-6" />
    }
    return icons[step] || <Clock className="w-6 h-6" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Background Blur Overlay */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={isGenerating ? undefined : onClose}
      />
      
      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-6 h-6 text-white" />
              <h3 className="text-xl font-semibold text-white">Generating Content</h3>
            </div>
            <button
              onClick={onClose}
              disabled={isGenerating}
              className={`text-white transition-colors ${
                isGenerating 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:text-gray-200'
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Progress Content */}
        <div className="p-6">
          {progress && (
            <div className="space-y-6">
              {/* Current Step */}
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4 ${getStepColor(progress.step)}`}>
                  {getStepIcon(progress.step)}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {getStepName(progress.step)}
                </h4>
                {progress.details && (
                  <p className="text-sm text-gray-600">{progress.details}</p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span>{progress.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-pink-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress.percentage || 0}%` }}
                  ></div>
                </div>
              </div>

              {/* Platform Progress */}
              {progress.total_platforms > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Platforms</span>
                    <span>{progress.completed_platforms || 0} / {progress.total_platforms}</span>
                  </div>
                  <div className="flex space-x-1">
                    {Array.from({ length: progress.total_platforms }, (_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-2 rounded-full ${
                          i < (progress.completed_platforms || 0)
                            ? 'bg-green-500'
                            : i === (progress.completed_platforms || 0)
                            ? 'bg-pink-500 animate-pulse'
                            : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  {progress.current_platform && (
                    <p className="text-xs text-center text-gray-500">
                      Current: {progress.current_platform}
                    </p>
                  )}
                </div>
              )}

              {/* Post Progress - Show when generating content */}
              {progress.step === 'generating_content' && progress.details && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Content Generation</span>
                    <span className="text-purple-600 font-medium">{progress.details}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress.percentage || 0}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Status Message */}
              <div className="text-center">
                <p className="text-sm text-gray-500">
                  {isGenerating 
                    ? (progress.details || "Please wait while AI creates your content...")
                    : "Generation completed! Refreshing page to show new content..."
                  }
                </p>
              </div>
            </div>
          )}

          {!progress && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Loader className="w-6 h-6 animate-spin text-gray-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Starting Generation
              </h4>
              <p className="text-sm text-gray-600">
                Preparing to generate your content...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ContentGenerationModal
