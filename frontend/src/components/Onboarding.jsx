import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { onboardingAPI } from '../services/onboarding'
import OnboardingComplete from './OnboardingComplete'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({
    business_name: '',
    business_type: [],
    industry: [],
    business_description: '',
    target_audience: [],
    unique_value_proposition: '',
    brand_voice: '',
    brand_tone: '',
    website_url: '',
    phone_number: '',
    street_address: '',
    city: '',
    state: '',
    country: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    social_media_platforms: [],
    primary_goals: [],
    key_metrics_to_track: [],
    monthly_budget_range: '',
    posting_frequency: '',
    preferred_content_types: [],
    content_themes: [],
    main_competitors: '',
    market_position: '',
    products_or_services: '',
    important_launch_dates: '',
    planned_promotions_or_campaigns: '',
    top_performing_content_types: [],
    best_time_to_post: [],
    successful_campaigns: '',
    hashtags_that_work_well: '',
    customer_pain_points: '',
    typical_customer_journey: '',
    automation_level: '',
    platform_specific_tone: {},
    current_presence: [],
    focus_areas: [],
    platform_details: {},
    facebook_page_name: '',
    instagram_profile_link: '',
    linkedin_company_link: '',
    youtube_channel_link: '',
    x_twitter_profile: '',
    google_business_profile: '',
    google_ads_account: '',
    whatsapp_business: '',
    email_marketing_platform: '',
    meta_ads_accounts: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCompletion, setShowCompletion] = useState(false)
  
  const { user } = useAuth()
  const navigate = useNavigate()

  const steps = [
    'Basic Business Info',
    'Business Description', 
    'Brand & Contact',
    'Social Media & Goals',
    'Content Strategy',
    'Market & Competition',
    'Campaign Planning',
    'Performance & Customer',
    'Automation & Platform',
    'Review & Submit'
  ]

  const businessTypes = [
    'Sole Proprietorship', 'Partnership', 'LLC', 'Corporation', 
    'Non-profit', 'Freelancer', 'Consultant', 'Agency', 'E-commerce'
  ]

  const industries = [
    'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
    'Food & Beverage', 'Real Estate', 'Manufacturing', 'Consulting',
    'Marketing & Advertising', 'Entertainment', 'Travel & Tourism',
    'Fashion', 'Beauty & Wellness', 'Sports & Fitness', 'Other'
  ]

  const socialPlatforms = [
    'Facebook', 'Instagram', 'LinkedIn', 'Twitter/X', 'YouTube',
    'TikTok', 'Pinterest', 'Snapchat', 'WhatsApp Business'
  ]

  const goals = [
    'Increase Brand Awareness', 'Generate Leads', 'Drive Sales',
    'Build Community', 'Customer Engagement', 'Website Traffic',
    'Content Marketing', 'Social Proof', 'Customer Support'
  ]

  const metrics = [
    'Followers/Subscribers', 'Engagement Rate', 'Click-through Rate',
    'Conversion Rate', 'Reach', 'Impressions', 'Website Traffic',
    'Lead Generation', 'Sales Revenue', 'Customer Acquisition Cost'
  ]

  const budgetRanges = [
    'Under $500/month', '$500-$1,000/month', '$1,000-$2,500/month',
    '$2,500-$5,000/month', '$5,000-$10,000/month', 'Over $10,000/month'
  ]

  const postingFrequencies = [
    'Daily', '2-3 times per week', 'Weekly', 'Bi-weekly', 'Monthly'
  ]

  const contentTypes = [
    'Images', 'Videos', 'Stories', 'Live Streams', 'Blog Posts',
    'Infographics', 'Polls', 'User Generated Content', 'Behind the Scenes'
  ]

  const automationLevels = [
    'Fully Manual', 'Semi-Automated', 'Mostly Automated', 'Fully Automated'
  ]

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setError('')
  }

  const handleArrayChange = (field, value, checked) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(item => item !== value)
    }))
  }

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return formData.business_name && formData.business_type.length > 0 && formData.industry.length > 0
      case 1:
        return formData.business_description && formData.unique_value_proposition
      case 2:
        return formData.brand_voice && formData.brand_tone && formData.phone_number && 
               formData.city && formData.state && formData.country
      case 3:
        return formData.social_media_platforms.length > 0 && formData.primary_goals.length > 0 && 
               formData.key_metrics_to_track.length > 0
      case 4:
        return formData.monthly_budget_range && formData.posting_frequency && 
               formData.preferred_content_types.length > 0 && formData.content_themes.length > 0
      case 5:
        return formData.market_position && formData.products_or_services
      case 6:
        return formData.planned_promotions_or_campaigns && formData.top_performing_content_types.length > 0 && 
               formData.best_time_to_post.length > 0
      case 7:
        return formData.successful_campaigns && formData.hashtags_that_work_well && 
               formData.customer_pain_points && formData.typical_customer_journey
      case 8:
        return formData.automation_level
      case 9:
        return true // Review step
      default:
        return true
    }
  }

  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))
      setError('')
    } else {
      setError('Please fill in all required fields before proceeding.')
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setError('')
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const response = await onboardingAPI.submitOnboarding(formData)
      console.log('Onboarding submitted successfully:', response.data)
      setShowCompletion(true)
    } catch (err) {
      console.error('Onboarding submission error:', err)
      setError(err.message || 'Failed to submit onboarding')
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Basic Business Information</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Name *</label>
              <input
                type="text"
                value={formData.business_name}
                onChange={(e) => handleInputChange('business_name', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Enter your business name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {businessTypes.map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.business_type.includes(type)}
                      onChange={(e) => handleArrayChange('business_type', type, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Industry *</label>
              <div className="grid grid-cols-2 gap-2">
                {industries.map(industry => (
                  <label key={industry} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.industry.includes(industry)}
                      onChange={(e) => handleArrayChange('industry', industry, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{industry}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Business Description</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Description *</label>
              <textarea
                value={formData.business_description}
                onChange={(e) => handleInputChange('business_description', e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Describe what your business does..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unique Value Proposition *</label>
              <textarea
                value={formData.unique_value_proposition}
                onChange={(e) => handleInputChange('unique_value_proposition', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="What makes your business unique?"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Brand & Contact Information</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Voice *</label>
                <input
                  type="text"
                  value={formData.brand_voice}
                  onChange={(e) => handleInputChange('brand_voice', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="e.g., Professional, Friendly, Authoritative"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Tone *</label>
                <input
                  type="text"
                  value={formData.brand_tone}
                  onChange={(e) => handleInputChange('brand_tone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="e.g., Casual, Formal, Playful"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="City"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">State *</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="State"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Country *</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="Country"
                />
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Social Media & Goals</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Social Media Platforms *</label>
              <div className="grid grid-cols-3 gap-2">
                {socialPlatforms.map(platform => (
                  <label key={platform} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.social_media_platforms.includes(platform)}
                      onChange={(e) => handleArrayChange('social_media_platforms', platform, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{platform}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary Goals *</label>
              <div className="grid grid-cols-2 gap-2">
                {goals.map(goal => (
                  <label key={goal} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.primary_goals.includes(goal)}
                      onChange={(e) => handleArrayChange('primary_goals', goal, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{goal}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Key Metrics to Track *</label>
              <div className="grid grid-cols-2 gap-2">
                {metrics.map(metric => (
                  <label key={metric} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.key_metrics_to_track.includes(metric)}
                      onChange={(e) => handleArrayChange('key_metrics_to_track', metric, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{metric}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Content Strategy</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Budget Range *</label>
                <select
                  value={formData.monthly_budget_range}
                  onChange={(e) => handleInputChange('monthly_budget_range', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="">Select budget range</option>
                  {budgetRanges.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Posting Frequency *</label>
                <select
                  value={formData.posting_frequency}
                  onChange={(e) => handleInputChange('posting_frequency', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="">Select frequency</option>
                  {postingFrequencies.map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Content Types *</label>
              <div className="grid grid-cols-2 gap-2">
                {contentTypes.map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.preferred_content_types.includes(type)}
                      onChange={(e) => handleArrayChange('preferred_content_types', type, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content Themes *</label>
              <input
                type="text"
                value={formData.content_themes.join(', ')}
                onChange={(e) => handleInputChange('content_themes', e.target.value.split(', ').filter(t => t.trim()))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="e.g., Industry news, Behind the scenes, Customer stories"
              />
              <p className="text-xs text-gray-500 mt-1">Separate themes with commas</p>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Market & Competition</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Market Position *</label>
              <input
                type="text"
                value={formData.market_position}
                onChange={(e) => handleInputChange('market_position', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="e.g., Premium, Budget-friendly, Mid-market"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Products/Services *</label>
              <textarea
                value={formData.products_or_services}
                onChange={(e) => handleInputChange('products_or_services', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Describe your main products or services..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Main Competitors</label>
              <input
                type="text"
                value={formData.main_competitors}
                onChange={(e) => handleInputChange('main_competitors', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="List your main competitors..."
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Campaign Planning</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Planned Promotions/Campaigns *</label>
              <textarea
                value={formData.planned_promotions_or_campaigns}
                onChange={(e) => handleInputChange('planned_promotions_or_campaigns', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Describe any upcoming campaigns or promotions..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Top Performing Content Types *</label>
              <div className="grid grid-cols-2 gap-2">
                {contentTypes.map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.top_performing_content_types.includes(type)}
                      onChange={(e) => handleArrayChange('top_performing_content_types', type, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Best Time to Post *</label>
              <div className="grid grid-cols-2 gap-2">
                {['Morning (6-12 PM)', 'Afternoon (12-6 PM)', 'Evening (6-12 AM)', 'Night (12-6 AM)'].map(time => (
                  <label key={time} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.best_time_to_post.includes(time)}
                      onChange={(e) => handleArrayChange('best_time_to_post', time, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{time}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Performance & Customer</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Successful Campaigns *</label>
              <textarea
                value={formData.successful_campaigns}
                onChange={(e) => handleInputChange('successful_campaigns', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Describe your most successful marketing campaigns..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hashtags That Work Well *</label>
              <input
                type="text"
                value={formData.hashtags_that_work_well}
                onChange={(e) => handleInputChange('hashtags_that_work_well', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="e.g., #smallbusiness #entrepreneur #marketing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Customer Pain Points *</label>
              <textarea
                value={formData.customer_pain_points}
                onChange={(e) => handleInputChange('customer_pain_points', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="What problems do your customers face that you solve?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Typical Customer Journey *</label>
              <textarea
                value={formData.typical_customer_journey}
                onChange={(e) => handleInputChange('typical_customer_journey', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="Describe how customers typically discover and engage with your business..."
              />
            </div>
          </div>
        )

      case 8:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Automation & Platform</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Automation Level *</label>
              <div className="space-y-2">
                {automationLevels.map(level => (
                  <label key={level} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="automation_level"
                      value={level}
                      checked={formData.automation_level === level}
                      onChange={(e) => handleInputChange('automation_level', e.target.value)}
                      className="text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 9:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Review & Submit</h3>
            
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-4">Review Your Information</h4>
              <div className="space-y-2 text-sm">
                <p><strong>Business Name:</strong> {formData.business_name}</p>
                <p><strong>Business Type:</strong> {formData.business_type.join(', ')}</p>
                <p><strong>Industry:</strong> {formData.industry.join(', ')}</p>
                <p><strong>City:</strong> {formData.city}, {formData.state}, {formData.country}</p>
                <p><strong>Social Platforms:</strong> {formData.social_media_platforms.join(', ')}</p>
                <p><strong>Primary Goals:</strong> {formData.primary_goals.join(', ')}</p>
                <p><strong>Monthly Budget:</strong> {formData.monthly_budget_range}</p>
                <p><strong>Automation Level:</strong> {formData.automation_level}</p>
              </div>
            </div>

            <div className="bg-pink-50 p-4 rounded-lg">
              <p className="text-sm text-pink-800">
                <strong>Ready to get started?</strong> Emily will use this information to provide personalized marketing assistance tailored to your business needs.
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Show completion screen after successful submission
  if (showCompletion) {
    return <OnboardingComplete />
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Emily!</h1>
          <p className="text-gray-600">Let's get to know your business so I can provide personalized marketing assistance.</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-2">
              {steps[currentStep]}
            </h2>
            <p className="text-gray-600">
              {currentStep === 0 && "Tell us about your business basics"}
              {currentStep === 1 && "Help us understand what you do"}
              {currentStep === 2 && "How should we represent your brand?"}
              {currentStep === 3 && "What are your social media goals?"}
              {currentStep === 4 && "What's your content strategy?"}
              {currentStep === 5 && "How do you fit in the market?"}
              {currentStep === 6 && "What campaigns are you planning?"}
              {currentStep === 7 && "What's worked well for you?"}
              {currentStep === 8 && "How automated should your marketing be?"}
              {currentStep === 9 && "Review everything before we start"}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center px-6 py-3 bg-gray-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-pink-600 hover:to-purple-700 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete Onboarding
                </>
              )}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default Onboarding
