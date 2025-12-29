import React from 'react'
import { Instagram, Facebook, MessageCircle, Hash } from 'lucide-react'

const ATSNContentCard = ({ content, platform, contentType, intent, onClick }) => {
  // Platform icons
  const getPlatformIcon = (platformName) => {
    switch (platformName?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-5 h-5 text-pink-500" />
      case 'facebook':
        return <Facebook className="w-5 h-5 text-blue-600" />
      case 'linkedin':
        return <div className="w-5 h-5 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs font-bold">in</div>
      case 'twitter':
        return <div className="w-5 h-5 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs">𝕏</div>
      case 'tiktok':
        return <div className="w-5 h-5 bg-black rounded-sm flex items-center justify-center text-white text-xs">TT</div>
      default:
        return <MessageCircle className="w-5 h-5 text-gray-500" />
    }
  }

  // Platform display name
  const getPlatformDisplayName = (platformName) => {
    switch (platformName?.toLowerCase()) {
      case 'whatsapp business':
        return 'WhatsApp'
      case 'gmail':
        return 'Email'
      default:
        return platformName?.charAt(0).toUpperCase() + platformName?.slice(1)
    }
  }

  return (
    <div
      className="bg-white rounded-xl shadow-lg overflow-hidden max-w-md w-full cursor-pointer hover:shadow-xl transition-shadow duration-200"
      onClick={onClick}
    >
      {/* Header with platform logo and name */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {getPlatformIcon(platform)}
          <span className="font-semibold text-gray-900">
            {getPlatformDisplayName(platform)}
          </span>
        </div>
        <div className="text-xs text-gray-500 capitalize">
          {contentType?.replace('_', ' ')}
        </div>
      </div>

      {/* Image on top */}
      {content.media_url && (
        <div className="relative">
          <img
            src={content.media_url}
            alt={content.title || "Content image"}
            className="w-full aspect-square object-cover"
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        {content.title && (
          <h3 className="text-lg text-gray-900 mb-2 leading-tight">
            {content.title}
          </h3>
        )}

        {/* Content and Hashtags - Hide for view_content and delete_content */}
        {intent !== 'view_content' && intent !== 'delete_content' && (
          <>
            {/* Content text */}
            {content.content && (
              <p className="text-gray-700 text-sm leading-relaxed mb-3">
                {content.content.length > 150
                  ? `${content.content.substring(0, 150)}...`
                  : content.content
                }
              </p>
            )}

            {/* Hashtags */}
            {content.hashtags && content.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {content.hashtags.slice(0, 5).map((hashtag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full"
                  >
                    <Hash className="w-3 h-3" />
                    {hashtag.replace('#', '')}
                  </span>
                ))}
                {content.hashtags.length > 5 && (
                  <span className="text-xs text-gray-500">
                    +{content.hashtags.length - 5} more
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default ATSNContentCard
