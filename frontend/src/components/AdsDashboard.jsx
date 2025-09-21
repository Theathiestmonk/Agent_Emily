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
  const [editingAd, setEditingAd] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '',
    ad_copy: '',
    call_to_action: '',
    hashtags: []
  })
  const [saving, setSaving] = useState(false)

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600' },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-500' },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-700' },
    { id: 'twitter', name: 'Twitter', icon: Twitter, color: 'bg-sky-500' },
    { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600' }
  ]

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
      setAds(data.ads || [])
      
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
    const platformData = platforms.find(p => p.id === platform)
    if (!platformData) return <div className="w-6 h-6 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
    
    const IconComponent = platformData.icon
    return <IconComponent className="w-6 h-6" />
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

  const handleEditAd = (ad) => {
    setEditingAd(ad)
    setEditForm({
      title: ad.title || '',
      ad_copy: ad.ad_copy || '',
      call_to_action: ad.call_to_action || '',
      hashtags: ad.hashtags || []
    })
  }

  const handleSaveEdit = async (adId) => {
    try {
      const authToken = await getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/api/ads/${adId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(editForm)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      showSuccess('Ad updated successfully!')
      setEditingAd(null)
      fetchAds()
      
    } catch (error) {
      console.error('Error updating ad:', error)
      showError('Failed to update ad', error.message)
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
    const platformMatch = filterPlatform === 'all' || ad.platform === filterPlatform
    const statusMatch = filterStatus === 'all' || ad.status === filterStatus
    return platformMatch && statusMatch
  })



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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
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
            <h2 className="text-xl font-semibold text-gray-900">Ads for {new Date(selectedDate).toLocaleDateString()}</h2>
            <p className="text-gray-600 mt-1">{filteredAds.length} ads found</p>
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
            <div className={viewMode === 'grid' ? 'p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'divide-y'}>
              {filteredAds.map(ad => {
                const isExpanded = true // Always show expanded view
                const theme = {
                  primary: 'bg-gradient-to-r from-purple-500 to-pink-500',
                  secondary: 'bg-gradient-to-r from-blue-500 to-indigo-500',
                  accent: 'bg-purple-100 text-purple-800',
                  text: 'text-purple-800'
                }

                return (
                  <div key={ad.id} className={`${viewMode === 'grid' ? 'bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200' : 'bg-white'} ${isExpanded ? 'ring-2 ring-purple-200' : ''}`}>
                    {/* Always show expanded view */}
                    {false ? (
                      <div className="p-4 cursor-pointer" onClick={() => toggleAdExpansion(ad.id)}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${platforms.find(p => p.id === ad.platform)?.color || 'bg-gray-500'} text-white`}>
                              {getPlatformIcon(ad.platform)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm">{ad.title}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[ad.status]}`}>
                                  {ad.status}
                                </span>
                                <span className="flex items-center text-xs text-gray-500">
                                  {getAdTypeIcon(ad.ad_type)}
                                  <span className="ml-1 capitalize">{ad.ad_type}</span>
                                </span>
                                <span className="text-xs text-gray-500 capitalize">
                                  {ad.platform}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{ad.ad_copy}</p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {formatDate(ad.scheduled_at)}
                          </span>
                          <span className="flex items-center">
                            <DollarSign className="w-3 h-3 mr-1" />
                            {ad.budget_range}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Expanded View */
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${platforms.find(p => p.id === ad.platform)?.color || 'bg-gray-500'} text-white`}>
                              {getPlatformIcon(ad.platform)}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <span className={`px-2 py-1 text-xs rounded-full ${statusColors[ad.status]}`}>
                                  {ad.status}
                                </span>
                                <span className="flex items-center text-xs text-gray-500">
                                  {getAdTypeIcon(ad.ad_type)}
                                  <span className="ml-1 capitalize">{ad.ad_type}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleEditAd(ad)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCopyAd(ad)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        {/* Media Display */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-600">Ad Visual</span>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleGenerateMedia(ad)}
                                disabled={generatingMedia.has(ad.id)}
                                className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded hover:opacity-90 transition-colors disabled:opacity-50 flex items-center space-x-1"
                              >
                                {generatingMedia.has(ad.id) ? (
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
                            </div>
                          </div>
                          <div className="relative w-full aspect-square bg-gray-200 rounded-lg overflow-hidden">
                            {ad.media_url ? (
                              <>
                                {imageLoading.has(ad.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                    <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
                                  </div>
                                )}
                                <img
                                  src={getMediumThumbnailUrl(ad.media_url)}
                                  alt="Ad visual"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                  onLoad={() => handleImageLoad(ad.id)}
                                  onError={() => handleImageError(ad.id)}
                                  onLoadStart={() => startImageLoading(ad.id)}
                                  style={{
                                    opacity: imageLoading.has(ad.id) ? 0 : 1,
                                    filter: imageLoading.has(ad.id) ? 'blur(8px)' : 'blur(0px)',
                                    transform: imageLoading.has(ad.id) ? 'scale(1.05)' : 'scale(1)',
                                    transition: 'all 0.6s ease-in-out'
                                  }}
                                />
                              </>
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                <div className="text-center">
                                  <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-500">No media generated yet</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Edit Mode or Display Mode */}
                        {editingAd && editingAd.id === ad.id ? (
                          <div className="mb-4 space-y-4">
                              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                              <input
                                type="text"
                                value={editForm.title}
                                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Copy</label>
                              <textarea
                                value={editForm.ad_copy}
                                onChange={(e) => setEditForm(prev => ({ ...prev, ad_copy: e.target.value }))}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                            </div>
                              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action</label>
                              <input
                                type="text"
                                value={editForm.call_to_action}
                                onChange={(e) => setEditForm(prev => ({ ...prev, call_to_action: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              </div>
                              <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags (comma-separated)</label>
                              <input
                                type="text"
                                value={editForm.hashtags}
                                onChange={(e) => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                                placeholder="hashtag1, hashtag2, hashtag3"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              />
                              </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                              >
                                <Save className="w-4 h-4" />
                                <span>{saving ? 'Saving...' : 'Save'}</span>
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                              >
                                <X className="w-4 h-4" />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap mb-4">{ad.ad_copy}</p>
                        )}
                        
                        {/* Expanded Details */}
                        <div className="bg-gray-50 rounded-lg p-3 mb-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-medium text-gray-600">Scheduled:</span>
                              <p className="text-gray-800">{formatDate(ad.scheduled_at)} at {formatTime(ad.scheduled_at.split('T')[1])}</p>
                            </div>
                              <div>
                              <span className="font-medium text-gray-600">Status:</span>
                              <p className="text-gray-800 capitalize">{ad.status}</p>
                              </div>
                              <div>
                              <span className="font-medium text-gray-600">Platform:</span>
                              <p className="text-gray-800">{ad.platform}</p>
                              </div>
                            <div>
                              <span className="font-medium text-gray-600">Ad Type:</span>
                              <p className="text-gray-800 capitalize">{ad.ad_type}</p>
                            </div>
                            <div>
                              <span className="font-medium text-gray-600">Call to Action:</span>
                              <p className="text-gray-800">{ad.call_to_action}</p>
                              </div>
                            <div>
                              <span className="font-medium text-gray-600">Budget:</span>
                              <p className="text-gray-800">{ad.budget_range}</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Hashtags */}
                        {ad.hashtags && ad.hashtags.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-600">Hashtags</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {ad.hashtags.map((tag, index) => (
                                <span key={index} className={`text-xs ${theme.accent} px-2 py-1 rounded-lg`}>
                                  #{tag}
                                </span>
                      ))}
                    </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {ad.target_audience}
                            </span>
                            <span className="flex items-center">
                              <Target className="w-4 h-4 mr-1" />
                              {ad.campaign_objective}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {ad.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => handleApproveAd(ad.id)}
                                  className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full hover:bg-green-200"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectAd(ad.id)}
                                  className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded-full hover:bg-red-200"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Ad</h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Copy</label>
                <textarea
                  value={editForm.ad_copy}
                  onChange={(e) => setEditForm(prev => ({ ...prev, ad_copy: e.target.value }))}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Call to Action</label>
                <input
                  type="text"
                  value={editForm.call_to_action}
                  onChange={(e) => setEditForm(prev => ({ ...prev, call_to_action: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hashtags (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.hashtags}
                  onChange={(e) => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                  placeholder="hashtag1, hashtag2, hashtag3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdsDashboard