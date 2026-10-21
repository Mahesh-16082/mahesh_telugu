
import { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false)

  if (showDashboard) {
    return <Dashboard />
  }

  return (
    <div>
      <Login />
      <button
        type="button"
        onClick={() => setShowDashboard(true)}
        className="fixed bottom-4 right-4 z-50 rounded-lg bg-[#173B67] px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-[#10243D]"
      >
        Preview Dashboard
      </button>
    </div>
  )
}
