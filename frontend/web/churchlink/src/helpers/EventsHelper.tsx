import { confirmAuth } from "./AuthPackaging"
import { processFetchedEventData } from "./DataFunctions"
import { ChurchEvent } from "@/types/ChurchEvent"

const API_BASE = import.meta.env.VITE_API_HOST
const API_EVENTS = "/api/v1/events"

// Fetch all events
export const fetchEvents = async () => {
    try {
        const res = await fetch(`${API_BASE}${API_EVENTS}/`, {
            method: "GET",
        })

        if (!res.ok) throw new Error("Failed to fetch events")

        const data = await res.json()
        return processFetchedEventData(data)
    } catch (err) {
        console.error("Failed to fetch events:", err)
        return []
    }
}

// Validates the event — throws if anything is missing
export const verifyValidEvent = (event: ChurchEvent) => {
    const missingFields: string[] = []

    if (!event.name.trim()) missingFields.push("English Title")
    if (!event.ru_name.trim()) missingFields.push("Russian Title")
    if (!event.description.trim()) missingFields.push("English Description")
    if (!event.ru_description.trim()) missingFields.push("Russian Description")
    if (!event.location.trim()) missingFields.push("Location")
    if (!event.image_url.trim()) missingFields.push("Event Image")
    if (event.roles.length === 0) missingFields.push("Assigned Roles")



    if (missingFields.length > 0) {
        const formatted = missingFields.join(", ")
        alert(`Please fill out the following required fields:\n${formatted}`)
        throw new Error("Missing required event fields")
    }
}

// Main handler for event creation
export const handleEventCreation = async (event: ChurchEvent) => {
    verifyValidEvent(event)

    // Strip image_url to just the filename after the last slash
    const parts = event.image_url.split("/")
    event.image_url = parts[parts.length - 1]

    try {
        const idToken = await confirmAuth()

        const payload = {
            name: event.name,
            ru_name: event.ru_name,
            description: event.description,
            ru_description: event.ru_description,
            date: event.date,
            location: event.location,
            price: event.price,
            spots: event.spots,
            rsvp: event.rsvp,
            recurring: event.recurring,
            ministry: event.ministry,
            min_age: event.min_age,
            max_age: event.max_age,
            gender: event.gender,
            image_url: event.image_url,
            roles: event.roles,
            published: event.published,
        }

        const res = await fetch(`${API_BASE}${API_EVENTS}/`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const error = await res.json()
            console.error("❌ Failed to create event:", error)
            alert("Event creation failed. Please check for duplicate name or invalid fields.")
        }
    } catch (err) {
        console.error("Unexpected error creating event:", err)
        alert("Something went wrong while creating the event.")
    }

};

export const handleEventEdit = async (event: ChurchEvent) => {
    verifyValidEvent(event)

    // Strip image_url to just the filename after the last slash
    const parts = event.image_url.split("/")
    event.image_url = parts[parts.length - 1]

    try {
        const idToken = await confirmAuth()

        const payload = {
            name: event.name,
            ru_name: event.ru_name,
            description: event.description,
            ru_description: event.ru_description,
            date: event.date,
            location: event.location,
            price: event.price,
            spots: event.spots,
            rsvp: event.rsvp,
            recurring: event.recurring,
            ministry: event.ministry,
            min_age: event.min_age,
            max_age: event.max_age,
            gender: event.gender,
            image_url: event.image_url,
            roles: event.roles,
            published: event.published,
        }

        const res = await fetch(`${API_BASE}${API_EVENTS}/${event.id}`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        })

        if (!res.ok) {
            const error = await res.json()
            console.error("❌ Failed to edit event:", error)
            alert("Event edit failed. Please check for duplicate name or invalid fields.")
        }
    } catch (err) {
        console.error("Unexpected error editing event:", err)
        alert("Something went wrong while editing the event.")
    }

};

export const deleteEvent = async (eventID: string) => {
    try {
        const idToken = await confirmAuth()

        const res = await fetch(`${API_BASE}${API_EVENTS}/${eventID}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json",
            },
        })

        if (!res.ok) {
            const error = await res.json()
            console.error("❌ Failed to delete event:", error)
            alert("Event creation failed. Please check for duplicate name or invalid fields.")
        }
    } catch (err) {
        console.error("Unexpected error deleting event:", err)
        alert("Something went wrong while deleting the event.")
    }
}
