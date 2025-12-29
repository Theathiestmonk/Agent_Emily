import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { adminAPI } from '../services/admin'
import SettingsMenu from './SettingsMenu'
// Custom Discussions Icon Component
const DiscussionsIcon = ({ className }) => (
  <img
    src="/discussions.svg"
    alt="Discussions"
    className={className}
    style={{ width: '24px', height: '24px', objectFit: 'contain' }}
  />
)
import {
  Home,
  FileText,
  Settings,
  Hand,
  Sparkles,
  BarChart3,
  Share2,
  Megaphone,
  BookOpen,
  ChevronDown,
  ChevronRight,
  UserPlus,
  MessageSquare,
  Lightbulb,
  Pen,
  TrendingUp,
  Shield
} from 'lucide-react'

const SideNavbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [profileFetched, setProfileFetched] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({})
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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

  // Check admin status based on subscription plan
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false)
        return
      }
      
      try {
        // Get user profile to check subscription plan
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .single()
        
        if (error || !profile) {
          setIsAdmin(false)
          return
        }
        
        // Check if subscription plan is 'admin'
        setIsAdmin(profile.subscription_plan === 'admin')
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      }
    }
    
    if (user) {
      checkAdminStatus()
    }
  }, [user])

  const navigationItems = [
    {
      name: 'Discussions',
      href: '/dashboard',
      icon: DiscussionsIcon
    },
    {
      name: 'Suggestions',
      href: '/post-suggestions',
      icon: Sparkles
    },
    {
      name: 'Writings',
      href: '/blogs',
      icon: Pen
    },
    {
      name: 'Happenings',
      href: '/social',
      icon: TrendingUp
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3
    },
    // {
    //   name: 'Ads',
    //   href: '/ads',
    //   icon: Megaphone
    // },
    {
      name: 'Leads',
      href: '/leads',
      icon: UserPlus
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
    <div className="hidden md:block bg-white shadow-lg transition-all duration-300 fixed left-0 top-0 h-screen z-50 w-48 xl:w-64 flex flex-col overflow-hidden" style={{position: 'fixed', zIndex: 50}}>
      {/* Header */}
      <div className="p-3 lg:p-4 border-b border-gray-200">
        <div className="flex items-start justify-start">
          <div className="flex flex-col space-y-1">
            <img
              src="/workvilalge.svg"
              alt="Workvillage"
              className="h-8 lg:h-10 w-auto object-contain"
            />
            <p className="text-xs text-gray-500 truncate">
              {profile?.business_name ? `For ${profile.business_name}` : 'AI Marketing'}
            </p>
          </div>
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
                  <Icon className="w-5 h-5 mr-3" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.name}</div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                
                {/* Submenu */}
                {isExpanded && item.submenu && (
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
              onClick={() => {
                if (item.onClick) {
                  item.onClick()
                } else if (item.href) {
                  navigate(item.href)
                }
              }}
              className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                active
                  ? 'bg-gray-200/50 backdrop-blur-md text-gray-900 border border-gray-300/30 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5 mr-3" />
              <div className="flex-1 text-left">
                <div className="font-medium">{item.name}</div>
              </div>
            </button>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0 space-y-1">
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-colors group ${
              location.pathname === '/admin'
                ? 'bg-gray-200/50 backdrop-blur-md text-gray-900 border border-gray-300/30 shadow-sm'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Shield className="w-5 h-5 mr-3" />
            <span className="font-medium">Admin</span>
          </button>
        )}
        <button
          onClick={() => setIsSettingsMenuOpen(true)}
          className="w-full flex items-center p-2 lg:p-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors group"
        >
          <Settings className="w-5 h-5 mr-3" />
          <span className="font-medium">Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center p-2 lg:p-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors group"
        >
          <Hand className="w-5 h-5 mr-3" style={{ transform: 'rotate(-20deg)' }} />
          <span className="font-medium">Say Bye</span>
        </button>
      </div>

      {/* Settings Menu */}
      <SettingsMenu 
        isOpen={isSettingsMenuOpen} 
        onClose={() => setIsSettingsMenuOpen(false)} 
      />
    </div>
  )
}

export default SideNavbar
