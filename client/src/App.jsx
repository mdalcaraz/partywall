import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage       from './pages/LoginPage'
import SuperAdminPage  from './pages/SuperAdminPage'
import AdminPage       from './pages/AdminPage'
import GuestPage       from './pages/GuestPage'
import DisplayPage     from './pages/DisplayPage'
import ProtectedRoute  from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/login"      element={<LoginPage />} />

      <Route path="/superadmin" element={
        <ProtectedRoute role="superadmin"><SuperAdminPage /></ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute role="operario"><AdminPage /></ProtectedRoute>
      } />

      <Route path="/admin/:eventId" element={
        <ProtectedRoute role="superadmin"><AdminPage /></ProtectedRoute>
      } />

      <Route path="/e/:eventId/guest"   element={<GuestPage />} />
      <Route path="/e/:eventId/display" element={<DisplayPage />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
