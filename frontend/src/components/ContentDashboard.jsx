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
  Send,
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
  XCircle,
  Trash2,
  AlertTriangle,
  Share2
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
  const [generateImagesWithContent, setGenerateImagesWithContent] = useState(false)
  const [fetchingFreshData, setFetchingFreshData] = useState(false)
  const [fetchingContent, setFetchingContent] = useState(false) // Track if content is being fetched for selected channel
  const [loadingAllContent, setLoadingAllContent] = useState(false) // Track if loading all content
  const [hasMoreContent, setHasMoreContent] = useState(false) // Track if there's more content to load
  const [allDatesCount, setAllDatesCount] = useState(0) // Total number of dates found
  const [postingContent, setPostingContent] = useState(new Set()) // Track which content is being posted
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set()) // Track expanded campaigns
  const [selectedChannel, setSelectedChannel] = useState(null) // Current selected channel (null = not set yet, will default to first channel)
  const [availableChannels, setAvailableChannels] = useState([]) // Available channels from profile
  const [allContent, setAllContent] = useState([]) // All content fetched from API
  const [profile, setProfile] = useState(null) // User profile data
  const [editingContent, setEditingContent] = useState(null) // Content being edited
  const [editForm, setEditForm] = useState({}) // Edit form data
  const [saving, setSaving] = useState(false) // Saving state
  const [selectedContentForModal, setSelectedContentForModal] = useState(null) // Content selected for modal view
  const [showAddMenu, setShowAddMenu] = useState(false) // Show add button dropdown menu
  
  // AI Edit state
  const [showAIEditModal, setShowAIEditModal] = useState(false) // AI edit modal
  const [aiEditInstruction, setAiEditInstruction] = useState('') // AI edit instruction
  const [aiEditing, setAiEditing] = useState(false) // AI editing state
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false) // AI edit confirmation modal
  const [aiEditedContent, setAiEditedContent] = useState('') // AI edited content to confirm
  const [aiEditType, setAiEditType] = useState(null) // 'title' or 'content'
  
  // Manual Edit state for modal
  const [editingTitleInModal, setEditingTitleInModal] = useState(false) // Editing title in modal
  const [editingContentInModal, setEditingContentInModal] = useState(false) // Editing content in modal
  const [editTitleValue, setEditTitleValue] = useState('') // Title edit value
  const [editContentValue, setEditContentValue] = useState('') // Content edit value
  const [savingModalEdit, setSavingModalEdit] = useState(false) // Saving modal edit state

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
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track which content is uploading image
  const [showUploadModal, setShowUploadModal] = useState(null) // Track which content is showing upload modal
  const [lightboxImage, setLightboxImage] = useState(null) // Track which image to show in lightbox
  const [lightboxLoading, setLightboxLoading] = useState(false) // Track lightbox image loading state
  const [showScrollArrow, setShowScrollArrow] = useState(true) // Track if scroll arrow should be visible
  const [showImageEditor, setShowImageEditor] = useState(false) // Track if image editor is open
  const [imageEditorData, setImageEditorData] = useState(null) // Data for image editor
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [previewUrl, setPreviewUrl] = useState(null) // Preview URL for selected file
  const [hoveredButton, setHoveredButton] = useState(null) // Track which button is being hovered
  const [imageLoading, setImageLoading] = useState(new Set()) // Track which images are loading
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
    fetchAllContent()
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

  // Cleanup preview URL when previewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Fetch profile to get available channels (Digital Marketing Platforms)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user?.id) return
        
        const { data, error } = await supabase
          .from('profiles')
          .select('social_media_platforms')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.error('Error fetching profile:', error)
          return
        }
        
        if (data) {
          setProfile(data)
          // Extract channels from profile's social_media_platforms
          const platforms = data.social_media_platforms || []
          
          // Map profile platform names to content platform format
          const platformMapping = {
            'instagram': 'instagram',
            'facebook': 'facebook',
            'linkedin': 'linkedin',
            'youtube': 'youtube',
            'pinterest': 'pinterest',
            'x (twitter)': 'twitter',
            'x': 'twitter',
            'twitter': 'twitter',
            'tiktok': 'tiktok',
            'whatsapp business': 'whatsapp',
            'whatsapp': 'whatsapp',
            'google business profile': 'google business profile',
            'google business': 'google business profile',
            'snapchat': 'snapchat',
            'quora': 'quora',
            'reddit': 'reddit'
          }
          
          // Normalize platform names to match content platform format
          const normalizedPlatforms = platforms.map(p => {
            const platformKey = p.toLowerCase().trim()
            // Check if we have a mapping
            if (platformMapping[platformKey]) {
              return platformMapping[platformKey]
            }
            // Fallback: use lowercase version
            return platformKey
          })
          
          // Remove duplicates and sort
          const uniquePlatforms = Array.from(new Set(normalizedPlatforms)).sort()
          setAvailableChannels(uniquePlatforms)
          console.log('Channels from profile:', uniquePlatforms)
          console.log('Original platforms from profile:', platforms)
          
          // Set first channel as default if no channel is selected
          if (uniquePlatforms.length > 0 && selectedChannel === null) {
            setSelectedChannel(uniquePlatforms[0])
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }
    
    fetchProfile()
  }, [user])

  // Refresh content when generation completes or channel changes
  useEffect(() => {
    if (!generating && !fetchingFreshData && selectedChannel) {
      // Reset load more state when channel changes
      setHasMoreContent(false)
      setLoadingAllContent(false)
      fetchAllContent()
    }
  }, [generating, fetchingFreshData, selectedChannel])

  // Set first channel as default when channels become available
  useEffect(() => {
    if (availableChannels.length > 0 && selectedChannel === null) {
      setSelectedChannel(availableChannels[0])
    }
  }, [availableChannels, selectedChannel])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchScheduledContent(forceRefresh)
      
      console.log('Fetched content data:', result)
      console.log('Cache status:', getCacheStatus())
      
      if (result.data) {
        console.log('Content items:', result.data)
        console.log('Platform values in content:', result.data.map(item => ({ id: item.id, platform: item.platform })))
        console.log('Data source:', result.fromCache ? 'cache' : 'API')
        
        // Images are now loaded directly from content_posts.primary_image_url
        
        // Refresh all content and channels after content is loaded
        await fetchAllContent()
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
    }
  }

  // Fetch content only for the selected channel
  // Only fetch content for 8 oldest dates (from bottom) to optimize performance
  const fetchAllContent = async () => {
    try {
      // Don't fetch if no channel is selected
      if (!selectedChannel) {
        console.log('No channel selected, skipping content fetch')
        setFetchingContent(false)
        return
      }
      
      // If "all" is selected, don't fetch (or fetch for all channels - but user wants only selected channel)
      if (selectedChannel === 'all') {
        console.log('"All" channel selected - not fetching content (only fetch for specific channel)')
        setAllContent([])
        setFetchingContent(false)
        return
      }
      
      // Set loading state
      setFetchingContent(true)
      console.log(`Fetching content for channel "${selectedChannel}" - 8 oldest dates (from bottom)...`)
      
      const allDates = new Set()
      const allDateToContentMap = new Map() // Map date -> array of content (all dates)
      const contentWithoutDates = []
      let offset = 0
      const batchSize = 50
      const maxDates = 8
      let hasMoreData = true
      
      // Normalize selected channel for comparison
      const normalizedSelectedChannel = selectedChannel.toLowerCase()
      
      // Fetch in batches to collect dates
      // Since backend returns newest first (desc), we fetch enough to likely get 8 oldest dates
      // We'll fetch a reasonable number of batches (enough to cover date range)
      const maxBatches = 10 // Fetch up to 10 batches (500 items) to ensure we get enough date coverage
      let batchCount = 0
      
      while (hasMoreData && batchCount < maxBatches) {
        const result = await contentAPI.getAllContent(batchSize, offset)
        
        if (!result.data || result.data.length === 0) {
          hasMoreData = false
          break
        }
        
        console.log(`Fetched batch ${batchCount + 1}: ${result.data.length} items, offset: ${offset}`)
        console.log(`Looking for channel: "${normalizedSelectedChannel}"`)
        console.log(`Platforms in this batch:`, [...new Set(result.data.map(c => c.platform?.toLowerCase().trim()).filter(Boolean))])
        
        // Process this batch and track all dates - ONLY for selected channel
        let matchedInBatch = 0
        for (const content of result.data) {
          // Filter by selected channel - normalize platform name for comparison
          const contentPlatform = content.platform?.toLowerCase().trim() || ''
          
          // Skip content that doesn't match the selected channel
          // Handle variations: "x (twitter)" -> "twitter", "whatsapp business" -> "whatsapp", etc.
          let matchesChannel = false
          if (contentPlatform === normalizedSelectedChannel) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google')) {
            matchesChannel = true
          }
          
          if (!matchesChannel) {
            continue
          }
          
          matchedInBatch++
          
          if (content.scheduled_at) {
            // Extract date from scheduled_at (format: "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD")
            const dateStr = content.scheduled_at.split('T')[0]
            allDates.add(dateStr)
            
            // Group content by date (store all dates)
            if (!allDateToContentMap.has(dateStr)) {
              allDateToContentMap.set(dateStr, [])
            }
            allDateToContentMap.get(dateStr).push(content)
          } else {
            // Store content without dates separately (only if it matches the channel)
            contentWithoutDates.push(content)
          }
        }
        
        console.log(`Matched ${matchedInBatch} items in batch ${batchCount + 1} for channel "${normalizedSelectedChannel}"`)
        
        // If we got fewer items than batch size, we're done
        if (result.data.length < batchSize) {
          hasMoreData = false
        } else {
          offset += batchSize
          batchCount++
        }
      }
      
      // Sort all dates in ascending order (oldest first) and take the 8 oldest
      const sortedDates = Array.from(allDates).sort()
      const selectedDates = sortedDates.slice(0, maxDates)
      
      // Track if there's more content to load
      setAllDatesCount(sortedDates.length)
      setHasMoreContent(sortedDates.length > maxDates)
      
      console.log(`Found ${allDates.size} unique dates for channel "${selectedChannel}", selecting 8 oldest:`, selectedDates)
      
      // Collect content from the 8 oldest dates
      const filteredContent = []
      for (const date of selectedDates) {
        const contentForDate = allDateToContentMap.get(date) || []
        filteredContent.push(...contentForDate)
      }
      
      // Add content without dates at the end
      filteredContent.push(...contentWithoutDates)
      
      console.log(`Filtered to ${filteredContent.length} items from ${selectedDates.length} dates for channel "${selectedChannel}"`)
      console.log('Selected dates (oldest first):', selectedDates)
      console.log('Sample content platforms:', filteredContent.slice(0, 3).map(c => ({ id: c.id, platform: c.platform })))
      
      if (filteredContent.length > 0) {
        setAllContent(filteredContent)
        console.log(`✅ Set allContent with ${filteredContent.length} items for channel "${selectedChannel}"`)
        
        // Images are now loaded directly from content_posts.primary_image_url
      } else {
        setAllContent([])
        console.log(`No content found for channel "${selectedChannel}"`)
      }
      
      // Set loading state to false after fetch completes
      setFetchingContent(false)
    } catch (error) {
      console.error('Error fetching all content:', error)
      setAllContent([])
      setFetchingContent(false)
    }
  }

  // Load all content for the selected channel (all dates, not just 8)
  const loadAllContent = async () => {
    try {
      // Don't fetch if no channel is selected
      if (!selectedChannel) {
        console.log('No channel selected, skipping content fetch')
        return
      }
      
      // If "all" is selected, don't fetch
      if (selectedChannel === 'all') {
        console.log('"All" channel selected - not fetching content')
        return
      }
      
      // Set loading state
      setLoadingAllContent(true)
      console.log(`Loading all content for channel "${selectedChannel}"...`)
      
      const allDates = new Set()
      const allDateToContentMap = new Map() // Map date -> array of content
      const contentWithoutDates = []
      let offset = 0
      const batchSize = 50
      let hasMoreData = true
      
      // Normalize selected channel for comparison
      const normalizedSelectedChannel = selectedChannel.toLowerCase()
      
      // Fetch in batches to collect all dates
      const maxBatches = 20 // Fetch up to 20 batches (1000 items) to get all content
      let batchCount = 0
      
      while (hasMoreData && batchCount < maxBatches) {
        const result = await contentAPI.getAllContent(batchSize, offset)
        
        if (!result.data || result.data.length === 0) {
          hasMoreData = false
          break
        }
        
        console.log(`Fetched batch ${batchCount + 1}: ${result.data.length} items, offset: ${offset}`)
        
        // Process this batch and track all dates - ONLY for selected channel
        let matchedInBatch = 0
        for (const content of result.data) {
          // Filter by selected channel - normalize platform name for comparison
          const contentPlatform = content.platform?.toLowerCase().trim() || ''
          
          // Skip content that doesn't match the selected channel
          let matchesChannel = false
          if (contentPlatform === normalizedSelectedChannel) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google')) {
            matchesChannel = true
          }
          
          if (!matchesChannel) {
            continue
          }
          
          matchedInBatch++
          
          if (content.scheduled_at) {
            // Extract date from scheduled_at
            const dateStr = content.scheduled_at.split('T')[0]
            allDates.add(dateStr)
            
            // Group content by date
            if (!allDateToContentMap.has(dateStr)) {
              allDateToContentMap.set(dateStr, [])
            }
            allDateToContentMap.get(dateStr).push(content)
          } else {
            // Store content without dates separately
            contentWithoutDates.push(content)
          }
        }
        
        console.log(`Matched ${matchedInBatch} items in batch ${batchCount + 1} for channel "${normalizedSelectedChannel}"`)
        
        // If we got fewer items than batch size, we're done
        if (result.data.length < batchSize) {
          hasMoreData = false
        } else {
          offset += batchSize
          batchCount++
        }
      }
      
      // Sort all dates in ascending order (oldest first) - load ALL dates
      const sortedDates = Array.from(allDates).sort()
      
      console.log(`Found ${allDates.size} unique dates for channel "${selectedChannel}", loading all dates`)
      
      // Collect content from ALL dates
      const allFilteredContent = []
      for (const date of sortedDates) {
        const contentForDate = allDateToContentMap.get(date) || []
        allFilteredContent.push(...contentForDate)
      }
      
      // Add content without dates at the end
      allFilteredContent.push(...contentWithoutDates)
      
      console.log(`Loaded ${allFilteredContent.length} items from ${sortedDates.length} dates for channel "${selectedChannel}"`)
      
      if (allFilteredContent.length > 0) {
        setAllContent(allFilteredContent)
        setHasMoreContent(false) // No more content to load
        setAllDatesCount(sortedDates.length)
        console.log(`✅ Set allContent with ${allFilteredContent.length} items for channel "${selectedChannel}"`)
        
        // Images are now loaded directly from content_posts.primary_image_url
      } else {
        setAllContent([])
        console.log(`No content found for channel "${selectedChannel}"`)
      }
      
      // Set loading state to false after fetch completes
      setLoadingAllContent(false)
    } catch (error) {
      console.error('Error loading all content:', error)
      setAllContent([])
      setLoadingAllContent(false)
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
        
        setFetchingFreshData(false) // End loading state
        await fetchAllContent() // Refresh all content and channels after content generation
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
    const shouldGenerateImages = generateImagesWithContent
    setGenerateImagesWithContent(false) // Reset checkbox
    
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      setShowGenerationModal(true)
      setFetchingFreshData(false) // Reset data fetching state
      
      const result = await contentAPI.generateContent(shouldGenerateImages)
      
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

  // Filter content by selected channel
  // Hide content during generation and data fetching to prevent showing old/incomplete content
  const contentToDisplay = (generating || fetchingFreshData)
    ? [] 
    : allContent

  // Debug logging for content display
  console.log('Content Dashboard Debug:', {
    selectedChannel,
    availableChannels,
    allContentLength: allContent.length,
    contentToDisplayLength: contentToDisplay.length,
    generating,
    fetchingFreshData
  })
  
  // Filter content by selected channel
  // Note: fetchAllContent already filters by channel, but we do a final check here for safety
  const filteredContent = contentToDisplay
    .filter(content => {
      if (!selectedChannel) {
        return false // Don't show content until a channel is selected
      }
      if (selectedChannel === 'all') {
        return true // Show all content when 'all' is selected
      }
      // Case-insensitive comparison with platform name variations
      const contentPlatform = content.platform?.toLowerCase().trim() || ''
      const normalizedChannel = selectedChannel.toLowerCase().trim()
      
      // Direct match
      if (contentPlatform === normalizedChannel) {
        return true
      }
      
      // Handle variations
      if (normalizedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
        return true
      }
      if (normalizedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
        return true
      }
      if (normalizedChannel === 'google business profile' && contentPlatform.includes('google')) {
        return true
      }
      
      return false
    })
    .sort((a, b) => {
      // Sort by scheduled_at in ascending order (earliest dates first)
      // Content without dates goes to the end
      if (!a.scheduled_at && !b.scheduled_at) return 0
      if (!a.scheduled_at) return 1
      if (!b.scheduled_at) return -1
      const dateA = new Date(a.scheduled_at).getTime()
      const dateB = new Date(b.scheduled_at).getTime()
      return dateA - dateB
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
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
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
      
      // Update the content status to published in cache (with published_at timestamp)
      const publishedAt = new Date().toISOString()
      updateContentInCache(content.id, { 
        status: 'published',
        published_at: publishedAt,
        facebook_post_id: result.post_id
      })
      
      // Also update in allContent if it exists there
      setAllContent(prev => prev.map(item => 
        item.id === content.id 
          ? { ...item, status: 'published', published_at: publishedAt, facebook_post_id: result.post_id }
          : item
      ))
      
    } catch (error) {
      console.error('Error posting to Facebook:', error)
      throw error
    }
  }

  const postToInstagram = async (content) => {
    let oauthError = null
    
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
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
        
        // Create an AbortController for timeout handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutes timeout (longer than backend wait)
        
        try {
          const response = await fetch(`${API_BASE_URL}/connections/instagram/post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(postData),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const result = await response.json()
            console.log('✅ Instagram OAuth post successful:', result)
            console.log('📋 Response data:', { post_url: result.post_url, url: result.url, post_id: result.post_id })
            
            // Show beautiful notification with post URL if available
            const postUrl = result.post_url || result.url
            if (postUrl) {
              showPostNotification('Instagram', postUrl)
            } else {
              // If no URL, still show success message
              showSuccess('Successfully posted to Instagram!')
            }
            
            // Update the content status to published in cache (with published_at timestamp)
            const publishedAt = new Date().toISOString()
            updateContentInCache(content.id, { 
              status: 'published',
              published_at: publishedAt,
              instagram_post_id: result.post_id
            })
            
            // Also update in allContent if it exists there
            setAllContent(prev => prev.map(item => 
              item.id === content.id 
                ? { ...item, status: 'published', published_at: publishedAt, instagram_post_id: result.post_id }
                : item
            ))
            return
          } else {
            const errorText = await response.text()
            console.log('❌ Instagram OAuth failed:', response.status, errorText)
            oauthError = new Error(`OAuth method failed: ${response.status}: ${errorText}`)
            // Continue to try token method
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            console.log('⏱️ Instagram OAuth request timeout')
            oauthError = new Error('Request timeout: Instagram reel processing is taking longer than expected. The post may still be processing in the background.')
          } else {
            throw fetchError
          }
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
          
          // Update the content status to published in cache (with published_at timestamp)
          const publishedAt = new Date().toISOString()
          updateContentInCache(content.id, { 
            status: 'published',
            published_at: publishedAt,
            instagram_post_id: result.post_id
          })
          
          // Also update in allContent if it exists there
          setAllContent(prev => prev.map(item => 
            item.id === content.id 
              ? { ...item, status: 'published', published_at: publishedAt, instagram_post_id: result.post_id }
              : item
          ))
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
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
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
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
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
      status: content.status || 'draft',
      media_url: content.media_url || content.image_url || '' // Include media_url from primary_image_url
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
      
      // Update in allContent
      if (allContent.some(item => item.id === editingContent.id)) {
        setAllContent(prev => prev.map(item => 
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
    // Open modal with full content
    setSelectedContentForModal(content)
  }

  const handleCloseModal = () => {
    setSelectedContentForModal(null)
    // Reset edit states
    setEditingTitleInModal(false)
    setEditingContentInModal(false)
    setEditTitleValue('')
    setEditContentValue('')
  }

  // AI Edit functions
  const handleAIEdit = (type) => {
    setAiEditType(type)
    setShowAIEditModal(true)
    setAiEditInstruction('')
  }

  const handleAISaveEdit = async () => {
    if (!selectedContentForModal || !aiEditInstruction.trim()) return

    // Validate instruction length
    if (aiEditInstruction.length > 500) {
      showError('Instruction too long', 'Please keep your instruction under 500 characters')
      return
    }

    try {
      setAiEditing(true)

      // Get the current text based on type
      const currentText = aiEditType === 'title' 
        ? selectedContentForModal.title || ''
        : selectedContentForModal.content || ''

      // Get auth token
      const authToken = await getAuthToken()
      
      // Call AI service to edit content
      const response = await fetch(`${API_BASE_URL}/content/ai/edit-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
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
        // Show confirmation modal with AI-edited content
        setAiEditedContent(result.edited_content)
        setShowAIEditModal(false)
        setShowAIConfirmModal(true)
      } else {
        throw new Error(result.error || result.detail || 'Failed to edit content with AI')
      }

    } catch (error) {
      console.error('Error editing content with AI:', error)
      showError('Failed to edit content with AI', error.message)
    } finally {
      setAiEditing(false)
    }
  }

  const handleCancelAIEdit = () => {
    setShowAIEditModal(false)
    setAiEditInstruction('')
    setAiEditType(null)
  }

  const handleAIConfirmSave = async () => {
    if (!selectedContentForModal || !aiEditedContent) return

    try {
      setSaving(true)

      const updateData = {}
      if (aiEditType === 'title') {
        updateData.title = aiEditedContent
      } else {
        updateData.content = aiEditedContent
      }

      const result = await contentAPI.updateContent(selectedContentForModal.id, updateData)

      if (result.success) {
        // Update the content in state
        const updatedContent = { ...selectedContentForModal, ...updateData }
        setAllContent(prev => prev.map(item => 
          item.id === selectedContentForModal.id ? updatedContent : item
        ))

        // Update the modal content - keep modal open
        setSelectedContentForModal(updatedContent)

        // Close only the confirmation modal, keep the main modal open
        setShowAIConfirmModal(false)
        setAiEditedContent('')
        setAiEditInstruction('')
        setAiEditType(null)

        showSuccess('Success', 'Content updated with AI assistance')
      } else {
        throw new Error(result.error || 'Failed to update content')
      }

    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAIConfirmCancel = () => {
    setShowAIConfirmModal(false)
    setAiEditedContent('')
    setAiEditInstruction('')
    setAiEditType(null)
  }

  // Manual Edit functions for modal
  const handleManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(true)
      setEditTitleValue(selectedContentForModal?.title || '')
    } else {
      setEditingContentInModal(true)
      setEditContentValue(selectedContentForModal?.content || '')
    }
  }

  const handleCancelManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(false)
      setEditTitleValue('')
    } else {
      setEditingContentInModal(false)
      setEditContentValue('')
    }
  }

  const handleSaveManualEdit = async (type) => {
    if (!selectedContentForModal) return

    try {
      setSavingModalEdit(true)

      const updateData = {}
      if (type === 'title') {
        updateData.title = editTitleValue
      } else {
        updateData.content = editContentValue
      }

      const result = await contentAPI.updateContent(selectedContentForModal.id, updateData)

      if (result.success) {
        // Update the content in state
        setAllContent(prev => prev.map(item => 
          item.id === selectedContentForModal.id ? { ...item, ...updateData } : item
        ))

        // Update the modal content
        setSelectedContentForModal(prev => ({ ...prev, ...updateData }))

        // Reset edit state
        if (type === 'title') {
          setEditingTitleInModal(false)
          setEditTitleValue('')
        } else {
          setEditingContentInModal(false)
          setEditContentValue('')
        }

        showSuccess('Success', `${type === 'title' ? 'Title' : 'Content'} updated successfully`)
      } else {
        throw new Error(result.error || 'Failed to update content')
      }

    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSavingModalEdit(false)
    }
  }

  // fetchPostImages removed - images are now loaded directly from content_posts.primary_image_url via content.media_url

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
        
        // Close the modal if this content is currently open
        if (selectedContentForModal && selectedContentForModal.id === contentId) {
          setSelectedContentForModal(null)
        }
        
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

  const handleDisapprovePost = async (contentId) => {
    try {
      const result = await contentAPI.updateContentStatus(contentId, 'draft')
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: 'draft' })
        
        // Update the modal content if it's currently open
        if (selectedContentForModal && selectedContentForModal.id === contentId) {
          setSelectedContentForModal({ ...selectedContentForModal, status: 'draft' })
        }
        
        // Show success message immediately
        showSuccess('Post disapproved and moved back to draft!')
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error disapproving post:', error)
      showError('Failed to disapprove post', error.message)
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
      showError('No file selected', 'Please select an image or video to upload')
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
      
      // Update modal content if it's open
      if (selectedContentForModal && selectedContentForModal.id === postId) {
        setSelectedContentForModal(prev => ({
          ...prev,
          media_url: result.image_url,
          image_url: result.image_url
        }))
      }
      
      // Update allContent state with media_url (which comes from primary_image_url)
      setAllContent(prev => prev.map(item => 
        item.id === postId ? { ...item, media_url: result.image_url, image_url: result.image_url } : item
      ))
      
      // Update scheduled content if it exists
      setScheduledContent(prev => prev.map(item => 
        item.id === postId ? { ...item, media_url: result.image_url, image_url: result.image_url } : item
      ))
      
      // Close modal and reset
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
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
      setAllContent(prev => prev.filter(c => c.id !== content.id))
      
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

  // Get optimized card thumbnail for fast loading in content cards
  // Note: Supabase Storage doesn't support query parameter transformations by default
  // We'll use the original image but optimize loading with proper attributes
  const getCardThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // For now, return the original URL - browser and CSS will handle sizing
    // The image will be displayed at 96-112px (w-24 to w-28) so even large images
    // will be rendered at that size, and modern browsers optimize this
    return imageUrl
    
    // TODO: If you have Supabase Image Transformation enabled, you can use:
    // return `${imageUrl}?width=150&height=150&resize=cover&quality=40&format=webp`
    // Or use Supabase's image transformation service if configured
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
    <div className="h-screen bg-white overflow-hidden">
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
        <div className="fixed z-50 flex items-center justify-center md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="fixed bg-black bg-opacity-50 backdrop-blur-sm md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 z-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 mb-4">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generate Fresh Content
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will delete your old content and create fresh content for all platforms. 
                Are you sure you want to proceed?
              </p>
              <div className="mb-6">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={generateImagesWithContent}
                    onChange={(e) => setGenerateImagesWithContent(e.target.checked)}
                    className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500 focus:ring-2"
                  />
                  <div className="flex items-center space-x-2">
                    <Image className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      Also generate images for all content posts
                    </span>
                  </div>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Images will be generated automatically using your brand colors after content is created
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false)
                    setGenerateImagesWithContent(false)
                  }}
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
      <div className="md:ml-48 xl:ml-64 flex flex-col h-screen overflow-hidden">
        {/* Header with Channel Tabs */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
            {/* Layout */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0">
              <div className="flex-1">
                {/* Channel Tabs */}
                <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  {availableChannels.map((channel) => {
                    // Count only shows for currently selected channel (since we only fetch for selected channel)
                    const channelCount = selectedChannel === channel ? allContent.length : 0
                    return (
                      <button
                        key={channel}
                        onClick={() => setSelectedChannel(channel)}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap flex items-center space-x-2 ${
                          selectedChannel === channel
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span>{getPlatformIcon(channel)}</span>
                        <span className="capitalize">{channel}</span>
                        {selectedChannel === channel && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20">
                            {channelCount}
                          </span>
                        )}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => setSelectedChannel('all')}
                    className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 whitespace-nowrap flex items-center space-x-2 ${
                      selectedChannel === 'all'
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>All Channels</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      selectedChannel === 'all' ? 'bg-white/20' : 'bg-gray-200'
                    }`}>
                      {allContent.length}
                    </span>
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 md:ml-4 flex-shrink-0">
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 text-sm sm:text-base"
                >
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">View Calendar</span>
                  <span className="sm:hidden">Calendar</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col overflow-y-auto">
          {/* Status Message - Only show error messages */}
          {generationStatus === 'error' && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
              <div className="flex items-center">
                <RefreshCw className="w-5 h-5 mr-2" />
                <span className="font-medium">{generationMessage}</span>
              </div>
            </div>
          )}

          {/* Content Cards - 2 Row Grid Layout */}
          <div className="space-y-6">
            {!selectedChannel && (
              <div className="text-center py-12">
                <p className="text-gray-500">Please select a channel to view content</p>
              </div>
            )}
            {selectedChannel && fetchingContent && (
              <div className="text-center py-12">
                <p className="text-gray-600 font-medium">Loading content for {selectedChannel}...</p>
              </div>
            )}
            {selectedChannel && !fetchingContent && filteredContent.length === 0 && !generating && !fetchingFreshData && (
              <div className="text-center py-12">
                <p className="text-gray-500">No content found for {selectedChannel}</p>
                <p className="text-sm text-gray-400 mt-2">Try selecting a different channel or generate new content</p>
              </div>
            )}
            {!fetchingContent && filteredContent.length > 0 && (
              <div className="relative">
                <div 
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                >
                {filteredContent.map((content) => {
                  const theme = getPlatformCardTheme(content.platform)
                  console.log('Content platform:', content.platform, 'Theme:', theme)
                  
                  // Only load images for the selected channel
                  // Use case-insensitive comparison
                  const contentPlatform = content.platform?.toLowerCase().trim() || ''
                  const normalizedSelectedChannel = selectedChannel?.toLowerCase().trim() || ''
                  const isSelectedChannel = !selectedChannel || selectedChannel === 'all' || 
                    contentPlatform === normalizedSelectedChannel ||
                    (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) ||
                    (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) ||
                    (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google'))
                  
                  // Get image URL for left side - only if this is the selected channel
                  // Use content.media_url (which comes from primary_image_url) directly
                  const imageUrl = isSelectedChannel 
                    ? (content.media_url || content.image_url)
                    : null
                  const thumbnailUrl = imageUrl ? getCardThumbnailUrl(imageUrl) : null
                  const hasImage = isSelectedChannel && !!imageUrl
                  
                  // Debug logging for image URLs
                  if (content.id && !imageUrl && isSelectedChannel) {
                    console.log('⚠️ Content has no image:', content.id, {
                      hasMediaUrl: !!content.media_url,
                      hasContentImage: !!content.image_url,
                      content: content
                    })
                  }
                  
                  // Check if post is approved or scheduled (show green border)
                  const status = content.status?.toLowerCase()
                  const isApproved = status === 'approved' || status === 'scheduled'
                  
                  return (
                    <div 
                      key={content.id} 
                      onClick={() => handleViewContent(content)}
                      className={`${theme.bg} rounded-xl p-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer w-full overflow-hidden flex flex-col shadow-[0_0_8px_rgba(0,0,0,0.12),0_2px_4px_rgba(0,0,0,0.08)] hover:shadow-[0_0_16px_rgba(0,0,0,0.18),0_4px_8px_rgba(0,0,0,0.12)] ${
                        isApproved 
                          ? 'border border-green-500' 
                          : 'border border-transparent'
                      }`}
                    >
                      {/* Main Content: Image on Left, Content on Right */}
                      <div className="flex gap-4 mb-3 flex-1">
                        {/* Left Side: Image */}
                        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28">
                          {hasImage ? (
                            <div className="relative w-full h-full bg-gray-200 rounded-lg overflow-hidden">
                              {/* Show placeholder while loading */}
                              {imageLoading.has(content.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
                                </div>
                              )}
                              {(() => {
                                // Only get media URL if this is the selected channel
                                const mediaUrl = isSelectedChannel ? (imageUrl || content.media_url) : null
                                // Always prefer thumbnail for faster loading, fallback to original if thumbnail not available
                                const mediaThumbnail = isSelectedChannel ? (thumbnailUrl || mediaUrl) : null
                                
                                // Check if it's a video file - only load for selected channel
                                if (mediaUrl && isVideoFile(mediaUrl) && isSelectedChannel) {
                                  return (
                                    <video 
                                      src={mediaUrl}
                                      className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      controls={false}
                                      preload="metadata"
                                      muted
                                      playsInline
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleImageClick(mediaUrl, content.title)
                                      }}
                                      onLoadStart={() => {
                                        startImageLoading(content.id)
                                      }}
                                      onLoadedData={() => {
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        handleImageError(content.id)
                                      }}
                                      style={{
                                        opacity: imageLoading.has(content.id) ? 0 : 1,
                                        filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                        transition: 'all 0.5s ease-in-out'
                                      }}
                                    />
                                  )
                                }
                                
                                // Show image - using optimized thumbnail for fast loading
                                // Only load images for the selected channel
                                if (mediaThumbnail && isSelectedChannel) {
                                  // Use eager loading only for first 4 images (what's actually visible in viewport)
                                  // All others use lazy loading to prevent loading all images at once
                                  const imageIndex = filteredContent.findIndex(c => c.id === content.id)
                                  const shouldLoadEager = imageIndex < 4
                                  
                                  return (
                                    <img 
                                      src={mediaThumbnail} 
                                      alt="Content image" 
                                      className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                      loading={shouldLoadEager ? "eager" : "lazy"}
                                      decoding="async"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleImageClick(mediaUrl || mediaThumbnail, content.title)
                                      }}
                                      onLoad={() => {
                                        console.log('✅ Image loaded successfully:', content.id, mediaThumbnail)
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        console.error('❌ Image failed to load:', content.id, mediaThumbnail, e)
                                        // Try fallback to original URL if thumbnail fails
                                        if (mediaThumbnail !== mediaUrl) {
                                          console.log('🔄 Attempting fallback to original URL:', mediaUrl)
                                          // Force reload with original URL
                                          const img = e.target
                                          img.src = mediaUrl
                                        } else {
                                          handleImageError(content.id)
                                        }
                                      }}
                                      onLoadStart={() => {
                                        console.log('🔄 Image loading started:', content.id, mediaThumbnail)
                                        startImageLoading(content.id)
                                      }}
                                      style={{
                                        opacity: imageLoading.has(content.id) ? 0 : 1,
                                        filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                        transition: 'all 0.5s ease-in-out'
                                      }}
                                    />
                                  )
                                }
                                
                                return null
                              })()}
                            </div>
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg"></div>
                          )}
                        </div>
                        
                        {/* Right Side: Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header with Platform and Status */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0">
                              <h4 className={`font-semibold capitalize ${theme.text} text-sm truncate`}>{content.platform}</h4>
                            </div>
                            {/* Status Dropdown */}
                            <div className="relative status-dropdown flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setStatusDropdownOpen(statusDropdownOpen === content.id ? null : content.id)
                                }}
                                disabled={updatingStatus.has(content.id)}
                                className={`px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1 ${getStatusColor(content.status)} hover:opacity-80 transition-opacity disabled:opacity-50`}
                              >
                                <span className="capitalize text-xs">{content.status}</span>
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
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleStatusChange(content.id, option.value)
                                        }}
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
                          
                          {/* Title */}
                          {content.title && (
                            <h5 className="font-medium text-gray-900 mb-1.5 text-sm line-clamp-1">{content.title}</h5>
                          )}
                          
                          {/* Content Text */}
                          <p className="text-gray-700 text-xs mb-1.5 line-clamp-2 break-words overflow-hidden">{cleanContentText(content.content)}</p>
                          
                          {/* Read more link */}
                          {cleanContentText(content.content).length > 150 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewContent(content)
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                            >
                              Read more
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Bottom: Action Icons */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        {/* Date Display */}
                        {content.scheduled_at && (
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-pink-600" />
                            </div>
                            <div className="text-xs text-gray-700">
                              <div className="font-medium">{formatDate(content.scheduled_at).split(',')[0]}</div>
                              {content.scheduled_at.includes('T') && (
                                <div className="text-gray-500">{formatTime(content.scheduled_at.split('T')[1])}</div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Action Icons */}
                        <div className="flex items-center space-x-2 ml-auto">
                          <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditContent(content)
                              }}
                              onMouseEnter={() => setHoveredButton(`${content.id}-edit`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              className="w-8 h-8 bg-pink-100 hover:bg-pink-200 rounded-lg transition-all duration-200 flex items-center justify-center"
                            >
                              <Edit className="w-4 h-4 text-pink-600" />
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
                              className={`w-8 h-8 rounded-lg transition-all duration-200 flex items-center justify-center ${
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
                                handleOpenUploadModal(content.id)
                              }}
                              onMouseEnter={() => setHoveredButton(`${content.id}-upload`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              disabled={uploadingImage.has(content.id)}
                              className={`w-8 h-8 rounded-lg transition-all duration-200 flex items-center justify-center ${
                                uploadingImage.has(content.id)
                                  ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90'
                              }`}
                            >
                              {uploadingImage.has(content.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                            </button>
                            {hoveredButton === `${content.id}-upload` && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                {uploadingImage.has(content.id) ? 'Uploading...' : 'Upload Image/Video'}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                          
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                // Publish post to platform
                                handlePostContent(content)
                              }}
                              onMouseEnter={() => setHoveredButton(`${content.id}-share`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              disabled={postingContent.has(content.id)}
                              className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90 rounded-lg transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {postingContent.has(content.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Share2 className="w-4 h-4" />
                              )}
                            </button>
                            {hoveredButton === `${content.id}-share` && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                Publish to {content.platform}
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
                              className={`w-8 h-8 rounded-lg transition-all duration-200 flex items-center justify-center ${
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
                
                {/* Load More Button */}
                {hasMoreContent && !loadingAllContent && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={loadAllContent}
                      className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-sm font-medium transition-all duration-200 underline"
                    >
                      Load more
                    </button>
                  </div>
                )}
                {loadingAllContent && (
                  <div className="mt-8 text-center">
                    <p className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 text-sm font-medium">Loading all content...</p>
                  </div>
                )}
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
        <div className="fixed bottom-12 left-1/2 md:left-[calc(50%+96px)] xl:left-[calc(50%+128px)] transform -translate-x-1/2 z-50">
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
              className="w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full shadow-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 relative flex items-center justify-center"
            >
              <Plus className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </button>
          </div>
        </div>

      </div>

      {/* Content View Modal */}
      {selectedContentForModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-30"
          onClick={handleCloseModal}
        >
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pb-20"
            style={{ left: '12rem', right: '0' }}
          >
            <div 
              className="relative max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center space-x-3">
                  {(() => {
                    const theme = getPlatformCardTheme(selectedContentForModal.platform)
                    return (
                      <div className={`w-10 h-10 ${theme.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
                        <div className="text-white">
                          {getPlatformIcon(selectedContentForModal.platform)}
                        </div>
                      </div>
                    )
                  })()}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                      {selectedContentForModal.platform || 'Post'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {selectedContentForModal.scheduled_at ? (
                        new Date(selectedContentForModal.scheduled_at).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                      ) : 'No date set'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Image Section */}
                  <div className="space-y-4">
                    {(() => {
                      // Get image directly from content.media_url (which comes from primary_image_url)
                      const finalImageUrl = selectedContentForModal.media_url || selectedContentForModal.image_url
                      
                      if (!finalImageUrl) {
                        return (
                          <div className="w-full h-80 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                            <div className="text-center">
                              <Image className="w-16 h-16 text-gray-400 mx-auto mb-2" strokeWidth={1.5} />
                              <p className="text-gray-500 text-sm">No image available</p>
                            </div>
                          </div>
                        )
                      }
                      
                      return (
                        <div className="relative">
                          {isVideoFile(finalImageUrl) ? (
                            <video 
                              key={`video-${selectedContentForModal.id}-${Date.now()}`}
                              src={finalImageUrl}
                              className="w-full h-80 object-cover rounded-lg shadow-lg"
                              controls
                              preload="auto"
                              onError={(e) => {
                                console.error('❌ Video failed to load in modal:', finalImageUrl)
                              }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : (
                            <img
                              key={`img-${selectedContentForModal.id}-${Date.now()}`}
                              src={getFullSizeImageUrl(finalImageUrl) || finalImageUrl}
                              alt={selectedContentForModal.title || 'Post image'}
                              className="w-full h-80 object-cover rounded-lg shadow-lg cursor-pointer"
                              onClick={() => handleImageClick(getFullSizeImageUrl(finalImageUrl) || finalImageUrl, selectedContentForModal.title)}
                              loading="eager"
                              onError={(e) => {
                                console.error('❌ Image failed to load in modal:', finalImageUrl)
                                // Try to reload with a cache-busting parameter
                                const img = e.target
                                try {
                                  if (finalImageUrl.includes('http://') || finalImageUrl.includes('https://')) {
                                    const url = new URL(finalImageUrl)
                                    url.searchParams.set('t', Date.now().toString())
                                    img.src = url.toString()
                                  } else {
                                    // For relative URLs, append timestamp as query param
                                    const separator = finalImageUrl.includes('?') ? '&' : '?'
                                    img.src = `${finalImageUrl}${separator}t=${Date.now()}`
                                  }
                                } catch (urlError) {
                                  console.error('Failed to add cache-busting parameter:', urlError)
                                }
                              }}
                              onLoad={() => {
                                console.log('✅ Image loaded successfully in modal:', finalImageUrl)
                              }}
                            />
                          )}
                          
                          {/* Action buttons overlay */}
                          <div className="absolute bottom-4 right-4 flex gap-2">
                            {(() => {
                              // Use content.media_url (which comes from primary_image_url)
                              const finalImageUrl = selectedContentForModal.media_url || selectedContentForModal.image_url
                              
                              if (!finalImageUrl) return null
                              
                              return (
                                <>
                                  {!isVideoFile(finalImageUrl) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setImageEditorData({
                                          postContent: selectedContentForModal.content,
                                          inputImageUrl: finalImageUrl
                                        })
                                        setShowImageEditor(true)
                                        handleCloseModal()
                                      }}
                                      className="bg-white/90 hover:bg-white text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-md transition-colors"
                                    >
                                      Edit Image
                                    </button>
                                  )}
                                  <label className="bg-white/90 hover:bg-white text-gray-700 px-3 py-2 rounded-lg text-sm font-medium shadow-md transition-colors cursor-pointer inline-flex items-center space-x-1">
                                    <Upload className="w-4 h-4" />
                                    <span>Replace Media</span>
                                    <input
                                      type="file"
                                      accept="image/*,video/*"
                                      onChange={(e) => {
                                        const file = e.target.files[0]
                                        if (file) {
                                          handleFileSelect(e)
                                          setTimeout(() => {
                                            handleUploadImage(selectedContentForModal.id)
                                          }, 100)
                                        }
                                      }}
                                      className="hidden"
                                      disabled={uploadingImage.has(selectedContentForModal.id)}
                                    />
                                  </label>
                                </>
                              )
                            })()}
                          </div>
                          
                          {/* Uploading overlay */}
                          {uploadingImage.has(selectedContentForModal.id) && (
                            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                              <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
                                <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                                <span className="text-gray-900 font-medium">Uploading...</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    
                    {/* Media Header and Upload - Below image */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-gray-900">Media</h4>
                      <label className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 cursor-pointer text-sm font-medium transition-colors">
                        <Upload className="w-4 h-4" />
                        <span>Upload Media</span>
                        <input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(e) => {
                            const file = e.target.files[0]
                            if (file) {
                              handleFileSelect(e)
                              // Upload immediately after selection
                              setTimeout(() => {
                                handleUploadImage(selectedContentForModal.id)
                              }, 100)
                            }
                          }}
                          className="hidden"
                          disabled={uploadingImage.has(selectedContentForModal.id)}
                        />
                      </label>
                    </div>
                    
                    {/* Hashtags - Moved below image */}
                    {selectedContentForModal.hashtags && selectedContentForModal.hashtags.length > 0 && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Hashtags</h4>
                        <div className="flex flex-wrap gap-2 items-center">
                          {selectedContentForModal.hashtags.slice(0, 3).map((hashtag, index) => (
                            <span
                              key={index}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium"
                            >
                              #{hashtag}
                            </span>
                          ))}
                          {selectedContentForModal.hashtags.length > 3 && (
                            <span className="text-gray-500 text-sm font-medium px-2">
                              +{selectedContentForModal.hashtags.length - 3} more...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Text Content Section */}
                  <div className="space-y-6">
                    {/* Title */}
                    {selectedContentForModal.title && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">Title</h4>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleManualEdit('title')
                              }}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                              title="Edit manually"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAIEdit('title')
                              }}
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                              title="Edit with AI"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {editingTitleInModal ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editTitleValue}
                              onChange={(e) => setEditTitleValue(e.target.value)}
                              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200"
                              placeholder="Enter title"
                            />
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleSaveManualEdit('title')}
                                disabled={savingModalEdit}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-200 disabled:opacity-50"
                                title="Save"
                              >
                                {savingModalEdit ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleCancelManualEdit('title')}
                                disabled={savingModalEdit}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedContentForModal.title}</p>
                        )}
                      </div>
                    )}
                    
                    {/* Content */}
                    {selectedContentForModal.content && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">Content</h4>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleManualEdit('content')
                              }}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                              title="Edit manually"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAIEdit('content')
                              }}
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                              title="Edit with AI"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {editingContentInModal ? (
                          <div className="space-y-2">
                            <textarea
                              value={editContentValue}
                              onChange={(e) => setEditContentValue(e.target.value)}
                              className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 resize-none"
                              rows={6}
                              placeholder="Enter content"
                            />
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => handleSaveManualEdit('content')}
                                disabled={savingModalEdit}
                                className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-200 disabled:opacity-50"
                                title="Save"
                              >
                                {savingModalEdit ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleCancelManualEdit('content')}
                                disabled={savingModalEdit}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 disabled:opacity-50"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-700 bg-gray-50 p-4 pb-6 rounded-lg whitespace-pre-wrap leading-relaxed overflow-y-auto" style={{ height: '12rem' }}>
                            <div className="pb-4">
                              {cleanContentText(selectedContentForModal.content)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Status and Actions at Bottom */}
                    <div className="flex items-end justify-between pt-6 border-t border-gray-200 mt-6">
                      {/* Status on Left */}
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">Status & Actions</h4>
                        <div className="flex items-end space-x-4">
                          <select
                            value={selectedContentForModal.status}
                            onChange={(e) => {
                              const newStatus = e.target.value
                              handleStatusChange(selectedContentForModal.id, newStatus)
                              // Update modal content immediately
                              setSelectedContentForModal(prev => ({ ...prev, status: newStatus }))
                            }}
                            disabled={updatingStatus.has(selectedContentForModal.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                              getStatusColor(selectedContentForModal.status)
                            } ${updatingStatus.has(selectedContentForModal.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            {statusOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          {updatingStatus.has(selectedContentForModal.id) && (
                            <div className="flex items-center space-x-2 text-sm text-gray-500 pb-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Updating...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Approve/Disapprove Buttons on Right */}
                      <div className="flex items-center space-x-3">
                        {selectedContentForModal.status === 'draft' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApprovePost(selectedContentForModal.id)
                              handleCloseModal()
                            }}
                            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                          >
                            <CheckCircle className="w-5 h-5" />
                            <span>Approve</span>
                          </button>
                        )}
                        {(selectedContentForModal.status === 'scheduled' || selectedContentForModal.status === 'published' || selectedContentForModal.status?.toLowerCase() === 'approved') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDisapprovePost(selectedContentForModal.id)
                            }}
                            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg font-medium"
                          >
                            <XCircle className="w-5 h-5" />
                            <span>Disapprove</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Edit Modal */}
      {showAIEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60]"
          onClick={handleCancelAIEdit}
        >
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pb-20"
            style={{ left: '12rem', right: '0' }}
          >
            <div 
              className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Edit {aiEditType === 'title' ? 'Title' : 'Content'} with AI</h3>
                      <p className="text-sm text-gray-600">Provide instructions to modify the {aiEditType === 'title' ? 'title' : 'content'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelAIEdit}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Current Content Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current {aiEditType === 'title' ? 'Title' : 'Content'}</label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditType === 'title' 
                        ? (selectedContentForModal?.title || '')
                        : (selectedContentForModal?.content || '')
                      }
                    </div>
                  </div>
                  
                  {/* AI Instruction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Instruction <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={aiEditInstruction}
                        onChange={(e) => setAiEditInstruction(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        rows={5}
                        placeholder="Describe how you want the content to be modified..."
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {aiEditInstruction.length}/500
                      </div>
                    </div>
                    
                    {/* Instruction Examples */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">💡 Example instructions:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button
                          onClick={() => setAiEditInstruction("Make it more engaging and add relevant emojis")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          ✨ Make it more engaging
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Make it shorter and more concise")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          📝 Make it shorter
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Change the tone to be more professional")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          💼 Professional tone
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Add a call-to-action at the end")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          🎯 Add call-to-action
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancelAIEdit}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAISaveEdit}
                    disabled={aiEditing || !aiEditInstruction.trim() || aiEditInstruction.length > 500}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {aiEditing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>AI Editing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Edit with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Edit Confirmation Modal */}
      {showAIConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60]"
          onClick={handleAIConfirmCancel}
        >
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pb-20"
            style={{ left: '12rem', right: '0' }}
          >
            <div 
              className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">AI Edit Complete</h3>
                      <p className="text-sm text-gray-600">Review the AI-edited {aiEditType === 'title' ? 'title' : 'content'} before saving</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAIConfirmCancel}
                    className="w-8 h-8 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Original Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Original {aiEditType === 'title' ? 'Title' : 'Content'}</label>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditType === 'title' 
                        ? (selectedContentForModal?.title || '')
                        : (selectedContentForModal?.content || '')
                      }
                    </div>
                  </div>
                  
                  {/* AI Edited Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edited {aiEditType === 'title' ? 'Title' : 'Content'} <span className="text-pink-600">✨</span>
                    </label>
                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditedContent}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-purple-200">
                  <button
                    onClick={handleAIConfirmCancel}
                    className="px-4 py-2 text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAIConfirmSave}
                    disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save AI Edit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    {editForm.media_url && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-purple-800">Current Media:</span>
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                        <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                          {imageLoading.has(editForm.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          )}
                          
                          {isVideoFile(editForm.media_url) ? (
                            <video 
                              src={editForm.media_url}
                              className="w-full h-32 object-cover rounded-lg"
                              controls
                              preload="metadata"
                              onLoadStart={() => {
                                console.log('🔍 Video loading started, URL:', editForm.media_url)
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
                            src={getSmallThumbnailUrl(editForm.media_url)} 
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
          fetchAllContent();
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
                    <Send className="w-4 h-4" />
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
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl)
                  }
                  setPreviewUrl(null)
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
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,video/mp4,video/mov,video/avi,video/mkv,video/webm,video/wmv"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      if (file) {
                        // Cleanup previous preview URL
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl)
                        }
                        // Create new preview URL
                        const url = URL.createObjectURL(file)
                        setPreviewUrl(url)
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
                  Supported formats: Images (JPG, PNG, GIF, WebP - max 10MB) and Videos (MP4, MOV, AVI, MKV, WebM, WMV - max 100MB)
                </p>
              </div>
              
              {/* Selected File Preview */}
              {selectedFile && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 space-y-3">
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
                      onClick={() => {
                        if (previewUrl) {
                          URL.revokeObjectURL(previewUrl)
                        }
                        setPreviewUrl(null)
                        setSelectedFile(null)
                      }}
                      className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors"
                    >
                      <X className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  {/* Media Preview */}
                  {previewUrl && selectedFile.type.startsWith('video/') ? (
                    <div className="w-full">
                      <video
                        src={previewUrl}
                        controls
                        className="w-full h-48 object-cover rounded-lg border border-purple-200"
                      />
                    </div>
                  ) : previewUrl ? (
                    <div className="w-full">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg border border-purple-200"
                      />
                    </div>
                  ) : null}
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
                await fetchAllContent()
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
              
              // Refresh all content
              await fetchAllContent()
              
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
