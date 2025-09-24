import React, { useState, useEffect } from 'react'
import { 
  Instagram, 
  Facebook, 
  Linkedin, 
  Youtube, 
  Twitter,
  CheckCircle,
  XCircle,
  ArrowLeft,
  Check,
  AlertCircle
} from 'lucide-react'
import { connectionsAPI } from '../services/connections'
import { socialMediaService } from '../services/socialMedia'

const OnboardingConnections = ({ selectedPlatforms, onComplete, onSkip, onBack }) => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)

  // Platform configurations - matching ConnectionCards
  const platformConfigs = {
    'Instagram': {
      id: 'instagram',
      icon: Instagram,
      color: 'bg-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200',
      description: 'Business Account'
    },
    'Facebook': {
      id: 'facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Page'
    },
    'LinkedIn': {
      id: 'linkedin',
      icon: Linkedin,
      color: 'bg-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      description: 'Company Page'
    },
    'YouTube': {
      id: 'youtube',
      icon: Youtube,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Channel'
    },
    'X (Twitter)': {
      id: 'twitter',
      icon: Twitter,
      color: 'bg-sky-500',
      bgColor: 'bg-sky-50',
      borderColor: 'border-sky-200',
      description: 'Account'
    },
    'YouTube': {
      id: 'youtube',
      icon: Youtube,
      color: 'bg-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Channel'
    },
    'Google Business Profile': {
      id: 'google',
      icon: Youtube,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      description: 'Business Profile'
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      
      // Fetch OAuth connections
      const oauthResponse = await connectionsAPI.getConnections()
      const oauthConnections = oauthResponse.data || []
      
      // Fetch token-based connections
      let tokenConnections = []
      try {
        const tokenResponse = await socialMediaService.getConnections()
        tokenConnections = tokenResponse || []
      } catch (error) {
        console.log('No token connections found:', error.message)
      }
      
      // Combine both types of connections
      const allConnections = [...oauthConnections, ...tokenConnections]
      setConnections(allConnections)
      
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platformId) => {
    try {
      setConnecting(platformId)
      
      // Special handling for YouTube with user-friendly messaging
      if (platformId === 'youtube') {
        const userConfirmed = window.confirm(
          "🔑 To connect your YouTube account, I need permission through Google.\n\n" +
          "You'll be redirected to Google's secure login page where you enter your Google email and password. I will never see your password.\n\n" +
          "After login, you must grant access so I can manage your YouTube account.\n\n" +
          "Do you want to continue?"
        )
        
        if (!userConfirmed) {
          setConnecting(null)
          return
        }
        
        // Show additional info about permissions
        alert(
          "📋 On the Google permission screen, please allow the requested permissions:\n\n" +
          "• Manage your YouTube account\n" +
          "• Upload and manage videos\n" +
          "• View analytics and account details\n" +
          "• Reply to comments and manage engagement\n\n" +
          "Once you click Allow, you will be redirected back to the app."
        )
      }
      
      // Use the same method as settings page
      await socialMediaService.connectWithOAuth(platformId)
      
      // The connectWithOAuth method handles the popup and refresh automatically
      // We just need to refresh our local state after a short delay
      setTimeout(() => {
        fetchConnections()
        
        // Show success message for YouTube
        if (platformId === 'youtube') {
          alert(
            "✅ Your YouTube account is now connected!\n\n" +
            "From here, I can upload videos, manage comments, fetch analytics, and help maintain your channel — depending on the permissions you granted.\n\n" +
            "You can revoke these permissions anytime in your Google account settings."
          )
        }
      }, 2000)
      
    } catch (error) {
      console.error(`Error connecting to ${platformId}:`, error)
      alert(`Failed to connect to ${platformId}. Please try again.`)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platformId) => {
    try {
      // Find the connection ID for this platform
      const connectionInfo = connections.find(conn => 
        conn.platform === platformId || 
        conn.platform === platformId.toLowerCase()
      )
      
      if (!connectionInfo) {
        throw new Error('Connection not found')
      }
      
      if (!window.confirm('Are you sure you want to disconnect this account?')) {
        return
      }
      
      // Use the same disconnect method as settings page
      await socialMediaService.disconnectAccount(connectionInfo.id)
      await fetchConnections()
    } catch (error) {
      console.error(`Error disconnecting from ${platformId}:`, error)
      alert(`Failed to disconnect from ${platformId}. Please try again.`)
    }
  }

  const isPlatformConnected = (platformName) => {
    const platformId = platformConfigs[platformName]?.id
    if (!platformId) return false
    
    return connections.some(conn => 
      conn.platform === platformId || 
      conn.platform === platformName.toLowerCase()
    )
  }

  const getConnectionInfo = (platformName) => {
    const platformId = platformConfigs[platformName]?.id
    if (!platformId) return null
    
    return connections.find(conn => 
      conn.platform === platformId || 
      conn.platform === platformName.toLowerCase()
    )
  }

  const getConnectedCount = () => {
    return selectedPlatforms.filter(platform => isPlatformConnected(platform)).length
  }

  const canComplete = () => {
    return getConnectedCount() > 0
  }

  const getConnectionStatus = () => {
    const connected = getConnectedCount()
    const total = selectedPlatforms.length
    
    if (connected === 0) {
      return {
        type: 'warning',
        message: 'Required: You need to connect at least one platform to complete your onboarding.'
      }
    } else if (connected < total) {
      return {
        type: 'info',
        message: `Great! You've connected ${connected} out of ${total} platforms. You can connect more later or proceed with onboarding.`
      }
    } else {
      return {
        type: 'success',
        message: 'Perfect! All selected platforms are connected. You can proceed with onboarding.'
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading connection status...</p>
        </div>
      </div>
    )
  }

  const status = getConnectionStatus()

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Connect Your Platforms</h1>
          <p className="text-gray-600">Connect the social media platforms you selected to get started with Emily</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Step 2 of 2</span>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">50% Complete</span>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full mr-2 animate-pulse"></div>
                <span className="font-medium">Auto-saved</span>
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: '50%' }}
            ></div>
          </div>
        </div>

        {/* Connection Cards */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">Connect Your Selected Platforms</h2>
            <p className="text-gray-600">Based on your onboarding form, connect these platforms to get started:</p>
          </div>

          {/* Selected Platforms Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {selectedPlatforms.map(platform => {
              const config = platformConfigs[platform]
              if (!config) return null

              const isConnected = isPlatformConnected(platform)
              const connectionInfo = getConnectionInfo(platform)
              const IconComponent = config.icon

              return (
                <div 
                  key={platform}
                  className={`border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-200 ${
                    isConnected 
                      ? 'border-green-200 bg-green-50' 
                      : `${config.borderColor} ${config.bgColor}`
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 ${config.color} rounded-lg flex items-center justify-center`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{platform}</h3>
                        <p className="text-sm text-gray-600">
                          {isConnected && connectionInfo?.account_name 
                            ? connectionInfo.account_name 
                            : config.description
                          }
                        </p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      isConnected ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {isConnected ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4">
                    {isConnected 
                      ? `✅ Connected! Ready to create and schedule posts`
                      : `Connect your ${platform} ${config.description.toLowerCase()} to start creating content`
                    }
                  </p>
                  
                  <div className="space-y-2">
                    <button 
                      onClick={() => isConnected ? handleDisconnect(config.id) : handleConnect(config.id)}
                      disabled={connecting === config.id}
                      className={`w-full py-2 px-4 rounded-lg transition-colors ${
                        connecting === config.id
                          ? 'bg-gray-400 text-white cursor-not-allowed'
                          : isConnected
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : `${config.color} text-white hover:opacity-90`
                      }`}
                    >
                      {connecting === config.id 
                        ? 'Connecting...' 
                        : isConnected 
                        ? 'Disconnect' 
                        : `Connect ${platform}`
                      }
                    </button>
                    
                    {isConnected && (
                      <button 
                        onClick={() => handleConnect(config.id)}
                        disabled={connecting === config.id}
                        className="w-full py-1 px-4 text-sm text-gray-600 hover:text-gray-800 underline"
                      >
                        Reconnect
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Connection Status */}
          <div className={`border rounded-lg p-4 mb-6 ${
            status.type === 'warning' ? 'bg-amber-50 border-amber-200' :
            status.type === 'info' ? 'bg-blue-50 border-blue-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center">
              <AlertCircle className={`w-5 h-5 mr-2 ${
                status.type === 'warning' ? 'text-amber-600' :
                status.type === 'info' ? 'text-blue-600' :
                'text-green-600'
              }`} />
              <p className={`${
                status.type === 'warning' ? 'text-amber-800' :
                status.type === 'info' ? 'text-blue-800' :
                'text-green-800'
              }`}>
                <strong>{status.type === 'warning' ? 'Required:' : status.type === 'info' ? 'Great!' : 'Perfect!'}</strong> {status.message}
              </p>
            </div>
          </div>

          {/* Skip Option */}
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              {getConnectedCount() > 0 
                ? "You can connect remaining platforms later in your settings."
                : "Don't want to connect now? You can set up connections later in your settings."
              }
            </p>
            <button 
              onClick={onSkip}
              className="text-gray-500 hover:text-gray-700 underline"
            >
              {getConnectedCount() > 0 ? 'Skip remaining - I\'ll connect later' : 'Skip for now - I\'ll connect later'}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button 
            onClick={onBack}
            className="flex items-center px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Onboarding
          </button>

          <div className="flex items-center space-x-4">
            <button 
              onClick={onSkip}
              className="px-6 py-3 text-gray-600 hover:text-gray-800 underline"
            >
              Skip & Complete Later
            </button>
            <button 
              onClick={onComplete}
              disabled={!canComplete()}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 mr-2" />
              Complete Onboarding
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OnboardingConnections
