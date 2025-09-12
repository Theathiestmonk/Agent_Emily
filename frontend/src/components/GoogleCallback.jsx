import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

const GoogleCallback = () => {
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Processing Google OAuth callback...')
  const navigate = useNavigate()

  useEffect(() => {
    handleGoogleCallback()
  }, [])

  const handleGoogleCallback = async () => {
    try {
      setStatus('processing')
      setMessage('Processing Google OAuth callback...')

      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      const error = urlParams.get('error')

      if (error) {
        setStatus('error')
        if (error.includes('access_denied') || error.includes('testing')) {
          setMessage(`Google OAuth Error: The app is in testing mode. Please add your email as a test user in Google Cloud Console, or contact the administrator.`)
        } else {
          setMessage(`OAuth error: ${error}`)
        }
        
        // Send error message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_ERROR',
            error: error
          }, window.location.origin)
        }
        return
      }

      if (!code || !state) {
        setStatus('error')
        setMessage('Missing required OAuth parameters')
        
        // Send error message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_ERROR',
            error: 'Missing required OAuth parameters'
          }, window.location.origin)
        }
        return
      }

      // Call backend to complete OAuth flow
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      // Ensure no double slashes in URL
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      const response = await fetch(`${baseUrl}/connections/google/callback?code=${code}&state=${state}`)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google callback error:', response.status, errorText)
        setStatus('error')
        setMessage(`Failed to complete Google OAuth: ${response.status}`)
        
        // Send error message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_ERROR',
            error: `Failed to complete Google OAuth: ${response.status}`
          }, window.location.origin)
        }
        return
      }

      const data = await response.json()
      
      if (data.success) {
        setStatus('success')
        setMessage('Google account connected successfully!')
        
        // Send success message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_SUCCESS',
            message: 'Google account connected successfully!'
          }, window.location.origin)
        } else {
          // If not in popup, redirect to dashboard
          setTimeout(() => {
            navigate('/dashboard')
          }, 2000)
        }
      } else {
        setStatus('error')
        setMessage(data.message || 'Failed to connect Google account')
        
        // Send error message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_ERROR',
            error: data.message || 'Failed to connect Google account'
          }, window.location.origin)
        }
      }
    } catch (error) {
      console.error('Error handling Google callback:', error)
      setStatus('error')
      setMessage('An unexpected error occurred')
      
      // Send error message to parent window if in popup
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_ERROR',
          error: error.message || 'An unexpected error occurred'
        }, window.location.origin)
      }
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'error':
        return <XCircle className="w-8 h-8 text-red-600" />
      default:
        return <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          <h2 className={`text-xl font-semibold ${getStatusColor()}`}>
            {status === 'processing' && 'Processing...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
          </h2>
          <p className="text-gray-600">{message}</p>
          
          {status === 'success' && (
            <p className="text-sm text-gray-500">
              Redirecting to dashboard...
            </p>
          )}
          
          {status === 'error' && (
            <div className="space-y-2">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/connections')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoogleCallback
