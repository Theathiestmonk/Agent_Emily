import React, { useState, useRef, useEffect } from 'react'

const ProgressiveImage = ({ 
  src, 
  alt, 
  className = '', 
  onClick, 
  onLoad, 
  onError,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEMyMi4yMDkxIDIwIDI0IDE4LjIwOTEgMjQgMTZDMjQgMTMuNzkwOSAyMi4yMDkxIDEyIDIwIDEyQzE3Ljc5MDkgMTIgMTYgMTMuNzkwOSAxNiAxNkMxNiAxOC4yMDkxIDE3Ljc5MDkgMjAgMjAgMjBaIiBmaWxsPSIjOUI5QjlCIi8+Cjwvc3ZnPgo=',
  blurDataURL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMEMyMi4yMDkxIDIwIDI0IDE4LjIwOTEgMjQgMTZDMjQgMTMuNzkwOSAyMi4yMDkxIDEyIDIwIDEyQzE3Ljc5MDkgMTIgMTYgMTMuNzkwOSAxNiAxNkMxNiAxOC4yMDkxIDE3Ljc5MDkgMjAgMjAgMjBaIiBmaWxsPSIjOUI5QjlCIi8+Cjwvc3ZnPgo=',
  ...props 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isInView, setIsInView] = useState(false)
  const imgRef = useRef(null)
  const observerRef = useRef(null)

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current) return

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          observerRef.current?.disconnect()
        }
      },
      { 
        rootMargin: '50px', // Start loading 50px before image comes into view
        threshold: 0.1 
      }
    )

    observerRef.current.observe(imgRef.current)

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  const handleImageLoad = () => {
    setImageLoaded(true)
    onLoad?.()
  }

  const handleImageError = () => {
    setImageError(true)
    onError?.()
  }

  // Generate a low-quality placeholder by creating a very small version
  const generateBlurDataURL = (src) => {
    if (blurDataURL) return blurDataURL
    
    // Create a canvas to generate a low-quality version
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    canvas.width = 20
    canvas.height = 20
    
    // Fill with a gradient background
    const gradient = ctx.createLinearGradient(0, 0, 20, 20)
    gradient.addColorStop(0, '#f3f4f6')
    gradient.addColorStop(1, '#e5e7eb')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 20, 20)
    
    // Add a subtle pattern
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(8, 8, 4, 4)
    
    return canvas.toDataURL('image/jpeg', 0.1)
  }

  const blurData = generateBlurDataURL(src)

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`} {...props}>
      {/* Blur placeholder - always visible */}
      <div 
        className={`absolute inset-0 transition-opacity duration-300 ${
          imageLoaded ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          backgroundImage: `url(${blurData})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(8px)',
          transform: 'scale(1.1)' // Slightly larger to hide blur edges
        }}
      />
      
      {/* Loading skeleton */}
      {!imageLoaded && !imageError && isInView && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        </div>
      )}
      
      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs">Failed to load</p>
          </div>
        </div>
      )}
      
      {/* Actual image */}
      {isInView && !imageError && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onClick={onClick}
          loading="lazy"
        />
      )}
    </div>
  )
}

export default ProgressiveImage
