import React from 'react'
import { Helmet } from 'react-helmet-async'
import { Home, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <>
      <Helmet>
        <title>Page Not Found - Magic English</title>
      </Helmet>

      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700">
              404
            </h1>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-4">
              Page not found
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="btn-secondary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default NotFound