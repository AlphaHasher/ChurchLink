import { Navigate, Route, Routes } from 'react-router';

import MainLayout from '../layouts/MainLayout';
import { useParams } from 'react-router';
import Dashboard from '../components/Dashboard';
import Login from '@/pages/Login';
import ArticlesListPage from '@/pages/ArticlesListPage';
import Signup from '@/pages/Signup';
import AdminLayout from '@/layouts/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ArticlePage from '@/pages/ArticlePage';
import Permissions from '@/pages/admin/Permissions';
import ContentManagement from '@/pages/admin/ContentManagement';
import Notification from '@/pages/admin/Notification';
import Finance from '@/pages/admin/Finance';


export const HomeRoutes = () => {
  const { uuid } = useParams<{ uuid: string }>();

  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />

          <Route path="/admin" element={<AdminLayout />} >
            <Route index element={<AdminDashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/permissions" element={<Permissions />} />
            <Route path="/admin/content" element={<ContentManagement />} />
            <Route path="/admin/notifications" element={<Notification />} />
            <Route path="/admin/finance" element={<Finance />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" />} />

          <Route
            path="/:name?"
            element={
              user ? (
                <PrivateLayout>
                  <GeneralWrapper />
                </PrivateLayout>
              ) : (
                <PublicLayout>
                  <GeneralWrapper />
                </PublicLayout>
              )
            }
          />
        </Routes>
      </MainLayout>
    </>
  );
};