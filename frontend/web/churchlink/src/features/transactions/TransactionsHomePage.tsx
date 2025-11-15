import * as React from "react";
import { motion } from "framer-motion";
import { CreditCard, FileText } from "lucide-react";

import Layout from "@/shared/layouts/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import MyTransactions from "@/features/transactions/MyTransactions";
import { useLocalize } from "@/shared/utils/localizationUtils";

const TransactionsHomePage: React.FC = () => {
    const localize = useLocalize();
    const [tabValue, setTabValue] = React.useState<"transactions" | "summary">(
        "transactions",
    );

    return (
        <Layout>
            {/* Outer bounding similar to ProfilePage, but this page is a bit more “wide” */}
            <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
                <Tabs
                    value={tabValue}
                    onValueChange={(v) =>
                        setTabValue((v as "transactions" | "summary") || "transactions")
                    }
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
                                    value="summary"
                                    className="group mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:mt-0 sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <FileText className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("Overview / Statements")}
                                </TabsTrigger>
                            </TabsList>
                        </motion.div>
                    </div>

                    {/* Tab contents */}

                    <TabsContent value="transactions" className="min-h-[60vh]">
                        {/* Bounded body – give the table a wider lane */}
                        <div className="mx-auto w-full max-w-7xl">
                            <MyTransactions />
                        </div>
                    </TabsContent>

                    <TabsContent value="summary" className="min-h-[60vh]">
                        <div className="mx-auto w-full max-w-7xl">
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="rounded-2xl border bg-background p-6 shadow-sm"
                            >
                                <h1 className="mb-2 text-xl font-semibold">
                                    {localize("Overview / Statements")}
                                </h1>
                                <p className="mb-4 text-sm text-muted-foreground">
                                    {localize(
                                        "This area will eventually show higher-level summaries of your giving and payments, downloadable statements, and other reporting tools.",
                                    )}
                                </p>

                                <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-sm text-muted-foreground">
                                    {localize(
                                        "For now, you can use the My Transactions tab to view and filter individual PayPal-backed transactions.",
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default TransactionsHomePage;
