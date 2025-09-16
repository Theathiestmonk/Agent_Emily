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
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state change:', event, session?.user?.id)
      
      if (session) {
        setUser(session.user)
        setIsAuthenticated(true)
        // Store token in localStorage for API calls
        localStorage.setItem('authToken', session.access_token)
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

  const logout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
