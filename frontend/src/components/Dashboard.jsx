import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { onboardingAPI } from '../services/onboarding'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'
import ConnectionCards from './ConnectionCards'
import Chatbot from './Chatbot'
import DebugPanel from './DebugPanel'
import { Sparkles, TrendingUp, Users, Target, BarChart3, FileText, Calendar, Settings, X } from 'lucide-react'

function Dashboard() {
  const { user, logout } = useAuth()
  const { showContentGeneration, showSuccess, showError, showInfo } = useNotifications()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [accessTokens, setAccessTokens] = useState({
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    youtube: ''
  })
  const [saving, setSaving] = useState(false)


  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await onboardingAPI.getProfile()
        setProfile(response.data)
      } catch (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist, that's okay - user just completed onboarding
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [user])

  const handleSaveTokens = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'}/connections/update-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.access_token}`
        },
        body: JSON.stringify({
          tokens: accessTokens
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      showSuccess('Access tokens updated successfully!')
      setShowSettings(false)
    } catch (error) {
      console.error('Error updating tokens:', error)
      showError('Failed to update access tokens', error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingBar message="Loading your dashboard..." />
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className="text-gray-600">Please log in to access the dashboard.</p>
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
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {profile?.business_name || user?.user_metadata?.name || 'there'}!
                </h1>
                <p className="text-sm text-gray-500">
                  {profile?.business_name 
                    ? `Ready to take ${profile.business_name} to new heights? Let's create some amazing content!`
                    : "Ready to supercharge your marketing? Let's create some amazing content!"
                  }
                </p>
              </div>
              
              {/* Compact Social Media Connections */}
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500 mr-4">Connected accounts:</div>
                <div className="flex items-center space-x-2">
                  <ConnectionCards compact={true} />
                </div>
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Manage Access Tokens"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Chatbot Content */}
        <div className="flex-1 pt-24 flex items-center justify-center">
          <div className="w-full h-full max-w-6xl">
            <Chatbot />
          </div>
        </div>
      </div>
      
      {/* Debug Panel - Remove this after debugging */}
      <DebugPanel />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Manage Access Tokens</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This is an advanced feature for users who need additional permissions. 
                Enter your access tokens from the respective platform APIs to enhance functionality. 
                This works alongside the existing OAuth connection method.
              </p>
            </div>

            <form onSubmit={handleSaveTokens} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facebook Access Token
                  </label>
                  <input
                    type="password"
                    value={accessTokens.facebook}
                    onChange={(e) => setAccessTokens(prev => ({ ...prev, facebook: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter Facebook Graph API token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instagram Access Token
                  </label>
                  <input
                    type="password"
                    value={accessTokens.instagram}
                    onChange={(e) => setAccessTokens(prev => ({ ...prev, instagram: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter Instagram Business API token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    LinkedIn Access Token
                  </label>
                  <input
                    type="password"
                    value={accessTokens.linkedin}
                    onChange={(e) => setAccessTokens(prev => ({ ...prev, linkedin: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter LinkedIn API token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Twitter Access Token
                  </label>
                  <input
                    type="password"
                    value={accessTokens.twitter}
                    onChange={(e) => setAccessTokens(prev => ({ ...prev, twitter: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter Twitter API v2 token"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    YouTube Access Token
                  </label>
                  <input
                    type="password"
                    value={accessTokens.youtube}
                    onChange={(e) => setAccessTokens(prev => ({ ...prev, youtube: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter YouTube Data API token"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Tokens'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard

