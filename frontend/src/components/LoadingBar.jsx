import React from 'react'

const LoadingBar = ({ 
  message = "Loading...", 
  showPercentage = false, 
  progress = 0,
  className = "" 
}) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-center mb-4">
        <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
          <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
        </div>
        <span className="text-gray-700 font-medium">{message}</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: showPercentage ? `${Math.min(100, Math.max(0, progress))}%` : '100%',
            animation: showPercentage ? 'none' : 'loading-bar 2s ease-in-out infinite'
          }}
        />
      </div>
      
      {showPercentage && (
        <div className="text-center mt-2">
          <span className="text-sm text-gray-600 font-medium">
            {Math.round(progress)}%
          </span>
        </div>
      )}
      
      <style jsx>{`
        @keyframes loading-bar {
          0% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingBar
