import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const ImageShowcaseModal = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  imageAlt = "Image"
}) => {
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    if (isOpen && imageUrl) {
      setImageError(false)
    }
  }, [isOpen, imageUrl])

  const handleImageError = () => {
    setImageError(true)
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen || !imageUrl) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-w-4xl max-h-full w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image Container */}
        <div className="bg-white rounded-lg overflow-hidden">
          {imageError ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-600">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-medium">Failed to load image</p>
              <p className="text-sm text-gray-500">The image could not be displayed</p>
            </div>
          ) : (
            <img
              src={imageUrl}
              alt={imageAlt}
              className="max-w-full max-h-[80vh] object-contain"
              onError={handleImageError}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageShowcaseModal
