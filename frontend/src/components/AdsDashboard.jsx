import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import ChatbotImageEditor from './ChatbotImageEditor'

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
  Sparkles,
  Target,
  Users,
  BarChart3,
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube,
  DollarSign,
  Eye,
  MousePointer,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Pause,
  Settings,
  MoreVertical,
  Copy,
  ExternalLink,
  ThumbsUp,
  MessageCircle,
  Heart,
  Share,
  Bookmark,
  Flag,
  Trash2,
  Archive,
  Send,
  Megaphone,
  Award,
  Star,
  TrendingDown,
  Activity,
  PieChart,
  LineChart,
  BarChart,
  Wand2,
  Loader2,
  X,
  Save,
  Target as TargetIcon,
  DollarSign as DollarIcon,
  Users as UsersIcon,
  Eye as EyeIcon,
  MousePointer as ClickIcon,
  Zap as ZapIcon,
  CheckCircle as CheckIcon,
  XCircle as XIcon,
  AlertCircle as AlertIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  Settings as SettingsIcon,
  MoreVertical as MoreIcon,
  Copy as CopyIcon,
  ExternalLink as ExternalIcon,
  ThumbsUp as LikeIcon,
  MessageCircle as CommentIcon,
  Heart as HeartIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
  Flag as FlagIcon,
  Trash2 as TrashIcon,
  Archive as ArchiveIcon,
  Send as SendIcon,
  Megaphone as MegaphoneIcon,
  Award as AwardIcon,
  Star as StarIcon,
  TrendingDown as TrendingDownIcon,
  Activity as ActivityIcon,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  BarChart as BarChartIcon
} from 'lucide-react'

const AdsDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const navigate = useNavigate()
  
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState('grid') // grid or list
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [generatedImages, setGeneratedImages] = useState({})
  const [imageLoading, setImageLoading] = useState(new Set())
  const [generatingMedia, setGeneratingMedia] = useState(new Set())
  const [expandedAds, setExpandedAds] = useState(new Set()) // Track expanded ads
  const [editingAd, setEditingAd] = useState(null) // Track which ad is being edited
  const [editForm, setEditForm] = useState({
    title: '',
    ad_copy: '',
    call_to_action: '',
    target_audience: '',
    budget_range: '',
    campaign_objective: '',
    hashtags: []
  })
  const [saving, setSaving] = useState(false) // Saving state for edit
  const [showUploadModal, setShowUploadModal] = useState(null) // Track which ad is showing upload modal
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track uploading state
  const [lightboxImage, setLightboxImage] = useState(null) // Track which image to show in lightbox
  const [lightboxLoading, setLightboxLoading] = useState(false) // Track lightbox image loading state
  const [showImageEditor, setShowImageEditor] = useState(false) // Track if image editor is open
  const [imageEditorData, setImageEditorData] = useState(null) // Data for image editor

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
    { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'bg-sky-500' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600' },
    { id: 'tiktok', name: 'TikTok', icon: Activity, color: 'bg-gray-900' },
    { id: 'google', name: 'Google', icon: Activity, color: 'bg-red-500' },
    { id: 'unknown', name: 'Unknown Platform', icon: AlertCircle, color: 'bg-gray-500' }
  ]
  
  // Debug: Check if icons are properly imported
  console.log('Icon imports check:', {
    Facebook: typeof Facebook,
    Instagram: typeof Instagram,
    Linkedin: typeof Linkedin,
    Twitter: typeof Twitter,
    Youtube: typeof Youtube,
    Activity: typeof Activity,
    AlertCircle: typeof AlertCircle
  })

  const adTypes = [
    { id: 'text', name: 'Text Ad', icon: FileText, color: 'bg-gray-500' },
    { id: 'image', name: 'Image Ad', icon: Image, color: 'bg-blue-500' },
    { id: 'video', name: 'Video Ad', icon: Play, color: 'bg-purple-500' },
    { id: 'carousel', name: 'Carousel Ad', icon: Grid, color: 'bg-green-500' },
    { id: 'story', name: 'Story Ad', icon: Zap, color: 'bg-orange-500' },
    { id: 'banner', name: 'Banner Ad', icon: Megaphone, color: 'bg-red-500' }
  ]

  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    published: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800'
  }

  useEffect(() => {
    fetchAds()
  }, [selectedDate])

  const fetchAds = async () => {
    try {
      setLoading(true)
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/by-date?date=${selectedDate}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Fetched ads data:', data.ads)
      console.log('Platforms in ads:', data.ads?.map(ad => ({ id: ad.id, platform: ad.platform, title: ad.title })))
      
      // Process ads to ensure platform field is present
      const processedAds = (data.ads || []).map(ad => {
        console.log('Processing ad:', ad.id, 'platform:', ad.platform)
        return {
          ...ad,
          platform: ad.platform || 'unknown'
        }
      })
      
      console.log('Processed ads:', processedAds)
      setAds(processedAds)
      
    } catch (error) {
      console.error('Error fetching ads:', error)
      showError('Failed to load ads', error.message)
    } finally {
      setLoading(false)
    }
  }


  const generateAds = async () => {
    try {
      setGenerating(true)
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      showSuccess('Ads generation started!', 'Your ads are being created in the background.')
      
      // Refresh ads after a short delay
      setTimeout(() => {
        fetchAds()
      }, 2000)
      
    } catch (error) {
      console.error('Error generating ads:', error)
      showError('Failed to generate ads', error.message)
    } finally {
      setGenerating(false)
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const getPlatformIcon = (platform) => {
    // Simple switch statement for reliable icon rendering
    switch (platform) {
      case 'facebook':
        return <Facebook className="w-6 h-6 text-white" />
      case 'instagram':
        return <Instagram className="w-6 h-6 text-white" />
      case 'linkedin':
        return <Linkedin className="w-6 h-6 text-white" />
      case 'twitter':
        return <Twitter className="w-6 h-6 text-white" />
      case 'youtube':
        return <Youtube className="w-6 h-6 text-white" />
      case 'tiktok':
        return <Activity className="w-6 h-6 text-white" />
      case 'google':
        return <Activity className="w-6 h-6 text-white" />
      default:
        return <AlertCircle className="w-6 h-6 text-white" />
    }
  }

  const getPlatformCardTheme = (platform) => {
    const themes = {
      facebook: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-500',
        text: 'text-blue-700'
      },
      instagram: {
        bg: 'bg-pink-50',
        border: 'border-pink-200',
        iconBg: 'bg-pink-500',
        text: 'text-pink-700'
      },
      linkedin: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        iconBg: 'bg-blue-600',
        text: 'text-blue-700'
      },
      twitter: {
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        iconBg: 'bg-sky-500',
        text: 'text-sky-700'
      },
      youtube: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-500',
        text: 'text-red-700'
      },
      tiktok: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        iconBg: 'bg-gray-900',
        text: 'text-gray-700'
      },
      google: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        iconBg: 'bg-red-500',
        text: 'text-red-700'
      },
      unknown: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        iconBg: 'bg-gray-500',
        text: 'text-gray-700'
      }
    }
    
    return themes[platform] || {
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      iconBg: 'bg-gray-500',
      text: 'text-gray-700'
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      published: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      approved: 'bg-green-100 text-green-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getAdTypeIcon = (adType) => {
    const typeData = adTypes.find(t => t.id === adType)
    if (!typeData) return <FileText className="w-4 h-4" />
    
    const IconComponent = typeData.icon
    return <IconComponent className="w-4 h-4" />
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'draft':
        return <Edit className="w-4 h-4" />
      case 'approved':
        return <CheckCircle className="w-4 h-4" />
      case 'rejected':
        return <XCircle className="w-4 h-4" />
      case 'published':
        return <Send className="w-4 h-4" />
      case 'paused':
        return <Pause className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }


  const toggleAdExpansion = (adId) => {
    setExpandedAds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(adId)) {
        newSet.delete(adId)
      } else {
        newSet.add(adId)
      }
      return newSet
    })
  }

  const handleEditAd = (ad) => {
    setEditingAd(ad)
    setEditForm({
      title: ad.title || '',
      ad_copy: ad.ad_copy || '',
      call_to_action: ad.call_to_action || '',
      target_audience: ad.target_audience || '',
      budget_range: ad.budget_range || '',
      campaign_objective: ad.campaign_objective || '',
      hashtags: ad.hashtags || []
    })
  }

  const handleCancelEdit = () => {
    setEditingAd(null)
    setEditForm({
      title: '',
      ad_copy: '',
      call_to_action: '',
      target_audience: '',
      budget_range: '',
      campaign_objective: '',
      hashtags: []
    })
  }

  const handleSaveEdit = async (adId) => {
    try {
      setSaving(true)
      const authToken = await getAuthToken()
      
      const url = `${API_BASE_URL}/api/ads/${adId}`
      console.log('🔧 PUT request URL:', url)
      console.log('🔧 Request data:', editForm)
      console.log('🔧 Auth token:', authToken ? 'Present' : 'Missing')
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(editForm)
      })

      console.log('🔧 Response status:', response.status)
      console.log('🔧 Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('🔧 Error response:', errorText)
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
      }

      showSuccess('Ad updated successfully!')
      setEditingAd(null)
      setEditForm({
        title: '',
        ad_copy: '',
        call_to_action: '',
        target_audience: '',
        budget_range: '',
        campaign_objective: '',
        hashtags: []
      })
      fetchAds()
      
    } catch (error) {
      console.error('Error updating ad:', error)
      showError('Failed to update ad', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCopyAd = (ad) => {
    const textToCopy = `${ad.title}\n\n${ad.ad_copy}\n\n${ad.call_to_action}`
    navigator.clipboard.writeText(textToCopy)
    showSuccess('Ad copied to clipboard!')
  }

  const handleApproveAd = async (adId) => {
    try {
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${adId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      showSuccess('Ad approved!')
      fetchAds()
      
    } catch (error) {
      console.error('Error approving ad:', error)
      showError('Failed to approve ad', error.message)
    }
  }

  const handleRejectAd = async (adId) => {
    try {
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${adId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      showSuccess('Ad rejected!')
      fetchAds()
      
    } catch (error) {
      console.error('Error rejecting ad:', error)
      showError('Failed to reject ad', error.message)
    }
  }

  const filteredAds = ads.filter(ad => {
    console.log('Filtering ad:', ad.id, 'platform:', ad.platform, 'status:', ad.status)
    const platformMatch = filterPlatform === 'all' || ad.platform === filterPlatform
    const statusMatch = filterStatus === 'all' || ad.status === filterStatus
    console.log('Platform match:', platformMatch, 'Status match:', statusMatch)
    return platformMatch && statusMatch
  })
  
  console.log('Filtered ads count:', filteredAds.length)
  console.log('Filtered ads platforms:', filteredAds.map(ad => ({ id: ad.id, platform: ad.platform })))



  const handleImageLoad = (adId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(adId)
      return newSet
    })
  }

  const handleImageError = (adId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(adId)
      return newSet
    })
  }

  const startImageLoading = (adId) => {
    setImageLoading(prev => new Set(prev).add(adId))
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

  const handleGenerateMedia = async (ad) => {
    try {
      setGeneratingMedia(prev => new Set(prev).add(ad.id))
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${ad.id}/generate-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      showSuccess('Media generated successfully!')
      
      // Update the ad with new media
      setAds(prev => prev.map(a => 
        a.id === ad.id 
          ? { ...a, media_url: result.media_url }
          : a
      ))
      
    } catch (error) {
      console.error('Error generating media:', error)
      showError('Failed to generate media', error.message)
    } finally {
      setGeneratingMedia(prev => {
        const newSet = new Set(prev)
        newSet.delete(ad.id)
        return newSet
      })
    }
  }

  const handleRegenerateMedia = async (ad) => {
    try {
      setGeneratingMedia(prev => new Set(prev).add(ad.id))
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${ad.id}/generate-media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      showSuccess('Media regenerated successfully!')
      
      // Update the ad with new media
      setAds(prev => prev.map(a => 
        a.id === ad.id 
          ? { ...a, media_url: result.media_url }
          : a
      ))
      
    } catch (error) {
      console.error('Error regenerating media:', error)
      showError('Failed to regenerate media', error.message)
    } finally {
      setGeneratingMedia(prev => {
        const newSet = new Set(prev)
        newSet.delete(ad.id)
        return newSet
      })
    }
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
      if (!validTypes.includes(file.type)) {
        showError('Invalid file type', 'Please select an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM) file')
        return
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showError('File too large', 'Please select a file smaller than 10MB')
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleUploadImage = async (adId) => {
    if (!selectedFile) {
      showError('No file selected', 'Please select a file to upload')
      return
    }

    try {
      setUploadingImage(prev => new Set(prev).add(adId))
      const authToken = await getAuthToken()
      
      const formData = new FormData()
      formData.append('file', selectedFile)
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${adId}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      showSuccess('Image uploaded successfully!')
      
      // Update the ad with new media
      setAds(prev => prev.map(a => 
        a.id === adId 
          ? { ...a, media_url: result.media_url }
          : a
      ))
      
      // Close modal and reset file
      setShowUploadModal(null)
      setSelectedFile(null)
      
    } catch (error) {
      console.error('Error uploading image:', error)
      showError('Failed to upload image', error.message)
    } finally {
      setUploadingImage(prev => {
        const newSet = new Set(prev)
        newSet.delete(adId)
        return newSet
      })
    }
  }

  // Handle image click to open lightbox
  const handleImageClick = (imageUrl, adTitle) => {
    console.log('🖼️ Opening lightbox for ad image:', imageUrl)
    setLightboxLoading(true)
    setLightboxImage({
      url: imageUrl,
      title: adTitle
    })
  }

  // Close lightbox
  const closeLightbox = () => {
    setLightboxImage(null)
    setLightboxLoading(false)
  }

  // Check if file is video
  const isVideoFile = (url) => {
    if (!url) return false
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov', '.wmv']
    return videoExtensions.some(ext => url.toLowerCase().includes(ext))
  }

  // Handle keyboard events for lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && lightboxImage) {
        closeLightbox()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [lightboxImage])

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (lightboxImage) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [lightboxImage])

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        {/* Mobile Navigation */}
        <MobileNavigation 
          setShowCustomContentChatbot={() => {}}
          handleGenerateContent={generateAds}
          generating={generating}
          fetchingFreshData={loading}
        />
        
        <SideNavbar />
        
        {/* Main Content */}
        <div className="md:ml-48 xl:ml-64 flex flex-col min-h-screen">
          {/* Fixed Header Skeleton */}
          <div className="fixed top-[52px] md:top-0 right-0 left-0 md:left-48 xl:left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
            <div className="px-2 md:px-6 lg:px-8 py-1.5 md:py-3 lg:py-4">
              <div className="flex justify-between items-center gap-0.5 md:gap-4 overflow-x-auto">
                <div className="flex items-center space-x-2 md:space-x-6">
                  {/* Stats Cards Skeleton */}
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 shadow-sm flex-shrink-0">
                      <div className="w-8 h-8 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg animate-pulse"></div>
                      <div>
                        <div className="h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-12 md:w-16 animate-pulse"></div>
                        <div className="h-5 bg-gradient-to-r from-purple-200 to-pink-200 rounded w-8 animate-pulse"></div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Generate Button Skeleton */}
                <div className="flex items-center space-x-2 md:space-x-4">
                  <div className="h-8 md:h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg w-8 md:w-32 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Content Area Skeleton */}
          <div className="flex-1 pt-24 md:pt-28 p-3 md:p-6">
            <div className="max-w-7xl mx-auto">
              {/* Filters Skeleton */}
              <div className="mb-4 md:mb-8">
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <div className="h-8 md:h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg w-full md:w-48 animate-pulse"></div>
                  <div className="h-8 md:h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg w-full md:w-32 animate-pulse"></div>
                  <div className="h-8 md:h-10 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg w-full md:w-32 animate-pulse"></div>
                </div>
              </div>

              {/* Ads Grid Skeleton */}
              <div className="flex items-center justify-center min-h-96">
                <div className="text-center">
                  <p className="text-gray-600 text-sm md:text-base">Ads content will appear here</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={() => {}}
        handleGenerateContent={generateAds}
        generating={generating}
        fetchingFreshData={loading}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content - No left margin on mobile, only on desktop */}
      <div className="md:ml-48 xl:ml-64 flex flex-col min-h-screen w-full">
        {/* Fixed Header */}
        <div className="fixed top-[52px] md:top-0 right-0 left-0 md:left-48 xl:left-64 bg-gradient-to-r from-pink-50 to-purple-50 shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-2 md:px-6 lg:px-8 py-1.5 md:py-3 lg:py-4">
            {/* Single Row for ALL Devices */}
            <div className="flex items-center justify-between md:justify-between gap-0.5 md:gap-4 w-full overflow-x-auto">
              
              {/* Left Side - Stats */}
              <div className="flex items-center gap-0.5 md:gap-3 flex-shrink-0">
                {/* Total Ads Stats Card */}
                <div className="flex items-center space-x-0.5 md:space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 xl:px-4 xl:py-2.5 shadow-sm">
                  <div className="p-0.5 md:p-1 lg:p-1.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-md flex-shrink-0">
                    <Calendar className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-xs text-gray-600 whitespace-nowrap font-medium leading-tight">
                      {selectedDate === new Date().toISOString().split('T')[0] ? "Today" : "Selected"}
                    </p>
                    <p className="text-[9px] md:text-sm lg:text-base font-bold text-gray-900 whitespace-nowrap leading-tight">{filteredAds.length}</p>
                  </div>
                </div>

                {/* Approved Stats Card */}
                <div className="flex items-center space-x-0.5 md:space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 xl:px-4 xl:py-2.5 shadow-sm">
                  <div className="p-0.5 md:p-1 lg:p-1.5 bg-gradient-to-r from-green-500 to-green-600 rounded-md flex-shrink-0">
                    <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-xs text-gray-600 whitespace-nowrap font-medium leading-tight">Approved</p>
                    <p className="text-[9px] md:text-sm lg:text-base font-bold text-gray-900 whitespace-nowrap leading-tight">
                      {ads.filter(ad => ad.status === 'approved').length}
                    </p>
                  </div>
                </div>

                {/* Platforms Stats Card */}
                <div className="flex items-center space-x-0.5 md:space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 xl:px-4 xl:py-2.5 shadow-sm">
                  <div className="p-0.5 md:p-1 lg:p-1.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-md flex-shrink-0">
                    <Target className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-xs text-gray-600 whitespace-nowrap font-medium leading-tight">Platforms</p>
                    <p className="text-[9px] md:text-sm lg:text-base font-bold text-gray-900 whitespace-nowrap leading-tight">
                      {new Set(filteredAds.map(ad => ad.platform)).size}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center gap-0.5 md:gap-3 flex-shrink-0">
                {/* Generate Button */}
                <button
                  onClick={generateAds}
                  disabled={generating}
                  className="flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-1.5 md:px-4 md:py-2 lg:px-6 lg:py-3 rounded-md md:rounded-lg lg:rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl h-8 w-8 md:w-auto md:h-auto flex-shrink-0"
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-5" />
                  )}
                  <span className="hidden md:inline ml-2 text-sm lg:text-base">{generating ? 'Generating...' : 'Generate Ads'}</span>
                </button>

                {/* Date Selector - Visible on all devices */}
                <div className="flex items-center space-x-1 md:space-x-2">
                  <Calendar className="w-3 h-3 md:w-4 md:h-4 text-gray-600 flex-shrink-0" />
                  <input
                    id="date-selector"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-1.5 py-0.5 md:px-2 md:py-1 text-[8px] md:text-xs border border-gray-300 rounded-md md:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm min-w-[90px] md:min-w-[120px] h-7 md:h-auto"
                    min="2025-01-01"
                    max="2025-12-31"
                  />
                </div>
                
                {/* Platform Filter */}
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="px-1 md:px-3 lg:px-4 py-1 md:py-2 text-[8px] md:text-sm border border-pink-200 rounded-md md:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm min-w-[60px] md:min-w-[120px] flex-shrink-0 h-8 md:h-auto"
                >
                  <option value="all">All Platforms</option>
                  {platforms.map(platform => (
                    <option key={platform.id} value={platform.id}>{platform.name}</option>
                  ))}
                </select>
                
                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-1 md:px-3 lg:px-4 py-1 md:py-2 text-[8px] md:text-sm border border-pink-200 rounded-md md:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm min-w-[50px] md:min-w-[100px] flex-shrink-0 h-8 md:h-auto"
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="published">Published</option>
                  <option value="paused">Paused</option>
                </select>
                
                {/* View Mode Toggle - Hidden on mobile */}
                <div className="hidden md:flex border border-pink-200 rounded-md md:rounded-lg overflow-hidden bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 md:p-1.5 lg:p-2 ${viewMode === 'grid' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'} h-8 md:h-auto`}
                  >
                    <Grid className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 md:p-1.5 lg:p-2 ${viewMode === 'list' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'} h-8 md:h-auto`}
                  >
                    <List className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full px-3 md:px-6">
          <div className="pt-24 md:pt-28">
          
          {filteredAds.length === 0 ? (
            <div className="p-6 md:p-12 text-center">
              <Megaphone className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No ads found</h3>
              <p className="text-sm md:text-base text-gray-500 mb-6">Generate your first ad campaign to get started</p>
              <button
                onClick={generateAds}
                disabled={generating}
                className="flex items-center px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 mx-auto"
              >
                {generating ? (
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 mr-2" />
                )}
                {generating ? 'Generating...' : 'Generate Ads'}
              </button>
            </div>
          ) : (
            <div 
              className={viewMode === 'grid' ? 'p-2 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6' : 'divide-y'}
            >
              {filteredAds.map(ad => {
                console.log('Rendering ad card:', ad.id, 'platform:', ad.platform, 'platform type:', typeof ad.platform)
                const platform = ad.platform?.toLowerCase() || 'unknown'
                const theme = getPlatformCardTheme(platform)
                const isExpanded = expandedAds.has(ad.id)
                console.log('Theme for platform', platform, ':', theme)
                return (
                  <div 
                    key={ad.id} 
                    className={`${viewMode === 'grid' ? 'bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer' : 'bg-white'} p-0`}
                    onClick={() => toggleAdExpansion(ad.id)}
                  >
                    {/* Card Content */}
                    <div className="p-5">
                    {!isExpanded ? (
                      // Collapsed View
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 md:w-12 md:h-12 ${theme.iconBg} rounded-lg md:rounded-xl flex items-center justify-center shadow-sm`}>
                              {(() => {
                                console.log('Platform for icon:', platform)
                                
                                switch (platform) {
                                  case 'facebook':
                                    return <Facebook className="w-6 h-6 text-white" />
                                  case 'instagram':
                                    return <Instagram className="w-6 h-6 text-white" />
                                  case 'linkedin':
                                    return <Linkedin className="w-6 h-6 text-white" />
                                  case 'twitter':
                                    return <Twitter className="w-6 h-6 text-white" />
                                  case 'youtube':
                                    return <Youtube className="w-6 h-6 text-white" />
                                  default:
                                    return <AlertCircle className="w-6 h-6 text-white" />
                                }
                              })()}
                            </div>
                            <div>
                              <h4 className={`text-sm md:text-base font-semibold capitalize ${theme.text}`}>{platform || 'Unknown Platform'}</h4>
                              <p className="text-xs md:text-sm text-gray-500">{ad.status}</p>
                            </div>
                          </div>
                          <div className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${getStatusColor(ad.status)}`}>
                            {ad.status}
                          </div>
                        </div>
                        {ad.title && (
                          <h5 className="font-medium text-sm md:text-base text-gray-900 mb-3">{ad.title}</h5>
                        )}
                        
                        {/* Media Display - Only show if ad has media */}
                        {ad.media_url && (
                          <div className="mb-3 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center space-x-1">
                                <span className="text-xs font-medium text-purple-800">Media</span>
                                <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">✓</span>
                              </div>
                            </div>
                            <div className="relative w-full aspect-square bg-gray-200 rounded overflow-hidden">
                              <img 
                                src={ad.media_url} 
                                alt="Ad media" 
                                className="w-full h-full object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                                loading="eager"
                                onLoad={() => handleImageLoad(ad.id)}
                                onError={() => handleImageError(ad.id)}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleImageClick(ad.media_url, ad.title)
                                }}
                              />
                            </div>
                          </div>
                        )}
                        
                        <p className="text-gray-600 text-xs md:text-sm mb-4 line-clamp-3">{ad.ad_copy}</p>
                        
                        {ad.ad_copy && ad.ad_copy.length > 150 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAdExpansion(ad.id)
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                          >
                            Read more
                          </button>
                        )}
                        
                        {/* Media Action Buttons */}
                        {!ad.media_url && (
                          <div className="flex gap-2 mt-4 mb-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleGenerateMedia(ad)
                              }}
                              disabled={generatingMedia.has(ad.id)}
                              className="flex-1 px-3 py-2 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1"
                            >
                              {generatingMedia.has(ad.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Generating...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3" />
                                  <span>Generate Media</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowUploadModal(ad.id)
                                setSelectedFile(null)
                              }}
                              className="flex-1 px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                            >
                              <Image className="w-3 h-3" />
                              <span>Upload Media</span>
                            </button>
                          </div>
                        )}

                        {/* Media Management Buttons - Show when media exists */}
                        {ad.media_url && (
                          <div className="flex gap-2 mt-4 mb-6">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRegenerateMedia(ad)
                              }}
                              disabled={generatingMedia.has(ad.id)}
                              className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-lg hover:from-pink-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-1"
                            >
                              {generatingMedia.has(ad.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Regenerating...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Regenerate</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setImageEditorData({
                                  postContent: ad.ad_copy,
                                  inputImageUrl: ad.media_url
                                })
                                setShowImageEditor(true)
                              }}
                              className="flex-1 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center space-x-1"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit Image</span>
                            </button>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-500 mb-4">
                          <div className="flex items-center space-x-1 md:space-x-2">
                            <span className="flex items-center">
                              {getAdTypeIcon(ad.ad_type)}
                              <span className="ml-0.5 md:ml-1 capitalize">{ad.ad_type}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-1 md:space-x-2">
                            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            <span className="whitespace-nowrap">{new Date(ad.scheduled_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-1 md:space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleApproveAd(ad.id)
                              }}
                              className="px-2 py-1 md:px-3 md:py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-[10px] md:text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRejectAd(ad.id)
                              }}
                              className="px-2 py-1 md:px-3 md:py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-[10px] md:text-xs"
                            >
                              Reject
                            </button>
                          </div>
                          
                          <div className="flex items-center space-x-0.5 md:space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditAd(ad)
                              }}
                              className="p-1 md:p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Ad"
                            >
                              <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyAd(ad)
                              }}
                              className="p-1 md:p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Copy Ad"
                            >
                              <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                      {/* Expanded View */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 md:w-12 md:h-12 ${theme.iconBg} rounded-lg md:rounded-xl flex items-center justify-center shadow-sm`}>
                              {(() => {
                                switch (platform) {
                                  case 'facebook':
                                    return <Facebook className="w-6 h-6 text-white" />
                                  case 'instagram':
                                    return <Instagram className="w-6 h-6 text-white" />
                                  case 'linkedin':
                                    return <Linkedin className="w-6 h-6 text-white" />
                                  case 'twitter':
                                    return <Twitter className="w-6 h-6 text-white" />
                                  case 'youtube':
                                    return <Youtube className="w-6 h-6 text-white" />
                                  default:
                                    return <AlertCircle className="w-6 h-6 text-white" />
                                }
                              })()}
                            </div>
                            <div>
                              <h4 className={`text-sm md:text-base font-semibold capitalize ${theme.text}`}>{platform || 'Unknown Platform'}</h4>
                              <p className="text-xs md:text-sm text-gray-500">{ad.status}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium ${getStatusColor(ad.status)}`}>
                              {ad.status}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleAdExpansion(ad.id)
                              }}
                              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {ad.title && (
                          <h5 className="font-medium text-sm md:text-base text-gray-900 mb-4">{ad.title}</h5>
                        )}
                        
                        <div className="mb-4">
                          <p className="text-gray-600 text-xs md:text-sm leading-relaxed">{ad.ad_copy}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-4 text-xs md:text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Call to Action:</span>
                            <p className="text-gray-800 break-words">{ad.call_to_action}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Target Audience:</span>
                            <p className="text-gray-800 break-words">{ad.target_audience}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Budget Range:</span>
                            <p className="text-gray-800 break-words">{ad.budget_range}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Campaign Objective:</span>
                            <p className="text-gray-800 break-words">{ad.campaign_objective}</p>
                          </div>
                        </div>
                        
                        {/* Media section moved to collapsed view */}
                        
                        {ad.hashtags && ad.hashtags.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1.5 md:gap-2">
                              {ad.hashtags.map((tag, index) => (
                                <span key={index} className="px-1.5 py-0.5 md:px-2 md:py-1 bg-blue-100 text-blue-800 text-[10px] md:text-xs rounded-full">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditAd(ad)
                              }}
                              className="p-1.5 md:p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Ad"
                            >
                              <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyAd(ad)
                              }}
                              className="p-1.5 md:p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Copy Ad"
                            >
                              <Share2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Media Management Buttons - Show when media exists */}
                        {ad.media_url && (
                          <div className="flex gap-2 mt-4 mb-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRegenerateMedia(ad)
                              }}
                              disabled={generatingMedia.has(ad.id)}
                              className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white text-xs rounded-lg hover:from-pink-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-1"
                            >
                              {generatingMedia.has(ad.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Regenerating...</span>
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-3 h-3" />
                                  <span>Regenerate</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setImageEditorData({
                                  postContent: ad.ad_copy,
                                  inputImageUrl: ad.media_url
                                })
                                setShowImageEditor(true)
                              }}
                              className="flex-1 px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center space-x-1"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Edit Image</span>
                            </button>
                          </div>
                        )}
                        
                        {/* Approve/Reject buttons after content */}
                        <div className="flex items-center justify-center space-x-1.5 md:space-x-2 mt-4 flex-wrap gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApproveAd(ad.id)
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-500 transition-all duration-300 text-xs md:text-sm"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRejectAd(ad.id)
                            }}
                            className="flex items-center space-x-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-500 transition-all duration-300 text-xs md:text-sm"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </>
                    )}
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
      {editingAd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Ad</h3>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter ad title"
                  />
                </div>

                {/* Ad Copy */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad Copy
                  </label>
                  <textarea
                    value={editForm.ad_copy}
                    onChange={(e) => setEditForm(prev => ({ ...prev, ad_copy: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter ad content"
                  />
                </div>

                {/* Call to Action */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call to Action
                  </label>
                  <input
                    type="text"
                    value={editForm.call_to_action}
                    onChange={(e) => setEditForm(prev => ({ ...prev, call_to_action: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter call to action"
                  />
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={editForm.target_audience}
                    onChange={(e) => setEditForm(prev => ({ ...prev, target_audience: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter target audience"
                  />
                </div>

                {/* Budget Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget Range
                  </label>
                  <input
                    type="text"
                    value={editForm.budget_range}
                    onChange={(e) => setEditForm(prev => ({ ...prev, budget_range: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter budget range"
                  />
                </div>

                {/* Campaign Objective */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Objective
                  </label>
                  <input
                    type="text"
                    value={editForm.campaign_objective}
                    onChange={(e) => setEditForm(prev => ({ ...prev, campaign_objective: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter campaign objective"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hashtags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.hashtags.join(', ')}
                    onChange={(e) => setEditForm(prev => ({ 
                      ...prev, 
                      hashtags: e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag)
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="hashtag1, hashtag2, hashtag3"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEdit(editingAd.id)}
                  disabled={saving}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Media</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Image or Video
              </label>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUploadModal(null)
                  setSelectedFile(null)
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUploadImage(showUploadModal)}
                disabled={!selectedFile || uploadingImage.has(showUploadModal)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingImage.has(showUploadModal) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
                <span>{uploadingImage.has(showUploadModal) ? 'Uploading...' : 'Upload'}</span>
              </button>
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
              />
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
        </div>
      )}

      {/* Chatbot Image Editor Modal */}
      {showImageEditor && imageEditorData && (
        <ChatbotImageEditor
          isOpen={showImageEditor}
          onClose={() => {
            setShowImageEditor(false)
            setImageEditorData(null)
            
            // Refresh the ads dashboard after modal closes (with a small delay)
            setTimeout(async () => {
              try {
                await fetchAds()
              } catch (error) {
                console.error('Error refreshing ads after modal close:', error)
              }
            }, 100) // Small delay to ensure modal is fully closed
          }}
          postContent={imageEditorData.postContent}
          inputImageUrl={imageEditorData.inputImageUrl}
          onImageSaved={async (newImageUrl) => {
            // The image URL stays the same, but the content is replaced
            // We need to refresh the ads data to show the updated image
            try {
              // Refresh the ads data to get the updated image
              await fetchAds()
              
              // Show success message
              showSuccess('Image saved successfully! The edited image has replaced the original.')
            } catch (error) {
              console.error('Error refreshing ads after image save:', error)
              showError('Image saved but failed to refresh ads', 'Please refresh the page to see the updated image.')
            }
            
            setShowImageEditor(false)
            setImageEditorData(null)
          }}
        />
      )}
    </div>
  )
}

export default AdsDashboard
