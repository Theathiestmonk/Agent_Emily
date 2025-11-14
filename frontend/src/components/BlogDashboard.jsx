import React, { useState, useEffect, lazy, Suspense } from 'react'

import { useNotifications } from '../contexts/NotificationContext'
import { BlogSkeleton } from './LazyLoadingSkeleton'

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

  Download

} from 'lucide-react'

import { blogService } from '../services/blogs'

import SideNavbar from './SideNavbar'

import MainContentLoader from './MainContentLoader'

import MobileNavigation from './MobileNavigation'



const BlogDashboard = () => {

  console.log('BlogDashboard component rendering...')
  
  
  
  const { showSuccess, showError, showLoading, removeNotification } = useNotifications()

  const [blogs, setBlogs] = useState([])

  const [stats, setStats] = useState({})

  const [wordpressConnections, setWordpressConnections] = useState([])

  const [loading, setLoading] = useState(false)

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

    tags: ''

  })

  const [saving, setSaving] = useState(false)

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

  const [publishingBlogs, setPublishingBlogs] = useState(new Set())

  const [showPublishSuccess, setShowPublishSuccess] = useState(false)

  const [publishedBlogData, setPublishedBlogData] = useState(null)

  const [deletingBlogs, setDeletingBlogs] = useState(new Set())

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [blogToDelete, setBlogToDelete] = useState(null)

  const [generatingImages, setGeneratingImages] = useState(new Set())
  const [fullScreenImage, setFullScreenImage] = useState(null)



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

    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)

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



  const handleEditBlog = (blog) => {

    setEditingBlog(blog)
    
    setEditForm({

      title: blog.title,

      content: blog.content,

      excerpt: blog.excerpt,

      categories: blog.categories.join(', '),

      tags: blog.tags.join(', ')

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



      await blogService.updateBlog(editingBlog.id, updateData)

      await fetchBlogs()

      setEditingBlog(null)

      setEditForm({ title: '', content: '', excerpt: '', categories: '', tags: '' })

    } catch (error) {

      console.error('Error updating blog:', error)

      showError('Error Updating Blog', `Failed to update blog: ${error.message}`)

    } finally {

      setSaving(false)

    }

  }



  const handleCancelEdit = () => {

    setEditingBlog(null)

    setEditForm({ title: '', content: '', excerpt: '', categories: '', tags: '' })

  }



  const handleBlogClick = (blog) => {

    setSelectedBlog(blog)

    setShowBlogModal(true)

  }



  const handleCloseBlogModal = () => {

    setSelectedBlog(null)

    setShowBlogModal(false)

  }



  const handleReadMore = (blog) => {

    // Only for published blogs - redirect to actual blog URL

    let blogUrl = blog.blog_url || blog.website_url

    
    
    // If no specific blog URL, try to construct it

    if (!blogUrl || blogUrl === blog.website_url) {

      if (blog.wordpress_post_id) {

        // Use post ID format

        blogUrl = `${blog.website_url || `https://${blog.site_name}.wordpress.com`}/?p=${blog.wordpress_post_id}`

      } else {

        // Fallback to site URL

        blogUrl = blog.website_url || `https://${blog.site_name}.wordpress.com`

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
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // Create filename from blog title
      const blogTitle = blog.title || 'blog-image'
      const sanitizedTitle = blogTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      link.download = `${sanitizedTitle}-${blog.id.substring(0, 8)}.png`
      
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



  const filteredBlogs = blogs.filter(blog => {

    const matchesStatus = selectedStatus === 'all' || blog.status === selectedStatus

    const matchesCampaign = selectedCampaign === 'all' || 

      (blog.metadata && blog.metadata.campaign_id === selectedCampaign)

    const matchesSearch = searchTerm === '' || 

      blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||

      blog.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
    
    
    
    return matchesStatus && matchesCampaign && matchesSearch

  })



  // Pagination logic

  const totalPages = Math.ceil(filteredBlogs.length / blogsPerPage)

  const startIndex = (currentPage - 1) * blogsPerPage

  const endIndex = startIndex + blogsPerPage

  const currentBlogs = filteredBlogs.slice(startIndex, endIndex)



  const handlePageChange = (page) => {

    setCurrentPage(page)

    window.scrollTo({ top: 0, behavior: 'smooth' })

  }



  // Reset pagination when filters change

  useEffect(() => {

    setCurrentPage(1)

  }, [selectedStatus, selectedCampaign, searchTerm])



  const formatDate = (dateString) => {

    return new Date(dateString).toLocaleDateString('en-US', {

      year: 'numeric',

      month: 'short',

      day: 'numeric'

    })

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

    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">

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
      <div className="md:ml-48 xl:ml-64 flex flex-col min-h-screen w-full">
        {/* Header */}
        <div className="fixed top-[52px] md:top-0 right-0 left-0 md:left-48 xl:left-64 bg-gradient-to-r from-pink-50 to-purple-50 shadow-sm z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-2 md:px-6 lg:px-8 py-1.5 md:py-3 lg:py-4">
            {/* Single Row for ALL Devices */}
            <div className="flex items-center justify-between md:justify-between gap-0.5 md:gap-4 w-full overflow-x-auto">
              
              {/* Left Side - Stats */}
              <div className="flex items-center gap-0.5 md:gap-3 flex-shrink-0">
                {/* Total Blog Stats Card */}
                <div className="flex items-center space-x-0.5 md:space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 xl:px-4 xl:py-2.5 shadow-sm">
                  <div className="p-0.5 md:p-1 lg:p-1.5 bg-gradient-to-r from-pink-500 to-purple-600 rounded-md flex-shrink-0">
                    <FileText className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-5 xl:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-xs text-gray-600 whitespace-nowrap font-medium leading-tight">Total</p>
                    <p className="text-[9px] md:text-sm lg:text-base font-bold text-gray-900 whitespace-nowrap leading-tight">{calculateStats().total_blogs}</p>
                  </div>
                </div>

                {/* Published Stats Card */}
                <div className="flex items-center space-x-0.5 md:space-x-1 bg-white/80 backdrop-blur-sm rounded-lg px-1 md:px-1.5 py-0.5 md:py-1 lg:px-3 lg:py-2 xl:px-4 xl:py-2.5 shadow-sm">
                  <div className="p-0.5 md:p-1 lg:p-1.5 bg-gradient-to-r from-green-500 to-emerald-600 rounded-md flex-shrink-0">
                    <CheckCircle className="w-2.5 h-2.5 md:w-3 md:h-3 lg:w-4 lg:h-5 xl:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[7px] md:text-xs text-gray-600 whitespace-nowrap font-medium leading-tight">Published</p>
                    <p className="text-[9px] md:text-sm lg:text-base font-bold text-gray-900 whitespace-nowrap leading-tight">{calculateStats().published_blogs}</p>
                  </div>
                </div>
              </div>

              {/* Right Side - Actions */}
              <div className="flex items-center gap-0.5 md:gap-3 flex-shrink-0">
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
                <div className="relative min-w-0 flex-1 md:min-w-[150px] md:flex-none lg:min-w-[200px] xl:max-w-[250px] max-w-[120px] md:max-w-none">
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
        <div className="w-full px-3 md:px-6">
          <div className="pt-24 md:pt-28">

          {loading ? (

            <BlogSkeleton />

          ) : filteredBlogs.length === 0 ? (

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

            <div 

              data-testid="blogs-section"

              className={viewMode === 'grid' ? 'p-2 md:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6' : 'divide-y'}

            >

              {currentBlogs.map(blog => {

                const StatusIcon = statusIcons[blog.status] || AlertCircle

                
                
                return (

                  <div 

                    key={blog.id} 

                    className={`${viewMode === 'grid' ? 'bg-white rounded-xl shadow-lg border border-gray-100 hover:shadow-xl hover:scale-105 transition-all duration-300 overflow-hidden cursor-pointer' : 'bg-white'} p-0`}

                    onClick={() => {

                      if (blog.status === 'published') {

                        // For published blogs, open the actual blog URL

                        let blogUrl = blog.blog_url || blog.website_url

                        
                        
                        // If no specific blog URL, try to construct it

                        if (!blogUrl || blogUrl === blog.website_url) {

                          if (blog.wordpress_post_id) {

                            // Use post ID format

                            blogUrl = `${blog.website_url || `https://${blog.site_name}.wordpress.com`}/?p=${blog.wordpress_post_id}`

                          } else {

                            // Fallback to site URL

                            blogUrl = blog.website_url || `https://${blog.site_name}.wordpress.com`

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

                    <div className="relative h-44 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 overflow-hidden">

                      {(blog.metadata?.featured_image || blog.featured_image) ? (
                        <img 
                          src={blog.metadata?.featured_image || blog.featured_image}
                          alt="Blog post image" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFullScreenImage(blog.metadata?.featured_image || blog.featured_image)
                          }}
                          onError={(e) => {
                            // Fallback to gradient if image fails to load
                            e.target.style.display = 'none'
                          }}
                        />
                      ) : (
                        <>
                          <img 

                            src={`https://images.unsplash.com/photo-${Math.random().toString(36).substr(2, 9)}?w=400&h=300&fit=crop&crop=face`}

                            alt="Blog post image" 

                            className="w-full h-full object-cover"

                          />

                          <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 via-purple-500/80 to-blue-500/80"></div>
                        </>
                      )}

                      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                        <span className={`px-3 py-1 text-xs rounded-full ${statusColors[blog.status]} flex items-center space-x-1 backdrop-blur-sm`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="capitalize font-medium">{blog.status}</span>
                        </span>
                        
                        {/* Quick Generate Image Button on Image Area */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleGenerateImage(blog, e)
                          }}
                          disabled={generatingImages.has(blog.id)}
                          className={`p-2 rounded-lg backdrop-blur-sm transition-all duration-200 ${
                            generatingImages.has(blog.id)
                              ? 'text-blue-300 bg-blue-900/50 cursor-not-allowed'
                              : 'text-white/90 bg-black/30 hover:bg-black/50 hover:text-white'
                          }`}
                          title={generatingImages.has(blog.id) ? "Generating image..." : "Generate blog image with AI"}
                        >
                          {generatingImages.has(blog.id) ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <ImageIcon className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="absolute bottom-4 left-4 right-4">

                        <div className="flex items-center justify-between">

                          <div className="flex items-center space-x-2 text-white/90">

                            <Globe className="w-4 h-4" />

                            <span className="text-sm font-medium">{blog.site_name || 'Unknown Site'}</span>

                          </div>

                          {blog.status === 'published' && (

                            <div className="flex items-center space-x-1 bg-green-500/80 backdrop-blur-sm px-2 py-1 rounded-full">

                              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>

                              <span className="text-xs font-medium text-white">LIVE</span>

                            </div>

                          )}

                        </div>

                      </div>

                    </div>



                    {/* Card Content */}

                    <div className="p-5">

                      {/* Author and Meta Info */}

                      <div className="flex items-center justify-between mb-4">

                        <div className="flex items-center space-x-3">

                          <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-xs">

                            A

                          </div>

                          <div>

                            <div className="text-base font-semibold text-gray-900">Admin</div>

                            <div className="text-sm text-gray-500">

                              {blog.published_at ? formatDate(blog.published_at) : formatDate(blog.scheduled_at)}

                            </div>

                          </div>

                        </div>

                        <div className="flex items-center space-x-2">

                          <div className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full">

                            {blog.reading_time || 5} min read

                          </div>

                          <div className="text-gray-400 cursor-pointer hover:text-gray-600">

                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">

                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>

                            </svg>

                          </div>

                        </div>

                      </div>

                      
                      
                      {/* Blog Title */}

                      <h3 className="font-bold text-gray-900 text-lg mb-3 line-clamp-2 leading-tight">{blog.title}</h3>

                      
                      
                      {/* Blog Content Preview */}

                      <div className="mb-4">

                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-2">

                          {blog.excerpt || blog.meta_description || blog.content.substring(0, 150) + '...'}

                        </p>

                      </div>

                      
                      
                      {/* Categories and Tags */}

                      <div className="mb-4">

                        <div className="flex flex-wrap gap-2">

                          {blog.categories && blog.categories.map((category, index) => (

                            <span key={index} className="text-xs bg-gradient-to-r from-pink-100 to-purple-100 text-pink-800 px-3 py-1 rounded-full font-medium">

                              {category}

                            </span>

                          ))}

                        </div>

                      </div>



                      {/* Card Footer with Stats and Actions */}

                      <div className="flex items-center justify-between pt-4 border-t border-gray-100">

                        {blog.status === 'published' ? (

                          <div className="flex items-center space-x-3">

                            <div className="flex items-center space-x-2 text-gray-500">

                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />

                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />

                              </svg>

                              <span className="text-sm font-medium">{Math.floor(Math.random() * 5000) + 1000} views</span>

                            </div>

                            <div className="flex items-center space-x-2 text-gray-500">

                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />

                              </svg>

                              <span className="text-sm font-medium">{Math.floor(Math.random() * 100) + 10}</span>

                            </div>

                          </div>

                        ) : (

                          <div></div>

                        )}

                        <div className="flex items-center space-x-3">

                          {/* Only show edit/publish buttons for non-published blogs */}

                          {blog.status !== 'published' && (

                            <>

                              <button

                                onClick={(e) => {

                                  e.stopPropagation()

                                  handleEditBlog(blog)

                                }}

                                className="p-3 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded-lg transition-colors"

                                title="Edit blog"

                              >

                                <Edit className="w-5 h-5" />

                              </button>

                              {blog.status === 'draft' && blog.wordpress_site_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePublishBlog(blog.id)
                                  }}
                                  disabled={publishingBlogs.has(blog.id)}
                                  className={`p-3 rounded-lg transition-all duration-200 ${
                                    publishingBlogs.has(blog.id)
                                      ? 'text-green-600 bg-green-100 cursor-not-allowed animate-pulse'
                                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                  }`}
                                  title={publishingBlogs.has(blog.id) ? "Publishing to WordPress..." : "Publish to WordPress"}
                                >
                                  {publishingBlogs.has(blog.id) ? (
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                  ) : (
                                  <Send className="w-5 h-5" />
                                  )}
                                </button>
                              )}

                              {blog.status === 'draft' && !blog.wordpress_site_id && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyBlog(blog)
                                  }}
                                  className="p-3 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                  title="Copy blog content"
                                >
                                  <Copy className="w-5 h-5" />
                                </button>
                              )}

                            </>

                          )}

                          {/* Generate Image Button - Always visible for all blogs */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleGenerateImage(blog, e)
                            }}
                            disabled={generatingImages.has(blog.id)}
                            className={`p-3 rounded-lg transition-all duration-200 ${
                              generatingImages.has(blog.id)
                                ? 'text-blue-600 bg-blue-100 cursor-not-allowed animate-pulse'
                                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={generatingImages.has(blog.id) ? "Generating image..." : "Generate blog image with AI"}
                          >
                            {generatingImages.has(blog.id) ? (
                              <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                              <ImageIcon className="w-5 h-5" />
                            )}
                          </button>

                          {/* Download Image Button - Show only when image exists */}
                          {(blog.metadata?.featured_image || blog.featured_image) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownloadImage(blog, e)
                              }}
                              className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Download blog image"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          )}

                          <button

                            onClick={(e) => {

                              e.stopPropagation()

                              handleDeleteBlog(blog)

                            }}

                            disabled={deletingBlogs.has(blog.id)}

                            className={`p-3 rounded-lg transition-colors ${
                              deletingBlogs.has(blog.id) 
                                ? 'text-gray-300 cursor-not-allowed bg-gray-100' 
                                : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            }`}

                            title={deletingBlogs.has(blog.id) ? "Deleting..." : "Delete blog"}

                          >

                            {deletingBlogs.has(blog.id) ? (
                              <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                            <Trash2 className="w-5 h-5" />
                            )}

                          </button>

                        </div>

                      </div>

                    </div>

                  </div>

                )

              })}

            </div>

          )}



          {/* Pagination */}

          {totalPages > 1 && (

            <div className="flex flex-wrap justify-center items-center gap-2 mt-6 md:mt-8 mb-4 md:mb-6 px-4">

              <button

                onClick={() => handlePageChange(currentPage - 1)}

                disabled={currentPage === 1}

                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-white/80 backdrop-blur-sm border border-pink-200 rounded-xl text-gray-700 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"

              >

                ← Prev

              </button>

              
              
              <div className="flex flex-wrap gap-1 max-w-full">

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (

                  <button

                    key={page}

                    onClick={() => handlePageChange(page)}

                    className={`px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-300 min-w-[40px] ${

                      currentPage === page

                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'

                        : 'bg-white/80 backdrop-blur-sm border border-pink-200 text-gray-700 hover:bg-pink-50 shadow-sm'

                    }`}

                  >

                    {page}

                  </button>

                ))}

        </div>

              
              
              <button

                onClick={() => handlePageChange(currentPage + 1)}

                disabled={currentPage === totalPages}

                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-white/80 backdrop-blur-sm border border-pink-200 rounded-xl text-gray-700 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"

              >

                Next →

              </button>

            </div>

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

                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>

                <input

                  type="text"

                  value={editForm.title}

                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                />

              </div>

              
              
              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt</label>

                <textarea

                  value={editForm.excerpt}

                  onChange={(e) => setEditForm(prev => ({ ...prev, excerpt: e.target.value }))}

                  rows={3}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                />

              </div>

              
              
              <div>

                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>

                <textarea

                  value={editForm.content}

                  onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}

                  rows={10}

                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                />

              </div>

              
              
              <div className="grid grid-cols-1 min-[640px]:grid-cols-2 gap-3 md:gap-4">

                <div>

                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>

                  <input

                    type="text"

                    value={editForm.categories}

                    onChange={(e) => setEditForm(prev => ({ ...prev, categories: e.target.value }))}

                    placeholder="Technology, Business, Lifestyle"

                    className="w-full px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

                  />

                </div>

                
                
                <div>

                  <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>

                  <input

                    type="text"

                    value={editForm.tags}

                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}

                    placeholder="AI, Marketing, Innovation"

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

                  <h2 className="text-base md:text-xl font-semibold text-gray-900 truncate">{selectedBlog.title}</h2>

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

                <h3 className="text-lg font-semibold text-gray-900 mb-4">Content</h3>

                <div 

                  className="text-gray-700 leading-relaxed whitespace-pre-wrap"

                  dangerouslySetInnerHTML={{ __html: selectedBlog.content.replace(/\n/g, '<br>') }}

                />

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
                  <div className="relative w-full h-64 rounded-xl overflow-hidden shadow-lg">
                    <img 
                      src={selectedBlog.metadata?.featured_image || selectedBlog.featured_image} 
                      alt={selectedBlog.title}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setFullScreenImage(selectedBlog.metadata?.featured_image || selectedBlog.featured_image)}
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 text-xs rounded-full bg-white/90 text-gray-800 font-medium">
                        {selectedBlog.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="absolute top-4 right-4">
                      <div className="flex items-center space-x-2 text-white/90 bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-medium">{selectedBlog.site_name || 'Unknown Site'}</span>
                      </div>
                    </div>
                    {/* Click hint overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/10 transition-all cursor-pointer group">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm font-medium">
                        Click to view full screen
                      </div>
                    </div>
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
                    <div 
                      className="prose prose-sm md:prose-lg max-w-none text-gray-700 leading-relaxed text-sm md:text-base"
                      dangerouslySetInnerHTML={{ __html: selectedBlog.content.replace(/\n/g, '<br>') }}
                                  />
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

                {selectedBlog.status === 'draft' && selectedBlog.wordpress_site_id && (
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
                    href={publishedBlogData.blog_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 text-lg font-medium underline decoration-2 underline-offset-2 hover:decoration-blue-800 transition-all duration-200"
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>View Published Post</span>
                  </a>
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
                    link.download = `${sanitizedTitle}-${blog.id.substring(0, 8)}.png`
                  } else {
                    link.download = `blog-image-${Date.now()}.png`
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

    </div>

  )

}



export default BlogDashboard

