import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "../shared/layouts/Layout";

const ArticlesListPage = lazy(() => import("../features/articles/pages/ArticlesListPage"));
const ArticlePage = lazy(() => import("../features/articles/pages/ArticlePage"));
const General = lazy(() => import("../shared/components/General"));
const Giving = lazy(() => import("../shared/components/Giving"));
const EventViewer = lazy(() => import("../features/events/pages/EventViewer"));
const Streams = lazy(() => import("../features/misc/pages/Streams"));
const PaypalThankYouPage = lazy(() => import("../features/paypal/pages/thank-you"));

export const PublicRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route index element={<General name="Home" />} />
        <Route path="events" element={<EventViewer />} />
        <Route path="articles" element={<ArticlesListPage />} />
        <Route path="articles/:id" element={<ArticlePage />} />
        <Route path="giving" element={<Giving />} />
        <Route path="live" element={<Streams />} />
        <Route path="thank-you" element={<PaypalThankYouPage />} />
      </Routes>
    </Layout>
  );
};
