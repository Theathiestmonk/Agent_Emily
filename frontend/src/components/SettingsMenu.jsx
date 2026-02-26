import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, CreditCard, User, Download, Moon, Sun, Settings, Share2, ExternalLink } from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'
import { connectionsAPI } from '../services/connections'
import { fetchAllConnections } from '../services/fetchConnections'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import EditProfileModal from './EditProfileModal'
import { subscriptionAPI } from '../services/subscription'
import { generateInvoicePDF } from '../services/pdfGenerator'

const SettingsMenu = ({ isOpen, onClose, isDarkMode = false }) => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [activeTab, setActiveTab] = useState('profile') // 'profile', 'tools', 'billing', or 'preferences'
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [billingHistory, setBillingHistory] = useState([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [localDarkMode, setLocalDarkMode] = useState(isDarkMode)
  const pollingIntervalRef = useRef(null)

  const platforms = [
    { id: 'facebook', name: 'Facebook' },
    { id: 'instagram', name: 'Instagram' },
    { id: 'twitter', name: 'X (Twitter)' },
    { id: 'linkedin', name: 'LinkedIn' },
    { id: 'youtube', name: 'YouTube' },
    { id: 'wordpress', name: 'WordPress' },
    { id: 'google', name: 'Google' },
    { id: 'whatsapp', name: 'WhatsApp Business' }
  ]

  const stopStatusPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const fetchConnections = async (forceRefresh = false) => {
    try {
      setLoading(true)
      // Force refresh by clearing cache if needed
      if (forceRefresh) {
        const { connectionsCache } = await import('../services/connectionsCache')
        connectionsCache.clearCache()
      }
      const connections = await fetchAllConnections(!forceRefresh)
      setConnections(connections)
      return connections
    } catch (error) {
      console.error('Error fetching connections:', error)
      setConnections([])
      return []
    } finally {
      setLoading(false)
    }
  }

  const startStatusPolling = (platformId, maxAttempts = 30) => {
    // Stop any existing polling
    stopStatusPolling()

    let attempts = 0

    const poll = async () => {
      attempts++

      try {
        // Force refresh to get latest status
        const updatedConnections = await fetchConnections(true)
        const isNowConnected = updatedConnections.some(
          conn => conn.platform === platformId && conn.connection_status === 'active'
        )

        if (isNowConnected) {
          // Connection successful, stop polling
          stopStatusPolling()
          setSelectedPlatform('')
          setLoading(false)
          return
        }

        // If max attempts reached, stop polling
        if (attempts >= maxAttempts) {
          stopStatusPolling()
          setSelectedPlatform('')
          setLoading(false)
          console.log(`Stopped polling for ${platformId} after ${maxAttempts} attempts`)
        }
      } catch (error) {
        console.error('Error polling connection status:', error)
        // Stop polling on error
        stopStatusPolling()
        setSelectedPlatform('')
        setLoading(false)
      }
    }

    // Start polling every 2 seconds
    const interval = setInterval(poll, 2000)
    pollingIntervalRef.current = interval

    // Initial check
    poll()
  }

  // Sync local dark mode with parent component
  useEffect(() => {
    setLocalDarkMode(isDarkMode)
  }, [isDarkMode])

  useEffect(() => {
    if (isOpen) {
      fetchConnections()
      if (activeTab === 'profile') {
        fetchProfile()
      } else if (activeTab === 'billing') {
        fetchBillingData()
      }
    } else {
      // Stop polling when menu is closed
      stopStatusPolling()
    }

    return () => {
      // Cleanup polling on unmount
      stopStatusPolling()
    }
  }, [isOpen, activeTab])

  const fetchProfile = async () => {
    try {
      setProfileLoading(true)
      if (!user) {
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchBillingData = async () => {
    try {
      setBillingLoading(true)

      // Fetch subscription status
      const statusResponse = await subscriptionAPI.getSubscriptionStatus()
      setSubscriptionStatus(statusResponse.data)

      // Fetch billing history
      const historyResponse = await subscriptionAPI.getBillingHistory()
      setBillingHistory(historyResponse.data.billing_history || [])
    } catch (error) {
      console.error('Error fetching billing data:', error)
    } finally {
      setBillingLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A'
    return `INR ${(amount / 100).toFixed(2)}`
  }

  const handleDownloadBill = () => {
    try {
      if (!billingHistory || billingHistory.length === 0) {
        alert('No billing history available to download.')
        return
      }

      const latestBill = billingHistory[0]

      // Format invoice data for PDF generation
      const invoiceData = {
        id: latestBill.id || latestBill.transaction_id || 'N/A',
        date: subscriptionStatus?.subscription_start_date || latestBill.payment_date || latestBill.created_at || new Date().toISOString(),
        status: latestBill.status || 'completed',
        amount: latestBill.amount || 0,
        description: latestBill.description || 'Subscription Payment'
      }

      // Prepare user profile data
      const userProfile = {
        name: profile?.name,
        business_name: profile?.business_name,
        email: user?.email,
        subscription_plan: subscriptionStatus?.plan
      }

      // Generate PDF
      const pdf = generateInvoicePDF(invoiceData, billingHistory, userProfile)

      // Download PDF
      const dateStr = new Date(invoiceData.date).toISOString().split('T')[0]
      pdf.save(`bill-${invoiceData.id}-${dateStr}.pdf`)
    } catch (error) {
      console.error('Error generating bill PDF:', error)
      alert(`Failed to generate bill PDF: ${error.message || 'Unknown error'}`)
    }
  }

  const toggleDarkMode = () => {
    const newValue = !localDarkMode
    setLocalDarkMode(newValue)
    // Save to localStorage
    localStorage.setItem('darkMode', newValue.toString())
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('localStorageChange', {
      detail: { key: 'darkMode', newValue: newValue.toString() }
    }))
  }

  // Listen for OAuth success events
  useEffect(() => {
    const handleOAuthSuccess = async (event) => {
      console.log('OAuth success event received:', event.detail)
      // Clear cache and fetch fresh connections
      const { connectionsCache } = await import('../services/connectionsCache')
      connectionsCache.clearCache()
      await fetchConnections(true)

      // If we have a selected platform, start polling for it
      if (selectedPlatform) {
        startStatusPolling(selectedPlatform)
      }
    }

    const handleOAuthError = (event) => {
      console.log('OAuth error event received:', event.detail)
      stopStatusPolling()
      setLoading(false)
      setSelectedPlatform('')
    }

    window.addEventListener('oauthSuccess', handleOAuthSuccess)
    window.addEventListener('oauthError', handleOAuthError)

    return () => {
      window.removeEventListener('oauthSuccess', handleOAuthSuccess)
      window.removeEventListener('oauthError', handleOAuthError)
    }
  }, [selectedPlatform])

  const isPlatformConnected = (platformId) => {
    return connections.some(conn => conn.platform === platformId && conn.connection_status === 'active')
  }

  const handleToggle = async (platformId) => {
    const isConnected = isPlatformConnected(platformId)

    if (isConnected) {
      // Disconnect
      await handleDisconnect(platformId)
    } else {
      // Connect
      await handleConnect(platformId)
    }
  }

  const handleConnect = async (platformId) => {
    console.log('handleConnect called with platformId:', platformId)

    try {
      setLoading(true)
      setSelectedPlatform(platformId)

      if (platformId === 'google') {
        console.log('Connecting to Google...')
        await handleGoogleConnect()
        // Start polling for Google connection
        startStatusPolling(platformId)
      } else if (platformId === 'whatsapp') {
        console.log('Connecting to WhatsApp...')
        await handleWhatsAppConnect()
        // Start polling for WhatsApp connection
        startStatusPolling(platformId)
      } else if (platformId === 'wordpress') {
        // Navigate to settings page for WordPress (requires credentials)
        navigate('/settings')
        onClose()
      } else {
        // OAuth connection
        await socialMediaService.connectWithOAuth(platformId)
        // Start polling for OAuth connection
        startStatusPolling(platformId)
      }
    } catch (error) {
      console.error(`Failed to connect ${platformId}:`, error)
      stopStatusPolling()
      setLoading(false)
      setSelectedPlatform('')
    }
    // Note: Don't set loading to false here - let polling handle it
  }

  const handleDisconnect = async (platformId) => {
    try {
      setLoading(true)
      setSelectedPlatform(platformId)

      // Find the connection
      const connection = connections.find(conn => conn.platform === platformId && conn.connection_status === 'active')

      if (!connection) {
        throw new Error('Connection not found')
      }

      if (platformId === 'google') {
        // Handle Google disconnect
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        const authToken = localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('access_token')

        const response = await fetch(`${baseUrl}/connections/google/disconnect`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        })

        const data = await response.json()
        if (!data.success) {
          throw new Error('Failed to disconnect Google')
        }
      } else if (platformId === 'whatsapp') {
        // Handle WhatsApp disconnect
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        const authToken = localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('access_token')

        const response = await fetch(`${baseUrl}/connections/whatsapp/disconnect`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        })

        if (!response.ok) {
          throw new Error('Failed to disconnect WhatsApp')
        }
      } else if (platformId === 'wordpress') {
        // Handle WordPress disconnect
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        const authToken = localStorage.getItem('authToken') ||
          localStorage.getItem('token') ||
          localStorage.getItem('access_token')

        const response = await fetch(`${baseUrl}/connections/platform/wordpress/delete/${connection.id}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        })

        if (!response.ok) {
          throw new Error('Failed to disconnect WordPress')
        }
      } else {
        // Handle other platforms - use connection ID
        if (connection.id) {
          await connectionsAPI.disconnectAccount(connection.id)
        } else {
          throw new Error('Connection ID not found')
        }
      }

      // Clear cache and refresh connections
      const { connectionsCache } = await import('../services/connectionsCache')
      connectionsCache.clearCache()
      await fetchConnections(true)
    } catch (error) {
      console.error(`Failed to disconnect ${platformId}:`, error)
      alert(`Failed to disconnect ${platformId}. Please try again.`)
    } finally {
      setLoading(false)
      setSelectedPlatform('')
    }
  }

  const handleGoogleConnect = async () => {
    // Open popup immediately to avoid popup blocker
    const popup = window.open(
      'about:blank',
      'google-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
    )

    if (!popup) {
      alert('Popup blocked! Please allow popups for this site to connect your Google account.')
      return
    }

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')

      // Get auth token from Supabase session for better reliability
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token')

      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      const response = await fetch(`${baseUrl}/connections/google/reconnect`, {
        method: 'POST',
        headers
      })
      const reconnectData = await response.json()

      if (reconnectData.success && reconnectData.auth_url) {
        // Update the popup location
        popup.location.href = reconnectData.auth_url

        const messageHandler = (event) => {
          const allowedOrigins = [
            window.location.origin,
            'https://emily.atsnai.com',
            'https://agent-emily.onrender.com'
          ]

          if (!allowedOrigins.includes(event.origin)) {
            return
          }

          if (event.data.type === 'OAUTH_SUCCESS') {
            popup.close()
            window.removeEventListener('message', messageHandler)
            // Start polling for Google connection status
            startStatusPolling('google')
          } else if (event.data.type === 'OAUTH_ERROR') {
            popup.close()
            window.removeEventListener('message', messageHandler)
            stopStatusPolling()
            setLoading(false)
            setSelectedPlatform('')
          }
        }

        window.addEventListener('message', messageHandler)

        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            // Start polling when popup closes (user may have completed OAuth)
            startStatusPolling('google')
          }
        }, 1000)
      } else {
        popup.close()
        console.error('Failed to get Google auth URL:', reconnectData.error)
        alert(`Failed to start Google connection: ${reconnectData.error || 'Unknown error'}`)
        setLoading(false)
        setSelectedPlatform('')
      }
    } catch (error) {
      popup.close()
      console.error('Failed to start Google connection:', error)
      alert('Failed to start Google connection. Please try again.')
      setLoading(false)
      setSelectedPlatform('')
    }
  }

  const handleWhatsAppConnect = async () => {
    // Open popup immediately to avoid popup blocker
    const popup = window.open(
      'about:blank',
      'whatsapp-oauth',
      'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
    )

    if (!popup) {
      alert('Popup blocked! Please allow popups for this site to connect your WhatsApp account.')
      return
    }

    try {
      console.log('Starting WhatsApp connection...')

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')

      // Get auth token from Supabase session for better reliability
      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token ||
        localStorage.getItem('authToken') ||
        localStorage.getItem('token') ||
        localStorage.getItem('access_token')

      console.log('Auth token found:', !!authToken)

      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      console.log('Making request to:', `${baseUrl}/connections/whatsapp/initiate`)

      const response = await fetch(`${baseUrl}/connections/whatsapp/initiate`, {
        method: 'POST',
        headers
      })

      console.log('Response status:', response.status)

      const initiateData = await response.json()
      console.log('Response data:', initiateData)

      if (!response.ok) {
        popup.close()
        console.error('WhatsApp initiation failed:', initiateData)
        alert(`WhatsApp connection failed: ${initiateData.detail || 'Unknown error'}`)
        setLoading(false)
        setSelectedPlatform('')
        return
      }

      if (initiateData.success && initiateData.auth_url) {
        // Update the popup location
        popup.location.href = initiateData.auth_url

        const messageHandler = (event) => {
          const allowedOrigins = [
            window.location.origin,
            'https://emily.atsnai.com',
            'https://agent-emily.onrender.com'
          ]

          if (!allowedOrigins.includes(event.origin)) {
            return
          }

          if (event.data.type === 'OAUTH_SUCCESS') {
            popup.close()
            window.removeEventListener('message', messageHandler)
            // Start polling for WhatsApp connection status
            startStatusPolling('whatsapp')
          } else if (event.data.type === 'OAUTH_ERROR') {
            popup.close()
            window.removeEventListener('message', messageHandler)
            stopStatusPolling()
            setLoading(false)
            setSelectedPlatform('')
          }
        }

        window.addEventListener('message', messageHandler)

        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            // Start polling when popup closes (user may have completed OAuth)
            startStatusPolling('whatsapp')
          }
        }, 1000)
      } else {
        popup.close()
        alert('Failed to initiate WhatsApp connection. No auth URL received.')
        setLoading(false)
        setSelectedPlatform('')
      }
    } catch (error) {
      popup.close()
      console.error('Failed to start WhatsApp connection:', error)
      alert('Failed to start WhatsApp connection. Please try again.')
      setLoading(false)
      setSelectedPlatform('')
    }
  }

  const connectedPlatforms = platforms.filter(p => isPlatformConnected(p.id))
  const disconnectedPlatforms = platforms.filter(p => !isPlatformConnected(p.id))

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Settings Panel */}
      <div
        className={`fixed top-0 left-0 h-full w-[640px] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDarkMode
          ? 'bg-[#1a1a1a] border-r border-white/[0.05]'
          : 'bg-white'
          } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? 'border-white/[0.05]' : 'border-black/[0.05]'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-black/[0.05]'
              }`}>
              <Settings className={`w-4 h-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} />
            </div>
            <h2 className={`text-[17px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>Settings</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all ${isDarkMode
              ? 'text-slate-400 hover:text-white hover:bg-white/5'
              : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'
              }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Two Column Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Tabs */}
          <div className={`w-48 xl:w-56 border-r flex flex-col p-4 ${isDarkMode ? 'border-white/[0.05] bg-[#161616]' : 'border-black/[0.05] bg-slate-50/50'
            }`}>
            <div className="space-y-1">
              {[
                { id: 'profile', name: 'Identity', icon: User },
                { id: 'tools', name: 'Connections', icon: Share2 },
                { id: 'billing', name: 'Subscription', icon: CreditCard },
                { id: 'preferences', name: 'Appearance', icon: Settings },
              ].map((tab) => {
                const Icon = tab.icon || Settings
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                      if (tab.id === 'profile') fetchProfile()
                      if (tab.id === 'billing') fetchBillingData()
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-[13px] font-medium ${isActive
                      ? isDarkMode
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'bg-white border border-black/[0.08] text-slate-900 shadow-sm'
                      : isDarkMode
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100/50'
                      }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400'}`} />
                    {tab.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column - Tab Content */}
          <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar ${isDarkMode ? 'dark-mode' : 'light-mode bg-[#fbfbfa]'}`}>
            {activeTab === 'profile' && (
              <div className="animate-slide-in-up">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/[0.04]">
                  <div>
                    <h3 className={`text-[17px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Identity</h3>
                    <p className={`text-[13px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage your public profile and business info.</p>
                  </div>
                </div>

                {profileLoading ? (
                  <div className="flex items-center gap-3 py-12 justify-center">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Loading profile...</span>
                  </div>
                ) : profile ? (
                  <div className="space-y-8">
                    {/* Basic Information */}
                    <div className="grid grid-cols-1 gap-8">
                      <div className="group">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Display Name</label>
                        <div className={`text-[14px] font-medium px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-black/[0.06] text-slate-900 shadow-sm'
                          }`}>
                          {profile.name || 'Not set'}
                        </div>
                      </div>

                      <div className="group">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Email Address</label>
                        <div className={`text-[14px] font-medium px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-black/[0.06] text-slate-900 shadow-sm'
                          }`}>
                          {user?.email || 'Not set'}
                        </div>
                      </div>

                      <div className="group">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Business Name</label>
                        <div className={`text-[14px] font-medium px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-black/[0.06] text-slate-900 shadow-sm'
                          }`}>
                          {profile.business_name || 'Not set'}
                        </div>
                      </div>

                      <div className="group">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Business Description</label>
                        <div className={`text-[14px] leading-relaxed px-4 py-3 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/10 text-slate-200' : 'bg-white border-black/[0.06] text-slate-600 shadow-sm'
                          }`}>
                          <p className={!isDescriptionExpanded ? 'line-clamp-4' : ''}>
                            {profile.business_description || 'No description provided.'}
                          </p>
                          {(profile.business_description?.length > 200) && (
                            <button
                              onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 mt-2 uppercase tracking-wider"
                            >
                              {isDescriptionExpanded ? 'Show Less' : 'Read More'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-6">
                      <button
                        onClick={() => setIsEditModalOpen(true)}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-sm ${isDarkMode
                          ? 'bg-white text-slate-900 hover:bg-slate-100'
                          : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                      >
                        <User className="w-4 h-4" /> Edit Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm text-slate-500">No profile data available</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tools' && (
              <div className="animate-slide-in-up">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/[0.04]">
                  <div>
                    <h3 className={`text-[17px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Connections</h3>
                    <p className={`text-[13px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Sync Emily with your social accounts.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {platforms.map((platform) => {
                    const isConnected = isPlatformConnected(platform.id)
                    const isSelected = selectedPlatform === platform.id
                    const connection = connections.find(conn =>
                      conn.platform?.toLowerCase() === platform.id.toLowerCase()
                    )
                    const pageName = connection?.page_name || connection?.page_username || connection?.site_name || connection?.wordpress_site_name


                    return (
                      <div
                        key={platform.id}
                        className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${isConnected
                          ? (isDarkMode ? 'bg-white/5 border-white/10 shadow-sm' : 'bg-white border-black/[0.06] shadow-sm')
                          : (isDarkMode ? 'bg-transparent border-white/[0.05]' : 'bg-transparent border-transparent')
                          }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold uppercase ${isConnected
                            ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-900 text-white')
                            : (isDarkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-400')
                            }`}>
                            {platform.id.substring(0, 2)}
                          </div>
                          <div>
                            <p className={`text-[14px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {platform.name}
                            </p>
                            {isConnected && pageName && (
                              <p className="text-[11px] text-slate-500 font-medium">{pageName}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {loading && isSelected && (
                            <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                          )}
                          <div
                            className="relative inline-block w-10 h-5 cursor-pointer"
                            onClick={() => !loading && handleToggle(platform.id)}
                          >
                            <div
                              className={`relative w-full h-full rounded-full transition-all duration-300 ${isConnected
                                ? (isDarkMode ? 'bg-indigo-500' : 'bg-slate-900')
                                : (isDarkMode ? 'bg-white/10' : 'bg-slate-200')
                                }`}
                            >
                              <div
                                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${isConnected
                                  ? 'transform translate-x-5'
                                  : 'transform translate-x-0'
                                  }`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="animate-slide-in-up">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/[0.04]">
                  <div>
                    <h3 className={`text-[17px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Subscription</h3>
                    <p className={`text-[13px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Manage your plan and billing details.</p>
                  </div>
                </div>

                {billingLoading ? (
                  <div className="flex items-center gap-3 py-12 justify-center">
                    <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                    <span className="text-sm text-slate-500">Loading billing...</span>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Current Plan */}
                    {subscriptionStatus && (
                      <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10 shadow-lg' : 'bg-white border-black/[0.06] shadow-md'
                        }`}>
                        <div className="flex items-center justify-between mb-6">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Active Plan</label>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${subscriptionStatus.status === 'active'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600'
                            }`}>
                            {subscriptionStatus.status || 'Unknown'}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 mb-8">
                          <h4 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                            {subscriptionStatus.plan || 'Free Tier'}
                          </h4>
                          <p className="text-[13px] text-slate-500">Billed {subscriptionStatus.billing_cycle || 'monthly'}.</p>
                        </div>

                        <div className={`pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-black/[0.04]'} space-y-4`}>
                          <div className="flex justify-between text-[13px]">
                            <span className="text-slate-500">Renews on</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{formatDate(subscriptionStatus.subscription_end_date)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Latest Invoice */}
                    {billingHistory && billingHistory.length > 0 && (
                      <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50/50 border-black/[0.04]'
                        }`}>
                        <div className="flex items-center justify-between mb-6">
                          <h4 className={`text-[14px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Recent Invoice</h4>
                          <button
                            onClick={handleDownloadBill}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white border border-black/[0.08] text-slate-700 hover:bg-slate-50 shadow-sm'
                              }`}
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Amount</p>
                            <p className={`text-[15px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {formatCurrency(billingHistory[0].amount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Date</p>
                            <p className={`text-[15px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              {formatDate(billingHistory[0].payment_date || billingHistory[0].created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'preferences' && (
              <div className="animate-slide-in-up">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-black/[0.04]">
                  <div>
                    <h3 className={`text-[17px] font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Appearance</h3>
                    <p className={`text-[13px] mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Customize how Emily looks to you.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Theme Settings */}
                  <div className={`p-6 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-black/[0.06] shadow-sm'
                    }`}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h4 className={`text-[14px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark Interface</h4>
                        <p className="text-[12px] text-slate-500 mt-0.5">Reduce eye strain in low light environments.</p>
                      </div>

                      <div
                        className="relative inline-block w-10 h-5 cursor-pointer"
                        onClick={toggleDarkMode}
                      >
                        <div
                          className={`relative w-full h-full rounded-full transition-all duration-300 ${localDarkMode
                            ? (isDarkMode ? 'bg-indigo-500' : 'bg-slate-900')
                            : (isDarkMode ? 'bg-white/10' : 'bg-slate-200')
                            }`}
                        >
                          <div
                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 ${localDarkMode
                              ? 'transform translate-x-5'
                              : 'transform translate-x-0'
                              }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Theme Preview Cards */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => localDarkMode && toggleDarkMode()}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${!localDarkMode
                          ? 'border-indigo-500 bg-indigo-50/50'
                          : 'border-transparent bg-slate-50 hover:bg-slate-100'
                          }`}>
                        <div className="w-full h-12 bg-white border border-black/[0.05] rounded-lg mb-3 flex flex-col p-2 gap-1 px-3">
                          <div className="h-1.5 w-1/2 bg-slate-200 rounded-full" />
                          <div className="h-1.5 w-3/4 bg-slate-100 rounded-full" />
                        </div>
                        <span className="text-[12px] font-bold text-slate-900">Light Mode</span>
                      </button>

                      <button
                        onClick={() => !localDarkMode && toggleDarkMode()}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${localDarkMode
                          ? 'border-indigo-400 bg-white/10'
                          : 'border-transparent bg-slate-900/5 hover:bg-slate-900/10'
                          }`}>
                        <div className="w-full h-12 bg-slate-900 border border-white/10 rounded-lg mb-3 flex flex-col p-2 gap-1 px-3">
                          <div className="h-1.5 w-1/2 bg-white/20 rounded-full" />
                          <div className="h-1.5 w-3/4 bg-white/10 rounded-full" />
                        </div>
                        <span className={`text-[12px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark Mode</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal
        key={isDarkMode ? 'dark' : 'light'}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          setIsEditModalOpen(false)
          fetchProfile()
        }}
        isDarkMode={isDarkMode}
      />
    </>
  )
}

export default SettingsMenu

