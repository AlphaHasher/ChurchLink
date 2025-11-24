/// <reference types="cypress" />

import {
    visitEventsAdmin,
    openCreateEventDialog,
    fillValidEventBasics,
    pickEventImage,
    saveEventDialog,
    searchEventByTitle,
    openDeleteDialogForEvent,
    openInstancesPageForEvent,
    openFirstInstanceDetails,
    getEventDialog,
} from "cypress/e2e/mixed/events/events_helpers";

const EVENT_TITLE = "Cypress Admin Force Registration Event";
const ADMIN_UID = Cypress.env("ADMIN_UID") as string | undefined;

const ensureAdminUid = () => {
    if (!ADMIN_UID) {
        throw new Error(
            "Cypress env var ADMIN_UID must be set for admin force registration tests.",
        );
    }
};

/**
 * From a clean browser state, navigate all the way to
 * /admin/events/:eventId/instance_details/:instanceId/user_registrations/:ADMIN_UID
 */
const goToAdminUserRegistrationDetails = () => {
    ensureAdminUid();

    visitEventsAdmin();
    openInstancesPageForEvent(EVENT_TITLE);
    openFirstInstanceDetails();

    // Bottom-of-page "Want to view a user that has not registered?" input
    cy.get('input[placeholder="Enter user ID…"]', { timeout: 15000 })
        .should("be.visible")
        .clear()
        .type(ADMIN_UID!);

    cy.contains("button", "Go")
        .should("be.enabled")
        .click();

    // Breadcrumb crumb in ViewUserRegistrationDetails
    cy.contains("span", `User: ${ADMIN_UID}`, { timeout: 15000 }).should(
        "be.visible",
    );

    // Sanity: both cards exist
    cy.contains("div", "Registered People").should("be.visible");
    cy.contains("div", "Not Registered").should("be.visible");
};

/**
 * Convenience for cleanup: delete the event by title using the existing
 * openDeleteDialogForEvent helper.
 */
const deleteEventByTitle = (title: string) => {
    visitEventsAdmin();
    openDeleteDialogForEvent(title);

    cy.get("@deleteDialog").within(() => {
        cy.get("#deleteConfirm").type("confirm");
        cy.contains("button", "Delete").click();
    });

    searchEventByTitle(title);
    cy.contains(".ag-center-cols-container .ag-row", title).should("not.exist");
};

describe("Admin can force register and unregister a user for an event instance", () => {
    before(() => {
        cy.adminlogin();
        ensureAdminUid();
        cy.createTestMinistries();
        cy.createTestImages();
    });

    after(() => {
        deleteEventByTitle(EVENT_TITLE);
        cy.deleteTestImages();
        cy.deleteTestMinistries();
    });

    it("1. creates a basic RSVP-required free event", () => {
        visitEventsAdmin();
        openCreateEventDialog();
        fillValidEventBasics(EVENT_TITLE);
        pickEventImage("wolf.jpg");

        // Turn RSVP required ON, keep event free (no price, no payment options)
        getEventDialog().within(() => {
            cy.contains("Registration").scrollIntoView();

            cy.get('button[role="switch"][aria-label="RSVP required"]')
                .should("be.visible")
                .click();
        });

        saveEventDialog();

        // Verify the event shows up in the grid
        searchEventByTitle(EVENT_TITLE);
        cy.contains(
            '.ag-center-cols-container .ag-cell[col-id="default_title"]',
            EVENT_TITLE,
            { timeout: 15000 },
        ).should("be.visible");
    });

    it("2. navigates from instances to the admin user registration details", () => {
        goToAdminUserRegistrationDetails();
    });

    it("3. force registers the admin for the instance", () => {
        goToAdminUserRegistrationDetails();

        // Grab the Not Registered card and click Force register on the first row
        cy.contains("div", "Not Registered")
            .parent() // mb-3 header row
            .parent() // Card root
            .as("notRegisteredCard");

        cy.get("@notRegisteredCard")
            .find('button[title="Force register"]', { timeout: 15000 })
            .first()
            .click();

        cy.contains("h2", "Force Register", { timeout: 15000 }).should(
            "be.visible",
        );

        // Register as free: leave price blank, just confirm
        cy.contains("button", "Force Register")
            .should("be.enabled")
            .click();

        // Dialog should close
        cy.contains("h2", "Force Register").should("not.exist");

        // After backend + admin:registration:changed refresh,
        // admin should appear in Registered People card with a Force unregister action.
        cy.contains("div", "Registered People")
            .parent()
            .parent()
            .as("registeredCard");

        cy.get("@registeredCard")
            .find('button[title="Force unregister"]', { timeout: 15000 })
            .should("exist");
    });

    it("4. force unregisters the admin again", () => {
        goToAdminUserRegistrationDetails();

        // Now admin should be in Registered People; force-unregister the first row
        cy.contains("div", "Registered People")
            .parent()
            .parent()
            .as("registeredCard");

        cy.get("@registeredCard")
            .find('button[title="Force unregister"]', { timeout: 15000 })
            .first()
            .click();

        cy.contains("h2", "Force Unregister", { timeout: 15000 }).should(
            "be.visible",
        );

        cy.contains("button", "Force Unregister")
            .should("be.enabled")
            .click();

        cy.contains("h2", "Force Unregister").should("not.exist");

        // After refresh, admin should be back under Not Registered with a Force register action.
        cy.contains("div", "Not Registered")
            .parent()
            .parent()
            .as("notRegisteredCard");

        cy.get("@notRegisteredCard")
            .find('button[title="Force register"]', { timeout: 15000 })
            .should("exist");
    });
});
