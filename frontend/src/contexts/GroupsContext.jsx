import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { groupsAPI } from '@/lib/api'

const GroupsContext = createContext(null)

export const GroupsProvider = ({ children }) => {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const hasFetchedRef = useRef(false)

  const fetchGroups = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await groupsAPI.getAll()
      setGroups(response.data || [])
    } catch (err) {
      setError(err.message || 'Failed to fetch groups')
      console.error('Fetch groups error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Prevent duplicate fetch in React.StrictMode (development only)
    if (hasFetchedRef.current) return
    hasFetchedRef.current = true
    fetchGroups()
  }, [])

  const createGroup = async (groupData) => {
    try {
      const response = await groupsAPI.create(groupData)
      if (response.data) {
        setGroups(prev => [response.data, ...prev])
        return { success: true, data: response.data }
      }
    } catch (err) {
      console.error('Create group error:', err)
      return { success: false, error: err.message || 'Failed to create group' }
    }
  }

  const updateGroup = async (id, groupData) => {
    try {
      const response = await groupsAPI.update(id, groupData)
      if (response.data) {
        setGroups(prev => prev.map(g => g.id === id ? response.data : g))
        return { success: true, data: response.data }
      }
    } catch (err) {
      console.error('Update group error:', err)
      return { success: false, error: err.message || 'Failed to update group' }
    }
  }

  const deleteGroup = async (id) => {
    try {
      const response = await groupsAPI.delete(id)
      if (response.data) {
        setGroups(prev => prev.filter(g => g.id !== id))
        return { success: true, data: response.data }
      }
    } catch (err) {
      console.error('Delete group error:', err)
      return { success: false, error: err.message || 'Failed to delete group' }
    }
  }

  const value = {
    groups,
    loading,
    error,
    refetch: fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup
  }

  return (
    <GroupsContext.Provider value={value}>
      {children}
    </GroupsContext.Provider>
  )
}

export const useGroupsContext = () => {
  const context = useContext(GroupsContext)
  if (!context) {
    throw new Error('useGroupsContext must be used within a GroupsProvider')
  }
  return context
}
