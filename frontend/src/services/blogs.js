const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class BlogService {
  async getAuthToken() {
    return localStorage.getItem('authToken')
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAuthToken()
    const url = `${API_URL}${endpoint}`
    
    console.log('Blog service request:', { url, token: token ? 'present' : 'missing' })
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    }

    try {
      const response = await fetch(url, { ...defaultOptions, ...options })
      console.log('Blog service response:', { status: response.status, ok: response.ok })
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
        console.error('Blog service error:', error)
        throw new Error(error.detail || `HTTP ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('Blog service fetch error:', error)
      throw error
    }
  }

  // Blog Posts
  async getBlogs(params = {}) {
    const queryParams = new URLSearchParams()
    
    if (params.status) queryParams.append('status', params.status)
    if (params.site_id) queryParams.append('site_id', params.site_id)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.offset) queryParams.append('offset', params.offset)
    
    const queryString = queryParams.toString()
    const endpoint = `/api/blogs${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest(endpoint)
  }

  async getBlog(blogId) {
    return this.makeRequest(`/api/blogs/${blogId}`)
  }

  async generateBlogs() {
    return this.makeRequest('/api/blogs/generate', {
      method: 'POST'
    })
  }

  async updateBlog(blogId, blogData) {
    return this.makeRequest(`/api/blogs/${blogId}`, {
      method: 'PUT',
      body: JSON.stringify(blogData)
    })
  }

  async deleteBlog(blogId) {
    return this.makeRequest(`/api/blogs/${blogId}`, {
      method: 'DELETE'
    })
  }

  async publishBlog(blogId) {
    return this.makeRequest(`/api/blogs/${blogId}/publish`, {
      method: 'POST'
    })
  }

  // Blog Campaigns
  async getCampaigns(params = {}) {
    const queryParams = new URLSearchParams()
    
    if (params.status) queryParams.append('status', params.status)
    
    const queryString = queryParams.toString()
    const endpoint = `/api/blogs/campaigns${queryString ? `?${queryString}` : ''}`
    
    return this.makeRequest(endpoint)
  }

  async getCampaign(campaignId) {
    return this.makeRequest(`/api/blogs/campaigns/${campaignId}`)
  }

  async getCampaignBlogs(campaignId) {
    return this.makeRequest(`/api/blogs/campaigns/${campaignId}/blogs`)
  }

  // Blog Statistics
  async getBlogStats() {
    return this.makeRequest('/api/blogs/stats')
  }

  // WordPress Sites (for blog creation)
  async getWordPressSites() {
    return this.makeRequest('/connections/wordpress')
  }
}

export const blogService = new BlogService()
