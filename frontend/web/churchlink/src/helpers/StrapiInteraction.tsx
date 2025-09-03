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
    try {
        const res = await api.get(`/v1/strapi/uploads/search?query=${encodeURIComponent(query)}`)
        return res.data
    } catch (err) {
        console.error("Strapi search error:", err)
        return []
    }
}
