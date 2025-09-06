import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { onboardingAPI } from '../services/onboarding'
import { Sparkles, TrendingUp, Users, Target, BarChart3, LogOut, User, FileText, Calendar, Settings } from 'lucide-react'

function Dashboard() {
  const { user, logout } = useAuth()
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Emily Dashboard</h1>
                <p className="text-sm text-gray-500">Your AI Marketing Assistant</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/content')}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <FileText className="h-5 w-5" />
                <span className="text-sm">Content</span>
              </button>
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-400" />
                <span className="text-sm text-gray-700">{user?.user_metadata?.name || user?.email}</span>
              </div>
              <button
                onClick={logout}
                className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {profile?.business_name || user?.user_metadata?.name || 'there'}! 👋
              </h2>
              <p className="text-gray-600">
                Ready to take your {profile?.industry?.join(', ') || 'business'} to the next level?
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-pink-50 to-pink-100 p-6 rounded-xl">
              <TrendingUp className="w-8 h-8 text-pink-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-1">Performance</h3>
              <p className="text-sm text-gray-600">Track your marketing metrics</p>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl">
              <Users className="w-8 h-8 text-purple-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-1">Audience</h3>
              <p className="text-sm text-gray-600">Understand your customers</p>
            </div>
            
            <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-6 rounded-xl">
              <Target className="w-8 h-8 text-indigo-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-1">Campaigns</h3>
              <p className="text-sm text-gray-600">Manage your marketing campaigns</p>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl">
              <BarChart3 className="w-8 h-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-gray-800 mb-1">Analytics</h3>
              <p className="text-sm text-gray-600">Get insights and reports</p>
            </div>
          </div>
        </div>

                 {/* Quick Actions */}
                 <div className="grid md:grid-cols-2 gap-8">
                   <div className="bg-white rounded-2xl shadow-lg p-8">
                     <h3 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h3>
                     <div className="space-y-3">
                       <button 
                         onClick={() => navigate('/content')}
                         className="w-full text-left p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg hover:from-pink-100 hover:to-purple-100 transition-colors"
                       >
                         <div className="flex items-center space-x-3">
                           <FileText className="w-5 h-5 text-pink-600" />
                           <div>
                             <div className="font-medium text-gray-800">Content Dashboard</div>
                             <div className="text-sm text-gray-600">View and manage your AI-generated content</div>
                           </div>
                         </div>
                       </button>
                       <button 
                         onClick={() => navigate('/calendar')}
                         className="w-full text-left p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg hover:from-purple-100 hover:to-indigo-100 transition-colors"
                       >
                         <div className="flex items-center space-x-3">
                           <Calendar className="w-5 h-5 text-purple-600" />
                           <div>
                             <div className="font-medium text-gray-800">Content Calendar</div>
                             <div className="text-sm text-gray-600">View your content schedule by month</div>
                           </div>
                         </div>
                       </button>
                       <button className="w-full text-left p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg hover:from-indigo-100 hover:to-blue-100 transition-colors">
                         <div className="flex items-center space-x-3">
                           <Calendar className="w-5 h-5 text-purple-600" />
                           <div>
                             <div className="font-medium text-gray-800">Generate Content</div>
                             <div className="text-sm text-gray-600">Get AI-powered content ideas</div>
                           </div>
                         </div>
                       </button>
                       <button className="w-full text-left p-4 bg-gradient-to-r from-indigo-50 to-green-50 rounded-lg hover:from-indigo-100 hover:to-green-100 transition-colors">
                         <div className="flex items-center space-x-3">
                           <BarChart3 className="w-5 h-5 text-indigo-600" />
                           <div>
                             <div className="font-medium text-gray-800">View Analytics</div>
                             <div className="text-sm text-gray-600">Check your performance metrics</div>
                           </div>
                         </div>
                       </button>
                     </div>
                   </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Your Business Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Business Name:</span>
                <span className="font-medium text-gray-800">{profile?.business_name || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Industry:</span>
                <span className="font-medium text-gray-800">{profile?.industry?.join(', ') || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Social Platforms:</span>
                <span className="font-medium text-gray-800">{profile?.social_media_platforms?.join(', ') || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Monthly Budget:</span>
                <span className="font-medium text-gray-800">{profile?.monthly_budget_range || 'Not set'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="mt-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">🚀 More Features Coming Soon!</h3>
          <p className="text-lg mb-6">
            We're working hard to bring you advanced AI-powered marketing tools, 
            automated content generation, and comprehensive analytics.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <span className="bg-white/20 px-3 py-1 rounded-full">AI Content Generator</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">Social Media Scheduler</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">Advanced Analytics</span>
            <span className="bg-white/20 px-3 py-1 rounded-full">Email Marketing</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard

