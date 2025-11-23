/**
 * Filter discount codes grid by name and assert at least one row is visible.
 */
export const filterByDiscountName = (name: string) => {
    getSearchInput().clear().type(name);

    cy.contains(
        '.ag-center-cols-container .ag-cell[col-id="name"]',
        name,
        { timeout: 15000 },
    ).should("be.visible");
};

/**
 * After searching, find the row-id for the discount whose Name column
 * matches the given name.
 */
export const getDiscountRowIdByName = (name: string) => {
    return cy
        .contains(
            '.ag-center-cols-container .ag-cell[col-id="name"]',
            name,
            { timeout: 15000 },
        )
        .closest(".ag-row")
        .invoke("attr", "row-id");
};

/**
 * Click the Edit button in the pinned-right Actions column
 * for the row with the given discount name, then wait for the Edit dialog.
 */
export const openEditDialogForDiscount = (name: string) => {
    getDiscountRowIdByName(name).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error("Could not determine row-id for discount row: " + name);
        }

        // Use the pinned-right container for the Actions column
        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[title="Edit"]').click();
            });
    });

    cy.contains("h2", "Edit Discount Code", { timeout: 10000 }).should(
        "be.visible",
    );
};

/**
 * Open the Delete Discount Code dialog for the discount with the given name.
 * Uses the center row to find row-id, then clicks the Delete button
 * in the pinned-right Actions column.
 */
export const openDeleteDialogForDiscount = (name: string) => {
    getDiscountRowIdByName(name).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error("Could not determine row-id for discount row: " + name);
        }

        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[title="Delete discount code"]').click();
            });
    });

    cy.contains("h2", "Delete Discount Code", { timeout: 10000 }).should(
        "be.visible",
    );
};

/**
 * Return the AG-Grid row that contains the given discount name.
 */
export const getDiscountRowByName = (name: string) => {
    return cy
        .contains(".ag-center-cols-container .ag-row", name, {
            timeout: 15000,
        })
        .closest(".ag-row");
};

/**
 * Open the "Create Discount Code" dialog.
 */
export const openCreateDiscountDialog = () => {
    cy.contains("button", "Create Discount Code", { timeout: 10000 }).click();

    cy.contains("h2", "New Discount Code", { timeout: 10000 }).should(
        "be.visible",
    );
};

/**
 * Fill out the discount code form inside the create/edit dialog.
 * Assumes the dialog is already open and visible.
 */
export const fillDiscountCodeForm = (
    {
        code,
        name,
        description,
        discount,
        maxUses,
    }: {
        code?: string;
        name?: string;
        description?: string;
        discount?: string;
        maxUses?: string;
    },
) => {
    // Code
    if (code !== undefined) {
        cy.contains("label", "Code")
            .parent()
            .find("input")
            .clear()
            .type(code);
    }

    // Name
    if (name !== undefined) {
        cy.contains("label", "Name")
            .parent()
            .find("input")
            .clear()
            .type(name);
    }

    // Description
    if (description !== undefined) {
        cy.contains("label", "Description (optional)")
            .parent()
            .find("textarea")
            .clear()
            .type(description);
    }

    // Discount amount (raw amount / percentage label is dynamic, but the input is under that label)
    if (discount !== undefined) {
        cy.contains("label", "Fixed Amount (USD, > 0)")
            .parent()
            .find("input")
            .clear()
            .type(discount);
    }

    // Max Uses
    if (maxUses !== undefined) {
        cy.contains("label", "Max Uses (optional and per-account)")
            .parent()
            .find("input")
            .clear()
            .type(maxUses);
    }
};

/**
 * Get handle to the search input in the discount codes toolbar.
 */
export const getSearchInput = () => {
    return cy
        .contains("label", "Search", { timeout: 10000 })
        .parent()
        .find("input");
};

/**
 * Navigate to Discount Codes admin as an authenticated admin.
 */
export const visitDiscountCodesAdmin = () => {
    cy.adminlogin();
    cy.visit(DISCOUNT_CODES_URL);

    cy.contains("h1", "Discount Codes", { timeout: 15000 }).should("be.visible");
};

export const DISCOUNT_CODES_URL = "/admin/events/discount-codes";
export const ADMIN_EVENTS_URL = "/admin/events";

/**
 * Navigate to Events admin as an authenticated admin.
 */
export const visitEventsAdmin = () => {
    cy.adminlogin();
    cy.visit(ADMIN_EVENTS_URL);

    cy.contains("Events", { timeout: 10000 }).should("be.visible");
};

/**
 * Search the events grid by title and wait for the debounce + fetch.
 */
export const searchEventByTitle = (title: string) => {
    cy.get('input[placeholder="Search events…"]')
        .should("be.visible")
        .clear()
        .type(title);

    cy.wait(1000); // debounce
};

/**
 * Get the main Create/Edit Event dialog.
 */
export const getEventDialog = () => {
    return cy
        .contains('[role="dialog"]', "Localized Text")
        .should("be.visible");
};

/**
 * Get the AG-Grid row that contains the given event title.
 */
export const getEventRowByTitle = (title: string) => {
    searchEventByTitle(title);
    return cy
        .contains(".ag-center-cols-container .ag-row", title, { timeout: 10000 })
        .closest(".ag-row");
};

/**
 * Open the Create Event dialog.
 */
export const openCreateEventDialog = () => {
    cy.contains("button", "Create Event", { timeout: 10000 }).click();
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.contains("New Event").should("be.visible");
        });
};

/**
 * Set the Event date to a clearly-future day using the Date & Recurrence calendar.
 * Strategy:
 *  - Open the Event date popover
 *  - Click "next month" once via .rdp-button_next
 *  - Click day 1 for the *current* (in-view) month, excluding outside days
 */
export const setEventDateToFuture = () => {
    // Open the calendar popover from the main event dialog
    getEventDialog().within(() => {
        cy.contains("label", "Event date")
            .scrollIntoView()
            .parent()
            .within(() => {
                cy.get("button").first().click();
            });
    });

    // We're now in the DayPicker popover (outside the main dialog).
    // Step 1 month forward. Do NOT chain the clicks – requery after changes.
    cy.get(".rdp-button_next").first().click();

    // Now pick day "1" that is NOT an outside day (so it's from the visible month).
    cy.get(".rdp-day:not(.rdp-day_outside) button")
        .contains(/^1$/)
        .click();
};


/**
 * Fill the minimal “good” event payload in Create/Edit dialog.
 * Makes title, description, location, ministries and date all valid so that
 * payment validation is the first thing to fail later.
 */
export const fillValidEventBasics = (title: string) => {
    // Everything that physically lives inside the main event dialog
    getEventDialog().within(() => {
        // Localized title (en)
        cy.get('input#title')
            .should('be.visible')
            .clear()
            .type(title);

        // Required description
        cy.get('textarea#description')
            .should('be.visible')
            .clear()
            .type('This is a Cypress test event description used for validation.');

        // Location address
        cy.get('#locAddr')
            .should('be.visible')
            .clear()
            .type('Civic Auditorium, 123 Main St, Springfield, IL 62701');

        // Open ministries popover (popover content is PORTALED, so we do not
        // try to find Cy Ministry 1 within this .within() scope)
        cy.contains('button', 'Choose ministries').click();
    });

    // Ministries popover is rendered as a Radix portal; select Cy Ministry 1
    cy.contains('div', 'Cy Ministry 1').click();

    // Click back inside the main dialog on a neutral element to close the popover
    getEventDialog().within(() => {
        cy.contains('label', 'Location Address').click();
    });

    // Ensure event date is in the future so date validation passes
    setEventDateToFuture();
};

/**
 * In an open dialog, select an event image using the EventImageSelector.
 * Assumes createTestImages() has already uploaded these images.
 */
export const pickEventImage = (filename: string) => {
    getEventDialog().within(() => {
        cy.contains("button", "Select image…").click();
    });

    cy.contains("Select or Upload Event Image", { timeout: 15000 })
        .should("be.visible")
        .parent()
        .parent()
        .within(() => {
            cy.contains("div", filename, { timeout: 15000 }).click();
        });

    getEventDialog().within(() => {
        // Scroll the Event Image section into view so Cypress is happy
        cy.contains("Event Image")
            .scrollIntoView()
            .should("exist"); // existence is enough; visibility is implied by scroll
    });
};

/**
 * Click Save in whichever dialog is open and wait for it to close.
 */
export const saveEventDialog = () => {
    cy.get('[role="dialog"]')
        .should("be.visible")
        .within(() => {
            cy.contains("button", "Save").click();
        });

    cy.get('[role="dialog"]').should("not.exist");
};

/**
 * After searching, find the row-id for the event whose Title column
 * (default_title) matches the given title.
 */
export const getEventRowIdByTitle = (title: string) => {
    return cy
        .contains(
            '.ag-center-cols-container .ag-cell[col-id="default_title"]',
            title,
            { timeout: 10000 },
        )
        .closest(".ag-row")
        .invoke("attr", "row-id");
};

/**
 * Click the Edit Event button in the pinned-right Actions column
 * for the row with the given title, then wait for the Edit dialog.
 */
export const openEditDialogForEvent = (title: string) => {
    // Use your existing debounced search helper first
    searchEventByTitle(title);

    getEventRowIdByTitle(title).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error("Could not determine row-id for event row: " + title);
        }

        // Now use the same row-id within the pinned-right container
        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[aria-label="Edit Event"][title="Edit Event"]').click();
            });
    });

    // Wait for the main Edit dialog to be open
    getEventDialog().within(() => {
        cy.contains("Edit Event").should("be.visible");
    });
};

/**
 * Open the Delete Event dialog for the event with the given title.
 * Uses the center row to find row-id, then clicks the Delete button
 * in the pinned-right Actions column.
 */
export const openDeleteDialogForEvent = (title: string) => {
    // Narrow grid to the event we care about
    searchEventByTitle(title);

    getEventRowIdByTitle(title).then((rowId) => {
        const id = (rowId || "").toString();
        if (!id) {
            throw new Error("Could not determine row-id for event row: " + title);
        }

        cy.get(`.ag-pinned-right-cols-container .ag-row[row-id="${id}"]`)
            .should("exist")
            .within(() => {
                cy.get('button[title="Delete"]').click();
            });
    });

    // Wait for the Delete Event dialog to appear
    cy.contains("Delete Event")
        .should("be.visible")
        .parent() // DialogHeader
        .parent() // DialogContent
        .as("deleteDialog");
};