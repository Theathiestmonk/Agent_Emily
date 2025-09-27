import React from 'react'
import { Loader2 } from 'lucide-react'

const MainContentLoader = ({ message = "Loading..." }) => {
  return (
    <div className="flex-1 bg-transparent flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
        <p className="text-gray-600 font-medium">{message}</p>
        
        {/* Loading Bar */}
        <div className="w-64 bg-gray-200 rounded-full h-2 overflow-hidden mt-4">
          <div className="h-full bg-gradient-to-r from-pink-500 to-purple-600 rounded-full animate-pulse">
            <div 
              className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full animate-pulse" 
              style={{
                background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #6366f1)',
                backgroundSize: '200% 100%',
                animation: 'loading-gradient 1.5s ease-in-out infinite'
              }}
            >
            </div>
          </div>
        </div>
        
        {/* Progress Dots */}
        <div className="flex justify-center space-x-1 mt-4">
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
      
      <style>{`
        @keyframes loading-gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  )
}

export default MainContentLoader
