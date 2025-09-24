import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
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


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
        <SideNavbar />
        <div className="ml-64 flex items-center justify-center min-h-screen">
          <MainContentLoader message="Loading ads dashboard..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
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
                        {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Ads" : "Selected Date Ads"}
                      </p>
                      <p className="text-lg font-bold text-gray-900">{filteredAds.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Approved</p>
                      <p className="text-lg font-bold text-gray-900">
                        {ads.filter(ad => ad.status === 'approved').length}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-white" />
                    </div>
              <div>
                      <p className="text-xs font-medium text-gray-600">Platforms</p>
                      <p className="text-lg font-bold text-gray-900">
                        {new Set(filteredAds.map(ad => ad.platform)).size}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={generateAds}
                  disabled={generating}
                  className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50"
                >
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>{generating ? 'Generating...' : 'Generate Ads'}</span>
                </button>
                
                {/* Filter and View Controls */}
                <div className="flex items-center space-x-4">
                  {/* Date Selector */}
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    <div>
                      <label htmlFor="date-selector" className="text-sm font-medium text-gray-700">
                        Select Date:
                      </label>
                      <input
                        id="date-selector"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="ml-2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                        min="2025-01-01"
                        max="2025-12-31"
                      />
                    </div>
                  </div>
                  
                  {/* Platform Filter */}
                  <select
                    value={filterPlatform}
                    onChange={(e) => setFilterPlatform(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
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
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="published">Published</option>
                    <option value="paused">Paused</option>
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
          {/* Ads Grid/List */}
          <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">Ads</h2>
          </div>
          
          {filteredAds.length === 0 ? (
            <div className="p-12 text-center">
              <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No ads found</h3>
              <p className="text-gray-500 mb-6">Generate your first ad campaign to get started</p>
              <button
                onClick={generateAds}
                disabled={generating}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 mx-auto"
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
            <div className={`grid gap-6 items-start ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1'} p-6`}>
              {filteredAds.map(ad => {
                console.log('Rendering ad card:', ad.id, 'platform:', ad.platform, 'platform type:', typeof ad.platform)
                const platform = ad.platform?.toLowerCase() || 'unknown'
                const theme = getPlatformCardTheme(platform)
                const isExpanded = expandedAds.has(ad.id)
                console.log('Theme for platform', platform, ':', theme)
                return (
                  <div 
                    key={ad.id} 
                    className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm p-6 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer self-start`}
                    onClick={() => toggleAdExpansion(ad.id)}
                  >
                    {!isExpanded ? (
                      // Collapsed View
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
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
                              <h4 className={`font-semibold capitalize ${theme.text}`}>{platform || 'Unknown Platform'}</h4>
                              <p className="text-sm text-gray-500">{ad.status}</p>
                            </div>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
                            {ad.status}
                          </div>
                        </div>
                      
                        {ad.title && (
                          <h5 className="font-medium text-gray-900 mb-3">{ad.title}</h5>
                        )}
                        
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">{ad.ad_copy}</p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                          <div className="flex items-center space-x-2">
                            <span className="flex items-center">
                              {getAdTypeIcon(ad.ad_type)}
                              <span className="ml-1 capitalize">{ad.ad_type}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(ad.scheduled_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleApproveAd(ad.id)
                              }}
                              className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs"
                            >
                              Approve
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRejectAd(ad.id)
                              }}
                              className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs"
                            >
                              Reject
                            </button>
                          </div>
                          
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditAd(ad)
                              }}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Ad"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyAd(ad)
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Copy Ad"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      // Expanded View
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 ${theme.iconBg} rounded-xl flex items-center justify-center shadow-sm`}>
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
                              <h4 className={`font-semibold capitalize ${theme.text}`}>{platform || 'Unknown Platform'}</h4>
                              <p className="text-sm text-gray-500">{ad.status}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ad.status)}`}>
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
                          <h5 className="font-medium text-gray-900 mb-4">{ad.title}</h5>
                        )}
                        
                        <div className="mb-4">
                          <p className="text-gray-700 text-sm leading-relaxed">{ad.ad_copy}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <span className="font-medium text-gray-600">Call to Action:</span>
                            <p className="text-gray-800">{ad.call_to_action}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Target Audience:</span>
                            <p className="text-gray-800">{ad.target_audience}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Budget Range:</span>
                            <p className="text-gray-800">{ad.budget_range}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Campaign Objective:</span>
                            <p className="text-gray-800">{ad.campaign_objective}</p>
                          </div>
                        </div>
                        
                        {ad.media_url && (
                          <div className="mb-4">
                            <img 
                              src={ad.media_url} 
                              alt="Ad media" 
                              className="w-full h-48 object-cover rounded-lg"
                              onLoad={() => handleImageLoad(ad.id)}
                              onError={() => handleImageError(ad.id)}
                            />
                          </div>
                        )}
                        
                        {!ad.media_url && ad.ad_type === 'image' && (
                          <div className="mb-4">
                            <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center">
                              <div className="text-center">
                                <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm mb-3">No media generated yet</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateMedia(ad)
                                  }}
                                  disabled={generatingMedia.has(ad.id)}
                                  className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 mx-auto"
                                >
                                  {generatingMedia.has(ad.id) ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  ) : (
                                    <Sparkles className="w-4 h-4 mr-2" />
                                  )}
                                  Generate Media
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {ad.hashtags && ad.hashtags.length > 0 && (
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-2">
                              {ad.hashtags.map((tag, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
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
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Edit Ad"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyAd(ad)
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                              title="Copy Ad"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Approve/Reject buttons after content */}
                        <div className="flex items-center justify-center space-x-2 mt-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApproveAd(ad.id)
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRejectAd(ad.id)
                            }}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </>
                    )}
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
    </div>
  )
}

export default AdsDashboard
