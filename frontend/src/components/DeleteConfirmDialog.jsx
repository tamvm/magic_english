import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import LoadingSpinner from './UI/LoadingSpinner'

const DeleteConfirmDialog = ({
  isOpen,
  onClose,
  groupName,
  vocabularyCount,
  onConfirm,
  loading = false
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Delete Group?
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to delete the group{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {groupName}
            </span>
            ?
          </p>

          {vocabularyCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <span className="font-semibold">Note:</span> This will orphan{' '}
                <span className="font-semibold">{vocabularyCount}</span>{' '}
                {vocabularyCount === 1 ? 'vocabulary' : 'vocabularies'}. They will
                remain in your library but won't belong to any group.
              </p>
            </div>
          )}

          {vocabularyCount === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This group contains no vocabularies.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 px-6 py-4 bg-gray-50 dark:bg-gray-750 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Group'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmDialog
