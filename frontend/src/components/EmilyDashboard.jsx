import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { contentAPI } from '../services/content'
import { leadsAPI } from '../services/leads'
import { onboardingAPI } from '../services/onboarding'
import { socialMediaService } from '../services/socialMedia'
import { supabase } from '../lib/supabase'
import { loadTauriAPI } from '../utils/tauri'
import SideNavbar from './SideNavbar'


// Get dark mode state from localStorage or default to light mode
const getDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode')
  return saved !== null ? saved === 'true' : true // Default to true (dark mode)
}

// Listen for storage changes to sync dark mode across components
const useStorageListener = (key, callback) => {
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        callback(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom events for same-tab updates
    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        callback(e.detail.newValue === 'true')
      }
    }

    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [key, callback])
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import ATSNChatbot from './ATSNChatbot'
import RecentTasks from './RecentTasks'
import ContentCard from './ContentCard'
import NewPostModal from './NewPostModal'
import AddLeadModal from './AddLeadModal'
import ContentCreateIndicator from './ContentCreateIndicator'
import ATSNContentModal from './ATSNContentModal'
import ReelModal from './ReelModal'
import PostContentCard from './PostContentCard'
import { Sparkles, TrendingUp, Target, BarChart3, FileText, X, ChevronRight, ChevronLeft, RefreshCw, Send, Upload, CheckCircle, Mail, Phone, Facebook, Instagram, Users, LogIn, Globe, Calendar, MessageSquare } from 'lucide-react'

// Voice Orb Component with animated border (spring-like animation)
const VoiceOrb = ({ isSpeaking }) => {
  const [borderWidth, setBorderWidth] = useState(0)
  const velocityRef = useRef(0)
  const animationRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    if (isSpeaking) {
      // Spring animation parameters (similar to React Native Reanimated)
      const stiffness = 90
      const damping = 12
      const mass = 0.5
      const targetWidth = 8 + Math.random() * 4 // Vary between 8-12px based on "volume"
      
      const animate = (currentTime) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 16.67 // Normalize to ~60fps
        lastTimeRef.current = currentTime
        
        setBorderWidth(prev => {
          const current = prev
          const diff = targetWidth - current
          
          // Spring physics: F = -kx - bv
          const springForce = (stiffness / mass) * diff
          const dampingForce = (damping / mass) * velocityRef.current
          const acceleration = springForce - dampingForce
          
          // Update velocity
          velocityRef.current += acceleration * (deltaTime * 0.01)
          velocityRef.current *= 0.95 // Additional damping
          
          // Update position
          const newWidth = current + velocityRef.current * (deltaTime * 0.01)
          
          return Math.max(0, newWidth)
        })
        
        if (isSpeaking) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    } else {
      // Smoothly return to 0 with spring animation
      const stiffness = 90
      const damping = 12
      const mass = 0.5
      const targetWidth = 0
      
      const animate = (currentTime) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 16.67
        lastTimeRef.current = currentTime
        
        setBorderWidth(prev => {
          if (prev < 0.1 && Math.abs(velocityRef.current) < 0.1) {
            velocityRef.current = 0
            return 0
          }
          
          const current = prev
          const diff = targetWidth - current
          
          const springForce = (stiffness / mass) * diff
          const dampingForce = (damping / mass) * velocityRef.current
          const acceleration = springForce - dampingForce
          
          velocityRef.current += acceleration * (deltaTime * 0.01)
          velocityRef.current *= 0.95
          
          const newWidth = current + velocityRef.current * (deltaTime * 0.01)
          
          return Math.max(0, newWidth)
        })
        
        if (borderWidth > 0.1 || Math.abs(velocityRef.current) > 0.1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isSpeaking])

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer animated border container */}
      <div 
        className="absolute rounded-full border-2 flex items-center justify-center"
        style={{
          width: '290px',
          height: '290px',
          borderRadius: '145px',
          borderWidth: `${borderWidth}px`,
          borderColor: isSpeaking ? 'rgb(96, 165, 250)' : 'transparent',
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* Inner orb */}
        <div 
          className="rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center"
          style={{
            width: '280px',
            height: '280px',
            borderRadius: '140px',
          }}
        >
          <span className="text-white font-bold text-4xl">E</span>
        </div>
      </div>
                                </div>
  )
}

// Import components directly

function EmilyDashboard() {
  const { user, logout } = useAuth()
  const { showContentGeneration, showSuccess, showError, showInfo } = useNotifications()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [welcomeIndex, setWelcomeIndex] = useState(0)
  const welcomeVariants = useMemo(() => {
    const name = profile?.business_name || user?.user_metadata?.name || 'there'
    return [
      `Hello ${name}, how are you doing today?`,
      `Hi ${name}! How's everything going today?`,
      `Good day ${name} — how are you feeling today?`,
      `Hello ${name}, hope you're having a great day! How are you?`,
      `Hey ${name}, how's your day so far?`,
      `Hi ${name}! What can I help you with today?`,
      `Hello ${name}, ready to make today productive? How are you?`,
      `Good to see you ${name}! How's today treating you?`,
      `Hey ${name}, hope all is well — how are you today?`,
      `Hello ${name}! What's new today? How are you doing?`
    ]
  }, [profile, user])
  
  // Split greeting into two lines intelligently
  const splitGreeting = (text) => {
    if (!text) return ['', '']
    // Try splitting at common punctuation first
    const punct = ['?', '!', '.', ',']
    for (const p of punct) {
      const idx = text.indexOf(p)
      if (idx > -1 && idx < text.length - 1) {
        const first = text.slice(0, idx + 1).trim()
        const rest = text.slice(idx + 1).trim()
        if (rest) return [first, rest]
      }
    }
    // Fallback: split near middle on nearest space
    const mid = Math.floor(text.length / 2)
    const left = text.lastIndexOf(' ', mid)
    const right = text.indexOf(' ', mid + 1)
    let splitIdx = -1
    if (left === -1) splitIdx = right
    else if (right === -1) splitIdx = left
    else splitIdx = (mid - left <= right - mid) ? left : right
    if (splitIdx === -1) return [text, '']
    return [text.slice(0, splitIdx).trim(), text.slice(splitIdx).trim()]
  }
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [messageFilter, setMessageFilter] = useState('all') // 'all', 'emily', 'chase', 'leo'
  const [showMobileChatHistory, setShowMobileChatHistory] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [showChatbot, setShowChatbot] = useState(false)
  const [showNewPostModal, setShowNewPostModal] = useState(false)
  const [showAddLeadModal, setShowAddLeadModal] = useState(false)
  const [showContentCreateIndicator, setShowContentCreateIndicator] = useState(false)
  const [contentCreationStep, setContentCreationStep] = useState(0)
  const [showGeneratedContentModal, setShowGeneratedContentModal] = useState(false)
  const [showGeneratedReelModal, setShowGeneratedReelModal] = useState(false)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [suggestedPosts, setSuggestedPosts] = useState([])
  const [suggestedLoading, setSuggestedLoading] = useState(false)
  const [currentPostIndex, setCurrentPostIndex] = useState(0)
  const [todaysLeads, setTodaysLeads] = useState([])
  const [todaysLeadsLoading, setTodaysLeadsLoading] = useState(false)
  const [followUpLeads, setFollowUpLeads] = useState([])
  const [followUpLeadsLoading, setFollowUpLeadsLoading] = useState(false)
  const [scheduledCount, setScheduledCount] = useState(0)
  const [scheduledLoading, setScheduledLoading] = useState(false)
  const [weekCounts, setWeekCounts] = useState([0,0,0,0,0,0,0])
  const [weekLoading, setWeekLoading] = useState(false)
  const [createdContent, setCreatedContent] = useState([])
  const [createdLoading, setCreatedLoading] = useState(false)

  // Today's conversations only (no historical data)

  // Listen for dark mode changes from other components (like SideNavbar)
  useStorageListener('darkMode', setIsDarkMode)

  // Listen for conversation cache updates from ATSNChatbot
  useEffect(() => {
    const handleConversationCacheUpdate = (e) => {
      if (e.key && e.key.startsWith('today_conversations_') && user) {
        // Reload conversations if the cache was updated
        fetchTodayConversations()
      }
    }

    window.addEventListener('storage', handleConversationCacheUpdate)
    return () => window.removeEventListener('storage', handleConversationCacheUpdate)
  }, [user])

  // Listen for Tauri app updates (desktop only)
  useEffect(() => {
    const setupTauriListener = async () => {
      const listenFn = await loadTauriAPI()
      if (listenFn) {
        const unlisten = await listenFn('tauri://update-available', ({ payload }) => {
          showInfo('Update Available', 'A new version of ATSN AI is ready. The app will restart to install it.')
        })
        return () => unlisten()
      }
    }
    setupTauriListener()
  }, [])

// Date filtering removed - chatbot starts fresh

  const handleRefreshChat = async () => {
    // ATSN chatbot handles its own state clearing
    showSuccess('Chat refreshed', 'The conversation has been reset to start fresh.')
  }

  const handleRefreshAllData = async () => {
    try {
      // Clear all caches (per-user)
      const cacheKeys = [
        `today_conversations_${user?.id}`,
        `suggested_posts_${user?.id}`,
        `created_content_${user?.id}`,
        `todays_leads_${user?.id}`,
        `followup_leads_${user?.id}`,
        `scheduled_count_${user?.id}`,
        `week_entries_${user?.id}`
      ]

      cacheKeys.forEach(key => {
        try { localStorage.removeItem(key) } catch (e) { /* ignore */ }
      })

      // Refetch all data
      if (user) {
        await Promise.all([
          fetchTodayConversations(true),
          fetchSuggestedPosts(true),
          fetchCreatedContent(true),
          fetchTodaysLeads(true),
          fetchFollowUpLeads(true),
          fetchScheduledCount(true),
          fetchWeekEntries(true)
        ])
      }

      // Refresh welcome variant
      setWelcomeIndex(Math.floor(Math.random() * welcomeVariants.length))
      showSuccess('Data refreshed', 'All data has been updated with fresh information.')
    } catch (error) {
      console.error('Error refreshing data:', error)
      showError('Refresh failed', 'There was an error refreshing the data.')
    }
  }

  const fetchSuggestedPosts = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `suggested_posts_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setSuggestedLoading(true)
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { posts: cachedPosts, timestamp, date } = JSON.parse(cached)
          const age = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()
          if (cacheDate === today && age < CACHE_EXPIRATION_MS) {
            console.log('Using cached suggested posts:', cachedPosts.length)
            setSuggestedPosts(cachedPosts)
            setSuggestedLoading(false)
            return
          }
        }
      }

      const result = await contentAPI.getPostContents(12, 0)
      if (result.error) {
        throw new Error(result.error)
      }
      // Normalize platform values and prioritize: Instagram, Facebook, LinkedIn, YouTube
      const normalizePlatform = (post) => {
        const candidates = [
          post.platform,
          post.content_campaigns?.platform,
          post.channel,
          post.metadata?.platform,
          post.source_platform,
          (post.platform || '').toString(),
          (post.content_campaigns?.platform || '').toString()
        ].filter(Boolean).map(s => s.toString().toLowerCase())

        const joined = candidates.join(' ')
        if (joined.includes('insta') || joined.includes('instagram')) return 'instagram'
        if (joined.includes('facebook') || joined.includes('fb')) return 'facebook'
        if (joined.includes('linkedin')) return 'linkedin'
        if (joined.includes('youtube') || joined.includes('yt')) return 'youtube'
        return candidates[0] || ''
      }

      const priority = { instagram: 1, facebook: 2, linkedin: 3, youtube: 4 }

      const sorted = (result.data || []).slice().sort((a, b) => {
        const pa = normalizePlatform(a)
        const pb = normalizePlatform(b)
        const ia = priority[pa] || 99
        const ib = priority[pb] || 99
        if (ia !== ib) return ia - ib
        // fallback to created_at desc
        const da = a.created_at ? new Date(a.created_at) : new Date(0)
        const db = b.created_at ? new Date(b.created_at) : new Date(0)
        return db - da
      })
      
      // Ensure highest-priority platforms appear at the front.
      // If any Instagram posts exist, move the first one to index 0.
      const ensureFront = (arr, platformKey) => {
        const idx = arr.findIndex(p => normalizePlatform(p) === platformKey)
        if (idx > 0) {
          const [item] = arr.splice(idx, 1)
          arr.unshift(item)
        }
      }

      // Apply for Instagram first, then Facebook, then LinkedIn, then YouTube
      ensureFront(sorted, 'instagram')
      ensureFront(sorted, 'facebook')
      ensureFront(sorted, 'linkedin')
      ensureFront(sorted, 'youtube')

      setSuggestedPosts(sorted)

      // Cache results
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          posts: sorted,
          timestamp: Date.now(),
          date: new Date().toISOString()
        }))
      } catch (e) {
        console.warn('Failed to cache suggested posts', e)
      }
    } catch (error) {
      console.error('Error fetching suggested posts:', error)
      showError('Failed to load suggested content')
    } finally {
      setSuggestedLoading(false)
    }
  }, [user, showError])

  const fetchTodaysLeads = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `todays_leads_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setTodaysLeadsLoading(true)
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { leads: cachedLeads, timestamp, date } = JSON.parse(cached)
          const age = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()
          if (cacheDate === today && age < CACHE_EXPIRATION_MS) {
            console.log('Using cached todays leads:', (cachedLeads || []).length)
            setTodaysLeads(cachedLeads || [])
            setTodaysLeadsLoading(false)
            return
          }
        }
      }

      // Fetch recent leads from backend then filter for today client-side (keeps behavior consistent with LeadsDashboard)
      const response = await leadsAPI.getLeads({ limit: 500 })
      const resultData = response.data || response
      let fetchedLeads = []
      if (Array.isArray(resultData)) {
        fetchedLeads = resultData
      } else if (resultData && resultData.leads) {
        fetchedLeads = resultData.leads
      }

      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

      const todays = fetchedLeads.filter(lead => {
        if (!lead.created_at) return false
        const created = new Date(lead.created_at)
        return created >= startOfDay && created <= endOfDay
      }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      // Augment each lead with welcome_email_sent flag by checking recent outbound email conversations
      const augmented = await Promise.all(todays.map(async (lead) => {
        try {
          const convResp = await leadsAPI.getConversations(lead.id, { message_type: 'email', limit: 5 })
          const convs = convResp.data || []
          const createdAt = lead.created_at ? new Date(lead.created_at) : null
          const welcomeSent = convs.some(conv => {
            if (!conv) return false
            const isOutbound = conv.direction === 'outbound' && conv.sender === 'agent'
            if (!isOutbound) return false
            const content = (conv.content || '').toLowerCase()
            const created = conv.created_at ? new Date(conv.created_at) : null
            const nearCreation = createdAt && created && Math.abs(created - createdAt) < 1000 * 60 * 5 // within 5 minutes
            return content.includes('welcome') || nearCreation
          })
          return { ...lead, welcome_email_sent: welcomeSent }
        } catch (err) {
          console.error('Error checking conversations for lead', lead.id, err)
          return { ...lead, welcome_email_sent: false }
        }
      }))

      setTodaysLeads(augmented)

      // Cache today's leads
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          leads: augmented,
          timestamp: Date.now(),
          date: new Date().toISOString()
        }))
      } catch (e) {
        console.warn('Failed to cache todays leads', e)
      }
    } catch (err) {
      console.error('Error fetching todays leads:', err)
      setTodaysLeads([])
    } finally {
      setTodaysLeadsLoading(false)
    }
  }, [user])

  // Fetch leads that need follow-up with caching
  const fetchFollowUpLeads = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `followup_leads_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setFollowUpLeadsLoading(true)
    try {
      // Check if we have cached data from today
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { leads: cachedLeads, timestamp, date } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()

          // Use cached data if it's from today and less than 24 hours old
          if (cacheDate === today && cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached follow-up leads:', cachedLeads.length, 'leads')
            setFollowUpLeads(cachedLeads)
            setFollowUpLeadsLoading(false)
            return
          }
        }
      }

      // Fetch fresh data from API
      console.log('Fetching fresh follow-up leads from API')
      const response = await leadsAPI.getLeads({ limit: 500 })
      const resultData = response.data || response
      let fetchedLeads = []
      if (Array.isArray(resultData)) {
        fetchedLeads = resultData
      } else if (resultData && resultData.leads) {
        fetchedLeads = resultData.leads
      }

      const today = new Date()
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())

      // Filter leads that have follow_up_at and it's overdue or today
      const followUps = fetchedLeads.filter(lead => {
        if (!lead.follow_up_at) return false
        const followUpDate = new Date(lead.follow_up_at)
        const followUpDateOnly = new Date(followUpDate.getFullYear(), followUpDate.getMonth(), followUpDate.getDate())
        // Include leads where follow_up_at is today or in the past
        return followUpDateOnly <= startOfToday
      }).sort((a, b) => {
        // Sort by follow_up_at, oldest first
        const dateA = new Date(a.follow_up_at)
        const dateB = new Date(b.follow_up_at)
        return dateA - dateB
      })

      // Augment with welcome_email_sent flag
      const augmented = await Promise.all(followUps.map(async (lead) => {
        try {
          const convResp = await leadsAPI.getConversations(lead.id, { message_type: 'email', limit: 5 })
          const convs = convResp.data || []
          const createdAt = lead.created_at ? new Date(lead.created_at) : null
          const welcomeSent = convs.some(conv => {
            if (!conv) return false
            const isOutbound = conv.direction === 'outbound' && conv.sender === 'agent'
            if (!isOutbound) return false
            const content = (conv.content || '').toLowerCase()
            const created = conv.created_at ? new Date(conv.created_at) : null
            const nearCreation = createdAt && created && Math.abs(created - createdAt) < 1000 * 60 * 5
            return content.includes('welcome') || nearCreation
          })
          return { ...lead, welcome_email_sent: welcomeSent }
        } catch (err) {
          console.error('Error checking conversations for lead', lead.id, err)
          return { ...lead, welcome_email_sent: false }
        }
      }))

      // Cache the follow-up leads with current timestamp and date
      const cacheData = {
        leads: augmented,
        timestamp: Date.now(),
        date: new Date().toISOString()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

      console.log('Cached fresh follow-up leads:', augmented.length, 'leads')
      setFollowUpLeads(augmented)
    } catch (err) {
      console.error('Error fetching follow-up leads:', err)
      setFollowUpLeads([])
    } finally {
      setFollowUpLeadsLoading(false)
    }
  }, [user])

  // Filter suggested posts for today
  const todaysSuggestedPosts = useMemo(() => {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

    return suggestedPosts.filter(post => {
      if (!post.created_at) return false
      const created = new Date(post.created_at)
      return created >= startOfDay && created <= endOfDay
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [suggestedPosts])

  // Reset index when posts change
  useEffect(() => {
    setCurrentPostIndex(0)
  }, [todaysSuggestedPosts.length])

  const nextPost = () => {
    setCurrentPostIndex((prev) => (prev + 1) % todaysSuggestedPosts.length)
  }

  const prevPost = () => {
    setCurrentPostIndex((prev) => (prev - 1 + todaysSuggestedPosts.length) % todaysSuggestedPosts.length)
  }

  const goToPost = (index) => {
    setCurrentPostIndex(index)
  }

  const handleCopyCaption = useCallback(async (caption) => {
    if (!caption) return

    try {
      await navigator.clipboard.writeText(caption)
      showSuccess('Caption copied', 'Paste it anywhere you like')
    } catch (error) {
      console.error('Error copying caption:', error)
      showError('Copy failed', 'Unable to copy caption')
    }
  }, [showSuccess, showError])

  const handleApprovePost = useCallback(async (postId) => {
    try {
      const result = await contentAPI.approvePostContent(postId)
      if (result.success) {
        showSuccess('Post approved', 'The post has been marked as approved')
        // Refresh the suggested posts
        await fetchSuggestedPosts()
      } else {
        showError('Approval failed', result.error || 'Failed to approve post')
      }
    } catch (error) {
      console.error('Error approving post:', error)
      showError('Approval failed', 'Unable to approve post')
    }
  }, [showSuccess, showError, fetchSuggestedPosts])

  const handleDiscardPost = useCallback(async (postId) => {
    try {
      const result = await contentAPI.discardPostContent(postId)
      if (result.success) {
        showSuccess('Post discarded', 'The post has been deleted')
        // Refresh the suggested posts
        await fetchSuggestedPosts()
      } else {
        showError('Discard failed', result.error || 'Failed to discard post')
      }
    } catch (error) {
      console.error('Error discarding post:', error)
      showError('Discard failed', 'Unable to discard post')
    }
  }, [showSuccess, showError, fetchSuggestedPosts])

  useEffect(() => {
    if (user) {
      fetchSuggestedPosts()
      fetchCreatedContent()
      fetchTodaysLeads()
      fetchFollowUpLeads()
      fetchScheduledCount()
      fetchWeekEntries()
    }
  }, [user, fetchSuggestedPosts, fetchTodaysLeads, fetchFollowUpLeads])

  // Channel icon helper for lead cards
  const getChannelIcon = (platform) => {
    if (!platform) return <Users className="w-3.5 h-3.5" />
    const p = platform.toLowerCase()
    switch (p) {
      case 'facebook':
        return <Facebook className="w-3.5 h-3.5" />
      case 'instagram':
        return <Instagram className="w-3.5 h-3.5" />
      case 'email':
        return <Mail className="w-3.5 h-3.5" />
      case 'phone_call':
      case 'phone':
      case 'phone call':
        return <Phone className="w-3.5 h-3.5" />
      case 'walk_ins':
      case 'walk-ins':
      case 'walkin':
        return <LogIn className="w-3.5 h-3.5" />
      case 'website':
        return <Globe className="w-3.5 h-3.5" />
      case 'referral':
        return <Users className="w-3.5 h-3.5" />
      default:
        return <Users className="w-3.5 h-3.5" />
    }
  }

  // Helper function to determine which modal to open based on content type
  const openModalForContentType = (contentItem) => {
    if (!contentItem) {
      return 'content' // Default to content modal
    }

    // Check if it's carousel content - carousel should always open ATSNContentModal
    const isCarousel = contentItem.post_type === 'carousel' ||
                      contentItem.content_type?.toLowerCase() === 'carousel' ||
                      contentItem.selected_content_type?.toLowerCase() === 'carousel' ||
                      (contentItem.metadata && contentItem.metadata.carousel_images && contentItem.metadata.carousel_images.length > 0) ||
                      (contentItem.carousel_images && Array.isArray(contentItem.carousel_images) && contentItem.carousel_images.length > 0) ||
                      (contentItem.metadata && contentItem.metadata.total_images && contentItem.metadata.total_images > 1)

    if (isCarousel) {
      return 'content' // Carousel opens ATSNContentModal
    }

    // Determine content type from various possible sources
    const contentType = contentItem.content_type || 
                       contentItem.raw_data?.content_type || 
                       contentItem.selected_content_type

    if (!contentType) {
      return 'content' // Default to content modal
    }

    const contentTypeLower = contentType.toLowerCase().trim()
    
    // Check for short video/reel types - these should open ReelModal
    if (contentTypeLower === 'short_video or reel' ||
        contentTypeLower === 'reel' ||
        contentTypeLower === 'short_video' ||
        contentTypeLower === 'short video' ||
        (contentTypeLower.includes('reel') && !contentTypeLower.includes('long'))) {
      return 'reel'
    }
    
    // All other types (long_video, static_post, blog, etc.) should open ContentModal
    return 'content'
  }

  const handleCreateNewPost = async (formData) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        showError('Authentication Error', 'Please log in to create content.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setShowContentCreateIndicator(true)
      setContentCreationStep(0)
      setShowNewPostModal(false)

      // Step 1: Analyzing content
      setContentCreationStep(0)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate processing time

      // Step 2: Generating text content
      setContentCreationStep(1)
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate processing time

      // Send the form data to the new content creation endpoint
      const response = await fetch(`${API_BASE_URL}/create-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || errorData.error || 'Failed to create post')
      }

      // Step 3: Creating visuals (if applicable)
      setContentCreationStep(2)

      const result = await response.json()

      if (result.success) {
        // Step 4: Finalizing
        setContentCreationStep(3)
        await new Promise(resolve => setTimeout(resolve, 1500)) // Allow time to see final step

        // Fetch the newly created content from Supabase
        try {
          const contentId = result.content_id
          const token = localStorage.getItem('authToken')

          // Fetch the content from Supabase
          const contentResponse = await fetch(`${API_BASE_URL}/content/created-content/${contentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })

          if (contentResponse.ok) {
            const contentData = await contentResponse.json()
            setGeneratedContent(contentData)
            
            // Open the appropriate modal based on content type
            const modalType = openModalForContentType(contentData)
            if (modalType === 'reel') {
              setShowGeneratedReelModal(true)
            } else {
              setShowGeneratedContentModal(true)
            }
          } else {
            // Fallback to response data if fetch fails
            const fallbackContent = result.content_data || {}
            setGeneratedContent(fallbackContent)
            
            // Open the appropriate modal based on content type
            const modalType = openModalForContentType(fallbackContent)
            if (modalType === 'reel') {
              setShowGeneratedReelModal(true)
            } else {
              setShowGeneratedContentModal(true)
            }
          }
        } catch (error) {
          console.error('Error fetching content from Supabase:', error)
          // Fallback to response data
          const fallbackContent = result.content_data || {}
          setGeneratedContent(fallbackContent)
          
          // Open the appropriate modal based on content type
          const modalType = openModalForContentType(fallbackContent)
          if (modalType === 'reel') {
            setShowGeneratedReelModal(true)
          } else {
            setShowGeneratedContentModal(true)
          }
        }

        // Success - show success message
        showSuccess('Content Created!', 'Your new content has been created successfully.')

      } else {
        throw new Error(result.error || 'Failed to create content')
      }

    } catch (error) {
      console.error('Error creating post:', error)
      showError('Creation Failed', error.message || 'There was an error creating your post. Please try again.')
    } finally {
      setIsLoading(false)
      setShowContentCreateIndicator(false)
      setContentCreationStep(0)
    }
  }

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

  // Fetch today's conversations when user is available
  useEffect(() => {
    if (user) {
      fetchTodayConversations()
      // Set up daily cache flush at midnight
      const now = new Date()
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
      const timeUntilMidnight = tomorrow.getTime() - now.getTime()

      const midnightTimer = setTimeout(() => {
        console.log('Midnight reached - clearing conversation and follow-up leads cache')
        const CONVERSATION_CACHE_KEY = `today_conversations_${user.id}`
        const FOLLOWUP_CACHE_KEY = `followup_leads_${user.id}`
        localStorage.removeItem(CONVERSATION_CACHE_KEY)
        localStorage.removeItem(FOLLOWUP_CACHE_KEY)
        // Refresh conversations and follow-up leads for the new day
        fetchTodayConversations(true)
        fetchFollowUpLeads(true)
      }, timeUntilMidnight)

      return () => clearTimeout(midnightTimer)
    }
  }, [user])

  // No conversation history loading - only today's conversations

// Date filtering removed - chatbot starts fresh

// Date filter dropdown removed - chatbot starts fresh

  // Apply dark mode to document body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    // Save preference to localStorage
    localStorage.setItem('darkMode', isDarkMode.toString())
  }, [isDarkMode])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // Helper to extract an image URL from a created_content row (tries common fields)
  const getImageUrl = (item) => {
    if (!item) return null
    if (item.media_url && typeof item.media_url === 'string') return item.media_url
    if (item.image_url) return item.image_url
    if (item.primary_image_url) return item.primary_image_url
    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
      const first = item.images[0]
      return typeof first === 'string' ? first : (first.url || first.image_url || null)
    }
    if (item.metadata) {
      if (item.metadata.media_url) return item.metadata.media_url
      if (Array.isArray(item.metadata.carousel_images) && item.metadata.carousel_images.length > 0) {
        const first = item.metadata.carousel_images[0]
        return typeof first === 'string' ? first : (first.url || first.image_url || null)
      }
    }
    return null
  }

  const isVideoUrl = (url, contentItem = null) => {
    if (!url && !contentItem) return false
    const contentType = contentItem?.content_type?.toLowerCase() || ''
    if (contentType.includes('video') || contentType.includes('reel') || contentType.includes('short_video')) return true
    if (!url) return false
    const urlWithoutQuery = String(url).split('?')[0].toLowerCase()
    const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.m4v']
    return videoExtensions.some(ext => urlWithoutQuery.endsWith(ext)) || urlWithoutQuery.includes('/video') || urlWithoutQuery.includes('video')
  }

  const fetchTodayConversations = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `today_conversations_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setLoadingConversations(true)
    try {
      // Check if we have cached data from today
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { conversations: cachedConversations, timestamp, date } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()

          // Use cached data if it's from today and less than 24 hours old
          if (cacheDate === today && cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached today conversations:', cachedConversations.length, 'conversations')
            setConversations(cachedConversations)
            setLoadingConversations(false)
            return
          }
        }
      }

      // Fetch fresh data from API
      const authToken = await getAuthToken()
      if (!authToken) {
        console.error('No auth token available')
        setLoadingConversations(false)
        return
      }

      console.log('Fetching fresh today conversations from API')
      const response = await fetch(`${API_BASE_URL}/atsn/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const cleanedConversations = (data.conversations || []).map(conv => {
          // Clean messages text to remove stray characters
          if (conv.messages && Array.isArray(conv.messages)) {
            conv.messages = conv.messages.map(msg => {
              if (msg.text) {
                let cleanText = msg.text;
                // Remove trailing )} patterns
                cleanText = cleanText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                // Remove any standalone )} patterns
                cleanText = cleanText.replace(/\s*\)\s*\}\s*/g, '');
                // Remove other stray patterns
                cleanText = cleanText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                // Remove multiple consecutive braces
                cleanText = cleanText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();
                msg.text = cleanText;
              }
              return msg;
            });
          }
          return conv;
        });

        // Cache the conversations with current timestamp and date
        const cacheData = {
          conversations: cleanedConversations,
          timestamp: Date.now(),
          date: new Date().toISOString()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

        console.log('Cached fresh conversations:', cleanedConversations.length, 'conversations')
        setConversations(cleanedConversations)
      } else {
        console.error('Failed to fetch conversations:', response.statusText)
        setConversations([])
      }
    } catch (error) {
      console.error('Error fetching today conversations:', error)
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }

  const fetchCreatedContent = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `created_content_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setCreatedLoading(true)
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { items: cachedItems, timestamp, date } = JSON.parse(cached)
          const age = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()
          if (cacheDate === today && age < CACHE_EXPIRATION_MS) {
            console.log('Using cached created content:', (cachedItems || []).length)
            setCreatedContent(cachedItems || [])
            setCreatedLoading(false)
            return
          }
        }
      }

      const { data, error } = await supabase
        .from('created_content')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(12)

      if (error) {
        console.error('Error fetching created content:', error)
        setCreatedContent([])
      } else {
        const items = Array.isArray(data) ? data : []
        setCreatedContent(items)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            items,
            timestamp: Date.now(),
            date: new Date().toISOString()
          }))
        } catch (e) {
          console.warn('Failed to cache created content', e)
        }
      }
    } catch (err) {
      console.error('Error fetching created content:', err)
      setCreatedContent([])
    } finally {
      setCreatedLoading(false)
    }
  }, [user])

  const fetchScheduledCount = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `scheduled_count_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setScheduledLoading(true)
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { count: cachedCount, timestamp, date } = JSON.parse(cached)
          const age = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()
          if (cacheDate === today && age < CACHE_EXPIRATION_MS) {
            console.log('Using cached scheduled count:', cachedCount)
            setScheduledCount(cachedCount || 0)
            setScheduledLoading(false)
            return
          }
        }
      }

      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString()

      // Query Supabase created_content table for scheduled posts today
      const { data, error, count } = await supabase
        .from('created_content')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', user.id)
        .neq('status', 'deleted')
        .gte('scheduled_at', startOfDay)
        .lte('scheduled_at', endOfDay)

      if (error) {
        console.error('Error fetching scheduled count:', error)
        setScheduledCount(0)
      } else if (typeof count === 'number') {
        setScheduledCount(count)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            count,
            timestamp: Date.now(),
            date: new Date().toISOString()
          }))
        } catch (e) {
          console.warn('Failed to cache scheduled count', e)
        }
      } else {
        // Fallback to length of data array
        const fallback = Array.isArray(data) ? data.length : 0
        setScheduledCount(fallback)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            count: fallback,
            timestamp: Date.now(),
            date: new Date().toISOString()
          }))
        } catch (e) {
          console.warn('Failed to cache scheduled count', e)
        }
      }
    } catch (err) {
      console.error('Error fetching scheduled count:', err)
      setScheduledCount(0)
    } finally {
      setScheduledLoading(false)
    }
  }, [user])

  const fetchWeekEntries = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `week_entries_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    setWeekLoading(true)
    try {
      // Try cache first
      if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { counts: cachedCounts, timestamp, date } = JSON.parse(cached)
          const age = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()
          if (cacheDate === today && age < CACHE_EXPIRATION_MS) {
            console.log('Using cached week entries')
            setWeekCounts(cachedCounts || [0,0,0,0,0,0,0])
            setWeekLoading(false)
            return
          }
        }
      }

      const tokenResp = await supabase.auth.getSession()
      const token = tokenResp.data?.session?.access_token
      // Fetch calendars
      const calRes = await fetch(`${API_BASE_URL}/calendars`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!calRes.ok) {
        setWeekCounts([0,0,0,0,0,0,0])
        return
      }
      const calendars = await calRes.json()
      let allEntries = []
      if (Array.isArray(calendars) && calendars.length > 0) {
        const promises = calendars.map(c => fetch(`${API_BASE_URL}/calendars/${c.id}`, { headers: { Authorization: `Bearer ${token}` } }))
        const responses = await Promise.all(promises)
        for (const r of responses) {
          if (r.ok) {
            const d = await r.json()
            allEntries = allEntries.concat(d.entries || [])
          }
        }
      }

      // Compute current week (Sunday-Saturday)
      const now = new Date()
      const day = now.getDay()
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day)
      const counts = [0,0,0,0,0,0,0]
      allEntries.forEach(e => {
        const ed = new Date(e.entry_date)
        // normalize date only
        const edDate = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate())
        for (let i=0;i<7;i++) {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i)
          if (edDate.getTime() === d.getTime()) {
            counts[i] = counts[i] + 1
          }
        }
      })
      setWeekCounts(counts)

      // Cache counts
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          counts,
          timestamp: Date.now(),
          date: new Date().toISOString()
        }))
      } catch (e) {
        console.warn('Failed to cache week entries', e)
      }
    } catch (err) {
      console.error('Error fetching week entries:', err)
      setWeekCounts([0,0,0,0,0,0,0])
    } finally {
      setWeekLoading(false)
    }
  }, [user])

  // Group conversations by date and get only the last conversation per date
  const groupConversationsByDate = (conversations) => {
    const grouped = {}
    const dateMap = {} // Map dateKey to actual Date object for sorting
    
    conversations.forEach(conv => {
      const date = new Date(conv.created_at)
      const dateKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
        // Store the date object for sorting (use start of day)
        const dateForSorting = new Date(date)
        dateForSorting.setHours(0, 0, 0, 0)
        dateMap[dateKey] = dateForSorting
      }
      grouped[dateKey].push(conv)
    })

    // Sort dates (newest first) using the date objects
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return dateMap[b] - dateMap[a]
    })

    // Return only the last conversation for each date
    return sortedDates.map(date => {
      const dateConversations = grouped[date].sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      )
      // Get the last conversation (most recent)
      const lastConversation = dateConversations[dateConversations.length - 1]
      // Also store the date object for filtering
      const dateObj = dateMap[date]
      
      return {
        date,
        dateObj, // Store date object for filtering
        lastConversation,
        allConversations: dateConversations // Store all conversations for this date
      }
    })
  }

  // Function to load ATSN conversations for the selected date filter
// ATSN conversation loading removed - chatbot starts fresh

// Conversation loading functions removed - chatbot starts fresh

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Please log in to access the dashboard.</p>
        </div>
      </div>
    )
  }


  return (
    <div className={`h-screen overflow-hidden custom-scrollbar ${
      isDarkMode ? 'bg-gray-900 dark-mode' : 'bg-white light-mode'
    }`}>
      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={() => {}} // Dashboard doesn't have these functions
        handleGenerateContent={() => {}}
        generating={false}
        fetchingFreshData={false}
        onOpenChatHistory={() => {
          setShowMobileChatHistory(true)
          if (!conversations.length && user) {
            fetchTodayConversations()
          }
        }}
        showChatHistory={showMobileChatHistory}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div data-main-content="true" className={`md:ml-48 xl:ml-64 flex flex-col overflow-hidden pt-16 md:pt-0 bg-transparent ${
        isDarkMode ? 'md:bg-gray-900' : 'md:bg-white'
      }`} style={{ height: '100vh', overflow: 'hidden' }}>
        {/* (header removed) */}

        {/* Main Content Area */}
        <div className={`flex-1 flex bg-transparent ${
          isDarkMode ? 'md:bg-gray-800' : 'md:bg-gray-50'
        }`} style={{ minHeight: 0, overflow: 'hidden' }}>
            <div className="w-full h-full flex gap-2">
                {/* Main Chat Area */}
              <div className="flex-1 h-full overflow-hidden">
                <div className={`h-full relative ${
                  isDarkMode ? 'dark-mode' : 'light-mode'
                }`}>
                  {showChatbot ? (
                    <div className="h-full pt-0.5 px-8">
                      <ATSNChatbot
                        key="atsn-chatbot-fresh"
                        onMinimize={() => setShowChatbot(false)}
                      />
                    </div>
                  ) : (
                    <div className="h-full w-full px-8 py-6 overflow-y-auto">
                      <div className="flex items-center gap-3 mb-4">
                        {suggestedLoading && (
                          <span className="text-xs text-gray-400 uppercase tracking-widest">Loading...</span>
                        )}
                      </div>

                        <>
                          {/* Simple centered greeting above columns */}
                          <div className="mb-8 pb-4">
                            <div className="w-full flex items-center justify-center">
                              {(() => {
                                const [l1, l2] = splitGreeting(welcomeVariants[welcomeIndex])
                                return (
                                  <div className="text-center">
                                    <div className={`text-4xl leading-tight font-thin ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{l1}</div>
                                    {l2 && <div className={`text-4xl leading-tight font-thin ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{l2}</div>}
                                    <div className={`mx-auto mt-3 h-[2px] w-20 rounded ${isDarkMode ? 'bg-gray-600' : 'bg-pink-200'}`} />
                                  </div>
                                )
                              })()}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                          {/* Column 1: Suggested post */}
                          <div className="col-span-1">
                            <div className="mb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h3 className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                    Suggested posts
                                  </h3>
                                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {todaysSuggestedPosts.length} post{todaysSuggestedPosts.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                {/* Navigation Arrows */}
                                {todaysSuggestedPosts.length > 1 && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={prevPost}
                                      className={`p-2 rounded-full ${
                                        isDarkMode
                                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-md'
                                      } transition-colors`}
                                      aria-label="Previous post"
                                    >
                                      <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={nextPost}
                                      className={`p-2 rounded-full ${
                                        isDarkMode
                                          ? 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                                          : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-md'
                                      } transition-colors`}
                                      aria-label="Next post"
                                    >
                                      <ChevronRight className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {todaysSuggestedPosts && todaysSuggestedPosts.length > 0 ? (
                              <div className="relative">
                                {/* Slider Container */}
                                <div className="relative overflow-hidden">
                                  <div
                                    className="flex transition-transform duration-300 ease-in-out"
                                    style={{
                                      transform: `translateX(-${currentPostIndex * 100}%)`
                                    }}
                                  >
                                    {todaysSuggestedPosts.map((post) => (
                                      <div
                                        key={post.id}
                                        className="w-full flex-shrink-0"
                                      >
                                        <PostContentCard
                                          post={post}
                                          isDarkMode={isDarkMode}
                                          onCopy={(caption) => handleCopyCaption(caption)}
                                          statusLabelOverride="Suggested"
                                          onApprove={handleApprovePost}
                                          onDiscard={handleDiscardPost}
                                          hideBottomNav={true}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                {/* scheduled card moved to Reminders column */}

                                {/* Slide indicators removed per request */}
                              </div>
                            ) : (
                              <div className="p-6 rounded-lg border border-dashed text-center text-sm text-gray-500">
                                No suggested posts available for today.
                              </div>
                            )}
                          </div>

                          {/* Columns 2-5: leads + placeholders */}
                          <div className="col-span-4 grid grid-cols-3 gap-4">
                            {/* Column 2: Created content grid (3x4 images, 3 columns x 4 rows) */}
                            <div className="col-span-1">
                              <div className="mb-3">
                                <h3 className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                  Your creations
                                </h3>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {createdContent.length} item{createdContent.length !== 1 ? 's' : ''}
                                </p>
                              </div>

                              <div className="rounded-lg">
                                {createdLoading ? (
                                  <div className={`p-6 rounded-lg border text-center ${isDarkMode ? 'border-gray-700 bg-gray-800 text-gray-300' : 'border-gray-200 bg-white text-gray-600'}`}>
                                    Loading...
                                  </div>
                                ) : createdContent && createdContent.length > 0 ? (
                                  <div className="grid grid-cols-3 gap-2">
                                    {createdContent.slice(0, 12).map((item) => {
                                      const img = getImageUrl(item)
                                      const video = isVideoUrl(img, item)
                                      return (
                                        <div
                                          key={item.id}
                                          className="aspect-square overflow-hidden rounded-md bg-gray-100 cursor-pointer"
                                          onClick={() => {
                                            setGeneratedContent(item)
                                            const modalType = openModalForContentType(item)
                                            if (modalType === 'reel') {
                                              setShowGeneratedReelModal(true)
                                            } else {
                                              setShowGeneratedContentModal(true)
                                            }
                                          }}
                                        >
                                          {video && img ? (
                                            <video
                                              src={img}
                                              muted
                                              playsInline
                                              preload="metadata"
                                              className="w-full h-full object-cover"
                                              onLoadedData={(e) => {
                                                try { e.currentTarget.currentTime = 0.1 } catch (err) { /* ignore */ }
                                              }}
                                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                                            />
                                          ) : img ? (
                                            <img
                                              src={img}
                                              alt={item.title || 'Post'}
                                              className="w-full h-full object-cover"
                                              onError={(e) => { e.target.style.display = 'none' }}
                                            />
                                          ) : (
                                            <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                              <div className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>No image</div>
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className={`p-6 rounded-lg border border-dashed text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                    No created images yet
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Column 3-4: Stats (Reminders + Scheduled + New Leads) */}
                            <div className="col-span-2 grid grid-cols-2 gap-4">
                              {/* Left column: stack Reminders above Scheduled */}
                              <div className="col-span-1 flex flex-col gap-4">
                                <div>
                                  <div className="mb-3">
                                    <h3 className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                      New Leads
                                    </h3>
                                  </div>
                                  <div
                                    onClick={() => navigate('/leads')}
                                    className={`p-4 rounded-xl flex items-center gap-3 justify-start border cursor-pointer transition-colors ${
                                      isDarkMode
                                        ? 'border-gray-700 bg-gray-800 hover:bg-gray-750 text-gray-200'
                                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <Users className="w-6 h-6 flex-shrink-0 text-pink-400" />
                                    <div className="flex items-baseline gap-3">
                                      <div className="text-2xl font-semibold text-pink-400">
                                        {todaysLeadsLoading ? '...' : todaysLeads.length}
                                      </div>
                                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {todaysLeads.length === 1 ? 'lead received today' : 'leads received today'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <div className="mb-3">
                                    <h3 className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                      Reminders
                                    </h3>
                                  </div>
                                  <div
                                    onClick={() => navigate('/leads?filter=overdue_followups')}
                                    className={`p-4 rounded-xl flex items-center gap-3 justify-start border cursor-pointer transition-colors ${
                                      isDarkMode
                                        ? 'border-gray-700 bg-gray-800 hover:bg-gray-750 text-gray-200'
                                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <Calendar className="w-6 h-6 flex-shrink-0 text-pink-400" />
                                    <div className="flex items-baseline gap-3">
                                      <div className="text-2xl font-semibold text-pink-400">
                                        {followUpLeadsLoading ? '...' : followUpLeads.length}
                                      </div>
                                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {followUpLeads.length === 1 ? 'lead to follow up today' : 'leads to follow up today'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                {/* Scheduled posts quick card - placed directly below Reminders */}
                                <div>
                                  <div
                                    onClick={() => navigate('/content?filter=scheduled')}
                                    className={`mt-3 p-4 rounded-xl flex items-center gap-3 justify-start border cursor-pointer transition-colors ${
                                      isDarkMode
                                        ? 'border-gray-700 bg-gray-800 hover:bg-gray-750 text-gray-200'
                                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                                    }`}
                                  >
                                    <FileText className="w-6 h-6 flex-shrink-0 text-pink-400" />
                                    <div className="flex items-baseline gap-3">
                                      <div className="text-2xl font-semibold text-pink-400">
                                        {scheduledLoading ? '...' : scheduledCount}
                                      </div>
                                      <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {scheduledCount === 1 ? 'post scheduled today' : 'posts scheduled today'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right column: Weekly calendar strip */}
                              <div className="col-span-1">
                                <div className="mb-3">
                                  <h3 className={`text-base font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                                    This week
                                  </h3>
                                </div>
                                <div className={`p-3 rounded-xl border ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
                                  <div className="grid grid-cols-7 gap-2 text-center">
                                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                                      <div key={d} className="text-xs">
                                        <div className={`font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{d}</div>
                                        <div className="mt-1">
                                          <div className="text-sm font-semibold text-pink-400">
                                            {weekLoading ? '...' : weekCounts[i]}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        </>
                    </div>
                  )}
                </div>
              </div>

        </div>
      </div>
      </div>

      {/* Quick Actions - aligned to main content area */}
      {!showChatbot && (
        <div className="fixed bottom-6 left-0 right-0 z-50 p-4 pointer-events-auto">
          <div className="md:ml-48 xl:ml-64 flex justify-center">
            <div className="w-full max-w-7xl px-8">
              <div className="flex justify-center gap-4 flex-wrap">
                <div
                  onClick={() => setShowNewPostModal(true)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <svg className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-[#9e005d]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      Design a new post
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setShowAddLeadModal(true)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                      <Upload className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-[#9e005d]'}`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      Upload a new lead
                    </span>
                  </div>
                </div>

                <div
                  onClick={() => setShowChatbot(true)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isDarkMode
                      ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center text-center space-y-2">
                      <div className="w-6 h-6 flex items-center justify-center">
                      <MessageSquare className={`w-6 h-6 ${isDarkMode ? 'text-white' : 'text-[#9e005d]'}`} />
                    </div>
                    <span className={`text-sm font-medium ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                    }`}>
                      Talk to your AI teammates
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Mobile Today's Conversations Panel - Full Screen */}
      {showMobileChatHistory && (
        <div className={`md:hidden fixed inset-0 z-50 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Today's Conversations
              </h2>
              <button
                onClick={() => setShowMobileChatHistory(false)}
                className={`p-2 rounded-md transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                }`}
                title="Close"
              >
                <X className={`w-5 h-5 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Loading today's conversations...
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No conversations today
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map((conv) => {
                    const lastMessage = conv.messages && conv.messages.length > 0
                      ? conv.messages[conv.messages.length - 1]
                      : null

                    if (!lastMessage) return null
                    
                    const isUser = lastMessage.sender === 'user'

                    // Clean message text to remove stray characters
                    let cleanText = lastMessage.text || '';
                    // Remove trailing )} patterns (with or without whitespace)
                    cleanText = cleanText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                    // Remove any standalone )} patterns throughout the text
                    cleanText = cleanText.replace(/\s*\)\s*\}\s*/g, '');
                    // Remove other common stray patterns: (, {, [, ], *, etc. at start/end
                    cleanText = cleanText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                    // Remove multiple consecutive braces/brackets
                    cleanText = cleanText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();

                    const preview = cleanText?.substring(0, 100) +
                      (cleanText?.length > 100 ? '...' : '')
                    
                    return (
                      <div key={conv.id} className={`p-3 rounded-lg border ${
                        isDarkMode
                          ? 'border-gray-700 bg-gray-800'
                          : 'border-gray-200 bg-white'
                      }`}>
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm ${
                            isUser
                              ? 'bg-pink-400'
                              : 'bg-gradient-to-br from-pink-400 to-purple-500'
                            }`}>
                              {isUser ? (
                                profile?.logo_url ? (
                                  <img src={profile.logo_url} alt="User" className="w-10 h-10 rounded-full object-cover" />
                                ) : (
                                  <span className="text-white">U</span>
                                )
                              ) : (
                                <span className="text-white font-bold">E</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${
                                isUser ? 'text-pink-700' : 'text-purple-700'
                              }`}>
                                {isUser ? 'You' : conv.primary_agent_name || 'Emily'}
                                </span>
                              <span className={`text-xs ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {conv.total_messages} messages
                              </span>
                              </div>
                            <p className={`text-sm line-clamp-2 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {preview || 'No preview available'}
                            </p>
                            <p className={`text-xs mt-1 ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {new Date(conv.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Post Modal */}
      <NewPostModal
        isOpen={showNewPostModal}
        onClose={() => setShowNewPostModal(false)}
        onSubmit={handleCreateNewPost}
        isDarkMode={isDarkMode}
      />

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onSuccess={() => {
          // Refresh data if needed
          handleRefreshAllData()
        }}
        isImporting={false}
        isDarkMode={isDarkMode}
      />

      {/* Content Creation Indicator */}
      <ContentCreateIndicator
        isOpen={showContentCreateIndicator}
        isDarkMode={isDarkMode}
        currentStep={contentCreationStep}
      />

      {/* Generated Content Modal */}
      {showGeneratedContentModal && generatedContent && (
        <ATSNContentModal
          content={generatedContent}
          onClose={() => {
            setShowGeneratedContentModal(false)
            setGeneratedContent(null)
          }}
        />
      )}

      {/* Generated Reel Modal */}
      {showGeneratedReelModal && generatedContent && (
        <ReelModal
          content={generatedContent}
          onClose={() => {
            setShowGeneratedReelModal(false)
            setGeneratedContent(null)
          }}
        />
      )}
    </div>
  )
}

export default EmilyDashboard
