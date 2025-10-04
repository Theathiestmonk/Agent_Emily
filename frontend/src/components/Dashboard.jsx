import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { onboardingAPI } from '../services/onboarding'
import SideNavbar from './SideNavbar'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import ConnectionCards from './ConnectionCards'
import Chatbot from './Chatbot'
import RecentTasks from './RecentTasks'
import TaskNotification from './TaskNotification'
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
    <div className="min-h-screen bg-white">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-48 xl:ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-48 xl:left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl lg:text-2xl text-gray-900">
                  <span className="font-bold">Welcome,</span> {profile?.business_name || user?.user_metadata?.name || 'there'}
                </h1>
              </div>
              
              {/* Compact Social Media Connections */}
              <div className="flex items-center space-x-2 lg:space-x-4">
                <div className="text-xs lg:text-sm text-gray-500 mr-2 lg:mr-4 hidden sm:block">Connected accounts:</div>
                <div className="flex items-center space-x-1 lg:space-x-2">
                  <ConnectionCards compact={true} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          <MainContentLoader message="Loading your dashboard..." />
        ) : (
          <div className="flex-1 pt-20 lg:pt-24 p-4 lg:p-6 pl-4 lg:pl-6 pr-0 flex items-center">
            <div className="w-full">
              <div className="flex justify-center">
                {/* Main Chat Area */}
                <div className="w-full max-w-3xl xl:max-w-4xl">
                  <div className="bg-transparent rounded-lg h-full min-h-[500px] lg:min-h-[600px]">
                    <Chatbot />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Task Notification */}
      <TaskNotification />
    </div>
  )
}

export default Dashboard

