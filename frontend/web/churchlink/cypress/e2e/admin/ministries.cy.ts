const MINISTRY_NAME = "Cy1";
const MINISTRY_RENAMED = "Cy2";

/**
 * Visit ministries admin page (requires cy.adminlogin() custom command).
 */
const visitMinistriesAdmin = () => {
    cy.adminlogin();
    cy.visit("/admin/ministries");

    cy.contains("h1", "Ministries").should("be.visible");
};

/**
 * Filter ministries grid by exact name and wait for debounced search.
 * After waiting, assert that at least one row with that name is visible.
 */
const filterByMinistryName = (name: string) => {
    cy.get('input[placeholder="Search ministries..."]')
        .should("be.visible")
        .clear()
        .type(name);

    // Allow any debounced filtering logic to settle
    cy.wait(1000);

    cy.contains('.ag-cell[col-id="name"]', name, { timeout: 10000 }).should("be.visible");
};

/**
 * Click an action button (Rename/Delete) in the pinned-right Actions column
 * after filtering down to a single ministry name.
 *
 * This assumes the filter has already reduced the grid so that the first
 * actions row corresponds to the desired ministry.
 */
const clickFilteredActionButton = (ariaLabel: string) => {
    cy.get(".ag-pinned-right-cols-container")
        .should("be.visible")
        .within(() => {
            cy.get('button[aria-label="' + ariaLabel + '"]')
                .first()
                .click();
        });
};

/**
 * Open the "Create ministry" dialog.
 */
const openCreateMinistryDialog = () => {
    cy.contains("button", "Add ministry").click();

    cy.get('[role="dialog"]').should("be.visible").within(() => {
        cy.contains("Create ministry").should("be.visible");
        cy.get('input[placeholder="Ministry name"]').should("be.visible");
    });
};

/**
 * In the create dialog, type a name and click Create, then wait for dialog to close.
 * This helper is ONLY for the successful create case.
 */
const submitCreateMinistrySuccess = (name: string) => {
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.get('input[placeholder="Ministry name"]')
                .clear()
                .type(name);

            cy.contains("button", "Create").click();
        });

    // Successful create: dialog should close
    cy.get('[role="dialog"]').should("not.exist");
};

/**
 * In the create dialog, type a name and click Create for the error case.
 * On error, the dialog remains open; then we close it explicitly by clicking Cancel.
 */
const submitCreateMinistryExpectError = (name: string) => {
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.get('input[placeholder="Ministry name"]')
                .clear()
                .type(name);

            cy.contains("button", "Create").click();
        });

    // Dialog stays open after error; close it with Cancel (no overlay clicks)
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.contains("button", "Cancel").click();
        });

    cy.get('[role="dialog"]').should("not.exist");
};

/**
 * Assert that a "Success" alert is visible.
 */
const expectSuccessAlert = () => {
    cy.contains("Success").should("be.visible");
};

/**
 * Assert that an "Error" alert is visible (red status bar on main screen).
 */
const expectErrorAlert = () => {
    cy.contains("Error").should("be.visible");
};

describe("Admin Ministries CRUD sequence", () => {
    /**
     * 1. Create Ministry
     */
    it("1. creates a new ministry", () => {
        visitMinistriesAdmin();

        openCreateMinistryDialog();
        submitCreateMinistrySuccess(MINISTRY_NAME);

        expectSuccessAlert();

        // Quick sanity: filter for it to confirm it's present
        filterByMinistryName(MINISTRY_NAME);
    });

    /**
     * 2. Create Ministry with same name (expect error, no duplicate row)
     *    Error appears as a red alert on the main page, not inside the dialog.
     */
    it("2. rejects creating a duplicate ministry with the same name", () => {
        visitMinistriesAdmin();

        // Ensure the original exists via filter
        filterByMinistryName(MINISTRY_NAME);

        openCreateMinistryDialog();
        submitCreateMinistryExpectError(MINISTRY_NAME);

        // Error status alert (red) appears on the main screen
        expectErrorAlert();

        // Filter again to confirm we still have at least one row with that name
        filterByMinistryName(MINISTRY_NAME);
    });

    /**
     * 3. Edit Ministry Name
     */
    it("3. renames the ministry", () => {
        visitMinistriesAdmin();

        // Narrow the grid to just Cy1
        filterByMinistryName(MINISTRY_NAME);

        // Click Rename on the (now filtered) row
        clickFilteredActionButton("Rename Ministry");

        // Rename dialog
        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.contains("Rename ministry").should("be.visible");

                cy.get('input[placeholder="Ministry name"]')
                    .clear()
                    .type(MINISTRY_RENAMED);

                cy.contains("button", "Save changes").click();
            });

        // Dialog closes
        cy.get('[role="dialog"]').should("not.exist");

        expectSuccessAlert();

        // Now filter by the new name to confirm rename
        filterByMinistryName(MINISTRY_RENAMED);
    });

    /**
     * 4. Delete Ministry
     */
    it("4. deletes the ministry", () => {
        visitMinistriesAdmin();

        // Narrow the grid to just Cy2
        filterByMinistryName(MINISTRY_RENAMED);

        // Open delete confirmation dialog from the filtered row
        clickFilteredActionButton("Delete Ministry");

        // Confirm-delete dialog: anchor on its title text
        cy.contains("Delete ministry")
            .should("be.visible")
            .parent() // AlertDialogHeader
            .parent() // AlertDialogContent
            .within(() => {
                cy.contains('Are you sure you want to delete').should("be.visible");
                cy.contains("button", "Delete").click();
            });

        // Dialog closes (title disappears)
        cy.contains("Delete ministry").should("not.exist");

        expectSuccessAlert();

        // Filter by the name again and ensure it no longer appears
        cy.get('input[placeholder="Search ministries..."]')
            .clear()
            .type(MINISTRY_RENAMED);
        cy.wait(1000);
        cy.contains('.ag-cell[col-id="name"]', MINISTRY_RENAMED).should("not.exist");
    });
});
