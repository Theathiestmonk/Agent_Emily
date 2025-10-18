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
import MobileNavigation from './MobileNavigation'
import CustomContentChatbot from './CustomContentChatbot'
import ChatbotImageEditor from './ChatbotImageEditor'
import MediaGenerationCelebration from './MediaGenerationCelebration'

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
  Video,
  FileText, 
  Hash, 
  Clock, 
  TrendingUp, 
  Plus,
  RefreshCw,
  Edit,
  Edit3,
  Share2,
  Download,
  Filter,
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
  Youtube,
  Building2,
  Wand2,
  Loader2,
  Upload,
  X,
  CheckCircle,
  Trash2,
  AlertTriangle
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
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
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
  const [showAddMenu, setShowAddMenu] = useState(false) // Show add button dropdown menu

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAddMenu && !event.target.closest('.add-menu-container')) {
        setShowAddMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddMenu])
  const [generatingMedia, setGeneratingMedia] = useState(new Set()) // Track which content is generating media
  const [generatedImages, setGeneratedImages] = useState({}) // Store generated images by content ID
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track which content is uploading image
  const [showUploadModal, setShowUploadModal] = useState(null) // Track which content is showing upload modal
  const [lightboxImage, setLightboxImage] = useState(null) // Track which image to show in lightbox
  const [lightboxLoading, setLightboxLoading] = useState(false) // Track lightbox image loading state
  const [showScrollArrow, setShowScrollArrow] = useState(true) // Track if scroll arrow should be visible
  const [showImageEditor, setShowImageEditor] = useState(false) // Track if image editor is open
  const [imageEditorData, setImageEditorData] = useState(null) // Data for image editor
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [hoveredButton, setHoveredButton] = useState(null) // Track which button is being hovered
  const [imageLoading, setImageLoading] = useState(new Set()) // Track which images are loading
  const [availableDates, setAvailableDates] = useState([]) // Dates that have content
  const [currentDateIndex, setCurrentDateIndex] = useState(0) // Current position in available dates
  const [showCustomContentChatbot, setShowCustomContentChatbot] = useState(false) // Custom content chatbot modal
  const [deleteConfirm, setDeleteConfirm] = useState(null) // Content to delete confirmation
  const [deletingContent, setDeletingContent] = useState(new Set()) // Track which content is being deleted
  const [postNotification, setPostNotification] = useState(null) // Post success notification
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null) // Track which content has status dropdown open
  const [updatingStatus, setUpdatingStatus] = useState(new Set()) // Track which content is updating status
  const [showCelebration, setShowCelebration] = useState(false) // Show celebration popup
  const [celebrationData, setCelebrationData] = useState(null) // Celebration data (imageUrl, generationTime)


  useEffect(() => {
    fetchData()
    fetchContentByDate(selectedDate)
    getAvailableDates()
  }, [])

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownOpen && !event.target.closest('.status-dropdown')) {
        setStatusDropdownOpen(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  // Handle URL parameter changes
  useEffect(() => {
    const urlDate = searchParams.get('date')
    if (urlDate && urlDate !== selectedDate) {
      console.log('URL date changed to:', urlDate)
      setSelectedDate(urlDate)
      // Explicitly fetch content for the new date from URL
      fetchContentByDate(urlDate)
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
  // BUT only if the user is not on today's date (allow users to stay on today to generate content)
  useEffect(() => {
    if (availableDates.length > 0 && !generating && !fetchingFreshData) {
      const currentIndex = availableDates.indexOf(selectedDate)
      const today = new Date().toISOString().split('T')[0]
      
      // Check if current date has no content by checking dateContent and scheduledContent
      const hasContent = dateContent.length > 0 || (selectedDate === today && scheduledContent.length > 0)
      
      // Only auto-navigate if:
      // 1. Current date is not in available dates AND it's not today
      // 2. Current date has no content AND it's not today (allow users to stay on today to generate content)
      const shouldAutoNavigate = (currentIndex === -1 && selectedDate !== today) || (!hasContent && selectedDate !== today)
      
      if (shouldAutoNavigate) {
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
          // Explicitly fetch content for the new date
          fetchContentByDate(nextDate)
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
        
        // Refresh available dates after content is loaded
        await getAvailableDates()
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
        
        // Refresh available dates after fetching date content
        await getAvailableDates()
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
      console.log('getAvailableDates - Fetched content:', result.data?.length, 'items')
      
      const allDates = new Set()
      
      if (result.data) {
        // Extract unique dates from content
        result.data.forEach(content => {
          const scheduledDate = content.scheduled_at || content.scheduled_date
          if (scheduledDate) {
            if (scheduledDate.includes('T')) {
              allDates.add(new Date(scheduledDate).toISOString().split('T')[0])
            } else {
              allDates.add(scheduledDate)
            }
          }
          
          // Also check created_at for content that might not have scheduled dates
          if (content.created_at) {
            allDates.add(new Date(content.created_at).toISOString().split('T')[0])
          }
        })
      }
      
      // Also include today's date if there's scheduled content for today
      const today = new Date().toISOString().split('T')[0]
      if (scheduledContent.length > 0) {
        allDates.add(today)
      }
      
      // Also include today's date if there's any content for today (from dateContent)
      if (dateContent.length > 0) {
        allDates.add(today)
      }
      
      // Convert to sorted array
      const dates = Array.from(allDates).sort()
        
        setAvailableDates(dates)
        console.log('Available dates with content:', dates)
      console.log('Scheduled content length:', scheduledContent.length)
      console.log('Date content length:', dateContent.length)
      console.log('Total unique dates found:', dates.length)
        
        // Find current date index
        const currentIndex = dates.indexOf(selectedDate)
        setCurrentDateIndex(currentIndex >= 0 ? currentIndex : 0)
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
      // Explicitly fetch content for the new date
      fetchContentByDate(prevDate)
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
      // Explicitly fetch content for the new date
      fetchContentByDate(nextDate)
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

  const handleGenerateContent = () => {
    setShowConfirmationModal(true)
  }

  const handleConfirmGeneration = async () => {
    setShowConfirmationModal(false)
    
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

  // Debug logging for content display
  console.log('Content Dashboard Debug:', {
    selectedDate,
    todayStr,
    isToday: selectedDate === todayStr,
    dateContentLength: dateContent.length,
    scheduledContentLength: scheduledContent.length,
    contentToDisplayLength: contentToDisplay.length,
    generating,
    fetchingFreshData
  })
  
  // Images are now loaded immediately when content is fetched, so this useEffect is no longer needed
  
  const filteredContent = contentToDisplay.filter(content => {
    const matchesPlatform = filterPlatform === 'all' || content.platform === filterPlatform
    return matchesPlatform
  })

  const getPlatformIcon = (platform) => {
    // Normalize platform name to lowercase for consistent matching
    const normalizedPlatform = platform?.toLowerCase()?.trim()
    
    const icons = {
      facebook: Facebook,
      instagram: Instagram,
      linkedin: Linkedin,
      twitter: X,
      'twitter/x': X,
      'x': X,
      tiktok: 'custom', // Special case for TikTok
      youtube: Youtube,
      'google-business': Building2,
      'google-my-business': Building2,
      'google business profile': Building2,
      'google business': Building2,
      unknown: 'custom' // Special case for unknown
    }
    
    // Debug log to see what platform values we're getting
    console.log('Platform icon requested for:', platform, 'normalized to:', normalizedPlatform)
    console.log('Available icon keys:', Object.keys(icons))
    
    let Icon = icons[normalizedPlatform]
    console.log('Icon found for', normalizedPlatform, ':', Icon)
    
    // Try alternative variations for Twitter/X
    if (!Icon && (normalizedPlatform.includes('twitter') || normalizedPlatform.includes('x'))) {
      console.log('Trying alternative Twitter/X variations...')
      if (normalizedPlatform.includes('twitter')) {
        Icon = icons['twitter'] || icons['twitter/x'] || icons['x']
      } else if (normalizedPlatform.includes('x')) {
        Icon = icons['x'] || icons['twitter'] || icons['twitter/x']
      }
      console.log('Alternative icon found:', Icon)
    }
    
    // Try alternative variations for Google Business
    if (!Icon && (normalizedPlatform.includes('google') && normalizedPlatform.includes('business'))) {
      console.log('Trying alternative Google Business variations...')
      Icon = icons['google business profile'] || icons['google business'] || icons['google-business'] || icons['google-my-business']
      console.log('Alternative Google Business icon found:', Icon)
    }
    
    if (Icon) {
      // Handle custom cases
      if (Icon === 'custom') {
        if (normalizedPlatform === 'tiktok') {
          return <div className="w-5 h-5 bg-black rounded text-white flex items-center justify-center text-xs font-bold">TT</div>
        }
        if (normalizedPlatform === 'unknown') {
          return <div className="w-5 h-5 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
        }
      }
      // Handle Lucide React components
      console.log('Rendering Lucide icon:', Icon, 'for platform:', normalizedPlatform)
      return <Icon className="w-5 h-5" />
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
      twitter: 'from-gray-800 to-black',
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
      'google business profile': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google-business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google-my-business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      }
    }
    
    let theme = themes[normalizedPlatform]
    
    // Try alternative variations for Google Business
    if (!theme && (normalizedPlatform.includes('google') && normalizedPlatform.includes('business'))) {
      console.log('Trying alternative Google Business theme variations...')
      theme = themes['google business profile'] || themes['google business'] || themes['google-business'] || themes['google-my-business']
      console.log('Alternative Google Business theme found:', theme)
    }
    
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
      
      // Show beautiful notification with post URL if available
      showPostNotification('Facebook', result.post_url || result.url)
      
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
      
      // Instagram requires an image - check if we have one
      if (!imageUrl) {
        throw new Error('Instagram requires an image to post content. Please click the "Generate Media" button to create an image for this post first.')
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
          // Show beautiful notification with post URL if available
          showPostNotification('Instagram', result.post_url || result.url)
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
          // Check if it's a connection issue
          if (oauthError.message.includes('No active Instagram connection found') || 
              tokenError.message.includes('No active Instagram connection found')) {
            throw new Error('Instagram account not connected. Please go to Settings > Connections and connect your Instagram account first.')
          } else if (oauthError.message.includes('image_url is required')) {
            throw new Error('Instagram requires an image to post content. Please click the "Generate Media" button to create an image for this post first.')
          } else {
            throw new Error(`Instagram posting failed: ${oauthError.message}`)
          }
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
        // Show beautiful notification with post URL if available
        showPostNotification('LinkedIn', result.post_url || result.url)
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
        // Show beautiful notification with post URL if available
        showPostNotification('YouTube', result.post_url || result.url)
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
        
        // Use the image URL directly from the result, not from state
        const imageUrl = result.image_url
        console.log('🖼️ Image URL from result:', imageUrl)
        
        if (imageUrl) {
          setCelebrationData({
            imageUrl: imageUrl,
            generationTime: result.generation_time,
            generationModel: result.generation_model,
            generationService: result.generation_service
          })
          setShowCelebration(true)
        } else {
          // Fallback to regular notification if no image URL
          showSuccess('Media generated successfully!', `Image created in ${result.generation_time}s`)
        }
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

  // Handle status change
  const handleStatusChange = async (contentId, newStatus) => {
    try {
      setUpdatingStatus(prev => new Set(prev).add(contentId))
      
      const result = await contentAPI.updateContentStatus(contentId, newStatus)
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: newStatus })
        
        // Close the dropdown
        setStatusDropdownOpen(null)
        
        // Show success message
        showSuccess(`Status updated to ${newStatus} successfully!`)
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      showError('Failed to update status', error.message)
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev)
        newSet.delete(contentId)
        return newSet
      })
    }
  }

  // Available status options
  const statusOptions = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
    { value: 'published', label: 'Published', color: 'bg-green-100 text-green-800' },
    { value: 'archived', label: 'Archived', color: 'bg-yellow-100 text-yellow-800' }
  ]

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showError('Invalid file type', 'Please select an image or video file')
        return
      }
      
      // Validate file size (max 100MB for videos, 10MB for images)
      const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        const maxSizeMB = file.type.startsWith('video/') ? '100MB' : '10MB'
        showError('File too large', `Please select a file smaller than ${maxSizeMB}`)
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleDeleteUploadedMedia = async (postId) => {
    try {
      const result = await mediaService.deleteUploadedMedia(postId)
      if (result.success) {
        showSuccess('Media deleted successfully', 'The uploaded media has been removed')
        // Clear selected file if it was for this post
        if (editForm.id === postId) {
          setSelectedFile(null)
        }
        // Refresh the content list
        loadContent()
      }
    } catch (error) {
      console.error('Error deleting uploaded media:', error)
      showError('Failed to delete media', error.message || 'An error occurred while deleting the media')
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
      console.log('🔍 Setting video URL in state:', result.image_url)
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
      
      // Use the message from backend (which correctly identifies video vs image)
      const successMessage = result.message || 'Media uploaded successfully!'
      const successDescription = selectedFile?.type.startsWith('video/') 
        ? 'Your custom video has been added to the post'
        : 'Your custom image has been added to the post'
      
      showSuccess(successMessage, successDescription)
      
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

  // Show post success notification
  const showPostNotification = (platform, postUrl = null) => {
    setPostNotification({
      platform,
      show: true,
      timestamp: Date.now(),
      postUrl
    })
    
    // No auto-close - user must manually close with X button
  }

  // Handle go to post action
  const handleGoToPost = () => {
    if (postNotification?.postUrl) {
      try {
        // Validate URL before opening
        const url = new URL(postNotification.postUrl)
        window.open(postNotification.postUrl, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Invalid post URL:', postNotification.postUrl)
        // Show error message to user
        alert('Sorry, the post URL is not available or invalid.')
      }
    }
  }

  // Handle close notification
  const handleCloseNotification = () => {
    console.log('X button clicked, closing notification')
    setPostNotification(prev => prev ? { ...prev, show: false } : null)
    setTimeout(() => {
      setPostNotification(null)
    }, 500)
  }

  // Handle content deletion
  const handleDeleteContent = async (content) => {
    try {
      setDeletingContent(prev => new Set(prev).add(content.id))
      
      const token = await supabase.auth.getSession()
      if (!token.data.session) {
        throw new Error('No authentication token available')
      }
      
      const response = await fetch(`${API_BASE_URL}/content/${content.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to delete content')
      }
      
      const result = await response.json()
      
      // Remove from local state
      setDateContent(prev => prev.filter(c => c.id !== content.id))
      
      // Close confirmation dialog
      setDeleteConfirm(null)
      
      showSuccess('Content deleted successfully', `"${content.title || 'Untitled post'}" has been permanently deleted`)
      
    } catch (error) {
      console.error('Error deleting content:', error)
      
      let errorMessage = error.message
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.'
      } else if (error.message.includes('404')) {
        errorMessage = 'Content not found or already deleted.'
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later or contact support.'
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.'
      }
      
      showError('Failed to delete content', errorMessage)
    } finally {
      setDeletingContent(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
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
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Add resize transformation to create a smaller, faster-loading thumbnail
      // Using 40x40 with 50% quality for maximum speed
      return `${imageUrl}${separator}width=40&height=40&resize=cover&quality=50&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get extra small thumbnail for collapsed cards (ultra fast loading)
  const getSmallThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for very small thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 24x24 with 30% quality for ultra fast loading in collapsed cards
      return `${imageUrl}${separator}width=24&height=24&resize=cover&quality=30&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get medium thumbnail for expanded cards (balanced size and quality)
  const getMediumThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for medium thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 150x150 with 60% quality for good balance of size and quality
      return `${imageUrl}${separator}width=150&height=150&resize=cover&quality=60&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get ultra small thumbnail for very fast loading (e.g., in lists)
  const getUltraSmallThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for ultra small thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 16x16 with 20% quality for ultra fast loading
      return `${imageUrl}${separator}width=16&height=16&resize=cover&quality=20&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Check if the media file is a video
  const isVideoFile = (url) => {
    if (!url) return false
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm']
    return videoExtensions.some(ext => url.toLowerCase().includes(ext))
  }

  // Get full-size image URL for detailed viewing
  const getFullSizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL, return the original URL for full quality
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Return original URL without transformations for full quality
      return imageUrl
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Helper function to clean content by removing hashtags
  const cleanContentText = (content) => {
    if (!content) return content
    
    // Remove hashtags from the content text (hashtags that start with #)
    return content.replace(/#\w+/g, '').trim()
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
    console.log('🖼️ Opening lightbox for:', imageUrl)
    console.log('🖼️ Is video file:', isVideoFile(imageUrl))
    setLightboxLoading(true)
    setLightboxImage({
      url: imageUrl,
      title: contentTitle
    })
  }

  // Close lightbox
  const closeLightbox = () => {
    setLightboxImage(null)
    setLightboxLoading(false)
  }

  // Handle scroll to show/hide arrow
  const handleScroll = (e) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.target
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10 // 10px tolerance
    setShowScrollArrow(!isAtEnd)
  }

  // Reset scroll arrow when content changes
  useEffect(() => {
    setShowScrollArrow(true)
  }, [contentToDisplay])

  // Handle keyboard events for lightbox
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (lightboxImage) {
        if (event.key === 'Escape') {
        closeLightbox()
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') {
          // Prevent default behavior for arrow keys and space
          event.preventDefault()
        }
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

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generate Fresh Content
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                This will delete your old content and create fresh content for all platforms. 
                Are you sure you want to proceed?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowConfirmationModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGeneration}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={setShowCustomContentChatbot}
        handleGenerateContent={handleGenerateContent}
        generating={generating}
        fetchingFreshData={fetchingFreshData}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className={`md:ml-48 xl:ml-64 flex flex-col min-h-screen ${availableDates.length > 1 ? 'pb-20' : ''}`}>
        {/* Fixed Header - Desktop Only */}
        <div className="hidden md:block fixed top-0 right-0 left-48 xl:left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
            {/* Desktop Layout */}
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4 lg:space-x-8">
                {/* Content Date Header */}
                <div className="flex items-center space-x-2 lg:space-x-4">
                  <div className="flex items-center space-x-2 lg:space-x-3">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg lg:text-xl font-bold text-gray-900">
                        {new Date(selectedDate).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                        })}
                      </h1>
                      <p className="text-xs lg:text-sm text-gray-600">
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
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 lg:p-6 pt-16 md:pt-20 flex flex-col justify-center min-h-screen">
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
                <div className="text-gray-500 mb-6">
                  {generating 
                    ? "Content generation in progress. Please wait..."
                    : fetchingFreshData
                    ? "Loading your new content..."
                    : selectedDate === new Date().toISOString().split('T')[0] 
                    ? (
                        <>
                          <p className="mb-2">Generate some amazing content to get started!</p>
                          <p>Or see the next scheduled content</p>
                        </>
                      )
                    : "This date has no content. Use the navigation arrows to find dates with content."
                  }
                </div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleGenerateContent}
                  disabled={generating || fetchingFreshData}
                    className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
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
                  
                  {selectedDate === new Date().toISOString().split('T')[0] && (
                    <button
                      onClick={async () => {
                        console.log('Refreshing today\'s content...')
                        await fetchContentByDate(selectedDate)
                        await fetchData(true) // Force refresh scheduled content too
                        await getAvailableDates() // Refresh available dates
                      }}
                      disabled={generating || fetchingFreshData}
                      className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>Refresh</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      console.log('Navigating to next available content...')
                      navigateToNextDate()
                    }}
                    disabled={generating || fetchingFreshData || currentDateIndex === availableDates.length - 1}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 text-sm"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>Next Content</span>
                </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                {/* Right arrow indicator - only show when there's more content to scroll (hidden on mobile) */}
                {showScrollArrow && (
                  <div className="hidden sm:block absolute right-0 top-1/2 transform -translate-y-1/2 z-10 pointer-events-none">
                    <div className="bg-white rounded-full p-2 shadow-lg border border-gray-200">
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                )}
                
                <div 
                  className="flex flex-col sm:flex-row gap-6 overflow-x-auto sm:overflow-x-auto overflow-y-visible pb-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-0 sm:pr-12"
                  onScroll={handleScroll}
                >
                {filteredContent.map((content) => {
                  const theme = getPlatformCardTheme(content.platform)
                  console.log('Content platform:', content.platform, 'Theme:', theme)
                  return (
                    <div 
                      key={content.id} 
                      onClick={() => handleViewContent(content)}
                      className={`${theme.bg} rounded-xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer flex-shrink-0 w-full sm:w-80`}
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
                        {/* Status Dropdown */}
                        <div className="relative status-dropdown">
                          <button
                            onClick={() => setStatusDropdownOpen(statusDropdownOpen === content.id ? null : content.id)}
                            disabled={updatingStatus.has(content.id)}
                            className={`px-3 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(content.status)} hover:opacity-80 transition-opacity disabled:opacity-50`}
                          >
                            <span className="capitalize">{content.status}</span>
                            {updatingStatus.has(content.id) ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          
                          {/* Dropdown Menu */}
                          {statusDropdownOpen === content.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in slide-in-from-top-2 duration-200">
                              <div className="py-1">
                                {statusOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={() => handleStatusChange(content.id, option.value)}
                                    disabled={updatingStatus.has(content.id) || content.status === option.value}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2 ${
                                      content.status === option.value ? 'bg-gray-100 text-gray-600' : 'text-gray-700'
                                    } ${updatingStatus.has(content.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></div>
                                    <span className="capitalize">{option.label}</span>
                                    {updatingStatus.has(content.id) && content.status === option.value && (
                                      <RefreshCw className="w-3 h-3 animate-spin ml-auto" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    
                    {content.title && (
                      <h5 className="font-medium text-gray-900 mb-3">{content.title}</h5>
                    )}
                    
                    {expandedContent?.id === content.id ? (
                      <div className="mb-4">
                        {/* Media Display - Above Content (Social Media Style) */}
                        {((generatedImages[content.id] && generatedImages[content.id].image_url) || content.image_url) && (
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
                              
                              {(() => {
                                // Use generated image if available, otherwise use content's image_url
                                const imageUrl = (generatedImages[content.id] && generatedImages[content.id].image_url) || content.image_url
                                
                                if (isVideoFile(imageUrl)) {
                                  return (
                                    <video 
                                      src={imageUrl}
                                      className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      controls
                                      preload="metadata"
                                      onLoadStart={() => startImageLoading(content.id)}
                                      onLoadedData={() => handleImageLoad(content.id)}
                                      onError={() => handleImageError(content.id)}
                                      onClick={() => handleImageClick(imageUrl, content.title)}
                                    >
                                      Your browser does not support the video tag.
                                    </video>
                                  )
                                } else {
                                  return (
                                    <img 
                                      src={getSmallThumbnailUrl(imageUrl)} 
                                      alt="Content thumbnail" 
                                className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                onLoad={() => handleImageLoad(content.id)}
                                onError={() => handleImageError(content.id)}
                                onLoadStart={() => startImageLoading(content.id)}
                                      onClick={() => handleImageClick(getFullSizeImageUrl(imageUrl), content.title)}
                                style={{
                                  opacity: imageLoading.has(content.id) ? 0 : 1,
                                  filter: imageLoading.has(content.id) ? 'blur(8px)' : 'blur(0px)',
                                  transform: imageLoading.has(content.id) ? 'scale(1.05)' : 'scale(1)',
                                  transition: 'all 0.6s ease-in-out'
                                }}
                              />
                                  )
                                }
                              })()}
                            </div>
                            <div className="flex items-center space-x-2">
                              {!generatedImages[content.id].is_approved && (
                                <button
                                  onClick={() => handleApproveImage(content.id)}
                                  className="text-xs bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-1 rounded hover:from-pink-600 hover:to-purple-500 transition-all duration-300 flex items-center space-x-1"
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  <span>Approve Image</span>
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setImageEditorData({
                                    postContent: content.content,
                                    inputImageUrl: generatedImages[content.id].image_url
                                  })
                                  setShowImageEditor(true)
                                }}
                                className="text-xs bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-3 py-1 rounded hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Image</span>
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{cleanContentText(content.content)}</p>
                        
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
                        
                        {/* Action Buttons - only show for draft status in expanded view */}
                        {content.status === 'draft' && (
                          <div className="mb-4 flex gap-2">
                            <button
                              onClick={() => handleApprovePost(content.id)}
                              className="flex items-center space-x-1 bg-gradient-to-r from-purple-500 to-pink-600 text-white px-3 py-2 rounded-lg hover:from-pink-600 hover:to-purple-500 transition-all duration-300 text-sm"
                            >
                              <CheckCircle className="w-3 h-3" />
                              <span>Approve Post</span>
                            </button>
                            
                            <button
                              onClick={() => handleEditContent(content)}
                              className="flex items-center space-x-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-2 rounded-lg hover:from-indigo-600 hover:to-blue-500 transition-all duration-300 text-sm"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit Post</span>
                            </button>
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
                        {/* Media Display - Only show if content has media */}
                        {((generatedImages[content.id] && generatedImages[content.id].image_url) || content.image_url) && (
                        <div className="mb-3 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-medium text-purple-800">Media</span>
                                {generatedImages[content.id].is_approved ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">✓</span>
                                ) : (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded">Pending</span>
                              )}
                            </div>
                          </div>
                          <div className="relative w-full aspect-square bg-gray-200 rounded overflow-hidden">
                                {/* Show placeholder while loading */}
                                {imageLoading.has(content.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                    <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
                                  </div>
                                )}
                              {(() => {
                                    // Use generated image if available, otherwise use content's image_url
                                    const imageUrl = (generatedImages[content.id] && generatedImages[content.id].image_url) || content.image_url
                                    const thumbnailUrl = getUltraSmallThumbnailUrl(imageUrl)
                                console.log('🖼️ Content card image check:', {
                                  contentId: content.id,
                                  hasGeneratedImage: !!(generatedImages[content.id] && generatedImages[content.id].image_url),
                                  hasContentImage: !!content.image_url,
                                  imageUrl: imageUrl,
                                  thumbnailUrl: thumbnailUrl
                                })
                                
                                // Check if it's a video file
                                if (isVideoFile(imageUrl)) {
                                  console.log('🎬 Rendering video for content:', content.id)
                                  console.log('🎬 Video URL:', imageUrl)
                                  console.log('🎬 Video file extension:', imageUrl.split('.').pop())
                                      return (
                                    <video 
                                      src={imageUrl}
                                      className="w-full h-full object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                      controls
                                      preload="metadata"
                                      muted
                                      playsInline
                                            onClick={(e) => {
                                              e.stopPropagation()
                                        handleImageClick(imageUrl, content.title)
                                      }}
                                      onLoadStart={() => {
                                        console.log('🎬 Video loading started for content:', content.id)
                                        startImageLoading(content.id)
                                      }}
                                      onLoadedData={() => {
                                        console.log('✅ Video loaded for content:', content.id)
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        console.error('❌ Video failed to load for content:', content.id)
                                        console.error('❌ Failed URL:', imageUrl)
                                        console.error('❌ Error details:', e)
                                        handleImageError(content.id)
                                      }}
                                      onCanPlay={() => {
                                        console.log('🎬 Video can play for content:', content.id)
                                      }}
                                      style={{
                                        opacity: imageLoading.has(content.id) ? 0 : 1,
                                        filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                        transform: imageLoading.has(content.id) ? 'scale(1.1)' : 'scale(1)',
                                        transition: 'all 0.5s ease-in-out'
                                      }}
                                    >
                                      Your browser does not support the video tag.
                                    </video>
                                  )
                                }
                                
                                // If thumbnail URL is null (non-generated folder URL), show original image
                                if (!thumbnailUrl) {
                                  return (
                                    <img 
                                      src={imageUrl} 
                                      alt="Content image" 
                                      className="w-full h-full object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                      loading="eager"
                                      onClick={() => handleImageClick(imageUrl, content.title)}
                                      onLoad={() => {
                                        console.log('✅ Image loaded for content:', content.id)
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        console.error('❌ Image failed to load for content:', content.id)
                                        console.error('❌ Failed URL:', imageUrl)
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
                                    }
                                    
                                    // Show image if we have a valid Supabase thumbnail URL
                                    return (
                                      <img 
                                        src={thumbnailUrl} 
                                        alt="Content image" 
                                        className="w-full h-full object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                        loading="eager"
                                      onClick={() => handleImageClick(getFullSizeImageUrl(imageUrl), content.title)}
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
                              })()}
                            </div>
                            
                            {/* Edit Image Button */}
                            <div className="mt-2 flex justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setImageEditorData({
                                    postContent: content.content,
                                    inputImageUrl: generatedImages[content.id].image_url
                                  })
                                  setShowImageEditor(true)
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-1"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit Image</span>
                              </button>
                            </div>
                                  </div>
                                )}
                        
                        <p className="text-gray-700 text-sm mb-4 line-clamp-3">{cleanContentText(content.content)}</p>
                        
                        {cleanContentText(content.content).length > 150 && (
                          <button
                            onClick={() => handleViewContent(content)}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Read more
                          </button>
                        )}
                        
                        {/* Media Action Buttons */}
                        {(!generatedImages[content.id] || !generatedImages[content.id].image_url) && (
                          <div className="flex gap-2 mt-4 mb-6">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateMedia(content)
                                  }}
                                  disabled={generatingMedia.has(content.id)}
                               className="flex-1 px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                                >
                                  {generatingMedia.has(content.id) ? (
                                    <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Generating...</span>
                                    </>
                                  ) : (
                                    <>
                                  <Wand2 className="w-3 h-3" />
                                  <span>Generate Media</span>
                                    </>
                                  )}
                                </button>
                        
                          <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowUploadModal(content.id)
                                setSelectedFile(null)
                              }}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                            >
                              <Upload className="w-3 h-3" />
                              <span>Upload Media</span>
                          </button>
                          </div>
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
                        
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm(content)
                            }}
                            onMouseEnter={() => setHoveredButton(`${content.id}-delete`)}
                            onMouseLeave={() => setHoveredButton(null)}
                            disabled={deletingContent.has(content.id)}
                            className={`p-2 rounded-lg transition-all duration-200 ${
                              deletingContent.has(content.id)
                                ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                : 'bg-red-500 text-white hover:bg-red-600'
                            }`}
                          >
                            {deletingContent.has(content.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                          {hoveredButton === `${content.id}-delete` && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                              {deletingContent.has(content.id) ? 'Deleting...' : 'Delete Post'}
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
              </div>
            )}
          </div>
        </div>

        {/* Dark Background Overlay - Covers entire page */}
        {showAddMenu && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowAddMenu(false)}
          />
        )}

        {/* Floating Add Button with Dropdown */}
        <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50">
          <div className="relative add-menu-container">
            {/* Dropdown Menu */}
            {showAddMenu && (
              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 min-w-[280px] z-50">
                <button
                  onClick={() => {
                    setShowCustomContentChatbot(true)
                    setShowAddMenu(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors duration-200"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">Create Custom Content</div>
                    <div className="text-sm text-gray-500">Write your own content</div>
                  </div>
                </button>
                
                <div className="border-t border-gray-100 my-1"></div>
                
                <button
                  onClick={() => {
                    handleGenerateContent()
                    setShowAddMenu(false)
                  }}
                  disabled={generating || fetchingFreshData}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors duration-200 disabled:opacity-50"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                    {generating ? (
                      <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    ) : fetchingFreshData ? (
                      <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {generating ? 'Generating...' : fetchingFreshData ? 'Loading...' : 'Generate Content'}
                    </div>
                    <div className="text-sm text-gray-500">AI-powered content creation</div>
                  </div>
                </button>
              </div>
            )}
            
            {/* Main + Button */}
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full shadow-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 flex items-center justify-center"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Footer Navigation - Only show if there are multiple dates with content */}
        {availableDates.length > 1 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40">
            <div className="flex items-center justify-center space-x-2 sm:space-x-4 py-3 sm:py-4 px-4 sm:px-6">
              <button
                onClick={navigateToPreviousDate}
                disabled={currentDateIndex === 0}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 ${
                  currentDateIndex === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-pink-300 hover:text-pink-600 shadow-sm hover:shadow-md'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-medium">Previous</span>
              </button>

              <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 bg-gray-50 rounded-lg">
                <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {currentDateIndex + 1} of {availableDates.length}
                </span>
                <span className="text-xs text-gray-500 hidden sm:inline">
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
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 ${
                  currentDateIndex === availableDates.length - 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-pink-300 hover:text-pink-600 shadow-sm hover:shadow-md'
                }`}
              >
                <span className="text-xs sm:text-sm font-medium">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-purple-100">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Edit Content</h3>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    placeholder="Enter content title"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Content
                  </label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300 resize-none"
                    placeholder="Enter content text"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Hashtags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.hashtags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    placeholder="Enter hashtags separated by commas"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Scheduled Time
                    </label>
                    <input
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    />
                  </div>
                </div>

                {/* Media Upload and Status - Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Media Upload Section - Supports both images and videos */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Replace Media
                    </label>
                    
                    {/* Current Media Display */}
                    {generatedImages[editForm.id] && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-purple-800">Current Media:</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            generatedImages[editForm.id].is_approved 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {generatedImages[editForm.id].is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                        <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                          {imageLoading.has(editForm.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          )}
                          
                          {isVideoFile(generatedImages[editForm.id].image_url) ? (
                            <video 
                              src={generatedImages[editForm.id].image_url}
                              className="w-full h-32 object-cover rounded-lg"
                              controls
                              preload="metadata"
                              onLoadStart={() => {
                                console.log('🔍 Video loading started, URL:', generatedImages[editForm.id].image_url)
                                startImageLoading(editForm.id)
                              }}
                              onLoadedData={() => handleImageLoad(editForm.id)}
                              onError={() => handleImageError(editForm.id)}
                              style={{
                                opacity: imageLoading.has(editForm.id) ? 0 : 1,
                                filter: imageLoading.has(editForm.id) ? 'blur(8px)' : 'blur(0px)',
                                transform: imageLoading.has(editForm.id) ? 'scale(1.05)' : 'scale(1)',
                                transition: 'all 0.6s ease-in-out'
                              }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : (
                          <img 
                            src={getSmallThumbnailUrl(generatedImages[editForm.id].image_url)} 
                              alt="Current content media" 
                            className="w-full h-32 object-cover rounded-lg"
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
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* File Upload */}
                    <div className="space-y-4">
                      <div className="relative">
                      <input
                        type="file"
                          accept="image/*,video/mp4,video/avi,video/mov,video/wmv,video/webm"
                        onChange={handleFileSelect}
                          className="w-full h-24 border-2 border-dashed border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300 cursor-pointer opacity-0 absolute inset-0"
                        />
                        <div className="w-full h-24 border-2 border-dashed border-purple-200 rounded-xl flex items-center justify-center hover:border-purple-300 transition-all duration-200">
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                            <p className="text-sm text-purple-600 font-medium">Click to browse files</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <span className="w-1 h-1 bg-purple-400 rounded-full mr-2"></span>
                        Supported formats: JPG, PNG, GIF (max 10MB), MP4, AVI, MOV, WMV, WEBM (max 100MB)
                      </p>
                      
                      {/* Selected File Preview */}
                      {selectedFile && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              {selectedFile.type.startsWith('video/') ? (
                                <Video className="w-5 h-5 text-white" />
                              ) : (
                                <Image className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
                              <p className="text-xs text-purple-600 font-medium">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type.startsWith('video/') ? 'Video' : 'Image'}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4 text-red-600" />
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
                                <span>{selectedFile.type.startsWith('video/') ? 'Upload New Video' : 'Upload New Image'}</span>
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
              <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t-2 border-gradient-to-r from-purple-200 to-pink-200">
                <button
                  onClick={handleCancelEdit}
                  className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
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

      {/* Media Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6"
          onClick={closeLightbox}
        >
            {/* Close button */}
            <button
              onClick={closeLightbox}
            className="absolute top-6 right-6 z-10 bg-white bg-opacity-10 backdrop-blur-md text-white p-3 rounded-full shadow-xl hover:bg-opacity-20 transition-all duration-300 border border-white border-opacity-20"
            >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
          {/* Media title - positioned above the image */}
          {lightboxImage.title && (
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{lightboxImage.title}</h3>
              <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full"></div>
            </div>
          )}
          
          {/* Media Container - 70% of screen size */}
          <div className="relative w-[70vw] h-[70vh] flex items-center justify-center">
            {/* Loading spinner */}
            {lightboxLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <RefreshCw className="w-12 h-12 text-white animate-spin" />
                    <div className="absolute inset-0 w-12 h-12 border-2 border-purple-500 border-opacity-30 rounded-full"></div>
                  </div>
                  <p className="text-white text-lg font-medium">Loading image...</p>
                </div>
              </div>
            )}
            
            {isVideoFile(lightboxImage.url) ? (
              <video
                src={lightboxImage.url}
                className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white border-opacity-20"
                controls
                autoPlay
                muted
                playsInline
                onClick={(e) => e.stopPropagation()}
                onLoadedData={() => setLightboxLoading(false)}
                onError={() => setLightboxLoading(false)}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white border-opacity-20"
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setLightboxLoading(false)}
                onError={() => setLightboxLoading(false)}
              />
              )}
            </div>
          
          {/* Additional info at bottom */}
          <div className="mt-6 text-center">
            <p className="text-gray-300 text-sm">Click outside or press ESC to close</p>
          </div>
        </div>
      )}

      {/* Custom Content Chatbot Modal */}
      <CustomContentChatbot
        isOpen={showCustomContentChatbot}
        onClose={() => setShowCustomContentChatbot(false)}
        onContentCreated={(content) => {
          console.log('Custom content created:', content);
          // Refresh the content list
          fetchContentByDate(selectedDate);
          setShowCustomContentChatbot(false);
        }}
      />

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
    </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Delete Post</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete this post?
                </p>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="font-medium text-gray-800">
                    {deleteConfirm.title || 'Untitled Post'}
                  </p>
                  <p className="text-sm text-gray-600 capitalize">
                    {deleteConfirm.platform} • {deleteConfirm.status}
                  </p>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  This will permanently delete the post and any associated images.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deletingContent.has(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteContent(deleteConfirm)}
                  disabled={deletingContent.has(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
                >
                  {deletingContent.has(deleteConfirm.id) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Success Notification */}
      {postNotification && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-500 ${
            postNotification.show 
              ? 'opacity-100 scale-100' 
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
          onClick={(e) => {
            // Close notification when clicking backdrop
            if (e.target === e.currentTarget) {
              console.log('Backdrop clicked, closing notification')
              handleCloseNotification()
            }
          }}
        >
          <div 
            className={`bg-white rounded-3xl shadow-2xl border-2 p-8 max-w-sm mx-4 transform transition-all duration-500 relative ${
              postNotification.show 
                ? 'translate-y-0 scale-100' 
                : 'translate-y-4 scale-95'
            }`} 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('X button clicked')
                handleCloseNotification()
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm z-50 cursor-pointer"
              style={{ zIndex: 9999 }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
            
            <div className="text-center">
              
              {/* Platform Icon */}
              <div className="mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                  {postNotification.platform === 'Facebook' && (
                    <Facebook className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Instagram' && (
                    <Instagram className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'LinkedIn' && (
                    <Linkedin className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'YouTube' && (
                    <Youtube className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Twitter' && (
                    <X className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'X' && (
                    <X className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Google Business' && (
                    <Building2 className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
              
              {/* Success Message */}
              <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">
                🎉 Woohoo!
              </h3>
              
              {/* Party Popper Animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Confetti pieces */}
                <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '1s'}}></div>
                <div className="absolute top-0 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s', animationDuration: '1.2s'}}></div>
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.4s', animationDuration: '1.1s'}}></div>
                <div className="absolute top-0 right-1/3 w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.6s', animationDuration: '1.3s'}}></div>
                <div className="absolute top-0 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.8s', animationDuration: '1.4s'}}></div>
                
                {/* More confetti */}
                <div className="absolute top-2 left-1/5 w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{animationDelay: '1s', animationDuration: '1.5s'}}></div>
                <div className="absolute top-2 right-1/5 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '1.2s', animationDuration: '1.6s'}}></div>
                <div className="absolute top-2 left-2/3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '1.4s', animationDuration: '1.7s'}}></div>
                <div className="absolute top-2 right-2/3 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '1.6s', animationDuration: '1.8s'}}></div>
                
                {/* Side confetti */}
                <div className="absolute top-1/4 left-0 w-1 h-1 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.5s', animationDuration: '1.2s'}}></div>
                <div className="absolute top-1/3 right-0 w-1 h-1 bg-pink-300 rounded-full animate-bounce" style={{animationDelay: '0.7s', animationDuration: '1.4s'}}></div>
                <div className="absolute top-1/2 left-0 w-1 h-1 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '0.9s', animationDuration: '1.6s'}}></div>
                <div className="absolute top-2/3 right-0 w-1 h-1 bg-green-300 rounded-full animate-bounce" style={{animationDelay: '1.1s', animationDuration: '1.8s'}}></div>
              </div>
              <p className="text-white/90 text-lg font-medium mb-1">
                Emily just posted your content to
              </p>
              <p className="text-white font-bold text-xl capitalize mb-6">
                {postNotification.platform}
              </p>
              
              {/* Success Checkmark */}
              <div className="mb-6 flex justify-center">
                <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              
              {/* Action Buttons */}
              {postNotification.postUrl ? (
                <div className="flex justify-center">
                  <button
                    onClick={handleGoToPost}
                    className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl transition-all duration-200 backdrop-blur-sm flex items-center justify-center space-x-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Go to Post</span>
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-white/80 text-sm">
                    Post published successfully! Check your {postNotification.platform} account.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Media Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg mx-4 border border-purple-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Upload Media
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(null)
                  setSelectedFile(null)
                }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* File Input Area */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Media File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        setSelectedFile(file)
                      }
                    }}
                    className="w-full h-32 border-2 border-dashed border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300 cursor-pointer opacity-0 absolute inset-0"
                  />
                  <div className="w-full h-32 border-2 border-dashed border-purple-200 rounded-xl flex items-center justify-center hover:border-purple-300 transition-all duration-200">
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                      <p className="text-sm text-purple-600 font-medium">Click to browse files</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  <span className="w-1 h-1 bg-purple-400 rounded-full mr-2"></span>
                  Supported formats: Images (JPG, PNG, GIF) and Videos (MP4, AVI, MOV)
                </p>
              </div>
              
              {/* Selected File Preview */}
              {selectedFile && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      {selectedFile.type.startsWith('video/') ? (
                        <Video className="w-6 h-6 text-white" />
                      ) : (
                        <Image className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
                      <p className="text-xs text-purple-600 font-medium">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type.startsWith('video/') ? 'Video' : 'Image'}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Upload Button */}
              {selectedFile && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      console.log('🔍 Upload button clicked, contentId:', showUploadModal)
                      handleUploadImage(showUploadModal)
                    }}
                    disabled={uploadingImage.has(showUploadModal)}
                    className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-3 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    {uploadingImage.has(showUploadModal) ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span>{selectedFile.type.startsWith('video/') ? 'Upload Video' : 'Upload Image'}</span>
                      </>
                    )}
                  </button>
                  
                  {/* Progress indicator */}
                  {uploadingImage.has(showUploadModal) && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chatbot Image Editor Modal */}
      {showImageEditor && imageEditorData && (
        <ChatbotImageEditor
          isOpen={showImageEditor}
          onClose={() => {
            setShowImageEditor(false)
            setImageEditorData(null)
            
            // Refresh the content dashboard after modal closes (with a small delay)
            setTimeout(async () => {
              try {
                await fetchData(true)
                await fetchContentByDate(selectedDate)
              } catch (error) {
                console.error('Error refreshing content after modal close:', error)
              }
            }, 100) // Small delay to ensure modal is fully closed
          }}
          postContent={imageEditorData.postContent}
          inputImageUrl={imageEditorData.inputImageUrl}
          onImageSaved={async (newImageUrl) => {
            // The image URL stays the same, but the content is replaced
            // We need to refresh the content data to show the updated image
            try {
              // Refresh the content data to get the updated image
              await fetchData(true)
              
              // Also refresh the current date's content
              await fetchContentByDate(selectedDate)
              
              // Show success message
              showSuccess('Image saved successfully! The edited image has replaced the original.')
            } catch (error) {
              console.error('Error refreshing content after image save:', error)
              showError('Image saved but failed to refresh content', 'Please refresh the page to see the updated image.')
            }
            
            setShowImageEditor(false)
            setImageEditorData(null)
          }}
        />
      )}

      {/* Media Generation Celebration Popup */}
      <MediaGenerationCelebration
        isOpen={showCelebration}
        onClose={() => {
          setShowCelebration(false)
          setCelebrationData(null)
        }}
        imageUrl={celebrationData?.imageUrl}
        generationTime={celebrationData?.generationTime}
        generationModel={celebrationData?.generationModel}
        generationService={celebrationData?.generationService}
      />

    </div>
  )
}

export default ContentDashboard
