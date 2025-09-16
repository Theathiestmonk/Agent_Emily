import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
// Emily Digital Marketing Agent - Main App Component
import Login from './components/Login'
import SignUp from './components/SignUp'
import Dashboard from './components/Dashboard'
import ContentDashboard from './components/ContentDashboard'
import ContentCalendar from './components/ContentCalendar'
import SocialMediaDashboard from './components/SocialMediaDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import CampaignsDashboard from './components/CampaignsDashboard'
import AdsDashboard from './components/AdsDashboard'
import Chatbot from './components/Chatbot'
import Onboarding from './components/Onboarding'
import Profile from './components/Profile'
import GoogleDashboard from './components/GoogleDashboard'
import GoogleCallback from './components/GoogleCallback'
import TokenExchangeHandler from './components/TokenExchangeHandler'
import SettingsDashboard from './components/SettingsDashboard'
import ErrorBoundary from './components/ErrorBoundary'
import LoadingBar from './components/LoadingBar'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { NotificationProvider, useNotifications } from './contexts/NotificationContext'
import { ContentCacheProvider } from './contexts/ContentCacheContext'
import { SocialMediaCacheProvider } from './contexts/SocialMediaCacheContext'
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
          setOnboardingStatus(response.data.onboarding_completed ? 'completed' : 'incomplete')
        } catch (error) {
          console.error('Error checking onboarding status:', error)
          setOnboardingStatus('incomplete')
        }
      }
      setCheckingOnboarding(false)
    }

    checkOnboardingStatus()
  }, [isAuthenticated, user])

  if (loading || checkingOnboarding) {
    return <LoadingBar />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  if (onboardingStatus === 'incomplete') {
    return <Navigate to="/onboarding" />
  }

  return children
}

function AppContent() {
  const { notifications, removeNotification, markAsRead } = useNotifications()

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
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
          path="/social" 
          element={
            <ProtectedRoute>
              <SocialMediaDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <AnalyticsDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/campaigns" 
          element={
            <ProtectedRoute>
              <CampaignsDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/ads" 
          element={
            <ProtectedRoute>
              <AdsDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/chatbot" 
          element={
            <ProtectedRoute>
              <Chatbot />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/onboarding" 
          element={<Onboarding />} 
        />
        <Route 
          path="/profile" 
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/google-dashboard" 
          element={
            <ProtectedRoute>
              <GoogleDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/google-callback" 
          element={<GoogleCallback />} 
        />
        <Route 
          path="/auth/callback" 
          element={<TokenExchangeHandler />} 
        />
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute>
              <SettingsDashboard />
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
            <SocialMediaCacheProvider>
              <AppContent />
            </SocialMediaCacheProvider>
          </ContentCacheProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App