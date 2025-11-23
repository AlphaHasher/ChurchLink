import { getSearchInput, openCreateDiscountDialog, openDeleteDialogForDiscount, openEditDialogForDiscount, fillDiscountCodeForm, filterByDiscountName, getDiscountRowByName, visitDiscountCodesAdmin } from "cypress/e2e/mixed/events/events_helpers";

// Use a timestamp suffix so repeated runs don't collide with old data
const SUFFIX = Date.now();

const DISCOUNT_CODE = `CYPRESS`;
const DISCOUNT_NAME = `Cypress Discount ${SUFFIX}`;
const DISCOUNT_NAME_UPDATED = `Cypress Discount ${SUFFIX} – updated`;

const DISCOUNT_DESCRIPTION = "Discount code created via Cypress.";
const DISCOUNT_DESCRIPTION_UPDATED = "Discount code edited via Cypress.";
const DISCOUNT_AMOUNT = "10.5"; // raw dollar amount
const DISCOUNT_MAX_USES = "5";

/**
 * Click "Save" in the currently open discount code dialog
 * and wait for it to close.
 */
const saveAndCloseDialog = () => {
    cy.contains("button", "Save", { timeout: 10000 }).click();

    // Dialog title should disappear for both Create and Edit flows
    cy.contains("New Discount Code").should("not.exist");
    cy.contains("Edit Discount Code").should("not.exist");
};

describe("Admin Discount Codes CRUD sequence", () => {
    /**
     * 1. Create discount code
     */
    it("1. creates a new discount code", () => {
        visitDiscountCodesAdmin();

        openCreateDiscountDialog();

        fillDiscountCodeForm({
            code: DISCOUNT_CODE,
            name: DISCOUNT_NAME,
            description: DISCOUNT_DESCRIPTION,
            discount: DISCOUNT_AMOUNT,
            maxUses: DISCOUNT_MAX_USES,
        });

        saveAndCloseDialog();

        // Filter by name and confirm it shows up in the grid
        filterByDiscountName(DISCOUNT_NAME);

        getDiscountRowByName(DISCOUNT_NAME)
            .find('.ag-cell[col-id="name"]')
            .should("contain.text", DISCOUNT_NAME);
    });

    /**
     * 2. Edit discount code
     */
    it("2. edits the existing discount code", () => {
        visitDiscountCodesAdmin();

        // Make sure the row is present
        filterByDiscountName(DISCOUNT_NAME);

        // Open the edit dialog via the pinned-right Actions column
        openEditDialogForDiscount(DISCOUNT_NAME);

        cy.contains("h2", "Edit Discount Code", { timeout: 10000 }).should(
            "be.visible",
        );

        fillDiscountCodeForm({
            name: DISCOUNT_NAME_UPDATED,
            description: DISCOUNT_DESCRIPTION_UPDATED,
            // Keep discount / code the same here to avoid backend validation surprises
        });

        saveAndCloseDialog();

        // The updated name should now be visible
        filterByDiscountName(DISCOUNT_NAME_UPDATED);

        getDiscountRowByName(DISCOUNT_NAME_UPDATED)
            .find('.ag-cell[col-id="name"]')
            .should("contain.text", DISCOUNT_NAME_UPDATED);
    });

    /**
     * 3. Delete discount code
     */
    it("3. deletes the discount code", () => {
        visitDiscountCodesAdmin();

        // Ensure the updated row is present
        filterByDiscountName(DISCOUNT_NAME_UPDATED);

        // Open the delete dialog via the pinned-right Actions column
        openDeleteDialogForDiscount(DISCOUNT_NAME_UPDATED);

        cy.contains("h2", "Delete Discount Code", { timeout: 10000 }).should(
            "be.visible",
        );

        // Initially, the Delete button should be disabled until we type the code
        cy.contains("button", "Delete").should("be.disabled");

        // The confirm input uses the server-normalized code as the placeholder.
        // Read that placeholder and type it back in so we always match whatever the
        // backend stored (since the server normalizes codes). :contentReference[oaicite:1]{index=1}
        cy.get("#deleteConfirm")
            .invoke("attr", "placeholder")
            .then((placeholder) => {
                const codeToConfirm = placeholder || "";
                cy.get("#deleteConfirm").type(codeToConfirm);
            });

        cy.contains("button", "Delete").should("not.be.disabled").click();

        // Dialog closes
        cy.contains("Delete Discount Code").should("not.exist");

        // Filter by the updated name and assert it no longer appears
        getSearchInput().clear().type(DISCOUNT_NAME_UPDATED);

        cy.contains(
            '.ag-center-cols-container .ag-cell[col-id="name"]',
            DISCOUNT_NAME_UPDATED,
        ).should("not.exist");
    });
});
