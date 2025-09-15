import * as React from "react";
import { ProfileCard } from "@/features/users/components/Profile/ProfileCard";
import { PersonRail } from "@/features/users/components/Profile/PersonRail";
import { PersonDetails } from "@/shared/types/Person";
import { ProfileEditDialog } from "@/features/users/components/Profile/ProfileEditDialog";
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
            <div className="mx-auto max-w-5xl p-6">
                <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
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
                </div>
            </div>
        </Layout>
    );
};

export default ProfilePage;