import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(sessionStorage.getItem('access_token')),
  )

  useEffect(() => {
    if (isAuthenticated) return

    const checkAuthentication = () => {
      if (sessionStorage.getItem('access_token')) {
        setIsAuthenticated(true)
      }
    }

    const intervalId = window.setInterval(checkAuthentication, 250)
    window.addEventListener('focus', checkAuthentication)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkAuthentication)
    }
  }, [isAuthenticated])

  return isAuthenticated ? <Dashboard /> : <Login />
}