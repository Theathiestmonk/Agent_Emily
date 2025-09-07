import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useContentCache } from '../contexts/ContentCacheContext'
import { contentAPI } from '../services/content'
import SideNavbar from './SideNavbar'
import { 
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Hash,
  Image as ImageIcon,
  FileText,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  Sparkles,
  Target,
  Eye,
  Edit,
  Share2,
  Download,
  Filter,
  Search,
  Grid,
  List,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Plus,
  RefreshCw
} from 'lucide-react'

const ContentCalendar = () => {
  const { user } = useAuth()
  const { scheduledContent, loading: contentLoading, fetchScheduledContent } = useContentCache()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [campaigns, setCampaigns] = useState([])
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedDateContent, setSelectedDateContent] = useState([])

  // Platform icons mapping
  const platformIcons = {
    'Facebook': Facebook,
    'Instagram': Instagram,
    'LinkedIn': Linkedin,
    'YouTube': Youtube,
    'Twitter/X': Twitter,
    'Twitter': Twitter,
    'TikTok': Hash,
    'Pinterest': Hash,
    'Snapchat': Hash
  }

  // Platform colors
  const platformColors = {
    'Facebook': 'bg-blue-500',
    'Instagram': 'bg-gradient-to-r from-purple-500 to-pink-500',
    'LinkedIn': 'bg-blue-600',
    'YouTube': 'bg-red-500',
    'Twitter/X': 'bg-blue-400',
    'Twitter': 'bg-blue-400',
    'TikTok': 'bg-black',
    'Pinterest': 'bg-red-600',
    'Snapchat': 'bg-yellow-400'
  }

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch campaigns (still using API as they're separate from content cache)
      const campaignsResponse = await contentAPI.getCampaigns()
      if (campaignsResponse.data) {
        setCampaigns(campaignsResponse.data)
      }
      
      // Use cached content instead of fetching posts separately
      // The scheduledContent from cache will be used as posts
      await fetchScheduledContent()
      
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    const days = []
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const getContentForDate = (date) => {
    if (!date) return []
    
    const dateStr = date.toISOString().split('T')[0]
    
    // Use scheduledContent from cache instead of posts
    const filteredPosts = scheduledContent.filter(post => {
      // Check both scheduled_date and scheduled_at fields for compatibility
      const scheduledDate = post.scheduled_date || post.scheduled_at
      if (!scheduledDate) return false
      
      // Handle both DATE and TIMESTAMP formats
      let postDateStr
      if (scheduledDate.includes('T')) {
        // It's a timestamp
        const postDate = new Date(scheduledDate)
        postDateStr = postDate.toISOString().split('T')[0]
      } else {
        // It's already a date string
        postDateStr = scheduledDate
      }
      
      return postDateStr === dateStr
    })
    
    return filteredPosts
  }

  const getPlatformsForDate = (date) => {
    const content = getContentForDate(date)
    const platforms = [...new Set(content.map(post => post.platform))]
    return platforms
  }

  const navigateMonth = (direction) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate)
      if (direction === 'prev') {
        newDate.setMonth(newDate.getMonth() - 1)
      } else {
        newDate.setMonth(newDate.getMonth() + 1)
      }
      return newDate
    })
  }

  const handleDateClick = (date) => {
    if (!date) return
    
    setSelectedDate(date)
    const content = getContentForDate(date)
    setSelectedDateContent(content)
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const getMonthName = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const isToday = (date) => {
    if (!date) return false
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isPastDate = (date) => {
    if (!date) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return date < today
  }

  const days = getDaysInMonth(currentDate)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (loading || contentLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading content calendar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="ml-64 flex flex-col min-h-screen">
        {/* Fixed Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <CalendarIcon className="w-8 h-8 text-pink-500" />
                <h1 className="text-2xl font-bold text-gray-900">Content Calendar</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900 min-w-[200px] text-center">
                  {getMonthName(currentDate)}
                </h2>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-6 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Calendar */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b">
                {dayNames.map(day => (
                  <div key={day} className="p-4 text-center text-sm font-medium text-gray-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {days.map((day, index) => {
                  const platforms = getPlatformsForDate(day)
                  const isCurrentDay = isToday(day)
                  const isPast = isPastDate(day)
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[120px] border-r border-b border-gray-200 p-2 cursor-pointer transition-all duration-200 ${
                        day ? 'hover:bg-gray-50' : 'bg-gray-50'
                      } ${isCurrentDay ? 'bg-pink-50 border-pink-200' : ''} ${
                        isPast ? 'opacity-60' : ''
                      }`}
                      onClick={() => handleDateClick(day)}
                    >
                      {day && (
                        <>
                          {/* Date Number */}
                          <div className={`text-sm font-medium mb-2 ${
                            isCurrentDay ? 'text-pink-600' : 'text-gray-900'
                          }`}>
                            {day.getDate()}
                          </div>

                          {/* Platform Icons */}
                          {platforms.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {platforms.map(platform => {
                                const IconComponent = platformIcons[platform] || Hash
                                const colorClass = platformColors[platform] || 'bg-gray-500'
                                
                                return (
                                  <div
                                    key={platform}
                                    className={`w-6 h-6 rounded-full ${colorClass} flex items-center justify-center group relative`}
                                    title={platform}
                                  >
                                    <IconComponent className="w-3 h-3 text-white" />
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                                      {platform}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* Content Count */}
                          {platforms.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {platforms.length} platform{platforms.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Overview</h3>
              
              {/* Stats */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Campaigns</span>
                  <span className="text-sm font-medium text-gray-900">{campaigns.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Posts</span>
                  <span className="text-sm font-medium text-gray-900">{posts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="text-sm font-medium text-gray-900">
                    {posts.filter(post => {
                      const scheduledDate = post.scheduled_date || post.scheduled_at
                      if (!scheduledDate) return false
                      const postDate = new Date(scheduledDate)
                      return postDate.getMonth() === currentDate.getMonth() && 
                             postDate.getFullYear() === currentDate.getFullYear()
                    }).length}
                  </span>
                </div>
              </div>

              {/* Platform Distribution */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Platform Distribution</h4>
                <div className="space-y-2">
                  {Object.entries(platformIcons).map(([platform, IconComponent]) => {
                    const count = posts.filter(post => post.platform === platform).length
                    const colorClass = platformColors[platform] || 'bg-gray-500'
                    
                    if (count === 0) return null
                    
                    return (
                      <div key={platform} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 rounded-full ${colorClass} flex items-center justify-center`}>
                          <IconComponent className="w-2 h-2 text-white" />
                        </div>
                        <span className="text-sm text-gray-600">{platform}</span>
                        <span className="text-sm font-medium text-gray-900 ml-auto">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Selected Date Content */}
              {selectedDate && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    {formatDate(selectedDate)}
                  </h4>
                  {selectedDateContent.length > 0 ? (
                    <div className="space-y-2">
                      {selectedDateContent.map(post => (
                        <div key={post.id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-4 h-4 rounded-full ${platformColors[post.platform] || 'bg-gray-500'} flex items-center justify-center`}>
                              {React.createElement(platformIcons[post.platform] || Hash, { className: "w-2 h-2 text-white" })}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{post.platform}</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{post.title}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No content scheduled for this date</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}

export default ContentCalendar
