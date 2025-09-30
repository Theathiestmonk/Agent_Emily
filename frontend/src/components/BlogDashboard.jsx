import React, { useState, useEffect } from 'react'
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
  X
} from 'lucide-react'
import { blogService } from '../services/blogs'
import SideNavbar from './SideNavbar'
import MainContentLoader from './MainContentLoader'

const BlogDashboard = () => {
  console.log('BlogDashboard component rendering...')
  
  const { showSuccess, showError, showLoading } = useNotifications()
  const [blogs, setBlogs] = useState([])
  const [campaigns, setCampaigns] = useState([])
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

  // Update stats when blogs or campaigns change
  useEffect(() => {
    // Only log when there's a significant change
    if (blogs.length > 0 || campaigns.length > 0) {
      console.log('📊 BlogDashboard state updated:', { blogs: blogs.length, campaigns: campaigns.length, loading })
    }
    const newStats = calculateStats()
    setStats(newStats)
  }, [blogs, campaigns])

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

  const fetchData = async () => {
    try {
      setLoading(true)
      console.log('Fetching blog data...')
      
      // Fetch all blog data independently
      await Promise.all([
        fetchBlogs(),
        fetchCampaigns(),
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

  const fetchCampaigns = async () => {
    try {
      console.log('Fetching campaigns...')
      const response = await blogService.getCampaigns()
      console.log('Campaigns response:', response)
      console.log('Setting campaigns state with:', response.campaigns || [])
      setCampaigns(response.campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      console.error('Campaigns fetch error details:', error.message, error.stack)
      // Don't show error for campaigns as it's not critical
      console.warn('Failed to fetch campaigns, continuing without them')
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
        total_campaigns: 0
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
    const totalCampaigns = campaigns.length

    // Only log stats calculation when there are blogs
    if (totalBlogs > 0) {
      console.log('📊 Stats calculated:', {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
        scheduledBlogs,
        totalCampaigns
      })
    }

    return {
      total_blogs: totalBlogs,
      published_blogs: publishedBlogs,
      draft_blogs: draftBlogs,
      scheduled_blogs: scheduledBlogs,
      total_campaigns: totalCampaigns
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
      await blogService.publishBlog(blogId)
      await fetchBlogs()
      showSuccess('Blog Published! 🎉', 'Your blog has been published successfully!')
    } catch (error) {
      console.error('Error publishing blog:', error)
      showError('Error Publishing Blog', `Failed to publish blog: ${error.message}`)
    }
  }

  const handleDeleteBlog = async (blogId) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) {
      return
    }

    try {
      await blogService.deleteBlog(blogId)
      await fetchBlogs()
      showSuccess('Blog Deleted! 🗑️', 'Your blog has been deleted successfully!')
    } catch (error) {
      console.error('Error deleting blog:', error)
      showError('Error Deleting Blog', `Failed to delete blog: ${error.message}`)
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

  // Check if WordPress connections exist - show message in main content area
  const showWordPressConnectionMessage = !wordpressConnections || wordpressConnections.length === 0

  // Add error boundary fallback
  if (blogs === undefined || campaigns === undefined || stats === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
        <SideNavbar />
        <div className="ml-64 p-6">
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Blog Dashboard</h3>
            <p className="text-gray-500 mb-6">There was an error loading the blog dashboard. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
    campaigns: campaigns.length, 
    loading, 
    stats,
    statsKeys: Object.keys(stats),
    statsValues: Object.values(stats)
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
      {/* Side Navbar */}
      <SideNavbar />

      {/* Main Content */}
      <div className="ml-64 p-6">
        {/* Header */}
        <div className="fixed top-0 right-0 left-64 bg-gradient-to-r from-pink-50 to-purple-50 shadow-lg border-b border-pink-200 z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-8">
                {/* Stats Cards in Header */}
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm">
                    <div className="p-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Blogs</p>
                      <p className="text-xl font-bold text-gray-900">{calculateStats().total_blogs}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm">
                    <div className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Published</p>
                      <p className="text-xl font-bold text-gray-900">{calculateStats().published_blogs}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm">
                    <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                      <Target className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Campaigns</p>
                      <p className="text-xl font-bold text-gray-900">{calculateStats().total_campaigns}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={generateBlogs}
                  disabled={generating}
                  className="flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl"
                >
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{generating ? 'Generating...' : 'Generate Blogs'}</span>
                </button>
                
                {/* Filter and View Controls */}
                <div className="flex items-center space-x-4">
                  {/* Status Filter */}
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-4 py-2 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                  
                  {/* Campaign Filter */}
                  <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="px-4 py-2 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm"
                  >
                    <option value="all">All Campaigns</option>
                    {campaigns.map(campaign => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.campaign_name}
                      </option>
                    ))}
                  </select>
                  
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-400" />
                    <input
                      type="text"
                      placeholder="Search blogs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-pink-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm"
                    />
                  </div>
                  
                  {/* View Mode Toggle */}
                  <div className="flex border border-pink-200 rounded-xl overflow-hidden bg-white/80 backdrop-blur-sm shadow-sm">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-3 ${viewMode === 'grid' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'}`}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-3 ${viewMode === 'list' ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' : 'text-gray-600 hover:bg-pink-50'}`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="pt-24">
          {loading ? (
            <MainContentLoader message="Loading your blogs..." />
          ) : showWordPressConnectionMessage ? (
            <div className="p-12 text-center">
              <Globe className="w-16 h-16 text-blue-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connect to WordPress</h3>
              <p className="text-gray-500 mb-6">
                To start creating and managing blog posts, you need to connect your WordPress site first.
              </p>
              <div className="space-y-4">
                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={() => window.location.href = '/settings'}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go to Settings
                  </button>
                  <button
                    onClick={() => fetchData()}
                    className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                <p className="text-sm text-gray-400">
                  In Settings, you can add your WordPress site credentials to get started.
                </p>
              </div>
            </div>
          ) : filteredBlogs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No blogs found</h3>
              <p className="text-gray-500 mb-6">Generate your first blog post to get started</p>
              <button
                onClick={generateBlogs}
                disabled={generating}
                className="flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 mx-auto"
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
              className={viewMode === 'grid' ? 'p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8' : 'divide-y'}
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
                    <div className="relative h-64 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 overflow-hidden">
                      <img 
                        src={`https://images.unsplash.com/photo-${Math.random().toString(36).substr(2, 9)}?w=400&h=300&fit=crop&crop=face`}
                        alt="Blog post image" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 via-purple-500/80 to-blue-500/80"></div>
                      <div className="absolute top-4 left-4">
                        <span className={`px-3 py-1 text-xs rounded-full ${statusColors[blog.status]} flex items-center space-x-1 backdrop-blur-sm`}>
                          <StatusIcon className="w-3 h-3" />
                          <span className="capitalize font-medium">{blog.status}</span>
                        </span>
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
                    <div className="p-8">
                      {/* Author and Meta Info */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
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
                      <h3 className="font-bold text-gray-900 text-2xl mb-4 line-clamp-2 leading-tight">{blog.title}</h3>
                      
                      {/* Blog Content Preview */}
                      <div className="mb-6">
                        <p className="text-gray-600 text-base leading-relaxed line-clamp-3">
                          {blog.excerpt || blog.meta_description || blog.content.substring(0, 150) + '...'}
                        </p>
                      </div>
                      
                      {/* Categories and Tags */}
                      <div className="mb-6">
                        <div className="flex flex-wrap gap-3">
                          {blog.categories && blog.categories.map((category, index) => (
                            <span key={index} className="text-sm bg-gradient-to-r from-pink-100 to-purple-100 text-pink-800 px-4 py-2 rounded-full font-medium">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Card Footer with Stats and Actions */}
                      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                        {blog.status === 'published' ? (
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2 text-gray-500">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <span className="text-base font-medium">{Math.floor(Math.random() * 5000) + 1000} views</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-500">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                              </svg>
                              <span className="text-base font-medium">{Math.floor(Math.random() * 100) + 10}</span>
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
                              {blog.status === 'draft' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handlePublishBlog(blog.id)
                                  }}
                                  className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Publish blog"
                                >
                                  <Send className="w-5 h-5" />
                                </button>
                              )}
                            </>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteBlog(blog.id)
                            }}
                            className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete blog"
                          >
                            <Trash2 className="w-5 h-5" />
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
            <div className="flex justify-center items-center space-x-2 mt-8 mb-6">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-pink-200 rounded-xl text-gray-700 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"
              >
                ← Previous
              </button>
              
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
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
                className="px-4 py-2 bg-white/80 backdrop-blur-sm border border-pink-200 rounded-xl text-gray-700 hover:bg-pink-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-sm"
              >
                Next →
              </button>
            </div>
          )}

        </div>
      </div>

      {/* Edit Modal */}
      {editingBlog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Edit Blog Post</h3>
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categories (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.categories}
                    onChange={(e) => setEditForm(prev => ({ ...prev, categories: e.target.value }))}
                    placeholder="Technology, Business, Lifestyle"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                    placeholder="AI, Marketing, Innovation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedBlog.title}</h2>
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
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
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
            <div className="flex items-center justify-end space-x-3 p-6 border-t bg-gray-50">
              <button
                onClick={handleCloseBlogModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  handleCloseBlogModal()
                  handleEditBlog(selectedBlog)
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {generationProgress.step === 'Complete' ? (
                    <CheckCircle className="w-8 h-8 text-green-500" />
                  ) : generationProgress.step === 'Error' ? (
                    <XCircle className="w-8 h-8 text-red-500" />
                  ) : (
                    <RefreshCw className={`w-8 h-8 text-blue-500 ${generating ? 'animate-spin' : ''}`} />
                  )}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {generationProgress.step === 'Complete' ? 'Blogs Generated!' : 
                   generationProgress.step === 'Error' ? 'Generation Failed' : 
                   'Generating Blogs'}
                </h3>
                <p className="text-gray-600 mb-6">{generationProgress.message}</p>
              </div>

              {/* Progress Bar */}
              {generationProgress.step !== 'Error' && (
                <div className="mb-6">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${generationProgress.percentage}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{generationProgress.percentage}% Complete</p>
                </div>
              )}

              {/* Action Buttons */}
              {generationProgress.step === 'Complete' && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowGenerationModal(false)
                      setGenerationProgress({ step: '', percentage: 0, message: '' })
                    }}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    View Blogs
                  </button>
                </div>
              )}

              {generationProgress.step === 'Error' && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      setShowGenerationModal(false)
                      setGenerationProgress({ step: '', percentage: 0, message: '' })
                    }}
                    className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => generateBlogs()}
                    className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Loading state - no close button */}
              {generationProgress.step !== 'Complete' && generationProgress.step !== 'Error' && (
                <div className="text-sm text-gray-500">
                  Please wait while we generate your content...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Blog Preview Popup - Card Style */}
      {showBlogPreview && selectedBlog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Popup Header */}
            <div className="bg-gradient-to-r from-pink-500 to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold mb-2">Blog Preview</h2>
                  <p className="text-white/90 text-sm">Preview your blog content before publishing</p>
                </div>
                <button
                  onClick={handleCloseBlogPreview}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Popup Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              {/* Blog Card Preview */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6">
                {/* Preview Header */}
                <div className="relative h-32 bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/80 via-purple-500/80 to-blue-500/80"></div>
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 text-xs rounded-full bg-white/90 text-gray-800 font-medium">
                      {selectedBlog.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center space-x-2 text-white/90">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm font-medium">{selectedBlog.site_name || 'Unknown Site'}</span>
                    </div>
                  </div>
                </div>

                {/* Preview Content */}
                <div className="p-6">
                  <h3 className="font-bold text-gray-900 text-lg mb-3">{selectedBlog.title}</h3>
                  
                  <div className="mb-4">
                    <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                      {selectedBlog.excerpt || selectedBlog.content.substring(0, 200) + '...'}
                    </p>
                  </div>
                  
                  {/* Blog Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg">
                    <div className="text-center">
                      <div className="text-lg font-bold text-pink-600">{selectedBlog.reading_time}</div>
                      <div className="text-xs text-gray-600">min read</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-purple-600">{selectedBlog.word_count}</div>
                      <div className="text-xs text-gray-600">words</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-blue-600">{selectedBlog.seo_score}</div>
                      <div className="text-xs text-gray-600">SEO score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-gray-600">{formatDate(selectedBlog.scheduled_at)}</div>
                      <div className="text-xs text-gray-600">scheduled</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Content Preview */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Full Content Preview</h3>
                <div 
                  className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm max-h-96 overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: selectedBlog.content.replace(/\n/g, '<br>') }}
                />
              </div>

              {/* Categories and Tags */}
              {(selectedBlog.categories?.length > 0 || selectedBlog.tags?.length > 0) && (
                <div className="mt-6">
                  {selectedBlog.categories?.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedBlog.categories.map((category, index) => (
                          <span key={index} className="px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-pink-800 rounded-full text-xs font-medium">
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedBlog.tags?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedBlog.tags.map((tag, index) => (
                          <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Popup Footer */}
            <div className="flex items-center justify-between p-6 bg-gray-50 border-t">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Status:</span> {selectedBlog.status} • 
                <span className="font-medium ml-2">Scheduled:</span> {formatDate(selectedBlog.scheduled_at)} at {formatTime(selectedBlog.scheduled_at)}
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    handleCloseBlogPreview()
                    handleEditBlog(selectedBlog)
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 flex items-center space-x-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit Blog</span>
                </button>
                {selectedBlog.status === 'draft' && (
                  <button
                    onClick={() => {
                      handlePublishBlog(selectedBlog.id)
                      handleCloseBlogPreview()
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Publish</span>
                  </button>
                )}
                <button
                  onClick={handleCloseBlogPreview}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BlogDashboard
