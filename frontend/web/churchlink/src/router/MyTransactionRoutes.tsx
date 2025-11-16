import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

const TransactionsHomePage = lazy(() => import("../features/transactions/TransactionsHomePage"));

export const MyTransactionRoutes = () => {
    return (
        <Routes>
            <Route path="/" element={<TransactionsHomePage />}>
            </Route>
        </Routes>
    );
};
