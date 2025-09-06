import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { contentAPI } from '../services/content'
import ContentProgress from './ContentProgress'
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
  BarChart3
} from 'lucide-react'

const ContentDashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [posts, setPosts] = useState([])
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('grid') // 'grid' or 'list'
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set())
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [campaignsResult, postsResult] = await Promise.all([
        contentAPI.getCampaigns(),
        contentAPI.getAllPosts()
      ])
      
      if (campaignsResult.data) setCampaigns(campaignsResult.data)
      if (postsResult.data) setPosts(postsResult.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateContent = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      
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
        if (result.error.message?.includes('onboarding')) {
          setGenerationMessage('Please complete your onboarding first before generating content.')
        } else if (result.error.message?.includes('platforms')) {
          setGenerationMessage('Please configure your social media platforms in your profile first.')
        } else {
          setGenerationMessage(result.error.message || 'Failed to start content generation. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error generating content:', error)
      setGenerationStatus('error')
      setGenerationMessage('An unexpected error occurred. Please try again.')
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
          await fetchData()
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

  const filteredPosts = posts.filter(post => {
    const matchesPlatform = filterPlatform === 'all' || post.platform === filterPlatform
    const matchesSearch = searchTerm === '' || 
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.title?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesPlatform && matchesSearch
  })

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: '📘',
      instagram: '📷',
      linkedin: '💼',
      twitter: '🐦',
      tiktok: '🎵',
      youtube: '📺'
    }
    return icons[platform] || '📱'
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your content...</p>
        </div>
      </div>
    )
  }

  const handleProgressComplete = () => {
    setShowProgress(false)
    setGenerationStatus('success')
    setGenerationMessage('Content generation completed! Your new content is ready.')
    fetchData() // Refresh the data
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Progress Bar */}
      <ContentProgress 
        isVisible={showProgress} 
        onComplete={handleProgressComplete}
      />
      
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Content Dashboard</h1>
                <p className="text-sm text-gray-500">Manage your AI-generated content</p>
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
                onClick={() => navigate('/dashboard')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                <span>Back to Dashboard</span>
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
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-4">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center mr-4">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{posts.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                <Image className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">AI Images</p>
                <p className="text-2xl font-bold text-gray-900">
                  {posts.reduce((acc, post) => acc + (post.content_images?.length || 0), 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center mr-4">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Platforms</p>
                <p className="text-2xl font-bold text-gray-900">
                  {new Set(posts.map(post => post.platform)).size}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="all">All Platforms</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="twitter">Twitter</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-pink-100 text-pink-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Campaigns */}
        <div className="space-y-6">
          {campaigns.map((campaign) => {
            const campaignPosts = posts.filter(post => post.campaign_id === campaign.id)
            const isExpanded = expandedCampaigns.has(campaign.id)
            
            return (
              <div key={campaign.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => toggleCampaignExpansion(campaign.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{campaign.campaign_name}</h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(campaign.week_start_date)} - {formatDate(campaign.week_end_date)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Posts</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {campaign.generated_posts} / {campaign.total_posts}
                        </p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-gray-200 p-6">
                    {campaignPosts.length === 0 ? (
                      <div className="text-center py-8">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No posts in this campaign yet</p>
                      </div>
                    ) : (
                      <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                        {campaignPosts.map((post) => (
                          <div key={post.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-2xl">{getPlatformIcon(post.platform)}</span>
                                <div>
                                  <h4 className="font-medium text-gray-900 capitalize">{post.platform}</h4>
                                  <p className="text-sm text-gray-500">{post.post_type}</p>
                                </div>
                              </div>
                              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(post.status)}`}>
                                {post.status}
                              </div>
                            </div>
                            
                            {post.title && (
                              <h5 className="font-medium text-gray-900 mb-2">{post.title}</h5>
                            )}
                            
                            <p className="text-gray-700 text-sm mb-3 line-clamp-3">{post.content}</p>
                            
                            {post.hashtags && post.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-3">
                                {post.hashtags.map((tag, index) => (
                                  <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center space-x-1">
                                <Clock className="w-4 h-4" />
                                <span>{formatDate(post.scheduled_date)} at {formatTime(post.scheduled_time)}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button className="p-1 hover:bg-gray-100 rounded">
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button className="p-1 hover:bg-gray-100 rounded">
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button className="p-1 hover:bg-gray-100 rounded">
                                  <Share2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            
                            {post.content_images && post.content_images.length > 0 && (
                              <div className="mt-3">
                                <div className="flex space-x-2">
                                  {post.content_images.slice(0, 3).map((image, index) => (
                                    <div key={index} className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden">
                                      <img 
                                        src={image.image_url} 
                                        alt={`Generated image ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  ))}
                                  {post.content_images.length > 3 && (
                                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                                      <span className="text-xs text-gray-500">+{post.content_images.length - 3}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {campaigns.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-r from-pink-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-12 h-12 text-pink-500" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No content campaigns yet</h3>
            <p className="text-gray-500 mb-6">Generate your first AI-powered content campaign to get started</p>
            <div className="flex space-x-4">
              <button
                onClick={handleGenerateContent}
                disabled={generating}
                className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-pink-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Generating Your First Campaign...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Generate Your First Campaign</span>
                  </>
                )}
              </button>
              
              <button
                onClick={handleTriggerWeekly}
                disabled={generating}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Triggering Weekly Generation...</span>
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5" />
                    <span>Trigger Weekly Generation</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ContentDashboard
