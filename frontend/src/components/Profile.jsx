import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import { User, Mail, Phone, MapPin, Calendar, Edit, Save, X, Loader2, Building2, Globe, Target, BarChart3, Megaphone, Settings } from 'lucide-react'

const Profile = () => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setError('Failed to load profile')
        return
      }

      setProfile(data)
      setEditForm({
        // Basic Information
        name: data?.name || '',
        business_name: data?.business_name || '',
        business_type: data?.business_type || [],
        industry: data?.industry || [],
        business_description: data?.business_description || '',
        target_audience: data?.target_audience || [],
        unique_value_proposition: data?.unique_value_proposition || '',
        
        // Brand & Contact
        brand_voice: data?.brand_voice || '',
        brand_tone: data?.brand_tone || '',
        website_url: data?.website_url || '',
        phone_number: data?.phone_number || '',
        street_address: data?.street_address || '',
        city: data?.city || '',
        state: data?.state || '',
        country: data?.country || '',
        timezone: data?.timezone || '',
        
        // Social Media & Goals
        social_media_platforms: data?.social_media_platforms || [],
        primary_goals: data?.primary_goals || [],
        key_metrics_to_track: data?.key_metrics_to_track || [],
        
        // Content Strategy
        monthly_budget_range: data?.monthly_budget_range || '',
        posting_frequency: data?.posting_frequency || '',
        preferred_content_types: data?.preferred_content_types || [],
        content_themes: data?.content_themes || [],
        
        // Market & Competition
        main_competitors: data?.main_competitors || '',
        market_position: data?.market_position || '',
        products_or_services: data?.products_or_services || '',
        
        // Campaign Planning
        important_launch_dates: data?.important_launch_dates || '',
        planned_promotions_or_campaigns: data?.planned_promotions_or_campaigns || '',
        top_performing_content_types: data?.top_performing_content_types || [],
        best_time_to_post: data?.best_time_to_post || [],
        
        // Performance & Customer
        successful_campaigns: data?.successful_campaigns || '',
        hashtags_that_work_well: data?.hashtags_that_work_well || '',
        customer_pain_points: data?.customer_pain_points || '',
        typical_customer_journey: data?.typical_customer_journey || '',
        
        // Automation & Platform
        automation_level: data?.automation_level || '',
        platform_specific_tone: data?.platform_specific_tone || {},
        current_presence: data?.current_presence || [],
        focus_areas: data?.focus_areas || [],
        platform_details: data?.platform_details || {},
        
        // Platform Links
        facebook_page_name: data?.facebook_page_name || '',
        instagram_profile_link: data?.instagram_profile_link || '',
        linkedin_company_link: data?.linkedin_company_link || '',
        youtube_channel_link: data?.youtube_channel_link || '',
        x_twitter_profile: data?.x_twitter_profile || '',
        google_business_profile: data?.google_business_profile || '',
        google_ads_account: data?.google_ads_account || '',
        whatsapp_business: data?.whatsapp_business || '',
        email_marketing_platform: data?.email_marketing_platform || '',
        meta_ads_accounts: data?.meta_ads_accounts || ''
      })
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = () => {
    setEditing(true)
  }

  const handleCancel = () => {
    setEditing(false)
    setEditForm({
      // Basic Information
      name: profile?.name || '',
      business_name: profile?.business_name || '',
      business_type: profile?.business_type || [],
      industry: profile?.industry || [],
      business_description: profile?.business_description || '',
      target_audience: profile?.target_audience || [],
      unique_value_proposition: profile?.unique_value_proposition || '',
      
      // Brand & Contact
      brand_voice: profile?.brand_voice || '',
      brand_tone: profile?.brand_tone || '',
      website_url: profile?.website_url || '',
      phone_number: profile?.phone_number || '',
      street_address: profile?.street_address || '',
      city: profile?.city || '',
      state: profile?.state || '',
      country: profile?.country || '',
      timezone: profile?.timezone || '',
      
      // Social Media & Goals
      social_media_platforms: profile?.social_media_platforms || [],
      primary_goals: profile?.primary_goals || [],
      key_metrics_to_track: profile?.key_metrics_to_track || [],
      
      // Content Strategy
      monthly_budget_range: profile?.monthly_budget_range || '',
      posting_frequency: profile?.posting_frequency || '',
      preferred_content_types: profile?.preferred_content_types || [],
      content_themes: profile?.content_themes || [],
      
      // Market & Competition
      main_competitors: profile?.main_competitors || '',
      market_position: profile?.market_position || '',
      products_or_services: profile?.products_or_services || '',
      
      // Campaign Planning
      important_launch_dates: profile?.important_launch_dates || '',
      planned_promotions_or_campaigns: profile?.planned_promotions_or_campaigns || '',
      top_performing_content_types: profile?.top_performing_content_types || [],
      best_time_to_post: profile?.best_time_to_post || [],
      
      // Performance & Customer
      successful_campaigns: profile?.successful_campaigns || '',
      hashtags_that_work_well: profile?.hashtags_that_work_well || '',
      customer_pain_points: profile?.customer_pain_points || '',
      typical_customer_journey: profile?.typical_customer_journey || '',
      
      // Automation & Platform
      automation_level: profile?.automation_level || '',
      platform_specific_tone: profile?.platform_specific_tone || {},
      current_presence: profile?.current_presence || [],
      focus_areas: profile?.focus_areas || [],
      platform_details: profile?.platform_details || {},
      
      // Platform Links
      facebook_page_name: profile?.facebook_page_name || '',
      instagram_profile_link: profile?.instagram_profile_link || '',
      linkedin_company_link: profile?.linkedin_company_link || '',
      youtube_channel_link: profile?.youtube_channel_link || '',
      x_twitter_profile: profile?.x_twitter_profile || '',
      google_business_profile: profile?.google_business_profile || '',
      google_ads_account: profile?.google_ads_account || '',
      whatsapp_business: profile?.whatsapp_business || '',
      email_marketing_platform: profile?.email_marketing_platform || '',
      meta_ads_accounts: profile?.meta_ads_accounts || ''
    })
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('User not authenticated')
        return
      }

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...editForm,
          updated_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating profile:', error)
        setError('Failed to update profile')
        return
      }

      setProfile({ ...profile, ...editForm })
      setEditing(false)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleArrayInputChange = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(item => item)
    setEditForm(prev => ({
      ...prev,
      [field]: array
    }))
  }

  const renderArrayField = (label, field, icon) => {
    const value = Array.isArray(editForm[field]) ? editForm[field].join(', ') : editForm[field]
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={(e) => handleArrayInputChange(field, e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="Enter values separated by commas"
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {Array.isArray(profile?.[field]) && profile[field].length > 0 ? (
              profile[field].map((item, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm"
                >
                  {item}
                </span>
              ))
            ) : (
              <p className="text-gray-500">Not specified</p>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderTextField = (label, field, icon, type = 'text', placeholder = '') => {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
        {editing ? (
          type === 'textarea' ? (
            <textarea
              value={editForm[field]}
              onChange={(e) => handleInputChange(field, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder={placeholder}
            />
          ) : (
            <input
              type={type}
              value={editForm[field]}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder={placeholder}
            />
          )
        ) : (
          <p className="text-gray-900 py-2 flex items-center">
            {icon && <span className="mr-2">{icon}</span>}
            {profile?.[field] || 'Not provided'}
          </p>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <SideNavbar />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            <span className="text-gray-600">Loading profile...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <SideNavbar />
        <div className="flex-1 ml-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Profile</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchProfile}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
                  <p className="text-gray-600">Manage your account information and preferences</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {!editing ? (
                  <button
                    onClick={handleEdit}
                    className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit Profile</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCancel}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-8">
            {/* Basic Business Information */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-purple-600" />
                Basic Business Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Name', 'name', <User className="w-4 h-4 text-gray-400" />)}
                {renderTextField('Business Name', 'business_name', <Building2 className="w-4 h-4 text-gray-400" />)}
                {renderArrayField('Business Type', 'business_type')}
                {renderArrayField('Industry', 'industry')}
                {renderTextField('Business Description', 'business_description', null, 'textarea', 'Describe your business...')}
                {renderArrayField('Target Audience', 'target_audience')}
                {renderTextField('Unique Value Proposition', 'unique_value_proposition', null, 'textarea', 'What makes your business unique?')}
              </div>
            </div>

            {/* Brand & Contact Information */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-blue-600" />
                Brand & Contact Information
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Brand Voice', 'brand_voice', null, 'textarea', 'How does your brand communicate?')}
                {renderTextField('Brand Tone', 'brand_tone', null, 'textarea', 'What tone does your brand use?')}
                {renderTextField('Website URL', 'website_url', <Globe className="w-4 h-4 text-gray-400" />, 'url')}
                {renderTextField('Phone Number', 'phone_number', <Phone className="w-4 h-4 text-gray-400" />, 'tel')}
                {renderTextField('Street Address', 'street_address', <MapPin className="w-4 h-4 text-gray-400" />)}
                {renderTextField('City', 'city', <MapPin className="w-4 h-4 text-gray-400" />)}
                {renderTextField('State', 'state', <MapPin className="w-4 h-4 text-gray-400" />)}
                {renderTextField('Country', 'country', <MapPin className="w-4 h-4 text-gray-400" />)}
                {renderTextField('Timezone', 'timezone', <Calendar className="w-4 h-4 text-gray-400" />)}
              </div>
            </div>

            {/* Social Media & Goals */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Target className="w-5 h-5 mr-2 text-green-600" />
                Social Media & Goals
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderArrayField('Social Media Platforms', 'social_media_platforms')}
                {renderArrayField('Primary Goals', 'primary_goals')}
                {renderArrayField('Key Metrics to Track', 'key_metrics_to_track')}
              </div>
            </div>

            {/* Content Strategy */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-orange-600" />
                Content Strategy
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Monthly Budget Range', 'monthly_budget_range', null, 'text', 'e.g., $500-$1000')}
                {renderTextField('Posting Frequency', 'posting_frequency', null, 'text', 'e.g., Daily, Weekly')}
                {renderArrayField('Preferred Content Types', 'preferred_content_types')}
                {renderArrayField('Content Themes', 'content_themes')}
              </div>
            </div>

            {/* Market & Competition */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Target className="w-5 h-5 mr-2 text-red-600" />
                Market & Competition
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Main Competitors', 'main_competitors', null, 'textarea', 'List your main competitors')}
                {renderTextField('Market Position', 'market_position', null, 'textarea', 'How do you position yourself in the market?')}
                {renderTextField('Products or Services', 'products_or_services', null, 'textarea', 'Describe your products or services')}
              </div>
            </div>

            {/* Campaign Planning */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                Campaign Planning
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Important Launch Dates', 'important_launch_dates', null, 'textarea', 'Key dates for your business')}
                {renderTextField('Planned Promotions or Campaigns', 'planned_promotions_or_campaigns', null, 'textarea', 'Upcoming campaigns')}
                {renderArrayField('Top Performing Content Types', 'top_performing_content_types')}
                {renderArrayField('Best Time to Post', 'best_time_to_post')}
              </div>
            </div>

            {/* Performance & Customer */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2 text-pink-600" />
                Performance & Customer
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Successful Campaigns', 'successful_campaigns', null, 'textarea', 'Describe your successful campaigns')}
                {renderTextField('Hashtags That Work Well', 'hashtags_that_work_well', null, 'textarea', 'List effective hashtags')}
                {renderTextField('Customer Pain Points', 'customer_pain_points', null, 'textarea', 'What problems do your customers face?')}
                {renderTextField('Typical Customer Journey', 'typical_customer_journey', null, 'textarea', 'Describe your customer journey')}
              </div>
            </div>

            {/* Automation & Platform */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-teal-600" />
                Automation & Platform
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Automation Level', 'automation_level', null, 'text', 'e.g., Beginner, Intermediate, Advanced')}
                {renderArrayField('Current Presence', 'current_presence')}
                {renderArrayField('Focus Areas', 'focus_areas')}
              </div>
            </div>

            {/* Platform Links */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Megaphone className="w-5 h-5 mr-2 text-purple-600" />
                Platform Links & Accounts
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderTextField('Facebook Page Name', 'facebook_page_name', null, 'text')}
                {renderTextField('Instagram Profile Link', 'instagram_profile_link', null, 'url')}
                {renderTextField('LinkedIn Company Link', 'linkedin_company_link', null, 'url')}
                {renderTextField('YouTube Channel Link', 'youtube_channel_link', null, 'url')}
                {renderTextField('X/Twitter Profile', 'x_twitter_profile', null, 'url')}
                {renderTextField('Google Business Profile', 'google_business_profile', null, 'url')}
                {renderTextField('Google Ads Account', 'google_ads_account', null, 'text')}
                {renderTextField('WhatsApp Business', 'whatsapp_business', null, 'text')}
                {renderTextField('Email Marketing Platform', 'email_marketing_platform', null, 'text')}
                {renderTextField('Meta Ads Accounts', 'meta_ads_accounts', null, 'text')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile