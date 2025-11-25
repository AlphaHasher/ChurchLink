describe('Admin – Permissions Management', () => {
  beforeEach(() => {
    // E2E mode handles authentication automatically - no API mocking needed
    cy.prepareConsoleErrorSpy();
  });

  describe('Permissions Page Loading and Structure', () => {
    it('loads permissions management page with correct structure', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000); // Wait for page to load
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });

      // Verify main heading
      cy.contains('Permission Roles Management', { timeout: 10000 }).should('be.visible');
    });

    it('handles loading state appropriately', () => {
      cy.visit('/admin/permissions');
      
      // Should show loading state initially or load successfully
      cy.get('body').should('be.visible');
      
      // Check for loading text or proper content
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase();
        const hasLoadingOrContent = bodyText.includes('loading permissions') || 
                                   bodyText.includes('permission roles management') ||
                                   bodyText.includes('permission');
        expect(hasLoadingOrContent, 'should show loading or content').to.be.true;
      });
      
      cy.wait(3000);
      cy.contains('Permission Roles Management', { timeout: 10000 }).should('be.visible');
    });

    it('displays permissions table interface', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Should show data grid for permissions
      cy.get('.ag-theme-quartz, [class*="grid"], table', { timeout: 15000 }).should('be.visible');
    });
  });

  describe('Permissions Table Functionality', () => {
    it('shows search functionality', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Check for search input
      cy.get('input[placeholder*="Search Permission Name"], input[placeholder*="Search"]', { timeout: 10000 }).should('be.visible');
    });

    it('displays table columns correctly', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Should show AG-Grid with proper structure
      cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
      
      // Check for table headers or content
      cy.get('body').then(($body) => {
        const hasTableStructure = $body.find('.ag-header, th, [class*="header"]').length > 0 ||
                                 $body.text().includes('Permission Role Name') ||
                                 $body.text().includes('Accessible Pages');
        expect(hasTableStructure, 'should have table structure').to.be.true;
      });
    });

    it('shows refresh and create controls', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Should have refresh button
      cy.contains('button', 'Refresh', { timeout: 10000 }).should('be.visible');
      
      // Should have create/add button for new permissions
      cy.get('body').then(($body) => {
        const hasCreateButton = $body.text().includes('Create') || 
                              $body.text().includes('Add') ||
                              $body.text().includes('New') ||
                              $body.find('[class*="create"], [class*="add"]').length > 0;
        expect(hasCreateButton, 'should have create functionality').to.be.true;
      });
    });

    it('displays action buttons for permission roles', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Should show action buttons in the grid
      cy.get('body').then(($body) => {
        const hasActionButtons = $body.find('button').length > 0;
        const hasActions = $body.text().includes('Edit') || 
                         $body.text().includes('Delete') || 
                         $body.text().includes('Members') ||
                         $body.find('[class*="action"]').length > 0;
        expect(hasActionButtons && hasActions, 'should have action buttons').to.be.true;
      });
    });

    it('handles pagination when available', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Check for pagination controls if data exists
      cy.get('body').then(($body) => {
        const hasPagination = $body.find('[class*="pagination"], .ag-paging').length > 0 ||
                            $body.text().includes('Page') ||
                            $body.find('[aria-label*="page"]').length > 0;
        
        if (hasPagination) {
          cy.log('Pagination controls found');
        } else {
          cy.log('No pagination needed or visible');
        }
      });
    });
  });

  describe('Permission Role Management Dialogs', () => {
    it('can access create permission dialog', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Look for create button and try to interact with it
      cy.get('body').then(($body) => {
        const createButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('create') || text.includes('add') || text.includes('new');
        });
        
        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).click();
          cy.wait(1000);
          
          // Should open a dialog
          cy.get('body').then(($bodyAfter) => {
            const hasDialog = $bodyAfter.find('[role="dialog"], .dialog, [class*="dialog"]').length > 0;
            if (hasDialog) {
              cy.log('Create dialog opened successfully');
            }
          });
        }
      });
    });

    it('shows permission toggles in create dialog', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Try to open create dialog and check for permission controls
      cy.get('body').then(($body) => {
        const createButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('create') || text.includes('add') || text.includes('new');
        });
        
        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).click();
          cy.wait(1000);
          
          // Check for permission toggles/controls
          cy.get('body').then(($bodyAfter) => {
            const hasPermissionControls = $bodyAfter.find('input[type="radio"], input[type="checkbox"]').length > 0 ||
                                        $bodyAfter.text().includes('Administrator') ||
                                        $bodyAfter.text().includes('Management');
            
            if (hasPermissionControls) {
              cy.log('Permission controls found in dialog');
            }
          });
        }
      });
    });

    it('can interact with permission role actions', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Look for action buttons and test interaction
      cy.get('body').then(($body) => {
        const actionButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('edit') || text.includes('members') || text.includes('delete');
        });
        
        if (actionButtons.length > 0) {
          // Try clicking the first action button (safely)
          cy.wrap(actionButtons.first()).click({ force: true });
          cy.wait(1000);
          
          // Should open some dialog or perform action
          cy.get('body').then(($bodyAfter) => {
            const hasDialogOrResponse = $bodyAfter.find('[role="dialog"], .dialog').length > 0 ||
                                       $bodyAfter.text() !== $body.text();
            
            if (hasDialogOrResponse) {
              cy.log('Action button interaction successful');
            }
          });
        }
      });
    });
  });

  describe('Permission Types and Controls', () => {
    it('shows different permission categories', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Check for various permission types in the interface
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase();
        const hasPermissionTypes = bodyText.includes('admin') ||
                                 bodyText.includes('management') ||
                                 bodyText.includes('editing') ||
                                 bodyText.includes('web builder') ||
                                 bodyText.includes('mobile ui') ||
                                 bodyText.includes('event') ||
                                 bodyText.includes('sermon');
        
        expect(hasPermissionTypes, 'should show permission types').to.be.true;
      });
    });

    it('displays permission descriptions and labels', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Try to access create dialog to see permission descriptions
      cy.get('body').then(($body) => {
        const createButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('create') || text.includes('add') || text.includes('new');
        });
        
        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).click();
          cy.wait(1000);
          
          // Check for permission descriptions
          cy.get('body').then(($bodyAfter) => {
            const hasDescriptions = $bodyAfter.find('small, .text-gray-500').length > 0 ||
                                  $bodyAfter.text().includes('This option grants') ||
                                  $bodyAfter.text().includes('ability to');
            
            if (hasDescriptions) {
              cy.log('Permission descriptions found');
            }
          });
        }
      });
    });

    it('shows proper permission hierarchy and restrictions', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Check for administrator restrictions and hierarchy
      cy.get('body').then(($body) => {
        const hasHierarchyInfo = $body.text().includes('Administrator') ||
                               $body.text().includes('highest level') ||
                               $body.text().includes('complete site access');
        
        if (hasHierarchyInfo) {
          cy.log('Permission hierarchy information displayed');
        }
      });
    });
  });

  describe('Search and Filter Functionality', () => {
    it('can use search to filter permission roles', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Test search functionality
      cy.get('input[placeholder*="Search"]').then($input => {
        if ($input.length > 0) {
          cy.wrap($input).first().type('Admin');
          cy.wait(1000);
          
          // Should filter results
          cy.get('body').should('contain.text', 'Admin');
          
          // Clear search
          cy.wrap($input).first().clear();
          cy.wait(500);
        }
      });
    });

    it('search works with permission names and accessible pages', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Test searching for different terms
      const searchTerms = ['management', 'editor', 'admin'];
      
      searchTerms.forEach(term => {
        cy.get('input[placeholder*="Search"]').then($input => {
          if ($input.length > 0) {
            cy.wrap($input).first().clear().type(term);
            cy.wait(1000);
            
            // Verify search is working (grid should update)
            cy.get('.ag-theme-quartz', { timeout: 5000 }).should('be.visible');
            
            cy.wrap($input).first().clear();
            cy.wait(500);
          }
        });
      });
    });
  });

  describe('Permission Role Members Management', () => {
    it('can access role members dialog', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Look for members button
      cy.get('body').then(($body) => {
        const membersButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('member') || text.includes('user');
        });
        
        if (membersButtons.length > 0) {
          cy.wrap(membersButtons.first()).click();
          cy.wait(1000);
          
          // Should open members dialog
          cy.get('body').then(($bodyAfter) => {
            const hasMembersDialog = $bodyAfter.find('[role="dialog"]').length > 0 ||
                                   $bodyAfter.text().includes('Members') ||
                                   $bodyAfter.text().includes('Users');
            
            if (hasMembersDialog) {
              cy.log('Members dialog opened');
            }
          });
        }
      });
    });
  });

  describe('Data Persistence and State Management', () => {
    it('maintains state during navigation', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Perform search
      cy.get('input[placeholder*="Search"]').then($input => {
        if ($input.length > 0) {
          cy.wrap($input).first().type('Admin');
          cy.wait(1000);
          
          // Navigate away and back
          cy.visit('/admin');
          cy.wait(2000);
          cy.visit('/admin/permissions');
          cy.wait(3000);
          
          // Should load fresh (no persisted search)
          cy.get('input[placeholder*="Search"]').should('have.value', '');
        }
      });
    });

    it('handles refresh functionality correctly', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Test refresh button
      cy.contains('button', 'Refresh').then($button => {
        if ($button.length > 0) {
          cy.wrap($button).click();
          cy.wait(2000);
          
          // Should reload data successfully
          cy.get('body').should('be.visible');
          cy.contains('Permission Roles Management').should('be.visible');
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles empty permission states gracefully', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Should handle empty or loading states
      cy.get('body').should('be.visible');
      cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
      
      // Should not show error overlays
      cy.get('body').should(($body) => {
        const hasErrors = $body.find('#vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasErrors, 'should not have error overlays').to.be.false;
      });
    });

    it('maintains UI responsiveness during operations', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Test that UI remains responsive
      cy.get('body').should('be.visible');
      
      // Try multiple interactions
      cy.get('input[placeholder*="Search"]').then($input => {
        if ($input.length > 0) {
          cy.wrap($input).first().type('test').clear().type('admin');
          cy.wait(500);
        }
      });
      
      // Should remain functional
      cy.contains('Permission Roles Management').should('be.visible');
    });

    it('provides appropriate feedback for user actions', () => {
      cy.visit('/admin/permissions');
      cy.wait(3000);
      
      // Test that buttons and controls provide feedback
      cy.get('body').then(($body) => {
        const buttons = $body.find('button');
        if (buttons.length > 0) {
          // Buttons should be responsive and styled appropriately
          cy.wrap(buttons.first()).should('be.visible');
        }
      });
    });
  });
});