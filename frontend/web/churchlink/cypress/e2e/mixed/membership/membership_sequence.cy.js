// cypress/e2e/membership/membership_flow.cy.ts
var MEMBERSHIP_USER_URL = "/profile/membership";
var MEMBERSHIP_ADMIN_URL = "/admin/users/membership-requests";
// This should match the normal (non-admin) user's email the tests log in as.
var MEMBER_EMAIL = "noadmin@testing.com";
var MEMBERSHIP_CARD_BUTTON_LABELS = [
    "Request Membership",
    "Re-Submit Request",
    "Read Request",
];
var REQUEST_SUBMIT_LABELS = [
    "Submit Request",
    "Re-Submit Request",
];
var DENIED_MESSAGE_SNIPPET = /Your previous membership request was denied/i;
var MUTED_MESSAGE_SNIPPET = /You have been prohibited from making future membership requests/i;
/**
 * Helper: visit the membership card as the regular user.
 */
var visitMembershipCardAsUser = function () {
    cy.login();
    cy.visit(MEMBERSHIP_USER_URL);
    cy.contains(/Lower members-only event prices/i).should("be.visible");
};
/**
 * Helper: visit the membership requests page as the admin
 * and optionally switch to a specific tab ("Pending", "Approved", "Rejected").
 */
var visitMembershipRequestsAsAdmin = function (tab) {
    cy.adminlogin();
    cy.visit(MEMBERSHIP_ADMIN_URL);
    cy.contains("h1", "Membership Requests").should("be.visible");
    if (tab) {
        cy.contains("button", tab).click();
        cy.contains("button", tab).should("have.attr", "aria-pressed", "true");
    }
};
/**
 * Helper: find the primary action button on the MembershipCard.
 * Handles "Request Membership", "Re-Submit Request", and "Read Request".
 */
var getMembershipCardPrimaryButton = function () {
    return cy.get("body").then(function ($body) {
        var btnTexts = MEMBERSHIP_CARD_BUTTON_LABELS;
        var _loop_1 = function (i) {
            var text = btnTexts[i];
            var match = $body
                .find("button")
                .filter(function (_, el) {
                var content = el.textContent || "";
                return content.indexOf(text) !== -1;
            })
                .first();
            if (match.length) {
                return { value: cy.wrap(match) };
            }
        };
        for (var i = 0; i < btnTexts.length; i++) {
            var state_1 = _loop_1(i);
            if (typeof state_1 === "object")
                return state_1.value;
        }
        throw new Error("Could not find a membership card primary button");
    });
};
/**
 * Scope helper for the currently open dialog.
 * This avoids ever clicking outside / closing via overlay.
 */
var withinOpenDialog = function (fn) {
    cy.get('[role="dialog"]').should("be.visible").within(fn);
};
/**
 * Open membership request dialog from the card.
 */
var openMembershipRequestDialogFromCard = function () {
    getMembershipCardPrimaryButton().should("be.visible").click();
    withinOpenDialog(function () {
        cy.contains(/Membership Request/i).should("be.visible");
        cy.get("#mr-message").should("be.visible");
    });
};
/**
 * Submit membership request from dialog (handles Submit vs Re-Submit).
 */
var submitMembershipRequestFromDialog = function (message) {
    withinOpenDialog(function () {
        cy.get("#mr-message")
            .should("not.be.disabled")
            .clear()
            .type(message);
        cy.get("button")
            .filter(function (_, el) {
            var text = (el.textContent || "").trim();
            for (var i = 0; i < REQUEST_SUBMIT_LABELS.length; i++) {
                if (text.indexOf(REQUEST_SUBMIT_LABELS[i]) !== -1)
                    return true;
            }
            return false;
        })
            .should("be.enabled")
            .first()
            .click();
    });
    cy.get('[role="dialog"]').should("not.exist");
};
/**
 * Filter admin membership table by email, using the Search-by dropdown + search input.
 * After typing, waits a full second to allow for debounced search before continuing.
 */
var filterMembershipRequestsByEmail = function (email) {
    // Open the "Search by ..." select trigger
    cy.contains("button", "Search by").click();
    // Choose "Search by Email"
    cy.get('[role="option"]').contains("Search by Email").click();
    // Type the email into the search input
    cy.get('input[placeholder^="Type to search"]')
        .clear()
        .type(email);
    // Debounce safeguard: wait a full second after typing before checking results
    cy.wait(1000);
    // Wait for the AG Grid to show a cell with that email
    cy.contains(".ag-cell", email, { timeout: 10000 }).should("be.visible");
};
/**
 * Open the admin review dialog for the row that matches a given email.
 * This uses AG Grid's DOM: find the cell with the email, walk up to the row,
 * then click the review button within that row.
 */
var openAdminReviewDialogForEmail = function (email) {
    // Make sure table is filtered to the specific email first
    filterMembershipRequestsByEmail(email);
    // Now find the row that contains that email and click its review button
    cy.contains(".ag-cell", email)
        .closest(".ag-row")
        .within(function () {
        cy.get('button[aria-label="Review membership request"]').click();
    });
    withinOpenDialog(function () {
        cy.contains(/Review Membership/i).should("be.visible");
        cy.contains("Decision").should("be.visible");
    });
};
/**
 * Inside MembershipReviewDialog, set decision/mute/reason and confirm.
 *
 * The mute toggle uses explicit check()/uncheck() so we always trigger a real
 * change, even when unmuting. The checkbox hydrates from previous server state,
 * so this is where we force it to the new desired state.
 */
var adminRespondToMembershipRequest = function (opts) {
    withinOpenDialog(function () {
        cy.contains("button", /^Approve$/).as("approveBtn");
        cy.contains("button", /^Deny$/).as("denyBtn");
        if (opts.decision === "approve") {
            cy.get("@approveBtn").click();
        }
        else {
            cy.get("@denyBtn").click();
        }
        if (typeof opts.muted === "boolean") {
            var checkbox = cy
                .contains("label", "Mute this user from future membership requests")
                .find('input[type="checkbox"]');
            if (opts.muted) {
                checkbox.check({ force: true }).should("be.checked");
            }
            else {
                checkbox.uncheck({ force: true }).should("not.be.checked");
            }
        }
        if (opts.reason) {
            cy.get("textarea")
                .first()
                .clear()
                .type(opts.reason);
        }
        cy.contains("button", "Confirm").should("not.be.disabled").click();
    });
    cy.get('[role="dialog"]').should("not.exist");
};
describe("Membership / Full Request Lifecycle", function () {
    /**
     * These tests are intentionally stateful and rely on being run in order
     * against the same test user and backing store. Each `it` picks up where
     * the previous one left off so each numbered step shows as its own check.
     */
    it("1. User creates initial membership request", function () {
        visitMembershipCardAsUser();
        openMembershipRequestDialogFromCard();
        submitMembershipRequestFromDialog("Initial membership request from Cypress E2E.");
        cy.contains(/membership request pending review/i).should("be.visible");
    });
    it("2. Admin denies the initial request (unmuted)", function () {
        visitMembershipRequestsAsAdmin("Pending");
        openAdminReviewDialogForEmail(MEMBER_EMAIL);
        adminRespondToMembershipRequest({
            decision: "deny",
            muted: false,
            reason: "Initial denial from Cypress test.",
        });
    });
    it("3. User sees denial and submits an appeal", function () {
        visitMembershipCardAsUser();
        cy.contains(DENIED_MESSAGE_SNIPPET).should("be.visible");
        openMembershipRequestDialogFromCard();
        withinOpenDialog(function () {
            cy.contains(/Previous reviewer response/i).should("be.visible");
            cy.contains("Initial denial from Cypress test.").should("be.visible");
        });
        submitMembershipRequestFromDialog("Appeal: please reconsider my membership.");
        cy.contains(/membership request pending review/i).should("be.visible");
    });
    it("4. Admin approves the appealed request", function () {
        visitMembershipRequestsAsAdmin("Pending");
        openAdminReviewDialogForEmail(MEMBER_EMAIL);
        adminRespondToMembershipRequest({
            decision: "approve",
            muted: false,
            reason: "Approved after appeal from Cypress test.",
        });
    });
    it("5. User sees accepted membership card", function () {
        visitMembershipCardAsUser();
        cy.contains(/Official Member/i).should("be.visible");
        // Ensure no primary request/appeal button is present
        cy.get("body").then(function ($body) {
            var btns = $body
                .find("button")
                .filter(function (_, el) {
                var text = (el.textContent || "").trim();
                for (var i = 0; i < MEMBERSHIP_CARD_BUTTON_LABELS.length; i++) {
                    if (text.indexOf(MEMBERSHIP_CARD_BUTTON_LABELS[i]) !== -1) {
                        return true;
                    }
                }
                return false;
            });
            expect(btns.length).to.eq(0);
        });
    });
    it("6. Admin re-denies from Approved and mutes the user", function () {
        visitMembershipRequestsAsAdmin("Approved");
        openAdminReviewDialogForEmail(MEMBER_EMAIL);
        adminRespondToMembershipRequest({
            decision: "deny",
            muted: true,
            reason: "Muted due to behavior (Cypress test).",
        });
    });
    it("7. User sees they are muted and cannot submit", function () {
        visitMembershipCardAsUser();
        cy.contains(MUTED_MESSAGE_SNIPPET).should("be.visible");
        getMembershipCardPrimaryButton().then(function ($btn) {
            var text = ($btn.text() || "").toString();
            expect(text.indexOf("Read Request") !== -1).to.be.true;
        });
        openMembershipRequestDialogFromCard();
        withinOpenDialog(function () {
            cy.contains(MUTED_MESSAGE_SNIPPET).should("be.visible");
            cy.contains(/Previous reviewer response/i).should("be.visible");
            cy.contains("Muted due to behavior (Cypress test).").should("be.visible");
            cy.get("#mr-message").should("be.disabled");
            cy.get("button")
                .filter(function (_, el) {
                var text = (el.textContent || "").trim();
                for (var i = 0; i < REQUEST_SUBMIT_LABELS.length; i++) {
                    if (text.indexOf(REQUEST_SUBMIT_LABELS[i]) !== -1)
                        return true;
                }
                return false;
            })
                .should("be.disabled");
        });
        withinOpenDialog(function () {
            cy.contains("button", "Close").click();
        });
        cy.get('[role="dialog"]').should("not.exist");
    });
    it("8. Admin re-denies from Rejected but UNMUTES the user", function () {
        visitMembershipRequestsAsAdmin("Rejected");
        openAdminReviewDialogForEmail(MEMBER_EMAIL);
        adminRespondToMembershipRequest({
            decision: "deny",
            muted: false,
            reason: "Still denied but unmuted so they can try again (Cypress).",
        });
        // Final verification: user is denied but not muted and can submit again
        visitMembershipCardAsUser();
        cy.contains(DENIED_MESSAGE_SNIPPET).should("be.visible");
        cy.contains(MUTED_MESSAGE_SNIPPET).should("not.exist");
        openMembershipRequestDialogFromCard();
        withinOpenDialog(function () {
            cy.contains(MUTED_MESSAGE_SNIPPET).should("not.exist");
            cy.get("#mr-message").should("not.be.disabled");
            cy.get("button")
                .filter(function (_, el) {
                var text = (el.textContent || "").trim();
                for (var i = 0; i < REQUEST_SUBMIT_LABELS.length; i++) {
                    if (text.indexOf(REQUEST_SUBMIT_LABELS[i]) !== -1)
                        return true;
                }
                return false;
            })
                .should("be.enabled");
        });
    });
});
