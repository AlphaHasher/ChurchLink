import * as React from "react";
import { motion } from "framer-motion";
import { UserCog, CalendarDays, IdCard } from "lucide-react";
import { ProfileCard } from "@/features/users/components/Profile/ProfileCard";
import { PersonRail } from "@/features/users/components/Profile/PersonRail";
import { DeleteAccountCard } from "@/features/users/components/Profile/DeleteAccountCard";
import { PersonDetails } from "@/shared/types/Person";
import { ProfileEditDialog } from "@/features/users/components/Profile/ProfileEditDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import Layout from "@/shared/layouts/Layout";
import { useNavigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/shared/components/ui/skeleton";

import { ProfileInfo, toContactInfo, toProfileInfo, ContactInfo } from "@/shared/types/ProfileInfo";
import { getMyProfileInfo, getMyFamilyMembers } from "@/helpers/UserHelper";
import {
    Gender,
    PersonInfo as EditPersonInfo,
} from "@/features/users/components/Profile/PersonInfoInput";
import { ContactCard } from "../components/Profile/ContactCard";
import { EditContactDialog } from "../components/Profile/EditContactDialog";

import MembershipCard from "../components/Profile/MembershipCard";
import MembershipRequestDialog from "../components/Profile/MembershipRequestDialog";
import { readMembershipDetails } from "@/helpers/MembershipHelper";
import type { MembershipDetails } from "@/shared/types/MembershipRequests";
import { useLocalize } from "@/shared/utils/localizationUtils";
import MyEventsPageV2 from "@/features/eventsV2/pages/MyEventsPageV2";

import ChangeEmailDialog from "@/features/users/components/Profile/ChangeEmailDialog";
import ChangePasswordDialog from "@/features/users/components/Profile/ChangePasswordDialog";

const toGender = (g?: string | null): Gender => (g === "M" || g === "F" ? g : "");

const toPersonInfo = (p: ProfileInfo): EditPersonInfo => ({
    firstName: p.first_name,
    lastName: p.last_name,
    dob: {
        mm: p.birthday ? String(p.birthday.getMonth() + 1).padStart(2, "0") : "01",
        dd: p.birthday ? String(p.birthday.getDate()).padStart(2, "0") : "01",
        yyyy: p.birthday ? String(p.birthday.getFullYear()) : "2000",
    },
    gender: toGender(p.gender),
});

const ProfilePage: React.FC = () => {
    const localize = useLocalize();
    const [loading, setLoading] = React.useState(true);
    const [profile, setProfile] = React.useState<ProfileInfo | null>(null);
    const [contact, setContact] = React.useState<ContactInfo | null>(null);
    const [members, setMembers] = React.useState<PersonDetails[]>([]);

    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);

    // Derive tab from pathname, query param, or hash
    let tabValue: "profile" | "membership" | "events"
    if (location.pathname.includes("/profile/my-events")) {
        tabValue = "events";
    } else if (
        location.pathname.includes("/profile/membership") ||
        searchParams.get("tab") === "membership" ||
        location.hash === "#membership"
    ) {
        tabValue = "membership";
    } else {
        tabValue = "profile";
    }

    const navigate = useNavigate();
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogResubmission, setDialogResubmission] = React.useState(false);
    const [dialogDetails, setDialogDetails] = React.useState<MembershipDetails | null>(null);

    const [refreshKey, setRefreshKey] = React.useState(0);
    const refreshCard = () => setRefreshKey((k) => k + 1);

    React.useEffect(() => {
        let alive = true;
        (async () => {
            const data = await getMyProfileInfo();
            const p = toProfileInfo(data.profile_info);
            const c = toContactInfo(data.contact_info);
            const m = await getMyFamilyMembers();
            if (alive) {
                setProfile(p);
                setContact(c);
                setMembers(m);
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    const openMembershipDialog = async (resubmission: boolean) => {
        const latest = await readMembershipDetails();
        setDialogDetails(latest);
        setDialogResubmission(resubmission);
        setDialogOpen(true);
    };

    if (loading)
        return (
            <Layout>
                <div className="mx-auto max-w-5xl p-6">
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-1/3" />
                        <Skeleton className="h-48 w-full" />
                    </div>
                </div>
            </Layout>
        );

    if (!profile) {
        return (
            <Layout>
                <div className="mx-auto max-w-5xl p-6">Failed to load profile.</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="mx-auto max-w-7xl p-6">
                <Tabs
                    value={tabValue}
                    onValueChange={(v) => {
                        if (v === "events") navigate("/profile/my-events");
                        else if (v === "membership") navigate("/profile/membership");
                        else navigate("/profile");
                    }}
                    className="w-full"
                >
                    {/* Tab switcher header */}
                    <div className="mt-4 mb-8 flex justify-center px-3 sm:px-4">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="w-full max-w-5xl"
                        >
                            <TabsList className="flex w-full flex-col gap-2 bg-transparent p-0 rounded-none sm:flex-row sm:items-stretch sm:gap-4 py-6">
                                <TabsTrigger
                                    value="profile"
                                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <UserCog className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("Profile")}
                                </TabsTrigger>

                                <TabsTrigger
                                    value="membership"
                                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <IdCard className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("Membership")}
                                </TabsTrigger>

                                <TabsTrigger
                                    value="events"
                                    className="group flex w-full items-center justify-center gap-2 rounded-full bg-neutral-200 px-4 py-3 text-base font-['Playfair_Display'] font-semibold text-neutral-800 transition-all duration-300 ease-out hover:bg-neutral-300 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white sm:flex-1 sm:px-6 sm:py-4 sm:text-lg"
                                >
                                    <CalendarDays className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    {localize("My Events")}
                                </TabsTrigger>
                            </TabsList>
                        </motion.div>
                    </div>

                    <TabsContent value="profile" className="min-h-[60vh]">
                        <motion.div
                            className="flex flex-col items-center gap-6 lg:flex-row lg:items-start"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ProfileCard
                                firstName={profile.first_name}
                                lastName={profile.last_name}
                                email={profile.email}
                                membership={profile.membership}
                                birthday={profile.birthday}
                                gender={profile.gender}
                                footer={
                                    <div className="grid w-full gap-2">
                                        <div className="grid grid-cols-2 gap-2 [&_button]:w-full">
                                            <ChangeEmailDialog />
                                            <ChangePasswordDialog />
                                        </div>

                                        <ProfileEditDialog
                                            email={profile.email}
                                            membership={profile.membership}
                                            initialPerson={toPersonInfo(profile)}
                                            onUpdated={(p) => setProfile(p)}
                                        />
                                    </div>
                                }
                            />
                            <ContactCard
                                className="lg:ml-6"
                                phone={contact?.phone ?? null}
                                address={contact?.address ?? null}
                                footer={
                                    <EditContactDialog
                                        initialContact={contact!}
                                        onUpdated={(c) => setContact(c)}
                                    />
                                }
                            />
                            <PersonRail className="lg:ml-6" people={members} />
                        </motion.div>
                        <motion.div
                            className="mt-6 w-full"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
                        >
                            <DeleteAccountCard />
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="membership" className="min-h-[calc(100svh-280px)] pb-8 sm:pb-12">
                        <motion.div
                            className="flex justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="w-full max-w-3xl">
                                <MembershipCard
                                    key={refreshKey}
                                    onRequest={() => openMembershipDialog(false)}
                                    onResubmit={() => openMembershipDialog(true)}
                                    onRead={() => openMembershipDialog(false)}
                                />
                            </div>
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="events" className="min-h-[60vh]">
                        <MyEventsPageV2 />
                    </TabsContent>
                </Tabs>
            </div>

            {dialogDetails && (
                <MembershipRequestDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    details={dialogDetails}
                    resubmission={dialogResubmission}
                    onSubmitted={refreshCard}
                />
            )}
        </Layout>
    );
};

export default ProfilePage;
