/// <reference types="cypress" />

describe("Signup page", () => {
    const visitSignup = () => {

        cy.logout();
        cy.visit("/auth/signup");
    };

    const typeEmail = (value: string) => {
        cy.contains("label", "Email Address")
            .parent()
            .find("input")
            .clear()
            .type(value);
    };

    const typePassword = (value: string) => {
        cy.contains("label", "Password")
            .parent()
            .find("input")
            .clear()
            .type(value);
    };

    const typeConfirmPassword = (value: string) => {
        cy.contains("label", "Confirm Password")
            .parent()
            .find("input")
            .clear()
            .type(value);
    };

    const submitForm = () => {
        cy.get('button[type="submit"]').click();
    };

    it("verifies signup UI elements are visible", () => {
        visitSignup();

        cy.contains("Sign Up").should("be.visible");
        cy.contains("Email Address").should("be.visible");
        cy.contains("Password").should("be.visible");
        cy.contains("Confirm Password").should("be.visible");

        cy.contains("button", "Sign Up").should("be.visible");
        cy.contains("button", "Sign up with Google").should("be.visible");

        cy.contains("Already have an account?").should("be.visible");
        cy.contains("Go back to login")
            .should("have.attr", "href", "/auth/login");
    });

    it("verifies navigation link to login works", () => {
        visitSignup();

        cy.contains("Go back to login").click();
        cy.url().should("include", "/auth/login");
    });

    it("verifies validation message when passwords do not match", () => {
        visitSignup();

        typeEmail("test@example.com");
        typePassword("Potato123!");
        typeConfirmPassword("Different123!");

        submitForm();

        cy.contains("Passwords do not match").should("be.visible");
    });

    it("verifies password length requirement validation", () => {
        visitSignup();

        const shortPassword = "Ab!1"; // < 8 chars

        typeEmail("shortpass@example.com");
        typePassword(shortPassword);
        typeConfirmPassword(shortPassword);

        submitForm();

        cy.contains("Password must be at least 8 characters long").should(
            "be.visible"
        );
    });

    it("verifies password special character requirement validation", () => {
        visitSignup();

        const noSpecialPassword = "Potato123"; // all alphanumeric

        typeEmail("nospecial@example.com");
        typePassword(noSpecialPassword);
        typeConfirmPassword(noSpecialPassword);

        submitForm();

        cy.contains("Password must have at least one special character").should(
            "be.visible"
        );
    });

    it("verifies successful signup redirects to verify email page and shows the new email", () => {
        visitSignup();

        const email = `e2e+${Date.now()}@example.com`;
        const validPassword = "Potato123!";

        typeEmail(email);
        typePassword(validPassword);
        typeConfirmPassword(validPassword);

        submitForm();

        // After successful signup, expect redirect to /auth/verify-email
        cy.url().should("include", "/auth/verify-email");

        // VerifyEmailPage should show the newly registered email somewhere
        cy.contains(email).should("be.visible");
    });
});
