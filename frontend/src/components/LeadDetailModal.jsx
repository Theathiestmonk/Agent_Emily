import React, { useState, useEffect } from 'react'
import { 
  X, 
  Mail, 
  Phone, 
  Facebook, 
  Instagram,
  User,
  Calendar,
  MessageCircle,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  UserCheck,
  XCircle,
  ChevronRight,
  Mail as MailIcon,
  MessageSquare,
  Loader2,
  Globe,
  Users,
  LogIn,
  CalendarCheck,
  ChevronDown
} from 'lucide-react'
import { leadsAPI } from '../services/leads'
import { useNotifications } from '../contexts/NotificationContext'

const LeadDetailModal = ({ lead, onClose, onUpdate }) => {
  const { showSuccess, showError } = useNotifications()
  const [activeTab, setActiveTab] = useState('overview')
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(lead.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusRemarks, setStatusRemarks] = useState('')
  const [showRemarksInput, setShowRemarksInput] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [followUpAt, setFollowUpAt] = useState(lead.follow_up_at || '')
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)

  useEffect(() => {
    fetchConversations()
    fetchStatusHistory()
    setFollowUpAt(lead.follow_up_at || '')
  }, [lead.id, lead.follow_up_at])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownOpen && !event.target.closest('.status-dropdown-container')) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen])

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true)
      const response = await leadsAPI.getLeadConversations(lead.id, { limit: 200 })
      setConversations(response.data || [])
    } catch (error) {
      console.error('Error fetching conversations:', error)
      showError('Error', 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }

  const fetchStatusHistory = async () => {
    try {
      const response = await leadsAPI.getStatusHistory(lead.id)
      setStatusHistory(response.data || [])
    } catch (error) {
      console.error('Error fetching status history:', error)
      // Don't show error notification, just log it
      setStatusHistory([])
    }
  }

  const handleSendMessage = async (messageType = 'whatsapp') => {
    if (!newMessage.trim()) {
      showError('Error', 'Please enter a message')
      return
    }

    try {
      setSendingMessage(true)
      await leadsAPI.sendMessageToLead(lead.id, newMessage, messageType)
      showSuccess('Message Sent', `Message sent via ${messageType}`)
      setNewMessage('')
      fetchConversations()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error sending message:', error)
      showError('Error', 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleStatusChange = (newStatus) => {
    if (newStatus !== selectedStatus) {
      setPendingStatus(newStatus)
      setShowRemarksInput(true)
      setStatusRemarks('')
    }
  }

  const handleStatusUpdate = async () => {
    if (!pendingStatus) return
    
    try {
      setUpdatingStatus(true)
      await leadsAPI.updateLeadStatus(lead.id, pendingStatus, statusRemarks || null)
      setSelectedStatus(pendingStatus)
      setShowRemarksInput(false)
      setPendingStatus(null)
      setStatusRemarks('')
      showSuccess('Status Updated', `Lead status updated to ${pendingStatus}`)
      // Refresh status history to show the new status change with remarks
      await fetchStatusHistory()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
      showError('Error', 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCancelStatusUpdate = () => {
    setShowRemarksInput(false)
    setPendingStatus(null)
    setStatusRemarks('')
    // Reset dropdown to current status by forcing a re-render
    // The select value will automatically reset to selectedStatus when pendingStatus is null
  }

  const handleFollowUpChange = async (e) => {
    const newFollowUpAt = e.target.value
    setFollowUpAt(newFollowUpAt)
    
    try {
      setUpdatingFollowUp(true)
      const isoDateTime = newFollowUpAt ? new Date(newFollowUpAt).toISOString() : null
      await leadsAPI.updateFollowUp(lead.id, isoDateTime)
      showSuccess('Follow-up Updated', 'Follow-up date has been updated')
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating follow-up:', error)
      showError('Error', 'Failed to update follow-up date')
      // Revert to previous value on error
      setFollowUpAt(lead.follow_up_at || '')
    } finally {
      setUpdatingFollowUp(false)
    }
  }

  const clearFollowUp = async () => {
    try {
      setUpdatingFollowUp(true)
      await leadsAPI.updateFollowUp(lead.id, null)
      setFollowUpAt('')
      showSuccess('Follow-up Cleared', 'Follow-up date has been cleared')
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error clearing follow-up:', error)
      showError('Error', 'Failed to clear follow-up date')
    } finally {
      setUpdatingFollowUp(false)
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays}d ago`
    return formatTime(dateString)
  }

  const getStatusConfig = (status) => {
    const configs = {
      new: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'New' },
      contacted: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Contacted' },
      responded: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Responded' },
      qualified: { color: 'bg-orange-100 text-orange-700 border-orange-200', label: 'Qualified' },
      converted: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Converted' },
      lost: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Lost' }
    }
    return configs[status] || configs.new
  }

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return <Facebook className="w-5 h-5" />
      case 'instagram':
        return <Instagram className="w-5 h-5" />
      case 'walk_ins':
      case 'walk-ins':
        return <LogIn className="w-5 h-5" />
      case 'referral':
        return <Users className="w-5 h-5" />
      case 'email':
        return <Mail className="w-5 h-5" />
      case 'website':
        return <Globe className="w-5 h-5" />
      case 'phone_call':
      case 'phone-call':
      case 'phone call':
        return <Phone className="w-5 h-5" />
      default:
        return <User className="w-5 h-5" />
    }
  }

  // Deduplicate status history entries
  // Remove duplicates based on ID (if available) or combination of old_status, new_status, and created_at
  const deduplicatedStatusHistory = statusHistory.reduce((acc, current) => {
    // If ID exists, use it for deduplication
    if (current.id) {
      const isDuplicate = acc.some(item => item.id === current.id)
      if (!isDuplicate) {
        acc.push(current)
      }
    } else {
      // Fallback: use old_status, new_status, and created_at (within 1 second)
      const isDuplicate = acc.some(item => 
        item.old_status === current.old_status &&
        item.new_status === current.new_status &&
        Math.abs(new Date(item.created_at) - new Date(current.created_at)) < 1000 // Within 1 second
      )
      if (!isDuplicate) {
        acc.push(current)
      }
    }
    return acc
  }, [])

  // Build timeline from conversations and status changes
  const timeline = [
    {
      type: 'lead_captured',
      title: 'Lead Captured',
      description: `Lead captured from ${lead.source_platform}`,
      timestamp: lead.created_at,
      icon: UserCheck,
      color: 'text-purple-600 bg-purple-50'
    },
    ...deduplicatedStatusHistory.map(history => ({
      type: 'status_change',
      title: `Status Changed: ${history.old_status} → ${history.new_status}`,
      description: history.reason || 'Status updated',
      remarks: history.reason,
      timestamp: history.created_at,
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50',
      oldStatus: history.old_status,
      newStatus: history.new_status
    })),
    ...conversations.map(conv => ({
      type: conv.message_type,
      title: conv.sender === 'agent' ? `${conv.message_type === 'email' ? 'Email' : 'WhatsApp'} Sent` : 'Lead Responded',
      description: conv.content.substring(0, 100) + (conv.content.length > 100 ? '...' : ''),
      timestamp: conv.created_at,
      icon: conv.message_type === 'email' ? MailIcon : MessageSquare,
      color: conv.sender === 'agent' ? 'text-purple-600 bg-purple-50' : 'text-pink-600 bg-pink-50',
      status: conv.status,
      fullContent: conv.content
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const emailConversations = conversations.filter(c => c.message_type === 'email')
  const whatsappConversations = conversations.filter(c => c.message_type === 'whatsapp')

  return (
    <div className="fixed bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                {getPlatformIcon(lead.source_platform)}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{lead.name || 'Unknown Lead'}</h2>
                <div className="flex items-center space-x-3 mt-1 text-sm opacity-90">
                  <span className="capitalize">{lead.source_platform}</span>
                  <span>•</span>
                  <span>{formatTimeAgo(lead.created_at)}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium">Status:</span>
              <div className="relative status-dropdown-container">
                <button
                  onClick={() => !updatingStatus && !showRemarksInput && setStatusDropdownOpen(!statusDropdownOpen)}
                  disabled={updatingStatus || showRemarksInput}
                  className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 flex items-center space-x-2 min-w-[140px] justify-between"
                >
                  <span className="capitalize">{pendingStatus || selectedStatus}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {/* Custom Dropdown with Glassmorphism */}
                {statusDropdownOpen && (
                  <div 
                    className="absolute top-full mt-2 left-0 w-full min-w-[160px] z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white/95 backdrop-blur-lg border border-white/40 rounded-lg shadow-2xl overflow-hidden ring-1 ring-black/5">
                      <div className="py-1">
                        {[
                          { value: 'new', label: 'New' },
                          { value: 'contacted', label: 'Contacted' },
                          { value: 'responded', label: 'Responded' },
                          { value: 'qualified', label: 'Qualified' },
                          { value: 'converted', label: 'Converted' },
                          { value: 'lost', label: 'Lost' },
                          { value: 'invalid', label: 'Invalid' }
                        ].map((option) => (
                          <button
                            key={option.value}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStatusChange(option.value)
                              setStatusDropdownOpen(false)
                            }}
                disabled={updatingStatus || showRemarksInput}
                            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center space-x-2 ${
                              (pendingStatus || selectedStatus) === option.value
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                            } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          >
                            <span className="capitalize">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            
            {/* Remarks Input */}
            {showRemarksInput && pendingStatus && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-white">
                    Changing status to: <span className="capitalize font-semibold">{pendingStatus}</span>
                  </label>
                </div>
                <label className="text-sm font-medium text-white">Remarks (Optional)</label>
                <textarea
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Add remarks about this status change..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus}
                    className="flex-1 px-4 py-2 bg-white/20 hover:bg-white/30 border border-white/30 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {updatingStatus ? 'Updating...' : 'Save Status Change'}
                  </button>
                  <button
                    onClick={handleCancelStatusUpdate}
                    disabled={updatingStatus}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {/* Follow-up Date & Time */}
            <div className="flex items-center space-x-3">
              <CalendarCheck className="w-4 h-4 text-white" />
              <span className="text-sm font-medium text-white">Follow-up:</span>
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="datetime-local"
                  value={followUpAt ? new Date(followUpAt).toISOString().slice(0, 16) : ''}
                  onChange={handleFollowUpChange}
                  disabled={updatingFollowUp}
                  className="flex-1 px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50 placeholder-white/60"
                  placeholder="Set follow-up date & time"
                />
                {followUpAt && (
                  <button
                    onClick={clearFollowUp}
                    disabled={updatingFollowUp}
                    className="px-2 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white text-xs font-medium transition-colors disabled:opacity-50"
                    title="Clear follow-up"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                {updatingFollowUp && <Loader2 className="w-4 h-4 animate-spin text-white" />}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex space-x-1 px-6 bg-gradient-to-r from-pink-50 to-purple-50">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'timeline', label: 'Timeline', icon: Clock },
            { id: 'conversations', label: 'Conversations', icon: MessageCircle }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-purple-600'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lead.email && (
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-purple-200">
                      <Mail className="w-5 h-5 text-purple-500" />
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm font-medium text-gray-900">{lead.email}</div>
                      </div>
                    </div>
                  )}
                  {lead.phone_number && (
                    <div className="flex items-center space-x-3 p-3 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg border border-purple-200">
                      <Phone className="w-5 h-5 text-purple-500" />
                      <div>
                        <div className="text-xs text-gray-500">Phone</div>
                        <div className="text-sm font-medium text-gray-900">{lead.phone_number}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Metadata */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Details</h3>
                <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 space-y-2 border border-purple-200">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Source Platform:</span>
                    <span className="text-sm font-medium text-gray-900 capitalize">{lead.source_platform}</span>
                  </div>
                  {lead.ad_id && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Ad ID:</span>
                      <span className="text-sm font-medium text-gray-900">{lead.ad_id}</span>
                    </div>
                  )}
                  {lead.campaign_id && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Campaign ID:</span>
                      <span className="text-sm font-medium text-gray-900">{lead.campaign_id}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="text-sm font-medium text-gray-900">{formatTime(lead.created_at)}</span>
                  </div>
                  {lead.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Updated:</span>
                      <span className="text-sm font-medium text-gray-900">{formatTime(lead.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Data */}
              {lead.form_data && Object.keys(lead.form_data).length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Form Responses</h3>
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 space-y-3 border border-purple-200">
                    {Object.entries(lead.form_data).map(([key, value]) => (
                      <div key={key} className="border-b border-gray-200 last:border-0 pb-3 last:pb-0">
                        <div className="text-xs text-gray-500 mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
                        <div className="text-sm font-medium text-gray-900">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No timeline events yet</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  
                  {timeline.map((event, index) => {
                    const Icon = event.icon
                    return (
                      <div key={index} className="relative flex items-start space-x-4 mb-6">
                        <div className={`relative z-10 w-8 h-8 rounded-full ${event.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            <span className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                          {event.type === 'status_change' && event.remarks && (
                            <div className="mt-3 p-3 bg-white/60 rounded-lg border border-blue-200">
                              <div className="text-xs font-semibold text-blue-700 mb-1">Remarks:</div>
                              <p className="text-sm text-gray-700">{event.remarks}</p>
                            </div>
                          )}
                          {event.status && (
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                                event.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                event.status === 'read' ? 'bg-pink-100 text-pink-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {event.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conversations' && (
            <div className="space-y-6">
              {/* Send Message */}
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 border border-purple-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Send Message</h3>
                <div className="space-y-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSendMessage('whatsapp')}
                      disabled={sendingMessage || !newMessage.trim() || !lead.phone_number}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          <span>Send WhatsApp</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleSendMessage('email')}
                      disabled={sendingMessage || !newMessage.trim() || !lead.email}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <MailIcon className="w-4 h-4" />
                          <span>Send Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Conversations */}
              {emailConversations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <MailIcon className="w-5 h-5" />
                    <span>Email ({emailConversations.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {emailConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 rounded-lg border ${
                          conv.sender === 'agent' ? 'bg-gradient-to-r from-pink-100 to-purple-100 ml-8 border-purple-200' : 'bg-gray-50 mr-8 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {conv.sender === 'agent' ? 'You' : lead.name || 'Lead'}
                          </span>
                          <span className="text-xs text-gray-500">{formatTimeAgo(conv.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{conv.content}</p>
                        {conv.status && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              conv.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {conv.status}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Conversations */}
              {whatsappConversations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>WhatsApp ({whatsappConversations.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {whatsappConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 rounded-lg border ${
                          conv.sender === 'agent' ? 'bg-gradient-to-r from-pink-100 to-purple-100 ml-8 border-purple-200' : 'bg-gray-50 mr-8 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {conv.sender === 'agent' ? 'You' : lead.name || 'Lead'}
                          </span>
                          <span className="text-xs text-gray-500">{formatTimeAgo(conv.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{conv.content}</p>
                        {conv.status && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              conv.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {conv.status}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conversations.length === 0 && !loadingConversations && (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LeadDetailModal

