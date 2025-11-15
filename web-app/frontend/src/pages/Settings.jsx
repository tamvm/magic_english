import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Settings as SettingsIcon } from 'lucide-react'

const Settings = () => {
  return (
    <>
      <Helmet>
        <title>Settings - Magic English</title>
      </Helmet>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Configure your account and application preferences
          </p>
        </div>

        <div className="card">
          <div className="card-body text-center py-12">
            <SettingsIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              Settings page coming soon! This will include AI provider configuration, profile settings, and more.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default Settings