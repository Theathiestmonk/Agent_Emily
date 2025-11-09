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
      }
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
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border border-gray-200 transform hover:scale-[1.02]"
    >
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${platformColor} p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              {getPlatformIcon(lead.source_platform)}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {lead.name || 'Unknown Lead'}
              </h3>
              <div className="flex items-center space-x-2 text-sm opacity-90">
                <span className="capitalize">{lead.source_platform}</span>
                <span>•</span>
                <span>{formatTimeAgo(lead.created_at)}</span>
              </div>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick && onClick(lead)
            }}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Contact Information */}
        <div className="space-y-2">
          {lead.email && (
            <div className="flex items-center space-x-2 text-gray-700">
              <Mail className="w-4 h-4 text-gray-400" />
              <span className="text-sm truncate">{lead.email}</span>
            </div>
          )}
          {lead.phone_number && (
            <div className="flex items-center space-x-2 text-gray-700">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{lead.phone_number}</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className={`inline-flex items-center space-x-2 px-3 py-1.5 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
          <StatusIcon className={`w-4 h-4 ${statusConfig.textColor}`} />
          <span className={`text-xs font-medium ${statusConfig.textColor}`}>
            {statusConfig.label}
          </span>
        </div>

        {/* Quick Info */}
        {lead.form_data && Object.keys(lead.form_data).length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {Object.keys(lead.form_data).length} form field{Object.keys(lead.form_data).length !== 1 ? 's' : ''} captured
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1">
            <Clock className="w-3 h-3" />
            <span>Created {formatTimeAgo(lead.created_at)}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick && onClick(lead)
            }}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            View Details →
          </button>
        </div>
      </div>
    </div>
  )
}

export default LeadCard

