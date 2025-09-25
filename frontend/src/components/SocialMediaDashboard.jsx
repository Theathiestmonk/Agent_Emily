import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
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
  const [platformStats, setPlatformStats] = useState({})
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    setDataLoaded(false)
    fetchData()
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


  // Remove the early return for loading - we'll handle it in the main content area

  // Get platforms that have posts (from both OAuth and API token connections)
  const platformsWithPosts = Object.keys(posts).filter(platform => posts[platform] && posts[platform].length > 0)
  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasPosts = Object.keys(posts).length > 0

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
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Social Media Dashboard</h1>
                <p className="text-gray-600">Latest posts from your connected channels</p>
              </div>
              
              <div className="flex items-center space-x-4">
                
                
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
          {loading || !dataLoaded ? (
            <MainContentLoader message="Loading social media dashboard..." />
          ) : (
            <>

          {platformsWithPosts.length === 0 ? (
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
            <div className="space-y-6">
              {/* Posts and Stats Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* First 3 columns - Posts */}
                {platformsWithPosts.slice(0, 3).map((platform) => {
                  const platformPosts = posts[platform] || []
                  const latestPost = platformPosts[0] // Get the most recent post
                  const theme = getPlatformCardTheme(platform)
                  
                  // Find connection info for this platform (if available)
                  const connection = connectedPlatforms.find(conn => conn.platform === platform)
                  
                  return (
                    <div key={platform} className={`${theme.bg} ${theme.border} border rounded-xl shadow-sm hover:shadow-lg transition-all duration-300`}>
                      {/* Platform Header */}
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
                                {platform}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {connection?.page_name || connection?.account_name || platform}
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
                                  className="w-full h-auto object-contain"
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
                                  <span>View on {platform}</span>
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
                
                {/* 3rd Column - Blank Space (if only 2 platforms have posts) */}
                {platformsWithPosts.length === 2 && (
                  <div></div>
                )}
                
                {/* 2nd and 3rd Columns - Blank Spaces (if only 1 platform has posts) */}
                {platformsWithPosts.length === 1 && (
                  <>
                    <div></div>
                    <div></div>
                  </>
                )}
                
                {/* 4th Column - Platform Stats */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm sticky top-6 h-fit">
                          <div className="p-4 border-b border-gray-200">
                              <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <div>
                        <h3 className="font-semibold text-gray-900">Account Insights</h3>
                        <p className="text-sm text-gray-500">Platform metrics</p>
                              </div>
                            </div>
                          </div>

                  <div className="p-4 space-y-4">
                    {connectedPlatforms.map((connection) => {
                      const stats = platformStats[connection.platform] || {}
                      const theme = getPlatformCardTheme(connection.platform)
                                    
                                    return (
                        <div key={connection.platform} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 ${theme.iconBg} rounded-lg flex items-center justify-center`}>
                              <div className="text-white">
                                {getPlatformIcon(connection.platform)}
                              </div>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 capitalize">{connection.platform}</p>
                              <p className="text-xs text-gray-500">{connection.page_name || connection.account_name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {connection.platform === 'instagram' && stats.followers_count && (
                              <>
                                <p className="text-sm font-semibold text-gray-900">{formatEngagement(stats.followers_count)}</p>
                                <p className="text-xs text-gray-500">Followers</p>
                              </>
                            )}
                            {connection.platform === 'facebook' && stats.fan_count && (
                              <>
                                <p className="text-sm font-semibold text-gray-900">{formatEngagement(stats.fan_count)}</p>
                                <p className="text-xs text-gray-500">Page Likes</p>
                              </>
                            )}
                            {connection.platform === 'linkedin' && stats.follower_count && (
                              <>
                                <p className="text-sm font-semibold text-gray-900">{formatEngagement(stats.follower_count)}</p>
                                <p className="text-xs text-gray-500">Followers</p>
                              </>
                            )}
                            {connection.platform === 'twitter' && stats.followers_count && (
                              <>
                                <p className="text-sm font-semibold text-gray-900">{formatEngagement(stats.followers_count)}</p>
                                <p className="text-xs text-gray-500">Followers</p>
                              </>
                            )}
                            {connection.platform === 'youtube' && stats.subscriber_count && (
                              <>
                                <p className="text-sm font-semibold text-gray-900">{formatEngagement(stats.subscriber_count)}</p>
                                <p className="text-xs text-gray-500">Subscribers</p>
                              </>
                            )}
                            {!stats.followers_count && !stats.fan_count && !stats.follower_count && !stats.subscriber_count && (
                              <p className="text-sm text-gray-400">No data</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    
                    {connectedPlatforms.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Users className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm">No connected accounts</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}
          
          {/* Last Updated Timestamp - Bottom Right */}
          {lastRefresh && (
            <div className="fixed bottom-4 right-4 text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default SocialMediaDashboard
