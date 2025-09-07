import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useContentCache } from '../contexts/ContentCacheContext'
import { contentAPI } from '../services/content'
import { supabase } from '../lib/supabase'
import ContentProgress from './ContentProgress'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
import { 
  Calendar, 
  Image, 
  FileText, 
  Hash, 
  Clock, 
  TrendingUp, 
  Plus,
  RefreshCw,
  Eye,
  Edit,
  Share2,
  Download,
  Filter,
  Search,
  Grid,
  List,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Target,
  Users,
  BarChart3,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube
} from 'lucide-react'

const ContentDashboard = () => {
  const { user } = useAuth()
  const { showContentGeneration, showSuccess, showError, showLoading } = useNotifications()
  const { 
    scheduledContent, 
    contentDate, 
    loading, 
    fetchScheduledContent, 
    updateContentInCache,
    getCacheStatus 
  } = useContentCache()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [postingContent, setPostingContent] = useState(new Set()) // Track which content is being posted

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchScheduledContent(forceRefresh)
      
      console.log('Fetched content data:', result)
      console.log('Cache status:', getCacheStatus())
      
      if (result.data) {
        console.log('Content items:', result.data)
        console.log('Platform values in content:', result.data.map(item => ({ id: item.id, platform: item.platform })))
        console.log('Data source:', result.fromCache ? 'cache' : 'API')
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
    }
  }

  const handleGenerateContent = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      
      // Show loading notification
      showLoading(
        'Content Generation Started',
        'AI is creating your content. This may take a few minutes...',
        {
          details: 'You can continue using the app while content is being generated.',
          persistent: true
        }
      )
      
      const result = await contentAPI.generateContent()
      
      if (result.data) {
        setGenerationStatus('success')
        setGenerationMessage('Content generation started! This may take a few minutes. The page will refresh automatically when complete.')
        setShowProgress(true)
        
        // Refresh data after a short delay
        setTimeout(async () => {
          await fetchData()
        }, 2000)
        
        // Auto-refresh every 10 seconds while generating
        const refreshInterval = setInterval(async () => {
          await fetchData()
          // Stop refreshing if we have new content
          if (campaigns.length > 0) {
            clearInterval(refreshInterval)
          }
        }, 10000)
        
        // Clear interval after 5 minutes
        setTimeout(() => {
          clearInterval(refreshInterval)
        }, 300000)
        
      } else if (result.error) {
        setGenerationStatus('error')
        let errorMessage = 'Failed to start content generation. Please try again.'
        
        if (result.error.message?.includes('onboarding')) {
          errorMessage = 'Please complete your onboarding first before generating content.'
        } else if (result.error.message?.includes('platforms')) {
          errorMessage = 'Please configure your social media platforms in your profile first.'
        } else {
          errorMessage = result.error.message || errorMessage
        }
        
        setGenerationMessage(errorMessage)
        showError('Content Generation Failed', errorMessage)
      }
    } catch (error) {
      console.error('Error generating content:', error)
      setGenerationStatus('error')
      setGenerationMessage('An unexpected error occurred. Please try again.')
      showError('Content Generation Error', 'An unexpected error occurred. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleTriggerWeekly = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      
      const response = await fetch('http://localhost:8000/content/trigger-weekly', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.success) {
        setGenerationStatus('success')
        setGenerationMessage('Weekly content generation triggered! This will generate content for all users. Refreshing...')
        setShowProgress(true)
        
        // Refresh data after a short delay
        setTimeout(async () => {
          await fetchData(true) // Force refresh from API
        }, 3000)
      } else {
        setGenerationStatus('error')
        setGenerationMessage(data.message || 'Weekly generation failed')
      }
    } catch (error) {
      console.error('Error triggering weekly generation:', error)
      setGenerationStatus('error')
      setGenerationMessage('Weekly generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const toggleCampaignExpansion = (campaignId) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
    } else {
      newExpanded.add(campaignId)
    }
    setExpandedCampaigns(newExpanded)
  }

  const filteredContent = scheduledContent.filter(content => {
    const matchesPlatform = filterPlatform === 'all' || content.platform === filterPlatform
    const matchesSearch = searchTerm === '' || 
      content.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      content.title?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesPlatform && matchesSearch
  })

  const getPlatformIcon = (platform) => {
    // Normalize platform name to lowercase for consistent matching
    const normalizedPlatform = platform?.toLowerCase()?.trim()
    
    // Debug log to see what platform values we're getting
    console.log('Platform icon requested for:', platform, 'normalized to:', normalizedPlatform)
    
    const icons = {
      facebook: <Facebook className="w-5 h-5" />,
      instagram: <Instagram className="w-5 h-5" />,
      linkedin: <Linkedin className="w-5 h-5" />,
      twitter: <Twitter className="w-5 h-5" />,
      'twitter/x': <Twitter className="w-5 h-5" />,
      'x': <Twitter className="w-5 h-5" />,
      tiktok: <div className="w-5 h-5 bg-black rounded text-white flex items-center justify-center text-xs font-bold">TT</div>,
      youtube: <Youtube className="w-5 h-5" />,
      unknown: <div className="w-5 h-5 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
    }
    
    const icon = icons[normalizedPlatform]
    if (icon) {
      return icon
    }
    
    // Fallback with debug info
    console.warn('Unknown platform:', platform, 'normalized:', normalizedPlatform)
    return <div className="w-5 h-5 bg-gray-400 rounded text-white flex items-center justify-center text-xs" title={`Unknown platform: ${platform}`}>?</div>
  }

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: 'from-blue-500 to-blue-600',
      instagram: 'from-pink-500 to-purple-600',
      linkedin: 'from-blue-600 to-blue-700',
      twitter: 'from-sky-400 to-sky-500',
      tiktok: 'from-black to-gray-800',
      youtube: 'from-red-500 to-red-600'
    }
    return colors[platform] || 'from-gray-500 to-gray-600'
  }

  const getPlatformCardTheme = (platform) => {
    // Normalize platform name to lowercase for consistent matching
    const normalizedPlatform = platform?.toLowerCase()?.trim()
    
    const themes = {
      facebook: {
        bg: 'bg-white/50',
        border: 'border-blue-300',
        iconBg: 'bg-blue-600',
        text: 'text-blue-800',
        accent: 'bg-blue-200'
      },
      instagram: {
        bg: 'bg-white/50',
        border: 'border-pink-300',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-800',
        accent: 'bg-pink-200'
      },
      linkedin: {
        bg: 'bg-white/50',
        border: 'border-blue-300',
        iconBg: 'bg-blue-700',
        text: 'text-blue-800',
        accent: 'bg-blue-200'
      },
      twitter: {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      'twitter/x': {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      'x': {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      tiktok: {
        bg: 'bg-white/50',
        border: 'border-gray-300',
        iconBg: 'bg-black',
        text: 'text-gray-800',
        accent: 'bg-gray-200'
      },
      youtube: {
        bg: 'bg-white/50',
        border: 'border-red-300',
        iconBg: 'bg-red-600',
        text: 'text-red-800',
        accent: 'bg-red-200'
      },
      // Additional variations
      'linkedin': {
        bg: 'bg-white/50',
        border: 'border-blue-300',
        iconBg: 'bg-blue-700',
        text: 'text-blue-800',
        accent: 'bg-blue-200'
      },
      'youtube': {
        bg: 'bg-white/50',
        border: 'border-red-300',
        iconBg: 'bg-red-600',
        text: 'text-red-800',
        accent: 'bg-red-200'
      }
    }
    
    const theme = themes[normalizedPlatform]
    if (theme) {
      return theme
    }
    
    // Fallback theme
    console.warn('Unknown platform for theme:', platform, 'normalized:', normalizedPlatform)
    return {
      bg: 'bg-white/50',
      border: 'border-gray-300',
      iconBg: 'bg-gray-500',
      text: 'text-gray-800',
      accent: 'bg-gray-200'
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      published: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="w-full max-w-md px-8">
          <LoadingBar 
            message="Loading your content..." 
            className="text-center"
          />
        </div>
      </div>
    )
  }

  const handleProgressComplete = () => {
    setShowProgress(false)
    setGenerationStatus('success')
    setGenerationMessage('Content generation completed! Your new content is ready.')
    
    // Show success notification
    showContentGeneration(
      'Content Generation Complete! 🎉',
      'Your AI-generated content is ready to view and manage.',
      {
        details: 'Click on the Content tab to see your new campaigns and posts.',
        actions: [
          {
            label: 'View Content',
            primary: true,
            onClick: () => navigate('/content')
          }
        ]
      }
    )
    
    fetchData() // Refresh the data
  }

  const handlePostContent = async (content) => {
    try {
      // Add content to posting set
      setPostingContent(prev => new Set([...prev, content.id]))
      
      console.log('Posting content to', content.platform, ':', content)
      
      // Handle different platforms
      if (content.platform.toLowerCase() === 'facebook') {
        await postToFacebook(content)
      } else if (content.platform.toLowerCase() === 'instagram') {
        await postToInstagram(content)
      } else {
        // For other platforms, show a message
        showError(`${content.platform} posting not yet implemented`)
        return
      }
      
    } catch (error) {
      console.error('Error posting content:', error)
      showError(`Failed to post to ${content.platform}: ${error.message}`)
    } finally {
      // Remove content from posting set
      setPostingContent(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
        return newSet
      })
    }
  }

  const postToFacebook = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/connections/facebook/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: content.content,
          title: content.title,
          hashtags: content.hashtags || [],
          content_id: content.id
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Facebook post result:', result)
      
      showSuccess(`Successfully posted to Facebook!`)
      
      // Update the content status to published in cache
      updateContentInCache(content.id, { status: 'published' })
      
    } catch (error) {
      console.error('Error posting to Facebook:', error)
      throw error
    }
  }

  const postToInstagram = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/connections/instagram/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          message: content.content,
          title: content.title,
          hashtags: content.hashtags || [],
          content_id: content.id
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Instagram post result:', result)
      
      showSuccess(`Successfully posted to Instagram!`)
      
      // Update the content status to published in cache
      updateContentInCache(content.id, { status: 'published' })
      
    } catch (error) {
      console.error('Error posting to Instagram:', error)
      throw error
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Progress Bar */}
      <ContentProgress 
        isVisible={showProgress} 
        onComplete={handleProgressComplete}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-8">
                {/* Stats Cards in Header */}
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Total</p>
                      <p className="text-lg font-bold text-gray-900">{scheduledContent.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Platforms</p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Set(scheduledContent.map(content => content.platform)).size}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Image className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">With Media</p>
                      <p className="text-lg font-bold text-gray-900">
                        {scheduledContent.filter(content => content.media_url).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
                >
                  <Calendar className="w-4 h-4" />
                  <span>View Calendar</span>
                </button>
                <button
                  onClick={handleGenerateContent}
                  disabled={generating}
                  className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50"
                >
                  {generating ? (
                    <div className="w-4 h-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{generating ? 'Generating...' : 'Generate Content'}</span>
                </button>
                
                {/* Filter and View Controls */}
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  >
                    <option value="all">All Platforms</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="twitter">Twitter</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                  </select>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
          {/* Status Message */}
          {generationStatus && (
            <div className={`mb-6 p-4 rounded-lg ${
              generationStatus === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex items-center">
                {generationStatus === 'success' ? (
                  <Sparkles className="w-5 h-5 mr-2" />
                ) : (
                  <RefreshCw className="w-5 h-5 mr-2" />
                )}
                <span className="font-medium">{generationMessage}</span>
              </div>
            </div>
          )}

          {/* Content Cards - 4 Column Layout */}
          <div className="space-y-6">
            {filteredContent.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-12 h-12 text-pink-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No content available</h3>
                <p className="text-gray-500 mb-6">Generate content to see it displayed here</p>
                <button
                  onClick={handleGenerateContent}
                  disabled={generating}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                      </div>
                      <span>Generating Content...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate Content</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filteredContent.map((content) => {
                  const theme = getPlatformCardTheme(content.platform)
                  console.log('Content platform:', content.platform, 'Theme:', theme)
                  return (
                    <div key={content.id} className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
                            <div className="text-white">
                              {getPlatformIcon(content.platform)}
                            </div>
                          </div>
                          <div>
                            <h4 className={`font-semibold capitalize ${theme.text}`}>{content.platform}</h4>
                            <p className="text-sm text-gray-500">{content.status}</p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(content.status)}`}>
                          {content.status}
                        </div>
                      </div>
                    
                    {content.title && (
                      <h5 className="font-medium text-gray-900 mb-3">{content.title}</h5>
                    )}
                    
                    <p className="text-gray-700 text-sm mb-4 line-clamp-3">{content.content}</p>
                    
                    {content.hashtags && content.hashtags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {content.hashtags.map((tag, index) => (
                          <span key={index} className={`text-xs ${theme.accent} ${theme.text} px-2 py-1 rounded-lg`}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {content.media_url && (
                      <div className="mb-4">
                        <div className="w-full h-32 bg-gray-100 rounded-lg overflow-hidden">
                          <img 
                            src={content.media_url} 
                            alt="Content media"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Inline Icons Row */}
                    <div className="flex items-center justify-between mb-4">
                      {/* Calendar Date Display */}
                      <div className="flex items-center space-x-3">
                        <div 
                          className={`w-10 h-10 ${theme.accent} rounded-lg flex flex-col items-center justify-center ${theme.text} cursor-help`}
                          title={`Scheduled for ${formatDate(content.scheduled_at)}`}
                        >
                          <Calendar className="w-4 h-4" />
                          <span className="text-xs font-bold leading-none">
                            {new Date(content.scheduled_at).getDate()}
                          </span>
                        </div>
                        <div className="text-sm">
                          <div className={`font-medium ${theme.text}`}>
                            {new Date(content.scheduled_at).toLocaleDateString('en-US', { month: 'short' })}
                          </div>
                          <div className="text-gray-500 text-xs">
                            {new Date(content.scheduled_at).toLocaleDateString('en-US', { year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Icons */}
                      <div className="flex items-center space-x-2">
                        <button 
                          className={`p-2 ${theme.accent} hover:opacity-80 rounded-lg transition-all duration-200 ${theme.text}`} 
                          title="View Content"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className={`p-2 ${theme.accent} hover:opacity-80 rounded-lg transition-all duration-200 ${theme.text}`} 
                          title="Edit Content"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePostContent(content)}
                          disabled={content.status === 'published' || postingContent.has(content.id)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            content.status === 'published' 
                              ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                              : postingContent.has(content.id)
                              ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                              : `${theme.iconBg} text-white hover:opacity-90`
                          }`}
                          title={content.status === 'published' ? 'Already Published' : postingContent.has(content.id) ? 'Posting...' : `Post to ${content.platform}`}
                        >
                          {postingContent.has(content.id) ? (
                            <div className="w-4 h-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            </div>
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContentDashboard
