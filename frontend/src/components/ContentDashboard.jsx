import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useContentCache } from '../contexts/ContentCacheContext'
import { contentAPI } from '../services/content'
import mediaService from '../services/media'
import { supabase } from '../lib/supabase'
import ContentProgress from './ContentProgress'
import LoadingBar from './LoadingBar'
import SideNavbar from './SideNavbar'

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
  Edit,
  Share2,
  Download,
  Filter,
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
  Youtube,
  Wand2,
  Loader2,
  Upload,
  X
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
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [postingContent, setPostingContent] = useState(new Set()) // Track which content is being posted
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set()) // Track expanded campaigns
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]) // Current date in YYYY-MM-DD format
  const [dateContent, setDateContent] = useState([]) // Content for selected date
  const [editingContent, setEditingContent] = useState(null) // Content being edited
  const [editForm, setEditForm] = useState({}) // Edit form data
  const [saving, setSaving] = useState(false) // Saving state
  const [expandedContent, setExpandedContent] = useState(null) // Content being viewed/expanded
  const [generatingMedia, setGeneratingMedia] = useState(new Set()) // Track which content is generating media
  const [generatedImages, setGeneratedImages] = useState({}) // Store generated images by content ID
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track which content is uploading image
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [imageLoading, setImageLoading] = useState(new Set()) // Track which images are loading
  const [refreshingImages, setRefreshingImages] = useState(false) // Track if refreshing all images

  // Define refreshAllImages function early to avoid hoisting issues
  const refreshAllImages = async (contentList = null) => {
    const contentToRefresh = contentList || contentToDisplay
    if (!contentToRefresh || contentToRefresh.length === 0) return
    
    setRefreshingImages(true)
    try {
      // Fetch images for all content posts in parallel
      const imagePromises = contentToRefresh.map(async (post) => {
        try {
          const result = await mediaService.getPostImages(post.id)
          if (result.images && result.images.length > 0) {
            const latestImage = result.images[0]
            return {
              postId: post.id,
              imageData: {
                image_url: latestImage.image_url,
                cost: latestImage.generation_cost,
                generation_time: latestImage.generation_time,
                generated_at: latestImage.created_at,
                is_approved: latestImage.is_approved
              }
            }
          }
          return null
        } catch (error) {
          console.error(`Error fetching images for post ${post.id}:`, error)
          return null
        }
      })

      const results = await Promise.all(imagePromises)
      
      // Update state with all fetched images
      const newImages = {}
      results.forEach(result => {
        if (result) {
          newImages[result.postId] = result.imageData
        }
      })
      
      setGeneratedImages(prev => ({
        ...prev,
        ...newImages
      }))
      
      console.log('Refreshed images for', Object.keys(newImages).length, 'posts')
    } catch (error) {
      console.error('Error refreshing images:', error)
    } finally {
      setRefreshingImages(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchContentByDate(selectedDate)
  }, [])

  // Images are now loaded immediately when content is fetched, so this useEffect is no longer needed

  useEffect(() => {
    fetchContentByDate(selectedDate)
  }, [selectedDate])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchScheduledContent(forceRefresh)
      
      console.log('Fetched content data:', result)
      console.log('Cache status:', getCacheStatus())
      
      if (result.data) {
        console.log('Content items:', result.data)
        console.log('Platform values in content:', result.data.map(item => ({ id: item.id, platform: item.platform })))
        console.log('Data source:', result.fromCache ? 'cache' : 'API')
        
        // Load images immediately for all scheduled content
        for (const content of result.data) {
          await fetchPostImages(content.id)
        }
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
    }
  }

  const fetchContentByDate = async (date) => {
    try {
      const result = await contentAPI.getContentByDate(date)
      
      console.log('Fetched content for date:', date, result)
      
      if (result.data) {
        setDateContent(result.data)
        console.log('Date content items:', result.data)
        
        // Load images immediately for all date content
        for (const content of result.data) {
          await fetchPostImages(content.id)
        }
      } else {
        setDateContent([])
      }
    } catch (error) {
      console.error('Error fetching content by date:', error)
      setDateContent([])
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
          if (scheduledContent.length > 0) {
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
      
      const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
      const response = await fetch(`${API_BASE_URL}/content/trigger-weekly`, {
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

  // Use date-specific content if available, otherwise fall back to scheduled content
  // Only fall back to scheduled content if we're viewing today's date
  const contentToDisplay = selectedDate === new Date().toISOString().split('T')[0] 
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

  if (loading) {
    return <LoadingBar message="Loading your content..." />
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

  const handleEditContent = (content) => {
    setEditingContent(content)
    setEditForm({
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
        setGeneratedImages(prev => ({
          ...prev,
          [postId]: {
            image_url: latestImage.image_url,
            cost: latestImage.generation_cost,
            generation_time: latestImage.generation_time,
            generated_at: latestImage.created_at,
            is_approved: latestImage.is_approved
          }
        }))
      }
    } catch (error) {
      console.error('Error fetching post images:', error)
    }
  }

  const handleGenerateMedia = async (content) => {
    try {
      // Add to generating set
      setGeneratingMedia(prev => new Set(prev).add(content.id))
      
      const result = await mediaService.generateMedia(content.id)
      
      if (result.success) {
        // Fetch the generated image from Supabase
        await fetchPostImages(content.id)
        
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

  const handleUploadImage = async (postId) => {
    if (!selectedFile) {
      showError('No file selected', 'Please select an image to upload')
      return
    }

    try {
      setUploadingImage(prev => new Set(prev).add(postId))
      
      // Upload file to Supabase storage
      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `${postId}-${Date.now()}.${fileExt}`
      const filePath = `user-uploads/${fileName}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ai-generated-images')
        .upload(filePath, selectedFile)
      
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('ai-generated-images')
        .getPublicUrl(filePath)
      
      const imageUrl = urlData.publicUrl
      
      // Update the image in the database
      const { data: existingImages } = await supabase
        .from('content_images')
        .select('id')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (existingImages && existingImages.length > 0) {
        // Update existing image
        const { error: updateError } = await supabase
          .from('content_images')
          .update({
            image_url: imageUrl,
            is_approved: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingImages[0].id)
        
        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`)
        }
      } else {
        // Create new image record
        const { error: insertError } = await supabase
          .from('content_images')
          .insert({
            post_id: postId,
            image_url: imageUrl,
            image_prompt: 'User uploaded image',
            image_style: 'user_upload',
            image_size: 'custom',
            image_quality: 'custom',
            generation_model: 'user_upload',
            generation_cost: 0,
            generation_time: 0,
            is_approved: true
          })
        
        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`)
        }
      }
      
      // Update local state
      setGeneratedImages(prev => ({
        ...prev,
        [postId]: {
          image_url: imageUrl,
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
      showError('Failed to upload image', error.message)
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
    
    // If it's a Supabase storage URL, add resize transformation for thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/')) {
      // Add resize transformation to create a 200x200 thumbnail
      return `${imageUrl}?width=200&height=200&resize=cover&quality=80`
    }
    
    // For external URLs, return as is (could add external thumbnail service later)
    return imageUrl
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
                      <p className="text-xs font-medium text-gray-600">
                        {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Content" : "Selected Date Content"}
                      </p>
                      <p className="text-lg font-bold text-gray-900">{contentToDisplay.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Platforms</p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Set(contentToDisplay.map(content => content.platform)).size}
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
                        {contentToDisplay.filter(content => content.media_url).length}
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
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{generating ? 'Generating...' : 'Generate Content'}</span>
                </button>
                
                <button
                  onClick={refreshAllImages}
                  disabled={refreshingImages}
                  className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white px-4 py-2 rounded-lg hover:from-cyan-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50"
                  title="Refresh all images to load latest versions"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshingImages ? 'animate-spin' : ''}`} />
                  <span>{refreshingImages ? 'Refreshing...' : 'Refresh Images'}</span>
                </button>
                
                {/* Filter and View Controls */}
                <div className="flex items-center space-x-4">
                  {/* Date Selector */}
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <div>
                      <label htmlFor="date-slider" className="text-sm font-medium text-gray-700">
                        Select Date:
                      </label>
                    <input
                        id="date-slider"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                        min="2025-01-01"
                        max="2025-12-31"
                      />
                    </div>
                  </div>
                  
                  
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
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {selectedDate === new Date().toISOString().split('T')[0] 
                    ? "No content for today" 
                    : `NO content planned for ${new Date(selectedDate).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}`
                  }
                </h3>
                <p className="text-gray-500 mb-6">
                  {selectedDate === new Date().toISOString().split('T')[0] 
                    ? "Generate content to see it displayed here" 
                    : "Try selecting a different date or generate content for this date"
                  }
                </p>
                <button
                  onClick={handleGenerateContent}
                  disabled={generating}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 mx-auto"
                >
                  {generating ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
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
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{content.content}</p>
                        
                        {/* Media Display */}
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
                                src={getThumbnailUrl(generatedImages[content.id].image_url)} 
                                alt="Generated content thumbnail" 
                                className="w-full h-48 object-cover rounded-lg"
                                loading="lazy"
                                onLoad={() => handleImageLoad(content.id)}
                                onError={() => handleImageError(content.id)}
                                onLoadStart={() => startImageLoading(content.id)}
                                style={{
                                  opacity: imageLoading.has(content.id) ? 0 : 1,
                                  transition: 'opacity 0.3s ease-in-out'
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
                        <p className="text-gray-700 text-sm mb-4 line-clamp-3">{content.content}</p>
                        
                        {/* Media Preview */}
                        {generatedImages[content.id] && (
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
                              {imageLoading.has(content.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                                </div>
                              )}
                              <img 
                                src={getThumbnailUrl(generatedImages[content.id].image_url)} 
                                alt="Generated content thumbnail" 
                                className="w-full h-full object-cover rounded"
                                loading="lazy"
                                onLoad={() => handleImageLoad(content.id)}
                                onError={() => handleImageError(content.id)}
                                onLoadStart={() => startImageLoading(content.id)}
                                style={{
                                  opacity: imageLoading.has(content.id) ? 0 : 1,
                                  transition: 'opacity 0.3s ease-in-out'
                                }}
                              />
                            </div>
                          </div>
                        )}
                        
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
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditContent(content)
                          }}
                          className={`p-2 ${theme.accent} hover:opacity-80 rounded-lg transition-all duration-200 ${theme.text}`} 
                          title="Edit Content"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation()
                            handleGenerateMedia(content)
                          }}
                          disabled={generatingMedia.has(content.id)}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            generatingMedia.has(content.id)
                              ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                              : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                          }`}
                          title={generatingMedia.has(content.id) ? 'Generating Media...' : 'Generate Media'}
                        >
                          {generatingMedia.has(content.id) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePostContent(content)
                          }}
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
                            <RefreshCw className="w-4 h-4 animate-spin" />
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
                            src={getThumbnailUrl(generatedImages[editForm.id].image_url)} 
                            alt="Current content thumbnail" 
                            className="w-full h-32 object-cover rounded-lg"
                            loading="lazy"
                            onLoad={() => handleImageLoad(editForm.id)}
                            onError={() => handleImageError(editForm.id)}
                            onLoadStart={() => startImageLoading(editForm.id)}
                            style={{
                              opacity: imageLoading.has(editForm.id) ? 0 : 1,
                              transition: 'opacity 0.3s ease-in-out'
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
                        <button
                          onClick={() => handleUploadImage(editForm.id)}
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

    </div>
  )
}

export default ContentDashboard
