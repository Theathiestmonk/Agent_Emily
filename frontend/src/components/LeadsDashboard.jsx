import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { leadsAPI } from '../services/leads'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import LeadCard from './LeadCard'
import LeadDetailModal from './LeadDetailModal'
import AddLeadModal from './AddLeadModal'
import { 
  Users, 
  UserPlus, 
  CheckCircle, 
  MessageCircle, 
  TrendingUp,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  XCircle,
  AlertCircle,
  Facebook,
  Instagram
} from 'lucide-react'

const LeadsDashboard = () => {
  const { user } = useAuth()
  const { showSuccess, showError, showInfo } = useNotifications()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    responded: 0,
    qualified: 0,
    converted: 0,
    lost: 0
  })
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)

  const fetchLeads = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      
      const params = {}
      if (filterStatus !== 'all') {
        params.status = filterStatus
      }
      if (filterPlatform !== 'all') {
        params.source_platform = filterPlatform
      }
      params.limit = 100
      params.offset = 0

      const response = await leadsAPI.getLeads(params)
      const fetchedLeads = response.data || []

      // Calculate stats
      const newStats = {
        total: fetchedLeads.length,
        new: fetchedLeads.filter(l => l.status === 'new').length,
        contacted: fetchedLeads.filter(l => l.status === 'contacted').length,
        responded: fetchedLeads.filter(l => l.status === 'responded').length,
        qualified: fetchedLeads.filter(l => l.status === 'qualified').length,
        converted: fetchedLeads.filter(l => l.status === 'converted').length,
        lost: fetchedLeads.filter(l => l.status === 'lost').length
      }
      setStats(newStats)

      // Check for new leads
      if (lastFetchTime && leads.length > 0) {
        const newLeads = fetchedLeads.filter(newLead => {
          const newLeadTime = new Date(newLead.created_at)
          return newLeadTime > lastFetchTime && !leads.find(l => l.id === newLead.id)
        })
        
        if (newLeads.length > 0) {
          showInfo(
            'New Lead!',
            `${newLeads.length} new lead${newLeads.length > 1 ? 's' : ''} received`,
            {
              type: 'lead',
              leadIds: newLeads.map(l => l.id)
            }
          )
        }
      }

      setLeads(fetchedLeads)
      setLastFetchTime(new Date())
      
    } catch (error) {
      console.error('Error fetching leads:', error)
      showError('Error', 'Failed to fetch leads. Please try again.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [filterStatus, filterPlatform, lastFetchTime, leads, showError, showInfo])

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [user])

  // Refetch when filters change
  useEffect(() => {
    if (user) {
      fetchLeads()
    }
  }, [filterStatus, filterPlatform, user])

  // Set up polling for new leads
  useEffect(() => {
    if (user) {
      const interval = setInterval(() => {
        fetchLeads(false) // Don't show loading spinner for polling
      }, 30000) // Poll every 30 seconds

      setPollingInterval(interval)

      return () => {
        if (interval) clearInterval(interval)
      }
    }
  }, [user, fetchLeads])

  const handleLeadClick = (lead) => {
    setSelectedLead(lead)
    setShowDetailModal(true)
  }

  const handleCloseModal = () => {
    setShowDetailModal(false)
    setSelectedLead(null)
    // Refresh leads after modal closes in case status was updated
    fetchLeads(false)
  }

  const handleRefresh = () => {
    fetchLeads()
    showSuccess('Refreshed', 'Leads list updated')
  }

  const filteredLeads = leads.filter(lead => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = lead.name?.toLowerCase().includes(query)
      const matchesEmail = lead.email?.toLowerCase().includes(query)
      const matchesPhone = lead.phone_number?.toLowerCase().includes(query)
      return matchesName || matchesEmail || matchesPhone
    }
    return true
  })

  const statusFilters = [
    { value: 'all', label: 'All', count: stats.total },
    { value: 'new', label: 'New', count: stats.new },
    { value: 'contacted', label: 'Contacted', count: stats.contacted },
    { value: 'responded', label: 'Responded', count: stats.responded },
    { value: 'qualified', label: 'Qualified', count: stats.qualified },
    { value: 'converted', label: 'Converted', count: stats.converted },
    { value: 'lost', label: 'Lost', count: stats.lost }
  ]

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className="text-gray-600">Please log in to access leads.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SideNavbar />
      <MobileNavigation 
        setShowCustomContentChatbot={() => {}}
        handleGenerateContent={() => {}}
        generating={false}
        fetchingFreshData={false}
      />

      <div className="md:ml-48 xl:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white shadow-sm border-b sticky top-0 z-20">
          <div className="px-4 lg:px-6 py-4 lg:py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center space-x-2">
                  <Users className="w-7 h-7 lg:w-8 lg:h-8" />
                  <span>Leads</span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Manage and track your leads from Facebook and Instagram ads
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Add Lead</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="px-4 lg:px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4">
            {statusFilters.map((filter) => (
              <div
                key={filter.value}
                onClick={() => setFilterStatus(filter.value)}
                className={`bg-white rounded-lg p-3 lg:p-4 shadow-sm border-2 cursor-pointer transition-all ${
                  filterStatus === filter.value
                    ? 'border-blue-500 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl lg:text-3xl font-bold text-gray-900">
                  {filter.count}
                </div>
                <div className="text-xs lg:text-sm text-gray-600 mt-1">
                  {filter.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="px-4 lg:px-6 py-4 bg-white border-b">
          <div className="flex flex-col md:flex-row md:items-center space-y-3 md:space-y-0 md:space-x-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Platform Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Platforms</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
              </select>
            </div>
          </div>
        </div>

        {/* Leads Grid */}
        <div className="flex-1 px-4 lg:px-6 py-6">
          {loading ? (
            <MainContentLoader />
          ) : filteredLeads.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {searchQuery ? 'No leads found' : 'No leads yet'}
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Leads from your Facebook and Instagram ads will appear here'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onClick={handleLeadClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      {showDetailModal && selectedLead && (
        <LeadDetailModal
          lead={selectedLead}
          onClose={handleCloseModal}
          onUpdate={fetchLeads}
        />
      )}

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchLeads()
          setShowAddModal(false)
        }}
      />
    </div>
  )
}

export default LeadsDashboard

