export interface ProfileInfo {
    first_name: string;
    last_name: string;
    email: string;
    membership: boolean;
    birthday?: Date | null;
    gender?: string | null;
}

export interface AddressSchema {
    address: string | null;
    suite: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    postal_code: string | null;
}

export interface ContactInfo {
    phone: string | null;
    address: AddressSchema;
}

export function toProfileInfo(base: any): ProfileInfo {
    return {
        first_name: base.first_name ?? "",
        last_name: base.last_name ?? "",
        email: base.email ?? "",
        membership: base.membership ?? "",
        birthday: base.birthday ? new Date(base.birthday) : null,
        gender: base.gender ?? null,
    };
}

export function toAddressSchema(base: any): AddressSchema {
    return {
        address: base.address ?? "",
        suite: base.suite ?? "",
        city: base.city ?? "",
        state: base.state ?? "",
        country: base.country ?? "",
        postal_code: base.postal_code ?? "",
    };
}

export function toContactInfo(base: any): ContactInfo {
    return {
        phone: base.phone ?? "",
        address: toAddressSchema(base.address ?? ""),
    };
}

