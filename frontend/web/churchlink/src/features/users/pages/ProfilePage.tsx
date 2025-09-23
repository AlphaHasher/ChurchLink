import * as React from "react";
import { motion } from "framer-motion";
import { Settings, CalendarDays } from "lucide-react";
import { ProfileCard } from "@/features/users/components/Profile/ProfileCard";
import { PersonRail } from "@/features/users/components/Profile/PersonRail";
import { PersonDetails } from "@/shared/types/Person";
import { ProfileEditDialog } from "@/features/users/components/Profile/ProfileEditDialog";
import { MyEventsSection } from "@/features/events/components/MyEventsSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import Layout from "@/shared/layouts/Layout";

import { ProfileInfo } from "@/shared/types/ProfileInfo";
import { getMyProfileInfo, getMyFamilyMembers } from "@/helpers/UserHelper";
import {
    Gender,
    PersonInfo as EditPersonInfo,
} from "@/features/users/components/Profile/PersonInfoInput";

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
    const [loading, setLoading] = React.useState(true);
    const [profile, setProfile] = React.useState<ProfileInfo | null>(null);

    const [members, setMembers] = React.useState<PersonDetails[]>([]);

    React.useEffect(() => {
        let alive = true;
        (async () => {
            const p = await getMyProfileInfo();
            const m = await getMyFamilyMembers();
            if (alive) {
                setProfile(p);
                setMembers(m);
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    if (loading) return <div>Loading...</div>;

    if (!profile) {
        return (
            <Layout>
                <div className="mx-auto max-w-5xl p-6">Failed to load profile.</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="mx-auto max-w-6xl p-6">
                <Tabs defaultValue="profile" className="w-full">
                    <div className="flex justify-center mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                        >
                            <TabsList className="bg-neutral-300 p-4 rounded-xl gap-4 h-16">
                                <TabsTrigger 
                                    value="profile" 
                                    className="px-8 py-4 text-[18px] font-['Playfair_Display'] font-bold text-neutral-800 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white transition-all duration-300 ease-out rounded-lg group flex items-center gap-3"
                                >
                                    <Settings className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    Settings
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="events" 
                                    className="px-8 py-4 text-[18px] font-['Playfair_Display'] font-bold text-neutral-800 hover:text-black data-[state=active]:bg-black data-[state=active]:text-white transition-all duration-300 ease-out rounded-lg group flex items-center gap-3"
                                >
                                    <CalendarDays className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12 group-data-[state=active]:rotate-12" />
                                    My Events
                                </TabsTrigger>
                            </TabsList>
                        </motion.div>
                    </div>
                    
                    <TabsContent value="profile">
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
                                birthday={profile.birthday}
                                gender={profile.gender}
                                footer={
                                    <ProfileEditDialog
                                        email={profile.email}
                                        initialPerson={toPersonInfo(profile)}
                                        onUpdated={(p) => setProfile(p)}
                                    />
                                }
                            />
                            <PersonRail className="lg:ml-6" people={members} />
                        </motion.div>
                    </TabsContent>
                    
                    <TabsContent value="events">
                        <MyEventsSection />
                    </TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default ProfilePage;