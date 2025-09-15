import { lazy } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import Layout from "../shared/layouts/Layout";

// Lazy load components
const ArticlesListPage = lazy(() => import("../features/articles/pages/ArticlesListPage"));
const ArticlePage = lazy(() => import("../features/articles/pages/ArticlePage"));
const General = lazy(() => import("../shared/components/General"));
const Giving = lazy(() => import("../shared/components/Giving"));
const EventViewer = lazy(() => import("../features/events/pages/EventViewer"));

function GeneralWrapper() {
  const { name } = useParams();
  return <General name={name || "Home"} />;
}

export const PublicRoutes = () => {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/events" element={<EventViewer />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />
          <Route path="/giving" element={<Giving />} />
          <Route path="/:name?" element={<GeneralWrapper />} />
        </Routes>
      </Layout>
    </>
  );
};
