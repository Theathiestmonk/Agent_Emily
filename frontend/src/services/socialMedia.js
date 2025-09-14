import { supabase } from '../lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class SocialMediaService {
  async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('No active session')
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  async connectWithToken(platform, accessToken, connectionMethod = 'token') {
    try {
      const headers = await this.getAuthHeaders()
      
      console.log(`Connecting ${platform} with token: ${accessToken.substring(0, 20)}...`)
      
      const response = await fetch(`${API_URL}/api/social-media/connect-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platform,
          account_type: 'business', // Default, will be updated by backend
          account_id: '', // Will be set by backend
          account_name: '', // Will be set by backend
          access_token: accessToken,
          connection_method: connectionMethod
        })
      })

      const result = await response.json()
      console.log('Connection response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to connect account')
      }

      return result
    } catch (error) {
      console.error('Error connecting social media account:', error)
      throw error
    }
  }

  async debugValidateToken(platform, accessToken) {
    try {
      const response = await fetch(`${API_URL}/api/social-media/debug/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform,
          access_token: accessToken
        })
      })

      const result = await response.json()
      console.log('Debug validation result:', result)
      return result
    } catch (error) {
      console.error('Error debugging token:', error)
      throw error
    }
  }

  async getConnections() {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/connections`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch connections')
      }

      return result.connections || []
    } catch (error) {
      console.error('Error fetching connections:', error)
      throw error
    }
  }

  async disconnectAccount(connectionId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/disconnect/${connectionId}`, {
        method: 'DELETE',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to disconnect account')
      }

      return result
    } catch (error) {
      console.error('Error disconnecting account:', error)
      throw error
    }
  }

  async getInstagramProfile(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/profile/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram profile')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram profile:', error)
      throw error
    }
  }

  async getInstagramMedia(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/media/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram media')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram media:', error)
      throw error
    }
  }

  async getInstagramInsights(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/insights/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram insights')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram insights:', error)
      throw error
    }
  }

  async initializeConnections() {
    try {
      const connections = await this.getConnections()
      console.log('Initialized social media connections:', connections)
      return connections
    } catch (error) {
      console.error('Error initializing connections:', error)
      return []
    }
  }

  // OAuth connection methods (for future implementation)
  async connectWithOAuth(platform) {
    // Redirect to OAuth flow
    const oauthUrl = `${API_URL}/api/auth/${platform}/oauth`
    window.location.href = oauthUrl
  }

  // Platform-specific connection methods
  async connectInstagram(accessToken, method = 'token') {
    return this.connectWithToken('instagram', accessToken, method)
  }

  async connectFacebook(accessToken, method = 'token') {
    return this.connectWithToken('facebook', accessToken, method)
  }

  async connectTwitter(accessToken, method = 'token') {
    return this.connectWithToken('twitter', accessToken, method)
  }

  async connectLinkedIn(accessToken, method = 'token') {
    return this.connectWithToken('linkedin', accessToken, method)
  }

  // Utility methods
  getPlatformInfo(platform) {
    const platforms = {
      instagram: {
        name: 'Instagram',
        color: 'bg-gradient-to-r from-purple-500 to-pink-500',
        description: 'Post content, get insights, manage ads'
      },
      facebook: {
        name: 'Facebook',
        color: 'bg-blue-600',
        description: 'Manage pages, post content, run ads'
      },
      twitter: {
        name: 'Twitter',
        color: 'bg-blue-400',
        description: 'Tweet, get analytics, manage campaigns'
      },
      linkedin: {
        name: 'LinkedIn',
        color: 'bg-blue-700',
        description: 'Share content, get professional insights'
      }
    }
    return platforms[platform] || { name: platform, color: 'bg-gray-500', description: 'Social media platform' }
  }

  getConnectionMethodInfo(method) {
    const methods = {
      oauth: {
        name: 'OAuth',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: 'Secure, one-click connection'
      },
      token: {
        name: 'Token',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: 'Manual token input'
      }
    }
    return methods[method] || { name: method, color: 'text-gray-600', bgColor: 'bg-gray-100', description: 'Connection method' }
  }
}

// Create and export a singleton instance
export const socialMediaService = new SocialMediaService()
export default socialMediaService
