import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
// Emily Digital Marketing Agent - Main App Component
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import ContentDashboard from './components/ContentDashboard'
import ContentCalendar from './components/ContentCalendar'
import Onboarding from './components/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider, useNotifications } from './contexts/NotificationContext'
import { ContentCacheProvider } from './contexts/ContentCacheContext'
import { onboardingAPI } from './services/onboarding'
import NotificationWindow from './components/NotificationWindow'

function ProtectedRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth()
  const [onboardingStatus, setOnboardingStatus] = useState(null)
  const [checkingOnboarding, setCheckingOnboarding] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (isAuthenticated && user) {
        try {
          const response = await onboardingAPI.getOnboardingStatus()
          setOnboardingStatus(response.data.onboarding_completed)
        } catch (error) {
          console.error('Error checking onboarding status:', error)
          // If profile doesn't exist, user needs onboarding
          setOnboardingStatus(false)
        } finally {
          setCheckingOnboarding(false)
        }
      } else {
        setCheckingOnboarding(false)
      }
    }

    checkOnboardingStatus()
  }, [isAuthenticated, user])

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  // If user is authenticated but hasn't completed onboarding
  if (onboardingStatus === false) {
    return <Onboarding />
  }

  // If user is authenticated and has completed onboarding, show dashboard
  if (onboardingStatus === true) {
    return children
  }

  // If user is authenticated and onboarding status is unknown, show dashboard
  return children
}

function AppContent() {
  const { notifications, removeNotification, markAsRead } = useNotifications()

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/content" 
          element={
            <ProtectedRoute>
              <ContentDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/calendar" 
          element={
            <ProtectedRoute>
              <ContentCalendar />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/onboarding" 
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
      
      {/* Global Notification Window */}
      <NotificationWindow 
        notifications={notifications}
        onClose={removeNotification}
        onMarkAsRead={markAsRead}
      />
    </Router>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <ContentCacheProvider>
            <AppContent />
          </ContentCacheProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App

