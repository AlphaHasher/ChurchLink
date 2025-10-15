import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "../shared/layouts/Layout";
import DynamicPage from "../shared/components/DynamicPage";

const Streams = lazy(() => import("../features/misc/pages/Streams"));
const PaypalThankYouPage = lazy(() => import("../features/paypal/pages/thank-you"));
const FormPublicPage = lazy(() => import("../features/forms/pages/FormPublic"));
const SermonsPage = lazy(() => import("../features/sermons/pages/SermonsPage"));
const BulletinsPage = lazy(() => import("../features/bulletins/pages/BulletinsPage"));

export const PublicRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route index element={<DynamicPage />} />
        <Route path=":slug" element={<DynamicPage />} />

        <Route path="live" element={<Streams />} />

        <Route path="thank-you" element={<PaypalThankYouPage />} />
        <Route path="forms/:slug" element={<FormPublicPage />} />
        <Route path="sermons" element={<SermonsPage />} />
        <Route path="weekly-bulletin" element={<BulletinsPage />} />
      </Routes>
    </Layout>
  );
};
