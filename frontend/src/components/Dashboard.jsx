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
import { Sparkles, TrendingUp, Users, Target, BarChart3, FileText, Calendar } from 'lucide-react'

function Dashboard() {
  const { user, logout } = useAuth()
  const { showContentGeneration, showSuccess, showError, showInfo } = useNotifications()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)


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
    </div>
  )
}

export default Dashboard

