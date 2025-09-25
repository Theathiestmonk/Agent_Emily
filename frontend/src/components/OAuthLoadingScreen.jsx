import React from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'

const OAuthLoadingScreen = ({ status, message }) => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 text-center">
        {/* Animated Logo */}
        <div className="mb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mb-4 animate-pulse">
            <span className="text-3xl font-bold text-white">E</span>
          </div>
        </div>

        {/* Status Icon */}
        <div className="mb-6">
          {status === 'processing' ? (
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 text-pink-500 animate-spin" />
            </div>
          ) : status === 'success' ? (
            <div className="flex justify-center">
              <CheckCircle className="w-12 h-12 text-green-500 animate-bounce" />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-500 text-2xl">⚠</span>
              </div>
            </div>
          )}
        </div>

        {/* Status Message */}
        <div className="mb-8">
          <h2 className={`text-2xl font-bold mb-2 ${
            status === 'processing' ? 'text-pink-600' :
            status === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {status === 'processing' && 'Authenticating with Google...'}
            {status === 'success' && 'Welcome to Emily!'}
            {status === 'error' && 'Authentication Error'}
          </h2>
          <p className="text-gray-600 text-lg">{message}</p>
          {status === 'processing' && (
            <p className="text-sm text-gray-500 mt-2">
              Setting up your account and checking your profile...
            </p>
          )}
        </div>

        {/* Progress Animation */}
        {status === 'processing' && (
          <div className="mb-8">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full animate-pulse"></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">Please wait while we set up your account...</p>
          </div>
        )}

        {/* Success Animation */}
        {status === 'success' && (
          <div className="mb-8">
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <p className="text-sm text-gray-500 mt-4">Redirecting to your dashboard...</p>
          </div>
        )}

        {/* Error Message */}
        {status === 'error' && (
          <div className="mb-8 p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-600 text-sm">
              Something went wrong during authentication. Please try again.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Powered by Emily AI • Secure Authentication
          </p>
        </div>
      </div>
    </div>
  )
}

export default OAuthLoadingScreen
