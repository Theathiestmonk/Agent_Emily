import React from 'react'
import { Check, Shield, Key, ExternalLink, Clock, AlertCircle } from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'

const ConnectionStatus = ({ connection, onDisconnect }) => {
  const platformInfo = socialMediaService.getPlatformInfo(connection.platform)
  const methodInfo = socialMediaService.getConnectionMethodInfo(connection.connection_method)
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusIcon = () => {
    if (connection.is_active) {
      return <Check className="w-4 h-4 text-green-600" />
    }
    return <AlertCircle className="w-4 h-4 text-red-600" />
  }

  const getStatusText = () => {
    if (connection.is_active) {
      return 'Connected'
    }
    return 'Disconnected'
  }

  const getStatusColor = () => {
    if (connection.is_active) {
      return 'text-green-600'
    }
    return 'text-red-600'
  }

  const getMethodIcon = () => {
    return connection.connection_method === 'oauth' 
      ? <Shield className="w-4 h-4" />
      : <Key className="w-4 h-4" />
  }

  return (
    <div className="group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-gray-200">
      {/* Card Header */}
      <div className="relative p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-16 h-16 ${platformInfo.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
            {platformInfo.icon ? (
              <platformInfo.icon className="w-8 h-8 text-white" />
            ) : (
              <span className="text-white font-bold text-xl">
                {platformInfo.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 text-xs rounded-full flex items-center bg-green-100 text-green-800 font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              Connected
            </span>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">{platformInfo.name}</h3>
        <p className="text-gray-600 text-sm leading-relaxed">{connection.account_name || connection.page_name || 'Connected Account'}</p>
      </div>

      {/* Card Body */}
      <div className="px-6 pb-6">
        {/* Account Info - Inline Values */}
        <div className="space-y-3 mb-4">
          {(connection.account_type || connection.page_username) && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Account Type:</span>
              <span className="text-sm font-semibold text-gray-900 capitalize bg-blue-100 text-blue-800 px-3 py-1 rounded-lg">
                {connection.account_type || (connection.page_username ? 'Business' : 'Personal')}
              </span>
            </div>
          )}
          {(connection.account_id || connection.page_id) && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Account ID:</span>
              <span className="text-xs font-mono text-gray-700 bg-gray-100 px-3 py-1 rounded max-w-[200px] truncate">
                {connection.account_id || connection.page_id}
              </span>
            </div>
          )}
          {connection.connected_at && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Connected:</span>
              <span className="text-sm text-gray-700 flex items-center">
                <Clock className="w-4 h-4 mr-1 text-gray-500" />
                {formatDate(connection.connected_at)}
              </span>
            </div>
          )}
        </div>

          {/* Platform Stats - Only show if we have meaningful data (not demo/placeholder values) */}
          {((connection.follower_count && connection.follower_count > 10) || (connection.subscriber_count && connection.subscriber_count > 10) || connection.last_posted_at) && (
            <div className="grid grid-cols-2 gap-4">
              {((connection.follower_count && connection.follower_count > 10) || (connection.subscriber_count && connection.subscriber_count > 10)) && (
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-green-700">
                    {connection.follower_count || connection.subscriber_count}
                  </div>
                  <div className="text-xs text-green-600">
                    {connection.platform === 'youtube' ? 'Subscribers' : 'Followers'}
                  </div>
                </div>
              )}
              {connection.last_posted_at && (
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-blue-700">Active</div>
                  <div className="text-xs text-blue-600">Status</div>
                </div>
              )}
            </div>
          )}

        {/* Permissions */}
        {connection.permissions && Object.keys(connection.permissions).length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
              <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
              Permissions
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(connection.permissions).map(([permission, granted]) => (
                <span
                  key={permission}
                  className={`px-3 py-1 text-xs rounded-full font-medium ${
                    granted 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {permission.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <a
            href={`https://${connection.platform}.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Visit {platformInfo.name}
          </a>
          
          <button
            onClick={() => onDisconnect(connection.id)}
            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Disconnect
          </button>
        </div>
      </div>

      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </div>
  )
}

export default ConnectionStatus
