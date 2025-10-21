import { processFetchedEventData } from "./DataFunctions"
import { ChurchEvent } from "@/shared/types/ChurchEvent"
import api from "../api/api"

// Fetch all events
export const fetchEvents = async () => {
    try {
        const res = await api.get("/v1/events/")
        return processFetchedEventData(res.data)
    } catch (err) {
        console.error("Failed to fetch events:", err)
        return []
    }
}

// Fetch canonical ministries list
export const fetchMinistries = async (): Promise<string[]> => {
    try {
        const res = await api.get("/v1/ministries")
        return res.data?.map((m: any) => m.name) || []
    } catch (err) {
        console.error("Failed to fetch ministries:", err)
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

        await api.post("/v1/events/", payload)
    } catch (err) {
        console.error("❌ Failed to create event:", err)
        alert("Event creation failed. Please check for duplicate name or invalid fields.")
    }
};

export const handleEventEdit = async (event: ChurchEvent) => {
    verifyValidEvent(event)

    // Strip image_url to just the filename after the last slash
    const parts = event.image_url.split("/")
    event.image_url = parts[parts.length - 1]

    try {
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

        await api.put(`/v1/events/${event.id}`, payload)
    } catch (err) {
        console.error("❌ Failed to edit event:", err)
        alert("Event edit failed. Please check for duplicate name or invalid fields.")
    }
};

export const deleteEvent = async (eventID: string) => {
    try {
        await api.delete(`/v1/events/${eventID}`)
    } catch (err) {
        console.error("❌ Failed to delete event:", err)
        alert("Something went wrong while deleting the event.")
    }
}
