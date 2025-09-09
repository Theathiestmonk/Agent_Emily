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
  Eye,
  MousePointer,
  DollarSign,
  TrendingUp,
  Users,
  Calendar,
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  Megaphone,
  Target,
  Zap
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const AdsDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const { 
    connections, 
    loading: connectionsLoading, 
    fetchAllData 
  } = useSocialMediaCache()
  const [ads, setAds] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      await fetchAllData()
      await fetchAds()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load ads data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAds = async () => {
    try {
      const connectedPlatforms = connections.filter(conn => conn.is_active)
      const adsData = {}

      // Fetch real ads from each connected platform
      for (const connection of connectedPlatforms) {
        try {
          const platformAds = await fetchPlatformAds(connection)
          adsData[connection.platform] = platformAds
        } catch (error) {
          console.error(`Error fetching ads for ${connection.platform}:`, error)
          // Continue with other platforms even if one fails
          adsData[connection.platform] = []
        }
      }

      setAds(adsData)
    } catch (error) {
      console.error('Error fetching ads:', error)
      showError('Failed to load ads')
    }
  }

  const fetchPlatformAds = async (connection) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ads/${connection.platform}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return data.ads || []
    } catch (error) {
      console.error(`Error fetching ${connection.platform} ads:`, error)
      return []
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
      showSuccess('Ads data refreshed successfully')
    } catch (error) {
      showError('Failed to refresh ads data')
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
    return icons[platform?.toLowerCase()] || <Megaphone className="w-5 h-5" />
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

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'paused':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-orange-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  if (loading || connectionsLoading) {
    return <LoadingBar message="Loading ads dashboard..." />
  }

  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasAds = Object.keys(ads).length > 0

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
                <h1 className="text-2xl font-bold text-gray-900">Ads Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Monitor and manage your active advertising campaigns
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
          {!hasAds || Object.values(ads).every(platformAds => platformAds.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-96">
              <Megaphone className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Active Ads</h3>
              <p className="text-gray-500 text-center max-w-md">
                No active advertising campaigns found. Connect your advertising accounts or create new campaigns to see them here.
              </p>
            </div>
          ) : (
            <div>
              {/* Platform Ads */}
              {Object.entries(ads).filter(([platform, platformAds]) => platformAds.length > 0).map(([platform, platformAds]) => {
                const theme = getPlatformCardTheme(platform)
                const totalSpent = platformAds.reduce((sum, ad) => sum + ad.spent, 0)
                const totalImpressions = platformAds.reduce((sum, ad) => sum + ad.impressions, 0)
                const totalClicks = platformAds.reduce((sum, ad) => sum + ad.clicks, 0)
                const activeAds = platformAds.filter(ad => ad.status === 'active').length

                return (
                  <div key={platform} className="mb-8">
                    {/* Platform Header */}
                    <div className={`${theme.bg} ${theme.border} border rounded-xl p-6 mb-6`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 ${theme.iconBg} rounded-lg flex items-center justify-center`}>
                            <div className="text-white">
                              {getPlatformIcon(platform)}
                            </div>
                          </div>
                          <div>
                            <h2 className={`text-xl font-bold capitalize ${theme.text}`}>
                              {platform} Ads
                            </h2>
                            <p className="text-sm text-gray-600">
                              {platformAds.length} campaigns • {activeAds} active
                            </p>
                          </div>
                        </div>
                        
                        {/* Platform Stats */}
                        <div className="flex items-center space-x-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpent)}</div>
                            <div className="text-xs text-gray-500">Total Spent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{formatNumber(totalImpressions)}</div>
                            <div className="text-xs text-gray-500">Impressions</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-gray-900">{formatNumber(totalClicks)}</div>
                            <div className="text-xs text-gray-500">Clicks</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ads Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                      {platformAds.map((ad) => (
                        <div key={ad.id} className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                          {/* Ad Header */}
                          <div className="p-4 border-b border-gray-200">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                  {ad.name}
                                </h3>
                                <p className="text-sm text-gray-600">{ad.type}</p>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ad.status)}`}>
                                {getStatusIcon(ad.status)}
                                <span className="ml-1 capitalize">{ad.status}</span>
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Target className="w-4 h-4" />
                                <span>{ad.objective}</span>
                              </div>
                            </div>
                          </div>

                          {/* Ad Stats */}
                          <div className="p-4">
                            {/* Budget & Spend */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <div className="text-sm text-gray-500">Budget</div>
                                <div className="text-lg font-semibold text-gray-900">{formatCurrency(ad.budget)}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Spent</div>
                                <div className="text-lg font-semibold text-green-600">{formatCurrency(ad.spent)}</div>
                              </div>
                            </div>

                            {/* Performance Metrics */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <div className="text-sm text-gray-500">Impressions</div>
                                <div className="text-lg font-semibold text-gray-900">{formatNumber(ad.impressions)}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">Clicks</div>
                                <div className="text-lg font-semibold text-blue-600">{formatNumber(ad.clicks)}</div>
                              </div>
                            </div>

                            {/* CTR & CPC */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <div className="text-sm text-gray-500">CTR</div>
                                <div className="text-lg font-semibold text-purple-600">{ad.ctr}%</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-500">CPC</div>
                                <div className="text-lg font-semibold text-orange-600">{formatCurrency(ad.cpc)}</div>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="pt-4 border-t border-gray-200">
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>Start: {new Date(ad.startDate).toLocaleDateString()}</span>
                                <span>End: {new Date(ad.endDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
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

export default AdsDashboard
