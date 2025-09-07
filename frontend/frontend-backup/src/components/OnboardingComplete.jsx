import React from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, Sparkles } from 'lucide-react'

const OnboardingComplete = () => {
  const navigate = useNavigate()

  const handleGoToDashboard = () => {
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="relative mx-auto w-32 h-32 mb-6">
            {/* Outer ring animation */}
            <div className="absolute inset-0 rounded-full border-4 border-pink-200 animate-ping"></div>
            <div className="absolute inset-2 rounded-full border-4 border-pink-300 animate-pulse"></div>
            
            {/* Main success icon */}
            <div className="absolute inset-4 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl">
              <CheckCircle className="w-16 h-16 text-white" />
            </div>
            
            {/* Sparkle effects */}
            <div className="absolute -top-2 -right-2">
              <Sparkles className="w-6 h-6 text-yellow-400 animate-bounce" />
            </div>
            <div className="absolute -bottom-2 -left-2">
              <Sparkles className="w-4 h-4 text-pink-400 animate-bounce delay-300" />
            </div>
            <div className="absolute top-4 -left-4">
              <Sparkles className="w-5 h-5 text-purple-400 animate-bounce delay-700" />
            </div>
          </div>

          {/* Congratulations Message */}
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent mb-4">
            🎉 Congratulations!
          </h1>
          
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            Welcome to Emily!
          </h2>
          
          <p className="text-lg text-gray-600 mb-2">
            Your onboarding is complete and I'm ready to help you with
          </p>
          
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              'Content Creation',
              'Social Media Strategy', 
              'Campaign Planning',
              'Performance Analytics',
              'Marketing Automation'
            ].map((feature, index) => (
              <span 
                key={feature}
                className="px-3 py-1 bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700 rounded-full text-sm font-medium"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {feature}
              </span>
            ))}
          </div>
        </div>

        {/* Success Details */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              What's Next?
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
                  Personalized AI Assistant
                </h4>
                <p className="text-sm text-gray-600">
                  Emily will use your business information to provide tailored marketing recommendations.
                </p>
              </div>
              
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                  Smart Content Generation
                </h4>
                <p className="text-sm text-gray-600">
                  Get AI-powered content ideas, captions, and strategies for your social media.
                </p>
              </div>
              
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
                  Performance Tracking
                </h4>
                <p className="text-sm text-gray-600">
                  Monitor your campaigns and get insights to optimize your marketing efforts.
                </p>
              </div>
              
              <div className="text-left">
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                  <div className="w-2 h-2 bg-pink-500 rounded-full mr-2"></div>
                  24/7 Support
                </h4>
                <p className="text-sm text-gray-600">
                  Emily is always available to help with your marketing questions and challenges.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <button
            onClick={handleGoToDashboard}
            className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white text-lg font-semibold rounded-xl hover:from-pink-600 hover:to-purple-700 focus:ring-4 focus:ring-pink-200 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <span>Start Your Marketing Journey</span>
            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            Ready to revolutionize your digital marketing? Let's get started! 🚀
          </p>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Powered by AI • Secured by Supabase • Built with ❤️
          </p>
        </div>
      </div>
    </div>
  )
}

export default OnboardingComplete
