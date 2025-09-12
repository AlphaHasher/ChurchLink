export type Gender = "M" | "F";

export type PersonDetails = {
    id: string;
    firstName: string;
    lastName: string;
    dob: { mm: string; dd: string; yyyy: string };
    gender: Gender;
};