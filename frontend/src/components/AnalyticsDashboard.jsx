import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'
import { 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Calendar,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const AnalyticsDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const { connections, loading, fetchAllData } = useSocialMediaCache()
  const [analytics, setAnalytics] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [timeRange, setTimeRange] = useState('7d') // 7d, 30d, 90d

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async (forceRefresh = false) => {
    try {
      console.log('🔍 Fetching analytics data...', forceRefresh ? '(force refresh)' : '(cached)')
      
      const authToken = await getAuthToken()
      console.log('🔍 Auth token present:', authToken ? 'yes' : 'no')
      
      const response = await fetch(`${API_BASE_URL}/analytics/summary?time_range=${timeRange}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('📊 Analytics response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ Analytics API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      console.log('📊 Analytics data received:', data)
      
      // Check if we have any analytics data
      const hasData = data?.analytics && (
        Object.keys(data.analytics).length > 1 || // More than just overview
        (data.analytics.overview && (
          data.analytics.overview.total_reach > 0 ||
          data.analytics.overview.total_engagement > 0 ||
          data.analytics.overview.total_posts > 0
        ))
      )
      
      console.log('📊 Has analytics data:', hasData)
      setAnalytics(data.analytics || {})
      
      if (forceRefresh) {
        setLastRefresh(new Date())
        showSuccess('Analytics data refreshed successfully!')
      }
    } catch (error) {
      console.error('❌ Error fetching analytics:', error)
      showError('Failed to load analytics data', error.message)
    }
  }

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      await fetchAnalytics(true)
    } catch (error) {
      console.error('Error refreshing analytics:', error)
      showError('Failed to refresh analytics', error.message)
    } finally {
      setRefreshing(false)
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

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num?.toString() || '0'
  }

  const getTrendIcon = (trend) => {
    if (trend > 0) return <ArrowUp className="w-4 h-4 text-green-500" />
    if (trend < 0) return <ArrowDown className="w-4 h-4 text-red-500" />
    return <Minus className="w-4 h-4 text-gray-400" />
  }

  const getTrendColor = (trend) => {
    if (trend > 0) return 'text-green-600'
    if (trend < 0) return 'text-red-600'
    return 'text-gray-400'
  }

  const formatTrend = (trend) => {
    if (trend === 0) return 'No data'
    return `${Math.abs(trend)}% vs last period`
  }

  if (loading) {
    return <LoadingBar message="Loading analytics dashboard..." />
  }

  const connectedPlatforms = connections.filter(conn => conn.is_active)
  const hasAnalytics = Object.keys(analytics).length > 0

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
                <p className="text-gray-600">Performance insights from your social media channels</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Time Range Selector */}
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                </select>
                
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
            
            {lastRefresh && (
              <div className="mt-2 text-sm text-gray-500">
                Last updated: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
          {connectedPlatforms.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Connected Platforms</h3>
              <p className="text-gray-500 mb-6">Connect your social media accounts to see analytics insights</p>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
              >
                Connect Accounts
              </button>
            </div>
          ) : !hasAnalytics ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-12 h-12 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data Available</h3>
              <p className="text-gray-500 mb-6">Analytics data is not available for your connected platforms. This could be due to:</p>
              <ul className="text-gray-500 text-sm mb-6 space-y-1">
                <li>• Insufficient permissions for analytics access</li>
                <li>• No recent activity on your social media accounts</li>
                <li>• Platform-specific API limitations</li>
              </ul>
              <button
                onClick={handleRefresh}
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-purple-600 hover:to-blue-500 transition-all duration-300"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Reach</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatNumber(analytics.overview?.total_reach || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    {getTrendIcon(analytics.overview?.reach_trend || 0)}
                    <span className={`ml-2 text-sm font-medium ${getTrendColor(analytics.overview?.reach_trend || 0)}`}>
                      {formatTrend(analytics.overview?.reach_trend || 0)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Engagement</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatNumber(analytics.overview?.total_engagement || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <Heart className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    {getTrendIcon(analytics.overview?.engagement_trend || 0)}
                    <span className={`ml-2 text-sm font-medium ${getTrendColor(analytics.overview?.engagement_trend || 0)}`}>
                      {formatTrend(analytics.overview?.engagement_trend || 0)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Posts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatNumber(analytics.overview?.total_posts || 0)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    {getTrendIcon(analytics.overview?.posts_trend || 0)}
                    <span className={`ml-2 text-sm font-medium ${getTrendColor(analytics.overview?.posts_trend || 0)}`}>
                      {formatTrend(analytics.overview?.posts_trend || 0)}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(analytics.overview?.engagement_rate || 0).toFixed(1)}%
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center">
                    {getTrendIcon(analytics.overview?.rate_trend || 0)}
                    <span className={`ml-2 text-sm font-medium ${getTrendColor(analytics.overview?.rate_trend || 0)}`}>
                      {formatTrend(analytics.overview?.rate_trend || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Platform-specific Analytics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {connectedPlatforms.map((connection) => {
                  const platformAnalytics = analytics[connection.platform] || {}
                  const platformColor = getPlatformColor(connection.platform)
                  
                  return (
                    <div key={connection.id} className="bg-white rounded-xl shadow-sm border border-gray-200">
                      {/* Platform Header */}
                      <div className="p-6 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-12 h-12 bg-gradient-to-r ${platformColor} rounded-lg flex items-center justify-center`}>
                              <div className="text-white">
                                {getPlatformIcon(connection.platform)}
                              </div>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                                {connection.platform}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {connection.page_name || connection.platform}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-600 font-medium">Active</span>
                          </div>
                        </div>
                      </div>

                      {/* Analytics Metrics */}
                      <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Eye className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600">Reach</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(platformAnalytics.reach || 0)}
                            </p>
                            <div className="flex items-center justify-center mt-1">
                              {getTrendIcon(platformAnalytics.reach_trend || 0)}
                              <span className={`ml-1 text-xs ${getTrendColor(platformAnalytics.reach_trend || 0)}`}>
                                {formatTrend(platformAnalytics.reach_trend || 0)}
                              </span>
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Heart className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600">Likes</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(platformAnalytics.likes || 0)}
                            </p>
                            <div className="flex items-center justify-center mt-1">
                              {getTrendIcon(platformAnalytics.likes_trend || 0)}
                              <span className={`ml-1 text-xs ${getTrendColor(platformAnalytics.likes_trend || 0)}`}>
                                {formatTrend(platformAnalytics.likes_trend || 0)}
                              </span>
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <MessageCircle className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600">Comments</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(platformAnalytics.comments || 0)}
                            </p>
                            <div className="flex items-center justify-center mt-1">
                              {getTrendIcon(platformAnalytics.comments_trend || 0)}
                              <span className={`ml-1 text-xs ${getTrendColor(platformAnalytics.comments_trend || 0)}`}>
                                {formatTrend(platformAnalytics.comments_trend || 0)}
                              </span>
                            </div>
                          </div>

                          <div className="text-center">
                            <div className="flex items-center justify-center space-x-2 mb-2">
                              <Share2 className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-600">Shares</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                              {formatNumber(platformAnalytics.shares || 0)}
                            </p>
                            <div className="flex items-center justify-center mt-1">
                              {getTrendIcon(platformAnalytics.shares_trend || 0)}
                              <span className={`ml-1 text-xs ${getTrendColor(platformAnalytics.shares_trend || 0)}`}>
                                {formatTrend(platformAnalytics.shares_trend || 0)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Engagement Rate */}
                        <div className="mt-6 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-600">Engagement Rate</span>
                            <span className="text-lg font-bold text-gray-900">
                              {(platformAnalytics.engagement_rate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`bg-gradient-to-r ${platformColor} h-2 rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min((platformAnalytics.engagement_rate || 0), 100)}%` }}
                            ></div>
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
      </div>
    </div>
  )
}

export default AnalyticsDashboard
