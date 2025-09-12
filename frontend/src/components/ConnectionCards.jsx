import React, { useState, useEffect } from 'react'
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube, 
  Mail,
  Hash,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react'
import { connectionsAPI } from '../services/connections'

const ConnectionCards = ({ compact = false }) => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'from-blue-600 to-blue-700',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'from-pink-500 via-red-500 to-yellow-500',
      iconColor: 'text-pink-500',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'from-blue-700 to-blue-800',
      iconColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: Twitter,
      color: 'from-sky-500 to-sky-600',
      iconColor: 'text-sky-500',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: 'from-red-600 to-red-700',
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      id: 'google',
      name: 'Google',
      icon: Mail,
      color: 'from-red-500 via-yellow-500 via-green-500 to-blue-500',
      iconColor: 'text-red-500',
      bgColor: 'bg-gradient-to-r from-red-50 to-blue-50',
      borderColor: 'border-red-200'
    }
  ]

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      const response = await connectionsAPI.getConnections()
      setConnections(response.data || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platformId) => {
    try {
      setConnecting(platformId)
      
      if (platformId === 'google') {
        // Handle Google OAuth in popup window
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        // Ensure no double slashes in URL
        const cleanUrl = API_BASE_URL.replace(/\/+$/, '') + '/connections/google/auth/initiate'
        const response = await fetch(cleanUrl)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Google auth error:', response.status, errorText)
          throw new Error(`Failed to get Google auth URL: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.auth_url) {
          // Open Google OAuth in popup window
          const popup = window.open(
            data.auth_url,
            'google-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
          )
          
          // Listen for popup messages
          const messageHandler = (event) => {
            if (event.origin !== window.location.origin) return
            
            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
              console.log('Google OAuth successful:', event.data)
              popup.close()
              window.removeEventListener('message', messageHandler)
              await fetchConnections() // Refresh connections
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
              console.error('Google OAuth error:', event.data.error)
              popup.close()
              window.removeEventListener('message', messageHandler)
              alert(`Google OAuth failed: ${event.data.error}`)
            }
          }
          
          window.addEventListener('message', messageHandler)
          
          // Check if popup was closed manually
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              window.removeEventListener('message', messageHandler)
            }
          }, 1000)
        } else {
          throw new Error('Failed to get Google auth URL from response')
        }
      } else {
        // Handle other platforms
        const response = await connectionsAPI.connectPlatform(platformId)
        
        if (response.auth_url) {
          window.location.href = response.auth_url
        } else {
          throw new Error('Failed to get auth URL')
        }
      }
    } catch (error) {
      console.error(`Error connecting to ${platformId}:`, error)
      alert(`Failed to connect to ${platformId}. Please try again.`)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platformId) => {
    try {
      if (platformId === 'google') {
        // Handle Google disconnect
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        // Ensure no double slashes in URL
        const cleanUrl = API_BASE_URL.replace(/\/+$/, '') + '/connections/google/disconnect'
        const response = await fetch(cleanUrl, {
          method: 'GET'
        })
        const data = await response.json()
        
        if (data.success) {
          await fetchConnections()
        } else {
          throw new Error('Failed to disconnect Google')
        }
      } else {
        // Handle other platforms
        await connectionsAPI.disconnectPlatform(platformId)
        await fetchConnections()
      }
    } catch (error) {
      console.error(`Error disconnecting from ${platformId}:`, error)
      alert(`Failed to disconnect from ${platformId}. Please try again.`)
    }
  }

  const getConnectionStatus = (platformId) => {
    const connection = connections.find(conn => conn.platform === platformId)
    return connection ? {
      connected: connection.is_active,
      status: connection.connection_status,
      pageName: connection.page_name,
      lastSync: connection.last_sync
    } : { connected: false, status: 'disconnected' }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'expired':
      case 'revoked':
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />
      default:
        return <XCircle className="w-3 h-3 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600 text-sm">Loading connections...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => {
        const { connected, status } = getConnectionStatus(platform.id)
        const IconComponent = platform.icon

          return (
            <div
              key={platform.id}
            className="relative group"
          >
            <button
              onClick={() => connected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
              disabled={connecting === platform.id}
              className={`
                w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200
                ${connected ? `bg-gradient-to-r ${platform.color}` : 'bg-white border-2 border-gray-200'}
                hover:shadow-md hover:scale-105
                disabled:opacity-50 disabled:cursor-not-allowed
                ${connected ? 'ring-2 ring-green-400' : ''}
              `}
              title={`${connected ? 'Disconnect from' : 'Connect to'} ${platform.name}`}
            >
              <IconComponent className={`w-6 h-6 ${connected ? 'text-white' : platform.iconColor}`} />
              
              {/* Status indicator dot */}
              <div className="absolute -top-1 -right-1">
                {getStatusIcon(status)}
                      </div>
            </button>

            {/* Loading spinner for connecting state */}
            {connecting === platform.id && (
              <div className="absolute inset-0 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}

            {/* Google-specific dashboard button when connected */}
            {connected && platform.id === 'google' && (
              <div className="absolute top-14 left-0 bg-white rounded-lg shadow-lg border p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <button
                  onClick={() => window.open('/google-dashboard', '_blank')}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Open Dashboard
                </button>
                    </div>
                  )}
            </div>
          )
        })}
    </div>
  )
}

export default ConnectionCards