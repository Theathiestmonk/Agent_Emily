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
    <div className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 ${platformInfo.color} rounded-lg flex items-center justify-center`}>
            <span className="text-white font-bold text-lg">
              {platformInfo.name.charAt(0)}
            </span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{platformInfo.name}</h3>
            <p className="text-sm text-gray-600">{connection.account_name}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Connection Method Badge */}
          <span className={`px-2 py-1 text-xs rounded-full flex items-center ${methodInfo.bgColor} ${methodInfo.color}`}>
            {getMethodIcon()}
            <span className="ml-1">{methodInfo.name}</span>
          </span>
          
          {/* Status */}
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
            <span className={`text-sm font-medium ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      {/* Account Details */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Account Type:</span>
          <span className="text-gray-900 capitalize">{connection.account_type}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Account ID:</span>
          <span className="text-gray-900 font-mono text-xs">{connection.account_id}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Connected:</span>
          <span className="text-gray-900">{formatDate(connection.connected_at)}</span>
        </div>
        {connection.last_sync_at && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Last Sync:</span>
            <span className="text-gray-900 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatDate(connection.last_sync_at)}
            </span>
          </div>
        )}
      </div>

      {/* Permissions */}
      {connection.permissions && Object.keys(connection.permissions).length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Permissions:</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(connection.permissions).map(([permission, granted]) => (
              <span
                key={permission}
                className={`px-2 py-1 text-xs rounded ${
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
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <a
            href={`https://${connection.platform}.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Visit {platformInfo.name}
          </a>
        </div>
        
        <button
          onClick={() => onDisconnect(connection.id)}
          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}

export default ConnectionStatus
