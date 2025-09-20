import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { authAPI } from '../services/api'

function SignUp() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [emailValidation, setEmailValidation] = useState({
    isValidating: false,
    isValid: null,
    message: ''
  })
  
  const { register, loginWithGoogle } = useAuth()
  const navigate = useNavigate()

  // Email validation function
  const validateEmail = async (email) => {
    if (!email || !email.includes('@')) {
      setEmailValidation({
        isValidating: false,
        isValid: null,
        message: ''
      })
      return
    }

    setEmailValidation({
      isValidating: true,
      isValid: null,
      message: ''
    })

    try {
      const response = await authAPI.checkEmail(email)
      setEmailValidation({
        isValidating: false,
        isValid: !response.data.exists,
        message: response.data.message
      })
    } catch (error) {
      setEmailValidation({
        isValidating: false,
        isValid: null,
        message: 'Error checking email availability'
      })
    }
  }

  // Debounced email validation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.email) {
        validateEmail(formData.email)
      }
    }, 500) // 500ms delay

    return () => clearTimeout(timeoutId)
  }, [formData.email])

  // Clear password fields when email validation fails
  useEffect(() => {
    if (emailValidation.isValid === false) {
      setFormData(prev => ({
        ...prev,
        password: '',
        confirmPassword: ''
      }))
    }
  }, [emailValidation.isValid])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMessage('')

    // Check if email is valid and available
    if (emailValidation.isValid === false) {
      setError('Please use a different email address')
      setLoading(false)
      return
    }

    // If email is still being validated, wait for it
    if (emailValidation.isValidating) {
      setError('Please wait while we check email availability')
      setLoading(false)
      return
    }

    // Only validate passwords if email is valid and available
    if (emailValidation.isValid === true) {
      // Validate password confirmation
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      // Validate password length
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long')
        setLoading(false)
        return
      }
    }

    try {
      const result = await register(formData.email, formData.password, formData.name)

      if (result.success) {
        if (result.message) {
          // Email confirmation required
          setSuccessMessage(result.message)
        } else {
          // Registration successful - let auth flow handle redirect
          // The ProtectedRoute will check onboarding status and redirect appropriately
          navigate('/dashboard')
        }
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    setSuccessMessage('')

    try {
      const result = await loginWithGoogle()
      
      if (!result.success) {
        setError(result.error)
      }
      // If successful, the user will be redirected automatically by Supabase
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mb-4">
            <span className="text-2xl font-bold text-white">E</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Join Emily
          </h1>
          <p className="text-gray-600">
            Create your account to get started
          </p>
        </div>

        {/* Sign Up Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors bg-blue-50"
                placeholder="Enter your full name"
              />
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors bg-blue-50 ${
                    emailValidation.isValid === true 
                      ? 'border-green-300 focus:ring-green-500' 
                      : emailValidation.isValid === false 
                      ? 'border-red-300 focus:ring-red-500' 
                      : 'border-gray-200'
                  }`}
                  placeholder="Enter your email"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  {emailValidation.isValidating && (
                    <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                  )}
                  {!emailValidation.isValidating && emailValidation.isValid === true && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                  {!emailValidation.isValidating && emailValidation.isValid === false && (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
              {/* Email validation message */}
              {emailValidation.message && (
                <p className={`mt-2 text-sm ${
                  emailValidation.isValid === true 
                    ? 'text-green-600' 
                    : emailValidation.isValid === false 
                    ? 'text-red-600' 
                    : 'text-gray-500'
                }`}>
                  {emailValidation.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className={`block text-sm font-medium mb-2 ${
                emailValidation.isValid === false || emailValidation.isValidating
                  ? 'text-gray-400'
                  : 'text-gray-700'
              }`}>
                Password
                {emailValidation.isValid === false && (
                  <span className="text-xs text-gray-400 ml-1">(Blocked - email exists)</span>
                )}
                {emailValidation.isValidating && (
                  <span className="text-xs text-gray-400 ml-1">(Checking email...)</span>
                )}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  disabled={emailValidation.isValid === false || emailValidation.isValidating}
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                    emailValidation.isValid === false || emailValidation.isValidating
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 border-gray-200'
                  }`}
                  placeholder={
                    emailValidation.isValid === false 
                      ? "Email already exists - password not needed"
                      : emailValidation.isValidating
                      ? "Checking email availability..."
                      : "Create a password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={emailValidation.isValid === false || emailValidation.isValidating}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    emailValidation.isValid === false || emailValidation.isValidating
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {emailValidation.isValid === false && (
                <p className="mt-1 text-sm text-gray-500">
                  Please use a different email address to continue
                </p>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${
                emailValidation.isValid === false || emailValidation.isValidating
                  ? 'text-gray-400'
                  : 'text-gray-700'
              }`}>
                Confirm Password
                {emailValidation.isValid === false && (
                  <span className="text-xs text-gray-400 ml-1">(Blocked - email exists)</span>
                )}
                {emailValidation.isValidating && (
                  <span className="text-xs text-gray-400 ml-1">(Checking email...)</span>
                )}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={emailValidation.isValid === false || emailValidation.isValidating}
                  className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                    emailValidation.isValid === false || emailValidation.isValidating
                      ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-50 border-gray-200'
                  }`}
                  placeholder={
                    emailValidation.isValid === false 
                      ? "Email already exists - password not needed"
                      : emailValidation.isValidating
                      ? "Checking email availability..."
                      : "Confirm your password"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={emailValidation.isValid === false || emailValidation.isValidating}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    emailValidation.isValid === false || emailValidation.isValidating
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading || emailValidation.isValidating || emailValidation.isValid === false}
              className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>

            {/* Separator */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {/* Sign In Link */}
            <div className="text-center">
              <span className="text-gray-500">Already have an account? </span>
              <Link
                to="/login"
                className="text-pink-600 hover:text-pink-700 font-medium transition-colors"
              >
                Sign in
              </Link>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Secure connection • Powered by AI
          </p>
        </div>
      </div>
    </div>
  )
}

export default SignUp
