import { Navigate } from 'react-router-dom';
import { decodeToken } from '../lib/api';

export default function ProtectedRoute({ children, role }) {
  const payload = decodeToken();
  if (!payload) return <Navigate to="/login" replace />;
  if (payload.exp && payload.exp * 1000 < Date.now()) return <Navigate to="/login" replace />;
  if (role && payload.role !== role) return <Navigate to="/login" replace />;
  return children;
}
