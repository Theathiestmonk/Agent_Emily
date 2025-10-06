const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class BlogService {
  async getAuthToken() {
    // Try multiple token sources
    let token = localStorage.getItem('authToken') || 
                localStorage.getItem('token') || 
                localStorage.getItem('access_token')
    
    if (!token) {
      // Try to get token from Supabase session
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: { session } } = await supabase.auth.getSession()
        token = session?.access_token || null
        
        // If we got a token from Supabase, store it in localStorage
        if (token) {
          localStorage.setItem('authToken', token)
        }
      } catch (error) {
        console.error('Error getting Supabase token:', error)
        return null
      }
    }
    
    // If we still don't have a token, try to refresh the session
    if (!token) {
      try {
        const { supabase } = await import('../lib/supabase')
        const { data: { session }, error } = await supabase.auth.refreshSession()
        
        if (error) {
          console.error('Error refreshing session:', error)
          // Clear invalid tokens
          localStorage.removeItem('authToken')
          localStorage.removeItem('token')
          localStorage.removeItem('access_token')
          return null
        }
        
        token = session?.access_token || null
        if (token) {
          localStorage.setItem('authToken', token)
        }
      } catch (error) {
        console.error('Error refreshing session:', error)
        // Clear all tokens
        localStorage.removeItem('authToken')
        localStorage.removeItem('token')
        localStorage.removeItem('access_token')
        return null
      }
    }
    
    return token
  }

  async makeRequest(endpoint, options = {}) {
    const token = await this.getAuthToken()
    const url = `${API_URL}${endpoint}`
    
    console.log('Blog service request:', { url, token: token ? 'present' : 'missing' })
    
    if (!token) {
      console.error('No authentication token found')
      // Clear any invalid tokens and redirect to login
      localStorage.removeItem('authToken')
      localStorage.removeItem('token')
      localStorage.removeItem('access_token')
      
      // Redirect to login page
      window.location.href = '/login'
      throw new Error('Authentication required. Please log in.')
    }
    
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
        
        // Handle authentication errors specifically
        if (response.status === 401) {
          console.error('Authentication failed, clearing tokens and redirecting to login')
          localStorage.removeItem('authToken')
          localStorage.removeItem('token')
          localStorage.removeItem('access_token')
          window.location.href = '/login'
          throw new Error('Authentication failed. Please log in again.')
        }
        
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


  // Blog Statistics
  async getBlogStats() {
    return this.makeRequest('/api/blogs/stats/')
  }

  // WordPress Sites (for blog creation)
  async getWordPressSites() {
    return this.makeRequest('/connections/platform/?platform=wordpress')
  }
}

export const blogService = new BlogService()
