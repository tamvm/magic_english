import React from 'react'
import { Folder, Book, Film, Music, Globe, Star, Heart, Bookmark, Tag, Flag, Edit, Trash2, GraduationCap } from 'lucide-react'

const ICON_MAP = {
  Folder,
  Book,
  Film,
  Music,
  Globe,
  Star,
  Heart,
  Bookmark,
  Tag,
  Flag
}

const GroupCard = ({ group, onEdit, onDelete, onStudy, onClick }) => {
  const IconComponent = ICON_MAP[group.icon] || Folder

  return (
    <div
      onClick={onClick}
      className="card hover:shadow-lg transition-shadow duration-200 cursor-pointer group"
    >
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Color indicator with icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: group.color }}
            >
              <IconComponent className="w-5 h-5 text-white" />
            </div>

            {/* Group info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                {group.name}
              </h3>
              {group.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {group.description}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {group.vocabularyCount || 0} {group.vocabularyCount === 1 ? 'word' : 'words'}
                </div>
                {group.wordsToLearn > 0 && (
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                    {group.wordsToLearn} to learn
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex space-x-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStudy(group)
              }}
              className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 dark:text-gray-400 dark:hover:text-green-400 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              title="Study this group"
            >
              <GraduationCap className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit(group)
              }}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 dark:text-gray-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Edit group"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(group)
              }}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete group"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Group metadata */}
        {(group.created_at || group.updated_at) && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              {group.updated_at && (
                <span>Updated {new Date(group.updated_at).toLocaleDateString()}</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default GroupCard
