import React, { useState, useEffect } from 'react'
import { X, Upload, File, Video, Image as ImageIcon, Trash2, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'

const NewPostModal = ({ isOpen, onClose, onSubmit, isDarkMode }) => {

  const [formData, setFormData] = useState({
    channel: '',
    platform: '',
    content_type: '',
    media: '',
    content_idea: '',
    Post_type: '',
    Image_type: ''
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})
  const [currentStep, setCurrentStep] = useState(0)

  // Define form steps
  const steps = [
    { id: 'channel', label: 'Channel', field: 'channel' },
    { id: 'platform', label: 'Platform', field: 'platform' },
    { id: 'content_type', label: 'Content Type', field: 'content_type' },
    { id: 'media', label: 'Media', field: 'media' },
    { id: 'content_idea', label: 'Content Idea', field: 'content_idea' },
    { id: 'Post_type', label: 'Post Type', field: 'Post_type' },
    { id: 'Image_type', label: 'Image Type', field: 'Image_type', conditional: true },
    { id: 'files', label: 'Upload Files', field: 'files', conditional: true }
  ]

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        channel: '',
        platform: '',
        content_type: '',
        media: '',
        content_idea: '',
        Post_type: '',
        Image_type: ''
      })
      setErrors({})
      setUploadedFiles([])
      setUploadProgress({})
      setCurrentStep(0)
    }
  }, [isOpen])

  // Get available steps based on form data
  const getAvailableSteps = () => {
    const available = []
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      
      // Skip conditional steps if conditions aren't met
      if (step.conditional) {
        if (step.id === 'Image_type' && formData.media !== 'Generate') {
          continue
        }
        if (step.id === 'files' && formData.media !== 'Upload') {
          continue
        }
      }
      
      // Check if step is accessible (previous steps must be completed)
      let isAccessible = true
      for (let j = 0; j < i; j++) {
        const prevStep = steps[j]
        if (prevStep.conditional) {
          if (prevStep.id === 'Image_type' && formData.media !== 'Generate') continue
          if (prevStep.id === 'files' && formData.media !== 'Upload') continue
        }
        if (!formData[prevStep.field] && prevStep.field !== 'files') {
          isAccessible = false
          break
        }
      }
      
      if (isAccessible) {
        available.push({ ...step, index: available.length })
      }
    }
    
    return available
  }

  const availableSteps = getAvailableSteps()

  // Update current step index when available steps change
  useEffect(() => {
    // If current step index is out of bounds, adjust to last valid step
    if (currentStep >= availableSteps.length && availableSteps.length > 0) {
      setCurrentStep(availableSteps.length - 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableSteps.length])

  const [modalCenter, setModalCenter] = useState({ x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0 })

  useEffect(() => {
    if (!isOpen) return

    const updateCenter = () => {
      const mainEl = document.querySelector('[data-main-content]') || document.body
      const rect = mainEl.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      setModalCenter({ x: centerX, y: centerY })
    }

    // initial
    updateCenter()

    // update on resize
    window.addEventListener('resize', updateCenter)
    return () => window.removeEventListener('resize', updateCenter)
  }, [isOpen])

  const [lastChangedField, setLastChangedField] = useState(null)

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value }

      // Reset dependent fields when parent field changes
      if (field === 'channel') {
        newData.platform = ''
        newData.content_type = ''
        newData.media = ''
      } else if (field === 'platform') {
        newData.content_type = ''
        if (value === 'Instagram' && prev.media === 'Without media') {
          newData.media = ''
        } else {
          newData.media = ''
        }
      } else if (field === 'content_type') {
        const isVideoType = value === 'short_video or reel' || value === 'long_video'
        const wasVideoType = prev.content_type === 'short_video or reel' || prev.content_type === 'long_video'
        
        if (isVideoType !== wasVideoType || (isVideoType && prev.media === 'Generate')) {
          newData.media = ''
          newData.Image_type = ''
          setUploadedFiles([])
          setUploadProgress({})
        } else if (prev.media === 'Generate') {
          newData.Image_type = ''
        }
      } else if (field === 'media') {
        newData.Image_type = ''
        if (value !== 'Upload') {
          setUploadedFiles([])
          setUploadProgress({})
        }
      }

      return newData
    })

    // Clear error when field is filled
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }))
    }

    // Track the field that was just changed for auto-advance
    if (value && value.trim() !== '') {
      setLastChangedField(field)
    }
  }

  // Auto-advance when a dropdown field is completed
  useEffect(() => {
    if (!lastChangedField) return

    const currentStepField = availableSteps[currentStep]?.field
    if (lastChangedField !== currentStepField) {
      setLastChangedField(null)
      return
    }

    // Only auto-advance for dropdown fields (not textarea)
    const dropdownFields = ['channel', 'platform', 'content_type', 'media', 'Post_type', 'Image_type']
    if (dropdownFields.includes(lastChangedField)) {
      const timer = setTimeout(() => {
        if (currentStep < availableSteps.length - 1) {
          setCurrentStep(prev => prev + 1)
        }
        setLastChangedField(null)
      }, 300)
      return () => clearTimeout(timer)
    } else {
      setLastChangedField(null)
    }
  }, [lastChangedField, currentStep, availableSteps])

  const handleTextareaKeyDown = (e, field) => {
    // Auto-advance on Enter (but not Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const value = e.target.value.trim()
      if (value.length > 0) {
        handleInputChange(field, value)
        // Advance to next step
        setTimeout(() => {
          if (currentStep < availableSteps.length - 1) {
            setCurrentStep(prev => prev + 1)
          }
        }, 100)
      }
    }
  }

  const uploadFileImmediately = async (fileObj) => {
    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', fileObj.file)

      const token = localStorage.getItem('authToken')
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/upload-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataUpload
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Upload failed response:', response.status, errorText)
        throw new Error(`Upload failed: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { ...f, url: result.url, uploading: false } : f
      ))

      return result.url
    } catch (error) {
      console.error(`Failed to upload ${fileObj.name}:`, error)
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { ...f, uploading: false, error: true } : f
      ))
      throw error
    }
  }

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files)

    const maxSize = 300 * 1024 * 1024
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'
    ]

    const validFiles = []
    const errors = []

    files.forEach((file, index) => {
      if (file.size > maxSize) {
        errors.push(`${file.name}: File size must be less than 300MB`)
        return
      }

      if (!allowedTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only images and videos are allowed`)
        return
      }

      validFiles.push({
        file,
        id: Date.now() + index,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploading: true,
        error: false
      })
    })

    if (errors.length > 0) {
      setErrors(prev => ({ ...prev, files: errors }))
      return
    }

    setUploadedFiles(prev => [...prev, ...validFiles])
    setErrors(prev => ({ ...prev, files: null }))

    for (const fileObj of validFiles) {
      try {
        await uploadFileImmediately(fileObj)
      } catch (error) {
        // Error already handled
      }
    }

    event.target.value = ''
  }

  const removeFile = (fileId) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(file => file.id !== fileId)
      const removedFile = prev.find(file => file.id === fileId)
      if (removedFile) {
        URL.revokeObjectURL(removedFile.url)
      }
      return updated
    })
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="w-8 h-8 text-blue-500" />
    } else if (fileType.startsWith('video/')) {
      return <Video className="w-8 h-8 text-red-500" />
    }
    return <File className="w-8 h-8 text-gray-500" />
  }

  const validateCurrentStep = () => {
    const step = availableSteps[currentStep]
    if (!step) return true

    const newErrors = {}

    if (step.field === 'files') {
      if (uploadedFiles.length === 0) {
        newErrors.files = 'Please upload at least one file'
      } else {
        const uploadingFiles = uploadedFiles.filter(f => f.uploading)
        const errorFiles = uploadedFiles.filter(f => f.error)
        if (uploadingFiles.length > 0) {
          newErrors.files = 'Please wait for all files to finish uploading'
        } else if (errorFiles.length > 0) {
          newErrors.files = 'Some files failed to upload. Please remove them and try again'
        }
      }
    } else if (step.field === 'content_idea') {
      if (!formData.content_idea.trim()) {
        newErrors.content_idea = 'Please provide a content idea'
      }
    } else {
      if (!formData[step.field]) {
        newErrors[step.field] = `Please ${step.field === 'Post_type' ? 'select a post type' : step.field === 'Image_type' ? 'select an image style' : `select ${step.label.toLowerCase()}`}`
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      if (currentStep < availableSteps.length - 1) {
        setLastChangedField(null) // Reset to prevent auto-advance
        setCurrentStep(prev => prev + 1)
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setLastChangedField(null) // Reset to prevent auto-advance
      setCurrentStep(prev => prev - 1)
    }
  }

  const validateForm = () => {
    const newErrors = {}

    if (!formData.channel) newErrors.channel = 'Please select a channel'
    if (!formData.platform) newErrors.platform = 'Please select a platform'
    if (!formData.content_type) newErrors.content_type = 'Please select content type'
    if (!formData.media) newErrors.media = 'Please select media option'
    if (!formData.content_idea.trim()) {
      newErrors.content_idea = 'Please provide a content idea'
    }
    if (!formData.Post_type) newErrors.Post_type = 'Please select a post type'
    if (formData.media === 'Generate' && !formData.Image_type) {
      newErrors.Image_type = 'Please select an image type'
    }
    if (formData.media === 'Upload') {
      if (uploadedFiles.length === 0) {
        newErrors.files = 'Please upload at least one file'
      } else {
        const uploadingFiles = uploadedFiles.filter(f => f.uploading)
        const errorFiles = uploadedFiles.filter(f => f.error)
        if (uploadingFiles.length > 0) {
          newErrors.files = 'Please wait for all files to finish uploading'
        } else if (errorFiles.length > 0) {
          newErrors.files = 'Some files failed to upload. Please remove them and try again'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      // Find first error step and go to it
      const errorFields = Object.keys(errors)
      if (errorFields.length > 0) {
        const errorStepIndex = availableSteps.findIndex(step => 
          step.field === errorFields[0] || (errorFields[0] === 'files' && step.field === 'files')
        )
        if (errorStepIndex !== -1) {
          setCurrentStep(errorStepIndex)
        }
      }
      return
    }

    setIsSubmitting(true)

    try {
      const uploadedFileUrls = uploadedFiles
        .filter(file => file.url && !file.error)
        .map(file => ({
          url: file.url,
          name: file.name,
          type: file.type,
          size: file.size
        }))

      const payload = {
        channel: formData.channel,
        platform: formData.platform,
        content_type: formData.content_type,
        media: formData.media,
        content_idea: formData.content_idea.trim(),
        Post_type: formData.Post_type,
        ...(formData.media === 'Generate' && { Image_type: formData.Image_type }),
        ...(uploadedFileUrls.length > 0 && { uploaded_files: uploadedFileUrls })
      }

      await onSubmit(payload)
      onClose()
    } catch (error) {
      console.error('Error submitting form:', error)
      setErrors({ submit: 'Failed to create post. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const channelOptions = [
    { label: 'Social Media', value: 'Social Media' },
    { label: 'Blog', value: 'Blog' }
  ]

  const platformOptions = [
    { label: 'Instagram', value: 'Instagram' },
    { label: 'Facebook', value: 'Facebook' },
    { label: 'LinkedIn', value: 'LinkedIn' },
    { label: 'YouTube', value: 'YouTube' }
  ]

  const contentTypeOptions = [
    { label: 'Static Post', value: 'static_post' },
    { label: 'Carousel', value: 'carousel' },
    { label: 'Short Video/Reel', value: 'short_video or reel' },
    { label: 'Long Video', value: 'long_video' },
    { label: 'Blog Post', value: 'blog' }
  ]

  const mediaOptions = [
    { label: 'Generate Media', value: 'Generate' },
    { label: 'Upload My Own', value: 'Upload' },
    { label: 'Text Only', value: 'Without media' }
  ]

  const postTypeOptions = [
    'Educational tips',
    'Quote / motivation',
    'Promotional offer',
    'Product showcase',
    'Carousel infographic',
    'Announcement',
    'Testimonial / review',
    'Before–after',
    'Behind-the-scenes',
    'User-generated content',
    'Brand story',
    'Meme / humor',
    'Facts / did-you-know',
    'Event highlight',
    'Countdown',
    'FAQ post',
    'Comparison',
    'Case study snapshot',
    'Milestone / achievement',
    'Call-to-action post'
  ]

  const imageTypeOptions = [
    'Minimal & Clean with Bold Typography',
    'Modern Corporate / B2B Professional',
    'Luxury Editorial (Black, White, Gold Accents)',
    'Photography-Led Lifestyle Aesthetic',
    'Product-Focused Clean Commercial Style',
    'Flat Illustration with Friendly Characters',
    'Isometric / Explainer Illustration Style',
    'Playful & Youthful (Memphis / Stickers / Emojis)',
    'High-Impact Color-Blocking with Loud Type',
    'Retro / Vintage Poster Style',
    'Futuristic Tech / AI-Inspired Dark Mode',
    'Glassmorphism / Neumorphism UI Style',
    'Abstract Shapes & Fluid Gradient Art',
    'Infographic / Data-Driven Educational Layout',
    'Quote Card / Thought-Leadership Typography Post',
    'Meme-Style / Social-Native Engagement Post',
    'Festive / Campaign-Based Creative',
    'Textured Design (Paper, Grain, Handmade Feel)',
    'Magazine / Editorial Layout with Strong Hierarchy',
    'Experimental / Artistic Concept-Driven Design'
  ]

  const getFilteredPlatformOptions = () => {
    if (formData.channel === 'Blog') {
      return [{ label: 'Blog', value: 'Blog' }]
    }
    return platformOptions
  }

  const getFilteredContentTypeOptions = () => {
    if (formData.channel === 'Blog') {
      return [{ label: 'Blog Post', value: 'blog' }]
    }
    return contentTypeOptions.filter(option => option.value !== 'blog')
  }

  const getFilteredMediaOptions = () => {
    let filtered = [...mediaOptions]
    
    if (formData.content_type === 'short_video or reel' || formData.content_type === 'long_video') {
      filtered = filtered.filter(option => 
        option.value === 'Upload' || option.value === 'Without media'
      )
    }
    
    if (formData.platform === 'Instagram') {
      filtered = filtered.filter(option => option.value !== 'Without media')
    }
    
    return filtered
  }

  const renderStepContent = () => {
    const step = availableSteps[currentStep]
    if (!step) return null

    const isCompleted = step.field === 'files' 
      ? uploadedFiles.length > 0 && uploadedFiles.every(f => !f.uploading && !f.error)
      : formData[step.field] && formData[step.field].trim() !== ''

    switch (step.field) {
      case 'channel':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Channel
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Choose the channel where you want to publish your content
            </p>
            <select
              value={formData.channel}
              onChange={(e) => handleInputChange('channel', e.target.value)}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select a channel...</option>
              {channelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.channel && <p className="text-sm text-red-500">{errors.channel}</p>}
          </div>
        )

      case 'platform':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Platform
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Choose the platform for your content
            </p>
            <select
              value={formData.platform}
              onChange={(e) => handleInputChange('platform', e.target.value)}
              disabled={!formData.channel}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {!formData.channel ? 'Select a channel first...' : 'Select a platform...'}
              </option>
              {getFilteredPlatformOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.platform && <p className="text-sm text-red-500">{errors.platform}</p>}
          </div>
        )

      case 'content_type':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Content Type
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              What type of content are you creating?
            </p>
            <select
              value={formData.content_type}
              onChange={(e) => handleInputChange('content_type', e.target.value)}
              disabled={!formData.platform}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {!formData.platform ? 'Select a platform first...' : 'Select content type...'}
              </option>
              {getFilteredContentTypeOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.content_type && <p className="text-sm text-red-500">{errors.content_type}</p>}
          </div>
        )

      case 'media':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Media Option
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              How would you like to handle media for this post?
            </p>
            <select
              value={formData.media}
              onChange={(e) => handleInputChange('media', e.target.value)}
              disabled={!formData.content_type}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 disabled:bg-gray-800 disabled:text-gray-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">
                {!formData.content_type ? 'Select content type first...' : 'Select media option...'}
              </option>
              {getFilteredMediaOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.media && <p className="text-sm text-red-500">{errors.media}</p>}
          </div>
        )

      case 'content_idea':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Describe Your Content Idea
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Tell us what you want to communicate. Who is your audience? What action do you want them to take?
            </p>
            <textarea
              value={formData.content_idea}
              onChange={(e) => handleInputChange('content_idea', e.target.value)}
              onKeyDown={(e) => handleTextareaKeyDown(e, 'content_idea')}
              placeholder="Describe your content idea in detail... (Press Enter to continue)"
              rows={6}
              className={`w-full px-4 py-3 rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            />
            <div className="flex justify-between items-center">
              <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {formData.content_idea.split(/\s+/).filter(word => word.length > 0).length} words
              </span>
              {errors.content_idea && <p className="text-sm text-red-500">{errors.content_idea}</p>}
            </div>
          </div>
        )

      case 'Post_type':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Post Type
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              What category best describes your post?
            </p>
            <select
              value={formData.Post_type}
              onChange={(e) => handleInputChange('Post_type', e.target.value)}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select a post type...</option>
              {postTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.Post_type && <p className="text-sm text-red-500">{errors.Post_type}</p>}
          </div>
        )

      case 'Image_type':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Select Image Style
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Choose the visual style for your generated image
            </p>
            <select
              value={formData.Image_type}
              onChange={(e) => handleInputChange('Image_type', e.target.value)}
              className={`w-full px-4 py-4 text-lg rounded-lg border transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500'
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none focus:ring-2 focus:ring-blue-500/20`}
            >
              <option value="">Select an image style...</option>
              {imageTypeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {errors.Image_type && <p className="text-sm text-red-500">{errors.Image_type}</p>}
          </div>
        )

      case 'files':
        return (
          <div className="space-y-4">
            <h3 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Upload Your Media Files
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Upload images or videos for your post (up to 300MB each)
            </p>
            
            <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDarkMode
                ? 'border-gray-600 hover:border-gray-500'
                : 'border-gray-300 hover:border-gray-400'
            }`}>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className={`w-16 h-16 mx-auto mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className={`text-lg font-normal mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Click to upload files
                </p>
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Images and videos up to 300MB each
                </p>
              </label>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className={`text-sm font-normal ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Uploaded Files ({uploadedFiles.length})
                </h4>
                <div className="space-y-2">
                  {uploadedFiles.map((fileObj) => (
                    <div
                      key={fileObj.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        fileObj.error
                          ? 'border-red-300 bg-red-50'
                          : isDarkMode
                            ? 'bg-gray-700 border-gray-600'
                            : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {getFileIcon(fileObj.type)}
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            fileObj.error
                              ? 'text-red-700'
                              : isDarkMode ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            {fileObj.name}
                          </p>
                          <div className="flex items-center space-x-2">
                            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              {formatFileSize(fileObj.size)}
                            </p>
                            {fileObj.uploading && (
                              <span className="text-xs text-blue-600 flex items-center">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600 mr-1"></div>
                                Uploading...
                              </span>
                            )}
                            {fileObj.error && (
                              <span className="text-xs text-red-600">Upload failed</span>
                            )}
                            {!fileObj.uploading && !fileObj.error && fileObj.url && (
                              <span className="text-xs text-green-600">✓ Uploaded</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(fileObj.id)}
                        disabled={fileObj.uploading}
                        className={`p-1 rounded-md transition-colors ${
                          fileObj.uploading
                            ? 'opacity-50 cursor-not-allowed'
                            : isDarkMode
                              ? 'hover:bg-gray-600 text-gray-400'
                              : 'hover:bg-gray-200 text-gray-500'
                        }`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {errors.files && (
              <div className="mt-2">
                {Array.isArray(errors.files) ? (
                  errors.files.map((error, index) => (
                    <p key={index} className="text-sm text-red-500">{error}</p>
                  ))
                ) : (
                  <p className="text-sm text-red-500">{errors.files}</p>
                )}
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  if (!isOpen) return null

  const isLastStep = currentStep === availableSteps.length - 1
  const canGoNext = () => {
    const step = availableSteps[currentStep]
    if (!step) return false
    if (step.field === 'files') {
      return uploadedFiles.length > 0 && uploadedFiles.every(f => !f.uploading && !f.error)
    }
    if (step.field === 'content_idea') {
      return formData.content_idea.trim().length > 0
    }
    return formData[step.field] && formData[step.field].trim() !== ''
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal positioned relative to main content center */}
      <div
        style={{
          position: 'fixed',
          left: modalCenter.x,
          top: modalCenter.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 9999
        }}
        className={`w-full max-w-4xl max-h-[95vh] overflow-hidden rounded-2xl shadow-2xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <h2 className={`text-xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Design a New Post
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline (moved below form content) */}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-8">
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="w-full max-w-2xl">
              {renderStepContent()}
            </div>
          </div>

          {/* Slider dots only (show 3 at once) */}
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-3">
              {(() => {
                const total = availableSteps.length
                if (total === 0) return null
                let start = Math.max(0, currentStep - 1)
                if (start > Math.max(0, total - 3)) start = Math.max(0, total - 3)
                const visible = availableSteps.slice(start, start + 3)

                return visible.map((step) => {
                  const index = step.index
                  const isActive = index === currentStep
                  const isCompleted = index < currentStep || (
                    step.field === 'files'
                      ? uploadedFiles.length > 0 && uploadedFiles.every(f => !f.uploading && !f.error)
                      : formData[step.field] && formData[step.field].trim() !== ''
                  )
                  const isAccessible = index <= currentStep || isCompleted

                  const dotClass = isActive
                    ? 'w-3.5 h-3.5 rounded-full bg-blue-600'
                    : isCompleted
                      ? 'w-3 h-3 rounded-full bg-green-500'
                      : `w-2.5 h-2.5 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (isAccessible) {
                          setLastChangedField(null)
                          setCurrentStep(index)
                        }
                      }}
                      className={`${dotClass} focus:outline-none transition-all`}
                      aria-label={step.label}
                      title={step.label}
                    />
                  )
                })
              })()}
            </div>
          </div>

          {/* Error Messages */}
          {errors.submit && (
            <div className={`mt-4 p-3 rounded-lg ${
              isDarkMode ? 'bg-red-900/30 border border-red-700' : 'bg-red-50 border border-red-200'
            }`}>
              <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>
                {errors.submit}
              </p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={currentStep > 0 ? handlePrevious : onClose}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              {currentStep > 0 ? 'Previous' : 'Cancel'}
            </button>

            {isLastStep ? (
              <button
                type="submit"
                disabled={isSubmitting || !canGoNext()}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isSubmitting ? 'Creating...' : 'Create Post'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext()}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-colors ${
                  canGoNext()
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

export default NewPostModal
