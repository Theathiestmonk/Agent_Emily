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
  Loader2
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

  useEffect(() => {
    fetchConversations()
    fetchStatusHistory()
  }, [lead.id])

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
    // Status history would come from a separate endpoint if available
    // For now, we'll use the conversations to build a timeline
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

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdatingStatus(true)
      await leadsAPI.updateLeadStatus(lead.id, newStatus)
      setSelectedStatus(newStatus)
      showSuccess('Status Updated', `Lead status updated to ${newStatus}`)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
      showError('Error', 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
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
      default:
        return <User className="w-5 h-5" />
    }
  }

  // Build timeline from conversations and status changes
  const timeline = [
    {
      type: 'lead_captured',
      title: 'Lead Captured',
      description: `Lead captured from ${lead.source_platform}`,
      timestamp: lead.created_at,
      icon: UserCheck,
      color: 'text-blue-600 bg-blue-50'
    },
    ...conversations.map(conv => ({
      type: conv.message_type,
      title: conv.sender === 'agent' ? `${conv.message_type === 'email' ? 'Email' : 'WhatsApp'} Sent` : 'Lead Responded',
      description: conv.content.substring(0, 100) + (conv.content.length > 100 ? '...' : ''),
      timestamp: conv.created_at,
      icon: conv.message_type === 'email' ? MailIcon : MessageSquare,
      color: conv.sender === 'agent' ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50',
      status: conv.status,
      fullContent: conv.content
    }))
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const emailConversations = conversations.filter(c => c.message_type === 'email')
  const whatsappConversations = conversations.filter(c => c.message_type === 'whatsapp')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
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
          <div className="mt-4 flex items-center space-x-3">
            <span className="text-sm font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              disabled={updatingStatus}
              className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-50"
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="responded">Responded</option>
              <option value="qualified">Qualified</option>
              <option value="converted">Converted</option>
              <option value="lost">Lost</option>
            </select>
            {updatingStatus && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex space-x-1 px-6 bg-gray-50">
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
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
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
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-xs text-gray-500">Email</div>
                        <div className="text-sm font-medium text-gray-900">{lead.email}</div>
                      </div>
                    </div>
                  )}
                  {lead.phone_number && (
                    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-5 h-5 text-gray-400" />
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
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
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
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
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
                        <div className="flex-1 bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-gray-900">{event.title}</h4>
                            <span className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-600">{event.description}</p>
                          {event.status && (
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                event.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                event.status === 'read' ? 'bg-purple-100 text-purple-700' :
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
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Send Message</h3>
                <div className="space-y-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSendMessage('whatsapp')}
                      disabled={sendingMessage || !newMessage.trim() || !lead.phone_number}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`p-4 rounded-lg ${
                          conv.sender === 'agent' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
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
                              conv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-purple-100 text-purple-700' :
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
                        className={`p-4 rounded-lg ${
                          conv.sender === 'agent' ? 'bg-green-50 ml-8' : 'bg-gray-50 mr-8'
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
                              conv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-purple-100 text-purple-700' :
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

