import React, { useState, useEffect } from 'react'
import { Bug, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState({})
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const checkEnvironment = async () => {
      const info = {
        // Environment variables
        apiUrl: (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, ''),
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        nodeEnv: import.meta.env.MODE,
        
        // Current location
        currentUrl: window.location.href,
        origin: window.location.origin,
        
        // API connectivity
        apiReachable: false,
        apiError: null,
        
        // Auth status
        hasAuthToken: false,
        authError: null
      }

      // Test API connectivity
      try {
        const response = await fetch(`${info.apiUrl}/health`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        info.apiReachable = response.ok
        if (!response.ok) {
          info.apiError = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        info.apiError = error.message
      }

      // Test auth token
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        info.hasAuthToken = !!session?.access_token
        if (session?.access_token) {
          info.authToken = session.access_token.substring(0, 20) + '...'
        }
      } catch (error) {
        info.authError = error.message
      }

      setDebugInfo(info)
    }

    checkEnvironment()
  }, [])

  const testFacebookConnection = async () => {
    try {
      const apiUrl = debugInfo.apiUrl.replace(/\/$/, '')
      const response = await fetch(`${apiUrl}/connections/auth/facebook/connect/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${debugInfo.authToken}`
        }
      })
      
      const data = await response.json()
      console.log('Facebook connection test:', { status: response.status, data })
      alert(`Facebook test: ${response.ok ? 'SUCCESS' : 'FAILED'}\nStatus: ${response.status}\nResponse: ${JSON.stringify(data, null, 2)}`)
    } catch (error) {
      console.error('Facebook connection test error:', error)
      alert(`Facebook test ERROR: ${error.message}`)
    }
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Debug Panel"
      >
        <Bug className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Debug Panel</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">API URL:</span>
          <span className={`font-mono ${debugInfo.apiUrl ? 'text-green-600' : 'text-red-600'}`}>
            {debugInfo.apiUrl || 'NOT SET'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Current URL:</span>
          <span className="font-mono text-blue-600">{debugInfo.currentUrl}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">API Reachable:</span>
          {debugInfo.apiReachable ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
        
        {debugInfo.apiError && (
          <div className="text-red-600 text-xs">
            API Error: {debugInfo.apiError}
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Auth Token:</span>
          {debugInfo.hasAuthToken ? (
            <CheckCircle className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
        
        {debugInfo.authToken && (
          <div className="text-xs text-gray-500 font-mono">
            Token: {debugInfo.authToken}
          </div>
        )}
        
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={testFacebookConnection}
            className="w-full bg-blue-500 text-white py-1 px-2 rounded text-xs hover:bg-blue-600"
          >
            Test Facebook Connection
          </button>
        </div>
      </div>
    </div>
  )
}

export default DebugPanel
