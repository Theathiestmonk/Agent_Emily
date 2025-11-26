import React, { useState, useEffect, useRef, lazy, Suspense } from 'react'

import { useNotifications } from '../contexts/NotificationContext'

import { 

  FileText, 

  Plus, 

  Clock, 

  Globe, 

  Edit, 

  Trash2, 

  Send,

  RefreshCw,

  Search,

  BarChart3,

  BookOpen,

  Target,

  CheckCircle,

  AlertCircle,

  XCircle,

  Save,

  X,

  ExternalLink,

  Sparkles,

  Copy,

  Image as ImageIcon,

  Download,

  Upload,

  Maximize2,

  Minimize2,

  Eye,

  EyeOff

} from 'lucide-react'

import { blogService } from '../services/blogs'

import SideNavbar from './SideNavbar'

import MainContentLoader from './MainContentLoader'

import MobileNavigation from './MobileNavigation'

import CustomBlogChatbot from './CustomBlogChatbot'



const BlogDashboard = () => {

  console.log('BlogDashboard component rendering...')
  
  
  
  const { showSuccess, showError, showLoading, removeNotification } = useNotifications()

  const [blogs, setBlogs] = useState([])

  const [stats, setStats] = useState({})

  const [wordpressConnections, setWordpressConnections] = useState([])

  const [loading, setLoading] = useState(false)
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920)

  const [generating, setGenerating] = useState(false)

  const [selectedStatus, setSelectedStatus] = useState('all')

  const [selectedCampaign, setSelectedCampaign] = useState('all')

  const [searchTerm, setSearchTerm] = useState('')

  const [viewMode, setViewMode] = useState('grid') // grid or list

  const [showCampaignDetails, setShowCampaignDetails] = useState(false)

  const [editingBlog, setEditingBlog] = useState(null)

  const [editForm, setEditForm] = useState({

    title: '',

    content: '',

    excerpt: '',

    categories: '',

    tags: '',

    scheduled_date: '',

    scheduled_time: ''

  })

  const [saving, setSaving] = useState(false)
  const [generatingTagsCategories, setGeneratingTagsCategories] = useState(false)
  const [autoUpdatingTagsCategories, setAutoUpdatingTagsCategories] = useState(false)
  const [tagsCategoriesManuallyEdited, setTagsCategoriesManuallyEdited] = useState(false)
  const [lastCheckedContent, setLastCheckedContent] = useState('')
  const [autoUpdatingFromTitle, setAutoUpdatingFromTitle] = useState(false)
  const [lastCheckedTitle, setLastCheckedTitle] = useState('')
  const [contentManuallyEdited, setContentManuallyEdited] = useState(false)
  const [excerptManuallyEdited, setExcerptManuallyEdited] = useState(false)
  const [showContentPreview, setShowContentPreview] = useState(false)

  const [showGenerationModal, setShowGenerationModal] = useState(false)

  const [generationProgress, setGenerationProgress] = useState({

    step: '',

    percentage: 0,

    message: ''

  })

  const [selectedBlog, setSelectedBlog] = useState(null)

  const [showBlogModal, setShowBlogModal] = useState(false)

  const [showBlogPreview, setShowBlogPreview] = useState(false)

  const [currentPage, setCurrentPage] = useState(1)
  const [blogsPerPage] = useState(6)
  const [visibleBlogsCount, setVisibleBlogsCount] = useState(6) // For infinite scroll
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const [publishingBlogs, setPublishingBlogs] = useState(new Set())

  const [showPublishSuccess, setShowPublishSuccess] = useState(false)

  const [publishedBlogData, setPublishedBlogData] = useState(null)

  const [deletingBlogs, setDeletingBlogs] = useState(new Set())

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [blogToDelete, setBlogToDelete] = useState(null)

  const [generatingImages, setGeneratingImages] = useState(new Set())
  const [fullScreenImage, setFullScreenImage] = useState(null)
  const [uploadingImages, setUploadingImages] = useState(new Set())
  const [imageInputRefs, setImageInputRefs] = useState({})
  const [showImageOptionsModal, setShowImageOptionsModal] = useState(false)
  const [selectedBlogForImage, setSelectedBlogForImage] = useState(null)
  const [expandedPreviewImage, setExpandedPreviewImage] = useState(false)
  const [showCustomBlogChatbot, setShowCustomBlogChatbot] = useState(false)

  // AI Edit state
  const [showAIEditModal, setShowAIEditModal] = useState(false)
  const [aiEditInstruction, setAiEditInstruction] = useState('')
  const [aiEditing, setAiEditing] = useState(false)
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false)
  const [aiEditedContent, setAiEditedContent] = useState('')
  const [aiEditType, setAiEditType] = useState(null) // 'title' or 'content'
  
  // Manual Edit state for modal
  const [editingTitleInModal, setEditingTitleInModal] = useState(false)
  const [editingContentInModal, setEditingContentInModal] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [editContentValue, setEditContentValue] = useState('')
  const [savingModalEdit, setSavingModalEdit] = useState(false)



  const statusColors = {

    draft: 'bg-yellow-100 text-yellow-800',

    published: 'bg-green-100 text-green-800',

    scheduled: 'bg-blue-100 text-blue-800'

  }



  const statusIcons = {

    draft: Edit,

    published: CheckCircle,

    scheduled: Clock

  }



  useEffect(() => {

    console.log('BlogDashboard useEffect triggered')

    fetchData()

  }, [])



  // Update stats when blogs change

  useEffect(() => {

    // Only log when there's a significant change

    if (blogs.length > 0) {

      console.log('📊 BlogDashboard state updated:', { blogs: blogs.length, loading })

    }

    const newStats = calculateStats()

    setStats(newStats)

  }, [blogs])



  // Refetch data when component becomes visible (e.g., coming back from settings)

  useEffect(() => {

    const handleVisibilityChange = () => {

      if (!document.hidden) {

        console.log('Page became visible, refetching data...')

        fetchData()

      }

    }



    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Handle window resize for responsive width calculation
    const handleResize = () => {
      setWindowWidth(window.innerWidth)
    }
    
    window.addEventListener('resize', handleResize)
    // Set initial width
    handleResize()

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Handle ESC key to close full-screen image
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && fullScreenImage) {
        setFullScreenImage(null)
      }
    }
    if (fullScreenImage) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => document.removeEventListener('keydown', handleEscape)
  }, [fullScreenImage])



  const fetchData = async () => {

    try {

      setLoading(true)

      console.log('Fetching blog data...')

      
      
      // Fetch all blog data independently

      await Promise.all([

        fetchBlogs(),

        fetchStats(),

        fetchWordPressConnections() // Fetch WordPress connections separately

      ])

      console.log('Blog data fetched successfully')

    } catch (error) {

      console.error('Error fetching data:', error)

      
      
      // Handle authentication errors specifically

      if (error.message.includes('Authentication failed') || error.message.includes('Please log in')) {

        console.warn('Authentication error detected, user will be redirected to login')

        // Don't show error notification as user will be redirected

        return

      }

      
      
      showError('Error Loading Data', `Failed to load blog data: ${error.message}`)

    } finally {

      setLoading(false)

    }

  }



  const fetchBlogs = async () => {

    try {

      console.log('Fetching blogs...')

      const response = await blogService.getBlogs()

      console.log('Blogs response:', response)

      console.log('Setting blogs state with:', response.blogs || [])

      setBlogs(response.blogs || [])

    } catch (error) {

      console.error('Error fetching blogs:', error)

      console.error('Blog fetch error details:', error.message, error.stack)

      
      
      // Only show error if we don't have any blogs already

      if (blogs.length === 0) {

        showError('Error Fetching Blogs', `Failed to fetch blogs: ${error.message}`)

      } else {

        // If we have blogs, just log the error but don't show notification

        console.warn('Failed to refresh blogs, but keeping existing data')

      }

    }

  }






  const fetchStats = async () => {

    try {

      console.log('Fetching stats...')

      const response = await blogService.getBlogStats()

      console.log('Stats response:', response)

      console.log('Setting stats state with:', response.stats || {})

      setStats(response.stats || {})

    } catch (error) {

      console.error('Error fetching stats:', error)

      console.error('Stats fetch error details:', error.message, error.stack)

      // Set default stats if fetch fails

      setStats({

        total_blogs: 0,

        published_blogs: 0,

        draft_blogs: 0,

        scheduled_blogs: 0,


      })

      console.warn('Failed to fetch stats, using default values')

    }

  }



  // Calculate stats from actual blog data

  const calculateStats = () => {

    const totalBlogs = blogs.length

    const publishedBlogs = blogs.filter(blog => blog.status === 'published').length

    const draftBlogs = blogs.filter(blog => blog.status === 'draft').length

    const scheduledBlogs = blogs.filter(blog => blog.status === 'scheduled').length

    // Only log stats calculation when there are blogs

    if (totalBlogs > 0) {

      console.log('📊 Stats calculated:', {

        totalBlogs,

        publishedBlogs,

        draftBlogs,

        scheduledBlogs

      })

    }



    return {

      total_blogs: totalBlogs,

      published_blogs: publishedBlogs,

      draft_blogs: draftBlogs,

      scheduled_blogs: scheduledBlogs

    }

  }



  const fetchWordPressConnections = async () => {

    try {

      console.log('Fetching WordPress connections...')

      const response = await blogService.getWordPressSites()

      console.log('WordPress connections response:', response)

      console.log('Setting WordPress connections state with:', response || [])

      setWordpressConnections(response || [])

      return response || []

    } catch (error) {

      console.error('Error fetching WordPress connections:', error)

      console.error('WordPress connections fetch error details:', error.message, error.stack)

      // Don't show alert for WordPress connection errors - just log them

      console.log('WordPress connections not available, continuing without them')

      setWordpressConnections([])

      return []

    }

  }



  const generateBlogs = async () => {

    try {

      setGenerating(true)

      setShowGenerationModal(true)

      setGenerationProgress({

        step: 'Starting',

        percentage: 10,

        message: 'Initializing blog generation...'

      })

      
      
      // Clear console for fresh start

      console.clear()

      console.log('🚀 Starting blog generation...')

      
      
      // Simulate progress steps

      setGenerationProgress({

        step: 'Generating',

        percentage: 30,

        message: 'Creating amazing content for you...'

      })

      
      
      const result = await blogService.generateBlogs()

      
      
      setGenerationProgress({

        step: 'Finalizing',

        percentage: 80,

        message: 'Processing your new blogs...'

      })

      
      
      if (result.success) {

        console.log(`✅ SUCCESS! Blogs generated successfully!`)

        console.log('📊 New blogs:', result.blogs?.map(b => b.title) || [])

        
        
        // Refresh all data to show new blogs

        await fetchData()

        
        
        // Get the actual count from the refreshed data

        const actualBlogCount = result.total_blogs || 0

        
        
        setGenerationProgress({

          step: 'Complete',

          percentage: 100,

          message: 'Blogs generated successfully!'

        })

        
        
        // Close modal after a short delay

        setTimeout(() => {

          setShowGenerationModal(false)

          setGenerationProgress({

            step: '',

            percentage: 0,

            message: ''

          })

        }, 2000)
        
        
        
      } else {

        console.error(`❌ Blog generation failed: ${result.error}`)

        setGenerationProgress({

          step: 'Error',

          percentage: 0,

          message: result.error || 'Something went wrong while generating blogs.'

        })

        
        
        // Close modal after showing error

        setTimeout(() => {

          setShowGenerationModal(false)

          setGenerationProgress({

            step: '',

            percentage: 0,

            message: ''

          })

        }, 3000)

      }

    } catch (error) {

      console.error('❌ Error generating blogs:', error)

      setGenerationProgress({

        step: 'Error',

        percentage: 0,

        message: error.message || 'An unexpected error occurred.'

      })

      
      
      // Close modal after showing error

      setTimeout(() => {

        setShowGenerationModal(false)

        setGenerationProgress({

          step: '',

          percentage: 0,

          message: ''

        })

      }, 3000)

    } finally {

      setGenerating(false)

    }

  }



  // Helper function to strip HTML tags and convert to plain text
  const stripHtmlTags = (html) => {
    if (!html) return ''
    // Create a temporary div element
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    // Get text content and replace multiple spaces/newlines with single space
    let text = tmp.textContent || tmp.innerText || ''
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim()
    // Replace common HTML entities
    text = text.replace(/&nbsp;/g, ' ')
    text = text.replace(/&amp;/g, '&')
    text = text.replace(/&lt;/g, '<')
    text = text.replace(/&gt;/g, '>')
    text = text.replace(/&quot;/g, '"')
    text = text.replace(/&#39;/g, "'")
    return text
  }

  // Helper function to decode HTML entities and ensure proper HTML rendering
  // Similar to HTML Online Viewer - directly renders HTML without escaping
  const prepareHtmlContent = (content) => {
    if (!content || typeof content !== 'string') return ''
    
    // Trim whitespace
    let processedContent = content.trim()
    if (!processedContent) return ''
    
    // First, decode any double-encoded entities (like &amp;lt; should become <)
    processedContent = processedContent
      .replace(/&amp;lt;/g, '<')
      .replace(/&amp;gt;/g, '>')
      .replace(/&amp;amp;/g, '&')
      .replace(/&amp;quot;/g, '"')
      .replace(/&amp;#39;/g, "'")
      .replace(/&amp;nbsp;/g, ' ')
    
    // Check if content contains HTML tags (like <h1>, <p>, etc.)
    const hasHtmlTags = /<[a-z][a-z0-9]*[^>]*>/i.test(processedContent)
    
    if (hasHtmlTags) {
      // Content has HTML tags - decode standard HTML entities and return as-is
      // Decode entities manually to preserve HTML structure
      processedContent = processedContent
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
      
      // Return HTML as-is for rendering - don't process further
      return processedContent
    }
    
    // If content contains escaped HTML entities (like &lt; or &gt;)
    if (processedContent.includes('&lt;') || processedContent.includes('&gt;') || processedContent.includes('&amp;')) {
      // Decode HTML entities using browser's built-in decoder
      const tmp = document.createElement('div')
      tmp.innerHTML = processedContent
      const decodedContent = tmp.innerHTML
      
      // Check if decoded content now has HTML tags
      if (/<[a-z][a-z0-9]*[^>]*>/i.test(decodedContent)) {
        return decodedContent
      }
    }
    
    // If content is plain text, convert to HTML paragraphs
    return processedContent
      .split(/\n\n+/)
      .map(para => para.trim())
      .filter(para => para)
      .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
      .join('')
  }

  // Separate component to render HTML content using ref (bypasses React escaping)
  const BlogContentRenderer = ({ content }) => {
    const contentRef = useRef(null)
    
    useEffect(() => {
      if (contentRef.current && content) {
        const htmlContent = prepareHtmlContent(content)
        
        // Clear existing content first
        contentRef.current.innerHTML = ''
        
        // Directly set innerHTML to bypass React's escaping
        contentRef.current.innerHTML = htmlContent
      }
    }, [content])
    
    return (
      <div 
        ref={contentRef}
        className="prose prose-sm md:prose-lg max-w-none text-gray-700 leading-relaxed"
      />
    )
  }

  const handleEditBlog = (blog) => {

    setEditingBlog(blog)
    setTagsCategoriesManuallyEdited(false)
    setLastCheckedContent('')
    setLastCheckedTitle('')
    setContentManuallyEdited(false)
    setExcerptManuallyEdited(false)
    
    // Format scheduled date and time for input fields
    let scheduledDate = ''
    let scheduledTime = ''
    
    if (blog.scheduled_at) {
      const scheduledDateObj = new Date(blog.scheduled_at)
      // Format date as YYYY-MM-DD for date input
      scheduledDate = scheduledDateObj.toISOString().split('T')[0]
      // Format time as HH:MM for time input
      const hours = String(scheduledDateObj.getHours()).padStart(2, '0')
      const minutes = String(scheduledDateObj.getMinutes()).padStart(2, '0')
      scheduledTime = `${hours}:${minutes}`
    }
    
    // Preserve HTML structure for content (blogs use HTML for posting)
    // Users can see formatted version in preview mode, or edit HTML directly in textarea
    // Don't set lastCheckedContent here - let it stay empty so first change triggers update
    
    setEditForm({

      title: blog.title,

      content: blog.content, // Preserve HTML structure

      excerpt: blog.excerpt || '', // Keep excerpt as-is

      categories: blog.categories.join(', '),

      tags: blog.tags.join(', '),

      scheduled_date: scheduledDate,

      scheduled_time: scheduledTime

    })

  }



  const handleSaveEdit = async () => {

    try {

      setSaving(true)

      
      
      const updateData = {

        title: editForm.title,

        content: editForm.content,

        excerpt: editForm.excerpt,

        categories: editForm.categories.split(',').map(c => c.trim()).filter(c => c),

        tags: editForm.tags.split(',').map(t => t.trim()).filter(t => t)

      }

      // Add scheduled_at if date and time are provided
      if (editForm.scheduled_date && editForm.scheduled_time) {
        const scheduledDateTime = new Date(`${editForm.scheduled_date}T${editForm.scheduled_time}`)
        updateData.scheduled_at = scheduledDateTime.toISOString()
      } else if (editForm.scheduled_date) {
        // If only date is provided, use current time
        const scheduledDateTime = new Date(`${editForm.scheduled_date}T00:00`)
        updateData.scheduled_at = scheduledDateTime.toISOString()
      }

      await blogService.updateBlog(editingBlog.id, updateData)

      await fetchBlogs()

      setEditingBlog(null)

      setEditForm({ title: '', content: '', excerpt: '', categories: '', tags: '', scheduled_date: '', scheduled_time: '' })

    } catch (error) {

      console.error('Error updating blog:', error)

      showError('Error Updating Blog', `Failed to update blog: ${error.message}`)

    } finally {

      setSaving(false)

    }

  }



  const handleCancelEdit = () => {

    setEditingBlog(null)

    setEditForm({ title: '', content: '', excerpt: '', categories: '', tags: '', scheduled_date: '', scheduled_time: '' })
    setTagsCategoriesManuallyEdited(false)
    setLastCheckedContent('')

  }

  // Debounce hook for content changes
  const useDebounce = (value, delay) => {
    const [debouncedValue, setDebouncedValue] = useState(value)

    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value)
      }, delay)

      return () => {
        clearTimeout(handler)
      }
    }, [value, delay])

    return debouncedValue
  }

  const handleGenerateTagsCategories = async () => {
    if (!editForm.content || !editForm.content.trim()) {
      showError('Content Required', 'Please add content to the blog before generating tags and categories.')
      return
    }

    try {
      setGeneratingTagsCategories(true)
      
      const result = await blogService.generateTagsCategories(editForm.content, editForm.title)
      
      if (result.success) {
        // Update form with generated tags and categories
        const categories = result.categories || []
        const tags = result.tags || []
        
        setEditForm(prev => ({
          ...prev,
          categories: categories.join(', '),
          tags: tags.join(', ')
        }))
        
        setTagsCategoriesManuallyEdited(false) // Reset manual edit flag
        setLastCheckedContent(editForm.content) // Update last checked content
        
        showSuccess('Success', 'Tags and categories generated successfully!')
      } else {
        throw new Error(result.error || result.detail || 'Failed to generate tags and categories')
      }
    } catch (error) {
      console.error('Error generating tags and categories:', error)
      // Extract error message from different error formats
      let errorMessage = 'Failed to generate tags and categories. Please try again.'
      if (error.message) {
        errorMessage = error.message
      } else if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail
      } else if (error.detail) {
        errorMessage = error.detail
      }
      showError('Generation Failed', errorMessage)
    } finally {
      setGeneratingTagsCategories(false)
    }
  }

  // Debounce content changes (wait 2 seconds after user stops typing)
  const debouncedContent = useDebounce(editForm.content, 2000)

  // Auto-update tags and categories when content changes
  useEffect(() => {
    // Only auto-update if:
    // 1. We're in edit mode
    // 2. Content exists and is substantial (> 20 chars)
    // 3. User hasn't manually edited tags/categories
    // 4. Content actually changed (not initial load)
    // 5. We're not already updating
    if (
      editingBlog &&
      debouncedContent &&
      debouncedContent.trim().length > 20 &&
      !tagsCategoriesManuallyEdited &&
      debouncedContent !== lastCheckedContent &&
      !autoUpdatingTagsCategories
    ) {
      const autoUpdateTagsCategories = async () => {
        try {
          setAutoUpdatingTagsCategories(true)
          
          // Get existing categories and tags
          const existingCategories = editForm.categories
            ? editForm.categories.split(',').map(c => c.trim()).filter(c => c)
            : []
          const existingTags = editForm.tags
            ? editForm.tags.split(',').map(t => t.trim()).filter(t => t)
            : []
          
          // Check relevance if we have existing tags/categories
          if (existingCategories.length > 0 || existingTags.length > 0) {
            const relevanceResult = await blogService.checkTagsCategoriesRelevance(
              debouncedContent,
              editForm.title,
              existingCategories,
              existingTags
            )
            
            if (relevanceResult.success) {
              // Only update if majority are irrelevant (should_update = true)
              if (relevanceResult.should_update) {
                // Generate new tags and categories
                const generateResult = await blogService.generateTagsCategories(
                  debouncedContent,
                  editForm.title
                )
                
                if (generateResult.success) {
                  const categories = generateResult.categories || []
                  const tags = generateResult.tags || []
                  
                  setEditForm(prev => ({
                    ...prev,
                    categories: categories.join(', '),
                    tags: tags.join(', ')
                  }))
                  
                  setLastCheckedContent(debouncedContent)
                  console.log('Tags and categories auto-updated due to content change')
                }
              } else {
                // Content is still relevant, no update needed
                setLastCheckedContent(debouncedContent)
                console.log('Tags and categories are still relevant, no update needed')
              }
            }
          } else {
            // No existing tags/categories, generate new ones
            const generateResult = await blogService.generateTagsCategories(
              debouncedContent,
              editForm.title
            )
            
            if (generateResult.success) {
              const categories = generateResult.categories || []
              const tags = generateResult.tags || []
              
              setEditForm(prev => ({
                ...prev,
                categories: categories.join(', '),
                tags: tags.join(', ')
              }))
              
              setLastCheckedContent(debouncedContent)
              console.log('Tags and categories auto-generated for new content')
            }
          }
        } catch (error) {
          // Silently fail for auto-update (don't show error to user)
          console.error('Auto-update failed:', error)
          // Still update lastCheckedContent to prevent repeated attempts
          setLastCheckedContent(debouncedContent)
        } finally {
          setAutoUpdatingTagsCategories(false)
        }
      }
      
      autoUpdateTagsCategories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedContent, editForm.title, tagsCategoriesManuallyEdited, editingBlog])

  // Debounce title changes (wait 2 seconds after user stops typing)
  const debouncedTitle = useDebounce(editForm.title, 2000)

  // Auto-update content, excerpt, categories, and tags when title changes
  useEffect(() => {
    // Only auto-update if:
    // 1. We're in edit mode
    // 2. Title exists and is substantial (> 5 chars)
    // 3. User hasn't manually edited content/excerpt
    // 4. Title actually changed (not initial load)
    // 5. We're not already updating
    if (
      editingBlog &&
      debouncedTitle &&
      debouncedTitle.trim().length > 5 &&
      !contentManuallyEdited &&
      !excerptManuallyEdited &&
      debouncedTitle !== lastCheckedTitle &&
      !autoUpdatingFromTitle
    ) {
      const autoUpdateFromTitle = async () => {
        try {
          setAutoUpdatingFromTitle(true)
          
          // Generate new content, excerpt, categories, and tags based on title
          const result = await blogService.generateFromTitle(
            debouncedTitle,
            editForm.content, // Pass existing content as reference
            editForm.excerpt  // Pass existing excerpt as reference
          )
          
          if (result.success) {
            // Update form with generated content
            // Preserve HTML structure for content (blogs use HTML for posting)
            setEditForm(prev => ({
              ...prev,
              content: result.content || prev.content, // Keep HTML structure
              excerpt: result.excerpt || prev.excerpt, // Keep excerpt as plain text
              categories: (result.categories || []).join(', '),
              tags: (result.tags || []).join(', ')
            }))
            
            setLastCheckedTitle(debouncedTitle)
            setLastCheckedContent(debouncedTitle) // Update to prevent content-based update from triggering
            console.log('Blog content, excerpt, categories, and tags auto-updated from title')
          }
        } catch (error) {
          // Silently fail for auto-update (don't show error to user)
          console.error('Auto-update from title failed:', error)
          // Still update lastCheckedTitle to prevent repeated attempts
          setLastCheckedTitle(debouncedTitle)
        } finally {
          setAutoUpdatingFromTitle(false)
        }
      }
      
      autoUpdateFromTitle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle, editingBlog, contentManuallyEdited, excerptManuallyEdited])



  const handleBlogClick = (blog) => {

    setSelectedBlog(blog)

    setShowBlogModal(true)

  }



  const handleCloseBlogModal = () => {

    setSelectedBlog(null)

    setShowBlogModal(false)
    
    // Reset edit states
    setEditingTitleInModal(false)
    setEditingContentInModal(false)
    setEditTitleValue('')
    setEditContentValue('')

  }

  // AI Edit functions
  const handleAIEdit = (type) => {
    setAiEditType(type)
    setShowAIEditModal(true)
    setAiEditInstruction('')
  }

  const handleAISaveEdit = async () => {
    // Check if we're editing in the edit modal or the detail modal
    const currentBlog = editingBlog || selectedBlog
    if (!currentBlog || !aiEditInstruction.trim()) return

    // Validate instruction length
    if (aiEditInstruction.length > 500) {
      showError('Instruction too long', 'Please keep your instruction under 500 characters')
      return
    }

    try {
      setAiEditing(true)

      // Get the current text based on type and which modal we're in
      // For content, preserve HTML structure; for title/excerpt, use plain text
      let currentText = ''
      if (editingBlog) {
        // In edit modal, use editForm values
        if (aiEditType === 'title') {
          currentText = editForm.title || ''
        } else if (aiEditType === 'content') {
          // For content, we need to get the original HTML from the blog object
          // editingBlog should have the original content with HTML
          if (editingBlog.content && /<[a-z][a-z0-9]*[^>]*>/i.test(editingBlog.content)) {
            // Original has HTML, use that
            currentText = editingBlog.content
          } else {
            // Check if editForm.content has HTML (might have been pasted)
            if (editForm.content && /<[a-z][a-z0-9]*[^>]*>/i.test(editForm.content)) {
              currentText = editForm.content
            } else {
              // Plain text, use editForm value
              currentText = editForm.content || ''
            }
          }
        } else if (aiEditType === 'excerpt') {
          currentText = editForm.excerpt || ''
        }
      } else {
        // In detail modal, use selectedBlog values
        if (aiEditType === 'title') {
          currentText = selectedBlog.title || ''
        } else if (aiEditType === 'content') {
          // For content, preserve HTML structure
          currentText = selectedBlog.content || ''
        } else if (aiEditType === 'excerpt') {
          currentText = selectedBlog.excerpt || ''
        }
      }

      // Get auth token from blogService
      const authToken = await blogService.getAuthToken()
      
      // Get API URL
      const API_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const API_BASE_URL = API_URL.replace(/\/+$/, '')
      
      // Call blog-specific AI edit endpoint that preserves HTML
      const response = await fetch(`${API_BASE_URL}/api/blogs/ai/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          content: currentText,
          instruction: aiEditInstruction,
          edit_type: aiEditType
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Show confirmation modal with AI-edited content
        setAiEditedContent(result.edited_content)
        setShowAIEditModal(false)
        setShowAIConfirmModal(true)
      } else {
        throw new Error(result.error || result.detail || 'Failed to edit content with AI')
      }

    } catch (error) {
      console.error('Error editing blog with AI:', error)
      showError('Failed to edit blog with AI', error.message)
    } finally {
      setAiEditing(false)
    }
  }

  const handleCancelAIEdit = () => {
    setShowAIEditModal(false)
    setAiEditInstruction('')
    setAiEditType(null)
  }

  const handleAIConfirmSave = async () => {
    // Check if we're editing in the edit modal or the detail modal
    const currentBlog = editingBlog || selectedBlog
    if (!currentBlog || !aiEditedContent) return

    try {
      setSavingModalEdit(true)

      const updateData = {}
      if (aiEditType === 'title') {
        updateData.title = aiEditedContent
      } else if (aiEditType === 'content') {
        updateData.content = aiEditedContent
      } else if (aiEditType === 'excerpt') {
        updateData.excerpt = aiEditedContent
      }

      await blogService.updateBlog(currentBlog.id, updateData)

      // Update the blog in state
      const updatedBlog = { ...currentBlog, ...updateData }
      setBlogs(prev => prev.map(item => 
        item.id === currentBlog.id ? updatedBlog : item
      ))

      // Update the appropriate modal state
      if (editingBlog) {
        // Update editForm with the new value
        if (aiEditType === 'title') {
          setEditForm(prev => ({ ...prev, title: aiEditedContent }))
        } else if (aiEditType === 'content') {
          setEditForm(prev => ({ ...prev, content: aiEditedContent }))
        } else if (aiEditType === 'excerpt') {
          setEditForm(prev => ({ ...prev, excerpt: aiEditedContent }))
        }
        setEditingBlog(updatedBlog)
      } else {
        // Update the detail modal blog - keep modal open
        setSelectedBlog(updatedBlog)
      }

      // Close only the confirmation modal, keep the main modal open
      setShowAIConfirmModal(false)
      setAiEditedContent('')
      setAiEditInstruction('')
      setAiEditType(null)

      showSuccess('Success', 'Blog updated with AI assistance')

    } catch (error) {
      console.error('Error updating blog:', error)
      showError('Failed to update blog', error.message)
    } finally {
      setSavingModalEdit(false)
    }
  }

  const handleAIConfirmCancel = () => {
    setShowAIConfirmModal(false)
    setAiEditedContent('')
    setAiEditInstruction('')
    setAiEditType(null)
  }

  // Manual Edit functions for modal
  const handleManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(true)
      setEditTitleValue(selectedBlog.title || '')
    } else {
      setEditingContentInModal(true)
      setEditContentValue(selectedBlog.content || '')
    }
  }

  const handleSaveManualEdit = async (type) => {
    if (!selectedBlog) return

    try {
      setSavingModalEdit(true)

      const updateData = {}
      if (type === 'title') {
        updateData.title = editTitleValue
      } else {
        updateData.content = editContentValue
      }

      await blogService.updateBlog(selectedBlog.id, updateData)

      // Update the blog in state
      const updatedBlog = { ...selectedBlog, ...updateData }
      setBlogs(prev => prev.map(item => 
        item.id === selectedBlog.id ? updatedBlog : item
      ))

      // Update the modal blog
      setSelectedBlog(updatedBlog)

      // Reset edit states
      if (type === 'title') {
        setEditingTitleInModal(false)
        setEditTitleValue('')
      } else {
        setEditingContentInModal(false)
        setEditContentValue('')
      }

      showSuccess('Success', 'Blog updated successfully')

    } catch (error) {
      console.error('Error updating blog:', error)
      showError('Failed to update blog', error.message)
    } finally {
      setSavingModalEdit(false)
    }
  }

  const handleCancelManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(false)
      setEditTitleValue('')
    } else {
      setEditingContentInModal(false)
      setEditContentValue('')
    }
  }



  const handleReadMore = (blog) => {

    // Only for published blogs - redirect to actual blog URL
    // Get website_url from metadata first, then from direct field
    let websiteUrl = blog.metadata?.website_url || blog.website_url

    let blogUrl = blog.blog_url || websiteUrl

    
    
    // If no specific blog URL, try to construct it

    if (!blogUrl || blogUrl === websiteUrl) {

      if (blog.wordpress_post_id && websiteUrl) {

        // Use post ID format with proper URL
        blogUrl = `${websiteUrl.replace(/\/$/, '')}/?p=${blog.wordpress_post_id}`

      } else if (websiteUrl) {

        // Fallback to site URL
        blogUrl = websiteUrl

      } else if (blog.site_name) {

        // Last resort: construct from site_name (replace spaces with hyphens)
        const sanitizedSiteName = blog.site_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        blogUrl = `https://${sanitizedSiteName}.wordpress.com`

      }

    }

    
    
    if (blogUrl && blogUrl !== '#') {

      window.open(blogUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')

    } else {

      console.warn('No blog URL found for published blog:', blog)

    }

  }



  const handleCloseBlogPreview = () => {
    setSelectedBlog(null)
    setShowBlogPreview(false)
    setExpandedPreviewImage(false) // Reset expanded state when closing preview
  }



  const handlePublishBlog = async (blogId) => {
    try {
      // Add to publishing set to show loading state
      setPublishingBlogs(prev => new Set([...prev, blogId]))
      
      // Show detailed loading notification with steps
      showLoading('🚀 Publishing Your Blog', 'Connecting to WordPress and publishing your content...')
      
      // Simulate a small delay to show the loading state
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const response = await blogService.publishBlog(blogId)
      
      // Remove from publishing set
      setPublishingBlogs(prev => {
        const newSet = new Set(prev)
        newSet.delete(blogId)
        return newSet
      })
      
      // Refresh blogs to get updated status
      await fetchBlogs()
      
      // Check if image upload failed (only show error if status is 'failed', not 'embedded')
      if (response.image_status === 'failed') {
        showError('⚠️ Published Without Image', 'Blog was published successfully, but the featured image could not be embedded. Please check your image URL accessibility.')
      }
      
      // Set success data and show celebration popup
      setPublishedBlogData(response)
      setShowPublishSuccess(true)
      
      // Auto-hide success popup after 8 seconds (longer for better UX)
      setTimeout(() => {
        setShowPublishSuccess(false)
        setPublishedBlogData(null)
      }, 8000)
      
    } catch (error) {
      console.error('Error publishing blog:', error)
      
      // Remove from publishing set on error
      setPublishingBlogs(prev => {
        const newSet = new Set(prev)
        newSet.delete(blogId)
        return newSet
      })
      
      showError('❌ Publishing Failed', `Failed to publish blog: ${error.message}`)
    }
  }



  const handleDeleteBlog = (blog) => {
    setBlogToDelete(blog)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteBlog = async () => {
    if (!blogToDelete) return

    const blogId = blogToDelete.id

    // Add to deleting set
    setDeletingBlogs(prev => new Set(prev).add(blogId))

    // Close confirmation modal
    setShowDeleteConfirm(false)

    // Show loading notification and store its ID
    const loadingNotificationId = showLoading('Deleting Blog...', 'Please wait while we delete your blog post')

    try {
      await blogService.deleteBlog(blogId)
      
      // Remove the loading notification before showing success
      removeNotification(loadingNotificationId)
      
      // Refresh the blogs list
      await fetchBlogs()

      // Remove from deleting set
      setDeletingBlogs(prev => {
        const newSet = new Set(prev)
        newSet.delete(blogId)
        return newSet
      })

      // Show success notification with better styling
      showSuccess('Blog Deleted Successfully! 🗑️', 'Your blog post has been permanently removed from your account.')

    } catch (error) {
      console.error('Error deleting blog:', error)
      
      // Remove the loading notification on error
      removeNotification(loadingNotificationId)
      
      // Remove from deleting set on error
      setDeletingBlogs(prev => {
        const newSet = new Set(prev)
        newSet.delete(blogId)
        return newSet
      })
      
      // Show error notification with more details
      const errorMessage = error.response?.data?.detail || error.message || 'An unexpected error occurred'
      showError('Failed to Delete Blog', `Unable to delete blog: ${errorMessage}`)

    } finally {
      setBlogToDelete(null)
    }
  }

  const cancelDeleteBlog = () => {
    setShowDeleteConfirm(false)
    setBlogToDelete(null)
  }


  const handleCopyBlog = async (blog) => {
    try {
      const blogText = `Title: ${blog.title}\n\n${blog.content}`
      await navigator.clipboard.writeText(blogText)
      showSuccess('Blog Copied! 📋', 'Blog content has been copied to your clipboard!')
    } catch (error) {
      console.error('Error copying blog:', error)
      showError('Copy Failed', 'Failed to copy blog content to clipboard')
    }
  }

  const handleGenerateImage = async (blog, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    // Prevent generating images for published blogs
    if (blog.status === 'published') {
      showError('Cannot Generate Image', 'Image generation is not available for published blogs.')
      return
    }
    
    try {
      setGeneratingImages(prev => new Set(prev).add(blog.id))
      showLoading('Generating Image', 'Creating blog image with AI...')
      
      const response = await blogService.generateBlogImage(blog.id)
      
      if (response.success && response.image_url) {
        // Update the blog in the local state
        setBlogs(prevBlogs => 
          prevBlogs.map(b => 
            b.id === blog.id 
              ? {
                  ...b,
                  metadata: {
                    ...b.metadata,
                    featured_image: response.image_url,
                    image_generated_at: new Date().toISOString()
                  }
                }
              : b
          )
        )
        
        showSuccess('Image Generated! 🎨', 'Blog image has been generated successfully!')
      } else {
        showError('Image Generation Failed', 'Failed to generate blog image. Please try again.')
      }
    } catch (error) {
      console.error('Error generating blog image:', error)
      const errorMessage = error.message || 'Failed to generate blog image'
      showError('Image Generation Failed', errorMessage)
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(blog.id)
        return newSet
      })
      removeNotification()
    }
  }

  const handleDownloadImage = async (blog, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    const imageUrl = blog.metadata?.featured_image || blog.featured_image
    
    if (!imageUrl) {
      showError('No Image', 'This blog does not have an image to download. Please generate one first.')
      return
    }
    
    try {
      // Fetch the image
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      
      // Detect file extension from blob type or URL
      let fileExt = 'webp' // Default to webp since we're generating in webp format
      const contentType = blob.type
      
      if (contentType) {
        if (contentType.includes('webp')) {
          fileExt = 'webp'
        } else if (contentType.includes('png')) {
          fileExt = 'png'
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          fileExt = 'jpg'
        } else if (contentType.includes('gif')) {
          fileExt = 'gif'
        }
      } else {
        // Fallback: check URL for extension
        const urlLower = imageUrl.toLowerCase()
        if (urlLower.includes('.webp')) {
          fileExt = 'webp'
        } else if (urlLower.includes('.png')) {
          fileExt = 'png'
        } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
          fileExt = 'jpg'
        } else if (urlLower.includes('.gif')) {
          fileExt = 'gif'
        }
      }
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Create filename from blog title with correct extension
      const blogTitle = blog.title || 'blog-image'
      const sanitizedTitle = blogTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      link.download = `${sanitizedTitle}-${blog.id.substring(0, 8)}.${fileExt}`
      
      // Trigger download
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      showSuccess('Image Downloaded! 📥', 'Blog image has been downloaded successfully!')
    } catch (error) {
      console.error('Error downloading image:', error)
      showError('Download Failed', 'Failed to download image. Please try again.')
    }
  }

  const handleImageFileSelect = async (blog, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      showError('Invalid File Type', 'Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      showError('File Too Large', 'File size must be less than 5MB')
      return
    }

    // Upload the image
    try {
      setUploadingImages(prev => new Set(prev).add(blog.id))
      showLoading('Uploading Image', 'Please wait while we upload your image...')

      const formData = new FormData()
      formData.append('file', file)

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      // Use the blog-specific upload endpoint that uses the same bucket as generated images
      const response = await fetch(`${API_URL}/api/blogs/public/${blog.id}/upload-image`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
        throw new Error(error.detail || 'Failed to upload image')
      }

      const result = await response.json()
      if (result.success && result.image_url) {
        // The backend already updates the blog metadata, so we just need to update local state
        setBlogs(prevBlogs => 
          prevBlogs.map(b => 
            b.id === blog.id 
              ? {
                  ...b,
                  metadata: {
                    ...b.metadata,
                    featured_image: result.image_url,
                    image_uploaded_at: new Date().toISOString()
                  }
                }
              : b
          )
        )
        
        showSuccess('Image Uploaded! 📤', 'Blog image has been uploaded successfully!')
      } else {
        throw new Error('Upload failed - no image URL returned')
      }
    } catch (error) {
      console.error('Error uploading image:', error)
      showError('Upload Failed', error.message || 'Failed to upload image. Please try again.')
    } finally {
      setUploadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(blog.id)
        return newSet
      })
      removeNotification()
      // Reset file input
      if (imageInputRefs[blog.id]) {
        imageInputRefs[blog.id].value = ''
      }
    }
  }

  const handleUploadImageClick = (blog, e) => {
    if (e) {
      e.stopPropagation()
    }
    
    // Prevent for published blogs
    if (blog.status === 'published') {
      showError('Cannot Upload Image', 'Image upload is not available for published blogs.')
      return
    }

    // Create or get file input ref
    if (!imageInputRefs[blog.id]) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/jpg,image/png,image/gif,image/webp'
      input.style.display = 'none'
      input.onchange = (e) => handleImageFileSelect(blog, e)
      document.body.appendChild(input)
      setImageInputRefs(prev => ({ ...prev, [blog.id]: input }))
      input.click()
    } else {
      imageInputRefs[blog.id].click()
    }
  }

  const filteredBlogs = blogs.filter(blog => {

    const matchesStatus = selectedStatus === 'all' || blog.status === selectedStatus

    const matchesCampaign = selectedCampaign === 'all' || 

      (blog.metadata && blog.metadata.campaign_id === selectedCampaign)

    const matchesSearch = searchTerm === '' || 

      blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||

      blog.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
    
    
    
    return matchesStatus && matchesCampaign && matchesSearch

  })



  // Infinite scroll logic - show blogs incrementally
  const currentBlogs = filteredBlogs.slice(0, visibleBlogsCount)
  const hasMoreBlogs = visibleBlogsCount < filteredBlogs.length

  // Load more blogs when scrolling near bottom
  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled near bottom (within 200px)
      if (
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 200 &&
        hasMoreBlogs &&
        !isLoadingMore
      ) {
        setIsLoadingMore(true)
        // Load more blogs (add 6 more)
        setTimeout(() => {
          setVisibleBlogsCount(prev => Math.min(prev + 6, filteredBlogs.length))
          setIsLoadingMore(false)
        }, 300) // Small delay for smooth effect
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMoreBlogs, isLoadingMore, filteredBlogs.length, visibleBlogsCount])



  const handlePageChange = (page) => {

    setCurrentPage(page)

    window.scrollTo({ top: 0, behavior: 'smooth' })

  }



  // Reset visible blogs count when filters change
  useEffect(() => {
    setVisibleBlogsCount(6) // Reset to initial count
    setCurrentPage(1)
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedStatus, selectedCampaign, searchTerm])



  const formatDate = (dateString) => {
    if (!dateString) {
      return 'N/A'
    }
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return 'N/A'
      }
      return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
    } catch (e) {
      return 'N/A'
    }
  }



  const formatTime = (timeString) => {

    return new Date(timeString).toLocaleTimeString('en-US', {

      hour: '2-digit',

      minute: '2-digit'

    })

  }



  const getStatusIcon = (status) => {

    const Icon = statusIcons[status] || AlertCircle

    return <Icon className="w-4 h-4" />

  }



  // Remove the early return for loading - we'll handle it in the main content area



  // Check if WordPress connections exist - but don't block standalone mode

  const hasWordPressConnections = Array.isArray(wordpressConnections) && wordpressConnections.length > 0

  const isStandaloneMode = !hasWordPressConnections

  const isConnectionsLoading = wordpressConnections === undefined || wordpressConnections === null



  // Add error boundary fallback

  if (blogs === undefined || stats === undefined) {

    return (

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">

        <SideNavbar />

        <div className="ml-0 md:ml-48 xl:ml-64 p-4 md:p-6">

          <div className="text-center py-8 md:py-12">

            <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-red-500 mx-auto mb-4" />

            <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">Error Loading Blog Dashboard</h3>

            <p className="text-sm md:text-base text-gray-500 mb-6 px-4">There was an error loading the blog dashboard. Please try refreshing the page.</p>

            <button

              onClick={() => window.location.reload()}

              className="px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700"

            >

              Refresh Page

            </button>

          </div>

        </div>

      </div>

    )

  }



  console.log('BlogDashboard render state:', { 

    blogs: blogs.length, 

    loading, 

    stats,

    statsKeys: Object.keys(stats),

    statsValues: Object.values(stats)

  })



  return (

    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 overflow-x-hidden max-w-full">

      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={() => {}}
        handleGenerateContent={generateBlogs}
        generating={generating}
        fetchingFreshData={loading}
      />
      
      {/* Side Navbar */}
      <SideNavbar />

      {/* Main Content - No left margin on mobile, only on desktop */}
      <div 
        className="md:ml-48 xl:ml-64 flex flex-col min-h-screen overflow-x-hidden w-full" 
        style={{
          width: windowWidth >= 1280 ? 'calc(100vw - 256px)' : windowWidth >= 768 ? 'calc(100vw - 192px)' : '100%',
          maxWidth: windowWidth >= 1280 ? 'calc(100vw - 256px)' : windowWidth >= 768 ? 'calc(100vw - 192px)' : '100%',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div className="fixed top-[52px] md:top-0 right-0 left-0 md:left-48 xl:left-64 bg-gradient-to-r from-pink-50 to-purple-50 shadow-sm z-30 overflow-x-hidden max-w-full" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-2 md:px-6 lg:px-8 py-1.5 md:py-3 lg:py-4 overflow-x-hidden">
            {/* Single Row for ALL Devices */}
            <div className="flex items-center justify-between md:justify-between gap-0.5 md:gap-4 w-full overflow-x-hidden max-w-full">
              
              {/* Left Side - Heading */}
              <div className="flex items-center flex-shrink-0">
                <h1 className="text-base md:text-lg lg:text-xl font-bold text-gray-900">
                  The writer inside me
                </h1>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center gap-0.5 md:gap-3 flex-shrink-0 min-w-0">
                {/* Custom Blog Button */}
                <button
                  onClick={() => setShowCustomBlogChatbot(true)}
                  className="flex items-center justify-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-1.5 py-1.5 md:px-4 md:py-2 lg:px-6 lg:py-3 rounded-md md:rounded-lg lg:rounded-xl hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl h-8 w-8 md:w-auto md:h-auto flex-shrink-0"
                  title="Create Custom Blog"
                >
                  <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-5" />
                  <span className="hidden md:inline ml-2 text-sm lg:text-base">Custom Blog</span>
                </button>
                
                {/* Generate Button */}
                <button
                  onClick={generateBlogs}
                  disabled={generating}
                  className="flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 text-white px-1.5 py-1.5 md:px-4 md:py-2 lg:px-6 lg:py-3 rounded-md md:rounded-lg lg:rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl h-8 w-8 md:w-auto md:h-auto flex-shrink-0"
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 md:w-4 md:h-5" />
                  )}
                  <span className="hidden md:inline ml-2 text-sm lg:text-base">{generating ? 'Generating...' : 'Generate Blogs'}</span>
                </button>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-1 md:px-3 lg:px-4 py-1 md:py-2 text-[8px] md:text-sm border border-pink-200 rounded-md md:rounded-lg lg:rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm min-w-[45px] md:min-w-[100px] lg:min-w-[120px] flex-shrink-0 h-8 md:h-auto"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                </select>

                {/* Search */}
                <div className="relative min-w-0 flex-1 md:min-w-[150px] md:flex-none lg:min-w-[200px] xl:max-w-[250px] max-w-[100px] sm:max-w-[120px] md:max-w-none">
                  <Search className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 absolute left-2 md:left-3 top-1/2 transform -translate-y-1/2 text-pink-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-7 md:pl-9 lg:pl-10 pr-2 md:pr-3 lg:pr-4 py-1 md:py-2 text-[9px] md:text-sm border border-pink-200 rounded-md md:rounded-lg lg:rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm h-8 md:h-auto"
                  />
                </div>

                {/* View Mode Toggle - Hidden on mobile */}
                <div className="hidden md:flex border border-pink-200 rounded-md md:rounded-lg lg:rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm shadow-sm flex-shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1 md:p-1.5 lg:p-2 ${viewMode === 'grid' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'} h-8 md:h-auto`}
                  >
                    <BarChart3 className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1 md:p-1.5 lg:p-2 ${viewMode === 'list' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'} h-8 md:h-auto`}
                  >
                    <BookOpen className="w-3 h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4" />
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Main Content Area */}
        <div className="w-full px-2 md:px-2.5 lg:px-3 xl:px-4 overflow-x-hidden" style={{maxWidth: '100%', boxSizing: 'border-box'}}>
          <div className="pt-24 md:pt-28 pb-8">

          {filteredBlogs.length === 0 && !loading ? (

            <div className="p-6 md:p-12 text-center">

              <FileText className="w-12 h-12 md:w-16 md:h-16 text-gray-300 mx-auto mb-4" />

              <h3 className="text-base md:text-lg font-medium text-gray-900 mb-2">No blogs found</h3>

              <div className="text-sm md:text-base text-gray-500 mb-6">
                <p>Generate your first blog post to get started!</p>
              </div>

                <button

                  onClick={generateBlogs}

                  disabled={generating}

                  className="flex items-center px-4 md:px-6 py-2 md:py-3 text-sm md:text-base bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 mx-auto"

                >

                  {generating ? (

                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />

                  ) : (

                    <Plus className="w-5 h-5 mr-2" />

                  )}

                  {generating ? 'Generating...' : 'Generate Blogs'}

                </button>

                  </div>

          ) : (
            <>
              {/* Emily Message Bubble - Above blogs */}
              {(loading || blogs.length > 0) && (
                <div className="flex justify-start w-full px-4 mb-4">
                  <div className="flex items-start gap-2 max-w-[50%]">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">E</span>
                    </div>
                    <div className="bg-white rounded-lg px-4 py-3 shadow-md" style={{ boxShadow: '0 0 8px rgba(0, 0, 0, 0.15)' }}>
                      <p className="text-sm text-black">
                        {loading ? 'Loading my work...' : `Till now I have written ${blogs.length} blog${blogs.length !== 1 ? 's' : ''} for you`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div 

                data-testid="blogs-section"

                className={viewMode === 'grid' ? 'p-2 sm:p-3 md:p-3 lg:p-3 xl:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-2 md:gap-2.5 lg:gap-2.5 xl:gap-3 w-full box-border' : 'divide-y'}
                style={viewMode === 'grid' ? {maxWidth: '100%', width: '100%', boxSizing: 'border-box'} : {}}

              >

              {currentBlogs.map(blog => {

                const StatusIcon = statusIcons[blog.status] || AlertCircle

                
                
                return (

                  <div 

                    key={blog.id} 

                    className={`${viewMode === 'grid' ? 'bg-white rounded-lg sm:rounded-xl shadow-md sm:shadow-lg border border-gray-100 hover:shadow-xl hover:scale-[1.02] sm:hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer flex flex-col h-full w-full min-w-0' : 'bg-white'} p-0`}
                    style={viewMode === 'grid' ? {maxWidth: '100%', width: '100%', boxSizing: 'border-box'} : {}}

                    onClick={() => {

                      if (blog.status === 'published') {

                        // For published blogs, open the actual blog URL
                        // Get website_url from metadata first, then from direct field
                        let websiteUrl = blog.metadata?.website_url || blog.website_url

                        let blogUrl = blog.blog_url || websiteUrl

                        
                        
                        // If no specific blog URL, try to construct it

                        if (!blogUrl || blogUrl === websiteUrl) {

                          if (blog.wordpress_post_id && websiteUrl) {

                            // Use post ID format with proper URL
                            blogUrl = `${websiteUrl.replace(/\/$/, '')}/?p=${blog.wordpress_post_id}`

                          } else if (websiteUrl) {

                            // Fallback to site URL
                            blogUrl = websiteUrl

                          } else if (blog.site_name) {

                            // Last resort: construct from site_name (replace spaces with hyphens)
                            const sanitizedSiteName = blog.site_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                            blogUrl = `https://${sanitizedSiteName}.wordpress.com`

                          }

                        }

                        
                        
                        if (blogUrl && blogUrl !== '#') {

                          window.open(blogUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes')

                        } else {

                          console.warn('No blog URL found for published blog:', blog)

                        }

                      } else {
                        setSelectedBlog(blog)
                        setShowBlogPreview(true)
                      }

                    }}

                  >

                    {/* Blog Image Header */}

                    <div className="relative h-20 sm:h-24 md:h-28 lg:h-32 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 overflow-hidden flex-shrink-0">

                      {(blog.metadata?.featured_image || blog.featured_image) ? (
                        <img 
                          src={blog.metadata?.featured_image || blog.featured_image}
                          alt="Blog post image" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            // For unpublished blogs, show image options popup
                            // For published blogs, show full screen image
                            if (blog.status !== 'published') {
                              setSelectedBlogForImage(blog)
                              setShowImageOptionsModal(true)
                            } else {
                              setFullScreenImage(blog.metadata?.featured_image || blog.featured_image)
                            }
                          }}
                          onError={(e) => {
                            // Fallback to gradient if image fails to load
                            e.target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <>
                          <div 
                            className="w-full h-full cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              // For unpublished blogs, show image options popup
                              if (blog.status !== 'published') {
                                setSelectedBlogForImage(blog)
                                setShowImageOptionsModal(true)
                              }
                            }}
                          >
                            <img 

                              src={`https://images.unsplash.com/photo-${Math.random().toString(36).substr(2, 9)}?w=400&h=300&fit=crop&crop=face`}

                              alt="Blog post image" 

                              className="w-full h-full object-cover"

                            />

                            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 via-purple-500/80 to-blue-500/80"></div>
                            {/* Click hint for unpublished blogs without image */}
                            {blog.status !== 'published' && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all cursor-pointer group">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                                  Click to add image
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Click hint for unpublished blogs */}
                      {blog.status !== 'published' && (
                        <div className="absolute top-2 sm:top-3 md:top-4 left-2 sm:left-3 md:left-4 right-2 sm:right-3 md:right-4 flex items-center justify-end">
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all cursor-pointer group">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-medium">
                              Click to manage image
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="absolute bottom-2 sm:bottom-3 md:bottom-4 left-2 sm:left-3 md:left-4 right-2 sm:right-3 md:right-4">

                        <div className="flex items-center justify-between">

                          <div className="flex items-center space-x-1.5 sm:space-x-2 text-white/90">

                            <Globe className="w-3 h-3 sm:w-4 sm:h-4" />

                            <span className="text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-none">{blog.site_name || 'Unknown Site'}</span>

                          </div>

                          {blog.status === 'published' && (

                            <div className="flex items-center space-x-1 bg-green-500/80 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0">

                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-300 rounded-full animate-pulse"></div>

                              <span className="text-[10px] sm:text-xs font-medium text-white">LIVE</span>

                            </div>

                          )}

                        </div>

                      </div>

                    </div>



                    {/* Card Content */}

                    <div className="p-2 sm:p-2.5 md:p-3 flex-1 flex flex-col">

                      {/* Author and Meta Info */}

                      <div className="flex items-center justify-between mb-1 sm:mb-1.5">

                        <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0 flex-1">

                          <div className="w-4 h-4 sm:w-5 sm:h-5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-[9px] sm:text-[10px] flex-shrink-0">

                            A

                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">Admin</div>

                            <div className="text-[10px] sm:text-xs text-gray-500 truncate">

                              {blog.published_at ? formatDate(blog.published_at) : 
                               blog.scheduled_at ? formatDate(blog.scheduled_at) : 
                               formatDate(blog.created_at)}

                            </div>

                          </div>

                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-1.5 flex-shrink-0">

                          <div className="text-[10px] sm:text-xs bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">

                            {blog.reading_time || 5} min

                          </div>

                          <div className="text-gray-400 cursor-pointer hover:text-gray-600 hidden sm:block">

                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">

                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>

                            </svg>

                          </div>

                        </div>

                      </div>

                      
                      
                      {/* Blog Title */}

                      <h3 className="font-bold text-gray-900 text-xs sm:text-sm md:text-base mb-1 sm:mb-1.5 line-clamp-2 leading-tight">{blog.title}</h3>

                      
                      
                      {/* Blog Content Preview */}

                      <div className="mb-1 sm:mb-1.5 flex-1">

                        <p className="text-gray-600 text-[10px] sm:text-xs leading-snug line-clamp-2 sm:line-clamp-2">

                          {blog.excerpt || blog.meta_description || blog.content.substring(0, 150) + '...'}

                        </p>

                      </div>




                      {/* Card Footer with Stats and Actions */}

                      <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-gray-100 mt-auto">

                        {/* Status Badge */}
                        <div className="flex items-center">
                          <span className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] rounded-full ${statusColors[blog.status]} flex items-center space-x-1`}>
                            <StatusIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span className="capitalize font-medium">{blog.status}</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-1 sm:space-x-1.5 md:space-x-2 flex-shrink-0">

                          {/* Only show edit/publish buttons for non-published blogs */}

                          {blog.status !== 'published' && (

                            <>

                              <button

                                onClick={(e) => {

                                  e.stopPropagation()

                                  handleEditBlog(blog)

                                }}

                                className="p-2 sm:p-2.5 md:p-3 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"

                                title="Edit blog"

                              >

                                <Edit className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />

                              </button>

                              {(blog.status === 'draft' || blog.status === 'scheduled') && blog.wordpress_site_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePublishBlog(blog.id)
                                  }}
                                  disabled={publishingBlogs.has(blog.id)}
                                  className={`p-2 sm:p-2.5 md:p-3 rounded-lg transition-all duration-200 ${
                                    publishingBlogs.has(blog.id)
                                      ? 'text-green-600 bg-green-100 cursor-not-allowed animate-pulse'
                                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                  }`}
                                  title={publishingBlogs.has(blog.id) ? "Publishing to WordPress..." : "Publish to WordPress"}
                                >
                                  {publishingBlogs.has(blog.id) ? (
                                    <RefreshCw className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 animate-spin" />
                                  ) : (
                                  <Send className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
                                  )}
                                </button>
                              )}

                              {blog.status === 'draft' && !blog.wordpress_site_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyBlog(blog)
                                  }}
                                  className="p-2 sm:p-2.5 md:p-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Copy blog content"
                                >
                                  <Copy className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
                                </button>
                              )}

                            </>

                          )}


                          <button

                            onClick={(e) => {

                              e.stopPropagation()

                              handleDeleteBlog(blog)

                            }}

                            disabled={deletingBlogs.has(blog.id)}

                            className={`p-2 sm:p-2.5 md:p-3 rounded-lg transition-colors ${
                              deletingBlogs.has(blog.id) 
                                ? 'text-gray-300 cursor-not-allowed bg-gray-100' 
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}

                            title={deletingBlogs.has(blog.id) ? "Deleting..." : "Delete blog"}

                          >

                            {deletingBlogs.has(blog.id) ? (
                              <RefreshCw className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 animate-spin" />
                            ) : (
                            <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5" />
                            )}

                          </button>

                        </div>

                      </div>

                    </div>

                  </div>

                )

              })}

            </div>

          {/* Infinite Scroll Loading Indicator */}
          {hasMoreBlogs && (
            <div className="flex justify-center items-center py-8 mb-6">
              {isLoadingMore ? (
                <div className="flex items-center space-x-3 text-gray-600">
                  <RefreshCw className="w-5 h-5 animate-spin text-pink-500" />
                  <span className="text-sm font-medium">Loading more blogs...</span>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setIsLoadingMore(true)
                    setTimeout(() => {
                      setVisibleBlogsCount(prev => Math.min(prev + 6, filteredBlogs.length))
                      setIsLoadingMore(false)
                    }, 300)
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl font-medium text-sm"
                >
                  Load More Blogs
                </button>
              )}
            </div>
          )}

          {/* Emily Message Bubble - Below blogs */}
          {!loading && blogs.length > 0 && (
            <div className="flex justify-start w-full px-4 mt-4 mb-6">
              <div className="flex items-start gap-2 max-w-[50%]">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <div className="bg-white rounded-lg px-4 py-3 shadow-md" style={{ boxShadow: '0 0 8px rgba(0, 0, 0, 0.15)' }}>
                  <p className="text-sm text-black mb-3">
                    I'd be happy to help you create more content. What would you like to do today?
                  </p>
                  <div className="flex flex-col gap-2">
                    <div
                      onClick={() => setShowCustomBlogChatbot(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 cursor-pointer hover:underline"
                    >
                      Custom Blog: Share a topic with me, and I'll craft the content for you
                    </div>
                    <div
                      onClick={generateBlogs}
                      className={`text-sm text-purple-600 hover:text-purple-700 cursor-pointer hover:underline ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      Suggested Blog: I'll suggest topics and create the posts for you
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
            </>
          )}
          </div>

        </div>

      </div>



      {/* Edit Modal */}

      {editingBlog && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">

          <div className="bg-white rounded-lg p-4 md:p-6 w-full max-w-[640px] md:max-w-2xl lg:max-w-4xl mx-2 md:mx-4 max-h-[95vh] md:max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-4">

              <h3 className="text-base md:text-lg font-semibold text-gray-900">Edit Blog Post</h3>

              <button

                onClick={handleCancelEdit}

                className="text-gray-400 hover:text-gray-600"

              >

                <XCircle className="w-6 h-6" />

              </button>

            </div>

            
            
            <div className="space-y-4">

              <div>

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAIEdit('title')
                      }}
                      className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                      title="Edit with AI"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <input

                  type="text"

                  value={editForm.title}

                  onChange={(e) => {
                    setEditForm(prev => ({ ...prev, title: e.target.value }))
                    // Don't mark as manually edited - allow auto-update from title
                  }}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                />

              </div>

              
              
              <div>

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Excerpt</label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAIEdit('excerpt')
                      }}
                      className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                      title="Edit with AI"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <textarea

                  value={editForm.excerpt}

                  onChange={(e) => {
                    setEditForm(prev => ({ ...prev, excerpt: e.target.value }))
                    setExcerptManuallyEdited(true) // Mark as manually edited
                  }}

                  rows={3}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                />

              </div>

              
              
              <div>

                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Content</label>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowContentPreview(!showContentPreview)
                      }}
                      className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                      title={showContentPreview ? "Show HTML Editor" : "Show Preview"}
                    >
                      {showContentPreview ? (
                        <Edit className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAIEdit('content')
                      }}
                      className="p-1.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                      title="Edit with AI"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {showContentPreview ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white min-h-[250px] max-h-[500px] overflow-y-auto">
                    <div 
                      className="prose prose-sm md:prose-base max-w-none text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ 
                        __html: editForm.content 
                          ? (editForm.content.includes('<') 
                              ? editForm.content 
                              : editForm.content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>').replace(/^/, '<p>').replace(/$/, '</p>'))
                          : ''
                      }}
                    />
                  </div>
                ) : (
                  <textarea

                    value={editForm.content}

                    onChange={(e) => {
                      setEditForm(prev => ({ ...prev, content: e.target.value }))
                      setContentManuallyEdited(true) // Mark as manually edited
                    }}

                    rows={10}

                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"

                    placeholder="Enter your content here. You can use HTML tags for formatting if needed (e.g., &lt;h1&gt;, &lt;p&gt;, &lt;strong&gt;)..."

                  />
                )}

              </div>

              
              
              <div className="space-y-3 md:space-y-4">
                {/* Auto-update indicator */}
                <div className="flex items-center">
                  {autoUpdatingFromTitle && (
                    <div className="flex items-center text-xs text-purple-600">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      <span>Auto-updating content, excerpt, categories, and tags from title...</span>
                    </div>
                  )}
                  {autoUpdatingTagsCategories && !autoUpdatingFromTitle && (
                    <div className="flex items-center text-xs text-purple-600">
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                      <span>Auto-updating tags and categories...</span>
                    </div>
                  )}
                  {!autoUpdatingTagsCategories && !autoUpdatingFromTitle && (
                    <div className="text-xs text-gray-500">
                      Content, excerpt, categories, and tags update automatically when title or content changes
                    </div>
                  )}
                </div>
              
              <div className="grid grid-cols-1 min-[640px]:grid-cols-2 gap-3 md:gap-4">

                <div>

                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>

                  <input

                    type="text"

                    value={editForm.categories}

                      onChange={(e) => {
                        setEditForm(prev => ({ ...prev, categories: e.target.value }))
                        setTagsCategoriesManuallyEdited(true) // Mark as manually edited
                      }}

                    placeholder="Technology, Business, Lifestyle"

                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                  />

                </div>

                
                
                <div>

                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>

                  <input

                    type="text"

                    value={editForm.tags}

                      onChange={(e) => {
                        setEditForm(prev => ({ ...prev, tags: e.target.value }))
                        setTagsCategoriesManuallyEdited(true) // Mark as manually edited
                      }}

                    placeholder="AI, Marketing, Innovation"

                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                  />

                </div>

                </div>
              </div>

              {/* Schedule Date and Time */}
              <div className="grid grid-cols-1 min-[640px]:grid-cols-2 gap-3 md:gap-4 mt-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    value={editForm.scheduled_date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Schedule Time
                  </label>
                  <input
                    type="time"
                    value={editForm.scheduled_time}
                    onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
            </div>

            
            
            <div className="flex flex-row items-center justify-end gap-3 mt-6">

              <button

                onClick={handleCancelEdit}

                className="px-4 py-2 text-sm md:text-base text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors whitespace-nowrap"

              >

                Cancel

              </button>

              <button

                onClick={handleSaveEdit}

                disabled={saving}

                className="flex items-center justify-center space-x-2 px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"

              >

                <Save className="w-4 h-4" />

                <span>{saving ? 'Saving...' : 'Save Changes'}</span>

              </button>

            </div>

          </div>

        </div>

      )}



      {/* Blog Content Modal */}

      {showBlogModal && selectedBlog && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">

          <div className="bg-white rounded-lg w-full max-w-4xl mx-2 md:mx-4 max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col">

            {/* Modal Header */}

            <div className="flex items-center justify-between p-4 md:p-6 border-b">

              <div className="flex items-center space-x-2 md:space-x-3 flex-1 min-w-0">

                <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">

                  <FileText className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />

                </div>

                <div className="min-w-0 flex-1">

                  <div className="flex items-center justify-between gap-2">
                    {editingTitleInModal ? (
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editTitleValue}
                          onChange={(e) => setEditTitleValue(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 text-base md:text-xl font-semibold"
                          placeholder="Enter title"
                        />
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleSaveManualEdit('title')}
                            disabled={savingModalEdit}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-200 disabled:opacity-50"
                            title="Save"
                          >
                            {savingModalEdit ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCancelManualEdit('title')}
                            disabled={savingModalEdit}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-base md:text-xl font-semibold text-gray-900 truncate flex-1">{selectedBlog.title}</h2>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleManualEdit('title')
                            }}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                            title="Edit manually"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAIEdit('title')
                            }}
                            className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                            title="Edit with AI"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 mt-1">

                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[selectedBlog.status]} flex items-center space-x-1`}>

                      {(() => {

                        const StatusIcon = statusIcons[selectedBlog.status] || AlertCircle

                        return <StatusIcon className="w-3 h-3" />

                      })()}

                      <span className="capitalize">{selectedBlog.status}</span>

                    </span>

                    <span className="flex items-center text-xs text-gray-500">

                      <Globe className="w-3 h-3 mr-1" />

                      {selectedBlog.site_name || 'Unknown Site'}

                    </span>

                  </div>

                </div>

              </div>

              <button

                onClick={handleCloseBlogModal}

                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md flex-shrink-0"

              >

                <X className="w-5 h-5 md:w-6 md:h-6" />

              </button>

            </div>



            {/* Modal Content */}

            <div className="flex-1 overflow-y-auto p-4 md:p-6">

              {/* Blog Featured Image */}
              {(selectedBlog.metadata?.featured_image || selectedBlog.featured_image) && (
                <div className="mb-6">
                  <img 
                    src={selectedBlog.metadata?.featured_image || selectedBlog.featured_image}
                    alt="Blog featured image" 
                    className="w-full h-auto max-h-96 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                    onClick={() => setFullScreenImage(selectedBlog.metadata?.featured_image || selectedBlog.featured_image)}
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                </div>
              )}

              {/* Blog Metadata */}

              <div className="bg-gray-50 rounded-lg p-4 mb-6">

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">

                  <div>

                    <span className="font-medium text-gray-600">Scheduled:</span>

                    <p className="text-gray-800">{formatDate(selectedBlog.scheduled_at)} at {formatTime(selectedBlog.scheduled_at)}</p>

                  </div>

                  <div>

                    <span className="font-medium text-gray-600">Reading Time:</span>

                    <p className="text-gray-800">{selectedBlog.reading_time} min</p>

                  </div>

                  <div>

                    <span className="font-medium text-gray-600">Word Count:</span>

                    <p className="text-gray-800">{selectedBlog.word_count}</p>

                  </div>

                  <div>

                    <span className="font-medium text-gray-600">SEO Score:</span>

                    <p className="text-gray-800">{selectedBlog.seo_score}/100</p>

                  </div>

                </div>

              </div>



              {/* Categories and Tags */}

              {(selectedBlog.categories?.length > 0 || selectedBlog.tags?.length > 0) && (

                <div className="mb-6">

                  {selectedBlog.categories?.length > 0 && (

                    <div className="mb-3">

                      <h4 className="text-sm font-medium text-gray-600 mb-2">Categories</h4>

                      <div className="flex flex-wrap gap-2">

                        {selectedBlog.categories.map((category, index) => (

                          <span key={index} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">

                            {category}

                          </span>

                        ))}

                      </div>

                    </div>

                  )}

                  
                  
                  {selectedBlog.tags?.length > 0 && (

                    <div>

                      <h4 className="text-sm font-medium text-gray-600 mb-2">Tags</h4>

                      <div className="flex flex-wrap gap-2">

                        {selectedBlog.tags.map((tag, index) => (

                          <span key={index} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full">

                            #{tag}

                          </span>

                        ))}

                      </div>

                    </div>

                  )}

                </div>

              )}



              {/* Blog Content */}

              <div className="prose prose-lg max-w-none">

                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Content</h3>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleManualEdit('content')
                      }}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                      title="Edit manually"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAIEdit('content')
                      }}
                      className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                      title="Edit with AI"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {editingContentInModal ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContentValue}
                      onChange={(e) => setEditContentValue(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 resize-none"
                      rows={10}
                      placeholder="Enter content"
                    />
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleSaveManualEdit('content')}
                        disabled={savingModalEdit}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-200 disabled:opacity-50"
                        title="Save"
                      >
                        {savingModalEdit ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCancelManualEdit('content')}
                        disabled={savingModalEdit}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 disabled:opacity-50"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                  className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: prepareHtmlContent(selectedBlog.content || '') }}
                />
                )}

              </div>



              {/* Excerpt if available */}

              {selectedBlog.excerpt && (

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">

                  <h4 className="text-sm font-medium text-gray-600 mb-2">Excerpt</h4>

                  <p className="text-gray-700 text-sm leading-relaxed">{selectedBlog.excerpt}</p>

                </div>

              )}

            </div>



            {/* Modal Footer */}

            <div className="flex flex-row items-center justify-end gap-3 p-4 md:p-6 border-t bg-gray-50">

              <button

                onClick={handleCloseBlogModal}

                className="px-4 py-2 text-sm md:text-base text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"

              >

                Close

              </button>

              <button

                onClick={() => {

                  handleCloseBlogModal()

                  handleEditBlog(selectedBlog)

                }}

                className="px-4 py-2 text-sm md:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"

              >

                <Edit className="w-4 h-4" />

                <span>Edit Blog</span>

              </button>

            </div>

          </div>

        </div>

      )}

      {/* AI Edit Modal */}
      {showAIEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4"
          onClick={handleCancelAIEdit}
        >
          <div 
            className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Edit {aiEditType === 'title' ? 'Title' : aiEditType === 'excerpt' ? 'Excerpt' : 'Content'} with AI</h3>
                      <p className="text-sm text-gray-600">Provide instructions to modify the {aiEditType === 'title' ? 'title' : aiEditType === 'excerpt' ? 'excerpt' : 'content'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelAIEdit}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Current Content Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current {aiEditType === 'title' ? 'Title' : aiEditType === 'excerpt' ? 'Excerpt' : 'Content'}</label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {(() => {
                        if (editingBlog) {
                          if (aiEditType === 'title') return editForm.title || ''
                          if (aiEditType === 'excerpt') return editForm.excerpt || ''
                          return editForm.content || ''
                        } else {
                          if (aiEditType === 'title') return selectedBlog?.title || ''
                          // Strip HTML for content display in AI modal
                          return stripHtmlTags(selectedBlog?.content || '')
                        }
                      })()}
                    </div>
                  </div>
                  
                  {/* AI Instruction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Instruction <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={aiEditInstruction}
                        onChange={(e) => setAiEditInstruction(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        rows={5}
                        placeholder="Describe how you want the content to be modified..."
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {aiEditInstruction.length}/500
                      </div>
                    </div>
                    
                    {/* Instruction Examples */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">💡 Example instructions:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button
                          onClick={() => setAiEditInstruction("Make it more engaging and add relevant emojis")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          ✨ Make it more engaging
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Make it shorter and more concise")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          📝 Make it shorter
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Change the tone to be more professional")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          💼 Professional tone
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Add a call-to-action at the end")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          🎯 Add call-to-action
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancelAIEdit}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAISaveEdit}
                    disabled={aiEditing || !aiEditInstruction.trim() || aiEditInstruction.length > 500}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {aiEditing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>AI Editing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Edit with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}

      {/* AI Edit Confirmation Modal */}
      {showAIConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60] flex items-center justify-center p-4"
          onClick={handleAIConfirmCancel}
        >
          <div 
            className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
              {/* Header */}
              <div className="p-6 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">AI Edit Complete</h3>
                      <p className="text-sm text-gray-600">Review the AI-edited {aiEditType === 'title' ? 'title' : aiEditType === 'excerpt' ? 'excerpt' : 'content'} before saving</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAIConfirmCancel}
                    className="w-8 h-8 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Original Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Original {aiEditType === 'title' ? 'Title' : aiEditType === 'excerpt' ? 'Excerpt' : 'Content'}</label>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {(() => {
                        if (editingBlog) {
                          if (aiEditType === 'title') return editForm.title || ''
                          if (aiEditType === 'excerpt') return editForm.excerpt || ''
                          return editForm.content || ''
                        } else {
                          if (aiEditType === 'title') return selectedBlog?.title || ''
                          // Strip HTML for content display in AI confirmation modal
                          return stripHtmlTags(selectedBlog?.content || '')
                        }
                      })()}
                    </div>
                  </div>
                  
                  {/* AI Edited Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edited {aiEditType === 'title' ? 'Title' : aiEditType === 'excerpt' ? 'Excerpt' : 'Content'} <span className="text-pink-600">✨</span>
                    </label>
                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditedContent}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-purple-200">
                  <button
                    onClick={handleAIConfirmCancel}
                    className="px-4 py-2 text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-lg font-medium transition-colors"
                  >
                    Keep Original
                  </button>
                  <button
                    onClick={handleAIConfirmSave}
                    disabled={savingModalEdit}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {savingModalEdit ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
        </div>
      )}



      {/* Blog Generation Modal */}

      {showGenerationModal && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">

          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all duration-300 scale-100">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6">
            <div className="text-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  {generationProgress.step === 'Complete' ? (
                    <CheckCircle className="w-10 h-10 text-white" />
                  ) : generationProgress.step === 'Error' ? (
                    <XCircle className="w-10 h-10 text-white" />
                  ) : (
                    <RefreshCw className={`w-10 h-10 text-white ${generating ? 'animate-spin' : ''}`} />
                  )}
                </div>
                
                <h3 className="text-2xl font-bold mb-2">
                  {generationProgress.step === 'Complete' ? '🎉 Blogs Generated!' : 
                   generationProgress.step === 'Error' ? '❌ Generation Failed' : 
                   '✨ Generating Blogs'}
                </h3>
                
                <p className="text-white/90 text-sm">{generationProgress.message}</p>
              </div>
              </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Progress Bar */}
              {generationProgress.step !== 'Error' && (
                <div className="mb-6">
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-pink-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out relative"
                      style={{ width: `${generationProgress.percentage}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-pink-400 to-purple-500 rounded-full animate-pulse"></div>
                  </div>
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-sm font-medium text-gray-600">Progress</span>
                    <span className="text-sm font-bold text-pink-600">{generationProgress.percentage}%</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {generationProgress.step === 'Complete' && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowGenerationModal(false)
                      setGenerationProgress({ step: '', percentage: 0, message: '' })
                    }}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    🚀 View Your New Blogs
                  </button>
                </div>
              )}

              {generationProgress.step === 'Error' && (
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowGenerationModal(false)
                      setGenerationProgress({ step: '', percentage: 0, message: '' })
                    }}
                    className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 transition-all duration-300 font-semibold"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => generateBlogs()}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    🔄 Try Again
                  </button>
                </div>
              )}

              {/* Loading state */}
              {generationProgress.step !== 'Complete' && generationProgress.step !== 'Error' && (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center space-x-2 text-gray-600">
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-3">Please wait while we create amazing content for you...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      {/* Blog Preview Popup - Card Style */}

      {showBlogPreview && selectedBlog && (

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">

          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] md:max-h-[90vh] overflow-hidden shadow-2xl">

            {/* Popup Header */}

            <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-4 md:p-6">

              <div className="flex items-center justify-between gap-4">

                <div className="flex-1 min-w-0">

                  <h2 className="text-base md:text-xl font-bold mb-1 md:mb-2">Blog Preview</h2>

                  <p className="text-white/90 text-xs md:text-sm">Preview your blog content before publishing</p>

                </div>

                <button

                  onClick={handleCloseBlogPreview}

                  className="p-2 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"

                >

                  <X className="w-5 h-5 md:w-6 md:h-6" />

                </button>

              </div>

            </div>



            {/* Popup Content */}

            <div className="p-4 md:p-6 overflow-y-auto max-h-[calc(95vh-250px)] md:max-h-[calc(90vh-200px)]">

              {/* 1. Blog Image (if exists) */}
              {(selectedBlog.metadata?.featured_image || selectedBlog.featured_image) && (
                <div className="mb-6">
                  <div className={`relative ${expandedPreviewImage ? 'w-full h-[80vh] max-h-[800px]' : 'w-full h-64'} rounded-xl overflow-hidden shadow-lg transition-all duration-300`}>
                    <img 
                      src={selectedBlog.metadata?.featured_image || selectedBlog.featured_image} 
                      alt={selectedBlog.title}
                      className={`w-full h-full ${expandedPreviewImage ? 'object-contain' : 'object-cover'} transition-all duration-300`}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    {/* Status badge and site name - always visible */}
                    <div className="absolute top-4 left-4 z-10">
                      <span className="px-3 py-1 text-xs rounded-full bg-white/90 text-gray-800 font-medium">
                        {selectedBlog.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4 z-10">
                      <div className="flex items-center space-x-2 text-white/90 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-medium">{selectedBlog.site_name || 'Unknown Site'}</span>
                      </div>
                    </div>
                    
                    {/* Fullscreen button - bottom right corner (YouTube style) - toggles expand/collapse */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedPreviewImage(!expandedPreviewImage)
                      }}
                      className="absolute bottom-4 right-4 z-10 p-2.5 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm transition-all group"
                      title={expandedPreviewImage ? "Collapse image" : "Expand image"}
                    >
                      {expandedPreviewImage ? (
                        <Minimize2 className="w-5 h-5 text-white" />
                      ) : (
                        <Maximize2 className="w-5 h-5 text-white" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Full Blog Content (without scrolling) */}
              <div className="mb-6">
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                  {/* Blog Header */}
                  <div className="p-3 md:p-6 border-b border-gray-100">
                    <h1 className="text-base md:text-xl lg:text-2xl font-bold text-gray-900 mb-2 md:mb-3">{selectedBlog.title}</h1>
                    {selectedBlog.excerpt && (
                      <p className="text-gray-600 text-sm md:text-lg leading-relaxed">{selectedBlog.excerpt}</p>
                    )}
                  </div>
                  
                  {/* Blog Content */}
                  <div className="p-3 md:p-6">
                    <BlogContentRenderer content={selectedBlog.content || ''} />
                  </div>
                </div>
              </div>

              {/* 3. Insights and Categories */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-6">
                
                {/* Insights Section */}
                <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl p-3 md:p-6">
                  <h3 className="text-sm md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
                    <BarChart3 className="w-4 h-4 md:w-5 md:h-5 mr-2 text-pink-600" />
                    Blog Insights
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-2 md:gap-4">
                    <div className="text-center p-2 md:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-lg md:text-2xl font-bold text-pink-600">{selectedBlog.reading_time}</div>
                      <div className="text-xs md:text-sm text-gray-600">min read</div>
                        </div>
                    
                    <div className="text-center p-2 md:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-lg md:text-2xl font-bold text-purple-600">{selectedBlog.word_count}</div>
                      <div className="text-xs md:text-sm text-gray-600">words</div>
              </div>

                    <div className="text-center p-2 md:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-lg md:text-2xl font-bold text-blue-600">{selectedBlog.seo_score}</div>
                      <div className="text-xs md:text-sm text-gray-600">SEO score</div>
              </div>

                    <div className="text-center p-2 md:p-4 bg-white rounded-lg shadow-sm">
                      <div className="text-lg md:text-2xl font-bold text-gray-600">{formatDate(selectedBlog.scheduled_at)}</div>
                      <div className="text-xs md:text-sm text-gray-600">scheduled</div>
                  </div>
                  </div>
                  
                  {/* Additional insights */}
                  <div className="mt-3 md:mt-4 space-y-1 md:space-y-2">
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-gray-800">{selectedBlog.status}</span>
                  </div>
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="text-gray-600">Site:</span>
                      <span className="font-medium text-gray-800">{selectedBlog.site_name || 'Standalone'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs md:text-sm">
                      <span className="text-gray-600">Created:</span>
                      <span className="font-medium text-gray-800">{formatDate(selectedBlog.created_at)}</span>
                  </div>
                </div>
              </div>

                {/* Categories and Tags Section */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-3 md:p-6">
                  <h3 className="text-sm md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 flex items-center">
                    <Target className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" />
                    Categories & Tags
                  </h3>
                  
                  {/* Categories */}
                  {selectedBlog.categories?.length > 0 && (
                    <div className="mb-3 md:mb-6">
                      <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">Categories</h4>
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {selectedBlog.categories.map((category, index) => (
                          <span key={index} className="px-2 md:px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-pink-800 rounded-full text-xs md:text-sm font-medium">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Tags */}
                  {selectedBlog.tags?.length > 0 && (
                    <div>
                      <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1 md:gap-2">
                        {selectedBlog.tags.map((tag, index) => (
                          <span key={index} className="px-2 md:px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs md:text-sm font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* No categories/tags message */}
                  {(!selectedBlog.categories?.length && !selectedBlog.tags?.length) && (
                    <div className="text-center text-gray-500 py-4 md:py-8">
                      <Target className="w-6 h-6 md:w-8 md:h-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-xs md:text-sm">No categories or tags assigned</p>
                </div>
              )}
                </div>
            </div>

            </div>



            {/* Popup Footer */}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 md:p-6 bg-gray-50 border-t">

              <div className="text-xs md:text-sm text-gray-600 hidden sm:block">

                <span className="font-medium">Status:</span> {selectedBlog.status} • 

                <span className="font-medium ml-2">Scheduled:</span> {formatDate(selectedBlog.scheduled_at)} at {formatTime(selectedBlog.scheduled_at)}

              </div>

              <div className="text-xs text-gray-600 block sm:hidden w-full">

                <div><span className="font-medium">Status:</span> {selectedBlog.status}</div>

                <div className="mt-1"><span className="font-medium">Scheduled:</span> {formatDate(selectedBlog.scheduled_at)}</div>

              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">

                <button

                  onClick={() => {

                    handleCloseBlogPreview()

                    handleEditBlog(selectedBlog)

                  }}

                  className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 flex items-center justify-center space-x-2 whitespace-nowrap"

                >

                  <Edit className="w-4 h-4" />

                  <span className="hidden sm:inline">Edit Blog</span>

                  <span className="sm:hidden">Edit</span>

                </button>

                {(selectedBlog.status === 'draft' || selectedBlog.status === 'scheduled') && selectedBlog.wordpress_site_id && (
                  <button
                    onClick={() => {
                      handlePublishBlog(selectedBlog.id)
                      handleCloseBlogPreview()
                    }}
                    disabled={publishingBlogs.has(selectedBlog.id)}
                    className={`px-3 md:px-4 py-2 text-xs md:text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 whitespace-nowrap ${
                      publishingBlogs.has(selectedBlog.id)
                        ? 'bg-green-500 text-white cursor-not-allowed opacity-75 animate-pulse'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {publishingBlogs.has(selectedBlog.id) ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                    <Send className="w-4 h-4" />
                    )}
                    <span>{publishingBlogs.has(selectedBlog.id) ? 'Publishing...' : 'Publish'}</span>
                  </button>
                )}

                {selectedBlog.status === 'draft' && !selectedBlog.wordpress_site_id && (
                <button
                    onClick={() => {
                      handleCopyBlog(selectedBlog)
                      handleCloseBlogPreview()
                    }}
                    className="px-3 md:px-4 py-2 text-xs md:text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2 whitespace-nowrap"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                )}

              </div>

            </div>

          </div>

        </div>

      )}

      {/* Beautiful Success Popup */}
      {showPublishSuccess && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-lg mx-4 text-center transform animate-scale-in shadow-2xl border-4 border-green-200">
            {/* Success Animation */}
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-lg">
                <CheckCircle className="w-12 h-12 text-white" />
    </div>
              {/* Confetti Effect */}
              <div className="absolute -top-3 -left-3 w-6 h-6 bg-yellow-400 rounded-full animate-ping"></div>
              <div className="absolute -top-2 -right-4 w-5 h-5 bg-pink-400 rounded-full animate-ping animation-delay-200"></div>
              <div className="absolute -bottom-3 -left-2 w-5 h-5 bg-blue-400 rounded-full animate-ping animation-delay-400"></div>
              <div className="absolute -bottom-2 -right-3 w-6 h-6 bg-purple-400 rounded-full animate-ping animation-delay-600"></div>
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-2 w-4 h-4 bg-orange-400 rounded-full animate-ping animation-delay-800"></div>
            </div>

            {/* Success Message */}
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-gray-900 mb-3 flex items-center justify-center space-x-2">
                <Sparkles className="w-8 h-8 text-yellow-500" />
                <span>🎉 Blog Published Successfully!</span>
                <Sparkles className="w-8 h-8 text-yellow-500" />
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Your blog post has been published to WordPress and is now live! 🚀
              </p>
            </div>

            {/* Blog Details */}
            {publishedBlogData && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border border-green-200">
                <div className="flex items-center justify-center space-x-3 text-green-700 mb-4">
                  <Globe className="w-6 h-6" />
                  <span className="font-bold text-lg">Published to WordPress</span>
                </div>
                {publishedBlogData.blog_url && (
                  <a
                    href={publishedBlogData.blog_url || publishedBlogData.wordpress_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-lg font-medium underline decoration-2 underline-offset-2 hover:decoration-blue-800 transition-all duration-200 mb-3"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>View Published Post</span>
                  </a>
                )}
                {/* Image Status */}
                {publishedBlogData.image_status && (
                  <div className={`mt-3 p-3 rounded-lg ${
                    publishedBlogData.image_status === 'embedded' || publishedBlogData.image_status === 'attached'
                      ? 'bg-green-100 text-green-800' 
                      : publishedBlogData.image_status === 'failed'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <div className="flex items-center space-x-2">
                      {publishedBlogData.image_status === 'embedded' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Featured image embedded in content</span>
                        </>
                      ) : publishedBlogData.image_status === 'attached' ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Featured image attached successfully</span>
                        </>
                      ) : publishedBlogData.image_status === 'failed' ? (
                        <>
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Featured image upload failed - post published without image</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">No featured image to upload</span>
                        </>
                      )}
                    </div>
                    {/* Troubleshooting Note */}
                    {publishedBlogData.troubleshooting_note && (publishedBlogData.image_status === 'embedded' || publishedBlogData.image_status === 'attached') && (
                      <div className="mt-2 pt-2 border-t border-green-200">
                        <p className="text-xs text-green-700 leading-relaxed">
                          <strong>Note:</strong> {publishedBlogData.troubleshooting_note}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                onClick={() => {
                  setShowPublishSuccess(false)
                  setPublishedBlogData(null)
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
              >
                Close
              </button>
              {publishedBlogData?.blog_url && (
                <button
                  onClick={() => {
                    window.open(publishedBlogData.blog_url, '_blank')
                    setShowPublishSuccess(false)
                    setPublishedBlogData(null)
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  <span>View Post</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Beautiful Delete Confirmation Modal */}
      {showDeleteConfirm && blogToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl transform transition-all duration-300 scale-100">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-6 rounded-t-2xl">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Delete Blog Post</h3>
                  <p className="text-red-100 text-sm">This action cannot be undone</p>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 text-base leading-relaxed">
                  Are you sure you want to delete <strong>"{blogToDelete.title}"</strong>?
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  This will permanently remove the blog post and all its content from your account.
                </p>
              </div>

              {/* Blog Preview */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex items-start space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{blogToDelete.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {blogToDelete.word_count} words • {blogToDelete.reading_time} min read
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        blogToDelete.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {blogToDelete.status}
                      </span>
                      {blogToDelete.site_name && (
                        <span className="text-xs text-gray-500">
                          {blogToDelete.site_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={cancelDeleteBlog}
                  className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBlog}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 transition-all duration-200 font-medium shadow-sm hover:shadow-md flex items-center justify-center space-x-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Forever</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Options Modal */}
      {showImageOptionsModal && selectedBlogForImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4"
          onClick={() => {
            setShowImageOptionsModal(false)
            setSelectedBlogForImage(null)
          }}
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg p-3 sm:p-4 md:p-6 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
              <div className="flex-1 min-w-0 pr-2">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">Image Options</h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 line-clamp-2">{selectedBlogForImage.title}</p>
              </div>
              <button
                onClick={() => {
                  setShowImageOptionsModal(false)
                  setSelectedBlogForImage(null)
                }}
                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Image Preview */}
            {(selectedBlogForImage.metadata?.featured_image || selectedBlogForImage.featured_image) && (
              <div className="mb-4 sm:mb-5 md:mb-6 rounded-lg overflow-hidden">
                <img 
                  src={selectedBlogForImage.metadata?.featured_image || selectedBlogForImage.featured_image}
                  alt="Current blog image"
                  className="w-full h-32 sm:h-40 md:h-48 object-cover"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
              {/* 1. Manually Add/Upload Image Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowImageOptionsModal(false)
                  handleUploadImageClick(selectedBlogForImage, e)
                  setSelectedBlogForImage(null)
                }}
                disabled={uploadingImages.has(selectedBlogForImage.id)}
                className={`w-full flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-200 ${
                  uploadingImages.has(selectedBlogForImage.id)
                    ? 'bg-purple-100 text-purple-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {uploadingImages.has(selectedBlogForImage.id) ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium text-center truncate">{(selectedBlogForImage.metadata?.featured_image || selectedBlogForImage.featured_image) ? 'Replace Image' : 'Upload Image'}</span>
                  </>
                )}
              </button>

              {/* 2. Generate Image by AI Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowImageOptionsModal(false)
                  handleGenerateImage(selectedBlogForImage, e)
                  setSelectedBlogForImage(null)
                }}
                disabled={generatingImages.has(selectedBlogForImage.id)}
                className={`w-full flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl transition-all duration-200 ${
                  generatingImages.has(selectedBlogForImage.id)
                    ? 'bg-blue-100 text-blue-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 shadow-lg hover:shadow-xl'
                }`}
              >
                {generatingImages.has(selectedBlogForImage.id) ? (
                  <>
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium">Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <span className="text-sm sm:text-base font-medium">Generate by AI</span>
                  </>
                )}
              </button>

              {/* 3. Download Image Button - Only if image exists */}
              {(selectedBlogForImage.metadata?.featured_image || selectedBlogForImage.featured_image) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowImageOptionsModal(false)
                    handleDownloadImage(selectedBlogForImage, e)
                    setSelectedBlogForImage(null)
                  }}
                  className="w-full flex items-center justify-center space-x-2 sm:space-x-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg sm:rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className="text-sm sm:text-base font-medium">Download Image</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Image Viewer Modal */}
      {fullScreenImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[100] p-4"
          onClick={() => setFullScreenImage(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setFullScreenImage(null)}
              className="absolute top-4 right-4 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-all"
              title="Close (ESC)"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Download Button */}
            <button
              onClick={async (e) => {
                e.stopPropagation()
                try {
                  const response = await fetch(fullScreenImage)
                  const blob = await response.blob()
                  
                  // Detect file extension from blob type or URL
                  let fileExt = 'webp' // Default to webp since we're generating in webp format
                  const contentType = blob.type
                  
                  if (contentType) {
                    if (contentType.includes('webp')) {
                      fileExt = 'webp'
                    } else if (contentType.includes('png')) {
                      fileExt = 'png'
                    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
                      fileExt = 'jpg'
                    } else if (contentType.includes('gif')) {
                      fileExt = 'gif'
                    }
                  } else {
                    // Fallback: check URL for extension
                    const urlLower = fullScreenImage.toLowerCase()
                    if (urlLower.includes('.webp')) {
                      fileExt = 'webp'
                    } else if (urlLower.includes('.png')) {
                      fileExt = 'png'
                    } else if (urlLower.includes('.jpg') || urlLower.includes('.jpeg')) {
                      fileExt = 'jpg'
                    } else if (urlLower.includes('.gif')) {
                      fileExt = 'gif'
                    }
                  }
                  
                  const url = window.URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  
                  // Find the blog that has this image
                  const blog = blogs.find(b => 
                    (b.metadata?.featured_image || b.featured_image) === fullScreenImage
                  )
                  
                  if (blog) {
                    const blogTitle = blog.title || 'blog-image'
                    const sanitizedTitle = blogTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()
                    link.download = `${sanitizedTitle}-${blog.id.substring(0, 8)}.${fileExt}`
                  } else {
                    link.download = `blog-image-${Date.now()}.${fileExt}`
                  }
                  
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  window.URL.revokeObjectURL(url)
                  
                  showSuccess('Image Downloaded! 📥', 'Blog image has been downloaded successfully!')
                } catch (error) {
                  console.error('Error downloading image:', error)
                  showError('Download Failed', 'Failed to download image. Please try again.')
                }
              }}
              className="absolute top-4 right-20 z-10 p-3 bg-white/20 hover:bg-white/30 rounded-full backdrop-blur-sm transition-all"
              title="Download image"
            >
              <Download className="w-6 h-6 text-white" />
            </button>

            {/* Image */}
            <img 
              src={fullScreenImage}
              alt="Full screen blog image" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => {
                e.target.style.display = 'none'
                setFullScreenImage(null)
              }}
            />

            {/* Image Info */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm">
              Click outside or press ESC to close
            </div>
          </div>
        </div>
      )}

      {/* ESC key handler for full-screen image */}
      {fullScreenImage && (
        <div className="hidden">
          {/* This ensures the useEffect runs when fullScreenImage changes */}
        </div>
      )}

      {/* Custom Blog Chatbot */}
      <CustomBlogChatbot
        isOpen={showCustomBlogChatbot}
        onClose={() => setShowCustomBlogChatbot(false)}
        onBlogCreated={(blog) => {
          if (blog) {
            showSuccess('Blog Created', `Your custom blog "${blog.title}" has been created successfully!`)
            fetchBlogs() // Refresh the blog list
          }
        }}
      />

    </div>

  )

}



export default BlogDashboard

