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
  Linkedin,
  Youtube,
  X,
  RefreshCw,
  Globe,
  Mail,
  Chrome,
  FileText
} from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'
import { connectionsAPI } from '../services/connections'
import ConnectionStatus from './ConnectionStatus'
import SideNavbar from './SideNavbar'
import MainContentLoader from './MainContentLoader'
import DisconnectConfirmationModal from './DisconnectConfirmationModal'
// Using URL-based approach for logos

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
  const [disconnectModal, setDisconnectModal] = useState({
    isOpen: false,
    connectionId: null,
    platform: '',
    accountName: '',
    isLoading: false
  })

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

    // App Password validation
    if (!wordpressCredentials.password.trim()) {
      errors.password = 'App Password is required'
    } else if (wordpressCredentials.password.trim().length < 6) {
      errors.password = 'App Password must be at least 6 characters'
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
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      description: 'Connect Instagram Business accounts (via Facebook)',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/tools/explorer/'
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
      color: 'bg-black',
      description: 'Tweet, get analytics, manage campaigns',
      oauthSupported: true,
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
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: 'bg-red-600',
      description: 'Upload videos, manage comments, and get analytics',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.google.com/youtube/v3/getting-started'
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      icon: 'https://logo.svgcdn.com/d/wordpress-original.svg',
      color: 'bg-gray-600',
      description: 'Automate blog posting and content management',
      oauthSupported: false,
      tokenSupported: false,
      credentialsSupported: true,
      helpUrl: 'https://wordpress.org/support/article/application-passwords/'
    },
    {
      id: 'google',
      name: 'Google',
      icon: 'https://logo.svgcdn.com/d/google-original.svg',
      color: 'bg-white',
      description: 'Connect Gmail, Drive, Sheets, and Docs',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://console.developers.google.com/'
    }
  ]


  useEffect(() => {
    fetchConnections()
    
    // Listen for OAuth success/error events from socialMediaService
    const handleOAuthSuccess = (event) => {
      console.log('OAuth success event received:', event.detail)
      setSuccess(event.detail.message)
      fetchConnections()
    }
    
    const handleOAuthError = (event) => {
      console.log('OAuth error event received:', event.detail)
      setError(event.detail.error)
    }
    
    window.addEventListener('oauthSuccess', handleOAuthSuccess)
    window.addEventListener('oauthError', handleOAuthError)
    
    return () => {
      window.removeEventListener('oauthSuccess', handleOAuthSuccess)
      window.removeEventListener('oauthError', handleOAuthError)
    }
  }, [])

  // Auto-close success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('')
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [success])

  // Auto-close error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [error])

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
        console.log('OAuth connections fetched:', oauthConnections)
      } catch (error) {
        console.log('No OAuth connections found:', error.message)
      }
      
      // Fetch WordPress connections
      let wordpressConnections = []
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/?platform=wordpress`, {  
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
            page_name: conn.wordpress_site_name || conn.site_name,
            site_name: conn.wordpress_site_name || conn.site_name,
            wordpress_site_name: conn.wordpress_site_name || conn.site_name,
            page_username: conn.wordpress_username || conn.username
          }))
        }
      } catch (error) {
        console.log('No WordPress connections found:', error.message)
      }
      
      // Fetch Google connection status
      let googleConnections = []
      try {
        const authToken = await getAuthToken()
        if (!authToken) {
          console.log('No auth token available for Google connections')
        } else {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
          const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        
          const response = await fetch(`${baseUrl}/connections/google/connection-status`, {
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
          })
          
          if (response.ok) {
            const statusData = await response.json()
            console.log('Google connection status data:', statusData)
            console.log('Google connection status response:', response.status)
            
            // Check if connected (handle different possible response formats)
            if (statusData.connected === true || statusData.connected === 'true' || statusData.status === 'connected') {
              googleConnections = [{
                platform: 'google',
                connection_status: 'active',
                page_name: statusData.email || statusData.name || 'Google Account',
                page_username: statusData.email || statusData.name || 'Google Account'
              }]
              console.log('Created Google connection:', googleConnections[0])
            } else {
              console.log('Google not connected. Status data:', statusData)
            }
          } else {
            console.log('Google connection status API error:', response.status, response.statusText)
          }
        }
      } catch (error) {
        console.log('No Google connection found:', error.message)
      }
      
      // Check if Google is already in OAuth connections
      const existingGoogleConnection = oauthConnections.find(conn => conn.platform === 'google')
      if (existingGoogleConnection) {
        console.log('Found existing Google connection in OAuth:', existingGoogleConnection)
        googleConnections = [existingGoogleConnection]
      }
      
      // Combine all types of connections, filtering out duplicates
      const allConnections = [
        ...tokenConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress'),
        ...oauthConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress'),
        ...wordpressConnections,
        ...googleConnections
      ]
      
      // Remove duplicate WordPress connections based on site URL and user ID
      const uniqueConnections = allConnections.filter((connection, index, self) => {
        if (connection.platform === 'wordpress') {
          return index === self.findIndex(conn => 
            conn.platform === 'wordpress' && 
            conn.wordpress_site_url === connection.wordpress_site_url &&
            conn.wordpress_user_id === connection.wordpress_user_id
          )
        }
        return true
      })
      
      setConnections(uniqueConnections)
      
      console.log('Token connections:', tokenConnections.length)
      console.log('OAuth connections:', oauthConnections.length)
      console.log('WordPress connections:', wordpressConnections.length)
      console.log('Google connections:', googleConnections.length)
      console.log('Total connections:', allConnections.length)
      console.log('All connections platforms:', allConnections.map(c => c.platform))
      
    } catch (error) {
      console.error('Error fetching connections:', error)
      setError('Failed to load connections')
      // Don't crash the entire dashboard, just show empty connections
      setConnections([])
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
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Clean up any existing failed connections before starting new OAuth
      try {
        const authToken = await getAuthToken()
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        
        const cleanupResponse = await fetch(`${baseUrl}/connections/cleanup-failed/${platform}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        })
        
        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json()
          console.log(`✅ Cleaned up ${cleanupData.deleted_count || 0} failed ${platform} connections`)
        }
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`)
        // Don't fail the OAuth process if cleanup fails
      }
      
      setSuccess(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connection window opened. Please complete the authorization.`)
      await socialMediaService.connectWithOAuth(platform)
    } catch (error) {
      setError(`Failed to start OAuth for ${platform}: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    try {
      // Try multiple token sources
      const token = localStorage.getItem('authToken') || 
                    localStorage.getItem('token') || 
                    localStorage.getItem('access_token')
      
      if (token) {
        return token
      }
      
      // Try to get token from Supabase session
      const { supabase } = await import('../lib/supabase')
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.error('Error getting Supabase session:', error)
        return null
      }
      
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }

  const handleGoogleConnect = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      const response = await fetch(`${baseUrl}/connections/google/reconnect`, {
        method: 'POST',
        headers
      })
      const reconnectData = await response.json()
      
      if (reconnectData.success) {
        const popup = window.open(
          reconnectData.auth_url,
          'google-oauth',
          'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        )
        
        // Listen for popup messages (for OAuth completion)
        const messageHandler = (event) => {
          // Allow messages from the same origin or from the callback page
          const allowedOrigins = [
            window.location.origin,
            'https://emily.atsnai.com',
            'https://agent-emily.onrender.com'
          ]
          
          if (!allowedOrigins.includes(event.origin)) {
            console.log('Ignoring message from origin:', event.origin)
            return
          }
          
          console.log('Received OAuth message:', event.data, 'from origin:', event.origin)
          
          if (event.data.type === 'OAUTH_SUCCESS') {
            console.log('Google OAuth successful:', event.data)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setSuccess('Google account connected successfully!')
            // Refresh connections to show the new connection
            fetchConnections()
          } else if (event.data.type === 'OAUTH_ERROR') {
            console.error('Google OAuth error:', event.data.error)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setError(event.data.error || 'Google OAuth connection failed')
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            // Refresh connections when popup is closed (in case OAuth completed)
            console.log('Popup closed, refreshing connections...')
            fetchConnections()
          }
        }, 1000)
        
        setSuccess('Google connection window opened. Please complete the authorization.')
      } else {
        setError('Failed to initiate Google connection')
      }
    } catch (error) {
      setError(`Failed to start Google connection: ${error.message}`)
    } finally {
      setLoading(false)
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
      const authToken = await getAuthToken()
      console.log('🔍 WordPress connection attempt:', {
        siteName: wordpressCredentials.siteName.trim(),
        siteUrl: wordpressCredentials.siteUrl.trim(),
        username: wordpressCredentials.username.trim(),
        hasPassword: !!wordpressCredentials.password.trim(),
        hasAuthToken: !!authToken
      })
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/wordpress/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          site_name: wordpressCredentials.siteName.trim(),
          site_url: wordpressCredentials.siteUrl.trim(),
          username: wordpressCredentials.username.trim(),
          password: wordpressCredentials.password.trim()
        })
      })
      
      console.log('🔍 WordPress response status:', response.status)

      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('Error parsing response:', parseError)
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        // Handle different error response formats
        let errorMessage = 'Failed to connect to WordPress'
        
        if (result.detail) {
          errorMessage = result.detail
        } else if (result.message) {
          errorMessage = result.message
        } else if (result.error) {
          errorMessage = result.error
        } else if (typeof result === 'string') {
          errorMessage = result
        } else if (Array.isArray(result)) {
          errorMessage = result.join(', ')
        } else if (typeof result === 'object') {
          // Try to extract meaningful error information
          const errorKeys = Object.keys(result)
          if (errorKeys.length > 0) {
            const firstKey = errorKeys[0]
            if (Array.isArray(result[firstKey])) {
              errorMessage = result[firstKey].join(', ')
            } else if (typeof result[firstKey] === 'string') {
              errorMessage = result[firstKey]
            } else {
              errorMessage = `Error: ${JSON.stringify(result)}`
            }
          }
        }
        
        throw new Error(errorMessage)
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
      
      // Safely refresh connections after successful WordPress connection
      try {
        await fetchConnections()
      } catch (error) {
        console.error('Error refreshing connections after WordPress connection:', error)
        // Don't show error to user since WordPress connection was successful
      }
      
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

      const authToken = await getAuthToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/wordpress/delete/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to disconnect WordPress')
      }

      setSuccess(result.message || 'WordPress account disconnected successfully')
      
      // Refresh connections to update the UI
      await fetchConnections()
      
      // Close modal
      setDisconnectModal({
        isOpen: false,
        connectionId: null,
        platform: '',
        accountName: '',
        isLoading: false
      })
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (connectionId, platform) => {
    // Find the connection to get account name
    const connection = connections.find(conn => conn.id === connectionId)
    const accountName = connection?.account_name || 
                       connection?.page_name || 
                       connection?.site_name || 
                       connection?.wordpress_site_name ||
                       'Unknown Account'
    
    // Show confirmation modal
    setDisconnectModal({
      isOpen: true,
      connectionId,
      platform,
      accountName,
      isLoading: false
    })
  }

  const confirmDisconnect = async () => {
    const { connectionId, platform } = disconnectModal
    
    try {
      setDisconnectModal(prev => ({ ...prev, isLoading: true }))
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
      
      // Close modal
      setDisconnectModal({
        isOpen: false,
        connectionId: null,
        platform: '',
        accountName: '',
        isLoading: false
      })
    } catch (error) {
      console.error('Error disconnecting account:', error)
      setError(`Failed to disconnect account: ${error.message}`)
      setDisconnectModal(prev => ({ ...prev, isLoading: false }))
    }
  }

  const cancelDisconnect = () => {
    setDisconnectModal({
      isOpen: false,
      connectionId: null,
      platform: '',
      accountName: '',
      isLoading: false
    })
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
    <div className="min-h-screen bg-white">
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


              {/* Add New Connection */}
              <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Connection</h2>
                
                {platforms.filter(platform => !connections.some(c => c.platform === platform.id)).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {platforms
                      .filter(platform => !connections.some(c => c.platform === platform.id))
                      .map((platform) => {
                      const Icon = platform.icon
                      
                      return (
                        <div key={platform.id} className="group relative bg-white rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-gray-200">
                          {/* Card Header */}
                          <div className="relative p-6 pb-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className={`w-14 h-14 ${platform.id === 'google' || platform.id === 'wordpress' ? 'bg-white' : platform.color} rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                                {typeof Icon === 'string' ? (
                                  <img src={Icon} alt={platform.name} className="w-7 h-7" />
                                ) : (
                                  <Icon className={`w-7 h-7 ${platform.id === 'google' || platform.id === 'wordpress' ? 'text-gray-600' : 'text-white'}`} />
                                )}
                              </div>
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                                <div className="w-2 h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                              </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">{platform.name}</h3>
                            <p className="text-gray-600 text-sm leading-relaxed">{platform.description}</p>
                          </div>

                          {/* Card Body */}
                          <div className="px-6 pb-6">
                            <div className="space-y-3">
                              {platform.oauthSupported && (
                                <button
                                  onClick={() => platform.id === 'google' ? handleGoogleConnect() : handleOAuthConnect(platform.id)}
                                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                  disabled={loading}
                                >
                                  <Shield className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                  {loading ? 'Connecting...' : 'Connect with OAuth'}
                                </button>
                              )}
                              {platform.tokenSupported && (
                                <button
                                  onClick={() => handleConnectionMethod(platform.id, 'token')}
                                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                >
                                  <Key className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                  Connect with Token
                                </button>
                              )}
                              {platform.credentialsSupported && (
                                <button
                                  onClick={() => handleConnectionMethod(platform.id, 'credentials')}
                                  className="w-full px-4 py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-semibold rounded-xl hover:from-violet-600 hover:to-violet-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                >
                                  <Key className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                                  Connect with Credentials
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Hover gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All platforms connected!</h3>
                    <p className="text-gray-500">You have successfully connected all available platforms</p>
                  </div>
                )}
              </div>

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
                    App Password
                  </label>
                  <input
                    type="password"
                    value={wordpressCredentials.password}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, password: e.target.value }))
                      clearFieldError('password')
                    }}
                    placeholder="Enter your WordPress App Password"
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
                    Enter your WordPress App Password for API access. Generate one in WordPress Admin → Users → Profile → Application Passwords.
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

      {/* Disconnect Confirmation Modal */}
      <DisconnectConfirmationModal
        isOpen={disconnectModal.isOpen}
        onClose={cancelDisconnect}
        onConfirm={confirmDisconnect}
        platform={disconnectModal.platform}
        accountName={disconnectModal.accountName}
        isLoading={disconnectModal.isLoading}
      />
    </div>
  )
}

export default SettingsDashboard
