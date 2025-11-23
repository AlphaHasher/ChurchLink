const FOLDER_ONE = "Folder 1";
const FOLDER_TWO = "Folder 2";
const FOLDER_TWO_RENAMED = "Folder-ception";

const IMAGE_GOAT = "goat.png";
const IMAGE_MANTIS = "mantis.webp";
const IMAGE_OCTOPUS = "octopus.avif";
const IMAGE_ORANGUTAN = "orangutan.jpg";
const IMAGE_WOLF = "wolf.jpg";

import { visitMediaLibraryAsAdmin, uploadImageFixture, getImageTileByFilename } from "./media_test_helpers"


const getFolderTile = (folderName: string) => {
    return cy.get(`div[title="${folderName}"]`, { timeout: 15000 });
};

const dragImageToFolder = (filename: string, folderName: string) => {
    cy.window().then((win) => {
        const dataTransfer = new win.DataTransfer();

        getImageTileByFilename(filename).trigger("dragstart", { dataTransfer });

        getFolderTile(folderName)
            .trigger("dragover", { dataTransfer })
            .trigger("drop", { dataTransfer });
    });
};

const dragFolderToFolder = (sourceFolder: string, targetFolder: string) => {
    cy.window().then((win) => {
        const dataTransfer = new win.DataTransfer();

        getFolderTile(sourceFolder).trigger("dragstart", { dataTransfer });

        getFolderTile(targetFolder)
            .trigger("dragover", { dataTransfer })
            .trigger("drop", { dataTransfer });
    });
};

const dragImageToTopDrop = (filename: string) => {
    cy.window().then((win) => {
        const dataTransfer = new win.DataTransfer();

        getImageTileByFilename(filename).trigger("dragstart", { dataTransfer });

        cy.contains("div", "Drop here to move up a level")
            .should("be.visible")
            .trigger("dragover", { dataTransfer })
            .trigger("drop", { dataTransfer });
    });
};

describe("Media Library / Folder flow", () => {
    /**
     * 1. Create Folder 1 and Folder 2
     */
    it("1. creates Folder 1 and Folder 2", () => {
        visitMediaLibraryAsAdmin();

        // Create Folder 1
        cy.contains("button", "New Folder").click();
        cy.get('[role="dialog"]').within(() => {
            cy.contains("Create a new folder").should("be.visible");
            cy.get('input[placeholder="Folder name"]').clear().type(FOLDER_ONE);
            cy.contains("button", "Create").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
        getFolderTile(FOLDER_ONE).should("be.visible");

        // Create Folder 2
        cy.contains("button", "New Folder").click();
        cy.get('[role="dialog"]').within(() => {
            cy.contains("Create a new folder").should("be.visible");
            cy.get('input[placeholder="Folder name"]').clear().type(FOLDER_TWO);
            cy.contains("button", "Create").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
        getFolderTile(FOLDER_TWO).should("be.visible");
    });

    /**
     * 2. Upload goat/mantis/octopus and move them into Folder 1
     */
    it("2. uploads three images and moves them into Folder 1", () => {
        visitMediaLibraryAsAdmin();

        getFolderTile(FOLDER_ONE).should("be.visible");
        getFolderTile(FOLDER_TWO).should("be.visible");

        // Upload images at root
        uploadImageFixture(IMAGE_GOAT);
        uploadImageFixture(IMAGE_MANTIS);
        uploadImageFixture(IMAGE_OCTOPUS);

        getImageTileByFilename(IMAGE_GOAT).should("be.visible");
        getImageTileByFilename(IMAGE_MANTIS).should("be.visible");
        getImageTileByFilename(IMAGE_OCTOPUS).should("be.visible");

        // Move each into Folder 1 via drag & drop
        dragImageToFolder(IMAGE_GOAT, FOLDER_ONE);
        dragImageToFolder(IMAGE_MANTIS, FOLDER_ONE);
        dragImageToFolder(IMAGE_OCTOPUS, FOLDER_ONE);

        // Open Folder 1 and verify contents
        getFolderTile(FOLDER_ONE).click();
        getImageTileByFilename(IMAGE_GOAT).should("be.visible");
        getImageTileByFilename(IMAGE_MANTIS).should("be.visible");
        getImageTileByFilename(IMAGE_OCTOPUS).should("be.visible");

        // Go back home so the next test starts from root if needed
        cy.contains("button", "Home").click();
    });

    /**
     * 3. Upload orangutan/wolf into Folder 2, rename it, and drag it into Folder 1
     */
    it("3. uploads into Folder 2, renames it to Folder-ception, and nests it into Folder 1", () => {
        visitMediaLibraryAsAdmin();

        // Go into Folder 2
        getFolderTile(FOLDER_TWO).click();

        // Upload orangutan & wolf into Folder 2
        uploadImageFixture(IMAGE_ORANGUTAN);
        uploadImageFixture(IMAGE_WOLF);

        getImageTileByFilename(IMAGE_ORANGUTAN).should("be.visible");
        getImageTileByFilename(IMAGE_WOLF).should("be.visible");

        // Back to Home
        cy.contains("button", "Home").click();

        // Right-click Folder 2 -> Rename -> Folder-ception
        getFolderTile(FOLDER_TWO).rightclick();
        cy.contains("button", "Rename").click();

        cy.get('[role="dialog"]').within(() => {
            cy.contains("Rename folder").should("be.visible");
            cy.get("input").clear().type(FOLDER_TWO_RENAMED);
            cy.contains("button", "Rename").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
        getFolderTile(FOLDER_TWO_RENAMED).should("be.visible");

        // Drag Folder-ception into Folder 1
        dragFolderToFolder(FOLDER_TWO_RENAMED, FOLDER_ONE);

        // Open Folder 1 and verify Folder-ception is inside
        getFolderTile(FOLDER_ONE).click();
        getFolderTile(FOLDER_TWO_RENAMED).should("be.visible");
    });

    /**
     * 4. Drag orangutan back to Home, delete it, then delete Folder 1 (with contents) and verify empty
     */
    it("4. moves orangutan back home, deletes it, and removes Folder 1 with all contents", () => {
        visitMediaLibraryAsAdmin();

        // Open Folder 1 then Folder-ception
        getFolderTile(FOLDER_ONE).click();
        getFolderTile(FOLDER_TWO_RENAMED).click();

        // Move orangutan up one level using the top drop strip (into Folder 1)
        getImageTileByFilename(IMAGE_ORANGUTAN).should("be.visible");
        dragImageToTopDrop(IMAGE_ORANGUTAN);
        getImageTileByFilename(IMAGE_ORANGUTAN).should("not.exist");

        // Go to Folder 1 via breadcrumb and then move orangutan back to Home using the same strip
        cy.contains("button", FOLDER_ONE).click();
        getImageTileByFilename(IMAGE_ORANGUTAN).should("be.visible");
        dragImageToTopDrop(IMAGE_ORANGUTAN);
        getImageTileByFilename(IMAGE_ORANGUTAN).should("not.exist");

        // Go Home and delete orangutan.jpg via image context menu
        cy.contains("button", "Home").click();
        getImageTileByFilename(IMAGE_ORANGUTAN).should("be.visible").rightclick();
        cy.contains("button", "Delete Image").click();

        cy.contains("Delete image")
            .should("be.visible")
            .parent()
            .parent()
            .within(() => {
                cy.contains("Are you sure you want to delete").should("be.visible");
                cy.contains("button", "Delete").click();
            });
        cy.contains("Delete image").should("not.exist");
        getImageTileByFilename(IMAGE_ORANGUTAN).should("not.exist");

        // Right-click Folder 1 -> Delete… -> Delete everything inside this folder
        getFolderTile(FOLDER_ONE).rightclick();
        cy.contains("button", "Delete…").click();

        cy.contains("Delete “Folder 1”")
            .should("be.visible")
            .parent()
            .parent()
            .within(() => {
                cy.contains("Delete everything inside this folder").click();
                cy.contains("button", "Delete").click();
            });
        cy.contains("Delete folder").should("not.exist");

        // Verify everything is gone using the "No items" empty-state text
        cy.contains("h3", "No items", { timeout: 15000 }).should("be.visible");
    });
});
