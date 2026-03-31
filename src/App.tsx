/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PublicQuiz from './pages/PublicQuiz';
import AdminLayout from './layouts/AdminLayout';
import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import QuizEditor from './pages/admin/QuizEditor';
import LeadsView from './pages/admin/LeadsView';
import AnalyticsView from './pages/admin/AnalyticsView';
import UsersView from './pages/admin/UsersView';
import ProfileView from './pages/admin/ProfileView';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.rol)) return <Navigate to="/admin" replace />;

  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicQuiz />
  },
  {
    path: "/admin/login",
    element: <AdminLogin />
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <AdminDashboard />
      },
      {
        path: "profile",
        element: <ProfileView />
      },
      {
        path: "users",
        element: (
          <ProtectedRoute allowedRoles={['superadmin']}>
            <UsersView />
          </ProtectedRoute>
        )
      },
      {
        path: "quizzes/new",
        element: (
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'asistente']}>
            <QuizEditor />
          </ProtectedRoute>
        )
      },
      {
        path: "quizzes/:id",
        element: (
          <ProtectedRoute allowedRoles={['superadmin', 'admin', 'asistente']}>
            <QuizEditor />
          </ProtectedRoute>
        )
      },
      {
        path: "quizzes/:id/leads",
        element: <LeadsView />
      },
      {
        path: "quizzes/:id/analytics",
        element: <AnalyticsView />
      }
    ]
  }
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
