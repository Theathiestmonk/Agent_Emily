import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'
import { 
  Target,
  Calendar,
  FileText,
  TrendingUp,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Users,
  Hash
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const CampaignsDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/content/campaigns`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setCampaigns(data.campaigns || [])
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      showError('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchCampaigns()
      showSuccess('Campaigns refreshed successfully')
    } catch (error) {
      showError('Failed to refresh campaigns')
    } finally {
      setRefreshing(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'generating':
        return <Clock className="w-4 h-4 text-blue-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'generating':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    })
  }

  const calculateProgress = (generated, total) => {
    if (total === 0) return 0
    return Math.round((generated / total) * 100)
  }

  if (loading) {
    return <LoadingBar message="Loading campaigns..." />
  }

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
                <h1 className="text-2xl font-bold text-gray-900">Campaigns Dashboard</h1>
                <p className="text-sm text-gray-500">
                  Manage and monitor your content campaigns
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
                <button className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200">
                  <Plus className="w-4 h-4" />
                  <span>New Campaign</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-24 p-6">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96">
              <Target className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No Campaigns Found</h3>
              <p className="text-gray-500 text-center max-w-md">
                Create your first content campaign to get started with automated content generation.
              </p>
              <button className="mt-4 flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200">
                <Plus className="w-5 h-5" />
                <span>Create Campaign</span>
              </button>
            </div>
          ) : (
            <div>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
                    </div>
                    <Target className="w-8 h-8 text-purple-500" />
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {campaigns.filter(c => c.status === 'completed').length}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">In Progress</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {campaigns.filter(c => c.status === 'generating').length}
                      </p>
                    </div>
                    <Clock className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                
                <div className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Posts</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {campaigns.reduce((sum, c) => sum + (c.total_posts || 0), 0)}
                      </p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-500" />
                  </div>
                </div>
              </div>

              {/* Campaigns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {campaigns.map((campaign) => (
                  <div key={campaign.id} className="bg-white/20 backdrop-blur-sm border border-gray-200/50 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300">
                    {/* Campaign Header */}
                    <div className="p-6 border-b border-gray-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {campaign.campaign_name}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(campaign.status)}`}>
                              {getStatusIcon(campaign.status)}
                              <span className="ml-1 capitalize">{campaign.status}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Campaign Dates */}
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{formatDate(campaign.week_start_date)} - {formatDate(campaign.week_end_date)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Campaign Stats */}
                    <div className="p-6">
                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                          <span>Progress</span>
                          <span>{campaign.generated_posts || 0} / {campaign.total_posts || 0} posts</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${calculateProgress(campaign.generated_posts || 0, campaign.total_posts || 0)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{campaign.total_posts || 0}</div>
                          <div className="text-xs text-gray-500">Total Posts</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{campaign.generated_posts || 0}</div>
                          <div className="text-xs text-gray-500">Generated</div>
                        </div>
                      </div>

                      {/* Created Date */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="text-xs text-gray-500">
                          Created {formatDate(campaign.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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

export default CampaignsDashboard
