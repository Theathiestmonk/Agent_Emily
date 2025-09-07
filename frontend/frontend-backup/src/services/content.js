import { supabase } from '../lib/supabase'

export const contentAPI = {
  // Get all campaigns for the current user
  async getCampaigns() {
    try {
      const { data, error } = await supabase
        .from('content_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      return { data: null, error }
    }
  },

  // Get posts for a specific campaign
  async getCampaignPosts(campaignId) {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .select(`
          *,
          content_images(*)
        `)
        .eq('campaign_id', campaignId)
        .order('scheduled_date', { ascending: true })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching campaign posts:', error)
      return { data: null, error }
    }
  },

  // Get all posts for the current user
  async getAllPosts() {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .select(`
          *,
          content_campaigns!inner(user_id),
          content_images(*)
        `)
        .order('scheduled_date', { ascending: false })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching all posts:', error)
      return { data: null, error }
    }
  },

  // Get posts for the current user (alias for getAllPosts)
  async getPosts() {
    return this.getAllPosts()
  },

  // Get post details
  async getPostDetails(postId) {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .select(`
          *,
          content_campaigns!inner(user_id),
          content_images(*)
        `)
        .eq('id', postId)
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching post details:', error)
      return { data: null, error }
    }
  },

  // Update post
  async updatePost(postId, updates) {
    try {
      const { data, error } = await supabase
        .from('content_posts')
        .update(updates)
        .eq('id', postId)
        .select()
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating post:', error)
      return { data: null, error }
    }
  },

  // Get content templates
  async getTemplates(platform = null) {
    try {
      let query = supabase
        .from('content_templates')
        .select('*')
        .eq('is_active', true)
      
      if (platform) {
        query = query.eq('platform', platform)
      }
      
      const { data, error } = await query.order('platform', { ascending: true })
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching templates:', error)
      return { data: null, error }
    }
  },

  // Get image preferences
  async getImagePreferences() {
    try {
      const { data, error } = await supabase
        .from('user_image_preferences')
        .select('*')
        .single()
      
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows returned
      return { data, error: null }
    } catch (error) {
      console.error('Error fetching image preferences:', error)
      return { data: null, error }
    }
  },

  // Update image preferences
  async updateImagePreferences(preferences) {
    try {
      const { data, error } = await supabase
        .from('user_image_preferences')
        .upsert(preferences)
        .select()
        .single()
      
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating image preferences:', error)
      return { data: null, error }
    }
  },

  // Generate content for current user
  async generateContent() {
    try {
      const { data: session } = await supabase.auth.getSession()
      
      if (!session?.session?.access_token) {
        throw new Error('No authentication token found')
      }

      const response = await fetch('http://localhost:8000/content/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return { data, error: null }
    } catch (error) {
      console.error('Error generating content:', error)
      return { data: null, error }
    }
  }
}
