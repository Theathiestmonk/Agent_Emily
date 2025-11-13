import React, { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube,
  RefreshCw,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Calendar,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  Activity,
  Target,
  Zap,
  Sparkles,
  X,
  BarChart3,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const SocialMediaDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const { 
    connections, 
    posts, 
    loading, 
    fetchAllData, 
    updatePostsInCache,
    getCacheStatus 
  } = useSocialMediaCache()
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [platformStats, setPlatformStats] = useState({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const [showInsightsModal, setShowInsightsModal] = useState(false)
  const [insightsData, setInsightsData] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [selectedPostForInsights, setSelectedPostForInsights] = useState(null)
  const [expandedPlatform, setExpandedPlatform] = useState(null)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 768)

  useEffect(() => {
    setDataLoaded(false)
    fetchData()
  }, [])

  // Track window size for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchData = async (forceRefresh = false) => {
    try {
      setDataLoaded(false)
      const result = await fetchAllData(forceRefresh)
      
      if (result.fromCache) {
        console.log('Data served from cache')
      } else {
        console.log('Data fetched from API')
      }
      
      await fetchPlatformStats()
      setDataLoaded(true)
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load social media data', error.message)
      setDataLoaded(true) // Set to true even on error to prevent infinite loading
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchPlatformStats = async () => {
    try {
      const authToken = await getAuthToken()
      console.log('🔍 Fetching platform stats...')
      
      const response = await fetch(`${API_BASE_URL}/social-media/platform-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('📊 Platform stats response status:', response.status)
      
      if (response.ok) {
        const stats = await response.json()
        console.log('📊 Platform stats data:', stats)
        setPlatformStats(stats)
      } else {
        const errorText = await response.text()
        console.error('❌ Platform stats error:', response.status, errorText)
      }
    } catch (error) {
      console.error('❌ Error fetching platform stats:', error)
    }
  }


  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setDataLoaded(false)
      await fetchData(true) // Force refresh from API
      setLastRefresh(new Date())
      showSuccess('Social media data refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing data:', error)
      showError('Failed to refresh data', error.message)
    } finally {
      setRefreshing(false)
    }
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: <Facebook className="w-6 h-6" />,
      instagram: <Instagram className="w-6 h-6" />,
      linkedin: <Linkedin className="w-6 h-6" />,
      twitter: <Twitter className="w-6 h-6" />,
      youtube: <Youtube className="w-6 h-6" />
    }
    return icons[platform?.toLowerCase()] || <div className="w-6 h-6 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
  }

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: 'from-blue-500 to-blue-600',
      instagram: 'from-pink-500 to-purple-600',
      linkedin: 'from-blue-600 to-blue-700',
      twitter: 'from-sky-400 to-sky-500',
      youtube: 'from-red-500 to-red-600'
    }
    return colors[platform?.toLowerCase()] || 'from-gray-500 to-gray-600'
  }

  const getPlatformCardTheme = (platform) => {
    const themes = {
      facebook: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-blue-200/50',
        iconBg: 'bg-blue-600',
        text: 'text-blue-800',
        accent: 'bg-blue-100/50'
      },
      instagram: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-pink-200/50',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-800',
        accent: 'bg-pink-100/50'
      },
      linkedin: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-blue-200/50',
        iconBg: 'bg-blue-700',
        text: 'text-blue-800',
        accent: 'bg-blue-100/50'
      },
      twitter: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-sky-200/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-100/50'
      },
      youtube: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-red-200/50',
        iconBg: 'bg-red-600',
        text: 'text-red-800',
        accent: 'bg-red-100/50'
      }
    }
    return themes[platform?.toLowerCase()] || {
      bg: 'bg-white/20 backdrop-blur-sm',
      border: 'border-gray-200/50',
      iconBg: 'bg-gray-500',
      text: 'text-gray-800',
      accent: 'bg-gray-100/50'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatEngagement = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count?.toString() || '0'
  }

  const handleViewInsights = async (post, platform) => {
    try {
      setSelectedPostForInsights({ post, platform })
      setLoadingInsights(true)
      setShowInsightsModal(true)
      
      const authToken = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/api/social-media/post-insights?post_id=${post.id}&platform=${platform}`, {
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
      setInsightsData(data)
    } catch (error) {
      console.error('Error fetching insights:', error)
      setInsightsData({
        insights: `Error loading insights: ${error.message}`,
        error: true
      })
    } finally {
      setLoadingInsights(false)
    }
  }

  const handleCloseInsightsModal = () => {
    setShowInsightsModal(false)
    setInsightsData(null)
    setSelectedPostForInsights(null)
  }

  // Parse insights text into structured sections
  const parseInsights = (insightsText) => {
    if (!insightsText) return null
    
    const sections = {
      performance: null,
      content: null,
      sentiment: null,
      trends: null,
      recommendations: null
    }
    
    // Try to extract sections from the AI response
    const lines = insightsText.split('\n')
    let currentSection = null
    let currentContent = []
    
    lines.forEach(line => {
      const lowerLine = line.toLowerCase().trim()
      
      if (lowerLine.includes('performance analysis') || lowerLine.includes('performance:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'performance'
        currentContent = [line.replace(/^.*?performance.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('content analysis') || lowerLine.includes('content:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'content'
        currentContent = [line.replace(/^.*?content.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('sentiment analysis') || lowerLine.includes('sentiment:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'sentiment'
        currentContent = [line.replace(/^.*?sentiment.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('trends') || lowerLine.includes('patterns')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'trends'
        currentContent = [line.replace(/^.*?trend.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('recommendation')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'recommendations'
        currentContent = [line.replace(/^.*?recommendation.*?:/i, '').trim() || line]
      } else if (line.trim() && currentSection) {
        currentContent.push(line)
      } else if (line.trim() && !currentSection) {
        // If no section detected yet, add to first available
        if (!sections.performance && !sections.content) {
          sections.performance = sections.performance ? sections.performance + '\n' + line : line
        }
      }
    })
    
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim()
    }
    
    // If parsing didn't work well, return the full text
    const hasSections = Object.values(sections).some(v => v && v.length > 0)
    if (!hasSections) {
      return { raw: insightsText }
    }
    
    return sections
  }

  // Calculate sentiment score from text
  const calculateSentimentScore = (sentimentText) => {
    if (!sentimentText) return 0.5
    
    const lowerText = sentimentText.toLowerCase()
    const positiveWords = ['positive', 'good', 'great', 'excellent', 'amazing', 'love', 'happy', 'satisfied', 'praise', 'compliment']
    const negativeWords = ['negative', 'bad', 'poor', 'terrible', 'hate', 'angry', 'disappointed', 'complaint', 'criticism', 'unhappy']
    
    let positiveCount = 0
    let negativeCount = 0
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++
    })
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++
    })
    
    if (positiveCount === 0 && negativeCount === 0) return 0.5
    
    const total = positiveCount + negativeCount
    const score = positiveCount / total
    
    return Math.max(0, Math.min(1, score))
  }


  // Remove the early return for loading - we'll handle it in the main content area

  // Get platforms that have posts (from both OAuth and API token connections)
  const platformsWithPosts = Object.keys(posts).filter(platform => posts[platform] && posts[platform].length > 0)
  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasPosts = Object.keys(posts).length > 0

  return (
    <div className="min-h-screen bg-white">
      {/* Side Navbar */}
      <SideNavbar />
      <MobileNavigation />
      
      {/* Main Content */}
      <div className="ml-0 md:ml-48 xl:ml-64 flex flex-col min-h-screen pt-16 md:pt-0">
        {/* Header - Part of Main Content */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
              {/* Account Insights */}
              <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-nowrap">
                  {connectedPlatforms.map((connection) => {
                    const stats = platformStats[connection.platform] || {}
                    const theme = getPlatformCardTheme(connection.platform)
                    // On larger devices (md and up), always show details. On smaller devices, use toggle
                    const isExpanded = isLargeScreen ? true : expandedPlatform === connection.platform
                    
                    return (
                      <div 
                        key={connection.platform} 
                        className="flex-shrink-0"
                      >
                        {/* Platform Card */}
                        <button
                          onClick={() => {
                            // Only toggle on smaller devices
                            if (!isLargeScreen) {
                              if (isExpanded) {
                                setExpandedPlatform(null)
                              } else {
                                setExpandedPlatform(connection.platform)
                              }
                            }
                          }}
                          className={`flex items-center bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-300 ${
                            isExpanded 
                              ? 'space-x-2 sm:space-x-3 px-2 sm:px-3 md:px-4 py-2' 
                              : 'justify-center p-2 sm:p-3'
                          }`}
                        >
                          <div className={`${isExpanded ? 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8' : 'w-10 h-10 sm:w-12 sm:h-12'} ${theme.iconBg} rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300`}>
                            <div className="text-white text-xs sm:text-sm">
                              {getPlatformIcon(connection.platform)}
                            </div>
                          </div>
                          
                          {/* Expanded Details - Always show on md+ screens, toggle on smaller */}
                          {isExpanded && (
                            <>
                              <div className="min-w-0 flex-shrink-0 ml-2 sm:ml-3">
                                <p className="font-medium text-xs sm:text-sm text-gray-900 capitalize whitespace-nowrap">{connection.platform}</p>
                                <p className="text-xs text-gray-500 truncate max-w-[120px] sm:max-w-[150px]">{connection.page_name || connection.account_name}</p>
                              </div>
                              <div className="text-right ml-2 sm:ml-3 flex-shrink-0">
                                {connection.platform === 'instagram' && stats.followers_count && (
                                  <>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatEngagement(stats.followers_count)}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Followers</p>
                                  </>
                                )}
                                {connection.platform === 'facebook' && stats.fan_count && (
                                  <>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatEngagement(stats.fan_count)}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Page Likes</p>
                                  </>
                                )}
                                {connection.platform === 'linkedin' && stats.follower_count && (
                                  <>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatEngagement(stats.follower_count)}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Followers</p>
                                  </>
                                )}
                                {connection.platform === 'twitter' && stats.followers_count && (
                                  <>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatEngagement(stats.followers_count)}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Followers</p>
                                  </>
                                )}
                                {connection.platform === 'youtube' && stats.subscriber_count && (
                                  <>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">{formatEngagement(stats.subscriber_count)}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">Subscribers</p>
                                  </>
                                )}
                                {!stats.followers_count && !stats.fan_count && !stats.follower_count && !stats.subscriber_count && (
                                  <p className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">No data</p>
                                )}
                              </div>
                            </>
                          )}
                        </button>
                      </div>
                    )
                  })}
                  
                  {connectedPlatforms.length === 0 && (
                    <div className="text-center py-4 px-4 flex-shrink-0">
                      <p className="text-gray-500 text-sm">No connected accounts</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Refresh Button - Icon only on smaller devices, icon + text on larger devices */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex-shrink-0 ${
                  isLargeScreen 
                    ? 'px-4 py-2 gap-2' 
                    : 'w-10 h-10 sm:w-11 sm:h-11'
                }`}
                title={refreshing ? 'Refreshing...' : 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                {isLargeScreen && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-3 sm:p-4 md:p-6">
          {loading || !dataLoaded ? (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes loading-dots {
                  0%, 20% { opacity: 0; }
                  50% { opacity: 1; }
                  100% { opacity: 0; }
                }
                .loading-dot-1 {
                  animation: loading-dots 1.4s infinite 0s;
                }
                .loading-dot-2 {
                  animation: loading-dots 1.4s infinite 0.2s;
                }
                .loading-dot-3 {
                  animation: loading-dots 1.4s infinite 0.4s;
                }
              `}} />
              <div className="flex items-center justify-center min-h-[400px]">
                <p className="text-gray-600 text-lg">
                  Loading social media accounts
                  <span className="inline-block w-6 ml-1">
                    <span className="loading-dot-1">.</span>
                    <span className="loading-dot-2">.</span>
                    <span className="loading-dot-3">.</span>
                  </span>
                </p>
              </div>
            </>
          ) : platformsWithPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Social Media Posts</h3>
              <p className="text-gray-500 mb-6">Connect your social media accounts to see your latest posts</p>
              <button
                onClick={() => window.location.href = '/settings'}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
              >
                Connect Accounts
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Posts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {/* Posts */}
                {platformsWithPosts.map((platform) => {
                  const platformPosts = posts[platform] || []
                  const latestPost = platformPosts[0] // Get the most recent post
                  const theme = getPlatformCardTheme(platform)
                  
                  // Find connection info for this platform (if available)
                  const connection = connectedPlatforms.find(conn => conn.platform === platform)
                  
                  return (
                    <div key={platform} className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300`}>
                      {/* Platform Header */}
                      <div className="p-3 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 ${theme.iconBg} rounded-lg flex items-center justify-center`}>
                              <div className="text-white">
                                {getPlatformIcon(platform)}
                              </div>
                            </div>
                            <div>
                              <h3 className={`font-semibold capitalize text-sm ${theme.text}`}>
                                {platform}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {connection?.page_name || connection?.account_name || platform}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">Connected</span>
                          </div>
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="p-3">
                        {latestPost ? (
                          <div className="space-y-2">
                            {/* Post Text */}
                            <div>
                              <p className="text-gray-800 text-xs leading-relaxed line-clamp-2">
                                {latestPost.message || latestPost.text || 'No text content'}
                              </p>
                            </div>

                            {/* Post Media */}
                            {latestPost.media_url && (
                              <div className="rounded-lg overflow-hidden max-h-32">
                                {(() => {
                                  // Check if it's a video/reel based on media_type or thumbnail_url presence
                                  const isVideo = latestPost.media_type === 'VIDEO' || 
                                                 latestPost.media_type === 'REELS' ||
                                                 (latestPost.thumbnail_url && latestPost.thumbnail_url !== latestPost.media_url) ||
                                                 latestPost.media_url.match(/\.(mp4|mov|avi|webm|m4v)$/i)
                                  
                                  return isVideo ? (
                                    <video 
                                      src={latestPost.media_url} 
                                      controls
                                      className="w-full h-auto object-contain max-h-32"
                                      poster={latestPost.thumbnail_url}
                                    >
                                      Your browser does not support the video tag.
                                    </video>
                                  ) : (
                                    <img 
                                      src={latestPost.media_url} 
                                      alt="Post media"
                                      className="w-full h-auto object-contain max-h-32"
                                    />
                                  )
                                })()}
                              </div>
                            )}

                            {/* Post Stats */}
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center space-x-3">
                                {latestPost.likes_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <Heart className="w-3 h-3" />
                                    <span>{formatEngagement(latestPost.likes_count)}</span>
                                  </div>
                                )}
                                {latestPost.comments_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <MessageCircle className="w-3 h-3" />
                                    <span>{formatEngagement(latestPost.comments_count)}</span>
                                  </div>
                                )}
                                {latestPost.shares_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <Share2 className="w-3 h-3" />
                                    <span>{formatEngagement(latestPost.shares_count)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(latestPost.created_time || latestPost.created_at)}</span>
                              </div>
                            </div>

                            {/* Post Links */}
                            <div className="pt-1 border-t border-gray-200 flex items-center justify-between gap-2">
                              {latestPost.permalink_url && (
                                <a
                                  href={latestPost.permalink_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>View on {platform}</span>
                                </a>
                              )}
                              <button
                                onClick={() => handleViewInsights(latestPost, platform)}
                                className="flex items-center space-x-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                              >
                                <Sparkles className="w-3 h-3" />
                                <span>View Insights</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                              <Eye className="w-5 h-5 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-xs">No recent posts found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )}
          
          {/* Last Updated Timestamp - Bottom Right */}
          {lastRefresh && (
            <div className="fixed bottom-4 right-2 sm:right-4 text-xs sm:text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-2 sm:px-3 py-2 rounded-lg shadow-sm border">
              <span className="hidden sm:inline">Last updated: </span>
              {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Insights Modal */}
      {showInsightsModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4"
          onClick={handleCloseInsightsModal}
        >
          <div 
            className="relative max-w-3xl w-full bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">AI Post Insights</h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    {selectedPostForInsights?.platform && (
                      <span className="capitalize">{selectedPostForInsights.platform}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseInsightsModal}
                className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              {loadingInsights ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Analyzing post and generating insights...</p>
                  </div>
                </div>
              ) : insightsData ? (
                <div className="space-y-4">
                  {insightsData.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-red-800">{insightsData.insights}</p>
                    </div>
                  ) : (
                    <>
                      {/* Analysis Summary Card */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-blue-900">Analysis Summary</p>
                            <p className="text-xs text-blue-700">
                              Analyzed {insightsData.comments_analyzed} comments • Compared with {insightsData.previous_posts_compared} previous posts
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Parsed Insights Cards */}
                      {(() => {
                        const parsed = parseInsights(insightsData.insights)
                        
                        if (!parsed || parsed.raw) {
                          // Fallback to raw text if parsing failed
                          return (
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                              <div className="prose max-w-none">
                                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                                  {insightsData.insights}
                                </div>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div className="grid grid-cols-1 gap-3 sm:gap-4">
                            {/* Performance Analysis Card */}
                            {parsed.performance && (
                              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Performance Analysis</h4>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {parsed.performance}
                                </div>
                              </div>
                            )}

                            {/* Content Analysis Card */}
                            {parsed.content && (
                              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Content Analysis</h4>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {parsed.content}
                                </div>
                              </div>
                            )}

                            {/* Sentiment Analysis Card with Spectrum */}
                            {parsed.sentiment && (
                              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Sentiment Analysis</h4>
                                </div>
                                {(() => {
                                  const sentimentScore = calculateSentimentScore(parsed.sentiment)
                                  const percentage = Math.round(sentimentScore * 100)
                                  return (
                                    <div className="mb-4">
                                      {/* Sentiment Spectrum Indicator */}
                                      <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden mb-2">
                                        <div 
                                          className="absolute inset-0 rounded-full transition-all duration-500"
                                          style={{
                                            background: `linear-gradient(to right, 
                                              ${sentimentScore < 0.5 
                                                ? `rgb(239, 68, 68) ${sentimentScore * 100}%, rgb(234, 179, 8) ${(sentimentScore + 0.2) * 100}%, rgb(34, 197, 94) 100%`
                                                : `rgb(239, 68, 68) 0%, rgb(234, 179, 8) ${(sentimentScore - 0.2) * 100}%, rgb(34, 197, 94) ${sentimentScore * 100}%`
                                              })`
                                          }}
                                        />
                                        <div 
                                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                                          style={{ left: `${sentimentScore * 100}%`, transform: 'translateX(-50%)' }}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-red-600 font-medium">Negative</span>
                                        <span className="text-gray-600 font-semibold">{percentage}% Positive</span>
                                        <span className="text-green-600 font-medium">Positive</span>
                                      </div>
                                    </div>
                                  )
                                })()}
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {parsed.sentiment}
                                </div>
                              </div>
                            )}

                            {/* Trends & Patterns Card */}
                            {parsed.trends && (
                              <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Trends & Patterns</h4>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {parsed.trends}
                                </div>
                              </div>
                            )}

                            {/* Recommendations Card */}
                            {parsed.recommendations && (
                              <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-xl p-3 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                  </div>
                                  <h4 className="text-base sm:text-lg font-semibold text-gray-900">Recommendations</h4>
                                </div>
                                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                  {parsed.recommendations}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No insights available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SocialMediaDashboard
