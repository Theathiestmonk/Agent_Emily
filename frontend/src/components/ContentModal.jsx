import React, { useRef } from 'react'
import {
  Image,
  X,
  Building2,
  Layers,
  Upload,
  Edit,
  Sparkles,
  CheckCircle,
  RefreshCw,
  Trash2,
  XCircle,
  Wand2,
  ChevronDown,
  MoreVertical
} from 'lucide-react'

const ContentModal = ({
  content,
  profile,
  onClose,
  onImageClick,
  onReplaceCarouselImage,
  onFileSelect,
  onUploadImage,
  onUploadCarouselImage,
  onSetImageEditorData,
  onShowImageEditor,
  onGenerateMedia,
  generatingMedia,
  editingTitleInModal,
  editingContentInModal,
  editTitleValue,
  editContentValue,
  onEditTitleValueChange,
  onEditContentValueChange,
  onManualEdit,
  onAIEdit,
  onSaveManualEdit,
  onCancelManualEdit,
  savingModalEdit,
  onStatusChange,
  onApprovePost,
  onDisapprovePost,
  onDeleteConfirm,
  uploadingImage,
  updatingStatus,
  // Helper functions
  isVideoFile,
  getFullSizeImageUrl,
  cleanContentText,
  getStatusColor,
  statusOptions
}) => {
  const statusSelectRef = useRef(null)
  const [imageMenuOpen, setImageMenuOpen] = React.useState(false)
  const [carouselMenuOpen, setCarouselMenuOpen] = React.useState({})
  const [headerMenuOpen, setHeaderMenuOpen] = React.useState(false)
  const menuRef = React.useRef(null)
  const headerMenuRef = React.useRef(null)
  
  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setImageMenuOpen(false)
        setCarouselMenuOpen({})
      }
      if (headerMenuRef.current && !headerMenuRef.current.contains(event.target)) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  if (!content) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-75 z-30"
      onClick={onClose}
    >
      <div 
        className="fixed inset-0 flex items-center justify-center p-4 pb-20"
        style={{ left: '12rem', right: '0' }}
      >
        <div 
          className="relative max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center space-x-3">
              {/* Business Logo */}
              <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                {profile?.logo_url ? (
                  <img 
                    src={profile.logo_url} 
                    alt="Business logo" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div className="w-full h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center" style={{ display: profile?.logo_url ? 'none' : 'flex' }}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">
                  {profile?.business_name || 'Business'}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>
                    {content.scheduled_at ? (
                      new Date(content.scheduled_at).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    ) : 'No date set'}
                  </span>
                  <span>|</span>
                  <span className={`text-xs font-medium ${
                    content.status === 'draft' ? 'text-gray-800' :
                    content.status === 'scheduled' ? 'text-blue-800' :
                    content.status === 'published' ? 'text-green-800' :
                    content.status === 'failed' ? 'text-red-800' :
                    'text-gray-800'
                  }`}>
                    {statusOptions.find(opt => opt.value === content.status)?.label || content.status || 'Draft'}
                  </span>
                  {updatingStatus.has(content.id) && (
                    <RefreshCw className="w-3 h-3 animate-spin text-gray-400 ml-1" />
                  )}
                </div>
              </div>
            </div>
            <div className="relative" ref={headerMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setHeaderMenuOpen(!headerMenuOpen)
                }}
                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center transition-colors"
                title="Options"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              
              {/* Header Dropdown Menu */}
              {headerMenuOpen && (
                <div className="absolute right-0 top-10 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                  {/* Status Selector */}
                  <div className="px-4 py-2 border-b border-gray-200">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
                    <select
                      value={content.status || 'draft'}
                      onChange={(e) => {
                        const newStatus = e.target.value
                        onStatusChange(content.id, newStatus)
                        setHeaderMenuOpen(false)
                      }}
                      disabled={updatingStatus.has(content.id)}
                      className={`w-full px-2 py-1 rounded text-xs font-medium border focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all ${
                        getStatusColor(content.status)
                      } ${updatingStatus.has(content.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {updatingStatus.has(content.id) && (
                      <div className="flex items-center space-x-1 text-xs text-gray-500 mt-1">
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Updating...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Approve/Disapprove based on status */}
                  {content.status?.toLowerCase() !== 'approved' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onApprovePost(content.id)
                        setHeaderMenuOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span>Approve</span>
                    </button>
                  )}
                  
                  {(content.status?.toLowerCase() === 'approved' || content.status?.toLowerCase() === 'scheduled') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDisapprovePost(content.id)
                        setHeaderMenuOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4 text-red-600" />
                      <span>Disapprove</span>
                    </button>
                  )}
                  
                  {/* Close option */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setHeaderMenuOpen(false)
                      onClose()
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Image Section */}
              <div className="space-y-4">
                {(() => {
                  // Detect carousel posts
                  const isCarousel = content.post_type === 'carousel' || 
                                     (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0) ||
                                     (content.carousel_images && Array.isArray(content.carousel_images) && content.carousel_images.length > 0)
                  
                  // Get carousel images
                  let carouselImages = []
                  if (isCarousel) {
                    if (content.carousel_images && Array.isArray(content.carousel_images) && content.carousel_images.length > 0) {
                      carouselImages = content.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img))
                    } else if (content.metadata?.carousel_images && Array.isArray(content.metadata.carousel_images) && content.metadata.carousel_images.length > 0) {
                      carouselImages = content.metadata.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img))
                    }
                  }
                  
                  // Get image directly from content.media_url (which comes from primary_image_url)
                  const finalImageUrl = content.media_url || content.image_url
                  
                  // If carousel, show all images; otherwise show single image
                  if (isCarousel && carouselImages.length > 0) {
                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <Layers className="w-5 h-5" />
                            Carousel Images ({carouselImages.length})
                          </h4>
                        </div>
                        <div className="space-y-4">
                          {carouselImages.map((imgUrl, index) => {
                            const imageUrl = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || imgUrl)
                            return (
                              <div key={index} className="relative group w-full flex justify-center">
                                {/* Menu Icon - Top Right */}
                                {content.status?.toLowerCase() !== 'published' && (
                                  <div className="absolute top-2 right-2 z-10">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setCarouselMenuOpen(prev => ({
                                          ...prev,
                                          [index]: !prev[index]
                                        }))
                                      }}
                                      className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110 opacity-0 group-hover:opacity-100"
                                      title="Options"
                                    >
                                      <MoreVertical className="w-4 h-4 text-gray-700" />
                                    </button>
                                    
                                    {/* Dropdown Menu */}
                                    {carouselMenuOpen[index] && (
                                      <div className="absolute right-0 top-10 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onSetImageEditorData({
                                              postContent: content.content,
                                              inputImageUrl: imageUrl
                                            })
                                            onShowImageEditor(true)
                                            setCarouselMenuOpen(prev => ({ ...prev, [index]: false }))
                                            onClose()
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                          <Edit className="w-4 h-4" />
                                          <span>Edit Image</span>
                                        </button>
                                        
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            onReplaceCarouselImage(content.id, index)
                                            setCarouselMenuOpen(prev => ({ ...prev, [index]: false }))
                                          }}
                                          disabled={generatingMedia.has(content.id)}
                                          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                            generatingMedia.has(content.id)
                                              ? 'text-gray-400 cursor-not-allowed'
                                              : 'text-gray-700 hover:bg-gray-100'
                                          }`}
                                        >
                                          {generatingMedia.has(content.id) ? (
                                            <>
                                              <RefreshCw className="w-4 h-4 animate-spin" />
                                              <span>Regenerating...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Wand2 className="w-4 h-4" />
                                              <span>Regenerate Image</span>
                                            </>
                                          )}
                                        </button>
                                        
                                        <label className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer">
                                          <Upload className="w-4 h-4" />
                                          <span>Upload Image</span>
                                          <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                              const file = e.target.files[0]
                                              if (file) {
                                                if (onUploadCarouselImage) {
                                                  onUploadCarouselImage(content.id, index, file)
                                                } else if (onFileSelect) {
                                                  onFileSelect(e)
                                                  setTimeout(() => {
                                                    onReplaceCarouselImage(content.id, index)
                                                  }, 100)
                                                }
                                                setCarouselMenuOpen(prev => ({ ...prev, [index]: false }))
                                              }
                                            }}
                                            className="hidden"
                                            disabled={uploadingImage.has(content.id)}
                                          />
                                        </label>
                                      </div>
                                    )}
                                  </div>
                                )}
                                <img
                                  src={getFullSizeImageUrl(imageUrl) || imageUrl}
                                  alt={`Carousel image ${index + 1}`}
                                  className="w-full max-h-[60vh] object-contain rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => onImageClick(getFullSizeImageUrl(imageUrl) || imageUrl, `${content.title} - Image ${index + 1}`)}
                                  onError={(e) => {
                                    console.error('❌ Carousel image failed to load:', imageUrl)
                                    e.target.style.display = 'none'
                                  }}
                                />
                                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                                  {index + 1}/{carouselImages.length}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }
                  
                  if (!finalImageUrl) {
                    return (
                      <div className="w-full h-80 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <Image className="w-16 h-16 text-gray-400 mx-auto mb-2" strokeWidth={1.5} />
                          <p className="text-gray-500 text-sm">No image available</p>
                        </div>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="relative w-full flex justify-center" ref={menuRef}>
                      {/* Menu Icon - Top Right */}
                      {content.status?.toLowerCase() !== 'published' && !isVideoFile(finalImageUrl) && (
                        <div className="absolute top-2 right-2 z-10">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setImageMenuOpen(!imageMenuOpen)
                            }}
                            className="w-8 h-8 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow-md transition-all duration-200 hover:scale-110"
                            title="Options"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-700" />
                          </button>
                          
                          {/* Dropdown Menu */}
                          {imageMenuOpen && (
                            <div className="absolute right-0 top-10 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSetImageEditorData({
                                    postContent: content.content,
                                    inputImageUrl: finalImageUrl
                                  })
                                  onShowImageEditor(true)
                                  setImageMenuOpen(false)
                                  onClose()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                <span>Edit Image</span>
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onGenerateMedia(content)
                                  setImageMenuOpen(false)
                                }}
                                disabled={generatingMedia.has(content.id)}
                                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                                  generatingMedia.has(content.id)
                                    ? 'text-gray-400 cursor-not-allowed'
                                    : 'text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {generatingMedia.has(content.id) ? (
                                  <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Regenerating...</span>
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-4 h-4" />
                                    <span>Regenerate Image</span>
                                  </>
                                )}
                              </button>
                              
                              <label className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 cursor-pointer">
                                <Upload className="w-4 h-4" />
                                <span>Upload Image</span>
                                <input
                                  type="file"
                                  accept="image/*,video/*"
                                  onChange={(e) => {
                                    const file = e.target.files[0]
                                    if (file) {
                                      onFileSelect(e)
                                      setTimeout(() => {
                                        onUploadImage(content.id)
                                      }, 100)
                                      setImageMenuOpen(false)
                                    }
                                  }}
                                  className="hidden"
                                  disabled={uploadingImage.has(content.id)}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                      {isVideoFile(finalImageUrl) ? (
                        <video 
                          key={`video-${content.id}-${Date.now()}`}
                          src={finalImageUrl}
                          className="w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                          controls
                          preload="auto"
                          onError={(e) => {
                            console.error('❌ Video failed to load in modal:', finalImageUrl)
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <img
                          key={`img-${content.id}-${Date.now()}`}
                          src={getFullSizeImageUrl(finalImageUrl) || finalImageUrl}
                          alt={content.title || 'Post image'}
                          className="w-full max-h-[70vh] object-contain rounded-lg shadow-lg cursor-pointer"
                          onClick={() => onImageClick(getFullSizeImageUrl(finalImageUrl) || finalImageUrl, content.title)}
                          loading="eager"
                          onError={(e) => {
                            console.error('❌ Image failed to load in modal:', finalImageUrl)
                            // Try to reload with a cache-busting parameter
                            const img = e.target
                            try {
                              if (finalImageUrl.includes('http://') || finalImageUrl.includes('https://')) {
                                const url = new URL(finalImageUrl)
                                url.searchParams.set('t', Date.now().toString())
                                img.src = url.toString()
                              } else {
                                // For relative URLs, append timestamp as query param
                                const separator = finalImageUrl.includes('?') ? '&' : '?'
                                img.src = `${finalImageUrl}${separator}t=${Date.now()}`
                              }
                            } catch (urlError) {
                              console.error('Failed to add cache-busting parameter:', urlError)
                            }
                          }}
                          onLoad={() => {
                            console.log('✅ Image loaded successfully in modal:', finalImageUrl)
                          }}
                        />
                      )}
                      
                      {/* Uploading overlay */}
                      {uploadingImage.has(content.id) && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
                            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                            <span className="text-gray-900 font-medium">Uploading...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              
              {/* Text Content Section */}
              <div className="space-y-6">
                {/* Content with Title */}
                {(content.title || content.content) && (
                  <div className="relative">
                    {editingContentInModal ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContentValue}
                          onChange={(e) => onEditContentValueChange(e.target.value)}
                          className="w-full px-3 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition-all duration-200 resize-none"
                          rows={6}
                          placeholder="Enter content"
                        />
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => onSaveManualEdit('content')}
                            disabled={savingModalEdit}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-200 disabled:opacity-50"
                            title="Save"
                          >
                            {savingModalEdit ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onCancelManualEdit('content')}
                            disabled={savingModalEdit}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-200 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {/* Logo */}
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {profile?.logo_url ? (
                            <img 
                              src={profile.logo_url} 
                              alt="Business logo" 
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none'
                                e.target.nextSibling.style.display = 'flex'
                              }}
                            />
                          ) : null}
                          <div className="w-full h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center" style={{ display: profile?.logo_url ? 'none' : 'flex' }}>
                            <Building2 className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        {/* Title and Content Text - Aligned to top of logo */}
                        <div className="flex-1 text-gray-700 whitespace-pre-wrap leading-relaxed relative">
                          <div>
                            {/* Business Name */}
                            {profile?.business_name && (
                              <p className="font-semibold text-gray-800 mb-1 text-sm">{profile.business_name}</p>
                            )}
                            {content.title && (
                              <h5 className="font-semibold text-gray-900 mb-2 text-base">{content.title}</h5>
                            )}
                            {content.content && (
                              <div className="text-sm">{cleanContentText(content.content)}</div>
                            )}
                            {/* Hashtags */}
                            {content.hashtags && content.hashtags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {content.hashtags.map((hashtag, index) => (
                                  <span
                                    key={index}
                                    className="text-purple-600 text-sm"
                                  >
                                    #{hashtag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Edit buttons just above the line */}
                {content.status?.toLowerCase() !== 'published' && (content.title || content.content) && (
                  <div className="flex justify-end pb-4">
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onManualEdit('content')
                        }}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors duration-200"
                        title="Edit manually"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onAIEdit('content')
                        }}
                        className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors duration-200"
                        title="Edit with AI"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ContentModal

