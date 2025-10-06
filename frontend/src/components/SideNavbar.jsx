import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  Home, 
  FileText, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  Sparkles,
  BarChart3,
  Share2,
  Megaphone,
  BookOpen,
  CreditCard,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

const SideNavbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [profile, setProfile] = useState(null)
  const [profileFetched, setProfileFetched] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({})

  // Cache key for localStorage
  const getCacheKey = (userId) => `profile_${userId}`

  // Load profile from cache or fetch from API
  const loadProfile = useCallback(async () => {
    try {
      if (!user) return

      const cacheKey = getCacheKey(user.id)
      
      // Try to load from cache first
      const cachedProfile = localStorage.getItem(cacheKey)
      if (cachedProfile) {
        const parsedProfile = JSON.parse(cachedProfile)
        setProfile(parsedProfile)
        setProfileFetched(true)
        return
      }

      // If not in cache, fetch from API
      const { data, error } = await supabase
        .from('profiles')
        .select('logo_url, business_name, name')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setProfileFetched(true)
        return
      }

      // Cache the profile data
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProfile(data)
      setProfileFetched(true)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfileFetched(true)
    }
  }, [user])

  useEffect(() => {
    if (user && !profileFetched) {
      loadProfile()
    }
  }, [user, profileFetched, loadProfile])

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home
    },
    {
      name: 'Content',
      icon: FileText,
      hasSubmenu: true,
      submenu: [
        {
          name: 'Social',
          href: '/content',
          icon: FileText
        },
        {
          name: 'Blogs',
          href: '/blogs',
          icon: BookOpen
        }
      ]
    },
    {
      name: 'Social Media',
      href: '/social',
      icon: Share2
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3
    },
    {
      name: 'Ads',
      href: '/ads',
      icon: Megaphone
    },
    {
      name: 'Settings',
      icon: Settings,
      hasSubmenu: true,
      submenu: [
        {
          name: 'Connections',
          href: '/settings',
          icon: Settings
        },
        {
          name: 'Billing',
          href: '/billing',
          icon: CreditCard
        }
      ]
    }
  ]

  const handleLogout = () => {
    // Clear profile cache on logout
    if (user) {
      const cacheKey = getCacheKey(user.id)
      localStorage.removeItem(cacheKey)
    }
    logout()
    navigate('/login')
  }

  const isActive = (href) => {
    return location.pathname === href
  }

  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  const isSubmenuActive = (submenuItems) => {
    return submenuItems.some(item => isActive(item.href))
  }

  // Auto-expand submenus when their child pages are active
  useEffect(() => {
    const newExpandedMenus = {}
    navigationItems.forEach(item => {
      if (item.hasSubmenu && item.submenu) {
        const hasActiveChild = item.submenu.some(subItem => isActive(subItem.href))
        if (hasActiveChild) {
          newExpandedMenus[item.name] = true
        }
      }
    })
    setExpandedMenus(prev => ({ ...prev, ...newExpandedMenus }))
  }, [location.pathname])

  const displayName = useMemo(() => {
    return profile?.name || user?.user_metadata?.name || user?.email || 'User'
  }, [profile, user])

  const profileTitle = useMemo(() => {
    return profile?.name || user?.user_metadata?.name || "Profile"
  }, [profile, user])

  // Function to refresh profile cache (can be called from other components)
  const refreshProfileCache = useCallback(() => {
    if (user) {
      const cacheKey = getCacheKey(user.id)
      localStorage.removeItem(cacheKey)
      setProfileFetched(false)
      setProfile(null)
    }
  }, [user])

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 fixed left-0 top-0 h-screen z-50 ${
      isCollapsed ? 'w-16' : 'w-48 xl:w-64'
    } flex flex-col overflow-hidden`} style={{position: 'fixed', zIndex: 50}}>
      {/* Header */}
      <div className="p-3 lg:p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-2 lg:mr-3">
                <span className="text-white font-bold text-sm lg:text-lg">E</span>
              </div>
              <div>
                <h1 className="text-base lg:text-lg font-bold text-gray-900">Emily</h1>
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
      <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = item.href ? isActive(item.href) : isSubmenuActive(item.submenu || [])
          const isExpanded = expandedMenus[item.name]
          
          if (item.hasSubmenu) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleSubmenu(item.name)}
                  className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                    active
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{item.name}</div>
                      </div>
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </>
                  )}
                </button>
                
                {/* Submenu */}
                {!isCollapsed && isExpanded && item.submenu && (
                  <div className="ml-4 mt-2 space-y-1 lg:space-y-2">
                    {item.submenu.map((subItem) => {
                      const SubIcon = subItem.icon
                      const subActive = isActive(subItem.href)
                      
                      return (
                        <button
                          key={subItem.name}
                          onClick={() => navigate(subItem.href)}
                          className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                            subActive
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <SubIcon className="w-5 h-5 mr-2 lg:mr-3" />
                          <div className="flex-1 text-left">
                            <div className="font-medium text-sm lg:text-base">{subItem.name}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          
          // Regular menu item
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                active
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${isCollapsed ? 'mx-auto' : 'mr-3'}`} />
              {!isCollapsed && (
                <div className="flex-1 text-left">
                  <div className="font-medium">{item.name}</div>
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        {!isCollapsed ? (
          <div className="space-y-3">
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center p-2 lg:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3 overflow-hidden">
                {profile?.logo_url && (
                  <img 
                    src={profile.logo_url} 
                    alt="Profile Logo" 
                    className="w-full h-full object-cover rounded-full"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500">Click to view profile</p>
              </div>
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full flex items-center p-2 lg:p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => navigate('/profile')}
              className="w-full flex items-center justify-center p-2 lg:p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              title={profileTitle}
            >
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center overflow-hidden">
                {profile?.logo_url && (
                  <img 
                    src={profile.logo_url} 
                    alt="Profile Logo" 
                    className="w-full h-full object-cover rounded-full"
                  />
                )}
              </div>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 lg:p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              title="Logout"
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
