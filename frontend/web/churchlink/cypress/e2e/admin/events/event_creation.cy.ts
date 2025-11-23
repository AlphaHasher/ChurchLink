import { visitEventsAdmin, openCreateEventDialog, fillValidEventBasics, pickEventImage, saveEventDialog, getEventRowByTitle, openEditDialogForEvent, openDeleteDialogForEvent, searchEventByTitle } from "cypress/e2e/mixed/events/events_helpers";

const EVENT_TITLE = "Cypress Admin Event";
const EVENT_TITLE_UPDATED = "Cypress Admin Event – updated";

describe("Admin / Events V2", () => {
    /**
     * Global setup: create the helper ministries & images
     * that the tests will reference.
     */
    before(() => {
        cy.adminlogin();
        cy.createTestMinistries();
        cy.createTestImages();
    });

    /**
     * Global teardown: clean up helper data.
     */
    after(() => {
        cy.deleteTestImages();
        cy.deleteTestMinistries();
    });

    /**
     * 1. Invalid create: missing English title should be rejected by do_event_validation
     */
    it("1. rejects creating an event with an empty title", () => {
        visitEventsAdmin();
        openCreateEventDialog();

        // Stub window.alert in the AUT
        cy.window().then((win) => {
            cy.stub(win, "alert").as("windowAlert");
        });

        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                // Explicitly blank required English title
                cy.get("input#title").should("be.visible").clear();

                // Try to save
                cy.contains("button", "Save").click();
            });

        // We expect a backend validation failure surfaced as window.alert,
        // and the dialog should still be open.
        cy.get("@windowAlert")
            .should("have.been.called")
            .its("firstCall.args.0")
            .should("contain", "Error for localization en");

        cy.get('[role="dialog"]').should("be.visible");

        // Close cleanly via Cancel so we don't rely on overlay
        cy.get('[role="dialog"]').within(() => {
            cy.contains("button", "Cancel").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
    });

    /**
 * 2. Invalid create: paid event with no payment options should be blocked
 * by the front-end guard in CreateEventDialogV2.
 */
    it("2. rejects paid events that have no payment options selected", () => {
        visitEventsAdmin();
        openCreateEventDialog();

        // Stub alert so we can assert the exact message
        cy.window().then((win) => {
            cy.stub(win, "alert").as("windowAlert");
        });

        // Make the event otherwise valid: title, description, ministries, address, future date
        fillValidEventBasics("Paid Event With Missing Options");

        // Select a valid event image from the media library
        pickEventImage("wolf.jpg");

        // Now configure RSVP / pricing in an invalid way (no payment options)
        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.contains("Registration").scrollIntoView();

                // Turn RSVP required ON
                cy.get('button[role="switch"][aria-label="RSVP required"]')
                    .should("exist")
                    .click();

                // Set a non-zero price using your placeholder
                cy.get('input[placeholder="0.00"]')
                    .should("be.visible")
                    .clear()
                    .type("20");

                cy.contains("label", "Location Address").click();


                // Don't select any payment options – this is the failure we're testing
                cy.contains("button", "Save").click();
            });

        // Front-end guard should now complain about missing payment options
        cy.get("@windowAlert")
            .should("have.been.called")
            .its("firstCall.args.0")
            .should("contain", "Paid events must include at least one payment option");

        // Dialog stays open
        cy.get('[role="dialog"]').should("be.visible");

        // Close via Cancel to avoid overlay-close issues
        cy.get('[role="dialog"]').within(() => {
            cy.contains("button", "Cancel").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
    });


    /**
     * 3. Valid create: event with ministry + image + simple configuration
     */
    it("3. creates a valid event with a ministry assignment and image", () => {
        visitEventsAdmin();
        openCreateEventDialog();

        // Fill valid basics and pick an image that our helper uploaded
        fillValidEventBasics(EVENT_TITLE);
        pickEventImage("wolf.jpg");

        // Save and close
        saveEventDialog();

        // The event should now appear in the grid
        getEventRowByTitle(EVENT_TITLE).should("be.visible");
    });

    /**
     * 4. Edit flow: attempt an invalid pricing change, then fix it and save.
     */
    it("4. edits the event, hits a pricing validation error, then saves a valid update", () => {
        visitEventsAdmin();
        openEditDialogForEvent(EVENT_TITLE);

        const alerts: string[] = [];
        cy.on("window:alert", (msg) => {
            alerts.push(msg);
        });

        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.contains("Title (en)").scrollIntoView();

                // Update title so we have a clear before/after
                cy.get("input#title")
                    .should("be.visible")
                    .clear()
                    .type(EVENT_TITLE_UPDATED);

                // Turn RSVP on, set a price, but don't yet choose payment options
                cy.contains("Registration").scrollIntoView();
                cy.get('button[role="switch"][aria-label="RSVP required"]')
                    .should("exist")
                    .click();

                cy.get('input[placeholder="0.00"]')
                    .should("be.visible")
                    .clear()
                    .type("15");

                cy.contains("label", "Location Address").click();

                // Try to save with price > 0 and *no* payment options chosen
                cy.contains("button", "Save").click();
            });

        // Expect the same front-end guard as in create
        cy.wrap(null).then(() => {
            const msg = alerts.join(" | ");
            expect(msg).to.contain("Paid events must include at least one payment option");
        });

        // Dialog should still be open; now fix by choosing a payment option
        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.contains("Registration").scrollIntoView();

                cy.contains("span", /paypal/i)
                    .closest("label")
                    .find('[role="checkbox"]')
                    .click();

                // Save for real this time
                cy.contains("button", "Save").click();
            });

        cy.get('[role="dialog"]').should("not.exist");

        // Updated title should show up in the table
        getEventRowByTitle(EVENT_TITLE_UPDATED).should("be.visible");
    });

    /**
     * 5. Delete flow: delete the event via actions column and confirm removal.
     */
    it("5. deletes the event and verifies it no longer appears in the grid", () => {
        visitEventsAdmin();

        // Open delete confirmation for the updated event
        openDeleteDialogForEvent(EVENT_TITLE_UPDATED);

        cy.get("@deleteDialog").within(() => {
            cy.contains("Type").should("contain.text", "Confirm");

            cy.get('input#deleteConfirm')
                .should("be.visible")
                .clear()
                .type("Confirm");

            cy.contains("button", "Delete").click();
        });

        // Dialog closes
        cy.contains("Delete Event").should("not.exist");

        // Verify the row is gone
        searchEventByTitle(EVENT_TITLE_UPDATED);
        cy.contains(
            ".ag-center-cols-container .ag-cell[col-id=\"default_title\"]",
            EVENT_TITLE_UPDATED,
        ).should("not.exist");
    });
});
