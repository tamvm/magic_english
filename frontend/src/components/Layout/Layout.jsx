import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const Layout = () => {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Mobile sidebar overlay */}
      {showMobileSidebar && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setShowMobileSidebar(false)}
        >
          <div className="absolute inset-0 bg-gray-600 opacity-75"></div>
        </div>
      )}

      <Sidebar showMobile={showMobileSidebar} setShowMobile={setShowMobileSidebar} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header showMobileSidebar={showMobileSidebar} setShowMobileSidebar={setShowMobileSidebar} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="container mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout