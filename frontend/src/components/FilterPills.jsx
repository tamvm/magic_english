import React from 'react'
import { X } from 'lucide-react'
import { ICON_OPTIONS } from '@/constants/groupConstants'

const FilterPills = ({ selectedGroups, groups, onRemoveGroup, onClearAll }) => {
  if (selectedGroups.length === 0) {
    return null
  }

  const getGroupById = (id) => {
    if (id === 'ungrouped') {
      return { id: 'ungrouped', name: 'Ungrouped', color: '#9CA3AF' }
    }
    return groups.find(g => g.id === id)
  }

  // Get icon component from icon name
  const getIconComponent = (iconName) => {
    const iconOption = ICON_OPTIONS.find(opt => opt.name === iconName)
    return iconOption ? iconOption.Icon : null
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Active Filters:
      </span>

      {selectedGroups.map((groupId) => {
        const group = getGroupById(groupId)
        if (!group) return null

        return (
          <div
            key={groupId}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 transition-colors"
          >
            <span
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: group.color }}
            ></span>
            {group.icon && (() => {
              const IconComponent = getIconComponent(group.icon)
              return IconComponent ? (
                <IconComponent className="w-4 h-4 mr-1.5" style={{ color: group.color }} />
              ) : null
            })()}
            <span className="font-medium">{group.name}</span>
            <button
              onClick={() => onRemoveGroup(groupId)}
              className="ml-2 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5 transition-colors"
              aria-label={`Remove ${group.name} filter`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      })}

      {selectedGroups.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium underline transition-colors"
        >
          Clear All
        </button>
      )}
    </div>
  )
}

export default FilterPills
