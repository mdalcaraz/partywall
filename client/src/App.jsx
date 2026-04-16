import { Routes, Route } from 'react-router-dom'
import IndexPage      from './pages/IndexPage'
import GuestPage      from './pages/GuestPage'
import AdminPage      from './pages/AdminPage'
import DisplayPage    from './pages/DisplayPage'
import LoginPage      from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/"        element={<IndexPage />} />
      <Route path="/guest"   element={<GuestPage />} />
      <Route path="/display" element={<DisplayPage />} />
      <Route path="/login"   element={<LoginPage />} />
      <Route path="/admin"   element={
        <ProtectedRoute>
          <AdminPage />
        </ProtectedRoute>
      } />
      <Route path="*" element={<IndexPage />} />
    </Routes>
  )
}
