import React, { useState, useEffect } from 'react'
import { X, Upload, File, Video, Image as ImageIcon, Trash2, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import * as tus from 'tus-js-client'

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

  // (Elapsed time display for uploads has been disabled for simpler UX)
  useEffect(() => {
    // No-op effect retained to avoid removing hook order
  }, [uploadedFiles])

  // Get available steps based on form data
  const getAvailableSteps = () => {
    const available = []
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      
        // Skip conditional steps if conditions aren't met
      if (step.conditional) {
        if (step.id === 'Image_type') {
          // Image_type only for Generate media, but not for reel/video
          if (formData.media !== 'Generate' || formData.content_type === 'short_video or reel') {
            continue
          }
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
          if (prevStep.id === 'Image_type' && (formData.media !== 'Generate' || formData.content_type === 'short_video or reel')) continue
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
        const isVideoType = value === 'short_video or reel'
        const wasVideoType = prev.content_type === 'short_video or reel'
        
        if (isVideoType !== wasVideoType) {
          newData.media = ''
          newData.Image_type = ''
          setUploadedFiles([])
          setUploadProgress({})
        } else if (prev.media === 'Generate' && value !== 'short_video or reel') {
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
    const file = fileObj.file
    const isVideo = file.type.startsWith('video/')
    
    try {
      // Refresh session first to ensure we have a valid token
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      
      // If session exists but might be expired, try to refresh it
      if (currentSession) {
        try {
          const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
          if (!refreshError && refreshedSession) {
            console.log('✅ Session refreshed successfully')
          }
        } catch (refreshErr) {
          console.warn('⚠️ Could not refresh session:', refreshErr)
        }
      }
      
      // Get current user from Supabase
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('❌ Auth error:', userError)
        throw new Error('Authentication failed. Please log in again.')
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      
      // Determine path and bucket - use user-uploads for all files
      const bucketName = 'user-uploads'
      const filePath = isVideo 
        ? `${user.id}/reels/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        : `${user.id}/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      console.log(`📤 Uploading to Supabase: ${bucketName}/${filePath}`)
      console.log(`📊 File size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`)

      // Update UI with start time and an initial friendly progress message
      const startTime = Date.now()
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: true, 
          uploadStartTime: startTime,
          progress: isVideo ? 'Preparing video upload...' : 'Preparing upload...' 
        } : f
      ))

      // For videos, use TUS directly from frontend to Supabase for real-time %
      if (isVideo) {
        console.log('🎬 Using TUS upload (frontend → Supabase) for video...')
        return await uploadViaTUS(fileObj)
      }

      // For images and other small files, use direct Supabase upload.
      const isLargeFile = file.size > 30 * 1024 * 1024 // 30MB threshold (affects timeout only)
      // Try direct Supabase upload with a couple of retries on transient network errors
      let retries = 2
      let lastError = null
      let uploadSuccess = false

      while (retries > 0 && !uploadSuccess) {
        try {
          // For large files on potentially slow networks, use a timeout
          const uploadPromise = supabase.storage
            .from(bucketName)
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: file.type
            })

          // Add timeout for large files on slow networks (3G can be very slow)
          let uploadResult
          if (isLargeFile) {
            // For large files, use Promise.race with a 5-minute timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Upload timeout - network too slow')), 5 * 60 * 1000)
            )
            uploadResult = await Promise.race([uploadPromise, timeoutPromise])
          } else {
            uploadResult = await uploadPromise
          }

          const { data, error } = uploadResult

          if (error) {
            // Don't retry on certain errors (e.g., file already exists, auth errors)
            if (error.message?.includes('already exists') || 
                error.message?.includes('duplicate') ||
                error.statusCode === 401 ||
                error.statusCode === 403) {
              throw error
            }
            lastError = error
            throw error
          }

          uploadSuccess = true
          console.log('✅ Upload successful via direct Supabase')
        } catch (error) {
          retries--
          
          // If it's a network/timeout error and we have retries left, try again
          // Otherwise, just fail (we no longer fallback to backend for images)
          const isNetworkError = error.message?.includes('Failed to fetch') || 
                                error.message?.includes('timeout') ||
                                error.message?.includes('network') ||
                                error.name === 'StorageUnknownError'
          
          if (retries === 0 || (isNetworkError && isLargeFile)) {
            console.error('❌ Upload failed after all retries:', error)
            throw lastError || error
          }
          
          // Exponential backoff: wait longer between retries
          const waitTime = 2000 * (2 - retries) // 2s, 4s
          console.log(`⚠️ Upload failed, retrying in ${waitTime/1000}s... (${retries} attempts remaining)`)
          await new Promise(resolve => setTimeout(resolve, waitTime))
        }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get file URL after upload')
      }

      // Update state with Supabase URL
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          url: urlData.publicUrl, 
          uploading: false, 
          progress: null,
          error: false 
        } : f
      ))

      console.log('✅ Upload complete:', urlData.publicUrl)
      return urlData.publicUrl
    } catch (error) {
      console.error(`❌ Failed to upload ${fileObj.name}:`, error)
      
      // Update state to show error
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: false, 
          error: true, 
          progress: null,
          errorMessage: error.message || 'Upload failed. Total file size must be 100MB or less. Please check your connection and try again.'
        } : f
      ))
      
      throw error
    }
  }

  // Helper function to extract project ID from Supabase URL
  const getSupabaseProjectId = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL is not configured')
    }
    
    console.log('🔍 Extracting project ID from Supabase URL:', supabaseUrl)
    
    // Extract project ID from URL: https://xxxxx.supabase.co -> xxxxx
    // Also handle URLs with paths: https://xxxxx.supabase.co/rest/v1/...
    const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
    if (!match || !match[1]) {
      console.error('❌ Failed to extract project ID from URL:', supabaseUrl)
      throw new Error('Could not extract project ID from Supabase URL')
    }
    
    const projectId = match[1]
    console.log('✅ Extracted project ID:', projectId)
    return projectId
  }

  // TUS resumable upload function for large files (> 50MB)
  const uploadViaTUS = async (fileObj) => {
    try {
      if (!fileObj || !fileObj.file) {
        throw new Error('Invalid file object')
      }

      const file = fileObj.file
      const fileSizeMB = file.size / (1024 * 1024)
      
      // Get auth token
      let token = localStorage.getItem('authToken')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          token = session.access_token
        }
      } catch (sessionError) {
        console.warn('Could not get Supabase session:', sessionError)
      }

      if (!token) {
        throw new Error('Authentication required. Please log in to upload files.')
      }

      // Get project ID and construct TUS endpoint
      const projectId = getSupabaseProjectId()
      const bucketName = 'user-uploads'
      
      // Generate file path (same format as backend)
      const fileExt = file.name.split('.').pop() || 'mp4'
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      let userId = 'anonymous'
      try {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id || 'anonymous'
      } catch (e) {
        console.warn('Could not get user ID:', e)
      }
      const filePath = `${userId}/reels/${fileName}`
      
      // TUS endpoint - base endpoint only, bucket and path go in metadata
      const tusEndpoint = `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`

      console.log(`📤 Starting TUS upload: ${file.name}, Size: ${fileSizeMB.toFixed(2)}MB`)
      console.log(`🔗 TUS endpoint: ${tusEndpoint}`)
      console.log(`📁 File path: ${filePath}`)
      console.log(`🪣 Bucket: ${bucketName}`)
      console.log(`🆔 Project ID: ${projectId}`)
      console.log(`👤 User ID: ${userId}`)

      // Update UI with a user-friendly initial state (0% before TUS progress events start)
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: true, 
          progress: `Uploading: 0.0% (0.00MB / ${fileSizeMB.toFixed(2)}MB)` 
        } : f
      ))

      // Create TUS upload
      return new Promise((resolve, reject) => {
        // TUS metadata - Supabase requires specific format
        // tus-js-client automatically base64 encodes metadata values
        // According to Supabase docs, metadata should include:
        // - bucketName: the bucket name
        // - objectName: the full file path
        // - contentType: MIME type
        // - fileName: original filename (optional)
        const metadata = {
          bucketName: bucketName,
          objectName: filePath,
          contentType: file.type,
          fileName: file.name
        }
        
        console.log('📋 TUS metadata (will be base64 encoded by tus-js-client):', metadata)
        
        const upload = new tus.Upload(file, {
          endpoint: tusEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 6 * 1024 * 1024, // 6MB chunks (required by Supabase)
          metadata: metadata,
          headers: {
            Authorization: `Bearer ${token}`,
            'x-upsert': 'true'
          },
          onError: async (error) => {
            console.error('❌ TUS upload error:', error)
            console.error('❌ Error details:', {
              message: error.message,
              name: error.name,
              originalResponse: error.originalResponse,
              originalRequest: error.originalRequest
            })
            
            // Extract response text from error message (TUS includes it in the message)
            let responseText = ''
            let status = null
            const responseTextMatch = error.message?.match(/response text: ([^,]+)/i)
            const statusMatch = error.message?.match(/response code: (\d+)/i)
            
            if (responseTextMatch) {
              responseText = responseTextMatch[1].trim()
              console.error(`❌ Response text from Supabase: ${responseText}`)
            }
            
            if (statusMatch) {
              status = parseInt(statusMatch[1])
              console.error(`❌ HTTP Status: ${status}`)
            }
            
            // Try to get status from originalResponse if available
            if (error.originalResponse && !status) {
              status = error.originalResponse.status
              console.error(`❌ HTTP Status from originalResponse: ${status}`)
            }
            
            let errorMessage = error.message || 'TUS upload failed. Please try again.'
            let shouldFallback = false
            
            // Handle specific error types
            if (status === 413 || responseText?.toLowerCase().includes('maximum size exceeded') || 
                responseText?.toLowerCase().includes('size exceeded') || 
                error.message?.includes('Maximum size exceeded')) {
              // Supabase has a maximum file size limit (likely 100-128MB) even for TUS uploads
              errorMessage = `File size (${fileSizeMB.toFixed(2)}MB) exceeds Supabase's maximum file size limit. ` +
                           `Supabase Storage has a maximum file size limit (typically 100-128MB) even for TUS resumable uploads. ` +
                           `Please use a file smaller than 100MB, or contact your administrator to increase the limit.`
            } else if (status === 400) {
              // 400 could be bucket config or TUS not enabled
              if (responseText?.includes('Bucket name invalid') || responseText?.includes('bucket') ||
                  error.message?.includes('Bucket name invalid')) {
                errorMessage = 'TUS resumable uploads may not be enabled for your Supabase project. Falling back to chunked upload...'
                shouldFallback = true
              } else {
                errorMessage = `Invalid request (${status}): ${responseText || error.message}. Please check your configuration.`
              }
            } else if (status === 401 || status === 403) {
              errorMessage = 'Authentication failed. Please log in again.'
            } else if (status === 404) {
              errorMessage = 'TUS endpoint not found. TUS resumable uploads may not be enabled for your project.'
              shouldFallback = true
            } else if (error.message?.includes('Bucket name invalid') || error.message?.includes('bucket')) {
              errorMessage = `TUS upload failed: ${error.message}. ` +
                           `This might indicate TUS resumable uploads are not fully enabled for your Supabase project. ` +
                           `Please check your Supabase configuration or try again.`
              shouldFallback = false
            } else {
              // For other errors, show the actual error message
              errorMessage = `TUS upload failed: ${error.message || 'Unknown error'}. ` +
                           `Please check the console for details or try again.`
            }
            
            // If TUS fails, try falling back to chunked upload
            if (shouldFallback) {
              console.log('🔄 TUS failed, falling back to chunked upload...')
              setUploadedFiles(prev => prev.map(f =>
                f.id === fileObj.id ? { 
                  ...f, 
                  progress: 'TUS not available, using chunked upload...' 
                } : f
              ))
              
              try {
                // Fallback to chunked upload
                const result = await uploadViaChunked(fileObj)
                resolve(result)
                return
              } catch (chunkedError) {
                console.error('❌ Chunked upload also failed:', chunkedError)
                errorMessage = `Both TUS and chunked upload failed: ${chunkedError.message}`
              }
            }
            
            setUploadedFiles(prev => prev.map(f =>
              f.id === fileObj.id ? { 
                ...f, 
                uploading: false, 
                error: true, 
                progress: null,
                errorMessage: errorMessage
              } : f
            ))
            reject(new Error(errorMessage))
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(1)
            const uploadedMB = (bytesUploaded / (1024 * 1024)).toFixed(2)
            const totalMB = (bytesTotal / (1024 * 1024)).toFixed(2)
            
            setUploadedFiles(prev =>
              prev.map(f =>
                f.id === fileObj.id
                  ? {
                      ...f,
                      progress: `Uploading: ${percentage}% (${uploadedMB}MB / ${totalMB}MB)`
                    }
                  : f
              )
            )
            
            console.log(`📊 TUS progress: ${percentage}% (${uploadedMB}MB / ${totalMB}MB)`)
          },
          onSuccess: async () => {
            console.log('✅ TUS upload completed successfully')
            
            // Get public URL from Supabase
            try {
              // filePath is already the full path: userId/reels/filename
              const { data: urlData } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath)

              if (!urlData?.publicUrl) {
                throw new Error('Failed to get public URL')
              }

              // Update state with URL
              setUploadedFiles(prev => prev.map(f =>
                f.id === fileObj.id ? { 
                  ...f, 
                  url: urlData.publicUrl, 
                  uploading: false, 
                  progress: null,
                  error: false 
                } : f
              ))

              console.log('✅ TUS upload successful:', urlData.publicUrl)
              resolve(urlData.publicUrl)
            } catch (urlError) {
              console.error('❌ Failed to get public URL:', urlError)
              reject(new Error('Upload completed but failed to get file URL. Please refresh and try again.'))
            }
          },
          onChunkComplete: (chunkSize, bytesAccepted, bytesTotal) => {
            console.log(`✅ Chunk uploaded: ${chunkSize} bytes (${bytesAccepted}/${bytesTotal} total)`)
          }
        })

        // Start the upload
        upload.start()
      })
    } catch (error) {
      console.error('TUS upload failed:', error)
      
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: false, 
          error: true, 
          progress: null,
          errorMessage: error.message || 'TUS upload failed. Please try again.'
        } : f
      ))
      
      throw error
    }
  }

  // Chunked upload function for large files (> 10MB) - DEPRECATED, use TUS instead
  const uploadViaChunked = async (fileObj) => {
    try {
      if (!fileObj || !fileObj.file) {
        throw new Error('Invalid file object')
      }

      const file = fileObj.file
      const isVideo = file.type.startsWith('video/')
      const fileSizeMB = file.size / (1024 * 1024)
      const SUPABASE_SINGLE_FILE_LIMIT = 128 * 1024 * 1024 // 128MB
      
      // Use larger chunks (45MB) for files > 128MB to reduce upload time
      // Use 45MB instead of 50MB to stay under Supabase's 50MB per-request limit
      // Use smaller chunks (10MB) for files <= 128MB for better reliability
      const CHUNK_SIZE = file.size > SUPABASE_SINGLE_FILE_LIMIT 
        ? 45 * 1024 * 1024  // 45MB chunks for large files (stored separately, under 50MB limit)
        : 10 * 1024 * 1024  // 10MB chunks for smaller files (combined and uploaded)
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      
      // Update UI with start time
      const startTime = Date.now()
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: true,
          uploadStartTime: startTime,
          progress: `Initializing chunked upload (${totalChunks} chunks)...` 
        } : f
      ))

      // Get auth token
      let token = localStorage.getItem('authToken')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          token = session.access_token
        }
      } catch (sessionError) {
        console.warn('Could not get Supabase session:', sessionError)
      }

      if (!token) {
        throw new Error('Authentication required. Please log in to upload files.')
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      console.log(`📤 Starting chunked upload: ${file.name}, Size: ${fileSizeMB.toFixed(2)} MB`)
      console.log(`📦 Chunk size: ${(CHUNK_SIZE / (1024 * 1024)).toFixed(2)} MB, Total chunks: ${totalChunks}`)
      console.log(`📊 Expected chunks: ${file.size > SUPABASE_SINGLE_FILE_LIMIT ? '45MB each (stored separately)' : '10MB each (will be combined)'}`)
      
      // Step 1: Initialize chunked upload
      const initFormData = new FormData()
      initFormData.append('filename', file.name)
      initFormData.append('file_size', file.size.toString())
      initFormData.append('content_type', file.type)
      initFormData.append('total_chunks', totalChunks.toString())
      
      const initResponse = await fetch(`${API_URL}/upload-chunk-init`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: initFormData
      })
      
      if (!initResponse.ok) {
        const errorText = await initResponse.text()
        let errorMessage = `Failed to initialize upload: ${initResponse.status}`
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.detail || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }
      
      const initResult = await initResponse.json()
      const uploadId = initResult.upload_id
      
      console.log(`✅ Upload initialized: ${uploadId}`)
      
      // Step 2: Upload chunks sequentially with retry logic
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, file.size)
        const chunk = file.slice(start, end)
        
        // Retry logic for chunk uploads (important for large files on slow networks)
        let chunkUploaded = false
        let retries = 3
        let lastChunkError = null
        
        while (!chunkUploaded && retries > 0) {
          try {
            const chunkFormData = new FormData()
            chunkFormData.append('upload_id', uploadId)
            chunkFormData.append('chunk_index', chunkIndex.toString())
            chunkFormData.append('chunk', chunk)
            
            // Measure per-chunk upload speed in real time
            const chunkBytes = chunk.size
            const chunkStartTime = performance.now()
            
            // Update progress before the request so the user sees immediate feedback
            const progressPercent = Math.round(((chunkIndex + 1) / totalChunks) * 100)
            const uploadedMB = ((chunkIndex + 1) * (CHUNK_SIZE / (1024 * 1024))).toFixed(1)
            const totalMB = (file.size / (1024 * 1024)).toFixed(1)
            const retryText = retries < 3 ? ` (retry ${4 - retries}/3)` : ''
            setUploadedFiles(prev => {
              const currentFile = prev.find(f => f.id === fileObj.id)
              const elapsedSeconds = currentFile?.uploadStartTime 
                ? (Date.now() - currentFile.uploadStartTime) / 1000 
                : 0
              const elapsedTime = formatElapsedTime(elapsedSeconds)
              return prev.map(f =>
                f.id === fileObj.id ? { 
                  ...f, 
                  progress: `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${progressPercent}%) - ${uploadedMB}MB/${totalMB}MB${retryText} - ${elapsedTime}` 
                } : f
              )
            })
            
            const chunkResponse = await fetch(`${API_URL}/upload-chunk`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: chunkFormData
            })
            
            const chunkEndTime = performance.now()
            const seconds = (chunkEndTime - chunkStartTime) / 1000
            const mbUploaded = chunkBytes / (1024 * 1024)
            const mbps = seconds > 0 ? (chunkBytes * 8) / 1_000_000 / seconds : 0
            
            if (!chunkResponse.ok) {
              const errorText = await chunkResponse.text()
              let errorMessage = `Failed to upload chunk ${chunkIndex + 1}: ${chunkResponse.status}`
              try {
                const errorJson = JSON.parse(errorText)
                errorMessage = errorJson.detail || errorMessage
              } catch {
                errorMessage = errorText || errorMessage
              }
              lastChunkError = new Error(errorMessage)
              retries--
              
              if (retries > 0) {
                // Wait before retry (exponential backoff)
                const waitTime = 1000 * (4 - retries) // 1s, 2s, 3s
                console.log(`⚠️ Chunk ${chunkIndex + 1} upload failed, retrying in ${waitTime/1000}s... (${retries} attempts remaining)`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
                continue
              } else {
                throw lastChunkError
              }
            }
            
            chunkUploaded = true
            console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded`)
            
            // After a successful chunk upload, update progress with real measured speed
            setUploadedFiles(prev => {
              const currentFile = prev.find(f => f.id === fileObj.id)
              const elapsedSeconds = currentFile?.uploadStartTime 
                ? (Date.now() - currentFile.uploadStartTime) / 1000 
                : 0
              const elapsedTime = formatElapsedTime(elapsedSeconds)
              const speedText = seconds > 0 
                ? ` - ${mbps.toFixed(2)} Mbps (${mbUploaded.toFixed(1)}MB in ${seconds.toFixed(1)}s)` 
                : ''
              
              return prev.map(f =>
                f.id === fileObj.id ? { 
                  ...f, 
                  progress: `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${progressPercent}%) - ${uploadedMB}MB/${totalMB}MB${retryText}${speedText} - ${elapsedTime}` 
                } : f
              )
            })
          } catch (error) {
            retries--
            lastChunkError = error
            
            if (retries === 0) {
              throw new Error(`Failed to upload chunk ${chunkIndex + 1} after 3 attempts: ${error.message}`)
            } else {
              // Wait before retry
              const waitTime = 1000 * (4 - retries)
              console.log(`⚠️ Chunk ${chunkIndex + 1} upload error, retrying in ${waitTime/1000}s... (${retries} attempts remaining)`)
              await new Promise(resolve => setTimeout(resolve, waitTime))
            }
          }
        }
      }
      
      // Step 3: Finalize upload
      const isLargeFile = file.size > (128 * 1024 * 1024) // 128MB
      setUploadedFiles(prev => {
        const currentFile = prev.find(f => f.id === fileObj.id)
        const elapsedSeconds = currentFile?.uploadStartTime 
          ? (Date.now() - currentFile.uploadStartTime) / 1000 
          : 0
        const elapsedTime = formatElapsedTime(elapsedSeconds)
        return prev.map(f =>
          f.id === fileObj.id ? { 
            ...f, 
            progress: isLargeFile 
              ? `Storing chunks separately in storage... - ${elapsedTime}` 
              : `Combining chunks and uploading to storage... - ${elapsedTime}` 
          } : f
        )
      })
      
      const finalizeFormData = new FormData()
      finalizeFormData.append('upload_id', uploadId)
      
      console.log(`🔗 Finalizing upload for ${uploadId}...`)
      
      // Create AbortController with timeout for finalization
      // For 132MB file, allow up to 30 minutes (combining + uploading)
      const finalizeController = new AbortController()
      const finalizeTimeout = setTimeout(() => {
        finalizeController.abort()
      }, 30 * 60 * 1000) // 30 minutes
      
      let finalizeResponse
      try {
        finalizeResponse = await fetch(`${API_URL}/upload-chunk-finalize`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: finalizeFormData,
          signal: finalizeController.signal
        })
        
        clearTimeout(finalizeTimeout)
        
        if (!finalizeResponse.ok) {
          const errorText = await finalizeResponse.text()
          let errorMessage = `Failed to finalize upload: ${finalizeResponse.status}`
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.detail || errorMessage
          } catch {
            errorMessage = errorText || errorMessage
          }
          throw new Error(errorMessage)
        }
        
        // Parse response inside try block
        const result = await finalizeResponse.json()
        
        if (!result || !result.url) {
          throw new Error('Invalid response from server')
        }
        
        // Handle chunked files (files > 128MB stored as separate chunks)
        if (result.chunked) {
          console.log(`✅ Chunked upload successful: File stored as ${result.total_chunks} chunks`)
          console.log(`📄 Metadata URL: ${result.url}`)
          // For chunked files, we use the metadata URL for now
          // A reconstruction endpoint can be added later if needed
        }
        
        // Update state with backend URL
        setUploadedFiles(prev => prev.map(f =>
          f.id === fileObj.id ? { 
            ...f, 
            url: result.url, 
            uploading: false, 
            progress: null,
            error: false,
            chunked: result.chunked || false  // Store chunked flag
          } : f
        ))
        
        console.log('✅ Chunked upload successful:', result.url)
        return result.url
      } catch (error) {
        clearTimeout(finalizeTimeout)
        if (error.name === 'AbortError') {
          throw new Error('Finalization timeout - the file is very large. Please try again or contact support.')
        }
        throw error
      }
      
      if (!result || !result.url) {
        throw new Error('Invalid response from server')
      }
      
      // Handle chunked files (files > 128MB stored as separate chunks)
      if (result.chunked) {
        console.log(`✅ Chunked upload successful: File stored as ${result.total_chunks} chunks`)
        console.log(`📄 Metadata URL: ${result.url}`)
        // For chunked files, we use the metadata URL for now
        // A reconstruction endpoint can be added later if needed
      }
      
      // Update state with backend URL
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          url: result.url, 
          uploading: false, 
          progress: null,
          error: false,
          chunked: result.chunked || false  // Store chunked flag
        } : f
      ))
      
      console.log('✅ Chunked upload successful:', result.url)
      return result.url
    } catch (error) {
      console.error('Chunked upload failed:', error)
      
      // Improve error message for file size limit
      let errorMessage = error.message || 'Chunked upload failed. Please try again.'
      if (errorMessage.includes('50MB') || errorMessage.includes('exceeds') || errorMessage.includes('100MB')) {
        errorMessage = `File size exceeds the 100MB total limit. Total size of all files (images and videos) must be 100MB or less. Please select smaller files.`
      }
      
      // Update state to show error
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: false, 
          error: true, 
          progress: null,
          errorMessage: errorMessage
        } : f
      ))
      
      throw error
    }
  }

  // Backend upload fallback function (for files <= 10MB)
  const uploadViaBackend = async (fileObj) => {
    try {
      if (!fileObj || !fileObj.file) {
        throw new Error('Invalid file object')
      }

      const file = fileObj.file
      const isVideo = file.type.startsWith('video/')
      
      // Update UI with start time
      const startTime = Date.now()
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: true, 
          uploadStartTime: startTime,
          progress: isVideo ? 'Uploading via server...' : 'Uploading via server...' 
        } : f
      ))

      const formData = new FormData()
      formData.append('file', file)

      // Try to get token from Supabase session first, then localStorage
      let token = localStorage.getItem('authToken')
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          token = session.access_token
        }
      } catch (sessionError) {
        console.warn('Could not get Supabase session:', sessionError)
      }

      if (!token) {
        throw new Error('Authentication required. Please log in to upload files.')
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      
      console.log('📤 Uploading via backend (better for slow networks):', file.name, `Size: ${(file.size / (1024 * 1024)).toFixed(2)} MB`)
      
      // Calculate timeout based on file size (for slow networks like 3G)
      // Assume minimum 0.1 MB/s upload speed for 3G networks
      const fileSizeMB = file.size / (1024 * 1024)
      const minUploadSpeedMBps = 0.1 // Conservative estimate for 3G
      const timeoutMs = Math.max(
        (fileSizeMB / minUploadSpeedMBps) * 1000, // Time needed at minimum speed
        10 * 60 * 1000 // Minimum 10 minutes
      )

      // Use XMLHttpRequest so we can get real-time progress (bytes uploaded)
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const uploadUrl = `${API_URL}/upload-file`

        xhr.open('POST', uploadUrl, true)
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.timeout = timeoutMs

        // Progress event - real-time bytes and percentage
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return

          const percent = Math.round((event.loaded / event.total) * 100)
          const uploadedMB = (event.loaded / (1024 * 1024)).toFixed(2)
          const totalMB = (event.total / (1024 * 1024)).toFixed(2)

          setUploadedFiles(prev =>
            prev.map(f =>
              f.id === fileObj.id
                ? (() => {
                    const updated = {
                      ...f,
                      progress: `Uploading via server: ${percent}% (${uploadedMB}MB / ${totalMB}MB)`
                    }
                    // Once we've sent 100% of bytes, stop the elapsed-time timer
                    // (server may still be processing, but upload is complete)
                    if (percent === 100) {
                      updated.uploadStartTime = null
                    }
                    return updated
                  })()
                : f
            )
          )
        }

        xhr.onerror = () => {
          reject(new Error('Network error during backend upload. Please check your connection and try again.'))
        }

        xhr.ontimeout = () => {
          reject(
            new Error(
              'Upload timeout on slow network. Total file size must be 100MB or less. Please try again with smaller files or better connection.'
            )
          )
        }

        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            let errorMessage = `Upload failed: ${xhr.status}`
            try {
              const errorJson = JSON.parse(xhr.responseText)
              errorMessage = errorJson.detail || errorMessage
            } catch {
              if (xhr.responseText) {
                errorMessage = xhr.responseText
              }
            }
            reject(new Error(errorMessage))
            return
          }

          try {
            const json = JSON.parse(xhr.responseText)
            resolve(json)
          } catch (e) {
            reject(new Error('Invalid response from server'))
          }
        }

        xhr.send(formData)
      })

      if (!result || !result.url) {
        throw new Error('Invalid response from server')
      }

      // Update state with backend URL
      setUploadedFiles(prev =>
        prev.map(f =>
          f.id === fileObj.id
            ? {
                ...f,
                url: result.url,
                uploading: false,
                progress: null,
                error: false
              }
            : f
        )
      )

      console.log('✅ Backend upload successful:', result.url)
      return result.url
    } catch (error) {
      console.error('Backend upload failed:', error)
      
      // Update state to show error
      setUploadedFiles(prev => prev.map(f =>
        f.id === fileObj.id ? { 
          ...f, 
          uploading: false, 
          error: true, 
          progress: null,
          errorMessage: error.message || 'Backend upload failed. Total file size must be 100MB or less. Please try again.'
        } : f
      ))
      
      throw error
    }
  }

  const handleFileSelect = async (event) => {
    try {
      const files = Array.from(event.target.files || [])

      if (!files || files.length === 0) {
        return
      }

      // Maximum total size: 100MB for all files combined (images and videos)
      // Files > 128MB will use chunked upload with separate chunk storage (bypasses Supabase's 128MB limit)
      const SUPABASE_SINGLE_FILE_LIMIT = 128 * 1024 * 1024 // 128MB - Supabase's maximum single file size
      const MAX_TOTAL_SIZE = 100 * 1024 * 1024 // Maximum total size for all files combined (100MB)
      const allowedTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'
      ]

      // Calculate total size of existing uploaded files (including completed uploads)
      const existingFilesTotalSize = uploadedFiles
        .filter(f => !f.error) // Include both uploading and completed files
        .reduce((sum, f) => sum + (f.size || 0), 0)

      // Calculate total size of new files
      const newFilesTotalSize = files.reduce((sum, file) => sum + (file?.size || 0), 0)
      const totalSize = existingFilesTotalSize + newFilesTotalSize

      const validFiles = []
      const errors = []

      // Check if total size exceeds limit
      if (totalSize > MAX_TOTAL_SIZE) {
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2)
        const existingSizeMB = (existingFilesTotalSize / (1024 * 1024)).toFixed(2)
        errors.push(`Total file size (${totalSizeMB}MB) exceeds 100MB limit. ${existingFilesTotalSize > 0 ? `Existing files: ${existingSizeMB}MB. ` : ''}Please select smaller files.`)
      }

      files.forEach((file, index) => {
        if (!file) return
        
        // Individual file size check - each file should not exceed 100MB
        if (file.size > MAX_TOTAL_SIZE) {
          const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
          errors.push(`${file.name}: File size (${fileSizeMB}MB) exceeds 100MB limit`)
          return
        }

        // Note: Files > 128MB will use chunked upload with separate chunk storage
        // Files <= 128MB will use direct backend upload with adaptive timeout (extends based on network latency)

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
          error: false,
          uploadStartTime: Date.now() // Track upload start time
        })
      })

      if (errors.length > 0) {
        setErrors(prev => ({ ...prev, files: errors }))
        if (event.target) {
          event.target.value = ''
        }
        return
      }

      if (validFiles.length === 0) {
        if (event.target) {
          event.target.value = ''
        }
        return
      }

      setUploadedFiles(prev => [...prev, ...validFiles])
      setErrors(prev => ({ ...prev, files: null }))

      // Upload files sequentially to avoid overwhelming the server
      for (const fileObj of validFiles) {
        try {
          const file = fileObj.file
      const fileSizeMB = file.size / (1024 * 1024)
      const DIRECT_UPLOAD_LIMIT = 100 * 1024 * 1024 // 100MB - direct upload with adaptive timeout
      const SUPABASE_SINGLE_FILE_LIMIT = 128 * 1024 * 1024 // 128MB - Supabase's maximum single file size
      
      // Upload strategy:
      // - Files > 128MB: Use chunked upload with separate chunk storage (bypasses Supabase limit)
      // - Files <= 100MB: Use direct backend upload with adaptive timeout (extends based on network latency)
      // - Files 100-128MB: Also use direct upload (Supabase supports up to 128MB per request)
      if (file.size > SUPABASE_SINGLE_FILE_LIMIT) {
        // Files > 128MB: Use chunked upload (chunks stored separately)
        console.log(`📦 File ${file.name} is ${fileSizeMB.toFixed(2)}MB, using chunked upload with separate chunk storage`)
        await uploadViaChunked(fileObj)
      } else {
        // Files <= 128MB: Use direct upload with adaptive timeout (no TUS needed)
        // The backend will automatically extend timeout based on network latency
        console.log(`📦 File ${file.name} is ${fileSizeMB.toFixed(2)}MB, using direct upload with adaptive timeout`)
        if (file.size > DIRECT_UPLOAD_LIMIT) {
          console.log(`⚠️ File is > 100MB but <= 128MB, using direct upload (Supabase supports up to 128MB per request)`)
        }
        // Direct upload with adaptive timeout (backend extends timeout based on network latency)
          await uploadFileImmediately(fileObj)
      }
        } catch (error) {
          // Error already handled in upload functions
          console.error(`Upload failed for ${fileObj.name}:`, error)
        }
      }

      // Reset file input
      if (event.target) {
        event.target.value = ''
      }
    } catch (error) {
      console.error('Error in handleFileSelect:', error)
      setErrors(prev => ({ ...prev, files: [`Failed to process files: ${error.message}`] }))
      if (event.target) {
        event.target.value = ''
      }
    }
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

  // Format elapsed time in seconds to human-readable format
  const formatElapsedTime = (seconds) => {
    if (seconds < 60) {
      return `${Math.floor(seconds)}s`
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}m ${secs}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${mins}m`
    }
  }

  // Get elapsed time for a file
  const getElapsedTime = (fileObj) => {
    if (!fileObj.uploadStartTime) return 0
    return (Date.now() - fileObj.uploadStartTime) / 1000 // Convert to seconds
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
    // Image_type only required for Generate media, but not for reel/video
    if (formData.media === 'Generate' && !formData.Image_type && formData.content_type !== 'short_video or reel') {
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
        ...(formData.media === 'Generate' && formData.content_type !== 'short_video or reel' && { Image_type: formData.Image_type }),
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
    { label: 'Blog Post', value: 'blog' }
  ]

  const mediaOptions = [
    { label: 'Generate Media', value: 'Generate' },
    { label: 'Upload My Own', value: 'Upload' },
    { label: 'Text Only', value: 'Without media' }
  ]

  // Media options specifically for reel/video content
  const videoMediaOptions = [
    { label: 'Generate a video script', value: 'Generate' },
    { label: 'Upload my own', value: 'Upload' }
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
    // For reel/video content type, show specific video media options
    if (formData.content_type === 'short_video or reel') {
      return videoMediaOptions
    }
    
    // For other content types, use regular media options
    let filtered = [...mediaOptions]
    
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
              Upload images or videos for your post (total size up to 100MB)
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
                  Total size up to 100MB (all files combined)
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
                                {fileObj.progress || 'Uploading...'}
                              </span>
                            )}
                            {fileObj.error && (
                              <span className="text-xs text-red-600" title={fileObj.errorMessage}>
                                {fileObj.errorMessage || 'Upload failed'}
                              </span>
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
