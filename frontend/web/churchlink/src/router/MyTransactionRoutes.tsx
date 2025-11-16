import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const TransactionsHomePage = lazy(() => import("../features/transactions/TransactionsHomePage"));

export const MyTransactionRoutes = () => {
    return (
        <Routes>
            {/* default /my-transactions -> view transactions */}
            <Route path="/" element={<TransactionsHomePage />} />
            <Route path="view-transactions" element={<TransactionsHomePage />} />
            <Route path="refund-requests" element={<TransactionsHomePage />} />
        </Routes>
    );
};
