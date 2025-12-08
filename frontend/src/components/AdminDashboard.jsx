import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { adminAPI } from '../services/admin'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import { 
  DollarSign, 
  Database, 
  Users, 
  TrendingUp, 
  Filter, 
  Download, 
  RefreshCw,
  Calendar,
  Search,
  X
} from 'lucide-react'

const AdminDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  
  // State
  const [loading, setLoading] = useState(true)
  const [tokenUsage, setTokenUsage] = useState([])
  const [stats, setStats] = useState(null)
  const [usersList, setUsersList] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  
  // Filters
  const [filters, setFilters] = useState({
    user_id: '',
    feature_type: '',
    model_name: '',
    start_date: '',
    end_date: ''
  })
  const [showFilters, setShowFilters] = useState(false)
  
  // Available options for filters
  const [availableUsers, setAvailableUsers] = useState([])
  const [availableFeatureTypes, setAvailableFeatureTypes] = useState([])
  const [availableModels, setAvailableModels] = useState([])

  useEffect(() => {
    fetchData()
    fetchStats()
    fetchUsers()
  }, [page, pageSize, filters])

  const fetchData = async () => {
    try {
      setLoading(true)
      const result = await adminAPI.getTokenUsage({
        userId: filters.user_id || null,
        featureType: filters.feature_type || null,
        modelName: filters.model_name || null,
        startDate: filters.start_date || null,
        endDate: filters.end_date || null,
        limit: pageSize,
        offset: (page - 1) * pageSize
      })
      
      if (result.error) {
        showError(result.error)
        return
      }
      
      // API returns array directly
      const data = Array.isArray(result) ? result : []
      setTokenUsage(data)
      setTotal(data.length)
      
      // Extract unique values for filter options
      const featureTypes = [...new Set(data.map(item => item.feature_type))]
      const models = [...new Set(data.map(item => item.model_name))]
      setAvailableFeatureTypes(featureTypes)
      setAvailableModels(models)
    } catch (error) {
      showError('Failed to load token usage data')
      console.error('Error fetching token usage:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const result = await adminAPI.getTokenUsageStats(
        filters.start_date || null,
        filters.end_date || null,
        filters.user_id || null
      )
      
      if (result.error) {
        console.error('Error fetching stats:', result.error)
        return
      }
      
      setStats(result)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const result = await adminAPI.getUsers(
        filters.start_date || null,
        filters.end_date || null
      )
      
      if (result.error) {
        console.error('Error fetching users:', result.error)
        return
      }
      
      // API returns array directly
      const users = Array.isArray(result) ? result : []
      setAvailableUsers(users)
      setUsersList(users)
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1) // Reset to first page when filter changes
  }

  const clearFilters = () => {
    setFilters({
      user_id: '',
      feature_type: '',
      model_name: '',
      start_date: '',
      end_date: ''
    })
    setPage(1)
  }

  const handleExport = async (format) => {
    try {
      const result = await adminAPI.exportTokenUsage(filters, format)
      if (result.error) {
        showError(result.error)
      } else {
        showSuccess(`Data exported successfully as ${format.toUpperCase()}`)
      }
    } catch (error) {
      showError('Failed to export data')
      console.error('Export error:', error)
    }
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    }).format(amount)
  }

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-gray-50">
      <SideNavbar />
      <MobileNavigation />
      
      <div className="lg:ml-64 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Monitor token usage and costs across all users</p>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Cost</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total_cost)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Tokens</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_tokens)}</p>
                  </div>
                  <Database className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Requests</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_requests)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Users</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {filters.user_id 
                        ? formatNumber(1) 
                        : formatNumber(usersList.length)}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-pink-500" />
                </div>
              </div>
            </div>
          )}

          {/* Filters and Actions */}
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
                
                {(filters.user_id || filters.feature_type || filters.model_name || filters.start_date || filters.end_date) && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchData}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
                  >
                    Export JSON
                  </button>
                  <button
                    onClick={() => handleExport('csv')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 pt-4 border-t">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
                  <select
                    value={filters.user_id}
                    onChange={(e) => handleFilterChange('user_id', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">All Users</option>
                    {availableUsers.map(u => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.name || u.email} ({formatCurrency(u.total_cost)})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Feature Type</label>
                  <select
                    value={filters.feature_type}
                    onChange={(e) => handleFilterChange('feature_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">All Features</option>
                    {availableFeatureTypes.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <select
                    value={filters.model_name}
                    onChange={(e) => handleFilterChange('model_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">All Models</option>
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={filters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={filters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Input Tokens</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Output Tokens</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tokens</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center">
                        <LoadingBar />
                      </td>
                    </tr>
                  ) : tokenUsage.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-gray-500">
                        No token usage data found
                      </td>
                    </tr>
                  ) : (
                    tokenUsage.map((usage) => {
                      // Get user info from usersList
                      const userInfo = usersList.find(u => u.user_id === usage.user_id) || {}
                      return (
                        <tr key={usage.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{userInfo.name || userInfo.email || usage.user_id}</div>
                            <div className="text-sm text-gray-500">{userInfo.email || ''}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                              {usage.feature_type}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{usage.model_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatNumber(usage.input_tokens)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatNumber(usage.output_tokens)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatNumber(usage.total_tokens)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600 text-right">{formatCurrency(usage.total_cost)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(usage.created_at)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {formatNumber(total)} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard

