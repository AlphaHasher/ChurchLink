import { lazy } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";

// Lazy load components
const ArticlesListPage = lazy(() => import("@/pages/ArticlesListPage"));
const ArticlePage = lazy(() => import("@/pages/ArticlePage"));
const General = lazy(() => import("@/pages/General"));
const EventViewer = lazy(() => import("@/pages/EventViewer"));

function GeneralWrapper() {
  const { name } = useParams();
  return <General name={name || "Home"} />;
}

export const PublicRoutes = () => {
  return (
    <>
      <MainLayout>
        <Routes>
          <Route path="/events" element={<EventViewer />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
          <Route path="/:name?" element={<GeneralWrapper />} />
        </Routes>
      </MainLayout>
    </>
  );
};
