import { supabase } from '../lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

class ConnectionsAPI {
  // Get all connections for current user
  async getConnections() {
    try {
      const response = await fetch(`${API_BASE_URL}/connections`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.connections, error: null }
    } catch (error) {
      console.error('Error fetching connections:', error)
      return { data: null, error: error.message }
    }
  }

  // Initiate OAuth connection for a platform
  async initiateConnection(platform) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/auth/${platform}/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.auth_url, error: null }
    } catch (error) {
      console.error('Error initiating connection:', error)
      return { data: null, error: error.message }
    }
  }

  // Handle OAuth callback (this will be called by the backend)
  async handleCallback(platform, code, state) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/auth/${platform}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ code, state })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.connection, error: null }
    } catch (error) {
      console.error('Error handling callback:', error)
      return { data: null, error: error.message }
    }
  }

  // Disconnect an account
  async disconnectAccount(connectionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error disconnecting account:', error)
      return { data: null, error: error.message }
    }
  }

  // Refresh connection tokens
  async refreshConnection(connectionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/${connectionId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error refreshing connection:', error)
      return { data: null, error: error.message }
    }
  }

  // Update connection settings
  async updateConnectionSettings(connectionId, settings) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/${connectionId}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error updating settings:', error)
      return { data: null, error: error.message }
    }
  }

  // Get connection analytics
  async getConnectionAnalytics(connectionId) {
    try {
      const response = await fetch(`${API_BASE_URL}/connections/${connectionId}/analytics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.analytics, error: null }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      return { data: null, error: error.message }
    }
  }

  // Helper method to get auth token
  async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }
}

export const connectionsAPI = new ConnectionsAPI()
