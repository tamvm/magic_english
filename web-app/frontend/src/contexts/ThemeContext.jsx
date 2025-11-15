import React, { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({})

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'system'
    }
    return 'system'
  })

  const [resolvedTheme, setResolvedTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
      return theme
    }
    return 'light'
  })

  useEffect(() => {
    const root = window.document.documentElement

    // Remove previous theme classes
    root.classList.remove('light', 'dark')

    let newResolvedTheme = theme

    if (theme === 'system') {
      newResolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }

    // Add new theme class
    root.classList.add(newResolvedTheme)
    setResolvedTheme(newResolvedTheme)

    // Store theme preference
    localStorage.setItem('theme', theme)
  }, [theme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const handleChange = (e) => {
      const newResolvedTheme = e.matches ? 'dark' : 'light'
      setResolvedTheme(newResolvedTheme)

      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(newResolvedTheme)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const setThemeMode = (newTheme) => {
    if (['light', 'dark', 'system'].includes(newTheme)) {
      setTheme(newTheme)
    }
  }

  const toggleTheme = () => {
    if (theme === 'light') {
      setThemeMode('dark')
    } else if (theme === 'dark') {
      setThemeMode('system')
    } else {
      setThemeMode('light')
    }
  }

  const value = {
    theme,
    resolvedTheme,
    setTheme: setThemeMode,
    toggleTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}