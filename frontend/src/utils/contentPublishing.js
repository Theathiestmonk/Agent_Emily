/**
 * Content Publishing Utilities
 * 
 * Helper functions to extract media_url from created_content table
 * and determine which endpoint to use based on content_type
 */

/**
 * Extract media URL and determine post type based on content_type
 * 
 * @param {Object} content - Content object from created_content table
 * @returns {Object} - { mediaUrl, postType, isVideo }
 */
export const getMediaForPublishing = (content) => {
  const contentType = content.content_type?.toLowerCase() || ''
  const mediaUrl = content.media_url
  
  // Check if content type is reel/short video
  const isReelContent = 
    contentType === 'short_video or reel' ||
    contentType === 'reel' ||
    contentType === 'short_video'
  
  // Check if content type is long video
  const isLongVideoContent = contentType === 'long_video'
  
  // Check if content type is static post
  const isStaticPost = contentType === 'static_post'
  
  // For reel/short video or long video, use media_url if available
  if ((isReelContent || isLongVideoContent) && mediaUrl) {
    return {
      mediaUrl: mediaUrl,
      postType: 'video', // Backend will detect this and use REELS endpoint
      isVideo: true
    }
  }
  
  // For static posts, use image (from images array or media_url if it's an image)
  if (isStaticPost) {
    // Try to get image from images array first
    const imageUrl = content.images && content.images.length > 0 
      ? (typeof content.images[0] === 'string' ? content.images[0] : content.images[0].url || content.images[0].image_url)
      : null
    
    return {
      mediaUrl: imageUrl || mediaUrl,
      postType: 'image',
      isVideo: false
    }
  }
  
  // Default: use image from images array
  const imageUrl = content.images && content.images.length > 0 
    ? (typeof content.images[0] === 'string' ? content.images[0] : content.images[0].url || content.images[0].image_url)
    : null
  
  return {
    mediaUrl: imageUrl || mediaUrl,
    postType: imageUrl ? 'image' : 'text',
    isVideo: false
  }
}

/**
 * Determine which endpoint to use based on content_type and platform
 * 
 * @param {string} contentType - Content type from database
 * @param {string} platform - Platform name (facebook, instagram, etc.)
 * @returns {string} - Endpoint path
 */
export const getPublishingEndpoint = (contentType, platform) => {
  const contentTypeLower = contentType?.toLowerCase() || ''
  
  // Check if it's a reel/video content type
  const isReelContent = 
    contentTypeLower === 'short_video or reel' ||
    contentTypeLower === 'reel' ||
    contentTypeLower === 'short_video' ||
    contentTypeLower === 'long_video'
  
  // For Facebook and Instagram, both post and reel use the same endpoint
  // The backend automatically detects video files and uses REELS endpoint
  if (platform === 'facebook') {
    return '/connections/facebook/post'
  } else if (platform === 'instagram') {
    return '/connections/instagram/post'
  } else if (platform === 'linkedin') {
    return '/connections/linkedin/post'
  } else if (platform === 'youtube') {
    return '/connections/youtube/post'
  }
  
  return null
}

/**
 * Prepare post body for publishing based on content_type
 * 
 * @param {Object} content - Content object from created_content table
 * @param {boolean} isCarousel - Whether this is a carousel post
 * @param {Array} carouselImages - Array of carousel image URLs
 * @returns {Object} - Post body for API request
 */
export const preparePostBody = (content, isCarousel = false, carouselImages = []) => {
  const mediaInfo = getMediaForPublishing(content)
  
  const postBody = {
    message: content.content,
    title: content.title,
    hashtags: content.hashtags || [],
    content_id: content.id
  }

  // Handle carousel vs single image posts vs video posts
  if (isCarousel && carouselImages.length > 0) {
    postBody.post_type = 'carousel'
    postBody.carousel_images = carouselImages
  } else if (mediaInfo.isVideo && mediaInfo.mediaUrl) {
    // For video/reel content, use video_url and set post_type to video
    postBody.post_type = 'video'
    postBody.image_url = mediaInfo.mediaUrl // Backend uses image_url field for both images and videos
    postBody.metadata = {
      media_type: 'video'
    }
  } else if (mediaInfo.mediaUrl && !mediaInfo.isVideo) {
    postBody.image_url = mediaInfo.mediaUrl
  }

  return postBody
}

/**
 * Validate content before publishing
 * 
 * @param {Object} content - Content object
 * @param {string} platform - Platform name
 * @param {boolean} isCarousel - Whether this is a carousel
 * @param {Array} carouselImages - Array of carousel images
 * @returns {Object} - { valid: boolean, error: string }
 */
export const validateContentForPublishing = (content, platform, isCarousel = false, carouselImages = []) => {
  const mediaInfo = getMediaForPublishing(content)
  
  // Validate carousel
  if (isCarousel && carouselImages.length === 0) {
    return {
      valid: false,
      error: `${platform} carousel posts require multiple images. Please ensure the content has carousel images.`
    }
  }

  // Validate video content
  if (mediaInfo.isVideo && !mediaInfo.mediaUrl) {
    return {
      valid: false,
      error: 'Video content requires a video file. Please ensure the content has a video uploaded.'
    }
  }

  // Validate Instagram posts (require media unless it's a video)
  if (platform === 'instagram' && !isCarousel && !mediaInfo.isVideo && !mediaInfo.mediaUrl) {
    return {
      valid: false,
      error: 'Instagram posts require an image. Please ensure the content has an associated image.'
    }
  }

  // Validate public accessibility for Instagram
  if (platform === 'instagram' && !isCarousel && mediaInfo.mediaUrl) {
    const isSupabaseUrl = mediaInfo.mediaUrl.includes('supabase.co') && 
                         mediaInfo.mediaUrl.includes('/storage/v1/object/public/')
    if (!isSupabaseUrl) {
      return {
        valid: false,
        error: 'Instagram requires media to be publicly accessible. Please re-upload the media or use a different platform.'
      }
    }
  }

  return { valid: true, error: null }
}

























