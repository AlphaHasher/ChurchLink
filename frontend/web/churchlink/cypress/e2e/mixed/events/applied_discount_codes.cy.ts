import {
    // Discount admin
    visitDiscountCodesAdmin,
    openCreateDiscountDialog,
    fillDiscountCodeForm,
    // Events admin
    visitEventsAdmin,
    openCreateEventDialog,
    fillValidEventBasics,
    pickEventImage,
    saveEventDialog,
    // Shared helpers
    getEventDialog,
    searchEventByTitle,
    getEventRowByTitle,
    getEventRowIdByTitle,
    openDeleteDialogForEvent,
} from "./events_helpers";

const EVENT_TITLE = "Cypress Event";

const USER_EVENTS_URL = "/events";
const EVENT_PRICE = "20";

const APPLIED_DISCOUNT_CODE = "CODE123";
const DISCOUNT_NAME = "Cypress Discount";
const DISCOUNT_DESCRIPTION = "A cypress-created discount.";
const DISCOUNT_AMOUNT = "5";
const DISCOUNT_MAX_USES = "10";

/**
 * Configure the event as a paid event with a given unit price
 * and at least one payment option (PayPal) enabled.
 */
const configurePaidEvent = (price: string) => {
    getEventDialog().within(() => {
        cy.contains("Registration").scrollIntoView();

        // Turn RSVP required ON (if it isn't already)
        cy.get('button[role="switch"][aria-label="RSVP required"]')
            .should("exist")
            .then(($btn) => {
                const ariaChecked = $btn.attr("aria-checked");
                if (ariaChecked !== "true") {
                    cy.wrap($btn).click();
                }
            });

        // Set a non-zero price
        cy.get('input[placeholder="0.00"]')
            .should("be.visible")
            .clear()
            .type(price);

        // Click a neutral label to blur the field
        cy.contains("label", "Location Address").click();

        // Ensure at least one payment option is selected (PayPal)
        cy.contains("span", /paypal/i)
            .closest("label")
            .find('[role="checkbox"]')
            .then(($chk) => {
                const ariaChecked = $chk.attr("aria-checked");
                if (ariaChecked !== "true") {
                    cy.wrap($chk).click();
                }
            });
    });
};

const deleteEventByTitle = (title: string) => {
    // Opens the dialog and aliases it as "@deleteDialog"
    openDeleteDialogForEvent(title);

    cy.get("@deleteDialog").within(() => {
        // Delete button should start disabled until we type "Confirm"
        cy.contains("button", "Delete").should("be.disabled");

        // Type the required confirm text (case-insensitive, placeholder is "Confirm")
        cy.get("#deleteConfirm")
            .should("be.visible")
            .clear()
            .type("Confirm");

        // Now Delete should be enabled
        cy.contains("button", "Delete")
            .should("not.be.disabled")
            .click();
    });

    // Dialog goes away
    cy.contains("Delete Event").should("not.exist");

    // Verify the event row is gone from the grid
    searchEventByTitle(title);
    cy.contains(
        '.ag-center-cols-container .ag-cell[col-id="default_title"]',
        title,
    ).should("not.exist");
};

/**
 * Open the Assign Discount Codes dialog for the given event row.
 */
const openAssignDiscountCodesDialogForEvent = (title: string) => {
    searchEventByTitle(title);

    getEventRowIdByTitle(title).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error(
                "Could not determine row-id for event row when assigning discount codes: " +
                title,
            );
        }

        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get(
                    'button[aria-label="Assign discount codes"][title="Assign discount codes"]',
                ).click();
            });
    });

    cy.contains("h2", "Assign Discount Codes", { timeout: 15000 }).should(
        "be.visible",
    );
};

/**
 * In an open Assign Discount Codes dialog, select our discount
 * and save the association.
 */
const assignDiscountCodeToEvent = (code: string) => {
    // Open the dropdown
    cy.contains("button", "Select discount codes").click();

    // Choose the code (displayed as "CODE: <code>" when both name & code exist)
    cy.contains('[role="menuitemcheckbox"]', `CODE: ${code}`).click();

    // Save
    cy.contains("button", "Save").should("not.be.disabled").click();

    // Dialog closes
    cy.contains("Assign Discount Codes").should("not.exist");
};

/**
 * Simple helper to search the discount codes grid.
 */
const getDiscountSearchInput = () =>
    cy
        .get('input[placeholder="Search by code, name, or ID…"]')
        .should("be.visible");

const searchDiscount = (term: string) => {
    getDiscountSearchInput().clear().type(term);
    cy.wait(500);
};

/**
 * Get the AG-Grid row-id for a discount by its code.
 */
const getDiscountRowIdByCode = (code: string) => {
    return cy
        .contains(
            '.ag-center-cols-container .ag-cell[col-id="code"]',
            code,
            { timeout: 15000 },
        )
        .closest(".ag-row")
        .invoke("attr", "row-id");
};

/**
 * Save discount dialog and wait for it to close.
 */
const saveDiscountDialog = () => {
    cy.contains("button", "Save", { timeout: 15000 }).click();

    // Dialog closes for both "New" and "Edit" flows
    cy.contains("New Discount Code").should("not.exist");
    cy.contains("Edit Discount Code").should("not.exist");
};

/**
 * Open the "events using this code" dialog for a given discount code.
 */
const openEventsUsingCodeDialog = (code: string) => {
    searchDiscount(code);

    getDiscountRowIdByCode(code).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error("Could not determine row-id for discount code: " + code);
        }

        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[title="View events using this code"]').click();
            });
    });

    cy.contains("h2", "Events Using", { timeout: 15000 }).should("be.visible");
};

/**
 * Open Delete Discount Code dialog for a given code, then delete it.
 */
const deleteDiscountCode = (code: string) => {
    searchDiscount(code);

    getDiscountRowIdByCode(code).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            // If we can't find it, treat as already deleted
            return;
        }

        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[title="Delete discount code"]').click();
            });
    });

    cy.contains("h2", "Delete Discount Code", { timeout: 15000 }).should(
        "be.visible",
    );

    cy.contains("label", "Type")
        .parent()
        .find("input#deleteConfirm")
        .clear()
        .type(code);

    cy.contains("button", "Delete")
        .should("not.be.disabled")
        .click();

    cy.contains("Delete Discount Code").should("not.exist");

    searchDiscount(code);
    cy.contains(
        '.ag-center-cols-container .ag-cell[col-id="code"]',
        code,
    ).should("not.exist");
};

/**
 * On the /events page, find the card for a given event title
 * and return a chainable subject scoped to that card.
 */
const getUserEventCard = (title: string) => {
    return cy
        .contains(title, { timeout: 30000 })
        .parents()
        .filter("div.h-full.flex.flex-col")
        .first();
};

/**
 * Open the registration payment modal for the given event title from /events.
 * Uses a forced click on the Register button to avoid Cypress being picky
 * about visibility in that dialog.
 */
const openRegistrationForEventFromUserSide = (title: string) => {
    cy.adminlogin();
    cy.visit(USER_EVENTS_URL);

    // Locate the event card and open Show Details
    getUserEventCard(title).within(() => {
        cy.contains("button", "Show Details").click();
    });

    // Details dialog opens
    cy.contains('[role="dialog"]', title, { timeout: 20000 })
        .should("be.visible")
        .as("detailsDialog");

    // Inside the details dialog, click the primary "Register" button.
    // Use a forced click here because Cypress is sometimes unhappy about
    // the visibility of this button even though it's interactable in the UI.
    cy.get("@detailsDialog")
        .contains("button", /Register|View Registration/)
        .click({ force: true });

    // The registration payment modal is a nested dialog that contains "Summary"
    cy.contains("div", "Summary", { timeout: 25000 })
        .closest('[role="dialog"]')
        .as("paymentDialog");
};

// -----------------------------------------------------------------------------
// Main E2E test (chunked into a checklist of its own steps)
// -----------------------------------------------------------------------------

describe("E2E – Applying discount codes during event registration", () => {
    /**
     * Global setup: create helper ministries & images.
     */
    before(() => {
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

    it("admin creates a valid paid event", () => {
        visitEventsAdmin();
        openCreateEventDialog();

        fillValidEventBasics(EVENT_TITLE);
        pickEventImage("wolf.jpg");
        configurePaidEvent(EVENT_PRICE);
        saveEventDialog();

        // Ensure the event appears in the admin grid
        getEventRowByTitle(EVENT_TITLE).should("be.visible");
    });

    it("admin creates a valid discount code", () => {
        visitDiscountCodesAdmin();
        openCreateDiscountDialog();

        fillDiscountCodeForm({
            code: APPLIED_DISCOUNT_CODE,
            name: DISCOUNT_NAME,
            description: DISCOUNT_DESCRIPTION,
            discount: DISCOUNT_AMOUNT,
            maxUses: DISCOUNT_MAX_USES,
        });

        saveDiscountDialog();

        // Verify discount appears in the grid
        searchDiscount(APPLIED_DISCOUNT_CODE);
        cy.contains(
            '.ag-center-cols-container .ag-cell[col-id="code"]',
            APPLIED_DISCOUNT_CODE,
        ).should("be.visible");
    });

    it("admin assigns the discount code to the event", () => {
        visitEventsAdmin();
        openAssignDiscountCodesDialogForEvent(EVENT_TITLE);
        assignDiscountCodeToEvent(APPLIED_DISCOUNT_CODE);
    });

    it("discount code page shows the event under 'events using this code'", () => {
        visitDiscountCodesAdmin();
        openEventsUsingCodeDialog(APPLIED_DISCOUNT_CODE);

        cy.contains(
            '.ag-center-cols-container .ag-cell[col-id="default_title"]',
            EVENT_TITLE,
        ).should("be.visible");

        cy.contains("button", "Close").click();
        cy.contains("Events Using").should("not.exist");
    });

    it("user can apply the discount on /events and see the unit price drop", () => {
        openRegistrationForEventFromUserSide(EVENT_TITLE);

        // Apply the discount code
        cy.get("@paymentDialog")
            .find('input[placeholder="Enter discount code"]').scrollIntoView()
            .should("be.visible")
            .clear()
            .type(APPLIED_DISCOUNT_CODE);

        cy.get("@paymentDialog")
            .contains("button", "Apply Discount Code")
            .should("not.be.disabled")
            .click();

        // Wait for "Checking…" to go away (discount validation roundtrip)
        cy.get("@paymentDialog")
            .contains(/Checking/i)
            .should("not.exist");

        // Badge expectations
        const DISCOUNT_BADGE_LABEL = `$${Number(DISCOUNT_AMOUNT).toFixed(2)} off`;

        cy.get("@paymentDialog")
            .contains("Discount Codes")
            .should("be.visible");

        cy.get("@paymentDialog")
            .contains(DISCOUNT_BADGE_LABEL)
            .should("be.visible");

        cy.get("@paymentDialog")
            .contains(new RegExp(`${DISCOUNT_MAX_USES}\\s+uses? left`))
            .should("be.visible");

        // Capture Unit Price AFTER discount and assert it dropped
        cy.get("@paymentDialog")
            .contains("span", "Unit Price")
            .parent()
            .find("span.font-medium")
            .invoke("text")
            .as("unitPriceAfter");

        cy.get<string>("@unitPriceAfter").then((afterText) => {
            const after = parseFloat(afterText.replace(/[^0-9.]/g, ""));

            expect(after, "discounted unit price").to.be.lessThan(parseFloat(EVENT_PRICE));
        });
        cy.get("@paymentDialog")
            .contains("button", "Back")
            .should("be.visible")
            .click();
        cy.get("@paymentDialog").should("not.exist");

        // Close the details dialog as well
        cy.get("@detailsDialog")
            .contains("button", "Close")
            .click();
        cy.get("@detailsDialog").should("not.exist");
    });

    it("admin cleans up the created event and discount code", () => {
        visitEventsAdmin();
        deleteEventByTitle(EVENT_TITLE);

        visitDiscountCodesAdmin();
        deleteDiscountCode(APPLIED_DISCOUNT_CODE);
    });
});
