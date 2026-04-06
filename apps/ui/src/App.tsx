import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthProvider } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Spaces } from './pages/Spaces';
import { SpaceRouter } from './pages/SpaceRouter';
import { FileEditor } from './pages/FileEditor';
import { Users } from './pages/Users';
import { UserDetail } from './pages/UserDetail';

export function App() {
  const auth = useAuthProvider();

  useEffect(() => {
    auth.checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={
            <ProtectedRoute><Layout /></ProtectedRoute>
          }>
            <Route path="/spaces" element={<Spaces />} />
            <Route path="/spaces/:space/edit/*" element={<FileEditor />} />
            <Route path="/spaces/:space" element={<SpaceRouter />} />
            <Route path="/spaces/:space/*" element={<SpaceRouter />} />
            <Route path="/users" element={
              <ProtectedRoute adminOnly><Users /></ProtectedRoute>
            } />
            <Route path="/users/:id" element={
              <ProtectedRoute adminOnly><UserDetail /></ProtectedRoute>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/spaces" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
