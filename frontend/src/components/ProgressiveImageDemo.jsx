import React, { useState } from 'react'
import ProgressiveImage from './ProgressiveImage'

const ProgressiveImageDemo = () => {
  const [showDemo, setShowDemo] = useState(false)

  const demoImages = [
    {
      src: 'https://picsum.photos/800/600?random=1',
      alt: 'Demo Image 1',
      title: 'Mountain Landscape'
    },
    {
      src: 'https://picsum.photos/800/600?random=2', 
      alt: 'Demo Image 2',
      title: 'City Skyline'
    },
    {
      src: 'https://picsum.photos/800/600?random=3',
      alt: 'Demo Image 3', 
      title: 'Ocean View'
    },
    {
      src: 'https://picsum.photos/800/600?random=4',
      alt: 'Demo Image 4',
      title: 'Forest Path'
    }
  ]

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Progressive Image Loading Demo
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Experience the blur-to-sharp effect used by social media platforms
          </p>
          <button
            onClick={() => setShowDemo(!showDemo)}
            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-lg hover:from-pink-600 hover:to-purple-500 transition-all duration-300 font-medium"
          >
            {showDemo ? 'Hide Demo' : 'Show Demo'}
          </button>
        </div>

        {showDemo && (
          <div className="space-y-8">
            {/* Comparison Section */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Before vs After
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    Traditional Loading
                  </h3>
                  <div className="relative">
                    <img
                      src="https://picsum.photos/400/300?random=5"
                      alt="Traditional loading"
                      className="w-full h-64 object-cover rounded-lg"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg" />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Shows blank space or loading spinner
                  </p>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    Progressive Enhancement
                  </h3>
                  <ProgressiveImage
                    src="https://picsum.photos/400/300?random=6"
                    alt="Progressive loading"
                    className="w-full h-64 rounded-lg"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Smooth blur-to-sharp transition
                  </p>
                </div>
              </div>
            </div>

            {/* Features Section */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Key Features
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Lazy Loading</h3>
                  <p className="text-sm text-gray-600">
                    Images only load when they're about to be visible
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Blur-to-Sharp</h3>
                  <p className="text-sm text-gray-600">
                    Smooth transition from blurred placeholder to sharp image
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">Error Handling</h3>
                  <p className="text-sm text-gray-600">
                    Graceful fallback when images fail to load
                  </p>
                </div>
              </div>
            </div>

            {/* Gallery Section */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Image Gallery
              </h2>
              <p className="text-gray-600 mb-6">
                Scroll down to see progressive loading in action
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {demoImages.map((image, index) => (
                  <div key={index} className="group">
                    <ProgressiveImage
                      src={image.src}
                      alt={image.alt}
                      className="w-full h-48 rounded-lg group-hover:scale-105 transition-transform duration-300"
                    />
                    <p className="text-sm font-medium text-gray-700 mt-2 text-center">
                      {image.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Benefits */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">
                Performance Benefits
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    What You Get
                  </h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Faster perceived loading times
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Reduced bandwidth usage
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Better user experience
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Professional loading states
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-3">
                    Technical Features
                  </h3>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Intersection Observer API
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      CSS blur and scale effects
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Shimmer loading animation
                    </li>
                    <li className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Error state handling
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgressiveImageDemo
