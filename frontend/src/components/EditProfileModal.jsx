import React, { useState, useEffect, useRef } from 'react'
import { onboardingAPI } from '../services/onboarding'
import OnboardingForm from './OnboardingForm'
import { X, ChevronDown, Navigation, Save, RotateCcw, CheckCircle, HelpCircle, Keyboard } from 'lucide-react'

const EditProfileModal = ({ isOpen, onClose, onSuccess }) => {
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showStepNavigation, setShowStepNavigation] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveIndicator, setShowSaveIndicator] = useState(false)
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const [showHelpTooltip, setShowHelpTooltip] = useState(false)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const onboardingFormRef = useRef(null)

  const steps = [
    'Basic Business Info',
    'Business Description', 
    'Brand & Contact',
    'Current Presence & Focus Areas',
    'Social Media & Goals',
    'Content Strategy',
    'Market & Competition',
    'Campaign Planning',
    'Performance & Customer',
    'Automation & Platform',
    'Review & Submit'
  ]

  useEffect(() => {
    if (isOpen) {
      fetchProfileData()
    }
  }, [isOpen])

  // Close step navigation when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStepNavigation && !event.target.closest('.step-navigation')) {
        setShowStepNavigation(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showStepNavigation])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!isOpen) return

      // Close modal with Escape
      if (event.key === 'Escape') {
        if (showStepNavigation) {
          setShowStepNavigation(false)
        } else {
          onClose()
        }
      }

      // Step navigation with arrow keys
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'ArrowLeft' && currentStep > 0) {
          event.preventDefault()
          handleStepChange(currentStep - 1)
        } else if (event.key === 'ArrowRight' && currentStep < steps.length - 1) {
          event.preventDefault()
          handleStepChange(currentStep + 1)
        }
      }

      // Quick step navigation with number keys (1-9)
      if (event.key >= '1' && event.key <= '9') {
        const stepNumber = parseInt(event.key) - 1
        if (stepNumber < steps.length) {
          event.preventDefault()
          handleStepChange(stepNumber)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, currentStep, showStepNavigation, onClose])

  const fetchProfileData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await onboardingAPI.getProfile()
      setProfileData(response.data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess()
    }
    onClose()
  }

  const handleStepChange = (stepIndex) => {
    setCurrentStep(stepIndex)
    setShowStepNavigation(false)
    // Call the OnboardingForm's step change method if available
    if (onboardingFormRef.current && onboardingFormRef.current.goToStep) {
      onboardingFormRef.current.goToStep(stepIndex)
    }
  }

  const handleStepUpdate = (stepIndex) => {
    setCurrentStep(stepIndex)
  }

  const handleFormChange = () => {
    setHasUnsavedChanges(true)
  }

  const handleStepComplete = (stepIndex) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const resetChanges = () => {
    setHasUnsavedChanges(false)
    setShowSaveIndicator(false)
    if (onboardingFormRef.current && onboardingFormRef.current.resetForm) {
      onboardingFormRef.current.resetForm()
    }
  }

  const showSaveSuccess = () => {
    setShowSaveIndicator(true)
    setHasUnsavedChanges(false)
    setTimeout(() => setShowSaveIndicator(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex-1">
            <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-gray-900">Edit Profile</h2>
              {hasUnsavedChanges && (
                <div className="flex items-center space-x-2 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                  <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                  Unsaved Changes
                </div>
              )}
              {showSaveIndicator && (
                <div className="flex items-center space-x-2 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Saved!
                </div>
              )}
            </div>
            <p className="text-gray-600 mt-1">Update your business information and preferences</p>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2 mr-4">
            {hasUnsavedChanges && (
              <button
                onClick={resetChanges}
                className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                title="Reset Changes"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Step Navigation */}
          <div className="flex items-center space-x-4">
            {/* Help Button */}
            <div className="relative">
              <button
                onMouseEnter={() => setShowHelpTooltip(true)}
                onMouseLeave={() => setShowHelpTooltip(false)}
                onClick={() => setShowKeyboardHelp(true)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Navigation Help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              
              {/* Help Tooltip */}
              {showHelpTooltip && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-20">
                  <div className="font-semibold mb-2">Quick Navigation:</div>
                  <div className="space-y-1">
                    <div>• Click step dropdown to jump to any step</div>
                    <div>• Press 1-9 keys for quick access</div>
                    <div>• Use Ctrl+Arrow keys to navigate</div>
                    <div>• Press Escape to close</div>
                  </div>
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
              )}
            </div>

            <div className="relative step-navigation">
              <button
                onClick={() => setShowStepNavigation(!showStepNavigation)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
                title="Click to navigate between steps"
              >
                <Navigation className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">
                  Step {currentStep + 1}: {steps[currentStep]}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showStepNavigation ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Step Dropdown */}
              {showStepNavigation && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-50 hover:scrollbar-thumb-gray-400">
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Jump to Step
                      </div>
                      <div className="flex items-center space-x-1 text-xs text-gray-400">
                        <Keyboard className="w-3 h-3" />
                        <span>Press 1-9</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {steps.map((step, index) => (
                        <button
                          key={index}
                          onClick={() => handleStepChange(index)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                            index === currentStep
                              ? 'bg-pink-100 text-pink-700 font-medium shadow-sm'
                              : completedSteps.has(index)
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                              index === currentStep
                                ? 'bg-pink-600 text-white'
                                : completedSteps.has(index)
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {completedSteps.has(index) ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <span className="flex-1">{step}</span>
                            <div className="flex items-center space-x-2">
                              {index < 9 && (
                                <div className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-xs rounded group-hover:bg-gray-200 transition-colors">
                                  {index + 1}
                                </div>
                              )}
                              {index === currentStep && (
                                <div className="w-2 h-2 bg-pink-600 rounded-full"></div>
                              )}
                              {completedSteps.has(index) && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
          </div>
            
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-gray-600">Loading your profile...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Profile</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchProfileData}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : profileData ? (
            <OnboardingForm
              ref={onboardingFormRef}
              initialData={profileData}
              isEditMode={true}
              onClose={onClose}
              onSuccess={handleSuccess}
              showHeader={false}
              showProgress={true}
              onStepChange={handleStepUpdate}
              onFormChange={handleFormChange}
              onStepComplete={handleStepComplete}
            />
          ) : null}
        </div>
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      {showKeyboardHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Keyboard className="w-5 h-5 mr-2 text-pink-600" />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowKeyboardHelp(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Navigate to specific step</span>
                <div className="flex space-x-1">
                  {[1,2,3,4,5,6,7,8,9].map(num => (
                    <kbd key={num} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      {num}
                    </kbd>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Previous step</span>
                <kbd className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  Ctrl + ←
                </kbd>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Next step</span>
                <kbd className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  Ctrl + →
                </kbd>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-700">Close modal/dropdown</span>
                <kbd className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                  Esc
                </kbd>
              </div>
              
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">Show this help</span>
                <div className="flex items-center space-x-1">
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-500">Hover over help icon</span>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-700">
                💡 <strong>Pro tip:</strong> You can also click the step dropdown button to see all available steps and jump to any one instantly!
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditProfileModal
