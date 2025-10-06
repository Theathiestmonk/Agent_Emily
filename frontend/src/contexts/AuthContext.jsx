import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        // Clear any invalid tokens
        supabase.auth.signOut()
      } else if (session) { 
        setUser(session.user)
        setIsAuthenticated(true)
        // Store token in localStorage for API calls
        localStorage.setItem('authToken', session.access_token)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id)
      
      if (session) {
        setUser(session.user)
        setIsAuthenticated(true)
        // Store token in localStorage for API calls
        localStorage.setItem('authToken', session.access_token)
        
        // Ensure profile exists for new users (especially Google OAuth)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔄 Auth event triggered, ensuring profile exists...', event)
          // Run profile creation in background without blocking
          ensureProfileExists(session.user).catch(error => {
            console.log('⚠️ Profile creation failed, will be created during onboarding:', error.message)
          })
        }
      } else {
        setUser(null)
        setIsAuthenticated(false)
        // Remove token from localStorage
        localStorage.removeItem('authToken')
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Login failed' 
      }
    }
  }

  const register = async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      // Create basic profile record for new users
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              name: name,
              onboarding_completed: false,
              subscription_status: 'inactive',
              migration_status: 'pending'
            })

          if (profileError) {
            console.log('Profile creation error (non-critical):', profileError)
            // Don't fail registration if profile creation fails
          }
        } catch (profileError) {
          console.log('Profile creation error (non-critical):', profileError)
        }
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { 
          success: true, 
          message: "Registration successful! Please check your email to confirm your account." 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Registration failed' 
      }
    }
  }


  const loginWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Google sign-in failed' 
      }
    }
  }

  // Function to ensure profile exists for Google OAuth users
  const ensureProfileExists = async (user) => {
    if (!user) {
      console.log('❌ No user provided to ensureProfileExists')
      return
    }

    console.log('🔍 ensureProfileExists called for user:', user.id, user.email)

    try {
      // Check if profile exists with timeout
      console.log('🔍 Checking if profile exists for user:', user.id)
      
      const profileCheckPromise = supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile check timeout')), 5000)
      )
      
      const { data: existingProfile, error: fetchError } = await Promise.race([
        profileCheckPromise,
        timeoutPromise
      ])

      if (fetchError) {
        console.error('❌ Error checking profile:', fetchError)
        return
      }

      console.log('📊 Profile check result:', existingProfile)

      // If no profile exists, create one
      if (!existingProfile) {
        console.log('➕ No profile found, creating new profile for user:', user.id)
        const profileData = {
          id: user.id,
          name: user.user_metadata?.name || user.email,
          onboarding_completed: false,
          subscription_status: 'inactive',
          migration_status: 'pending'
        }
        
        console.log('📝 Creating profile with data:', profileData)
        
        const profileInsertPromise = supabase
          .from('profiles')
          .insert(profileData)
        
        const insertTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile creation timeout')), 5000)
        )
        
        const { error: insertError } = await Promise.race([
          profileInsertPromise,
          insertTimeoutPromise
        ])

        if (insertError) {
          console.error('❌ Error creating profile for Google user:', insertError)
        } else {
          console.log('✅ Profile created successfully for Google user:', user.id)
        }
      } else {
        console.log('✅ Profile already exists for user:', user.id)
      }
    } catch (error) {
      console.error('💥 Error ensuring profile exists:', error)
      console.log('🔄 Profile creation failed, user will need to create profile manually')
    }
  }

  const logout = async () => {
    try {
      console.log('🚪 Logging out user...')
      
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear local state
      setUser(null)
      setIsAuthenticated(false)
      
      // Clear localStorage
      localStorage.removeItem('authToken')
      
      // Clear any other cached data
      localStorage.removeItem('socialMediaCache')
      localStorage.removeItem('contentCache')
      
      console.log('✅ User logged out successfully')
      
      // Redirect to login page
      window.location.href = '/login'
      
    } catch (error) {
      console.error('❌ Logout error:', error)
      
      // Even if logout fails, clear local state and redirect
      setUser(null)
      setIsAuthenticated(false)
      localStorage.clear()
      window.location.href = '/login'
    }
  }

  const sendPasswordResetCode = async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to send verification code' 
      }
    }
  }

  const resetPassword = async (email, otp, newPassword) => {
    try {
      // First verify the OTP with type 'recovery'
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'recovery'
      })

      if (verifyError) {
        return { 
          success: false, 
          error: verifyError.message 
        }
      }

      // Update the password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        return { 
          success: false, 
          error: updateError.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to reset password' 
      }
    }
  }

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    sendPasswordResetCode,
    resetPassword,
    ensureProfileExists
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
