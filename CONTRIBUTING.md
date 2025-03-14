# Contribution Guidelines

## General Guidelines
- All changes to the codebase must be submitted via pull requests (PRs). Direct pushes to the main branch are strictly prohibited.
- Code must comply with our project’s style guides, documentation standards, and testing protocols. **NOT YET IMPLEMENTED**
- Frequently update your branch with the latest changes from main to reduce merge conflicts.
- Update relevant documentation as part of your changes. 
- For minor changes that are brief and have minimal impact, the repository owner has the discretion to waive the two-person approval requirement, allowing the PR to be approved by just one reviewer.

## Pull Request (PR) Requirements
- Every PR must have a descriptive title.  Generic phrases like "app development" will be automatically closed or asked to rename
- PR's should only be opened when the code is complete, tested, and ready for review and merging. PRs should not be used for ongoing development; instead, use draft PRs or feature branches until ready.

## Branch Naming Conventions
To keep development organized, use the following naming conventions:

- **Features:** `feature/short-description`
- **Bug Fixes:** `bugfix/short-description`
- **Hotfixes (Misc Changes):** `hotfix/short-description`
- **Releases:** `release/short-description`

## Code Review Process
- Every PR must receive approvals from at least two different team members before merging (cannot be PR author).
- Please take this seriously and actually look over the code
- Once the approval process is completed, anyone can merge the code and delete the branch used in the PR

## Commit Message Guidelines
- Each commit message should succinctly describe what changes have been made.
- Include references to relevant issues or tickets when applicable so we can trace everything to its origin.

## Testing and Quality Assurance
- Ensure all tests pass locally before opening a PR. No changes should be pushed if they break the build or existing tests.
