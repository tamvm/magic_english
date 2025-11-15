import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const AuthContext = createContext({})

// Initialize Supabase client
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, fullName) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) throw error

      toast.success('Account created! Please check your email for verification.')
      return { data, error: null }
    } catch (error) {
      toast.error(error.message)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      toast.success('Welcome back!')
      return { data, error: null }
    } catch (error) {
      toast.error(error.message)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signOut()

      if (error) throw error

      toast.success('Signed out successfully')
      return { error: null }
    } catch (error) {
      toast.error(error.message)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast.success('Password reset email sent!')
      return { error: null }
    } catch (error) {
      toast.error(error.message)
      return { error }
    }
  }

  const updatePassword = async (password) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) throw error

      toast.success('Password updated successfully!')
      return { error: null }
    } catch (error) {
      toast.error(error.message)
      return { error }
    }
  }

  const updateProfile = async (updates) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      })

      if (error) throw error

      toast.success('Profile updated successfully!')
      return { error: null }
    } catch (error) {
      toast.error(error.message)
      return { error }
    }
  }

  const getAccessToken = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) throw error
      return session?.access_token
    } catch (error) {
      console.error('Error getting access token:', error)
      return null
    }
  }

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    updateProfile,
    getAccessToken,
    supabase,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}