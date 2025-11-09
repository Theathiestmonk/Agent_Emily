import React from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  Facebook, 
  Instagram, 
  MessageCircle, 
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'

const LeadCard = ({ lead, onClick }) => {
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

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return <Facebook className="w-3.5 h-3.5" />
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5" />
      default:
        return <User className="w-3.5 h-3.5" />
    }
  }

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return 'from-blue-600 to-blue-800'
      case 'instagram':
        return 'from-pink-500 via-purple-500 to-pink-600'
      default:
        return 'from-gray-500 to-gray-700'
    }
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
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  const statusConfig = getStatusConfig(lead.status)
  const StatusIcon = statusConfig.icon
  const platformColor = getPlatformColor(lead.source_platform)

  return (
    <div
      onClick={() => onClick && onClick(lead)}
      className={`bg-gradient-to-br from-white ${statusConfig.bgColor} rounded-lg shadow-md overflow-hidden cursor-pointer border ${statusConfig.borderColor}`}
    >
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${statusConfig.color} p-2 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              {getPlatformIcon(lead.source_platform)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-xs truncate">
                {lead.name || 'Unknown Lead'}
              </h3>
              <div className="flex items-center space-x-0.5 text-[10px] opacity-90">
                <span className="capitalize truncate">{lead.source_platform}</span>
                <span>•</span>
                <span className="truncate">{formatTimeAgo(lead.created_at)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick && onClick(lead)
            }}
            className="p-1 bg-white/20 rounded flex-shrink-0 ml-0.5"
            title="View details"
          >
            <Eye className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Content - Only show if form data exists */}
      {lead.form_data && Object.keys(lead.form_data).length > 0 && (
        <div className="p-1.5">
          <p className="text-[10px] text-gray-500">
            {Object.keys(lead.form_data).length} form field{Object.keys(lead.form_data).length !== 1 ? 's' : ''} captured
          </p>
        </div>
      )}

      {/* Footer */}
      <div className={`px-1.5 py-1.5 ${statusConfig.bgColor} border-t ${statusConfig.borderColor}`}>
        <div className="flex items-center text-[10px] text-gray-500">
          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate ml-0.5">{formatTimeAgo(lead.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

export default LeadCard

