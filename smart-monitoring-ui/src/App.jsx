import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ResidentDashboard from './pages/ResidentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import NotFound from './pages/NotFound'

function RootRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/dashboard'} replace />
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />

        {/* Resident */}
        <Route path="/dashboard" element={
          <ProtectedRoute role="RESIDENT">
            <Layout><ResidentDashboard /></Layout>
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute role="ADMIN">
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        } />

        {/* Root → smart redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}
