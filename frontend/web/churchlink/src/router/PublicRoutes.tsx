import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "../shared/layouts/Layout";
import DynamicPage from "../shared/components/DynamicPage";

const Streams = lazy(() => import("../features/misc/pages/Streams"));
const PaypalThankYouPage = lazy(() => import("../features/paypal/pages/thank-you"));
const FormPublicPage = lazy(() => import("../features/forms/pages/FormPublic"));
const SermonsPage = lazy(() => import("../features/sermons/pages/SermonsPage"));
const BulletinsPage = lazy(() => import("../features/bulletins/pages/BulletinsPage"));
const FormPaymentSuccessPage = lazy(() => import("../features/forms/pages/FormPaymentSuccessPage"));
const FormPaymentCancelPage = lazy(() => import("../features/forms/pages/FormPaymentCancelPage"));
const SharableEvent = lazy(() => import("../features/eventsV2/pages/SharableEvent"));
const EventPaymentSuccessPageV2 = lazy(() => import("../features/eventsV2/pages/PaymentSuccessPageV2"));
const EventPaymentCancelPageV2 = lazy(() => import("../features/eventsV2/pages/PaymentCancelPageV2"));

const Donations = lazy(() => import("../features/admin/components/WebBuilder/sections/PaypalSection"));
const Events = lazy(() => import("../features/admin/components/WebBuilder/sections/EventSection"));

const OnetimeDonationSuccess = lazy(() => import("../features/donations/OneTimeDonationSuccess"));
const DonationSubscriptionSuccess = lazy(() => import("../features/donations/DonationSubscriptionSuccessPage"));

export const PublicRoutes = () => {
  return (
    <Layout>
      <Routes>
        <Route index element={<DynamicPage />} />
        <Route path=":slug" element={<DynamicPage />} />

        <Route path="live" element={<Streams />} />

        <Route path="thank-you" element={<PaypalThankYouPage />} />
        <Route path="forms/:slug" element={<FormPublicPage />} />

        <Route path="thank-you" element={<PaypalThankYouPage />} />

        <Route path="forms/:slug/payment/success" element={<FormPaymentSuccessPage />} />
        <Route path="forms/:slug/payment/cancel" element={<FormPaymentCancelPage />} />

        <Route path="events" element={<Events />} />
        <Route path="event_payments/:instanceId/payment/success" element={<EventPaymentSuccessPageV2 />} />
        <Route path="event_payments/:instanceId/payment/cancel" element={<EventPaymentCancelPageV2 />} />
        <Route path="sharable_events/:instanceId" element={<SharableEvent />} />


        <Route path="donations" element={<Donations />} />
        <Route path="donations/one-time/success" element={<OnetimeDonationSuccess />} />
        <Route path="donations/subscription/success" element={<DonationSubscriptionSuccess />} />

        <Route path="sermons" element={<SermonsPage />} />
        <Route path="weekly-bulletin" element={<BulletinsPage />} />


      </Routes>
    </Layout>
  );
};
