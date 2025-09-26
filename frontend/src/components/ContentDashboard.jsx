import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useContentCache } from '../contexts/ContentCacheContext'
import { contentAPI } from '../services/content'
import mediaService from '../services/media'
import { supabase } from '../lib/supabase'
import ContentProgress from './ContentProgress'
import ContentGenerationModal from './ContentGenerationModal'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import SideNavbar from './SideNavbar'

const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})()
import { 
  Calendar, 
  Image, 
  FileText, 
  Hash, 
  Clock, 
  TrendingUp, 
  Plus,
  RefreshCw,
  Edit,
  Share2,
  Download,
  Filter,
  Grid,
  List,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Target,
  Users,
  BarChart3,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Wand2,
  Loader2,
  Upload,
  X,
  CheckCircle
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
    getCacheStatus,
    clearCache,
    setScheduledContent,
    setContentDate,
    setLastFetchTime,
    setCacheValid
  } = useContentCache()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [fetchingFreshData, setFetchingFreshData] = useState(false)
  const [postingContent, setPostingContent] = useState(new Set()) // Track which content is being posted
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set()) // Track expanded campaigns
  const [selectedDate, setSelectedDate] = useState(() => {
    // Get date from URL params or default to today
    const urlDate = searchParams.get('date')
    if (urlDate) {
      console.log('Initializing with date from URL:', urlDate)
      return urlDate
    }
    // Use local date to avoid timezone issues
    const today = new Date()
    return today.getFullYear() + '-' + 
           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
           String(today.getDate()).padStart(2, '0')
  }) // Current date in YYYY-MM-DD format
  const [dateContent, setDateContent] = useState([]) // Content for selected date
  const [editingContent, setEditingContent] = useState(null) // Content being edited
  const [editForm, setEditForm] = useState({}) // Edit form data
  const [saving, setSaving] = useState(false) // Saving state
  const [expandedContent, setExpandedContent] = useState(null) // Content being viewed/expanded
  const [generatingMedia, setGeneratingMedia] = useState(new Set()) // Track which content is generating media
  const [generatedImages, setGeneratedImages] = useState({}) // Store generated images by content ID
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track which content is uploading image
  const [showUploadModal, setShowUploadModal] = useState(null) // Track which content is showing upload modal
  const [lightboxImage, setLightboxImage] = useState(null) // Track which image to show in lightbox
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [hoveredButton, setHoveredButton] = useState(null) // Track which button is being hovered
  const [imageLoading, setImageLoading] = useState(new Set()) // Track which images are loading
  const [availableDates, setAvailableDates] = useState([]) // Dates that have content
  const [currentDateIndex, setCurrentDateIndex] = useState(0) // Current position in available dates


  useEffect(() => {
    fetchData()
    fetchContentByDate(selectedDate)
    getAvailableDates()
  }, [])

  // Handle URL parameter changes
  useEffect(() => {
    const urlDate = searchParams.get('date')
    if (urlDate && urlDate !== selectedDate) {
      console.log('URL date changed to:', urlDate)
      setSelectedDate(urlDate)
    }
  }, [searchParams, selectedDate])

  // Update current date index when selectedDate changes
  useEffect(() => {
    if (availableDates.length > 0) {
      const currentIndex = availableDates.indexOf(selectedDate)
      setCurrentDateIndex(currentIndex >= 0 ? currentIndex : 0)
    }
  }, [selectedDate, availableDates])

  // Auto-navigate to next available date when current date has no content
  useEffect(() => {
    if (availableDates.length > 0 && !generating && !fetchingFreshData) {
      const currentIndex = availableDates.indexOf(selectedDate)
      
      // Check if current date has no content by checking dateContent and scheduledContent
      const hasContent = dateContent.length > 0 || (selectedDate === new Date().toISOString().split('T')[0] && scheduledContent.length > 0)
      
      // If current date is not in available dates or has no content, find next available date
      if (currentIndex === -1 || !hasContent) {
        const today = new Date().toISOString().split('T')[0]
        
        // First, try to find the next future date from today onwards
        let nextIndex = availableDates.findIndex(date => date > today)
        
        // If no future dates found, try to find today's date
        if (nextIndex === -1) {
          nextIndex = availableDates.findIndex(date => date === today)
        }
        
        // If still no date found, find the next available date after current date
        if (nextIndex === -1 && currentIndex !== -1) {
          nextIndex = currentIndex + 1
        }
        
        // Only navigate if we found a valid next date
        if (nextIndex >= 0 && nextIndex < availableDates.length) {
          const nextDate = availableDates[nextIndex]
          console.log('Auto-navigating to next available date:', nextDate)
          setSelectedDate(nextDate)
          setCurrentDateIndex(nextIndex)
          navigate(`/content?date=${nextDate}`)
        }
      }
    }
  }, [availableDates, dateContent.length, scheduledContent.length, selectedDate, generating, fetchingFreshData, navigate])

  // Images are now loaded immediately when content is fetched, so this useEffect is no longer needed

  useEffect(() => {
    // Only fetch content by date if not currently generating
    if (!generating) {
      fetchContentByDate(selectedDate)
    }
  }, [selectedDate, generating])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchScheduledContent(forceRefresh)
      
      console.log('Fetched content data:', result)
      console.log('Cache status:', getCacheStatus())
      
      if (result.data) {
        console.log('Content items:', result.data)
        console.log('Platform values in content:', result.data.map(item => ({ id: item.id, platform: item.platform })))
        console.log('Data source:', result.fromCache ? 'cache' : 'API')
        
        // Load images immediately for all scheduled content (with error handling)
        for (const content of result.data) {
          try {
            await fetchPostImages(content.id)
          } catch (error) {
            // Silently handle image loading errors to prevent console spam
            console.debug('Image loading failed for content:', content.id)
          }
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
    }
  }

  const fetchContentByDate = async (date) => {
    try {
      console.log('Fetching content for date:', date)
      const result = await contentAPI.getContentByDate(date)
      
      console.log('Fetched content for date:', date, result)
      
      if (result.data) {
        setDateContent(result.data)
        console.log('Date content items:', result.data)
        
        // Load images immediately for all date content (with error handling)
        for (const content of result.data) {
          try {
            await fetchPostImages(content.id)
          } catch (error) {
            // Silently handle image loading errors to prevent console spam
            console.debug('Image loading failed for content:', content.id)
          }
        }
      } else {
        setDateContent([])
      }
    } catch (error) {
      console.error('Error fetching content by date:', error)
      setDateContent([])
    }
  }

  // Get all available dates with content
  const getAvailableDates = async () => {
    try {
      const result = await contentAPI.getAllContent(1000, 0) // Get more content to find all dates
      if (result.data) {
        // Extract unique dates from content
        const dates = [...new Set(result.data.map(content => {
          const scheduledDate = content.scheduled_at || content.scheduled_date
          if (scheduledDate) {
            if (scheduledDate.includes('T')) {
              return new Date(scheduledDate).toISOString().split('T')[0]
            }
            return scheduledDate
          }
          return null
        }).filter(Boolean))].sort()
        
        setAvailableDates(dates)
        console.log('Available dates with content:', dates)
        
        // Find current date index
        const currentIndex = dates.indexOf(selectedDate)
        setCurrentDateIndex(currentIndex >= 0 ? currentIndex : 0)
      }
    } catch (error) {
      console.error('Error fetching available dates:', error)
    }
  }

  // Navigate to previous date with content
  const navigateToPreviousDate = () => {
    if (currentDateIndex > 0) {
      const prevDate = availableDates[currentDateIndex - 1]
      setSelectedDate(prevDate)
      setCurrentDateIndex(currentDateIndex - 1)
      // Update URL
      navigate(`/content?date=${prevDate}`)
    }
  }

  // Navigate to next date with content
  const navigateToNextDate = () => {
    if (currentDateIndex < availableDates.length - 1) {
      const nextDate = availableDates[currentDateIndex + 1]
      setSelectedDate(nextDate)
      setCurrentDateIndex(currentDateIndex + 1)
      // Update URL
      navigate(`/content?date=${nextDate}`)
    }
  }

  const handleProgressComplete = async () => {
    console.log('Content generation completed, fetching fresh data...')
    setShowProgress(false)
    setGenerating(false)
    setShowGenerationModal(false)
    setFetchingFreshData(true) // Start loading state
    
    // Clear cache completely to ensure fresh data
    clearCache()
    
    // Wait a moment for the backend to finish storing the content
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Fetch fresh data directly from API (bypassing cache)
    try {
      const result = await contentAPI.getScheduledContent()
      if (result.data) {
        // Update the cache with fresh data
        setScheduledContent(result.data)
        setContentDate(result.date)
        setLastFetchTime(Date.now())
        setCacheValid(true)
        
        // Also update date content if we're viewing today
        if (selectedDate === new Date().toISOString().split('T')[0]) {
          setDateContent(result.data)
        }
        
        setFetchingFreshData(false) // End loading state
        await getAvailableDates() // Refresh available dates after content generation
        showSuccess('Content Generated!', 'Your new content is ready to view.')
      }
    } catch (error) {
      console.error('Error fetching fresh content:', error)
      setFetchingFreshData(false) // End loading state
      // Fallback to page refresh if API fails
      window.location.reload()
    }
  }

  const handleGenerateContent = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      setShowGenerationModal(true)
      setFetchingFreshData(false) // Reset data fetching state
      
      const result = await contentAPI.generateContent()
      
      if (result.data) {
        // Don't set generating to false here - let the modal handle it
        // The modal will call onComplete when generation is done
        
      } else if (result.error) {
        setGenerationStatus('error')
        setShowGenerationModal(false)
        setGenerating(false)
        
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
      setShowGenerationModal(false)
      setGenerating(false)
      setGenerationMessage('An unexpected error occurred. Please try again.')
      showError('Content Generation Error', 'An unexpected error occurred. Please try again.')
    }
  }

  const handleTriggerWeekly = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      setShowGenerationModal(true)
      
      const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})()
      const response = await fetch(`${API_BASE_URL}/content/trigger-weekly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Don't set generating to false here - let the modal handle it
      } else {
        setGenerationStatus('error')
        setShowGenerationModal(false)
        setGenerating(false)
        setGenerationMessage(data.message || 'Weekly generation failed')
        showError('Weekly Generation Failed', data.message || 'Weekly generation failed')
      }
    } catch (error) {
      console.error('Error triggering weekly generation:', error)
      setGenerationStatus('error')
      setShowGenerationModal(false)
      setGenerating(false)
      setGenerationMessage('Weekly generation failed. Please try again.')
      showError('Weekly Generation Error', 'Weekly generation failed. Please try again.')
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

  // Use date-specific content if available, otherwise fall back to scheduled content
  // Only fall back to scheduled content if we're viewing today's date
  // Hide content during generation and data fetching to prevent showing old/incomplete content
  const todayStr = (() => {
    const today = new Date()
    return today.getFullYear() + '-' + 
           String(today.getMonth() + 1).padStart(2, '0') + '-' + 
           String(today.getDate()).padStart(2, '0')
  })()
  
  const contentToDisplay = (generating || fetchingFreshData)
    ? [] 
    : selectedDate === todayStr 
    ? (dateContent.length > 0 ? dateContent : scheduledContent)
    : dateContent
  
  // Images are now loaded immediately when content is fetched, so this useEffect is no longer needed
  
  const filteredContent = contentToDisplay.filter(content => {
    const matchesPlatform = filterPlatform === 'all' || content.platform === filterPlatform
    return matchesPlatform
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

  // Remove the early return for loading - we'll handle it in the main content area

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
      } else if (content.platform.toLowerCase() === 'linkedin') {
        await postToLinkedIn(content)
      } else if (content.platform.toLowerCase() === 'youtube') {
        await postToYouTube(content)
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
      
      // Get the image URL if available
      let imageUrl = ''
      if (generatedImages[content.id] && generatedImages[content.id].image_url) {
        imageUrl = generatedImages[content.id].image_url
        console.log('📸 Including image in Facebook post:', imageUrl)
      }
      
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
          content_id: content.id,
          image_url: imageUrl
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
    let oauthError = null
    
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available
      let imageUrl = ''
      if (generatedImages[content.id] && generatedImages[content.id].image_url) {
        imageUrl = generatedImages[content.id].image_url
        console.log('📸 Including image in Instagram post:', imageUrl)
      }
      
      const postData = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.id,
        image_url: imageUrl
      }
      
      // Try OAuth method first (original endpoint)
      try {
        console.log('🔄 Trying Instagram OAuth posting...')
        const response = await fetch(`${API_BASE_URL}/connections/instagram/post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(postData)
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Instagram OAuth post successful:', result)
          showSuccess(`Successfully posted to Instagram!`)
          updateContentInCache(content.id, { status: 'published' })
          return
        } else {
          const errorText = await response.text()
          console.log('❌ Instagram OAuth failed:', response.status, errorText)
          oauthError = new Error(`OAuth method failed: ${response.status}: ${errorText}`)
          // Continue to try token method
        }
      } catch (error) {
        console.log('❌ Instagram OAuth error:', error)
        oauthError = error
        // Continue to try token method
      }
      
      // Try token method (new endpoint) - but this will fail for Instagram Basic Display API
      try {
        console.log('🔄 Trying Instagram token posting...')
        const response = await fetch(`${API_BASE_URL}/api/social-media/instagram/post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(postData)
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Instagram token post successful:', result)
          showSuccess(`Successfully posted to Instagram!`)
          updateContentInCache(content.id, { status: 'published' })
          return
        } else {
          const errorText = await response.text()
          const errorData = JSON.parse(errorText)
          
          // Check if it's the Basic Display API limitation
          if (errorData.detail && errorData.detail.includes('Basic Display API does not support posting')) {
            throw new Error('Instagram Basic Display API (token method) is read-only and cannot post content. Please use OAuth connection method for posting to Instagram.')
          }
          
          throw new Error(`Token method failed: ${response.status}: ${errorText}`)
        }
      } catch (tokenError) {
        console.log('❌ Instagram token error:', tokenError)
        
        // If OAuth failed and token method also failed, show appropriate message
        if (oauthError) {
          throw new Error(`Instagram posting failed. OAuth method: ${oauthError.message}. Token method: ${tokenError.message}`)
        } else {
          throw tokenError
        }
      }
      
    } catch (error) {
      console.error('Error posting to Instagram:', error)
      throw error
    }
  }

  const postToLinkedIn = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available
      let imageUrl = ''
      if (generatedImages[content.id] && generatedImages[content.id].image_url) {
        imageUrl = generatedImages[content.id].image_url
        console.log('📸 Including image in LinkedIn post:', imageUrl)
      }
      
      const postData = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.id,
        image_url: imageUrl,
        visibility: content.linkedin_visibility || 'PUBLIC' // Use content setting or default to PUBLIC
      }
      
      console.log('🔄 Posting to LinkedIn...')
      const response = await fetch(`${API_BASE_URL}/connections/linkedin/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ LinkedIn post successful:', result)
        showSuccess(`Successfully posted to LinkedIn!`)
        updateContentInCache(content.id, { status: 'published' })
      } else {
        const errorText = await response.text()
        console.error('❌ LinkedIn post failed:', response.status, errorText)
        throw new Error(`LinkedIn posting failed: ${response.status}: ${errorText}`)
      }
      
    } catch (error) {
      console.error('Error posting to LinkedIn:', error)
      throw error
    }
  }

  const postToYouTube = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available
      let imageUrl = ''
      if (generatedImages[content.id] && generatedImages[content.id].image_url) {
        imageUrl = generatedImages[content.id].image_url
        console.log('📸 Including image in YouTube post:', imageUrl)
      }
      
      const postData = {
        title: content.title,
        description: content.content,
        image_url: imageUrl,
        content_id: content.id
      }
      
      console.log('🔄 Posting to YouTube...')
      const response = await fetch(`${API_BASE_URL}/connections/youtube/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ YouTube post successful:', result)
        showSuccess(`Successfully posted to YouTube!`)
        updateContentInCache(content.id, { status: 'published' })
      } else {
        const errorText = await response.text()
        console.error('❌ YouTube post failed:', response.status, errorText)
        throw new Error(`YouTube posting failed: ${response.status}: ${errorText}`)
      }
      
    } catch (error) {
      console.error('Error posting to YouTube:', error)
      throw error
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const handleEditContent = (content) => {
    setEditingContent(content)
    setEditForm({
      id: content.id, // Add the ID to the edit form
      title: content.title || '',
      content: content.content || '',
      hashtags: content.hashtags ? content.hashtags.join(', ') : '',
      scheduled_date: content.scheduled_at ? content.scheduled_at.split('T')[0] : '',
      scheduled_time: content.scheduled_at ? content.scheduled_at.split('T')[1] : '12:00',
      status: content.status || 'draft'
    })
  }

  const handleSaveEdit = async () => {
    try {
      setSaving(true)
      const authToken = await getAuthToken()
      
      // Convert hashtags string back to array
      const hashtagsArray = editForm.hashtags 
        ? editForm.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : []
      
      // Prepare update data
      const updateData = {
        title: editForm.title,
        content: editForm.content,
        hashtags: hashtagsArray,
        scheduled_date: editForm.scheduled_date,
        scheduled_time: editForm.scheduled_time,
        status: editForm.status
      }
      
      const response = await fetch(`${API_BASE_URL}/content/update/${editingContent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Content update result:', result)
      
      showSuccess('Content updated successfully!')
      
      // Update the content in the local state
      const updatedContent = {
        ...editingContent,
        ...updateData,
        scheduled_at: `${editForm.scheduled_date}T${editForm.scheduled_time}`
      }
      
      // Update in dateContent if it exists there
      if (dateContent.some(item => item.id === editingContent.id)) {
        setDateContent(prev => prev.map(item => 
          item.id === editingContent.id ? updatedContent : item
        ))
      }
      
      // Update in scheduledContent if it exists there
      if (scheduledContent.some(item => item.id === editingContent.id)) {
        updateContentInCache(editingContent.id, updateData)
      }
      
      setEditingContent(null)
      setEditForm({})
      
    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingContent(null)
    setEditForm({})
    setSelectedFile(null)
  }

  const handleViewContent = (content) => {
    setExpandedContent(expandedContent?.id === content.id ? null : content)
  }

  const fetchPostImages = async (postId) => {
    try {
      const result = await mediaService.getPostImages(postId)
      
      if (result.images && result.images.length > 0) {
        // Store the latest image for this post
        const latestImage = result.images[0] // Assuming we want the latest one
        
        setGeneratedImages(prev => {
          const newImages = {
            ...prev,
            [postId]: {
              image_url: latestImage.image_url,
              cost: latestImage.generation_cost,
              generation_time: latestImage.generation_time,
              generated_at: latestImage.created_at,
              is_approved: latestImage.is_approved
            }
          }
          return newImages
        })
      }
    } catch (error) {
      // Only log errors that are not 404 (Post not found) to reduce console spam
      if (!error.message?.includes('404') && !error.message?.includes('Post not found')) {
        console.error('Error fetching post images:', error)
      }
    }
  }

  const handleGenerateMedia = async (content) => {
    try {
      // Add to generating set
      setGeneratingMedia(prev => new Set(prev).add(content.id))
      
      const result = await mediaService.generateMedia(content.id)
      
      if (result.success) {
        console.log('🎨 Generation successful, fetching images for content:', content.id)
        console.log('🎨 Generation result:', result)
        
        // Fetch the generated image from Supabase
        await fetchPostImages(content.id)
        
        // Check what was fetched
        console.log('🖼️ Generated images after fetch:', generatedImages)
        
        showSuccess('Media generated successfully!', `Image created in ${result.generation_time}s`)
      } else {
        throw new Error(result.error || 'Failed to generate media')
      }
      
    } catch (error) {
      console.error('Error generating media:', error)
      
      // Provide more helpful error messages
      let errorMessage = error.message
      if (error.message.includes('OpenAI API key not configured')) {
        errorMessage = 'OpenAI API key not configured. Please contact support to set up image generation.'
      } else if (error.message.includes('quota exceeded')) {
        errorMessage = 'OpenAI API quota exceeded. Please check billing settings.'
      } else if (error.message.includes('Invalid OpenAI API key')) {
        errorMessage = 'Invalid OpenAI API key. Please contact support.'
      }
      
      showError('Failed to generate media', errorMessage)
    } finally {
      // Remove from generating set
      setGeneratingMedia(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
        return newSet
      })
    }
  }

  const handleApproveImage = async (postId) => {
    try {
      // Find the image ID for this post
      const result = await mediaService.getPostImages(postId)
      if (result.images && result.images.length > 0) {
        const imageId = result.images[0].id
        await mediaService.approveImage(imageId)
        
        // Update local state
        setGeneratedImages(prev => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            is_approved: true
          }
        }))
        
        showSuccess('Image approved successfully!')
      }
    } catch (error) {
      console.error('Error approving image:', error)
      showError('Failed to approve image', error.message)
    }
  }

  const handleApprovePost = async (contentId) => {
    try {
      const result = await contentAPI.updateContentStatus(contentId, 'scheduled')
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: 'scheduled' })
        
        // Close the expanded content
        setExpandedContent(null)
        
        // Show success message immediately
        showSuccess('Post approved and scheduled successfully!')
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error approving post:', error)
      showError('Failed to approve post', error.message)
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError('Invalid file type', 'Please select an image file')
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showError('File too large', 'Please select an image smaller than 10MB')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleOpenUploadModal = (contentId) => {
    setShowUploadModal(contentId)
    setSelectedFile(null)
  }

  const handleUploadImage = async (postId) => {
    console.log('🔍 Upload function called with postId:', postId)
    console.log('🔍 editForm:', editForm)
    console.log('🔍 API_BASE_URL:', API_BASE_URL)
    console.log('🔍 Selected file:', selectedFile)
    
    if (!selectedFile) {
      showError('No file selected', 'Please select an image to upload')
      return
    }

    if (!postId) {
      showError('No post ID', 'Cannot upload image without post ID')
      return
    }

    try {
      setUploadingImage(prev => new Set(prev).add(postId))
      
      // Use backend API for upload (bypasses RLS issues)
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('post_id', postId)
      
      console.log('🔍 Uploading via backend API to:', `${API_BASE_URL}/media/upload-image`)
      
      // Test API connectivity first
      try {
        const healthCheck = await fetch(`${API_BASE_URL}/health`, { method: 'GET' })
        console.log('🔍 API health check status:', healthCheck.status)
      } catch (healthError) {
        console.warn('🔍 API health check failed:', healthError.message)
      }
      
      const authToken = await getAuthToken()
      console.log('🔍 Auth token available:', !!authToken)
      
      const response = await fetch(`${API_BASE_URL}/media/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })
      
      console.log('🔍 Response status:', response.status)
      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()))
      
      let result
      try {
        result = await response.json()
        console.log('🔍 Backend upload result:', result)
      } catch (jsonError) {
        console.error('🔍 Failed to parse JSON response:', jsonError)
        const textResponse = await response.text()
        console.error('🔍 Raw response:', textResponse)
        throw new Error(`Server returned invalid JSON: ${textResponse}`)
      }
      
      if (!response.ok) {
        throw new Error(result.detail || result.message || `HTTP ${response.status}: Upload failed`)
      }
      
      if (!result.success) {
        throw new Error(result.message || 'Upload failed')
      }
      
      // Update local state
      setGeneratedImages(prev => ({
        ...prev,
        [postId]: {
          image_url: result.image_url,
          cost: 0,
          generation_time: 0,
          generated_at: new Date().toISOString(),
          is_approved: true
        }
      }))
      
      // Close modal and reset
      setShowUploadModal(null)
      setSelectedFile(null)
      
      showSuccess('Image uploaded successfully!', 'Your custom image has been added to the post')
      
    } catch (error) {
      console.error('Error uploading image:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.'
      } else if (error.message.includes('404')) {
        errorMessage = 'API endpoint not found. Please contact support.'
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later or contact support.'
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.'
      }
      
      showError('Failed to upload image', errorMessage)
    } finally {
      setUploadingImage(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  // Images are now stored in Supabase storage for faster loading
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    return imageUrl
  }

  // Get thumbnail URL for faster loading
  const getThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Add resize transformation to create a smaller, faster-loading thumbnail
      // Using 50x50 with 60% quality for maximum speed
      return `${imageUrl}${separator}width=50&height=50&resize=cover&quality=60&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get extra small thumbnail for collapsed cards (ultra fast loading)
  const getSmallThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for very small thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 30x30 with 40% quality for ultra fast loading in collapsed cards
      return `${imageUrl}${separator}width=30&height=30&resize=cover&quality=40&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get medium thumbnail for expanded cards (balanced size and quality)
  const getMediumThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for medium thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 200x200 with 70% quality for good balance of size and quality
      return `${imageUrl}${separator}width=200&height=200&resize=cover&quality=70&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get full-size image URL for detailed viewing
  const getFullSizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL, return the original URL for full quality
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/')) {
      // Return original URL without transformations for full quality
      return imageUrl
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Handle image load events
  const handleImageLoad = (contentId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(contentId)
      return newSet
    })
  }

  const handleImageError = (contentId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(contentId)
      return newSet
    })
  }

  // Start loading when image is first displayed
  const startImageLoading = (contentId) => {
    setImageLoading(prev => new Set(prev).add(contentId))
  }

  // Handle image click to open lightbox
  const handleImageClick = (imageUrl, contentTitle) => {
    setLightboxImage({
      url: imageUrl,
      title: contentTitle
    })
  }

  // Close lightbox
  const closeLightbox = () => {
    setLightboxImage(null)
  }

  // Handle keyboard events for lightbox
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && lightboxImage) {
        closeLightbox()
      }
    }

    if (lightboxImage) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [lightboxImage])

  return (
    <div className="min-h-screen bg-white">
      {/* Content Generation Modal */}
      <ContentGenerationModal 
        isVisible={showGenerationModal} 
        onClose={() => {
          setShowGenerationModal(false)
          setGenerating(false)
          setFetchingFreshData(false)
          setGenerationMessage('')
          setGenerationStatus(null)
        }}
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
                {/* Content Date Header */}
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">
                        {selectedDate === new Date().toISOString().split('T')[0] 
                          ? "Today's Content" 
                          : new Date(selectedDate).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })
                        }
                      </h1>
                      <p className="text-sm text-gray-600">
                        {contentToDisplay.length} {contentToDisplay.length === 1 ? 'post' : 'posts'}
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
                  disabled={generating || fetchingFreshData}
                  className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50"
                >
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : fetchingFreshData ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>
                    {generating ? 'Generating...' : fetchingFreshData ? 'Loading...' : 'Generate Content'}
                  </span>
                </button>
                
                
                {/* View Controls */}
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

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
          {loading ? (
            <MainContentLoader message="Loading your content..." />
          ) : (
            <>
              {/* Status Message - Only show error messages */}
          {generationStatus === 'error' && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
              <div className="flex items-center">
                <RefreshCw className="w-5 h-5 mr-2" />
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedDate === new Date().toISOString().split('T')[0] 
                    ? "No content for today" 
                    : `No content for ${new Date(selectedDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}`
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {generating 
                    ? "Content generation in progress. Please wait..."
                    : fetchingFreshData
                    ? "Loading your new content..."
                    : selectedDate === new Date().toISOString().split('T')[0] 
                    ? "Generate content to see it displayed here" 
                    : "This date has no content. Use the navigation arrows to find dates with content."
                  }
                </p>
                <button
                  onClick={handleGenerateContent}
                  disabled={generating || fetchingFreshData}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Generating Content...</span>
                    </>
                  ) : fetchingFreshData ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading Content...</span>
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
              <div className={`grid gap-6 items-start ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'}`}>
                {filteredContent.map((content) => {
                  const theme = getPlatformCardTheme(content.platform)
                  console.log('Content platform:', content.platform, 'Theme:', theme)
                  return (
                    <div 
                      key={content.id} 
                      onClick={() => handleViewContent(content)}
                      className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer self-start`}
                    >
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
                    
                    {expandedContent?.id === content.id ? (
                      <div className="mb-4">
                        {/* Media Display - Above Content (Social Media Style) */}
                        {generatedImages[content.id] && (
                          <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <h6 className="text-sm font-medium text-purple-800">Media</h6>
                                {generatedImages[content.id].is_approved ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Approved</span>
                                ) : (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Pending</span>
                                )}
                              </div>
                            </div>
                            <div className="relative w-full h-48 bg-gray-200 rounded-lg overflow-hidden mb-2">
                              {imageLoading.has(content.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                              )}
                              <img 
                                src={getMediumThumbnailUrl(generatedImages[content.id].image_url)} 
                                alt="Generated content thumbnail" 
                                className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                loading="lazy"
                                onLoad={() => handleImageLoad(content.id)}
                                onError={() => handleImageError(content.id)}
                                onLoadStart={() => startImageLoading(content.id)}
                                onClick={() => handleImageClick(getFullSizeImageUrl(generatedImages[content.id].image_url), content.title)}
                                style={{
                                  opacity: imageLoading.has(content.id) ? 0 : 1,
                                  filter: imageLoading.has(content.id) ? 'blur(8px)' : 'blur(0px)',
                                  transform: imageLoading.has(content.id) ? 'scale(1.05)' : 'scale(1)',
                                  transition: 'all 0.6s ease-in-out'
                                }}
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              {!generatedImages[content.id].is_approved && (
                                <button
                                  onClick={() => handleApproveImage(content.id)}
                                  className="text-xs bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors"
                                >
                                  Approve Image
                                </button>
                              )}
                              <button
                                onClick={() => handleGenerateMedia(content)}
                                disabled={generatingMedia.has(content.id)}
                                className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded hover:opacity-90 transition-colors disabled:opacity-50 flex items-center space-x-1"
                              >
                                {generatingMedia.has(content.id) ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Regenerating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-3 h-3" />
                                    <span>Regenerate</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{content.content}</p>
                        
                        {/* Approve Post Button - only show for draft status in expanded view */}
                        {content.status === 'draft' && (
                          <div className="mb-4">
                            <button
                              onClick={() => handleApprovePost(content.id)}
                              className="flex items-center space-x-2 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span>Approve Post</span>
                            </button>
                          </div>
                        )}
                        
                        {/* Expanded Details */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-medium text-gray-600">Scheduled:</span>
                              <p className="text-gray-800">{formatDate(content.scheduled_at)} at {formatTime(content.scheduled_at.split('T')[1])}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Status:</span>
                              <p className="text-gray-800 capitalize">{content.status}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Platform:</span>
                              <p className="text-gray-800">{content.platform}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Post Type:</span>
                              <p className="text-gray-800 capitalize">{content.post_type || 'text'}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Hashtags - Only in expanded view */}
                    {content.hashtags && content.hashtags.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-600">Hashtags</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                        {content.hashtags.map((tag, index) => (
                          <span key={index} className={`text-xs ${theme.accent} ${theme.text} px-2 py-1 rounded-lg`}>
                            #{tag}
                          </span>
                        ))}
                            </div>
                      </div>
                    )}
                        
                        <button
                          onClick={() => setExpandedContent(null)}
                          className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                        >
                          Show less
                        </button>
                      </div>
                    ) : (
                      <div>
                        {/* Media Placeholder - Always Show (Above Content) */}
                        <div className="mb-3 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-medium text-purple-800">Media</span>
                              {generatedImages[content.id] && (
                                generatedImages[content.id].is_approved ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">✓</span>
                                ) : (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">Pending</span>
                                )
                              )}
                            </div>
                          </div>
                          <div className="relative w-full aspect-square bg-gray-200 rounded overflow-hidden">
                            {generatedImages[content.id] ? (
                              <>
                                {/* Show placeholder while loading */}
                                {imageLoading.has(content.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                    <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
                                  </div>
                                )}
                                {generatedImages[content.id].image_url ? (
                                  (() => {
                                    const thumbnailUrl = getSmallThumbnailUrl(generatedImages[content.id].image_url)
                                    
                                    
                                    // If thumbnail URL is null (non-generated folder URL), show generate button
                                    if (!thumbnailUrl) {
                                      return (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleGenerateMedia(content.id)
                                            }}
                                            className="px-3 py-2 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 transition-colors"
                                          >
                                            Generate Image with AI
                                          </button>
                                        </div>
                                      )
                                    }
                                    
                                    // Show image if we have a valid Supabase thumbnail URL
                                    return (
                                      <img 
                                        src={thumbnailUrl} 
                                        alt="Content image" 
                                        className="w-full h-full object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                        loading="eager"
                                        onClick={() => handleImageClick(getFullSizeImageUrl(generatedImages[content.id].image_url), content.title)}
                                        onLoad={() => {
                                          console.log('✅ Image loaded for content:', content.id)
                                          handleImageLoad(content.id)
                                        }}
                                        onError={(e) => {
                                          console.error('❌ Image failed to load for content:', content.id)
                                          console.error('❌ Failed URL:', thumbnailUrl)
                                          handleImageError(content.id)
                                        }}
                                        onLoadStart={() => startImageLoading(content.id)}
                                        style={{
                                          opacity: imageLoading.has(content.id) ? 0 : 1,
                                          filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                          transform: imageLoading.has(content.id) ? 'scale(1.1)' : 'scale(1)',
                                          transition: 'all 0.5s ease-in-out'
                                        }}
                                      />
                                    )
                                  })()
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500 text-xs">
                                    No image URL
                                  </div>
                                )}
                              </>
                            ) : (
                              /* Generate Image Button */
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateMedia(content)
                                  }}
                                  disabled={generatingMedia.has(content.id)}
                                  className="flex flex-col items-center space-y-2 p-4 text-gray-600 hover:text-purple-600 transition-colors disabled:opacity-50"
                                >
                                  {generatingMedia.has(content.id) ? (
                                    <>
                                      <Loader2 className="w-8 h-8 animate-spin" />
                                      <span className="text-xs font-medium">Generating...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 className="w-8 h-8" />
                                      <span className="text-xs font-medium">Generate Image with AI</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-gray-700 text-sm mb-4 line-clamp-3">{content.content}</p>
                        
                        {content.content.length > 150 && (
                          <button
                            onClick={() => handleViewContent(content)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Read more
                          </button>
                        )}
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
                      <div className="flex items-center space-x-2 relative">
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditContent(content)
                            }}
                            onMouseEnter={() => setHoveredButton(`${content.id}-edit`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            className={`p-2 ${theme.accent} hover:opacity-80 rounded-lg transition-all duration-200 ${theme.text}`}
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          {hoveredButton === `${content.id}-edit` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                              Edit Post
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleGenerateMedia(content)
                            }}
                            onMouseEnter={() => setHoveredButton(`${content.id}-generate`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            disabled={generatingMedia.has(content.id)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              generatingMedia.has(content.id)
                                ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                            }`}
                          >
                            {generatingMedia.has(content.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4" />
                            )}
                          </button>
                          {hoveredButton === `${content.id}-generate` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                              {generatingMedia.has(content.id) ? 'Generating Image with AI...' : 'Generate Image with AI'}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          )}
                        </div>
                        
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePostContent(content)
                            }}
                            onMouseEnter={() => setHoveredButton(`${content.id}-post`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            disabled={content.status === 'published' || postingContent.has(content.id)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              content.status === 'published' 
                                ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                                : postingContent.has(content.id)
                                ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                : `${theme.iconBg} text-white hover:opacity-90`
                            }`}
                          >
                            {postingContent.has(content.id) ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Share2 className="w-4 h-4" />
                            )}
                          </button>
                          {hoveredButton === `${content.id}-post` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                              {content.status === 'published' ? 'Already Published' : postingContent.has(content.id) ? 'Posting...' : `Post on ${content.platform}`}
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>

            </>
          )}
        </div>

        {/* Footer Navigation - Only show if there are multiple dates with content */}
        {availableDates.length > 1 && (
          <div className="bg-white border-t border-gray-200 shadow-lg">
            <div className="flex items-center justify-center space-x-4 py-4 px-6">
              <button
                onClick={navigateToPreviousDate}
                disabled={currentDateIndex === 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  currentDateIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-pink-300 hover:text-pink-600 shadow-sm hover:shadow-md'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Previous</span>
              </button>

              <div className="flex items-center space-x-2 px-4 py-2 bg-gray-50 rounded-lg">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  {currentDateIndex + 1} of {availableDates.length}
                </span>
                <span className="text-xs text-gray-500">
                  ({new Date(selectedDate).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })})
                </span>
              </div>

              <button
                onClick={navigateToNextDate}
                disabled={currentDateIndex === availableDates.length - 1}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  currentDateIndex === availableDates.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-pink-300 hover:text-pink-600 shadow-sm hover:shadow-md'
                }`}
              >
                <span className="text-sm font-medium">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Content</h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Enter content title"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content
                  </label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Enter content text"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hashtags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.hashtags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Enter hashtags separated by commas"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Scheduled Time
                    </label>
                    <input
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Image Upload and Status - Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Image Upload Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Replace Image
                    </label>
                    
                    {/* Current Image Display */}
                    {generatedImages[editForm.id] && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Current Image:</span>
                          <span className="text-xs text-gray-500">
                            {generatedImages[editForm.id].is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                          {imageLoading.has(editForm.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          )}
                          <img 
                            src={getMediumThumbnailUrl(generatedImages[editForm.id].image_url)} 
                            alt="Current content thumbnail" 
                            className="w-full h-32 object-cover rounded-lg"
                            loading="lazy"
                            onLoad={() => handleImageLoad(editForm.id)}
                            onError={() => handleImageError(editForm.id)}
                            onLoadStart={() => startImageLoading(editForm.id)}
                            style={{
                              opacity: imageLoading.has(editForm.id) ? 0 : 1,
                              filter: imageLoading.has(editForm.id) ? 'blur(8px)' : 'blur(0px)',
                              transform: imageLoading.has(editForm.id) ? 'scale(1.05)' : 'scale(1)',
                              transition: 'all 0.6s ease-in-out'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* File Upload */}
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500">
                        Supported formats: JPG, PNG, GIF. Max size: 10MB
                      </p>
                      
                      {/* Selected File Preview */}
                      {selectedFile && (
                        <div className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center space-x-3">
                            <Image className="w-6 h-6 text-blue-500" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                              <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Upload Button */}
                      {selectedFile && (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              console.log('🔍 Upload button clicked, editForm.id:', editForm.id)
                              handleUploadImage(editForm.id)
                            }}
                            disabled={uploadingImage.has(editForm.id)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
                          >
                            {uploadingImage.has(editForm.id) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                <span>Upload New Image</span>
                              </>
                            )}
                          </button>
                          
                          {/* Debug info */}
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            <div>API URL: {API_BASE_URL}</div>
                            <div>Post ID: {editForm.id}</div>
                            <div>File: {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)}KB)</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-8"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl max-h-[80vh] w-full flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute -top-2 -right-2 z-10 bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Image Container */}
            <div className="relative w-full h-full max-w-2xl max-h-[70vh] bg-white rounded-lg shadow-2xl overflow-hidden">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="w-full h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Image title */}
              {lightboxImage.title && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-4">
                  <h3 className="text-lg font-medium">{lightboxImage.title}</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ContentDashboard
