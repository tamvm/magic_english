import React, { useState } from 'react'
import { useGroups } from '@/hooks/useGroups'
import LoadingSpinner from '@/components/UI/LoadingSpinner'
import QuickGroupForm from '@/components/QuickGroupForm'

const GroupSelector = ({ value, onChange, className = '' }) => {
  const { groups, loading, refetch } = useGroups()
  const [showQuickForm, setShowQuickForm] = useState(false)

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value

    if (selectedValue === 'create_new') {
      setShowQuickForm(true)
    } else {
      onChange(selectedValue === '' ? null : selectedValue)
    }
  }

  const handleQuickCreateSubmit = async (newGroup) => {
    setShowQuickForm(false)
    // Refetch groups to include the newly created group
    await refetch()
    onChange(newGroup.id)
  }

  const handleQuickCreateClose = () => {
    setShowQuickForm(false)
  }

  const selectedGroup = groups.find(g => g.id === value)

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <LoadingSpinner size="sm" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading groups...</span>
      </div>
    )
  }

  return (
    <>
      <div className={className}>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Assign to Group (Optional)
        </label>

        {groups.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            <p>No groups available. <button
              onClick={() => setShowQuickForm(true)}
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Create your first group
            </button></p>
          </div>
        ) : (
          <>
            <select
              value={value || ''}
              onChange={handleSelectChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">No Group</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
              <option value="create_new">+ Create New Group</option>
            </select>

            {selectedGroup && (
              <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedGroup.color }}
                />
                <span>{selectedGroup.name}</span>
              </div>
            )}
          </>
        )}
      </div>

      <QuickGroupForm
        isOpen={showQuickForm}
        onClose={handleQuickCreateClose}
        onSubmit={handleQuickCreateSubmit}
      />
    </>
  )
}

export default GroupSelector
