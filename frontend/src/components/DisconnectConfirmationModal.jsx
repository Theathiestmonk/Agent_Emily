import React from 'react'
import { AlertTriangle, X, Loader2, Facebook, Instagram, Linkedin, Youtube, Globe, Mail, Chrome, FileText } from 'lucide-react'

const DisconnectConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  platform, 
  accountName, 
  isLoading = false 
}) => {
  if (!isOpen) return null

  const platformInfo = {
    facebook: {
      color: 'bg-blue-600',
      icon: Facebook,
      name: 'Facebook'
    },
    instagram: {
      color: 'bg-pink-500',
      icon: Instagram,
      name: 'Instagram'
    },
    twitter: {
      color: 'bg-black',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
      name: 'X (Twitter)'
    },
    linkedin: {
      color: 'bg-blue-700',
      icon: Linkedin,
      name: 'LinkedIn'
    },
    youtube: {
      color: 'bg-red-600',
      icon: Youtube,
      name: 'YouTube'
    },
      wordpress: {
        color: 'bg-gray-600',
        icon: 'https://logo.svgcdn.com/d/wordpress-original.svg',
        name: 'WordPress'
      },
      google: {
        color: 'bg-red-500',
        icon: 'https://logo.svgcdn.com/d/google-original.svg',
        name: 'Google'
      }
  }

  const currentPlatform = platformInfo[platform] || {
    color: 'bg-gray-600',
    icon: Globe,
    name: 'Platform'
  }

  const renderIcon = (icon, name) => {
    if (typeof icon === 'string') {
      return (
        <img 
          src={icon} 
          alt={`${name} logo`}
          className="w-8 h-8"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'block'
          }}
        />
      )
    }
    const IconComponent = icon
    return <IconComponent className="w-8 h-8" />
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header with platform branding */}
        <div className={`${currentPlatform.color} px-6 py-8 ${currentPlatform.color === 'bg-white' ? 'text-gray-900' : 'text-white'} relative`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-16 h-16 ${currentPlatform.color} rounded-2xl flex items-center justify-center ${currentPlatform.color === 'bg-white' ? 'border border-gray-200' : ''}`}>
                {typeof currentPlatform.icon === 'string' ? (
                  <img 
                    src={currentPlatform.icon} 
                    alt={currentPlatform.name} 
                    className="w-8 h-8 object-contain"
                    style={currentPlatform.color === 'bg-white' ? {} : { filter: 'brightness(0) invert(1)' }}
                  />
                ) : (
                  <currentPlatform.icon className={`w-8 h-8 ${currentPlatform.color === 'bg-white' ? 'text-gray-900' : 'text-white'}`} />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold">Disconnect {currentPlatform.name}</h2>
                <p className={`text-sm ${currentPlatform.color === 'bg-white' ? 'text-gray-600' : 'text-white/80'}`}>This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 ${
                currentPlatform.color === 'bg-white' 
                  ? 'bg-gray-200 hover:bg-gray-300' 
                  : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
              }`}
            >
              <X className={`w-5 h-5 ${currentPlatform.color === 'bg-white' ? 'text-gray-600' : 'text-white'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Warning section */}
          <div className="flex items-start space-x-4 mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Are you sure you want to disconnect?
              </h3>
              <p className="text-gray-600 text-sm">
                You're about to disconnect your <span className="font-medium text-gray-900">{currentPlatform.name}</span> account.
              </p>
            </div>
          </div>

          {/* Account info */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 ${platform === 'google' || platform === 'wordpress' ? 'bg-white' : currentPlatform.color} rounded-xl flex items-center justify-center`}>
                {typeof currentPlatform.icon === 'string' ? (
                  <img src={currentPlatform.icon} alt={currentPlatform.name} className="w-5 h-5" />
                ) : (
                  <currentPlatform.icon className={`w-5 h-5 ${platform === 'google' || platform === 'wordpress' ? 'text-gray-600' : 'text-white'}`} />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{accountName}</p>
                <p className="text-sm text-gray-500">{currentPlatform.name} Account</p>
              </div>
            </div>
          </div>

          {/* Consequences */}
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <h4 className="font-semibold text-red-800 mb-3 flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              What happens when you disconnect:
            </h4>
            <ul className="space-y-2 text-sm text-red-700">
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>Automatic posting to {currentPlatform.name} will stop</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>Access to your account data will be removed</span>
              </li>
              <li className="flex items-start">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                <span>You'll need to reconnect to use this platform again</span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Disconnecting...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  <span>Disconnect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisconnectConfirmationModal
