import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { leadsAPI } from '../services/leads'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
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
  Instagram,
  X
} from 'lucide-react'

const LeadsDashboard = () => {
  const { user } = useAuth()
  const { showSuccess, showError, showInfo } = useNotifications()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [importingCSV, setImportingCSV] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    contacted: 0,
    responded: 0,
    qualified: 0,
    converted: 0,
    lost: 0,
    invalid: 0
  })
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const [pollingInterval, setPollingInterval] = useState(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set())
  const [deletingBulk, setDeletingBulk] = useState(false)

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
        lost: fetchedLeads.filter(l => l.status === 'lost').length,
        invalid: fetchedLeads.filter(l => l.status === 'invalid').length
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

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterDropdown && !event.target.closest('.filter-dropdown-container')) {
        setShowFilterDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showFilterDropdown])

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

  const handleDeleteLead = async (lead) => {
    if (!window.confirm(`Are you sure you want to delete "${lead.name || 'this lead'}"? This action cannot be undone.`)) {
      return
    }

    try {
      await leadsAPI.deleteLead(lead.id)
      showSuccess('Lead Deleted', 'Lead has been deleted successfully')
      // Refresh leads list
      await fetchLeads(false)
      // Close modal if the deleted lead was selected
      if (selectedLead && selectedLead.id === lead.id) {
        setShowDetailModal(false)
        setSelectedLead(null)
      }
      // Remove from selection if in selection mode
      if (selectionMode) {
        setSelectedLeadIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(lead.id)
          return newSet
        })
      }
    } catch (error) {
      console.error('Error deleting lead:', error)
      showError('Error', 'Failed to delete lead')
    }
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode)
    if (selectionMode) {
      setSelectedLeadIds(new Set())
    }
  }

  const handleSelectLead = (leadId, isSelected) => {
    setSelectedLeadIds(prev => {
      const newSet = new Set(prev)
      if (isSelected) {
        newSet.add(leadId)
      } else {
        newSet.delete(leadId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set())
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map(lead => lead.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedLeadIds.size === 0) {
      showError('Error', 'No leads selected')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedLeadIds.size} lead(s)? This action cannot be undone.`)) {
      return
    }

    try {
      setDeletingBulk(true)
      const leadIdsArray = Array.from(selectedLeadIds)
      const result = await leadsAPI.bulkDeleteLeads(leadIdsArray)
      
      if (result.data.success) {
        showSuccess(
          'Leads Deleted',
          `Successfully deleted ${result.data.success_count} lead(s)${result.data.failed_count > 0 ? `. ${result.data.failed_count} failed.` : ''}`
        )
        // Refresh leads list
        await fetchLeads(false)
        // Clear selection
        setSelectedLeadIds(new Set())
        // Exit selection mode if all selected leads are deleted
        if (result.data.failed_count === 0) {
          setSelectionMode(false)
        }
      } else {
        showError('Error', 'Failed to delete some leads')
      }
    } catch (error) {
      console.error('Error bulk deleting leads:', error)
      showError('Error', 'Failed to delete leads')
    } finally {
      setDeletingBulk(false)
    }
  }

  const handleCSVImport = async (file) => {
    if (!file) {
      showError('Error', 'Please select a CSV file')
      return
    }

    if (!file.name.endsWith('.csv')) {
      showError('Error', 'Please select a valid CSV file')
      return
    }

    try {
      setImportingCSV(true)
      const response = await leadsAPI.importLeadsCSV(file)
      const result = response.data || response
      
      if (result.success) {
        const hasErrors = result.errors > 0
        const hasDuplicates = result.duplicates > 0
        
        if (hasErrors && hasDuplicates) {
          showInfo(
            'Import Completed with Warnings',
            `Successfully imported ${result.created} out of ${result.total_rows} leads. ${result.duplicates} duplicate(s) skipped, ${result.errors} error(s) occurred.`,
            { duration: 6000 }
          )
          if (result.error_details && result.error_details.length > 0) {
            console.warn('Import errors:', result.error_details)
          }
          if (result.duplicate_details && result.duplicate_details.length > 0) {
            console.warn('Duplicate leads:', result.duplicate_details)
          }
        } else if (hasDuplicates) {
          showInfo(
            'Import Completed',
            `Successfully imported ${result.created} out of ${result.total_rows} leads. ${result.duplicates} duplicate(s) skipped.`,
            { duration: 5000 }
          )
          if (result.duplicate_details && result.duplicate_details.length > 0) {
            console.warn('Duplicate leads:', result.duplicate_details)
          }
        } else if (hasErrors) {
          showInfo(
            'Import Completed with Errors',
            `Successfully imported ${result.created} out of ${result.total_rows} leads. ${result.errors} error(s) occurred.`,
            { duration: 5000 }
          )
          if (result.error_details && result.error_details.length > 0) {
            console.warn('Import errors:', result.error_details)
          }
        } else {
          showSuccess('Import Successful', `Successfully imported ${result.created} leads`)
        }
        
        // Refresh leads list
        await fetchLeads(false)
      } else {
        showError('Import Failed', result.message || 'Failed to import leads')
      }
    } catch (error) {
      console.error('Error importing CSV:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to import CSV file'
      showError('Import Failed', errorMessage)
    } finally {
      setImportingCSV(false)
    }
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
    { value: 'lost', label: 'Lost', count: stats.lost },
    { value: 'invalid', label: 'Invalid', count: stats.invalid }
  ]

  const getStatusConfig = (status) => {
    const configs = {
      new: {
        color: 'from-blue-500 to-blue-600',
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-700',
        borderColor: 'border-blue-200',
        icon: AlertCircle,
        label: 'New'
      },
      contacted: {
        color: 'from-purple-500 to-purple-600',
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-700',
        borderColor: 'border-purple-200',
        icon: MessageCircle,
        label: 'Contacted'
      },
      responded: {
        color: 'from-green-500 to-green-600',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        icon: CheckCircle,
        label: 'Responded'
      },
      qualified: {
        color: 'from-orange-500 to-orange-600',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
        icon: CheckCircle,
        label: 'Qualified'
      },
      converted: {
        color: 'from-emerald-500 to-emerald-600',
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-700',
        borderColor: 'border-emerald-200',
        icon: CheckCircle,
        label: 'Converted'
      },
      lost: {
        color: 'from-gray-400 to-gray-500',
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        borderColor: 'border-gray-200',
        icon: XCircle,
        label: 'Lost'
      },
      invalid: {
        color: 'from-red-500 to-red-600',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        icon: XCircle,
        label: 'Invalid'
      }
    }
    return configs[status] || configs.new
  }

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
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
              {/* Stats Cards - Inline with buttons */}
              <div className="flex items-center gap-2 overflow-x-auto flex-1">
                {statusFilters.map((filter) => (
                  <div
                    key={filter.value}
                    onClick={() => setFilterStatus(filter.value)}
                    className={`bg-gray-50 rounded-lg px-3 py-1.5 shadow-sm border-2 cursor-pointer transition-all whitespace-nowrap flex-shrink-0 min-w-[70px] text-center ${
                      filterStatus === filter.value
                        ? 'border-blue-500 shadow-md bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-lg font-bold text-gray-900">
                      {filter.count}
                    </div>
                    <div className="text-xs text-gray-600">
                      {filter.label}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Search - Inline with Filter */}
              <div className="flex-1 max-w-xs relative filter-dropdown-container">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded transition-colors ${
                    filterPlatform !== 'all' 
                      ? 'text-blue-600' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                </button>
                {showFilterDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <button
                      onClick={() => {
                        setFilterPlatform('all')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 first:rounded-t-lg ${
                        filterPlatform === 'all' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      All Platforms
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('facebook')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'facebook' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Facebook
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('instagram')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'instagram' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Instagram
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('walk_ins')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'walk_ins' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Walk Ins
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('referral')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'referral' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Referral
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('email')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'email' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Email
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('website')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                        filterPlatform === 'website' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Website
                    </button>
                    <button
                      onClick={() => {
                        setFilterPlatform('phone_call')
                        setShowFilterDropdown(false)
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 last:rounded-b-lg ${
                        filterPlatform === 'phone_call' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                      }`}
                    >
                      Phone Call
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                {selectionMode && (
                  <>
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>{selectedLeadIds.size === filteredLeads.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                    {selectedLeadIds.size > 0 && (
                      <button
                        onClick={handleBulkDelete}
                        disabled={deletingBulk}
                        className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 shadow-lg hover:shadow-xl"
                      >
                        {deletingBulk ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                        <span>Delete ({selectedLeadIds.size})</span>
                      </button>
                    )}
                    <button
                      onClick={handleToggleSelectionMode}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </>
                )}
                {!selectionMode && (
                  <>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="p-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
                      title="Add Lead"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={loading}
                      className="p-2 bg-white text-black rounded-lg hover:bg-gray-100 transition-all duration-200 disabled:opacity-50 shadow-md hover:shadow-lg border border-gray-200"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Leads Board - Column Layout by Status */}
        <div className="flex-1 px-4 lg:px-6 py-6 overflow-x-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-600 text-lg">Loading leads...</p>
            </div>
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
            <div className="flex gap-2 w-full">
              {statusFilters
                .filter(statusFilter => statusFilter.value !== 'all') // Exclude 'all' from column view
                .map((statusFilter) => {
                  const columnLeads = filteredLeads.filter(lead => lead.status === statusFilter.value)
                  const statusConfig = getStatusConfig(statusFilter.value)
                  const StatusIcon = statusConfig.icon
                  
                  return (
                    <div key={statusFilter.value} className="flex-1 min-w-0">
                      {/* Column Header */}
                      <div className="mb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <StatusIcon className={`w-3 h-3 ${statusConfig.textColor}`} />
                            <h3 className={`font-semibold text-sm ${statusConfig.textColor}`}>{statusFilter.label}</h3>
                          </div>
                          <span className={`text-sm font-medium ${statusConfig.textColor}`}>
                            {columnLeads.length}
                          </span>
                        </div>
                      </div>
                      {/* Line after column title */}
                      <div className={`mb-2 border-b ${statusConfig.borderColor}`}></div>
                      
                      {/* Column Cards */}
                      <div className="space-y-1.5 max-h-[calc(100vh-180px)] overflow-y-auto pb-4 scrollbar-hide">
                        {columnLeads.length === 0 ? (
                          <div className="text-center py-8 text-gray-400 text-sm">
                            No {statusFilter.label.toLowerCase()} leads
                          </div>
                        ) : (
                          columnLeads.map((lead) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              onClick={handleLeadClick}
                              onDelete={handleDeleteLead}
                              isSelected={selectedLeadIds.has(lead.id)}
                              onSelect={handleSelectLead}
                              selectionMode={selectionMode}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
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
        onSuccess={async (data) => {
          if (data && data.type === 'csv') {
            // Handle CSV import
            await handleCSVImport(data.file)
            setShowAddModal(false)
          } else {
            // Handle regular lead creation
            await fetchLeads(false)
            setShowAddModal(false)
          }
        }}
        isImporting={importingCSV}
      />
    </div>
  )
}

export default LeadsDashboard

