import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'
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
  BarChart3,
  AlertCircle,
  CheckCircle,
  Activity,
  Target,
  Zap
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
  const [debugData, setDebugData] = useState(null)
  const [insightsData, setInsightsData] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchAllData(forceRefresh)
      
      if (result.fromCache) {
        console.log('Data served from cache')
      } else {
        console.log('Data fetched from API')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load social media data', error.message)
    }
  }


  const handleRefresh = async () => {
    try {
      setRefreshing(true)
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

  const handleDebugConnections = async () => {
    try {
      const authToken = await getAuthToken()
      console.log('🔍 Debugging connections...')
      
      const response = await fetch(`${API_BASE_URL}/social-media/debug-connections`, {
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
      console.log('🔍 Debug data:', data)
      setDebugData(data)
      showSuccess('Debug data loaded! Check console for details.')
    } catch (error) {
      console.error('Error debugging connections:', error)
      showError('Failed to debug connections', error.message)
    }
  }


  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
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

  const calculatePlatformInsights = (platform, posts) => {
    if (!posts || posts.length === 0) return null

    const last5Posts = posts.slice(-5)
    
    // Debug: Log the structure of posts to see what date fields are available
    if (last5Posts.length > 0) {
      console.log(`Posts structure for ${platform}:`, last5Posts[0])
    }
    
    // Calculate platform-specific metrics
    let metrics = []
    
    switch (platform.toLowerCase()) {
      case 'facebook':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Shares', data: last5Posts.map(post => post.shares_count || 0) }
        ]
        break
      case 'instagram':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Saves', data: last5Posts.map(post => post.saves_count || 0) }
        ]
        break
      case 'linkedin':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Shares', data: last5Posts.map(post => post.shares_count || 0) }
        ]
        break
      case 'twitter':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Retweets', data: last5Posts.map(post => post.retweets_count || 0) },
          { name: 'Replies', data: last5Posts.map(post => post.replies_count || 0) }
        ]
        break
      case 'youtube':
        metrics = [
          { name: 'Views', data: last5Posts.map(post => post.views_count || 0) },
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) }
        ]
        break
      default:
        metrics = [
          { name: 'Engagement', data: last5Posts.map(post => (post.likes_count || 0) + (post.comments_count || 0)) },
          { name: 'Reach', data: last5Posts.map(post => post.reach_count || 0) },
          { name: 'Impressions', data: last5Posts.map(post => post.impressions_count || 0) }
        ]
    }

    return {
      platform,
      posts: last5Posts,
      metrics,
      postTitles: last5Posts.map(post => 
        (post.message || post.text || 'Untitled').substring(0, 30) + '...'
      )
    }
  }

  const processInsightsData = () => {
    const insights = {}
    const connectedPlatforms = connections.filter(conn => conn.is_active)
    connectedPlatforms.forEach(connection => {
      const platformPosts = posts[connection.platform] || []
      const platformInsights = calculatePlatformInsights(connection.platform, platformPosts)
      if (platformInsights) {
        insights[connection.platform] = platformInsights
      }
    })
    setInsightsData(insights)
  }

  useEffect(() => {
    if (Object.keys(posts).length > 0 && connections.length > 0) {
      processInsightsData()
    }
  }, [posts, connections])

  if (loading) {
    return <LoadingBar message="Loading social media dashboard..." />
  }

  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasPosts = Object.keys(posts).length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Social Media Dashboard</h1>
                <p className="text-gray-600">Latest posts from your connected channels</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Stats */}
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Connected</p>
                      <p className="text-lg font-bold text-gray-900">{connectedPlatforms.length}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Posts</p>
                      <p className="text-lg font-bold text-gray-900">{Object.keys(posts).length}</p>
                    </div>
                  </div>
                </div>
                
                {/* Debug Button */}
                <button
                  onClick={handleDebugConnections}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-yellow-500 transition-all duration-300"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>Debug</span>
                </button>
                
                {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
            
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
          {/* Debug Data Display */}
          {debugData && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
              <div className="text-sm text-yellow-700">
                <p><strong>User ID:</strong> {debugData.user_id}</p>
                <p><strong>Total Connections:</strong> {debugData.total_connections}</p>
                <p><strong>Active Connections:</strong> {debugData.active_connections}</p>
                <div className="mt-2">
                  <p><strong>Active Connections:</strong></p>
                  <ul className="list-disc list-inside ml-4">
                    {debugData.active_connections_data.map((conn, index) => (
                      <li key={index}>
                        {conn.platform} - {conn.page_name} (ID: {conn.page_id}) - 
                        Token: {conn.has_access_token ? 'Yes' : 'No'} - 
                        Status: {conn.connection_status}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {connectedPlatforms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Connected Platforms</h3>
              <p className="text-gray-500 mb-6">Connect your social media accounts to see your latest posts</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
              >
                Connect Accounts
              </button>
            </div>
          ) : !hasPosts ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Recent Posts</h3>
              <p className="text-gray-500 mb-6">Your connected accounts don't have recent posts or the API is not available yet</p>
              <button
                onClick={handleRefresh}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-blue-500 transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Posts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {connectedPlatforms.map((connection) => {
                  const platformPosts = posts[connection.platform] || []
                  const latestPost = platformPosts[0] // Get the most recent post
                  const theme = getPlatformCardTheme(connection.platform)
                  
                  return (
                    <div key={connection.id} className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300`}>
                      {/* Platform Header */}
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-10 h-10 ${theme.iconBg} rounded-lg flex items-center justify-center`}>
                              <div className="text-white">
                                {getPlatformIcon(connection.platform)}
                              </div>
                            </div>
                            <div>
                              <h3 className={`font-semibold capitalize ${theme.text}`}>
                                {connection.platform}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {connection.page_name || connection.platform}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">Connected</span>
                          </div>
                        </div>
                      </div>

                      {/* Post Content */}
                      <div className="p-4">
                        {latestPost ? (
                          <div className="space-y-4">
                            {/* Post Text */}
                            <div>
                              <p className="text-gray-800 text-sm leading-relaxed line-clamp-3">
                                {latestPost.message || latestPost.text || 'No text content'}
                              </p>
                            </div>

                            {/* Post Media */}
                            {latestPost.media_url && (
                              <div className="rounded-lg overflow-hidden">
                                <img 
                                  src={latestPost.media_url} 
                                  alt="Post media"
                                  className="w-full h-48 object-cover"
                                />
                              </div>
                            )}

                            {/* Post Stats */}
                            <div className="flex items-center justify-between text-sm text-gray-500">
                              <div className="flex items-center space-x-4">
                                {latestPost.likes_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <Heart className="w-4 h-4" />
                                    <span>{formatEngagement(latestPost.likes_count)}</span>
                                  </div>
                                )}
                                {latestPost.comments_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>{formatEngagement(latestPost.comments_count)}</span>
                                  </div>
                                )}
                                {latestPost.shares_count !== undefined && (
                                  <div className="flex items-center space-x-1">
                                    <Share2 className="w-4 h-4" />
                                    <span>{formatEngagement(latestPost.shares_count)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDate(latestPost.created_time || latestPost.created_at)}</span>
                              </div>
                            </div>

                            {/* Post Link */}
                            {latestPost.permalink_url && (
                              <div className="pt-2 border-t border-gray-200">
                                <a
                                  href={latestPost.permalink_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                  <span>View on {connection.platform}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Eye className="w-6 h-6 text-gray-400" />
                            </div>
                            <p className="text-gray-500 text-sm">No recent posts found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Social Media Insights Cards */}
              {insightsData && Object.keys(insightsData).length > 0 && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Performance Insights</h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {Object.entries(insightsData).map(([platform, data]) => {
                      const theme = getPlatformCardTheme(platform)
                      const maxValue = Math.max(...data.metrics.flatMap(metric => metric.data))
                      
                      return (
                        <div key={platform} className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300`}>
                          {/* Card Header */}
                          <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 ${theme.iconBg} rounded-lg flex items-center justify-center`}>
                                  <div className="text-white">
                                    {getPlatformIcon(platform)}
                                  </div>
                                </div>
                                <div>
                                  <h3 className={`font-semibold capitalize ${theme.text}`}>
                                    {platform} Insights
                                  </h3>
                                  <p className="text-sm text-gray-500">Last 5 posts performance</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <BarChart3 className="w-4 h-4 text-gray-500" />
                                <span className="text-xs text-gray-600">Analytics</span>
                              </div>
                            </div>
                          </div>

                          {/* Bar Chart */}
                          <div className="p-4">
                            {/* Grouped Bar Chart */}
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">Performance Metrics</span>
                                <span className="text-xs text-gray-500">Last 5 posts</span>
                              </div>
                              
                              {/* Grouped Bar Chart */}
                              <div className="space-y-2">
                                {/* Chart Container */}
                                <div className="flex items-end space-x-2 h-32">
                                  {data.posts.map((post, postIndex) => {
                                    const maxValue = Math.max(...data.metrics.map(metric => Math.max(...metric.data)))
                                    const colors = ['bg-gradient-to-br from-purple-300 to-purple-400', 'bg-violet-500', 'bg-blue-500']
                                    
                                    return (
                                      <div key={postIndex} className="flex-1 flex flex-col items-center space-y-1">
                                        {/* Bars for each metric */}
                                        <div className="flex items-end space-x-1 h-24 w-full">
                                          {data.metrics.map((metric, metricIndex) => {
                                            const value = metric.data[postIndex] || 0
                                            const height = maxValue > 0 ? (value / maxValue) * 100 : 0
                                            
                                            return (
                                              <div
                                                key={metricIndex}
                                                className={`${colors[metricIndex]} rounded-t-sm flex-1 min-h-[2px] transition-all duration-300 hover:opacity-80`}
                                                style={{ height: `${Math.max(height, 2)}%` }}
                                                title={`${metric.name}: ${formatEngagement(value)}`}
                                              />
                                            )
                                          })}
                                        </div>
                                        
                                        {/* Post Date Label */}
                                        <div className="text-xs text-gray-400 text-center">
                                          {(() => {
                                            const postDate = post.created_at || post.published_at || post.scheduled_date || post.date || post.timestamp
                                            
                                            if (postDate) {
                                              try {
                                                return new Date(postDate).toLocaleDateString('en-US', { 
                                                  month: 'short', 
                                                  day: 'numeric' 
                                                })
                                              } catch (error) {
                                                console.log('Date parsing error:', error, 'for post:', post)
                                              }
                                            }
                                            
                                            return `Post ${postIndex + 1}`
                                          })()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                
                                {/* Legend */}
                                <div className="flex justify-center space-x-4 mt-2">
                                  {data.metrics.map((metric, index) => {
                                    const colors = ['bg-gradient-to-br from-purple-300 to-purple-400', 'bg-violet-500', 'bg-blue-500']
                                    return (
                                      <div key={index} className="flex items-center space-x-1">
                                        <div className={`w-3 h-3 ${colors[index]} rounded-sm`}></div>
                                        <span className="text-xs text-gray-600">{metric.name}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <div className="grid grid-cols-3 gap-4 text-center">
                                {data.metrics.map((metric, index) => {
                                  const total = metric.data.reduce((a, b) => a + b, 0)
                                  const avg = total / metric.data.length
                                  return (
                                    <div key={index} className="space-y-1">
                                      <div className="text-xs text-gray-500">{metric.name}</div>
                                      <div className={`text-sm font-semibold ${theme.text}`}>
                                        {formatEngagement(Math.round(avg))}
                                      </div>
                                      <div className="text-xs text-gray-400">avg</div>
                                    </div>
                                  )
                                })}
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
          )}
          
          {/* Last Updated Timestamp - Bottom Right */}
          {lastRefresh && (
            <div className="fixed bottom-4 right-4 text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SocialMediaDashboard
