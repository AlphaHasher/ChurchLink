// TransactionsHomePage.tsx

import * as React from "react";
import { motion } from "framer-motion";
import { CreditCard, FileText } from "lucide-react";

import Layout from "@/shared/layouts/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import MyTransactions from "@/features/transactions/MyTransactions";
import MyRefundRequests from "./RefundRequests/MyRefundRequests";
import { useLocalize } from "@/shared/utils/localizationUtils";
import { useNavigate, useLocation } from "react-router-dom";

const TransactionsHomePage: React.FC = () => {
    const localize = useLocalize();
    const navigate = useNavigate();
    const location = useLocation();

    // Derive tab from pathname (and optionally query/hash if you want later)
    // Derive tab from the specific sub-route
    let tabValue: "transactions" | "refund-requests";

    if (location.pathname.includes("/my-transactions/refund-requests")) {
        tabValue = "refund-requests";
    } else {
        tabValue = "transactions";
    }

    return (
        <Layout>
            <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
                <Tabs
                    value={tabValue}
                    onValueChange={(v) => {
                        if (v === "refund-requests") {
                            navigate("/my-transactions/refund-requests");
                        } else {
                            navigate("/my-transactions/view-transactions");
                        }
                    }}
                    className="w-full"
                >
                    {/* Tab switcher header */}
                    <div className="mt-4 mb-6 flex justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="w-full max-w-7xl"
                        >
                            <TabsList className="flex w-full flex-col bg-transparent p-0 py-4 sm:flex-row sm:items-stretch sm:gap-4">
                                <TabsTrigger
                                    value="transactions"
                                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <CreditCard className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("My Transactions")}
                                </TabsTrigger>

                                <TabsTrigger
                                    value="refund-requests"
                                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:mt-0 sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <FileText className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("My Refund Requests")}
                                </TabsTrigger>
                            </TabsList>
                        </motion.div>
                    </div>

                    {/* Tab contents */}

                    <TabsContent value="transactions" className="min-h-[60vh]">
                        <div className="mx-auto w-full max-w-7xl">
                            <MyTransactions />
                        </div>
                    </TabsContent>

                    <TabsContent value="refund-requests" className="min-h-[60vh]">
                        <div className="mx-auto w-full max-w-7xl">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="rounded-2xl border bg-background p-0 shadow-sm"
                            >
                                <MyRefundRequests />
                            </motion.div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default TransactionsHomePage;
