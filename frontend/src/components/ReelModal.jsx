import React, { useState, useEffect, useRef } from 'react'
import { X, Hash, Edit, Check, X as XIcon, Sparkles, Upload, Copy, RefreshCw, MoreVertical, Trash2, Download, Play, Pause, Volume2, Maximize } from 'lucide-react'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import { useNotifications } from '../contexts/NotificationContext'

// Get API URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

// Get dark mode state from localStorage or default to dark mode
const getDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode')
  return saved !== null ? saved === 'true' : true // Default to true (dark mode)
}

// Listen for storage changes to sync dark mode across components
const useStorageListener = (key, callback) => {
  React.useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        callback(e.newValue === 'true')
      }
    }

    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        callback(e.detail.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [key, callback])
}

const ReelModal = ({ content, onClose }) => {
  const [isDarkMode] = React.useState(getDarkModePreference)
  const [dbContent, setDbContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef(null)
  const { showSuccess, showError } = useNotifications()
  
  // Edit mode states
  const [isEditing, setIsEditing] = useState(false)
  const [editContentValue, setEditContentValue] = useState('')
  const [editScriptValue, setEditScriptValue] = useState('')
  
  // AI Edit states
  const [showAIEditModal, setShowAIEditModal] = useState(false)
  const [aiEditType, setAiEditType] = useState('') // 'content' or 'script'
  const [aiEditInstruction, setAiEditInstruction] = useState('')
  const [aiEditing, setAiEditing] = useState(false)
  const [aiEditedContent, setAiEditedContent] = useState('')
  const [showAIResult, setShowAIResult] = useState(false)
  
  // Video menu states
  const [showVideoMenu, setShowVideoMenu] = useState(false)
  const videoMenuRef = useRef(null)
  const videoRef = useRef(null)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoVolume, setVideoVolume] = useState(1)
  
  useStorageListener('darkMode', () => {})
  
  // Close video menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (videoMenuRef.current && !videoMenuRef.current.contains(event.target)) {
        setShowVideoMenu(false)
      }
    }

    if (showVideoMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showVideoMenu])

  // Fetch content directly from Supabase
  useEffect(() => {
    const fetchContentFromDB = async () => {
      if (!content?.id) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('created_content')
          .select('*')
          .eq('id', content.id)
          .single()

        if (error) {
          console.error('Error fetching content from Supabase:', error)
          console.log('Content ID:', content.id)
        } else {
          console.log('Fetched content data:', data)
          setDbContent(data)
        }
      } catch (error) {
        console.error('Error fetching content:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchContentFromDB()
  }, [content?.id])

  // Debug logging for dbContent changes
  useEffect(() => {
    if (dbContent) {
      console.log('dbContent updated:', dbContent)
      console.log('media_url:', dbContent.media_url)
    }
  }, [dbContent])

  // Use database content if available, otherwise fallback to props
  const displayContent = dbContent || content

  // Edit handlers
  const handleEdit = () => {
    setEditContentValue(displayContent.content || '')
    setEditScriptValue(displayContent.short_video_script || '')
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditContentValue('')
    setEditScriptValue('')
  }

  const handleSave = async () => {
    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        showError('Authentication Required', 'Please log in to save changes')
        return
      }

      // Prepare update data
      const updateData = {}
      if (editContentValue !== undefined) {
        updateData.content = editContentValue
      }
      if (editScriptValue !== undefined) {
        updateData.short_video_script = editScriptValue
      }

      // Make API call to update created content
      const response = await fetch(`${API_BASE_URL}/content/created-content/update/${content.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        throw new Error('Failed to update content')
      }

      // Refresh the content data
      const { data: refreshedData, error: refreshError } = await supabase
        .from('created_content')
        .select('*')
        .eq('id', content.id)
        .single()

      if (refreshError) {
        console.error('Error refreshing content:', refreshError)
      } else if (refreshedData) {
        setDbContent(refreshedData)
      }

      showSuccess('Content Updated', 'Your content has been updated successfully!')
      setIsEditing(false)
    } catch (error) {
      console.error('Save failed:', error)
      showError('Save Failed', `Failed to save changes: ${error.message}`)
    }
  }

  // AI Edit handlers
  const handleAIEdit = (field) => {
    setAiEditType(field)
    setShowAIEditModal(true)
    setAiEditInstruction('')
    setShowAIResult(false)
    setAiEditedContent('')
  }

  const handleAISaveEdit = async () => {
    if (!aiEditInstruction.trim()) return

    // Validate instruction length
    if (aiEditInstruction.length > 500) {
      showError('Instruction Too Long', 'Please keep instructions under 500 characters')
      return
    }

    try {
      setAiEditing(true)

      // Get the current text based on type
      const currentText = aiEditType === 'content'
        ? (isEditing ? editContentValue : displayContent.content || '')
        : (isEditing ? editScriptValue : displayContent.short_video_script || '')

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        showError('Authentication Required', 'Please log in to use AI editing')
        return
      }

      // Call AI service to edit content
      const response = await fetch(`${API_BASE_URL}/content/ai/edit-content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: currentText,
          instruction: aiEditInstruction
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Show the AI result in the modal
        setAiEditedContent(result.edited_content)
        setShowAIResult(true)
      } else {
        throw new Error(result.error || result.detail || 'Failed to edit content with AI')
      }

    } catch (error) {
      console.error('AI edit failed:', error)
      showError('AI Edit Failed', `Failed to edit content with AI: ${error.message}`)
    } finally {
      setAiEditing(false)
    }
  }

  const handleSaveAIResult = () => {
    // Apply the AI-edited content to the form
    if (aiEditType === 'content') {
      setEditContentValue(aiEditedContent)
    } else if (aiEditType === 'script') {
      setEditScriptValue(aiEditedContent)
    }

    // Close the modal and reset state
    setShowAIEditModal(false)
    setShowAIResult(false)
    setAiEditedContent('')
    setAiEditInstruction('')
  }

  const handleTryAgain = () => {
    // Reset to instruction form
    setShowAIResult(false)
    setAiEditedContent('')
    setAiEditInstruction('')
  }

  const handleCancelAIEdit = () => {
    // Prevent closing if AI is currently processing
    if (aiEditing) {
      return
    }
    setShowAIEditModal(false)
    setShowAIResult(false)
    setAiEditedContent('')
    setAiEditInstruction('')
  }

  // Handle download video
  const handleDownloadVideo = () => {
    if (!displayContent.media_url) return
    
    try {
      const link = document.createElement('a')
      link.href = displayContent.media_url
      link.download = `video-${content.id || 'download'}.mp4`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showSuccess('Download Started', 'Video download has started')
      setShowVideoMenu(false)
    } catch (error) {
      console.error('Download failed:', error)
      showError('Download Failed', 'Failed to download video')
    }
  }

  // Handle remove video
  const handleRemoveVideo = async () => {
    if (!window.confirm('Are you sure you want to remove this video? This action cannot be undone.')) {
      return
    }

    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        showError('Authentication Required', 'Please log in to remove video')
        return
      }

      // Update the content record to remove media_url
      const { error: updateError } = await supabase
        .from('created_content')
        .update({
          media_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', content.id)

      if (updateError) {
        console.error('Update error:', updateError)
        showError('Remove Failed', 'Failed to remove video: ' + updateError.message)
        return
      }

      // Refresh the content data
      const { data: refreshedData, error: refreshError } = await supabase
        .from('created_content')
        .select('*')
        .eq('id', content.id)
        .single()

      if (refreshError) {
        console.error('Error refreshing content:', refreshError)
      } else if (refreshedData) {
        setDbContent(refreshedData)
      }

      showSuccess('Video Removed', 'Video has been removed successfully!')
      setShowVideoMenu(false)
    } catch (error) {
      console.error('Remove video failed:', error)
      showError('Remove Failed', `Failed to remove video: ${error.message}`)
    }
  }

  // Handle file upload (used by hidden file input)
  const handleFileUpload = async (file) => {
    if (!file) return

    // Validate file type (video files)
    if (!file.type.startsWith('video/')) {
      showError('Invalid File Type', 'Please select a video file')
      if (fileInputRef.current) { fileInputRef.current.value = '' }
      return
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      showError('File Too Large', 'File size must be less than 100MB')
      if (fileInputRef.current) { fileInputRef.current.value = '' }
      return
    }

    setUploading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        showError('Authentication Required', 'Please log in to upload files')
        setUploading(false)
        if (fileInputRef.current) { fileInputRef.current.value = '' }
        return
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/reels/${Date.now()}.${fileExt}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        showError('Upload Failed', 'Failed to upload video: ' + error.message)
        setUploading(false)
        if (fileInputRef.current) { fileInputRef.current.value = '' }
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) {
        showError('Upload Error', 'Failed to get video URL')
        setUploading(false)
        if (fileInputRef.current) { fileInputRef.current.value = '' }
        return
      }

      // Update the content record with the video URL
      console.log('Updating content with media_url:', urlData.publicUrl)
      const { error: updateError } = await supabase
        .from('created_content')
        .update({
          media_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', content.id)

      if (updateError) {
        console.error('Update error:', updateError)
        console.log('Update error details:', JSON.stringify(updateError, null, 2))
        showError('Update Failed', 'Video uploaded but failed to update content: ' + updateError.message)
        setUploading(false)
        if (fileInputRef.current) { fileInputRef.current.value = '' }
        return
      }

      console.log('Content updated successfully')

      // Refresh the content data
      const { data: refreshedData, error: refreshError } = await supabase
        .from('created_content')
        .select('*')
        .eq('id', content.id)
        .single()

      if (refreshError) {
        console.error('Error refreshing content:', refreshError)
      } else if (refreshedData) {
        console.log('Refreshed content data:', refreshedData)
        setDbContent(refreshedData)
      }

      showSuccess('Upload Successful', 'Reel uploaded successfully!')
      setUploading(false)
      if (fileInputRef.current) { fileInputRef.current.value = '' }

    } catch (error) {
      console.error('Upload failed:', error)
      showError('Upload Failed', 'Upload failed: ' + error.message)
      if (fileInputRef.current) { fileInputRef.current.value = '' }
    } finally {
      setUploading(false)
    }
  }

  if (!content) return null
  if (loading) return null // Could show a loading spinner here

  // Check if any processing is happening
  const isProcessing = isEditing || aiEditing || uploading

  const handleClose = () => {
    // Prevent closing if editing or processing
    if (isProcessing) {
      return
    }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) {
          handleClose()
        }
      }}
    >
      <div
        className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}
      >

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              displayContent.platform?.toLowerCase() === 'instagram' ? (isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-purple-500 to-pink-500') :
              displayContent.platform?.toLowerCase() === 'facebook' ? (isDarkMode ? 'bg-blue-700' : 'bg-blue-600') :
              displayContent.platform?.toLowerCase() === 'linkedin' ? (isDarkMode ? 'bg-blue-800' : 'bg-blue-700') :
              (isDarkMode ? 'bg-purple-600' : 'bg-purple-500')
            }`}>
              {displayContent.platform?.toLowerCase() === 'instagram' ? (
                <Instagram className="w-6 h-6 text-white" />
              ) : displayContent.platform?.toLowerCase() === 'facebook' ? (
                <Facebook className="w-6 h-6 text-white" />
              ) : displayContent.platform?.toLowerCase() === 'linkedin' ? (
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                  <span className="text-blue-700 text-xs font-bold">in</span>
                </div>
              ) : (
                <MessageCircle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p
                className={`text-base ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {(() => {
                  const platform = displayContent.platform || 'General'
                  const contentType = displayContent.content_type || ''
                  const status = displayContent.status

                  // For scheduled content, show a two-line layout
                  const scheduledAt = displayContent.scheduled_at || displayContent.scheduledAt
                  if (status === 'scheduled' && scheduledAt) {
                    try {
                      const scheduledDate = new Date(scheduledAt)
                      const formattedDate = scheduledDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                      const formattedTime = scheduledDate.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })

                      return (
                        <span className="flex flex-col leading-tight">
                          <span>
                            {platform}
                            {contentType && ` • ${contentType}`}
                            {' • Scheduled'}
                          </span>
                          <span className={`text-base font-normal mt-0.5 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            at {formattedDate}, {formattedTime}
                          </span>
                        </span>
                      )
                    } catch (error) {
                      console.error('Error formatting scheduled date:', error, scheduledAt)
                      return `${platform}${contentType ? ` • ${contentType}` : ''} • Scheduled`
                    }
                  }

                  const parts = [platform]
                  if (contentType) parts.push(contentType)
                  if (status) {
                    parts.push(status.charAt(0).toUpperCase() + status.slice(1))
                  }

                  return parts.join(' • ')
                })()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {displayContent.status !== 'published' && (
              <>
                {!isEditing ? (
                  <button
                    onClick={handleEdit}
                    className={`p-2 rounded-lg transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                        : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                    }`}
                    title="Edit content"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'bg-green-600 hover:bg-green-500 text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      <Check className="w-4 h-4 inline mr-1" />
                      Save
                    </button>
                  </div>
                )}
              </>
            )}
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className={`p-2 rounded-lg transition-colors ${
                isProcessing
                  ? 'opacity-50 cursor-not-allowed'
                  : isDarkMode
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={isProcessing ? 'Cannot close while editing or processing' : 'Close'}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hidden file input for video uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files[0])}
        />

        {/* Content - Two Column Layout with Conditional Rendering */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-[400px]">
          {displayContent.media_url ? (
            <>
              {/* Video EXISTS: Left Column - Video Player */}
              <div className="space-y-4">
                <div className="relative group">
                  <video
                    ref={videoRef}
                    src={displayContent.media_url}
                    className="w-full max-h-[32rem] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                    onVolumeChange={(e) => setVideoVolume(e.target.volume)}
                  />
                  
                  {/* Custom Video Controls Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between">
                      {/* Play/Pause Button */}
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            if (isVideoPlaying) {
                              videoRef.current.pause()
                            } else {
                              videoRef.current.play()
                            }
                          }
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        title={isVideoPlaying ? "Pause" : "Play"}
                      >
                        {isVideoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                      </button>
                      
                      {/* Volume Control */}
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-white" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={videoVolume}
                          onChange={(e) => {
                            const volume = parseFloat(e.target.value)
                            setVideoVolume(volume)
                            if (videoRef.current) {
                              videoRef.current.volume = volume
                            }
                          }}
                          className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      
                      {/* Fullscreen Button */}
                      <button
                        onClick={() => {
                          if (videoRef.current) {
                            if (videoRef.current.requestFullscreen) {
                              videoRef.current.requestFullscreen()
                            }
                          }
                        }}
                        className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                        title="Fullscreen"
                      >
                        <Maximize className="w-5 h-5" />
                      </button>
                      
                      {/* Video Options Menu (3 dots) */}
                      {displayContent.status !== 'published' && (
                        <div className="relative" ref={videoMenuRef}>
                          <button
                            onClick={() => setShowVideoMenu(!showVideoMenu)}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title="Video options"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {showVideoMenu && (
                            <div className={`absolute bottom-full right-0 mb-2 w-56 rounded-lg shadow-xl z-10 border ${
                              isDarkMode
                                ? 'bg-gray-800 border-gray-700'
                                : 'bg-white border-gray-200'
                            }`}>
                              <div className="py-1">
                                <button
                                  onClick={handleDownloadVideo}
                                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                                    isDarkMode
                                      ? 'hover:bg-gray-700 text-gray-200'
                                      : 'hover:bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  <Download className="w-4 h-4" />
                                  <span>Download Video</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setShowVideoMenu(false)
                                    fileInputRef.current?.click()
                                  }}
                                  disabled={uploading}
                                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                                    uploading
                                      ? 'opacity-50 cursor-not-allowed'
                                      : isDarkMode
                                        ? 'hover:bg-gray-700 text-gray-200'
                                        : 'hover:bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  <RefreshCw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
                                  <span>{uploading ? 'Uploading...' : 'Replace Video'}</span>
                                </button>
                                <div className={`border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
                                <button
                                  onClick={handleRemoveVideo}
                                  className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                                    isDarkMode
                                      ? 'hover:bg-red-900/30 text-red-400'
                                      : 'hover:bg-red-50 text-red-600'
                                  }`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Remove Video</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Video EXISTS: Right Column - Title, Caption (with copy), Hashtags */}
              <div className={`space-y-6 pr-4 max-h-[32rem] overflow-y-auto ${
                isDarkMode ? 'dark-scrollbar' : 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400'
              }`}>
                {/* Title */}
                {displayContent.title && (
                  <div>
                    <h2 className={`text-3xl font-normal leading-tight ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {displayContent.title}
                    </h2>
                  </div>
                )}

                {/* Caption with Copy Button */}
                {displayContent.content && (
                  <div>
                    {isEditing ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className={`block text-sm font-medium ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>Caption</label>
                          {displayContent.status !== 'published' && (
                            <button
                              onClick={() => handleAIEdit('content')}
                              disabled={aiEditing}
                              className={`p-1 rounded transition-colors disabled:opacity-50 ${
                                isDarkMode
                                  ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                                  : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                              }`}
                              title="Enhance with AI"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={editContentValue}
                          onChange={(e) => setEditContentValue(e.target.value)}
                          className={`w-full p-4 border rounded-lg leading-relaxed focus:outline-none focus:ring-2 min-h-[150px] ${
                            isDarkMode
                              ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                              : 'border-gray-300 text-gray-700 focus:ring-blue-500'
                          }`}
                          placeholder="Enter caption..."
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className={`leading-relaxed whitespace-pre-wrap p-4 rounded-lg text-base ${
                          isDarkMode ? 'text-white bg-gray-800' : 'text-gray-700 bg-gray-50'
                        }`}>
                          {displayContent.content}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(displayContent.content || '');
                              setCopied(true);
                              setTimeout(() => setCopied(false), 3000);
                            } catch (err) {
                              console.error('Failed to copy caption:', err);
                            }
                          }}
                          className={`absolute top-2 right-2 p-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            copied
                              ? 'bg-green-500 text-white scale-105'
                              : isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                          title={copied ? "Copied!" : "Copy caption to clipboard"}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Hashtags */}
                {displayContent.hashtags && Array.isArray(displayContent.hashtags) && displayContent.hashtags.length > 0 && (
                  <div>
                    <h3 className={`text-xl font-normal mb-3 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      🏷️ Hashtags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {displayContent.hashtags.map((hashtag, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isDarkMode
                              ? 'bg-blue-900 text-blue-200'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* No Video: Left Column - Script */}
              <div className="space-y-4">
                <div className={`w-full max-h-[32rem] rounded-lg shadow-lg overflow-hidden ${
                  isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                }`}>
                  {!isEditing ? (
                    <>
                      <div className={`p-4 border-b ${
                        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className={`text-xl font-normal ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              Video Script
                            </h3>
                            <p className={`text-base mt-1 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              15-30 second video script optimized for virality
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(displayContent.short_video_script || '');
                                  setCopied(true);
                                  setTimeout(() => setCopied(false), 3000);
                                } catch (err) {
                                  console.error('Failed to copy script:', err);
                                }
                              }}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                                copied
                                  ? isDarkMode
                                    ? 'bg-green-600 hover:bg-green-500 text-white scale-105'
                                    : 'bg-green-500 hover:bg-green-600 text-white scale-105'
                                  : isDarkMode
                                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                              }`}
                              title={copied ? "Copied!" : "Copy script to clipboard"}
                            >
                              {copied ? (
                                <>
                                  <Check className="w-4 h-4 animate-pulse" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className={`p-4 max-h-[28rem] overflow-y-auto ${
                        isDarkMode ? 'dark-scrollbar' : 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400'
                      }`}>
                        {displayContent.short_video_script ? (
                      <div className="space-y-2">
                        {displayContent.short_video_script.split('\n').map((line, index) => {
                          const timestampMatch = line.match(/^(\d{1,2}:\d{2})\s*-\s*\[([^\]]+)\]/);
                          if (timestampMatch) {
                            const [, timestamp, type] = timestampMatch;
                            const content = line.replace(timestampMatch[0], '').trim();
                            return (
                              <div key={index} className="leading-relaxed">
                                <span className={`font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {timestamp}
                                </span>
                                <span className={`ml-2 font-medium ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                  [{type}]
                                </span>
                                <span className={`ml-1 ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                                  {content}
                                </span>
                              </div>
                            );
                          }
                          return (
                            <div key={index} className={`leading-relaxed ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>
                              {line}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`text-center py-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        No script available.
                      </div>
                    )}
                      </div>
                    </>
                  ) : (
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>Video Script</label>
                        {displayContent.status !== 'published' && (
                          <button
                            onClick={() => handleAIEdit('script')}
                            disabled={aiEditing}
                            className={`p-1 rounded transition-colors disabled:opacity-50 ${
                              isDarkMode
                                ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                                : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                            }`}
                            title="Enhance with AI"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={editScriptValue}
                        onChange={(e) => setEditScriptValue(e.target.value)}
                        className={`w-full p-4 border rounded-lg leading-relaxed focus:outline-none focus:ring-2 min-h-[300px] font-mono text-sm ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                            : 'border-gray-300 text-gray-700 focus:ring-blue-500'
                        }`}
                        placeholder="Enter video script..."
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* No Video: Right Column - Title, Caption (with copy), Upload Box, Hashtags */}
              <div className={`space-y-6 pr-4 max-h-[32rem] overflow-y-auto ${
                isDarkMode ? 'dark-scrollbar' : 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400'
              }`}>
                {/* Title */}
                {displayContent.title && (
                  <div>
                    <h2 className={`text-3xl font-normal leading-tight ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {displayContent.title}
                    </h2>
                  </div>
                )}

                {/* Caption with Copy Button */}
                {displayContent.content && (
                  <div>
                    {isEditing ? (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className={`block text-sm font-medium ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-700'
                          }`}>Caption</label>
                          {displayContent.status !== 'published' && (
                            <button
                              onClick={() => handleAIEdit('content')}
                              disabled={aiEditing}
                              className={`p-1 rounded transition-colors disabled:opacity-50 ${
                                isDarkMode
                                  ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                                  : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                              }`}
                              title="Enhance with AI"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <textarea
                          value={editContentValue}
                          onChange={(e) => setEditContentValue(e.target.value)}
                          className={`w-full p-4 border rounded-lg leading-relaxed focus:outline-none focus:ring-2 min-h-[150px] ${
                            isDarkMode
                              ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                              : 'border-gray-300 text-gray-700 focus:ring-blue-500'
                          }`}
                          placeholder="Enter caption..."
                        />
                      </div>
                    ) : (
                      <div className="relative">
                        <div className={`leading-relaxed whitespace-pre-wrap p-4 rounded-lg text-base ${
                          isDarkMode ? 'text-white bg-gray-800' : 'text-gray-700 bg-gray-50'
                        }`}>
                          {displayContent.content}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(displayContent.content || '');
                              setCopied(true);
                              setTimeout(() => setCopied(false), 3000);
                            } catch (err) {
                              console.error('Failed to copy caption:', err);
                            }
                          }}
                          className={`absolute top-2 right-2 p-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            copied
                              ? 'bg-green-500 text-white scale-105'
                              : isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                          title={copied ? "Copied!" : "Copy caption to clipboard"}
                        >
                          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* No Media Available Box */}
                <div className={`flex flex-col items-center justify-center p-8 rounded-lg border-2 border-dashed text-center ${
                  isDarkMode ? 'border-gray-600 bg-gray-800' : 'border-gray-300 bg-gray-50'
                }`}>
                  <Upload className={`w-12 h-12 mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                  <p className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    No media available
                  </p>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Upload a video to display here
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`px-6 py-3 rounded-lg font-medium text-white shadow-lg transform transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
                      isDarkMode
                        ? 'bg-blue-600 hover:bg-blue-500'
                        : 'bg-blue-500 hover:bg-blue-600'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={uploading}
                  >
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Uploading...' : 'Upload Video'}
                  </button>
                </div>

                {/* Hashtags */}
                {displayContent.hashtags && Array.isArray(displayContent.hashtags) && displayContent.hashtags.length > 0 && (
                  <div>
                    <h3 className={`text-xl font-normal mb-3 ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      🏷️ Hashtags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {displayContent.hashtags.map((hashtag, index) => (
                        <span
                          key={index}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            isDarkMode
                              ? 'bg-blue-900 text-blue-200'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          #{hashtag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Edit Modal */}
      {showAIEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-[60]"
          onClick={(e) => {
            // Prevent closing if AI is processing
            if (!aiEditing && e.target === e.currentTarget) {
              handleCancelAIEdit()
            }
          }}
        >
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              {/* Header */}
              <div className={`p-6 border-b ${
                isDarkMode
                  ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
                  : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src="/leo_logo.png"
                      alt="Leo"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        e.target.src = '/default-logo.png'
                      }}
                    />
                    <div>
                      <h3 className={`text-xl font-normal ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Edit {aiEditType === 'content' ? 'Caption' : 'Script'} with Leo
                      </h3>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Provide instructions for Leo to modify the {aiEditType}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelAIEdit}
                    disabled={aiEditing}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      aiEditing
                        ? 'opacity-50 cursor-not-allowed'
                        : isDarkMode
                          ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                    }`}
                    title={aiEditing ? 'Cannot close while AI is processing' : 'Close'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {!showAIResult ? (
                    <>
                      {/* Current Content Preview */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Current {aiEditType === 'content' ? 'Caption' : 'Script'}
                        </label>
                        <div className={`p-3 rounded-lg text-sm max-h-32 overflow-y-auto ${
                          isDarkMode
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {aiEditType === 'content'
                            ? (isEditing ? editContentValue : displayContent.content || '')
                            : (isEditing ? editScriptValue : displayContent.short_video_script || '')
                          }
                        </div>
                      </div>

                      {/* AI Instruction */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          AI Instruction <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <textarea
                            value={aiEditInstruction}
                            onChange={(e) => setAiEditInstruction(e.target.value)}
                            className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent resize-none text-sm ${
                              isDarkMode
                                ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                                : 'border-gray-300 text-gray-900 focus:ring-blue-500'
                            }`}
                            rows={5}
                            placeholder="Describe how you want the content to be modified..."
                          />
                          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                            {aiEditInstruction.length}/500
                          </div>
                        </div>

                        {/* Instruction Examples */}
                        <div className="mt-3">
                          <p className={`text-xs mb-2 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>Example instructions:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button
                              onClick={() => setAiEditInstruction("Make it more engaging and add relevant emojis")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Make it more engaging
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Make it shorter and more concise")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Make it shorter
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Change the tone to be more professional")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Professional tone
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Add a call-to-action at the end")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Add call-to-action
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* AI Result Preview */
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        AI Generated {aiEditType === 'content' ? 'Caption' : 'Script'}
                      </label>
                      <div className={`p-4 border rounded-lg text-sm max-h-64 overflow-y-auto ${
                        isDarkMode
                          ? 'bg-blue-900/20 border-blue-700 text-gray-300'
                          : 'bg-blue-50 border-blue-200 text-gray-700'
                      }`}>
                        {aiEditedContent}
                      </div>
                      <p className={`text-xs mt-2 ${
                        isDarkMode ? 'text-blue-400' : 'text-blue-600'
                      }`}>
                        ✨ AI has processed your content based on: "{aiEditInstruction}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={showAIResult ? handleTryAgain : handleCancelAIEdit}
                      disabled={aiEditing}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        aiEditing
                          ? 'opacity-50 cursor-not-allowed'
                          : isDarkMode
                            ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                            : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {showAIResult ? 'Try Again' : 'Cancel'}
                    </button>
                    {!showAIResult ? (
                      <button
                        onClick={handleAISaveEdit}
                        disabled={aiEditing || !aiEditInstruction.trim() || aiEditInstruction.length > 500}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                      >
                        {aiEditing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>AI Editing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Edit with AI</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={handleSaveAIResult}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-emerald-600 transition-all duration-200 flex items-center space-x-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReelModal
