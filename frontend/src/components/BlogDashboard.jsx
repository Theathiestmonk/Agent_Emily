import React, { useState, useEffect } from 'react'
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
  const [selectedBlog, setSelectedBlog] = useState(null)
  const [showBlogModal, setShowBlogModal] = useState(false)

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
      alert(`Error loading blog data: ${error.message}`)
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
      alert(`Error fetching blogs: ${error.message}`)
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
      // Don't show alert for campaigns as it's not critical
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
      // Don't show alert for stats as it's not critical
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
      const result = await blogService.generateBlogs()
      
      if (result.success) {
        await fetchData() // Refresh all data
        alert(`Successfully generated ${result.total_blogs} blog posts!`)
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Error generating blogs:', error)
      alert(`Error generating blogs: ${error.message}`)
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
      alert(`Error updating blog: ${error.message}`)
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

  const handlePublishBlog = async (blogId) => {
    try {
      await blogService.publishBlog(blogId)
      await fetchBlogs()
      alert('Blog published successfully!')
    } catch (error) {
      console.error('Error publishing blog:', error)
      alert(`Error publishing blog: ${error.message}`)
    }
  }

  const handleDeleteBlog = async (blogId) => {
    if (!window.confirm('Are you sure you want to delete this blog?')) {
      return
    }

    try {
      await blogService.deleteBlog(blogId)
      await fetchBlogs()
      alert('Blog deleted successfully!')
    } catch (error) {
      console.error('Error deleting blog:', error)
      alert(`Error deleting blog: ${error.message}`)
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

  console.log('BlogDashboard render state:', { blogs: blogs.length, campaigns: campaigns.length, loading, stats })

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Side Navbar */}
      <SideNavbar />

      {/* Main Content */}
      <div className="ml-64 p-6">
        {/* Header */}
        <div className="fixed top-0 right-0 left-64 bg-white shadow-sm border-b z-30" style={{position: 'fixed', zIndex: 30}}>
          <div className="px-6 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-8">
                {/* Stats Cards in Header */}
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Blogs</p>
                      <p className="text-xl font-semibold text-gray-900">{stats.total_blogs || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Published</p>
                      <p className="text-xl font-semibold text-gray-900">{stats.published_blogs || 0}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Target className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Campaigns</p>
                      <p className="text-xl font-semibold text-gray-900">{stats.total_campaigns || 0}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={generateBlogs}
                  disabled={generating}
                  className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-purple-600 hover:to-blue-500 transition-all duration-300 disabled:opacity-50"
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
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search blogs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  {/* View Mode Toggle */}
                  <div className="flex border border-gray-300 rounded-lg">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-gray-600'}`}
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
            <div className={viewMode === 'grid' ? 'p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'divide-y'}>
              {filteredBlogs.map(blog => {
                const StatusIcon = statusIcons[blog.status] || AlertCircle
                const theme = {
                  primary: 'bg-gradient-to-r from-blue-500 to-purple-500',
                  secondary: 'bg-gradient-to-r from-green-500 to-blue-500',
                  accent: 'bg-blue-100 text-blue-800',
                  text: 'text-blue-800'
                }
                
                return (
                  <div key={blog.id} className={`${viewMode === 'grid' ? 'bg-white rounded-lg shadow-sm border hover:shadow-md transition-all duration-200' : 'bg-white'} p-6`}>
                    {/* Clickable area for blog content */}
                    <div 
                      className="cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors"
                      onClick={() => handleBlogClick(blog)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 line-clamp-2">{blog.title}</h3>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`px-2 py-1 text-xs rounded-full ${statusColors[blog.status]} flex items-center space-x-1`}>
                                <StatusIcon className="w-3 h-3" />
                                <span className="capitalize">{blog.status}</span>
                              </span>
                              <span className="flex items-center text-xs text-gray-500">
                                <Globe className="w-3 h-3 mr-1" />
                                {blog.wordpress_connections?.site_name || 'Unknown Site'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Blog Content Preview */}
                      <div className="mb-4">
                        <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">{blog.excerpt || blog.content.substring(0, 200) + '...'}</p>
                      </div>
                      
                      {/* Blog Details */}
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="font-medium text-gray-600">Scheduled:</span>
                            <p className="text-gray-800">{formatDate(blog.scheduled_at)} at {formatTime(blog.scheduled_at)}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Reading Time:</span>
                            <p className="text-gray-800">{blog.reading_time} min</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">Word Count:</span>
                            <p className="text-gray-800">{blog.word_count}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-600">SEO Score:</span>
                            <p className="text-gray-800">{blog.seo_score}/100</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Categories and Tags */}
                      <div className="mb-4">
                        {blog.categories && blog.categories.length > 0 && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-600">Categories</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {blog.categories.map((category, index) => (
                                <span key={index} className={`text-xs ${theme.accent} px-2 py-1 rounded-lg`}>
                                  {category}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {blog.tags && blog.tags.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-600">Tags</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {blog.tags.map((tag, index) => (
                                <span key={index} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Action buttons outside clickable area */}
                    <div className="flex items-center space-x-2 mt-4">
                      <button
                        onClick={() => handleEditBlog(blog)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {blog.status === 'draft' && (
                        <button
                          onClick={() => handlePublishBlog(blog.id)}
                          className="p-2 text-green-500 hover:text-green-700 hover:bg-green-100 rounded-md"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBlog(blog.id)}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-100 rounded-md"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
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
                      {selectedBlog.wordpress_connections?.site_name || 'Unknown Site'}
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
    </div>
  )
}

export default BlogDashboard
