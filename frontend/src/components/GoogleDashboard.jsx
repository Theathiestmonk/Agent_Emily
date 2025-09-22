import React, { useState, useEffect } from 'react'
import { Mail, FileText, Table, Folder, Calendar, Send, RefreshCw, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import SideNavbar from './SideNavbar'
import MainContentLoader from './MainContentLoader'

const GoogleDashboard = () => {
  const { user } = useAuth()
  const [gmailMessages, setGmailMessages] = useState([])
  const [driveFiles, setDriveFiles] = useState([])
  const [sheets, setSheets] = useState([])
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [testResult, setTestResult] = useState(null)
  const [reconnectUrl, setReconnectUrl] = useState(null)
  const [sendEmail, setSendEmail] = useState({
    to: '',
    subject: '',
    body: ''
  })

  useEffect(() => {
    if (user) {
      checkConnectionStatus()
    fetchGoogleData()
    }
  }, [user])

  const checkConnectionStatus = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      console.log('🔍 Checking Google connection status...')
      const response = await fetch(`${baseUrl}/connections/google/connection-status`, {
        headers
      })
      const statusData = await response.json()
      console.log('📊 Connection status:', statusData)
      setConnectionStatus(statusData)
    } catch (error) {
      console.error('❌ Error checking connection status:', error)
    }
  }

  const testGmailAPI = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      console.log('🧪 Testing Gmail API...')
      const response = await fetch(`${baseUrl}/connections/google/gmail/test`, {
        headers
      })
      const testData = await response.json()
      console.log('🧪 Gmail API test result:', testData)
      setTestResult(testData)
    } catch (error) {
      console.error('❌ Error testing Gmail API:', error)
      setTestResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const reconnectGoogleAccount = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      console.log('🔄 Reconnecting Google account...')
      const response = await fetch(`${baseUrl}/connections/google/reconnect`, {
        method: 'POST',
        headers
      })
      const reconnectData = await response.json()
      console.log('🔄 Reconnect result:', reconnectData)
      
      if (reconnectData.success) {
        setReconnectUrl(reconnectData.auth_url)
        // Open the reconnection URL in a new window
        window.open(reconnectData.auth_url, '_blank')
      } else {
        setTestResult({ success: false, error: reconnectData.error })
      }
    } catch (error) {
      console.error('❌ Error reconnecting Google account:', error)
      setTestResult({ success: false, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    try {
      const token = localStorage.getItem('token')
      if (token) {
        return token
      }
      
      // Try to get token from Supabase session
      const { supabase } = await import('../lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      console.error('Error getting auth token:', error)
      return null
    }
  }

  const fetchGoogleData = async () => {
    try {
      setLoading(true)
      setError(null)

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      // Ensure no double slashes in URLs
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')

      // Get authentication token
      const authToken = await getAuthToken()
      console.log('🔑 Auth token status:', authToken ? 'Present' : 'Missing')
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
      console.log('📤 Request headers:', headers)

      // Fetch Gmail messages (top 3 for dashboard)
      console.log('🔍 Fetching Gmail messages...', { baseUrl, headers })
      const gmailResponse = await fetch(`${baseUrl}/connections/google/gmail/messages?limit=3`, {
        headers
      })
      console.log('📧 Gmail response status:', gmailResponse.status)
      const gmailData = await gmailResponse.json()
      console.log('📧 Gmail data received:', gmailData)
      
      if (gmailData.messages) {
        setGmailMessages(gmailData.messages)
        console.log('✅ Gmail messages set:', gmailData.messages.length)
      } else {
        console.log('❌ No Gmail messages in response:', gmailData)
      }

      // Fetch Drive files
      const driveResponse = await fetch(`${baseUrl}/connections/google/drive/files?limit=5`, {
        headers
      })
      const driveData = await driveResponse.json()
      console.log('📁 Drive data received:', driveData)
      if (driveData.files) {
        setDriveFiles(driveData.files)
      } else if (driveData.error) {
        console.log('❌ Drive error:', driveData.error)
      }

      // Fetch Sheets
      const sheetsResponse = await fetch(`${baseUrl}/connections/google/sheets/spreadsheets?limit=5`, {
        headers
      })
      const sheetsData = await sheetsResponse.json()
      console.log('📊 Sheets data received:', sheetsData)
      if (sheetsData.spreadsheets) {
        setSheets(sheetsData.spreadsheets)
      } else if (sheetsData.error) {
        console.log('❌ Sheets error:', sheetsData.error)
      }

      // Fetch Docs
      const docsResponse = await fetch(`${baseUrl}/connections/google/docs/documents?limit=5`, {
        headers
      })
      const docsData = await docsResponse.json()
      console.log('📄 Docs data received:', docsData)
      if (docsData.documents) {
        setDocs(docsData.documents)
      } else if (docsData.error) {
        console.log('❌ Docs error:', docsData.error)
      }

    } catch (error) {
      console.error('Error fetching Google data:', error)
      setError('Failed to fetch Google data')
    } finally {
      setLoading(false)
    }
  }

  const handleSendEmail = async (e) => {
    e.preventDefault()
    try {
      setLoading(true)
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      // Ensure no double slashes in URL
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      // Get authentication token
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }
      
      const response = await fetch(`${baseUrl}/connections/google/gmail/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(sendEmail)
      })

      const result = await response.json()
      
      if (result.success) {
        alert('Email sent successfully!')
        setSendEmail({ to: '', subject: '', body: '' })
      } else {
        alert('Failed to send email: ' + result.detail)
      }
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Failed to send email')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    return new Date(dateString).toLocaleDateString()
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className="text-gray-600">Please log in to access the Google dashboard.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-blue-500 rounded-full flex items-center justify-center">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Google Workspace</h1>
                  <p className="text-sm text-gray-500">Manage your Gmail, Drive, Sheets, and Docs</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={testGmailAPI}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  <span>Test Gmail API</span>
                </button>
                <button
                  onClick={reconnectGoogleAccount}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Reconnect Google</span>
                </button>
                <button
                  onClick={fetchGoogleData}
                  disabled={loading}
                  className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>Refresh</span>
                </button>
              </div>
        </div>
      </div>
        </div>

        {/* Main Content Area */}
        {loading && gmailMessages.length === 0 ? (
          <MainContentLoader message="Loading Google data..." />
        ) : (
          <div className="flex-1 pt-24 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* First Column - Top 3 Emails */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                      <Mail className="w-5 h-5 mr-2 text-red-500" />
                      Top 3 Recent Emails
                    </h2>
                    
                    {gmailMessages.length > 0 ? (
                      <div className="space-y-4">
                        {gmailMessages.map((message, index) => (
                          <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{message.subject}</h3>
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatDate(message.date)}</span>
                            </div>
                            <p className="text-xs text-gray-600 mb-2 truncate">From: {message.sender}</p>
                            <p className="text-xs text-gray-700 line-clamp-2">{message.snippet}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No emails found</p>
                        {connectionStatus ? (
                          <div className="mt-4">
                            <p className="text-sm text-gray-400">
                              Connection Status: {connectionStatus.connected ? '✅ Connected' : '❌ Not Connected'}
                            </p>
                            {connectionStatus.error && (
                              <p className="text-xs text-red-500 mt-2">{connectionStatus.error}</p>
                            )}
                            {connectionStatus.connected && (
                              <p className="text-xs text-gray-400 mt-2">
                                Connected as: {connectionStatus.page_name || 'Unknown'}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Connect your Gmail account to see recent emails</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Second and Third Columns - Other Google Services */}
                <div className="lg:col-span-2 space-y-8">
          {/* Send Email Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Send className="w-5 h-5 mr-2 text-green-600" />
              Send Email
            </h2>
            
            <form onSubmit={handleSendEmail} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To
                </label>
                <input
                  type="email"
                  value={sendEmail.to}
                  onChange={(e) => setSendEmail({...sendEmail, to: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  value={sendEmail.subject}
                  onChange={(e) => setSendEmail({...sendEmail, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Email subject"
                  required
                />
                        </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={sendEmail.body}
                  onChange={(e) => setSendEmail({...sendEmail, body: e.target.value})}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Your message here..."
                  required
                />
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Email'}
              </button>
            </form>
          </div>

          {/* Google Drive Files Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Folder className="w-5 h-5 mr-2 text-blue-500" />
              Google Drive Files
            </h2>
            
            {driveFiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {driveFiles.slice(0, 4).map((file, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <h3 className="font-medium text-gray-900 mb-2 truncate text-sm">{file.name}</h3>
                            <p className="text-xs text-gray-600 mb-1">{file.mimeType}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                            <p className="text-xs text-gray-500">Modified: {formatDate(file.modifiedTime)}</p>
                    {file.webViewLink && (
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                      >
                        Open in Drive
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No files found</p>
            )}
          </div>

          {/* Google Sheets Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Table className="w-5 h-5 mr-2 text-green-500" />
              Google Sheets
            </h2>
            
            {sheets.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sheets.slice(0, 4).map((sheet, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <h3 className="font-medium text-gray-900 mb-2 truncate text-sm">{sheet.name}</h3>
                            <p className="text-xs text-gray-600 mb-1">{sheet.mimeType}</p>
                            <p className="text-xs text-gray-500">Modified: {formatDate(sheet.modifiedTime)}</p>
                    {sheet.webViewLink && (
                      <a
                        href={sheet.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                      >
                        Open in Sheets
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No spreadsheets found</p>
            )}
          </div>

          {/* Google Docs Section */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Google Docs
            </h2>
            
            {docs.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {docs.slice(0, 4).map((doc, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                            <h3 className="font-medium text-gray-900 mb-2 truncate text-sm">{doc.name}</h3>
                            <p className="text-xs text-gray-600 mb-1">{doc.mimeType}</p>
                            <p className="text-xs text-gray-500">Modified: {formatDate(doc.modifiedTime)}</p>
                    {doc.webViewLink && (
                      <a
                        href={doc.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                                className="text-blue-600 hover:underline text-xs"
                      >
                        Open in Docs
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No documents found</p>
            )}
                  </div>
                </div>
          </div>
              
              {testResult && (
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Gmail API Test Results</h3>
                  {testResult.success ? (
                    <div>
                      <p className="text-green-600">✅ Gmail API is working!</p>
                      <p className="text-sm text-gray-600 mt-2">
                        Profile: {testResult.profile?.emailAddress || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Total messages: {testResult.message_count || 0}
                      </p>
                      {testResult.messages && testResult.messages.length > 0 && (
                        <p className="text-sm text-gray-600">
                          Sample message ID: {testResult.messages[0].id}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-red-600">❌ Gmail API test failed</p>
                      <p className="text-sm text-red-500 mt-2">{testResult.error}</p>
                      {testResult.error_type && (
                        <p className="text-xs text-gray-500">Error type: {testResult.error_type}</p>
                      )}
                      {(testResult.error_type === 'RefreshError' || testResult.error_type === 'TokenRefreshError') && (
                        <div className="mt-4">
                          <p className="text-sm text-orange-600 mb-2">
                            Your Google tokens have expired. Please reconnect your account.
                          </p>
                          <button
                            onClick={reconnectGoogleAccount}
                            disabled={loading}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                          >
                            {loading ? 'Reconnecting...' : 'Reconnect Google Account'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

          {error && (
                <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GoogleDashboard