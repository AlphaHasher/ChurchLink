/// <reference types="cypress" />

import {
    visitEventsAdmin,
    openCreateEventDialog,
    fillValidEventBasics,
    pickEventImage,
    saveEventDialog,
    getEventRowByTitle,
    openDeleteDialogForEvent,
    searchEventByTitle,
    openInstancesPageForEvent,
    openEditInstanceDialogForRowIndex,
    visitUserEventsAsAdmin,
} from "cypress/e2e/mixed/events/events_helpers";

const INSTANCE_EVENT_TITLE = "Cypress Recurring Instance Event";

describe("Event instances and public /events filters", () => {
    /**
     * 0. Global setup: create helper ministries + images
     */
    before(() => {
        cy.adminlogin();
        cy.createTestMinistries();
        cy.createTestImages();
    });

    /**
     * 0. Global teardown: best-effort cleanup
     */
    after(() => {
        deleteEventByTitle(INSTANCE_EVENT_TITLE);
        cy.deleteTestImages();
        cy.deleteTestMinistries();
    });

    /**
     * 1. Create a recurring RSVP event (weekly) with max published = 4 and price 0.
     */
    it("1. creates a recurring RSVP event with four published instances", () => {
        visitEventsAdmin();
        openCreateEventDialog();

        // Standard "valid basics" from our helper (title, description, ministry, address, future date)
        fillValidEventBasics(INSTANCE_EVENT_TITLE);

        // Pick a known image from createTestImages()
        pickEventImage("wolf.jpg");

        cy.get('[role="dialog"]')
            .should("be.visible")
            .as("eventDialog");

        // Configure recurrence: weekly, with max published 4
        cy.get("@eventDialog").within(() => {
            cy.contains("Date & Recurrence").scrollIntoView();

            // Open the Recurrence select
            cy.contains('Label', 'Recurrence')
                .parent()
                .within(() => {
                    cy.get('[role="combobox"]').click();
                });
        });

        // Select "Weekly" from the dropdown
        cy.get('[role="listbox"]').contains('Weekly').click();

        // Now set Max Published to 4
        cy.get('@eventDialog').within(() => {
            cy.get('#maxPublished').scrollIntoView()
                .should('be.visible')
                .clear()
                .type('4');

            // Click a safe label to blur numeric inputs
            cy.contains("label", "Ministries").click();

            // Registration / RSVP section
            cy.contains("Registration").scrollIntoView();

            // Turn RSVP required ON
            cy.get('button[role="switch"][aria-label="RSVP required"]')
                .should("exist")
                .click();

            // Price = 0, member price left blank
            cy.get('input[placeholder="0.00"]')
                .first()
                .should("be.visible")
                .clear()
                .type("0");

            // Click a safe label to blur numeric inputs
            cy.contains("label", "Location Address").click();
        });

        // Save and close
        saveEventDialog();

        // Event should exist in the admin grid
        searchEventByTitle(INSTANCE_EVENT_TITLE);
        getEventRowByTitle(INSTANCE_EVENT_TITLE).should("be.visible");
    });

    /**
     * 2. Go to Event Instances page and override three instances:
     *
     * - series index 1: leave as-is
     * - series index 2: members only, men only, age 12+
     * - series index 3: women only, age 80 and under
     * - series index 4: ages 14–20, price 20, member price 45
     */
    it("2. configures overrides for specific event instances", () => {
        visitEventsAdmin();
        openInstancesPageForEvent(INSTANCE_EVENT_TITLE);

        // --- Series index 2: members only, men only, age 12+ ---
        // rowIndex 1 == second row, which has series_index = 2
        openEditInstanceDialogForRowIndex(1);

        // Wait for the dialog and alias it fresh each time
        cy.contains("h2", "Edit Event Instance", { timeout: 15000 })
            .closest('[role="dialog"]')
            .as("editInstanceDialog");

        cy.get("@editInstanceDialog")
            .should("be.visible")
            .within(() => {
                cy.contains("h3", "Who is allowed to attend")
                    .parents("section")
                    .as("eligibilitySection");
            });

        // Enable overrides + members only
        cy.get("@eligibilitySection").within(() => {
            cy.get('button[role="switch"]').click();
            cy.get("#membersOnly").click();

            // Open gender select
            cy.contains("label", "Gender")
                .parent()
                .within(() => {
                    cy.get('[role="combobox"]').click();
                });
        });

        // Gender options are rendered in a portal, so select OUTSIDE .within()
        cy.contains('[role="option"]', "Men only").click();

        // Age 12+
        cy.get("@eligibilitySection").within(() => {
            cy.get("#minAge").clear().type("12");
            cy.get("#maxAge").clear();
        });

        // Save & close
        cy.get("@editInstanceDialog")
            .contains("button", "Save")
            .click();

        cy.contains("h2", "Edit Event Instance").should("not.exist");

        // --- Series index 3: women only, age 80 and under ---
        // rowIndex 2 == third row, which has series_index = 3
        visitEventsAdmin();
        openInstancesPageForEvent(INSTANCE_EVENT_TITLE);

        openEditInstanceDialogForRowIndex(2);

        cy.contains("h2", "Edit Event Instance", { timeout: 15000 })
            .closest('[role="dialog"]')
            .as("editInstanceDialog");

        cy.get("@editInstanceDialog")
            .should("be.visible")
            .within(() => {
                cy.contains("h3", "Who is allowed to attend")
                    .parents("section")
                    .as("eligibilitySection");
            });

        cy.get("@eligibilitySection").within(() => {
            cy.get('button[role="switch"]').click();

            // Open gender select
            cy.contains("label", "Gender")
                .parent()
                .within(() => {
                    cy.get('[role="combobox"]').click();
                });
        });

        // Select "Women only" from the global portaled list
        cy.contains('[role="option"]', "Women only").click();

        // Age <= 80
        cy.get("@eligibilitySection").within(() => {
            cy.get("#minAge").clear();
            cy.get("#maxAge").clear().type("80");
        });

        // Save & close
        cy.get("@editInstanceDialog")
            .contains("button", "Save")
            .click();

        cy.contains("h2", "Edit Event Instance").should("not.exist");

        // --- Series index 4: age 14–20, price 20, member price 45 ---
        // rowIndex 3 == fourth row, which has series_index = 4
        visitEventsAdmin();
        openInstancesPageForEvent(INSTANCE_EVENT_TITLE);

        openEditInstanceDialogForRowIndex(3);

        cy.contains("h2", "Edit Event Instance", { timeout: 15000 })
            .closest('[role="dialog"]')
            .as("editInstanceDialog");


        cy.get("@editInstanceDialog").within(() => {
            // GROUP 6: age override (you already have this part)
            cy.contains("h3", "Who is allowed to attend")
                .parents("section")
                .within(() => {
                    cy.get('button[role="switch"]').click(); // group 6 override only
                    cy.get("#minAge").clear().type("14");
                    cy.get("#maxAge").clear().type("20");
                });

            // Group 5: RSVP / Registration / Pricing override
            cy.contains("h3", "RSVP / Registration / Pricing")
                .parent() // header row with the Override toggle
                .find('button[role="switch"]')
                .click();

            cy.contains("h3", "RSVP / Registration / Pricing")
                .parents("section")
                .within(() => {
                    cy.get("#price")
                        .clear()
                        .type("45")
                        .trigger("blur");        // commitPriceFromText

                    cy.get("#memberPrice")
                        .clear()
                        .type("20")
                        .trigger("blur");        // commitMemberPriceFromText

                    cy.contains("span", /paypal/i)
                        .closest("label")
                        .click();
                });


            cy.contains("button", "Save").click();
        });

        cy.contains("h2", "Edit Event Instance").should("not.exist");
    });

    /**
     * 3. User side: /events shows the different instance restrictions
     *    as EventListTile badges.
     */
    it("3. shows per-instance restrictions on the public event tiles", () => {
        visitUserEventsAsAdmin();

        // Sanity: our series appears at all
        cy.contains("h3", INSTANCE_EVENT_TITLE, { timeout: 30000 }).should(
            "exist",
        );

        // Instance 2: Members Only + Men Only + "12 Years Old and Over"
        cy.contains("span", "12 Years Old and Over", { timeout: 30000 })
            .closest("div.h-full.flex.flex-col")
            .within(() => {
                cy.contains("h3", INSTANCE_EVENT_TITLE).should("exist");
                cy.contains("span", "Members Only").should("exist");
                cy.contains("span", "Men Only").should("exist");
            });

        // Instance 3: Women Only + "80 Years Old and Under"
        cy.contains("span", "80 Years Old and Under", { timeout: 30000 })
            .closest("div.h-full.flex.flex-col")
            .within(() => {
                cy.contains("h3", INSTANCE_EVENT_TITLE).should("exist");
                cy.contains("span", "Women Only").should("exist");
            });

        // Instance 4: "14-20 Years Old" range badge
        cy.contains("span", "14-20 Years Old", { timeout: 30000 })
            .closest("div.h-full.flex.flex-col")
            .within(() => {
                cy.contains("h3", INSTANCE_EVENT_TITLE).should("exist");
            });
    });

    /**
     * 4. User side: filters on /events behave correctly with our instance overrides.
     *
     *    - First, filter to members-only + men-only: only the 12+ members-only
     *      instance should remain for our event.
     *    - Then switch filters to age 14–20: only the 14–20 instance should remain.
     */
    it("4. filters instances by gender, membership, and age", () => {
        // Start clean
        visitUserEventsAsAdmin();

        // --- Filter: Members-only + Men Only ---
        cy.contains("button", "Filters").click();

        // Gender admission: Men Only (value male_only)
        cy.get("#genderSel")
            .should("be.visible")
            .click();
        cy.get('[role="listbox"]')
            .contains("Men Only")
            .click();

        // Members-only events only
        cy.get("#membersOnlyOnlyChk").click();

        // Close filters popover via Escape (Radix Popover)
        cy.get("body").type("{esc}");

        // Now we expect to see the members-only men-only 12+ tile,
        // and not the 80-Under / 14–20 tiles for this series.
        cy.contains("span", "12 Years Old and Over", { timeout: 30000 })
            .closest("div.h-full.flex.flex-col")
            .within(() => {
                cy.contains("h3", INSTANCE_EVENT_TITLE).should("exist");
                cy.contains("span", "Members Only").should("exist");
                cy.contains("span", "Men Only").should("exist");
            });

        cy.contains("span", "80 Years Old and Under").should("not.exist");
        cy.contains("span", "14-20 Years Old").should("not.exist");

        // --- Filter: Age 14–20, no members-only restriction, gender = All ---
        // Reload /events to reset all filters cleanly
        visitUserEventsAsAdmin();

        cy.contains("button", "Filters").click();

        // Gender: All
        cy.get("#genderSel")
            .should("be.visible")
            .click();
        cy.get('[role="listbox"]').contains("All").click();

        // Make sure members-only-only is OFF (toggle if it happened to be on)
        cy.get("#membersOnlyOnlyChk").then(($el) => {
            // Radix Checkbox uses aria-checked; toggle only if checked
            const isChecked =
                $el.attr("aria-checked") === "true" ||
                $el.attr("data-state") === "checked";
            if (isChecked) {
                cy.wrap($el).click();
            }
        });

        // Age range 14–20
        cy.get("#minAge")
            .clear()
            .type("14");
        cy.get("#maxAge")
            .clear()
            .type("20");

        cy.get("body").type("{esc}");

        // Now we should see the 14–20 instance, and we should see 12+ and 80- because 14-20 year olds can attend both of these events
        cy.contains("span", "14-20 Years Old", { timeout: 30000 })
            .closest("div.h-full.flex.flex-col")
            .within(() => {
                cy.contains("h3", INSTANCE_EVENT_TITLE).should("exist");
            });

        cy.contains("span", "12 Years Old and Over").should("exist");
        cy.contains("span", "80 Years Old and Under").should("exist");
    });

    /**
     * 5. Admin side: delete the recurring event so the suite remains idempotent.
     */
    it("5. deletes the recurring event from admin", () => {
        deleteEventByTitle(INSTANCE_EVENT_TITLE);
    });
});

/**
 * Helper for this spec: delete a single event by title, including typing confirm.
 */
function deleteEventByTitle(title: string) {
    visitEventsAdmin();
    searchEventByTitle(title);

    // If the row doesn't exist, bail out quietly so after() doesn't explode
    cy.get("body").then(($body) => {
        const cell = $body
            .find('.ag-cell[col-id="title"]')
            .filter((_, el) => (el.textContent || "").trim() === title)
            .first();

        if (!cell.length) {
            return;
        }

        openDeleteDialogForEvent(title);

        cy.get("@deleteDialog")
            .should("be.visible")
            .within(() => {
                // DeleteEventDialogV2 expects "confirm" typed before Delete
                cy.get('input#deleteConfirm, input[placeholder*="confirm"]')
                    .should("be.visible")
                    .clear()
                    .type("confirm");

                cy.contains("button", "Delete").click();
            });

        cy.get("@deleteDialog").should("not.exist");

        // Verify the row is gone
        searchEventByTitle(title);
        getEventRowByTitle(title).should("not.exist");
    });
}
