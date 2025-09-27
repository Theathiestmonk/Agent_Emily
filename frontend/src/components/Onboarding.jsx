import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { onboardingAPI } from '../services/onboarding'
import OnboardingComplete from './OnboardingComplete'
import OnboardingConnections from './OnboardingConnections'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import LogoUpload from './LogoUpload'

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [userNavigatedToStep0, setUserNavigatedToStep0] = useState(false)
  const [formData, setFormData] = useState({
    business_name: '',
    business_type: [],
    industry: [],
    business_description: '',
    logo_url: '',
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
    // New fields for comprehensive onboarding
    target_audience_age_groups: [],
    target_audience_life_stages: [],
    target_audience_professional_types: [],
    target_audience_lifestyle_interests: [],
    target_audience_buyer_behavior: [],
    target_audience_other: '',
    platform_tone_instagram: [],
    platform_tone_facebook: [],
    platform_tone_linkedin: [],
    platform_tone_youtube: [],
    platform_tone_x: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoError, setLogoError] = useState('')
  const [showCompletion, setShowCompletion] = useState(false)
  const [showConnections, setShowConnections] = useState(false)

  // Logo handling functions
  const handleLogoUpload = (url) => {
    setLogoUrl(url)
    setLogoError('')
    handleInputChange('logo_url', url)
  }

  const handleLogoError = (error) => {
    setLogoError(error)
  }
  
  // State for "Other" input fields
  const [otherInputs, setOtherInputs] = useState({
    businessTypeOther: '',
    industryOther: '',
    socialPlatformOther: '',
    goalOther: '',
    metricOther: '',
    contentTypeOther: '',
    contentThemeOther: '',
    postingTimeOther: '',
    targetAudienceOther: '',
    currentPresenceOther: '',
    topPerformingContentTypeOther: ''
  })

  // State for Meta Ads sub-options
  const [metaAdsSubOptions, setMetaAdsSubOptions] = useState({
    facebookAds: false,
    instagramAds: false
  })

  // State for expandable cards
  const [expandedCards, setExpandedCards] = useState({
    ageGroups: false,
    lifeStages: false,
    professionalTypes: false,
    lifestyleInterests: false,
    buyerBehavior: false,
    other: false
  })
  
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()


  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  const steps = [
    'Basic Business Info',
    'Business Description', 
    'Brand & Contact',
    'Current Presence & Focus Areas',
    'Social Media & Goals',
    'Content Strategy',
    'Market & Competition',
    'Campaign Planning',
    'Performance & Customer',
    'Automation & Platform',
    'Review & Submit'
  ]

  // Load saved data from localStorage on component mount
  useEffect(() => {
    const savedFormData = localStorage.getItem('onboarding_form_data')
    const savedCurrentStep = localStorage.getItem('onboarding_current_step')
    const savedCompletedSteps = localStorage.getItem('onboarding_completed_steps')
    
    console.log('Loading from localStorage:', {
      savedFormData: savedFormData ? 'exists' : 'null',
      savedCurrentStep,
      savedCompletedSteps: savedCompletedSteps ? 'exists' : 'null'
    })
    
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData)
        console.log('Loaded form data:', parsedData)
        // Force update form data if we have meaningful data
        if (parsedData.business_name || parsedData.business_type?.length > 0 || parsedData.industry?.length > 0) {
          console.log('Updating form data with loaded data')
          setFormData(parsedData) // Use parsedData directly instead of merging
        }
      } catch (error) {
        console.error('Error parsing saved form data:', error)
      }
    }
    
    if (savedCurrentStep) {
      const step = parseInt(savedCurrentStep, 10)
      console.log('Parsed saved current step:', step, 'from localStorage:', savedCurrentStep)
      if (step >= 0 && step < 11) { // Use fixed number instead of steps.length
        console.log('Setting current step to:', step)
        setCurrentStep(step)
      } else {
        console.log('Invalid step number:', step, 'keeping default 0')
      }
    } else {
      console.log('No saved current step found, keeping default 0')
    }
    
    if (savedCompletedSteps) {
      try {
        const parsedSteps = JSON.parse(savedCompletedSteps)
        console.log('Loaded completed steps:', parsedSteps)
        setCompletedSteps(new Set(parsedSteps))
      } catch (error) {
        console.error('Error parsing completed steps:', error)
      }
    }
  }, []) // Empty dependency array - only run on mount

  // Auto-determine current step based on data after form data loads
  useEffect(() => {
    // Don't auto-redirect if user manually navigated to step 0
    if (userNavigatedToStep0) return
    
    if (formData.business_name || formData.business_type?.length > 0) {
      const highestStepWithData = getHighestStepWithData()
      const nextStep = highestStepWithData + 1
      
      console.log('Auto-determining step based on data:', {
        highestStepWithData,
        nextStep,
        currentStep
      })
      
      // Only auto-redirect if we're on step 0 and have data (initial load)
      if (currentStep === 0 && highestStepWithData >= 0) {
        const targetStep = Math.min(nextStep, steps.length - 1)
        console.log('Moving to step based on data:', targetStep)
        setCurrentStep(targetStep)
      }
    }
  }, [formData, currentStep, steps.length, userNavigatedToStep0])

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    console.log('Saving form data to localStorage:', formData)
    localStorage.setItem('onboarding_form_data', JSON.stringify(formData))
  }, [formData])

  // Save current step to localStorage whenever it changes
  useEffect(() => {
    console.log('Saving current step to localStorage:', currentStep)
    localStorage.setItem('onboarding_current_step', currentStep.toString())
  }, [currentStep])


  // Save completed steps to localStorage whenever it changes
  useEffect(() => {
    console.log('Saving completed steps to localStorage:', [...completedSteps])
    localStorage.setItem('onboarding_completed_steps', JSON.stringify([...completedSteps]))
  }, [completedSteps])


  const businessTypes = [
    'B2B', 'B2C', 'E-Commerce', 'SaaS', 'Restaurant', 
    'Service-based', 'Franchise', 'Marketplace', 'D2C', 'Other'
  ]

  const industries = [
    'Technology/IT', 'Retail/E-commerce', 'Education/eLearning', 'Healthcare/Wellness', 
    'Fashion/Apparel', 'Food & Beverage', 'Travel & Hospitality', 'Finance/Fintech/Insurance', 
    'Construction/Infrastructure', 'Automobile/Mobility', 'Media/Entertainment/Creators', 
    'Real Estate', 'Logistics/Supply Chain', 'Manufacturing/Industrial', 'Professional Services', 
    'Non-Profit/NGO/Social Enterprise', 'Others'
  ]

  const socialPlatforms = [
    'Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'Pinterest', 
    'X (Twitter)', 'TikTok', 'WhatsApp Business', 'Google Business Profile', 
    'Snapchat', 'Quora', 'Reddit', 'Other'
  ]

  const goals = [
    'Increase Sales', 'Brand Awareness', 'Website Traffic', 'Lead Generation', 
    'Community Building', 'Customer Engagement', 'Other'
  ]

  const metrics = [
    'Followers', 'Likes', 'Clicks', 'Engagement Rate', 'Leads', 'Shares', 
    'Comments', 'Conversions', 'Website Traffic/Visitors', 'Not sure — let Emily decide', 'Other'
  ]

  const budgetRanges = [
    '₹0–₹5,000', '₹5,000–₹10,000', '₹10,000–₹25,000', 
    '₹25,000–₹50,000', '₹50,000+'
  ]

  const postingFrequencies = [
    'Daily', '3x/Week', 'Weekly', 'Bi-Weekly', 'Bi monthly', 'Monthly', 'Manual'
  ]

  const contentTypes = [
    'Image Posts', 'Reels', 'Carousels', 'Stories', 'Blogs', 'Videos', 
    'Live Sessions', 'Other'
  ]

  const contentThemes = [
    'Product Features', 'Behind the Scenes', 'Customer Stories', 'Tips & Tricks', 
    'Educational', 'Announcements', 'User-Generated Content', 'Inspirational', 
    'Entertaining', 'Not sure', 'Others'
  ]

  const postingTimes = [
    'Early Morning (6 AM – 9 AM)', 'Mid-Morning (9 AM – 12 PM)', 'Afternoon (12 PM – 3 PM)', 
    'Late Afternoon (3 PM – 6 PM)', 'Evening (6 PM – 9 PM)', 'Late Night (9 PM – 12 AM)', 
    'Weekdays', 'Weekends', 'Not sure — let Emily analyze and suggest', 'Other'
  ]

  const marketPositions = [
    { value: 'Niche Brand', label: 'Niche Brand', description: 'Focused on a specific target audience' },
    { value: 'Challenger Brand', label: 'Challenger Brand', description: 'Competing against bigger or more known players' },
    { value: 'Market Leader', label: 'Market Leader', description: 'Top brand in your category or region' },
    { value: 'New Entrant/Startup', label: 'New Entrant / Startup', description: 'Launched within the last 1-2 years' },
    { value: 'Established Business', label: 'Established Business', description: 'Steady brand with moderate presence' },
    { value: 'Disruptor/Innovator', label: 'Disruptor / Innovator', description: 'Bringing something new or different to the market' },
    { value: 'Local Business', label: 'Local Business', description: 'Serving a city or region' },
    { value: 'Online-Only Business', label: 'Online-Only Business', description: 'No physical presence' },
    { value: 'Franchise/Multi-location Business', label: 'Franchise / Multi-location Business', description: 'Multiple locations or franchise model' },
    { value: 'Not Sure — Need Help Positioning', label: 'Not Sure — Need Help Positioning', description: 'Need assistance determining market position' }
  ]

  const brandVoices = [
    'Professional', 'Conversational', 'Friendly', 'Bold', 'Playful', 
    'Approachable/Trustworthy', 'Sophisticated/Elegant', 'Quirky/Offbeat', 
    'Confident', 'Not sure yet'
  ]

  const brandTones = [
    'Formal', 'Informal', 'Humorous', 'Inspirational', 'Empathetic', 
    'Encouraging', 'Direct', 'Flexible'
  ]

  const timezones = [
    'Asia/Kolkata', 'Asia/Dubai', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 
    'America/Los_Angeles', 'America/Chicago', 'America/Toronto', 
    'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland'
  ]

  const automationLevels = [
    { 
      value: 'Full Automation – I want Emily to do everything', 
      label: 'Full Automation', 
      description: 'I want Emily to do everything automatically' 
    },
    { 
      value: 'Suggestions Only – I will take action manually', 
      label: 'Suggestions Only', 
      description: 'I will take action manually based on Emily\'s suggestions' 
    },
    { 
      value: 'Manual Approval Before Posting', 
      label: 'Manual Approval', 
      description: 'Emily creates content but I approve before posting' 
    },
    { 
      value: 'Hybrid (platform/content-based mix – specify later)', 
      label: 'Hybrid Approach', 
      description: 'Mix of automation and manual control (platform/content-based)' 
    },
    { 
      value: 'Not sure – need help deciding', 
      label: 'Not Sure', 
      description: 'Need help deciding the best automation level' 
    }
  ]

  const currentPresenceOptions = [
    'Website', 'Facebook Page', 'Instagram', 'LinkedIn', 'X (formerly Twitter)', 
    'YouTube', 'WhatsApp Business', 'Google Business Profile', 'Google Ads', 
    'Meta Ads (Facebook/Instagram)', 'Email Marketing Platform', 'Other'
  ]

  const focusAreas = [
    'SEO', 'Blog/Article Writing', 'Website Optimization/Copywriting', 
    'Social Media Marketing (Organic Growth)', 'Paid Advertising', 
    'Email Marketing & Campaigns', 'YouTube/Video Marketing', 'Influencer Marketing', 
    'PPC', 'Lead Generation Campaigns', 'Brand Awareness', 'Local SEO/Maps Presence', 
    'Customer Retargeting', 'Not Sure – Let Emily suggest the best path'
  ]

  const targetAudienceCategories = {
    ageGroups: [
      'Teens (13–19)', 'College Students/Youth (18–24)', 'Young Professionals (25–35)', 
      'Working Adults (30–50)', 'Seniors/Retirees (60+)', 'Kids/Children (0–12)'
    ],
    lifeStages: [
      'Students', 'Parents/Families', 'Newlyweds/Couples', 'Homeowners/Renters', 'Retired Individuals'
    ],
    professionalTypes: [
      'Business Owners/Entrepreneurs', 'Corporate Clients/B2B Buyers', 'Freelancers/Creators', 
      'Government Employees', 'Educators/Trainers', 'Job Seekers/Career Switchers', 'Writers and Journalists'
    ],
    lifestyleInterests: [
      'Fitness Enthusiasts', 'Outdoor/Adventure Lovers', 'Fashion/Beauty Conscious', 
      'Health-Conscious/Wellness Seekers', 'Pet Owners', 'Tech Enthusiasts/Gamers', 'Travelers/Digital Nomads'
    ],
    buyerBehavior: [
      'Premium Buyers/High-Income Consumers', 'Budget-Conscious Shoppers', 'Impulse Buyers', 
      'Ethical/Sustainable Shoppers', 'Frequent Online Buyers'
    ],
    other: ['Not Sure', 'Other (please specify)']
  }

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

  const handleOtherInputChange = (field, value) => {
    setOtherInputs(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleMetaAdsSubOptionChange = (option, checked) => {
    setMetaAdsSubOptions(prev => ({
      ...prev,
      [option]: checked
    }))
  }

  const toggleCard = (cardName) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }))
  }

  const getSelectedCount = (field) => {
    return formData[field].length
  }

  const validateCurrentStep = () => {
    switch (currentStep) {
      case 0: // Basic Business Info
        return formData.business_name && formData.business_type.length > 0 && formData.industry.length > 0
      case 1: // Business Description
        return formData.business_description && formData.unique_value_proposition &&
               (formData.target_audience_age_groups.length > 0 || 
                formData.target_audience_life_stages.length > 0 || 
                formData.target_audience_professional_types.length > 0 || 
                formData.target_audience_lifestyle_interests.length > 0 || 
                formData.target_audience_buyer_behavior.length > 0 || 
                formData.target_audience_other)
      case 2: // Brand & Contact
        return formData.brand_voice && formData.brand_tone && formData.phone_number && 
               formData.street_address && formData.city && formData.state && formData.country
      case 3: // Current Presence & Focus Areas
        // If Website is selected, website_url is required
        if (formData.current_presence.includes('Website') && !formData.website_url) {
          return false;
        }
        return true
      case 4: // Social Media & Goals
        return formData.social_media_platforms.length > 0 && formData.primary_goals.length > 0 && 
               formData.key_metrics_to_track.length > 0
      case 5: // Content Strategy
        return formData.preferred_content_types.length > 0 && formData.content_themes.length > 0
      case 6: // Market & Competition
        return formData.market_position && formData.products_or_services
      case 7: // Campaign Planning
        return formData.top_performing_content_types.length > 0 && formData.best_time_to_post.length > 0
      case 8: // Performance & Customer
        return formData.successful_campaigns && formData.hashtags_that_work_well && 
               formData.customer_pain_points && formData.typical_customer_journey
      case 9: // Automation & Platform
        return formData.automation_level
      case 10: // Review & Submit
        return true // Review step should always allow submission
      default:
        return true
    }
  }

  // Check if a step is accessible based on data entered
  const isStepAccessible = (stepIndex) => {
    if (stepIndex === 0) return true
    
    // Allow current step
    if (stepIndex === currentStep) return true
    
    // Allow any step that has data
    if (hasStepData(stepIndex)) return true
    
    // Allow next step after the highest step with data, but not too far ahead
    const highestStepWithData = getHighestStepWithData()
    if (stepIndex === highestStepWithData + 1 && stepIndex <= currentStep + 1) return true
    
    return false
  }

  // Get the highest step number that has data
  const getHighestStepWithData = () => {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (hasStepData(i)) {
        return i
      }
    }
    return -1 // No steps have data
  }

  // Check if a step has meaningful data
  const hasStepData = (stepIndex) => {
    switch (stepIndex) {
      case 0: // Basic Business Info
        return formData.business_name && formData.business_type.length > 0 && formData.industry.length > 0
      case 1: // Business Description
        return formData.business_description && formData.unique_value_proposition &&
               (formData.target_audience_age_groups.length > 0 || 
                formData.target_audience_life_stages.length > 0 || 
                formData.target_audience_professional_types.length > 0 || 
                formData.target_audience_lifestyle_interests.length > 0 || 
                formData.target_audience_buyer_behavior.length > 0 || 
                formData.target_audience_other)
      case 2: // Brand & Contact
        return formData.brand_voice && formData.brand_tone && formData.phone_number && 
               formData.street_address && formData.city && formData.state && formData.country
      case 3: // Current Presence & Focus Areas
        return formData.current_presence.length > 0 || formData.focus_areas.length > 0
      case 4: // Social Media & Goals
        return formData.social_media_platforms.length > 0 && formData.primary_goals.length > 0 && 
               formData.key_metrics_to_track.length > 0
      case 5: // Content Strategy
        return formData.preferred_content_types.length > 0 && formData.content_themes.length > 0
      case 6: // Market & Competition
        return formData.market_position && formData.products_or_services
      case 7: // Campaign Planning
        return formData.top_performing_content_types.length > 0 && formData.best_time_to_post.length > 0
      case 8: // Performance & Customer
        return formData.successful_campaigns && formData.hashtags_that_work_well && 
               formData.customer_pain_points && formData.typical_customer_journey
      case 9: // Automation & Platform
        return formData.automation_level
      case 10: // Review & Submit
        return false // Review step should not be marked as having data
      default:
        return false
    }
  }

  // Check if a step is completed
  const isStepCompleted = (stepIndex) => {
    return completedSteps.has(stepIndex)
  }

  // Get step status for debugging
  const getStepStatus = (stepIndex) => {
    if (stepIndex === currentStep) return 'current'
    if (hasStepData(stepIndex)) return 'completed'
    if (isStepAccessible(stepIndex)) return 'accessible'
    return 'locked'
  }

  const nextStep = () => {
    console.log('nextStep called, currentStep:', currentStep)
    console.log('validateCurrentStep():', validateCurrentStep())
    console.log('formData:', formData)
    
    if (validateCurrentStep()) {
      // Mark current step as completed
      console.log('Marking step as completed:', currentStep)
      setCompletedSteps(prev => {
        const newSet = new Set([...prev, currentStep])
        console.log('New completed steps:', [...newSet])
        return newSet
      })
      // Move to next step
      const nextStepIndex = Math.min(currentStep + 1, steps.length - 1)
      console.log('Moving to next step:', nextStepIndex)
      setCurrentStep(nextStepIndex)
      setError('')
    } else {
      console.log('Step validation failed')
      setError('Please fill in all required fields before proceeding.')
    }
  }

  // Auto-mark ALL steps with data as completed when form data changes
  useEffect(() => {
    // Only run this after initial load to avoid interfering with step loading
    const timeoutId = setTimeout(() => {
      const stepsWithData = []
      for (let i = 0; i < steps.length; i++) {
        if (hasStepData(i)) {
          stepsWithData.push(i)
        }
      }
      
      if (stepsWithData.length > 0) {
        console.log('Found steps with data:', stepsWithData)
        setCompletedSteps(prev => {
          const newSet = new Set([...prev, ...stepsWithData])
          console.log('Auto-completed steps:', [...newSet])
          return newSet
        })
      }
    }, 100) // Small delay to let initial load complete
    
    return () => clearTimeout(timeoutId)
  }, [formData, steps.length])

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setError('')
  }

  // Function to go to a specific step (with step prevention)
  const goToStep = (stepIndex) => {
    console.log('goToStep called with:', stepIndex)
    console.log('isStepAccessible:', isStepAccessible(stepIndex))
    console.log('hasStepData for step', stepIndex, ':', hasStepData(stepIndex))
    
    if (stepIndex >= 0 && stepIndex < steps.length) {
      // Check if user can navigate to this step
      if (isStepAccessible(stepIndex)) {
        console.log('Navigating to step:', stepIndex)
        
        // Set flag if user manually navigates to step 0
        if (stepIndex === 0) {
          setUserNavigatedToStep0(true)
        }
        
        setCurrentStep(stepIndex)
        setError('')
      } else {
        console.log('Step not accessible')
        setError(`Please complete the previous steps before accessing step ${stepIndex + 1}.`)
      }
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      // Prepare the data for submission
      const submissionData = {
        ...formData,
        // Populate the general target_audience field with all selected target audience details
        target_audience: [
          ...formData.target_audience_age_groups,
          ...formData.target_audience_life_stages,
          ...formData.target_audience_professional_types,
          ...formData.target_audience_lifestyle_interests,
          ...formData.target_audience_buyer_behavior,
          ...(formData.target_audience_other ? [formData.target_audience_other] : [])
        ].filter(Boolean), // Remove any empty values
        
        // Include all "Other" input fields
        business_type_other: otherInputs.businessTypeOther,
        industry_other: otherInputs.industryOther,
        social_platform_other: otherInputs.socialPlatformOther,
        goal_other: otherInputs.goalOther,
        metric_other: otherInputs.metricOther,
        content_type_other: otherInputs.contentTypeOther,
        content_theme_other: otherInputs.contentThemeOther,
        posting_time_other: otherInputs.postingTimeOther,
        current_presence_other: otherInputs.currentPresenceOther,
        top_performing_content_type_other: otherInputs.topPerformingContentTypeOther,
        
        // Include Meta Ads sub-options
        meta_ads_facebook: metaAdsSubOptions.facebookAds,
        meta_ads_instagram: metaAdsSubOptions.instagramAds
      }

      const response = await onboardingAPI.submitOnboarding(submissionData)
      // Clear localStorage after successful submission
      localStorage.removeItem('onboarding_form_data')
      localStorage.removeItem('onboarding_current_step')
      localStorage.removeItem('onboarding_completed_steps')
      // Show connection phase instead of completion
      setShowConnections(true)
    } catch (err) {
      setError(err.message || 'Failed to submit onboarding')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Connection phase handlers
  const handleConnectionComplete = () => {
    setShowConnections(false)
    setShowCompletion(true)
  }

  const handleConnectionSkip = () => {
    setShowConnections(false)
    setShowCompletion(true)
  }

  const handleConnectionBack = () => {
    setShowConnections(false)
    // Reset to last step of onboarding
    setCurrentStep(steps.length - 1)
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
              {formData.business_type.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.businessTypeOther}
                    onChange={(e) => handleOtherInputChange('businessTypeOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify your business type"
                  />
                </div>
              )}
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
              {formData.industry.includes('Others') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.industryOther}
                    onChange={(e) => handleOtherInputChange('industryOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify your industry"
                  />
                </div>
              )}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Business Logo (Optional)</label>
              <LogoUpload
                value={formData.logo_url}
                onUploadSuccess={handleLogoUpload}
                onError={handleLogoError}
                className="max-w-md"
              />
              {logoError && (
                <div className="text-red-600 text-sm mt-2">{logoError}</div>
              )}
            </div>


             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience (Select all that apply) *</label>
               <div className="space-y-4">
                 {/* Age Groups Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('ageGroups')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Age Groups</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {getSelectedCount('target_audience_age_groups')}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.ageGroups ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.ageGroups && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.ageGroups.map(group => (
                           <label key={group} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_age_groups.includes(group)}
                               onChange={(e) => handleArrayChange('target_audience_age_groups', group, e.target.checked)}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{group}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Life Stage / Roles Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('lifeStages')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Life Stage / Roles</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {getSelectedCount('target_audience_life_stages')}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.lifeStages ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.lifeStages && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.lifeStages.map(stage => (
                           <label key={stage} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_life_stages.includes(stage)}
                               onChange={(e) => handleArrayChange('target_audience_life_stages', stage, e.target.checked)}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{stage}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Professional / Business Type Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('professionalTypes')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Professional / Business Type</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {getSelectedCount('target_audience_professional_types')}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.professionalTypes ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.professionalTypes && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.professionalTypes.map(type => (
                           <label key={type} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_professional_types.includes(type)}
                               onChange={(e) => handleArrayChange('target_audience_professional_types', type, e.target.checked)}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{type}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Lifestyle & Interests Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('lifestyleInterests')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Lifestyle & Interests</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {getSelectedCount('target_audience_lifestyle_interests')}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.lifestyleInterests ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.lifestyleInterests && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.lifestyleInterests.map(interest => (
                           <label key={interest} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_lifestyle_interests.includes(interest)}
                               onChange={(e) => handleArrayChange('target_audience_lifestyle_interests', interest, e.target.checked)}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{interest}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Buyer Behavior Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('buyerBehavior')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Buyer Behavior</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {getSelectedCount('target_audience_buyer_behavior')}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.buyerBehavior ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.buyerBehavior && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.buyerBehavior.map(behavior => (
                           <label key={behavior} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_buyer_behavior.includes(behavior)}
                               onChange={(e) => handleArrayChange('target_audience_buyer_behavior', behavior, e.target.checked)}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{behavior}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>

                 {/* Other Card */}
                 <div className="border border-gray-200 rounded-lg">
                   <button
                     type="button"
                     onClick={() => toggleCard('other')}
                     className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors relative"
                   >
                     <span className="text-sm font-medium text-gray-700">Other</span>
                     <div className="flex items-center space-x-2">
                       <span className="w-6 h-6 bg-pink-100 text-pink-600 rounded-full flex items-center justify-center text-xs font-medium">
                         {formData.target_audience_other ? 1 : 0}
                       </span>
                       <svg 
                         className={`w-4 h-4 text-gray-400 transition-transform ${expandedCards.other ? 'rotate-180' : ''}`}
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24"
                       >
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                       </svg>
                     </div>
                   </button>
                   {expandedCards.other && (
                     <div className="px-4 pb-4 border-t border-gray-100">
                       <div className="grid grid-cols-2 gap-2 pt-3">
                         {targetAudienceCategories.other.map(option => (
                           <label key={option} className="flex items-center space-x-2">
                             <input
                               type="checkbox"
                               checked={formData.target_audience_other === option || (option === 'Other (please specify)' && formData.target_audience_other && formData.target_audience_other !== 'Not Sure')}
                               onChange={(e) => {
                                 if (option === 'Not Sure') {
                                   handleInputChange('target_audience_other', e.target.checked ? 'Not Sure' : '')
                                 } else if (option === 'Other (please specify)') {
                                   if (e.target.checked) {
                                     handleInputChange('target_audience_other', 'Other (please specify)')
                                   } else {
                                     handleInputChange('target_audience_other', '')
                                   }
                                 }
                               }}
                               className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                             />
                             <span className="text-sm text-gray-700">{option}</span>
                           </label>
                         ))}
                       </div>
                       {formData.target_audience_other === 'Other (please specify)' && (
                         <div className="mt-3">
                           <input
                             type="text"
                             value={otherInputs.targetAudienceOther}
                             onChange={(e) => handleOtherInputChange('targetAudienceOther', e.target.value)}
                             className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                             placeholder="Please specify your target audience"
                           />
                         </div>
                       )}
                     </div>
                   )}
                 </div>
               </div>
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
                <select
                  value={formData.brand_voice}
                  onChange={(e) => handleInputChange('brand_voice', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="">Select brand voice</option>
                  {brandVoices.map(voice => (
                    <option key={voice} value={voice}>{voice}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Brand Tone *</label>
                <select
                  value={formData.brand_tone}
                  onChange={(e) => handleInputChange('brand_tone', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  <option value="">Select brand tone</option>
                  {brandTones.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Street Address *</label>
              <input
                type="text"
                value={formData.street_address}
                onChange={(e) => handleInputChange('street_address', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="123 Main Street, Building Name, Floor/Unit"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Timezone *</label>
              <select
                value={formData.timezone}
                onChange={(e) => handleInputChange('timezone', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">Select timezone</option>
                {timezones.map(timezone => (
                  <option key={timezone} value={timezone}>{timezone}</option>
                ))}
              </select>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Current Presence & Focus Areas</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Presence</label>
              <div className="grid grid-cols-2 gap-2">
                {currentPresenceOptions.map(option => (
                  <label key={option} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.current_presence.includes(option)}
                      onChange={(e) => handleArrayChange('current_presence', option, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
              {formData.current_presence.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.currentPresenceOther || ''}
                    onChange={(e) => handleOtherInputChange('currentPresenceOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify your current presence"
                  />
                </div>
              )}
            </div>

            {/* Platform-Specific Input Fields */}
            {(formData.current_presence.includes('Website') || 
              formData.current_presence.includes('Facebook Page') || 
              formData.current_presence.includes('Instagram') || 
              formData.current_presence.includes('LinkedIn') || 
              formData.current_presence.includes('X (formerly Twitter)') || 
              formData.current_presence.includes('YouTube') || 
              formData.current_presence.includes('Google Business Profile') || 
              formData.current_presence.includes('Google Ads') || 
              formData.current_presence.includes('WhatsApp Business') || 
              formData.current_presence.includes('Email Marketing Platform')) && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-4">Platform Details</h4>
                <div className="space-y-4">
                  {formData.current_presence.includes('Website') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Website URL *</label>
                      <input
                        type="url"
                        value={formData.website_url || ''}
                        onChange={(e) => {
                          let value = e.target.value;
                          handleInputChange('website_url', value);
                        }}
                        onBlur={(e) => {
                          let value = e.target.value;
                          // Ensure https:// on blur if user hasn't added it
                          if (value && !value.startsWith('http://') && !value.startsWith('https://')) {
                            value = 'https://' + value;
                            handleInputChange('website_url', value);
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="https://your-website.com"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">Must start with https://</p>
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Facebook Page') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Facebook Page Link</label>
                      <input
                        type="url"
                        value={formData.facebook_page_name || ''}
                        onChange={(e) => handleInputChange('facebook_page_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., facebook.com/your-business"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Instagram') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Instagram Profile Link</label>
                      <input
                        type="url"
                        value={formData.instagram_profile_link || ''}
                        onChange={(e) => handleInputChange('instagram_profile_link', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., instagram.com/your-business"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('LinkedIn') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">LinkedIn Company Page Link</label>
                      <input
                        type="url"
                        value={formData.linkedin_company_link || ''}
                        onChange={(e) => handleInputChange('linkedin_company_link', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., linkedin.com/company/your-business"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('X (formerly Twitter)') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">X (Twitter) Profile Link</label>
                      <input
                        type="url"
                        value={formData.x_twitter_profile || ''}
                        onChange={(e) => handleInputChange('x_twitter_profile', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., twitter.com/your-business"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('YouTube') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">YouTube Channel Link</label>
                      <input
                        type="url"
                        value={formData.youtube_channel_link || ''}
                        onChange={(e) => handleInputChange('youtube_channel_link', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., youtube.com/@your-business"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Google Business Profile') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Google Business Profile Link</label>
                      <input
                        type="url"
                        value={formData.google_business_profile || ''}
                        onChange={(e) => handleInputChange('google_business_profile', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., maps.google.com/business/..."
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Google Ads') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Google Ads Account Details</label>
                      <input
                        type="text"
                        value={formData.google_ads_account || ''}
                        onChange={(e) => handleInputChange('google_ads_account', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., account ID or email"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('WhatsApp Business') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">WhatsApp Business Details</label>
                      <input
                        type="text"
                        value={formData.whatsapp_business || ''}
                        onChange={(e) => handleInputChange('whatsapp_business', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., business name or mobile number"
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Email Marketing Platform') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Email Marketing Platform</label>
                      <input
                        type="text"
                        value={formData.email_marketing_platform || ''}
                        onChange={(e) => handleInputChange('email_marketing_platform', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                        placeholder="e.g., Mailchimp, ConvertKit, etc."
                      />
                    </div>
                  )}
                  
                  {formData.current_presence.includes('Meta Ads (Facebook/Instagram)') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Meta Ads Account Details</label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={metaAdsSubOptions.facebookAds}
                            onChange={(e) => handleMetaAdsSubOptionChange('facebookAds', e.target.checked)}
                            className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                          />
                          <span className="text-sm text-gray-700">Facebook Ads</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={metaAdsSubOptions.instagramAds}
                            onChange={(e) => handleMetaAdsSubOptionChange('instagramAds', e.target.checked)}
                            className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                          />
                          <span className="text-sm text-gray-700">Instagram Ads</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Focus Areas</label>
              <div className="grid grid-cols-2 gap-2">
                {focusAreas.map(area => (
                  <label key={area} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.focus_areas.includes(area)}
                      onChange={(e) => handleArrayChange('focus_areas', area, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{area}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )

      case 4:
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
              {formData.social_media_platforms.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.socialPlatformOther}
                    onChange={(e) => handleOtherInputChange('socialPlatformOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the social media platform"
                  />
                </div>
              )}
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
              {formData.primary_goals.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.goalOther}
                    onChange={(e) => handleOtherInputChange('goalOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify your primary goal"
                  />
                </div>
              )}
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
              {formData.key_metrics_to_track.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.metricOther}
                    onChange={(e) => handleOtherInputChange('metricOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the metric you want to track"
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 5:
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
              {formData.preferred_content_types.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.contentTypeOther}
                    onChange={(e) => handleOtherInputChange('contentTypeOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the content type"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Content Themes *</label>
              <div className="grid grid-cols-2 gap-2">
                {contentThemes.map(theme => (
                  <label key={theme} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.content_themes.includes(theme)}
                      onChange={(e) => handleArrayChange('content_themes', theme, e.target.checked)}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">{theme}</span>
                  </label>
                ))}
              </div>
              {formData.content_themes.includes('Others') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.contentThemeOther}
                    onChange={(e) => handleOtherInputChange('contentThemeOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the content theme"
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Market & Competition</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Market Position *</label>
              <select
                value={formData.market_position}
                onChange={(e) => handleInputChange('market_position', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">Select market position</option>
                {marketPositions.map(position => (
                  <option key={position.value} value={position.value}>
                    {position.label} - {position.description}
                  </option>
                ))}
              </select>
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

      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Campaign Planning</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Important Launch Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.important_launch_dates}
                  onChange={(e) => handleInputChange('important_launch_dates', e.target.value)}
                  className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

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
              {formData.top_performing_content_types.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.topPerformingContentTypeOther || ''}
                    onChange={(e) => handleOtherInputChange('topPerformingContentTypeOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the top performing content type"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Best Time to Post *</label>
              <div className="grid grid-cols-2 gap-2">
                {postingTimes.map(time => (
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
              {formData.best_time_to_post.includes('Other') && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={otherInputs.postingTimeOther}
                    onChange={(e) => handleOtherInputChange('postingTimeOther', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Please specify the best time to post"
                  />
                </div>
              )}
            </div>
          </div>
        )

      case 8:
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

      case 9:
        return (
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">Automation & Platform</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Automation Level *</label>
              <select
                value={formData.automation_level}
                onChange={(e) => handleInputChange('automation_level', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="">Select automation level</option>
                {automationLevels.map(level => (
                  <option key={level.value} value={level.value}>
                    {level.label} - {level.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platform-Specific Tone (Optional)</label>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tone Settings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'X'].map(platform => (
                      <tr key={platform}>
                        <td className="px-4 py-2 text-sm text-gray-700">{platform}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-4">
                            {['Fun', 'Professional', 'Casual', 'Humorous', 'Bold', 'Neutral'].map(tone => (
                              <label key={tone} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                                <input
                                  type="checkbox"
                                  value={tone}
                                  checked={formData[`platform_tone_${platform.toLowerCase()}`]?.includes(tone) || false}
                                  onChange={(e) => {
                                    const currentTones = formData[`platform_tone_${platform.toLowerCase()}`] || []
                                    if (e.target.checked) {
                                      // Add tone if checked
                                      const newTones = [...currentTones, tone]
                                      handleInputChange(`platform_tone_${platform.toLowerCase()}`, newTones)
                                    } else {
                                      // Remove tone if unchecked
                                      const newTones = currentTones.filter(t => t !== tone)
                                      handleInputChange(`platform_tone_${platform.toLowerCase()}`, newTones)
                                    }
                                  }}
                                  className="text-pink-600 focus:ring-pink-500 rounded"
                                />
                                <span className="text-sm text-gray-700">{tone}</span>
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )

      case 10:
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

  // Show loading while checking user authentication
  if (authLoading) {
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
  if (showConnections) {
    return (
      <OnboardingConnections
        selectedPlatforms={formData.social_media_platforms || []}
        onComplete={handleConnectionComplete}
        onSkip={handleConnectionSkip}
        onBack={handleConnectionBack}
      />
    )
  }

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
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {Math.round(((currentStep + 1) / steps.length) * 100)}% Complete
              </span>
              {/* Auto-saved Indicator */}
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full mr-2 animate-pulse"></div>
                <span className="font-medium">Auto-saved</span>
              </div>
            </div>
          </div>
          
          {/* Step Navigation Dots */}
          <div className="flex justify-center space-x-2 mb-4">
            {steps.map((_, index) => (
              <button
                key={index}
                onClick={() => goToStep(index)}
                disabled={!isStepAccessible(index)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-200 ${
                  index === currentStep
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                    : isStepAccessible(index)
                    ? 'bg-gray-200 text-gray-600 hover:bg-gray-300 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title={`Step ${index + 1}: ${steps[index]}`}
              >
                {hasStepData(index) ? (
                  <Check className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </button>
            ))}
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

          {/* Step Lock Warning */}
          {currentStep > 0 && !isStepAccessible(currentStep) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-600 px-4 py-3 rounded-lg mb-6">
              <div className="flex items-center">
                <Check className="w-5 h-5 text-amber-400 mr-2" />
                <p>
                  This step is locked. Please complete the previous steps to continue.
                </p>
              </div>
            </div>
          )}

          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="flex items-center px-6 py-3 bg-gray-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </button>

          {/* Next/Submit Button */}
          {currentStep === steps.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !validateCurrentStep()}
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
              disabled={!validateCurrentStep()}
              className="flex items-center px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:from-pink-600 hover:to-purple-700 transition-all"
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
