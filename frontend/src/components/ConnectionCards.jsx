import React, { useState, useEffect } from 'react'
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube, 
  Hash,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { connectionsAPI } from '../services/connections'

const ConnectionCards = () => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'from-pink-500 to-purple-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'from-blue-600 to-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: Twitter,
      color: 'from-sky-400 to-sky-500',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200'
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      icon: Hash,
      color: 'from-black to-gray-800',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  ]

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const { data, error } = await connectionsAPI.getConnections()
      
      if (error) {
        console.error('Failed to fetch connections:', error)
        setConnections([])
      } else {
        setConnections(data || [])
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
      setConnections([])
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platform) => {
    try {
      setConnecting(platform)
      const { data: authUrl, error } = await connectionsAPI.initiateConnection(platform)
      
      if (error) {
        console.error('Failed to initiate connection:', error)
        setConnecting(null)
        return
      }
      
      // Open OAuth in popup window
      const popup = window.open(
        authUrl,
        'oauth',
        'width=600,height=700,scrollbars=yes,resizable=yes'
      )
      
      // Listen for OAuth completion
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          setConnecting(null)
          // Refresh connections
          fetchConnections()
        }
      }, 1000)
      
      // Listen for postMessage from popup
      const handleMessage = (event) => {
        console.log('Received message from popup:', event.data)
        if (event.data && event.data.type === 'OAUTH_SUCCESS') {
          console.log('OAuth success received, closing popup and refreshing connections')
          popup.close()
          clearInterval(checkClosed)
          setConnecting(null)
          // Refresh connections
          fetchConnections()
        }
      }
      
      window.addEventListener('message', handleMessage)
      
      // Clean up listener when popup closes
      const cleanup = () => {
        console.log('Cleaning up popup listeners')
        window.removeEventListener('message', handleMessage)
        clearInterval(checkClosed)
      }
      
      popup.addEventListener('beforeunload', cleanup)
      
      // Also clean up after a timeout as fallback
      setTimeout(() => {
        if (!popup.closed) {
          console.log('Popup still open after 30 seconds, cleaning up')
          cleanup()
        }
      }, 30000)
      
    } catch (error) {
      console.error('Failed to connect:', error)
      setConnecting(null)
    }
  }

  const handleDisconnect = async (connectionId) => {
    try {
      const { error } = await connectionsAPI.disconnectAccount(connectionId)
      
      if (error) {
        console.error('Failed to disconnect:', error)
        return
      }
      
      setConnections(prev => prev.filter(conn => conn.id !== connectionId))
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  const getConnectionStatus = (platform) => {
    const connection = connections.find(conn => conn.platform === platform)
    return connection ? connection.connection_status : 'disconnected'
  }

  const getConnectionInfo = (platform) => {
    return connections.find(conn => conn.platform === platform)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-pink-500" />
      </div>
    )
  }

  const handleRefresh = () => {
    console.log('Manual refresh triggered')
    console.log('Current connections before refresh:', connections)
    fetchConnections()
  }

  // Debug: Log connections whenever they change
  useEffect(() => {
    console.log('Connections updated:', connections)
  }, [connections])

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Social Media Connections</h3>
          <p className="text-sm text-gray-500">Connect your accounts to enable automated posting</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            {connections.filter(conn => conn.connection_status === 'active').length} of {platforms.length} connected
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {platforms.map((platform) => {
          const Icon = platform.icon
          const status = getConnectionStatus(platform.id)
          const connectionInfo = getConnectionInfo(platform.id)
          const isConnecting = connecting === platform.id
          const isConnected = status === 'active'
          const hasError = status === 'error'

          return (
            <div
              key={platform.id}
              className={`relative p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                isConnected
                  ? `${platform.bgColor} ${platform.borderColor} border-green-300`
                  : hasError
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => {
                if (isConnected) {
                  handleDisconnect(connectionInfo.id)
                } else if (!isConnecting) {
                  handleConnect(platform.id)
                }
              }}
            >
              <div className="flex flex-col items-center text-center">
                {/* Platform Icon */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${
                  isConnected
                    ? `bg-gradient-to-r ${platform.color}`
                    : hasError
                    ? 'bg-red-500'
                    : 'bg-gray-400'
                }`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                {/* Platform Name */}
                <h4 className="font-medium text-gray-900 text-sm mb-1">
                  {platform.name}
                </h4>

                {/* Connection Status */}
                <div className="flex items-center space-x-1 mb-2">
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                      <span className="text-xs text-blue-600">Connecting...</span>
                    </>
                  ) : isConnected ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600">Connected</span>
                    </>
                  ) : hasError ? (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-xs text-red-600">Error</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Not Connected</span>
                    </>
                  )}
                </div>

                {/* Connection Info */}
                {connectionInfo && (
                  <div className="text-xs text-gray-500">
                    <p className="truncate max-w-full" title={connectionInfo.page_name}>
                      {connectionInfo.page_name}
                    </p>
                    <p>{connectionInfo.follower_count.toLocaleString()} followers</p>
                  </div>
                )}

                {/* Action Button */}
                <div className="mt-2">
                  {isConnecting ? (
                    <div className="w-full h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    </div>
                  ) : isConnected ? (
                    <div className="w-full h-8 bg-red-500 hover:bg-red-600 rounded-lg flex items-center justify-center transition-colors">
                      <XCircle className="w-4 h-4 text-white mr-1" />
                      <span className="text-white text-xs font-medium">Disconnect</span>
                    </div>
                  ) : (
                    <div className="w-full h-8 bg-green-500 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors">
                      <CheckCircle className="w-4 h-4 text-white mr-1" />
                      <span className="text-white text-xs font-medium">Connect</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-green-500'
                  : hasError
                  ? 'bg-red-500'
                  : 'bg-gray-300'
              }`} />
            </div>
          )
        })}
      </div>

      {/* Connection Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">
                {connections.filter(conn => conn.connection_status === 'active').length} Active
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-600">
                {connections.filter(conn => conn.connection_status === 'error').length} Error
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-gray-600">
                {platforms.length - connections.length} Not Connected
              </span>
            </div>
          </div>
          
          <button className="text-pink-600 hover:text-pink-700 font-medium flex items-center space-x-1">
            <span>Manage All</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConnectionCards
