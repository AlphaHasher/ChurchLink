export interface ProfileInfo {
    first_name: string;
    last_name: string;
    email: string;
    birthday?: Date | null;
    gender?: string | null;
}

export function toProfileInfo(base: any): ProfileInfo {
    return {
        first_name: base.first_name ?? "",
        last_name: base.last_name ?? "",
        email: base.email ?? "",
        birthday: base.birthday ? new Date(base.birthday) : null,
        gender: base.gender ?? null,
    };
}