import React, { useState, useEffect } from 'react'
import { 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  ExternalLink,
  Shield,
  Key,
  AlertCircle,
  Loader2,
  Instagram,
  Facebook,
  Twitter,
  Linkedin,
  X,
  RefreshCw,
  Globe
} from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'
import { connectionsAPI } from '../services/connections'
import ConnectionStatus from './ConnectionStatus'
import SideNavbar from './SideNavbar'
import MainContentLoader from './MainContentLoader'

const SettingsDashboard = () => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [connectionMethod, setConnectionMethod] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [wordpressCredentials, setWordpressCredentials] = useState({
    siteName: '',
    siteUrl: '',
    username: '',
    password: ''
  })
  const [wordpressErrors, setWordpressErrors] = useState({
    siteName: '',
    siteUrl: '',
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Validation functions
  const validateWordPressCredentials = () => {
    const errors = {
      siteName: '',
      siteUrl: '',
      username: '',
      password: ''
    }

    // Site Name validation
    if (!wordpressCredentials.siteName.trim()) {
      errors.siteName = 'Site name is required'
    } else if (wordpressCredentials.siteName.trim().length < 2) {
      errors.siteName = 'Site name must be at least 2 characters'
    }

    // Site URL validation
    if (!wordpressCredentials.siteUrl.trim()) {
      errors.siteUrl = 'Site URL is required'
    } else {
      try {
        const url = new URL(wordpressCredentials.siteUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.siteUrl = 'URL must start with http:// or https://'
        }
      } catch {
        errors.siteUrl = 'Please enter a valid URL'
      }
    }

    // Username validation
    if (!wordpressCredentials.username.trim()) {
      errors.username = 'Username is required'
    } else if (wordpressCredentials.username.trim().length < 2) {
      errors.username = 'Username must be at least 2 characters'
    }

    // Password validation
    if (!wordpressCredentials.password.trim()) {
      errors.password = 'Password is required'
    } else if (wordpressCredentials.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    setWordpressErrors(errors)
    return !Object.values(errors).some(error => error !== '')
  }

  const clearFieldError = (fieldName) => {
    setWordpressErrors(prev => ({
      ...prev,
      [fieldName]: ''
    }))
  }

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      description: 'Connect Facebook Pages',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/tools/explorer/'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-pink-600',
      description: 'Connect Instagram Business accounts (via Facebook)',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/tools/explorer/'
    },
    {
      id: 'twitter',
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-blue-400',
      description: 'Tweet, get analytics, manage campaigns',
      oauthSupported: false,
      tokenSupported: true,
      helpUrl: 'https://developer.twitter.com/en/portal/dashboard'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-blue-700',
      description: 'Share content, get professional insights',
      oauthSupported: true,
      tokenSupported: true,
      helpUrl: 'https://www.linkedin.com/developers/apps'
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      icon: Globe,
      color: 'bg-gray-600',
      description: 'Automate blog posting and content management',
      oauthSupported: false,
      tokenSupported: false,
      credentialsSupported: true,
      helpUrl: 'https://wordpress.org/support/article/application-passwords/'
    }
  ]


  useEffect(() => {
    fetchConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      
      // Fetch token-based connections
      let tokenConnections = []
      try {
        tokenConnections = await socialMediaService.getConnections()
      } catch (error) {
        console.log('No token connections found:', error.message)
      }
      
      // Fetch OAuth connections
      let oauthConnections = []
      try {
        const oauthResponse = await connectionsAPI.getConnections()
        oauthConnections = oauthResponse.data || []
      } catch (error) {
        console.log('No OAuth connections found:', error.message)
      }
      
      // Fetch WordPress connections
      let wordpressConnections = []
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/wordpress`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          wordpressConnections = data.map(conn => ({
            ...conn,
            platform: 'wordpress',
            connection_status: 'active',
            page_name: conn.site_name,
            page_username: conn.username
          }))
        }
      } catch (error) {
        console.log('No WordPress connections found:', error.message)
      }
      
      // Combine all types of connections
      const allConnections = [...tokenConnections, ...oauthConnections, ...wordpressConnections]
      setConnections(allConnections)
      
      console.log('Token connections:', tokenConnections.length)
      console.log('OAuth connections:', oauthConnections.length)
      console.log('WordPress connections:', wordpressConnections.length)
      console.log('Total connections:', allConnections.length)
      
    } catch (error) {
      console.error('Error fetching connections:', error)
      setError('Failed to load connections')
    } finally {
      setLoading(false)
    }
  }

  const getPlatformInfo = (platformId) => {
    return platforms.find(p => p.id === platformId) || platforms[0]
  }

  const handleConnectionMethod = (platform, method) => {
    setSelectedPlatform(platform)
    setConnectionMethod(method)
    setShowConnectionModal(true)
    setError('')
    setSuccess('')
  }

  const handleOAuthConnect = async (platform) => {
    try {
      await socialMediaService.connectWithOAuth(platform)
    } catch (error) {
      setError(`Failed to start OAuth for ${platform}: ${error.message}`)
    }
  }

  const handleTokenConnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await socialMediaService.connectWithToken(
        selectedPlatform, 
        accessToken, 
        connectionMethod
      )
      
      setSuccess(result.message)
      setShowConnectionModal(false)
      setAccessToken('')
      setSelectedPlatform('')
      setConnectionMethod('')
      fetchConnections()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDebugToken = async () => {
    if (!accessToken) {
      setError('Please enter a token first')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      const result = await socialMediaService.debugValidateToken(selectedPlatform, accessToken)
      
      if (result.valid) {
        setSuccess(`Token is valid! Found: ${result.me_data?.name || 'Unknown'}`)
        console.log('Debug result:', result)
      } else {
        setError(`Token validation failed: ${result.error}`)
        console.log('Debug error:', result)
      }
    } catch (err) {
      setError(`Debug failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleWordPressConnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setWordpressErrors({
      siteName: '',
      siteUrl: '',
      username: '',
      password: ''
    })

    // Validate credentials first
    if (!validateWordPressCredentials()) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/wordpress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          site_name: wordpressCredentials.siteName.trim(),
          site_url: wordpressCredentials.siteUrl.trim(),
          username: wordpressCredentials.username.trim(),
          password: wordpressCredentials.password.trim()
        })
      })

      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('Error parsing response:', parseError)
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        throw new Error(result.detail || result.message || 'Failed to connect to WordPress')
      }

      setSuccess(result.message || 'WordPress connected successfully!')
      setShowConnectionModal(false)
      setWordpressCredentials({
        siteName: '',
        siteUrl: '',
        username: '',
        password: ''
      })
      setSelectedPlatform('')
      setConnectionMethod('')
      fetchConnections()
      
    } catch (err) {
      console.error('WordPress connection error:', err)
      setError(err.message || 'Failed to connect WordPress')
    } finally {
      setLoading(false)
    }
  }

  const handleWordPressDisconnect = async (connectionId) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/wordpress/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to disconnect WordPress')
      }

      setSuccess(result.message)
      fetchConnections()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (connectionId, platform) => {
    if (!window.confirm('Are you sure you want to disconnect this account?')) {
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      // Handle WordPress disconnect
      if (platform === 'wordpress') {
        await handleWordPressDisconnect(connectionId)
        return
      }

      // Handle other platforms
      await socialMediaService.disconnectAccount(connectionId)
      setSuccess('Account disconnected successfully')
      fetchConnections()
    } catch (error) {
      setError(`Failed to disconnect account: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const closeModal = () => {
    setShowConnectionModal(false)
    setAccessToken('')
    setSelectedPlatform('')
    setConnectionMethod('')
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings Dashboard</h1>
                <p className="text-gray-600">Connect your social media accounts using OAuth or Access Tokens</p>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Refresh Button */}
                <button
                  onClick={fetchConnections}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
          {loading ? (
            <MainContentLoader message="Loading settings dashboard..." />
          ) : (
            <>

              {/* Success/Error Messages */}
              {success && (
                <div className="mb-6 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md flex items-center">
                  <Check className="w-5 h-5 mr-2" />
                  {success}
                </div>
              )}

              {error && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center">
                  <AlertCircle className="w-5 h-5 mr-2" />
                  {error}
                </div>
              )}


              {/* Connected Accounts */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Connected Accounts</h2>
                {connections.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {connections.map((connection) => (
                      <ConnectionStatus
                        key={connection.id}
                        connection={connection}
                        onDisconnect={(connectionId) => handleDisconnect(connectionId, connection.platform)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Settings className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No connections yet</h3>
                    <p className="text-gray-500">Connect your social media accounts to get started</p>
                  </div>
                )}
              </div>

              {/* Add New Connection */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Connection</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {platforms.map((platform) => {
                    const Icon = platform.icon
                    const isConnected = connections.some(c => c.platform === platform.id)
                    
                    return (
                      <div key={platform.id} className={`p-6 rounded-lg border-2 transition-all ${
                        isConnected
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                      }`}>
                        <div className={`w-12 h-12 ${platform.color} rounded-lg flex items-center justify-center mx-auto mb-3`}>
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{platform.name}</h3>
                        <p className="text-sm text-gray-600 mb-3">{platform.description}</p>
                        
                        {isConnected ? (
                          <div className="flex items-center text-green-600">
                            <Check className="w-4 h-4 mr-1" />
                            <span className="text-sm">Connected</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {platform.oauthSupported && (
                              <button
                                onClick={() => handleOAuthConnect(platform.id)}
                                className="w-full px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 flex items-center justify-center"
                              >
                                <Shield className="w-4 h-4 mr-1" />
                                Connect
                              </button>
                            )}
                            {platform.tokenSupported && (
                              <button
                                onClick={() => handleConnectionMethod(platform.id, 'token')}
                                className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center justify-center"
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Token
                              </button>
                            )}
                            {platform.credentialsSupported && (
                              <button
                                onClick={() => handleConnectionMethod(platform.id, 'credentials')}
                                className="w-full px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 flex items-center justify-center"
                              >
                                <Key className="w-4 h-4 mr-1" />
                                Credentials
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Connection Modal */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedPlatform === 'wordpress' 
                  ? `Connect ${getPlatformInfo(selectedPlatform).name} with Credentials`
                  : `Connect ${getPlatformInfo(selectedPlatform).name} with Access Token`
                }
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {selectedPlatform === 'wordpress' ? (
              <form onSubmit={handleWordPressConnect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={wordpressCredentials.siteName}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, siteName: e.target.value }))
                      clearFieldError('siteName')
                    }}
                    placeholder="My WordPress Site"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      wordpressErrors.siteName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.siteName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {wordpressErrors.siteName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Site URL
                  </label>
                  <input
                    type="url"
                    value={wordpressCredentials.siteUrl}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, siteUrl: e.target.value }))
                      clearFieldError('siteUrl')
                    }}
                    placeholder="https://yoursite.com"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      wordpressErrors.siteUrl ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.siteUrl && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {wordpressErrors.siteUrl}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={wordpressCredentials.username}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, username: e.target.value }))
                      clearFieldError('username')
                    }}
                    placeholder="your_username"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      wordpressErrors.username ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.username && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {wordpressErrors.username}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={wordpressCredentials.password}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, password: e.target.value }))
                      clearFieldError('password')
                    }}
                    placeholder="Enter your WordPress password"
                    className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      wordpressErrors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.password && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      {wordpressErrors.password}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Enter your WordPress account password for API access.
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleTokenConnect} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Enter your access token"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your access token from{' '}
                    <a
                      href={getPlatformInfo(selectedPlatform).helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center"
                    >
                      {getPlatformInfo(selectedPlatform).name} Developer Tools
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handleDebugToken}
                      disabled={loading || !accessToken}
                      className="px-3 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 disabled:opacity-50"
                    >
                      Debug Token
                    </button>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !accessToken}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsDashboard
