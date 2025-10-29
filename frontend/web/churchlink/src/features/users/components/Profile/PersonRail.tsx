import * as React from "react";
import { motion } from "framer-motion";
import { PersonDetails } from "@/shared/types/Person";
import { PersonTile } from "./PersonTile";
import { AddPersonDialog } from "./AddPersonDialog";
import { getMyFamilyMembers } from "@/helpers/UserHelper";
import { useLocalize } from "@/shared/utils/localizationUtils";

type PersonRailProps = {
    people?: PersonDetails[];
    className?: string;
};

export const PersonRail: React.FC<PersonRailProps> = ({ people, className }) => {
    const localize = useLocalize();
    const heading = localize("Family Members");

    const [list, setList] = React.useState<PersonDetails[]>(people ?? []);
    React.useEffect(() => setList(people ?? []), [people]);

    const refresh = React.useCallback(async () => {
        const next = await getMyFamilyMembers();
        setList(next);
    }, []);

    return (
        <motion.aside
            className={["w-full lg:flex-1", className].filter(Boolean).join(" ")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
        >
            <div className="rounded-xl border bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-base font-semibold flex-1">{heading}</h3>
                    <AddPersonDialog onCreated={refresh} />
                </div>

                {list.length > 0 ? (
                    <ul className="space-y-3">
                        {list.map((p, index) => (
                            <motion.div
                                key={p.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 + index * 0.05, duration: 0.3, ease: "easeOut" }}
                            >
                                <PersonTile
                                    person={p}
                                    onUpdated={(next) =>
                                        setList((prev) => prev.map((it) => (it.id === next.id ? next : it)))
                                    }
                                    onDeleted={(id) => setList((prev) => prev.filter((it) => it.id !== id))}
                                />
                            </motion.div>
                        ))}
                    </ul>
                ) : (
                    <motion.div
                        className="text-sm text-gray-500"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
                    >
                        {localize("You have not added any Family Members to your account.")}
                    </motion.div>
                )}
            </div>
        </motion.aside>
    );
};
