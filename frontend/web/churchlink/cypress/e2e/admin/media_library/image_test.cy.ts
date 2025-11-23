const MEDIA_LIBRARY_URL = "/admin/media-library";

const ORIGINAL_NAME = "wolf";
const ORIGINAL_FILENAME = "wolf.jpg";
const RENAMED_NAME = "gray wolf";
const RENAMED_FILENAME = "gray wolf.jpg";
const DESCRIPTION_TEXT = "A gray wolf uploaded via Cypress.";

import { visitMediaLibraryAsAdmin, uploadImageFixture, getImageTileByFilename, openDetailsDialogForFilename, saveAndCloseDetailsDialog } from "./media_test_helpers"

describe("Media Library – wolf image flow", () => {
    /**
     * 1. Uploads wolf.jpg
     */
    it("1. uploads wolf.jpg", () => {
        visitMediaLibraryAsAdmin();

        uploadImageFixture(ORIGINAL_FILENAME);

        // Wait for the tile to appear
        getImageTileByFilename(ORIGINAL_FILENAME).should("be.visible");
    });

    /**
     * 2. Clicks wolf.jpg to open details, renames it to gray wolf, adds description, saves
     */
    it("2. opens wolf.jpg details, renames it, adds description, and saves", () => {
        visitMediaLibraryAsAdmin();

        // Ensure original tile exists
        getImageTileByFilename(ORIGINAL_FILENAME).should("be.visible");

        // Open details
        openDetailsDialogForFilename(ORIGINAL_FILENAME);

        // Change name + description
        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.get('input[placeholder="Image name"]')
                    .should("be.visible")
                    .clear()
                    .type(RENAMED_NAME);

                cy.get('textarea[placeholder="Optional description"]')
                    .should("be.visible")
                    .clear()
                    .type(DESCRIPTION_TEXT);
            });

        // Save & close
        saveAndCloseDetailsDialog();
    });

    /**
     * 3. Verifies the changes are made (tile shows gray wolf.jpg and details persist)
     */
    it("3. verifies gray wolf.jpg name and description", () => {
        visitMediaLibraryAsAdmin();

        // Tile should now show gray wolf.jpg
        getImageTileByFilename(RENAMED_FILENAME).should("be.visible");

        // Open details again and verify persisted values
        openDetailsDialogForFilename(RENAMED_FILENAME);

        cy.get('[role="dialog"]')
            .should("be.visible")
            .within(() => {
                cy.get('input[placeholder="Image name"]').should(($input) => {
                    const val = ($input.val() || "").toString();
                    expect(val).to.eq(RENAMED_NAME);
                });

                cy.get('textarea[placeholder="Optional description"]').should(($ta) => {
                    const val = ($ta.val() || "").toString();
                    expect(val).to.eq(DESCRIPTION_TEXT);
                });
            });

        // Close via Save again, not overlay
        saveAndCloseDetailsDialog();
    });

    /**
     * 4. Right clicks gray wolf and deletes it
     */
    it("4. deletes gray wolf.jpg via context menu", () => {
        visitMediaLibraryAsAdmin();

        // Ensure gray wolf is present
        getImageTileByFilename(RENAMED_FILENAME).should("be.visible");

        // Right-click the tile to open the context menu
        getImageTileByFilename(RENAMED_FILENAME).rightclick();

        // Context menu Delete Image
        cy.contains("button", "Delete Image").click();

        // Delete confirmation dialog (DeleteImageDialog)
        cy.contains("Delete image")
            .should("be.visible")
            .parent() // DialogHeader
            .parent() // DialogContent
            .within(() => {
                cy.contains("Are you sure you want to delete").should("be.visible");
                cy.contains("button", "Delete").click();
            });

        // Dialog closes
        cy.contains("Delete image").should("not.exist");

        // Confirm the tile is gone
        getImageTileByFilename(RENAMED_FILENAME).should("not.exist");
    });
});
