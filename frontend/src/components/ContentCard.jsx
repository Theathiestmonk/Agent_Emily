import React, { useState } from 'react';
import { Copy, Edit, Eye, Heart, MessageCircle, Share, Calendar, Hash, Image as ImageIcon, Video, FileText } from 'lucide-react';

const ContentCard = ({ content, platform, contentType, onEdit, onCopy, onPreview }) => {
  const [copied, setCopied] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content.content || content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy content:', err);
    }
  };

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return '📷';
      case 'facebook': return '📘';
      case 'twitter': return '🐦';
      case 'linkedin': return '💼';
      case 'tiktok': return '🎵';
      case 'pinterest': return '📌';
      case 'whatsapp business': return '💬';
      default: return '📱';
    }
  };

  const getContentTypeIcon = (contentType) => {
    switch (contentType?.toLowerCase()) {
      case 'story': return <FileText className="w-4 h-4" />;
      case 'post': return <MessageCircle className="w-4 h-4" />;
      case 'reel': return <Video className="w-4 h-4" />;
      case 'image': return <ImageIcon className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getPlatformColor = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return 'from-pink-500 to-purple-600';
      case 'facebook': return 'from-blue-600 to-blue-800';
      case 'twitter': return 'from-sky-400 to-sky-600';
      case 'linkedin': return 'from-blue-700 to-blue-900';
      case 'tiktok': return 'from-black to-gray-800';
      case 'pinterest': return 'from-red-500 to-red-700';
      case 'whatsapp business': return 'from-green-500 to-green-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  const contentText = content.content || content;
  const title = content.title || `${contentType} for ${platform}`;
  const hashtags = content.hashtags || [];
  const mediaUrl = content.media_url || content.mediaUrl;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getPlatformColor(platform)} p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{getPlatformIcon(platform)}</span>
            <div>
              <h3 className="font-semibold text-lg">{title}</h3>
              <div className="flex items-center space-x-2 text-sm opacity-90">
                {getContentTypeIcon(contentType)}
                <span className="capitalize">{contentType}</span>
                <span>•</span>
                <span className="capitalize">{platform}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Copy content"
            >
              {copied ? (
                <span className="text-xs">✓</span>
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            {onEdit && (
              <button
                onClick={() => onEdit(content)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Edit content"
              >
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onPreview && (
              <button
                onClick={() => onPreview(content)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Preview content"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Media Preview */}
      {mediaUrl && (
        <div className="relative">
          <img
            src={mediaUrl}
            alt="Content media"
            className="w-full h-48 object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
          <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-xs">
            {mediaUrl.includes('video') ? 'Video' : 'Image'}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="space-y-3">
          <div className="text-gray-800 leading-relaxed">
            {showFullContent ? contentText : contentText.substring(0, 200)}
            {contentText.length > 200 && (
              <button
                onClick={() => setShowFullContent(!showFullContent)}
                className="ml-2 text-pink-500 hover:text-pink-600 font-medium"
              >
                {showFullContent ? 'Show less' : '...Show more'}
              </button>
            )}
          </div>

          {/* Call to Action */}
          {content.call_to_action && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-lg">
              <p className="text-sm text-blue-800 font-medium">
                💬 {content.call_to_action}
              </p>
            </div>
          )}

          {/* Engagement Hooks */}
          {content.engagement_hooks && (
            <div className="bg-green-50 border-l-4 border-green-400 p-3 rounded-r-lg">
              <p className="text-sm text-green-800 font-medium">
                🎯 {content.engagement_hooks}
              </p>
            </div>
          )}

          {/* Image Caption */}
          {content.image_caption && (
            <div className="bg-gray-50 border-l-4 border-gray-400 p-3 rounded-r-lg">
              <p className="text-sm text-gray-700 italic">
                📷 {content.image_caption}
              </p>
            </div>
          )}

          {/* Visual Elements */}
          {content.visual_elements && content.visual_elements.length > 0 && (
            <div className="bg-purple-50 border-l-4 border-purple-400 p-3 rounded-r-lg">
              <p className="text-sm text-purple-800 font-medium mb-2">
                🎨 Visual Elements:
              </p>
              <div className="flex flex-wrap gap-1">
                {content.visual_elements.map((element, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs"
                  >
                    {element}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {hashtags && hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hashtags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-medium"
                >
                  <Hash className="w-3 h-3 mr-1" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <Heart className="w-4 h-4" />
              <span>0</span>
            </div>
            <div className="flex items-center space-x-1">
              <MessageCircle className="w-4 h-4" />
              <span>0</span>
            </div>
            <div className="flex items-center space-x-1">
              <Share className="w-4 h-4" />
              <span>0</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>Draft</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCard;
