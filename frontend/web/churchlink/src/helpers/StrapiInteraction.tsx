import { confirmAuth } from "./AuthPackaging"

const API_BASE = import.meta.env.VITE_API_HOST
const API_REDIRECT = "/api/v1/strapi"

export const processStrapiRedirect = async () => {
    try {
        const idToken = await confirmAuth()
        const res = await fetch(`${API_BASE}${API_REDIRECT}/strapi-redirect`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        })

        if (!res.ok) throw new Error("Failed to contact redirect service")

        const data = await res.json()

        if (data.redirect) {
            window.open(data.redirect, "_blank")
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
        const idToken = await confirmAuth()

        const res = await fetch(
            `${API_BASE}/api/v1/strapi/uploads/search?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    "Content-Type": "application/json",
                },
            }
        )

        if (!res.ok) throw new Error("Failed to fetch images from Strapi")

        return await res.json()
    } catch (err) {
        console.error("Strapi search error:", err)
        return []
    }
}
