export const MEDIA_LIBRARY_URL = "/admin/media-library";

export const visitMediaLibraryAsAdmin = () => {
    cy.adminlogin();
    cy.visit(MEDIA_LIBRARY_URL);
    cy.contains("Media Library", { timeout: 10000 }).should("be.visible");
};

export const uploadImageFixture = (filename: string) => {
    cy.get('input[type="file"][multiple][accept="image/*"]')
        .should("exist")
        .selectFile(`cypress/fixtures/media/${filename}`, { force: true });
};

export const getImageTileByFilename = (filename: string) => {
    return cy.contains("div", filename, { timeout: 15000 });
};

export const openDetailsDialogForFilename = (filename: string) => {
    getImageTileByFilename(filename).click();

    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.contains("Image details").should("be.visible");
        });
};

export const saveAndCloseDetailsDialog = () => {
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.contains("button", "Save").click();
        });

    cy.get('[role="dialog"]').should("not.exist");
};