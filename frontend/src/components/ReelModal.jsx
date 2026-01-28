import React, { useState, useEffect, useRef } from 'react'
import { X, Hash, Edit, Check, X as XIcon, Sparkles, Upload, Copy, RefreshCw } from 'lucide-react'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import { useNotifications } from '../contexts/NotificationContext'

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
  useStorageListener('darkMode', () => {})

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-30 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
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

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
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
                <div className="relative">
                  <video
                    src={displayContent.media_url}
                    controls
                    className="w-full max-h-[32rem] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  {/* Replace Video Button Overlay */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`absolute top-4 right-4 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transform transition-all duration-200 hover:scale-105 flex items-center gap-2 ${
                      isDarkMode
                        ? 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-600'
                        : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-300'
                    } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={uploading}
                    title="Replace video"
                  >
                    <RefreshCw className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} />
                    {uploading ? 'Uploading...' : 'Replace Video'}
                  </button>
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
    </div>
  )
}

export default ReelModal
