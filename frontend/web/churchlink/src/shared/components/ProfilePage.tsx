import * as React from "react";
import { ProfileCard } from "@/components/Main/Profile/ProfileCard";
import { PersonRail } from "@/components/Main/Profile/PersonRail";
import { PersonDetails } from "@/types/Person";
import { ProfileEditDialog } from "@/components/Main/Profile/ProfileEditDialog";

const MOCK_PEOPLE: PersonDetails[] = [
    {
        id: "p1",
        firstName: "First",
        lastName: "Last",
        dob: { mm: "01", dd: "02", yyyy: "2001" },
        gender: "M",
    },
    {
        id: "p2",
        firstName: "Jane",
        lastName: "Doe",
        dob: { mm: "02", dd: "14", yyyy: "2012" },
        gender: "F",
    },
    {
        id: "p3",
        firstName: "Sam",
        lastName: "Lee",
        dob: { mm: "11", dd: "30", yyyy: "2015" },
        gender: "M",
    },
];

const ProfilePage: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-100">
            <div className="mx-auto max-w-5xl p-6">
                <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start">
                    <ProfileCard footer={<ProfileEditDialog />} />
                    <PersonRail className="lg:ml-6" people={MOCK_PEOPLE} />
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
