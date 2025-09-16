export type Gender = "M" | "F";

export type PersonDetails = {
    id: string;
    first_name: string;
    last_name: string;
    date_of_birth: Date;
    gender: Gender;
};

export type PersonLite = { id: string; first_name: string; last_name: string };