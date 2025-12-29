import React from 'react'
import { X, Hash } from 'lucide-react'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'

const ATSNContentModal = ({ content, onClose }) => {
  if (!content) return null

  // Platform icons
  const getPlatformIcon = (platformName) => {
    switch (platformName?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-6 h-6 text-pink-500" />
      case 'facebook':
        return <Facebook className="w-6 h-6 text-blue-600" />
      case 'linkedin':
        return <div className="w-6 h-6 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs font-bold">in</div>
      case 'twitter':
        return <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs">𝕏</div>
      case 'tiktok':
        return <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center text-white text-xs">TT</div>
      default:
        return <MessageCircle className="w-6 h-6 text-gray-500" />
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
      className="fixed inset-0 bg-black bg-opacity-75 z-30"
      onClick={onClose}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center gap-3">
              {getPlatformIcon(content.platform)}
              <span className="font-semibold text-gray-900">
                {getPlatformDisplayName(content.platform)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-lg flex items-center justify-center transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Image */}
            {content.media_url && (
              <div className="flex justify-center">
                <img
                  src={content.media_url}
                  alt={content.title || "Content image"}
                  className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Title */}
            {content.title && (
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                {content.title}
              </h2>
            )}

            {/* Full Content */}
            {content.content && (
              <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {content.content}
              </div>
            )}

            {/* Hashtags */}
            {content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                {content.hashtags.map((hashtag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full"
                  >
                    <Hash className="w-4 h-4" />
                    {hashtag.replace('#', '')}
                  </span>
                ))}
              </div>
            )}

            {/* Additional content fields */}
            {content.email_subject && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Email Subject:</h3>
                <p className="text-gray-700">{content.email_subject}</p>
              </div>
            )}

            {content.email_body && (
              <div className="pt-4">
                <h3 className="font-semibold text-gray-900 mb-2">Email Body:</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{content.email_body}</div>
              </div>
            )}

            {content.short_video_script && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Short Video Script:</h3>
                <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{content.short_video_script}</div>
              </div>
            )}

            {content.long_video_script && (
              <div className="pt-4">
                <h3 className="font-semibold text-gray-900 mb-2">Long Video Script:</h3>
                <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{content.long_video_script}</div>
              </div>
            )}

            {content.message && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2">Message:</h3>
                <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">{content.message}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ATSNContentModal
