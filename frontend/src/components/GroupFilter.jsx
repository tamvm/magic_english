import React, { useState, useEffect, useRef } from 'react'
import { Filter, ChevronDown } from 'lucide-react'
import { useGroups } from '@/hooks/useGroups'
import { ICON_OPTIONS } from '@/constants/groupConstants'

const GroupFilter = ({ selectedGroups, onGroupsChange }) => {
  const { groups, loading } = useGroups()
  const [isOpen, setIsOpen] = useState(false)
  const [pendingGroups, setPendingGroups] = useState([])
  const dropdownRef = useRef(null)

  // Initialize pendingGroups when selectedGroups change from parent
  useEffect(() => {
    setPendingGroups(selectedGroups)
  }, [selectedGroups])

  // Get icon component from icon name
  const getIconComponent = (iconName) => {
    const iconOption = ICON_OPTIONS.find(opt => opt.name === iconName)
    return iconOption ? iconOption.Icon : null
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setPendingGroups(selectedGroups)
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, selectedGroups])

  const handleToggleGroup = (groupId) => {
    if (pendingGroups.includes(groupId)) {
      setPendingGroups(pendingGroups.filter(id => id !== groupId))
    } else {
      setPendingGroups([...pendingGroups, groupId])
    }
  }

  const handleSelectAll = () => {
    setPendingGroups([])
  }

  const handleApplyFilter = () => {
    onGroupsChange(pendingGroups)
    setIsOpen(false)
  }

  const handleCancel = () => {
    setPendingGroups(selectedGroups)
    setIsOpen(false)
  }

  const getButtonText = () => {
    if (selectedGroups.length === 0) {
      return 'Filter by Group'
    }
    return `${selectedGroups.length} group${selectedGroups.length > 1 ? 's' : ''} selected`
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
      >
        <Filter className="h-4 w-4 mr-2" />
        {getButtonText()}
        {selectedGroups.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-indigo-600 rounded-full">
            {selectedGroups.length}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
          <div className="p-2">
            {/* All Groups Option */}
            <button
              onClick={handleSelectAll}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={pendingGroups.length === 0}
                  onChange={handleSelectAll}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                  All Groups
                </span>
              </div>
            </button>

            <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>

            {/* Groups List */}
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading groups...
              </div>
            ) : groups.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No groups available
              </div>
            ) : (
              groups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => handleToggleGroup(group.id)}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={pendingGroups.includes(group.id)}
                      onChange={() => handleToggleGroup(group.id)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="ml-3 flex items-center">
                      <span
                        className="w-2 h-2 rounded-full mr-2"
                        style={{ backgroundColor: group.color }}
                      ></span>
                      {group.icon && (() => {
                        const IconComponent = getIconComponent(group.icon)
                        return IconComponent ? (
                          <IconComponent className="w-4 h-4 mr-2" style={{ color: group.color }} />
                        ) : null
                      })()}
                      <span className="text-sm text-gray-900 dark:text-white">{group.name}</span>
                    </span>
                  </div>
                </button>
              ))
            )}

            {/* Action Buttons */}
            <div className="my-2 border-t border-gray-200 dark:border-gray-700"></div>
            <div className="flex items-center justify-end gap-2 px-2 pb-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyFilter}
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
              >
                Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default GroupFilter
