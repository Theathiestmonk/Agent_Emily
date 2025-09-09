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
  BarChart3,
  Activity,
  Target,
  Zap,
  TrendingUp
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const AnalyticsDashboard = () => {
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
  const [insightsData, setInsightsData] = useState({})

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      await fetchAllData()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load analytics data')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
      showSuccess('Analytics data refreshed successfully')
    } catch (error) {
      showError('Failed to refresh analytics data')
    } finally {
      setRefreshing(false)
    }
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: <Facebook className="w-5 h-5" />,
      instagram: <Instagram className="w-5 h-5" />,
      linkedin: <Linkedin className="w-5 h-5" />,
      twitter: <Twitter className="w-5 h-5" />,
      youtube: <Youtube className="w-5 h-5" />
    }
    return icons[platform?.toLowerCase()] || <BarChart3 className="w-5 h-5" />
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

  const formatEngagement = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count?.toString() || '0'
  }

  const calculatePlatformInsights = (platform, posts) => {
    if (!posts || posts.length === 0) return null

    const last5Posts = posts.slice(-5)
    
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
    const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
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
    return <LoadingBar message="Loading analytics dashboard..." />
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
                <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Performance insights and analytics for your social media channels
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-24 p-6">
          {!hasPosts ? (
            <div className="flex flex-col items-center justify-center h-96">
              <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Analytics Data</h3>
              <p className="text-gray-500 text-center max-w-md">
                Connect your social media accounts to see performance insights and analytics.
              </p>
            </div>
          ) : (
            <div>
              {/* Performance Insights Cards */}
              {insightsData && Object.keys(insightsData).length > 0 && (
                <div>
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

export default AnalyticsDashboard
