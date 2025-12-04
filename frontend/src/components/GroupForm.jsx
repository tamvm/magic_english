import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import LoadingSpinner from './UI/LoadingSpinner'
import { PRESET_COLORS, ICON_OPTIONS } from '../constants/groupConstants'

const GroupForm = ({ isOpen, onClose, mode = 'create', initialData = {}, onSubmit }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: PRESET_COLORS[0],
    icon: 'Folder'
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && mode === 'edit' && initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        color: initialData.color || PRESET_COLORS[0],
        icon: initialData.icon || 'Folder'
      })
    } else if (isOpen && mode === 'create') {
      setFormData({
        name: '',
        description: '',
        color: PRESET_COLORS[0],
        icon: 'Folder'
      })
    }
    setErrors({})
  }, [isOpen, mode, initialData])

  const validateForm = () => {
    const newErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Group name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    const submitData = {
      ...formData,
      description: formData.description.trim() || null
    }

    await onSubmit(submitData)
    setLoading(false)
  }

  const handleColorSelect = (color) => {
    setFormData(prev => ({ ...prev, color }))
  }

  const handleIconSelect = (iconName) => {
    setFormData(prev => ({ ...prev, icon: iconName }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'Create New Group' : 'Edit Group'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name field */}
          <div>
            <label className="form-label">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className={`form-input ${errors.name ? 'border-red-500' : ''}`}
              placeholder="e.g., Business English"
              value={formData.name}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, name: e.target.value }))
                setErrors(prev => ({ ...prev, name: null }))
              }}
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description field */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input min-h-[80px]"
              placeholder="Brief description of this group..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              disabled={loading}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="form-label">Color</label>
            <div className="grid grid-cols-9 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    formData.color === color
                      ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800'
                      : ''
                  }`}
                  style={{ backgroundColor: color }}
                  disabled={loading}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Icon selector */}
          <div>
            <label className="form-label">Icon</label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleIconSelect(name)}
                  className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    formData.icon === name
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                  }`}
                  disabled={loading}
                  title={name}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Form actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                <>{mode === 'create' ? 'Create Group' : 'Save Changes'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GroupForm
