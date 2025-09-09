import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  Home, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  User, 
  Menu, 
  X,
  Sparkles,
  BarChart3,
  Target,
  Users,
  Share2,
  Bot
} from 'lucide-react'

const SideNavbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
      description: 'Overview and quick actions'
    },
    {
      name: 'Content',
      href: '/content',
      icon: FileText,
      description: 'Manage your content'
    },
    {
      name: 'Calendar',
      href: '/calendar',
      icon: Calendar,
      description: 'Content calendar view'
    },
    {
      name: 'Social Media',
      href: '/social',
      icon: Share2,
      description: 'Latest posts from your channels'
    },
    {
      name: 'Assistant',
      href: '/chatbot',
      icon: Bot,
      description: 'AI-powered business assistant'
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
      description: 'Performance insights'
    },
    {
      name: 'Campaigns',
      href: '/campaigns',
      icon: Target,
      description: 'Marketing campaigns'
    },
    {
      name: 'Audience',
      href: '/audience',
      icon: Users,
      description: 'Audience insights'
    }
  ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (href) => {
    return location.pathname === href
  }

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 fixed left-0 top-0 h-screen z-50 ${
      isCollapsed ? 'w-16' : 'w-64'
    } flex flex-col overflow-hidden`} style={{position: 'fixed', zIndex: 50}}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">Emily</h1>
                <p className="text-xs text-gray-500">AI Marketing</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isCollapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 group ${
                active
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div className="font-medium">{item.name}</div>
                  <div className={`text-xs ${
                    active ? 'text-pink-100' : 'text-gray-500'
                  }`}>
                    {item.description}
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.user_metadata?.name || user?.email}
                </p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto">
              <User className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default SideNavbar
