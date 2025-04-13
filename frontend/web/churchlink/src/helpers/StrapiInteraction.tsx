const API_BASE = import.meta.env.VITE_API_HOST;
const API_REDIRECT = "/api/v1/strapi";

export const processStrapiRedirect = async (email: string) => {
    try {
        const res = await fetch(`${API_BASE}${API_REDIRECT}/strapi-redirect?email=${encodeURIComponent(email)}`, {
            method: "POST",
        });

        if (!res.ok) throw new Error("Failed to contact redirect service");

        const data = await res.json();

        if (data.redirect) {
            window.open(data.redirect, "_blank");
        } else {
            alert("User does not exist or no redirect available.");
        }
    } catch (err) {
        console.error("Redirect error:", err);
        alert("Something went wrong.");
    }
};