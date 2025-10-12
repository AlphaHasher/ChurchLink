import api from "../api/api"

export const processStrapiRedirect = async () => {
    try {
        const res = await api.post("/v1/strapi/strapi-redirect")

        if (res.data.redirect) {
            window.open(res.data.redirect, "_blank")
        } else {
            alert("User does not exist or no redirect available.")
        }
    } catch (err) {
        console.error("Redirect error:", err)
        alert("Something went wrong.")
    }
}

export const fetchStrapiImages = async (query: string) => {
    // Query uploads via dedicated backend endpoint (no admin role required)
    const params = new URLSearchParams();
    if (query && query.trim()) params.set('filters[name][$containsi]', query.trim());
    const res = await api.get(`/v1/strapi/uploads${params.toString() ? `?${params.toString()}` : ''}`)
    return res.data
}

export const uploadStrapiFiles = async (files: File[]) => {
    const formData = new FormData();
    for (const f of files) {
        formData.append('files', f);
    }
    // Use backend uploads endpoint
    const res = await api.post('/v1/strapi/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
}

export const listStrapiUploads = async (page: number, pageSize: number = 30) => {
    // List uploads via backend endpoint (server authenticates to Strapi)
    const params = new URLSearchParams();
    params.set('pagination[page]', String(page));
    params.set('pagination[pageSize]', String(pageSize));
    const res = await api.get(`/v1/strapi/uploads?${params.toString()}`);
    return res.data;
}
