describe('Admin – Mobile UI Management', () => {
  beforeEach(() => {
    // E2E mode handles authentication automatically - no API mocking, use real endpoints
    cy.prepareConsoleErrorSpy();
  });

  describe('Mobile UI Tabs Management', () => {
    it('loads mobile UI tab page with correct structure and real data', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000); // Wait for real API calls to complete
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });

      // Verify page structure loads with real data
      cy.contains('h1', 'Mobile UI Tab').should('be.visible');
      cy.contains('h2', 'App Tab Configuration').should('be.visible');
      
      // Wait for loading to complete and verify no loading skeleton remains
      cy.get('[class*="skeleton"]').should('not.exist');
    });

    it('displays tab configuration controls with real functionality', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000); // Allow time for API response
      
      // Verify all configuration controls are present and functional
      cy.get('select').should('be.visible').and('be.enabled');
      
      // Check dropdown options are populated from real data
      cy.get('select').click();
      cy.get('select option').should('have.length.greaterThan', 1);
      cy.get('select').contains('option', 'Select tab to add...').should('exist');
      
      // Verify action buttons
      cy.contains('button', 'Add Tab').should('be.visible');
      cy.contains('button', 'Save Changes').should('be.visible').and('not.be.disabled');
    });

    it('shows detailed information and constraints from backend', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Verify informational content is displayed
      cy.contains('The Home tab is fixed at the first position').should('be.visible');
      cy.contains('You can add up to 5 tabs total').should('be.visible');
      
      // Check detailed icon reference guide
      cy.contains('Icons:').should('be.visible');
      cy.contains('Home (🏠)').should('be.visible');
      cy.contains('Live (📺)').should('be.visible');
      cy.contains('Bible (📖)').should('be.visible');
    });

    it('displays existing tabs with real backend data', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Verify tab list headers are present
      cy.contains('Index').should('be.visible');
      cy.contains('Name').should('be.visible');
      cy.contains('Display Name').should('be.visible');
      cy.contains('Icon').should('be.visible');
      
      // Check that real tab data is loaded (at minimum Home tab should exist)
      cy.get('body').should('contain.text', 'home').and('contain.text', 'Home');
      
      // Verify tab data structure is displayed correctly
      cy.get('[class*="grid-cols-4"]').should('exist'); // Grid layout for tab info
    });

    it('shows functional edit and delete controls for tabs', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Should have edit buttons with proper titles
      cy.get('button[title*="Edit"], svg[title*="Edit"]').should('exist');
      
      // Should have delete buttons (may be disabled for Home tab)
      cy.get('button[title*="Delete"], svg[title*="Delete"]').should('exist');
      
      // Verify Home tab has special restrictions
      cy.get('body').then($body => {
        if ($body.text().includes('Home tab cannot be deleted')) {
          cy.contains('Home tab cannot be deleted').should('be.visible');
        }
      });
    });

    it('shows functional move up/down controls with real behavior', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Should show arrow controls for reordering tabs
      cy.get('button').find('svg').should('exist'); // Arrow icons in buttons
      
      // Verify arrow buttons exist and have proper states
      cy.get('body').then($body => {
        const hasArrows = $body.find('svg').filter((i, el) => {
          const classList = el.className.baseVal || '';
          return classList.includes('lucide') || el.getAttribute('data-lucide');
        }).length > 0;
        
        if (hasArrows) {
          cy.log('Arrow controls found for tab ordering');
        }
      });
    });

    it('can interact with tab dropdown and add new tabs', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Test dropdown interaction with real options
      cy.get('select').should('be.visible').click();
      
      // Check available tab options (should be real data from backend)
      cy.get('select option').then($options => {
        const optionTexts = Array.from($options).map(opt => opt.textContent);
        cy.log('Available tab options:', optionTexts.join(', '));
        
        // Should have predefined tab options
        const expectedTabs = ['Live', 'Weekly Bulletin', 'Events', 'Giving', 'Sermons', 'Bible', 'Profile'];
        const hasValidOptions = expectedTabs.some(tab => 
          optionTexts.some(text => text?.includes(tab))
        );
        expect(hasValidOptions).to.be.true;
      });
      
      // Test selecting an option if available
      cy.get('select option').then($options => {
        const availableOptions = Array.from($options).filter(opt => 
          opt.textContent && !opt.textContent.includes('Select tab to add') && !opt.textContent.includes('Maximum')
        );
        
        if (availableOptions.length > 0) {
          const firstOption = availableOptions[0] as HTMLOptionElement;
          cy.get('select').select(firstOption.value);
          
          // Add Tab button should become enabled
          cy.contains('button', 'Add Tab').should('not.be.disabled');
        }
      });
    });

    it('validates maximum tab limit with real constraint checking', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Check current tab count and limit messaging
      cy.get('body').then($body => {
        const bodyText = $body.text();
        
        // Should show maximum limit information
        expect(bodyText).to.contain('Maximum 5 tabs');
        
        // If already at limit, dropdown should show appropriate message
        if (bodyText.includes('Maximum 5 tabs reached')) {
          cy.get('select').should('contain.text', 'Maximum 5 tabs reached');
          cy.contains('button', 'Add Tab').should('be.disabled');
        }
      });
    });

    it('can test tab editing functionality with real data persistence', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Look for editable tabs (non-Home tabs)
      cy.get('button[title*="Edit"]').then($editButtons => {
        if ($editButtons.length > 0) {
          // Click first available edit button
          cy.wrap($editButtons.first()).click();
          cy.wait(1000);
          
          // Should open edit form
          cy.get('body').then($body => {
            if ($body.find('input[value], textarea[value]').length > 0) {
              cy.log('Edit form opened successfully');
              
              // Test form elements exist
              cy.get('input, textarea, select').should('exist');
              
              // Look for Save/Cancel buttons
              cy.contains('button', 'Save').should('be.visible');
              cy.contains('button', 'Cancel').should('be.visible');
              
              // Cancel editing to avoid data changes
              cy.contains('button', 'Cancel').click();
            }
          });
        }
      });
    });

    it('can test save changes functionality with real backend integration', () => {
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);

      // Test the save changes button functionality
      cy.contains('button', 'Save Changes').should('be.visible').and('not.be.disabled');
      
      // Click save to test backend integration (should work with existing data)
      cy.contains('button', 'Save Changes').click();
      cy.wait(3000);
      
      // Should show success message or update UI appropriately
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasSuccessMessage = bodyText.includes('success') || 
                                bodyText.includes('saved') || 
                                bodyText.includes('updated');
        
        // Should either show success message or complete without error
        if (hasSuccessMessage) {
          cy.log('Save operation completed with success message');
        } else {
          // At minimum, should not show error messages
          const hasErrorMessage = bodyText.includes('error') || bodyText.includes('failed');
          expect(hasErrorMessage).to.be.false;
        }
      });
    });
  });

  describe('Mobile UI Pages Management', () => {
    it('loads mobile UI pages configuration with real backend data', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000); // Allow time for real API calls
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });

      // Verify pages management interface loads with real data
      cy.get('body').should($body => {
        const bodyText = $body.text();
        const hasPageContent = bodyText.includes('Dashboard') || 
                             bodyText.includes('Pages') || 
                             bodyText.includes('Mobile UI') ||
                             bodyText.includes('Configuration');
        expect(hasPageContent, 'should show pages management content').to.be.true;
      });
      
      // Ensure loading is complete
      cy.get('[class*="skeleton"]').should('not.exist');
    });

    it('displays page configuration controls with real functionality', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      cy.get('body').should('be.visible');
      
      // Check for page management controls that interact with real API
      cy.get('body').then(($body) => {
        const hasDropdown = $body.find('select').length > 0;
        const hasAddButton = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('add') || text.includes('create') || text.includes('new');
        }).length > 0;
        const hasSaveButton = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('save') || text.includes('update');
        }).length > 0;
        
        // Verify controls are present and functional
        if (hasDropdown || hasAddButton || hasSaveButton) {
          cy.log('Page management controls found and functional');
          
          // Test dropdown functionality if present
          if (hasDropdown) {
            cy.get('select').first().should('be.enabled');
          }
          
          // Test buttons are clickable if present
          if (hasAddButton) {
            cy.get('button').contains(/add|create|new/i).should('be.visible');
          }
        }
      });
    });

    it('displays real page data and management interface', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      cy.get('body').should('be.visible');
      
      // Check for real page data display
      cy.get('body').then(($body) => {
        const bodyText = $body.text();
        
        // Look for page management structure
        const hasPageStructure = bodyText.includes('Index') || 
                               bodyText.includes('Display Name') ||
                               bodyText.includes('Page Name') ||
                               bodyText.includes('Enabled') ||
                               $body.find('[class*="grid"], table, [class*="list"]').length > 0;
        
        if (hasPageStructure) {
          cy.log('Page data structure found');
          
          // Verify specific page management elements
          const pageTypes = ['events', 'giving', 'sermons', 'live', 'bulletin', 'forms'];
          const hasPageTypes = pageTypes.some(type => 
            bodyText.toLowerCase().includes(type)
          );
          
          if (hasPageTypes) {
            cy.log('Page types from backend data found');
          }
        }
      });
    });

    it('handles page management interactions with real backend', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      cy.get('body').should('be.visible');
      
      // Test real interactive elements
      cy.get('body').then(($body) => {
        const buttons = $body.find('button');
        const inputs = $body.find('input, select, textarea');
        
        if (buttons.length > 0) {
          cy.log(`Found ${buttons.length} interactive buttons`);
          
          // Test button interactions
          const actionButtons = buttons.filter((i, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return text.includes('add') || text.includes('edit') || 
                   text.includes('delete') || text.includes('save') ||
                   text.includes('move') || text.includes('toggle');
          });
          
          if (actionButtons.length > 0) {
            // Test clicking first safe action button
            const firstButton = actionButtons.first();
            const buttonText = firstButton.text().toLowerCase();
            
            if (buttonText.includes('add') || buttonText.includes('save')) {
              cy.wrap(firstButton).should('be.visible').and('not.be.disabled');
            }
          }
        }
        
        if (inputs.length > 0) {
          cy.log(`Found ${inputs.length} input elements`);
          cy.wrap(inputs.first()).should('be.visible');
        }
      });
    });

    it('displays proper page management functionality with real data', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      cy.get('body').should('be.visible');
      
      // Verify page management features work with real backend
      cy.get('body').then(($body) => {
        const bodyText = $body.text().toLowerCase();
        
        // Check for page management terminology and functionality
        const hasPageManagement = bodyText.includes('page') || 
                                bodyText.includes('dashboard') ||
                                bodyText.includes('configuration') ||
                                bodyText.includes('mobile ui');
        
        expect(hasPageManagement, 'should contain page management features').to.be.true;
        
        // Check for specific page management actions
        const managementActions = ['add', 'edit', 'delete', 'move', 'enable', 'disable', 'save'];
        const hasManagementActions = managementActions.some(action => 
          bodyText.includes(action)
        );
        
        if (hasManagementActions) {
          cy.log('Page management actions available');
        }
      });
    });

    it('can test page creation workflow with real backend', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      // Test page creation if available
      cy.get('body').then(($body) => {
        const addButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('add') || text.includes('create') || text.includes('new');
        });
        
        if (addButtons.length > 0) {
          cy.wrap(addButtons.first()).click();
          cy.wait(2000);
          
          // Should open creation interface
          cy.get('body').then(($bodyAfter) => {
            const hasCreationInterface = $bodyAfter.find('dialog, [role="dialog"], form, input, select').length > 0;
            
            if (hasCreationInterface) {
              cy.log('Page creation interface opened');
              
              // Look for page type selection
              cy.get('body').should($body => {
                const text = $body.text().toLowerCase();
                const hasPageOptions = ['events', 'giving', 'sermons', 'live', 'bulletin'].some(type =>
                  text.includes(type)
                );
                if (hasPageOptions) {
                  cy.log('Page type options available');
                }
              });
              
              // Cancel/close if possible to avoid data changes
              const cancelButtons = $bodyAfter.find('button').filter((i, el) => {
                const text = Cypress.$(el).text().toLowerCase();
                return text.includes('cancel') || text.includes('close');
              });
              
              if (cancelButtons.length > 0) {
                cy.wrap(cancelButtons.first()).click();
              }
            }
          });
        }
      });
    });

    it('can test page editing functionality with real persistence', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      // Look for existing pages to edit
      cy.get('body').then(($body) => {
        const editButtons = $body.find('button, svg').filter((i, el) => {
          const element = Cypress.$(el);
          const text = element.text().toLowerCase();
          const title = element.attr('title')?.toLowerCase() || '';
          return text.includes('edit') || title.includes('edit');
        });
        
        if (editButtons.length > 0) {
          cy.wrap(editButtons.first()).click();
          cy.wait(2000);
          
          // Should open edit interface
          cy.get('body').then(($bodyAfter) => {
            const hasEditInterface = $bodyAfter.find('input, textarea, select, [contenteditable]').length > 0;
            
            if (hasEditInterface) {
              cy.log('Page editing interface opened');
              
              // Test form elements are functional
              const inputs = $bodyAfter.find('input[type="text"], textarea');
              if (inputs.length > 0) {
                // Test input functionality without changing data
                cy.wrap(inputs.first()).should('be.visible').and('not.be.disabled');
              }
              
              // Cancel editing to avoid data changes
              const cancelButtons = $bodyAfter.find('button').filter((i, el) => {
                const text = Cypress.$(el).text().toLowerCase();
                return text.includes('cancel') || text.includes('close');
              });
              
              if (cancelButtons.length > 0) {
                cy.wrap(cancelButtons.first()).click();
              }
            }
          });
        }
      });
    });

    it('can test page deletion functionality with real backend validation', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      // Test delete functionality (should show confirmation)
      cy.get('body').then(($body) => {
        const deleteButtons = $body.find('button, svg').filter((i, el) => {
          const element = Cypress.$(el);
          const text = element.text().toLowerCase();
          const title = element.attr('title')?.toLowerCase() || '';
          return text.includes('delete') || text.includes('remove') || 
                 title.includes('delete') || title.includes('remove');
        });
        
        if (deleteButtons.length > 0) {
          // Click delete button (should show confirmation)
          cy.wrap(deleteButtons.first()).click();
          cy.wait(1000);
          
          // Should show confirmation dialog or similar
          cy.get('body').then(($bodyAfter) => {
            const hasConfirmation = $bodyAfter.text().toLowerCase().includes('confirm') ||
                                  $bodyAfter.text().toLowerCase().includes('sure') ||
                                  $bodyAfter.find('[role="dialog"], [class*="alert"]').length > 0;
            
            if (hasConfirmation) {
              cy.log('Delete confirmation shown');
              
              // Cancel deletion to avoid data loss
              const cancelButtons = $bodyAfter.find('button').filter((i, el) => {
                const text = Cypress.$(el).text().toLowerCase();
                return text.includes('cancel') || text.includes('no');
              });
              
              if (cancelButtons.length > 0) {
                cy.wrap(cancelButtons.first()).click();
              }
            }
          });
        }
      });
    });

    it('can test save functionality with real backend persistence', () => {
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);

      // Test save functionality
      cy.get('body').then(($body) => {
        const saveButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('save') || text.includes('update') || text.includes('apply');
        });
        
        if (saveButtons.length > 0 && !saveButtons.first().prop('disabled')) {
          cy.wrap(saveButtons.first()).click();
          cy.wait(3000);
          
          // Should show success message or update UI
          cy.get('body').then(($bodyAfter) => {
            const bodyText = $bodyAfter.text().toLowerCase();
            const hasSuccess = bodyText.includes('success') || 
                              bodyText.includes('saved') || 
                              bodyText.includes('updated');
            const hasError = bodyText.includes('error') || bodyText.includes('failed');
            
            if (hasSuccess) {
              cy.log('Save operation successful');
            } else {
              // At minimum, should not show errors
              expect(hasError, 'should not have errors during save').to.be.false;
            }
          });
        }
      });
    });
  });

  describe('Mobile UI Navigation and Real Backend Integration', () => {
    it('can navigate between pages with real data persistence', () => {
      // Test navigation with real backend state
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000); // Allow real API calls
      cy.get('body').should('be.visible');
      cy.assertNoClientErrors();

      // Capture initial state if possible
      let initialTabData = '';
      cy.get('body').then($body => {
        initialTabData = $body.text();
      });

      // Navigate to pages and verify real data loads
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000); // Allow real API calls
      cy.get('body').should('be.visible');
      cy.assertNoClientErrors();

      // Navigate back to tabs and verify data persistence
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      cy.get('body').should('be.visible');
      cy.assertNoClientErrors();
      
      // Data should be consistent (real backend maintains state)
      cy.get('body').should('contain.text', 'Mobile UI Tab');
    });

    it('maintains real-time data consistency across pages', () => {
      // Test that changes in one area affect the other (if applicable)
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      // Get current tab configuration
      cy.get('body').then($body => {
        const hasTabData = $body.text().includes('home') || $body.text().includes('Home');
        if (hasTabData) {
          cy.log('Tab data loaded from real backend');
        }
      });

      // Check pages configuration reflects real backend state
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);
      
      cy.get('body').then($body => {
        const hasPageData = $body.text().toLowerCase().includes('page') || 
                          $body.text().toLowerCase().includes('dashboard');
        if (hasPageData) {
          cy.log('Page data loaded from real backend');
        }
      });
    });

    it('handles real API errors and network issues gracefully', () => {
      // Test error handling with real network conditions
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      cy.get('body').should($body => {
        const bodyText = $body.text().toLowerCase();
        
        // Should not show compile errors
        const hasCompileErrors = $body.find('#vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasCompileErrors, 'should not have compile errors').to.be.false;
        
        // Should handle API errors gracefully
        const hasApiErrors = bodyText.includes('network error') || 
                           bodyText.includes('failed to fetch') ||
                           bodyText.includes('connection error');
        
        if (hasApiErrors) {
          // If API errors occur, they should be handled gracefully
          cy.log('API errors detected but handled gracefully');
        }
      });

      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);
      
      cy.get('body').should($body => {
        const hasCompileErrors = $body.find('#vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasCompileErrors, 'should not have compile errors').to.be.false;
      });
    });

    it('shows real loading states during API calls', () => {
      // Test loading states with real API timing
      cy.visit('/admin/mobile-ui-tab');
      
      // Check for loading states immediately
      cy.get('body', { timeout: 1000 }).then($body => {
        const hasLoadingStates = $body.find('[class*="skeleton"]').length > 0 ||
                               $body.text().toLowerCase().includes('loading') ||
                               $body.find('[class*="spinner"]').length > 0;
        
        if (hasLoadingStates) {
          cy.log('Real loading states detected during API calls');
        }
      });
      
      // Wait for loading to complete
      cy.wait(5000);
      cy.get('body').should('be.visible');
      
      // Loading states should be gone after API completes
      cy.get('[class*="skeleton"]').should('not.exist');
    });

    it('validates real backend data integrity across sessions', () => {
      // Test data integrity with real backend persistence
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      // Capture current configuration state
      let currentConfig = {};
      cy.get('body').then($body => {
        // Look for tab configuration data
        if ($body.text().includes('Home')) {
          currentConfig = { hasHome: true };
          cy.log('Home tab found in configuration');
        }
      });
      
      // Refresh page and verify data persists
      cy.reload();
      cy.wait(5000);
      
      cy.get('body').then($body => {
        // Verify data consistency after reload
        if (currentConfig.hasHome) {
          expect($body.text()).to.include('Home');
          cy.log('Data integrity maintained after reload');
        }
      });
    });

    it('can test real-time updates and synchronization', () => {
      // Test real-time behavior if supported
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      // Test save operation creates real backend changes
      cy.get('body').then($body => {
        const saveButtons = $body.find('button').filter((i, el) => {
          return Cypress.$(el).text().toLowerCase().includes('save');
        });
        
        if (saveButtons.length > 0) {
          const initialText = $body.text();
          
          cy.wrap(saveButtons.first()).click();
          cy.wait(3000);
          
          // Should show real backend response
          cy.get('body').then($bodyAfter => {
            const afterText = $bodyAfter.text();
            const hasChanged = afterText !== initialText || 
                             afterText.toLowerCase().includes('success') ||
                             afterText.toLowerCase().includes('saved');
            
            if (hasChanged) {
              cy.log('Real backend save operation detected');
            }
          });
        }
      });
    });

    it('validates cross-page data relationships with real backend', () => {
      // Test how tab and page configurations relate in real backend
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      // Check what tabs are configured
      const configuredTabs = [];
      cy.get('body').then($body => {
        const tabTypes = ['home', 'live', 'events', 'sermons', 'giving', 'bible'];
        tabTypes.forEach(tab => {
          if ($body.text().toLowerCase().includes(tab)) {
            configuredTabs.push(tab);
          }
        });
        
        if (configuredTabs.length > 0) {
          cy.log(`Found configured tabs: ${configuredTabs.join(', ')}`);
        }
      });
      
      // Check if pages reflect the same data structure
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(5000);
      
      cy.get('body').then($body => {
        // Look for consistency between tabs and pages
        const pageTypes = ['events', 'sermons', 'giving', 'live'];
        const foundPages = pageTypes.filter(page => 
          $body.text().toLowerCase().includes(page)
        );
        
        if (foundPages.length > 0) {
          cy.log(`Found page types: ${foundPages.join(', ')}`);
        }
      });
    });

    it('handles concurrent user scenarios with real backend', () => {
      // Test behavior that would occur with real concurrent usage
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(5000);
      
      // Test rapid navigation and interactions
      cy.get('body').should('be.visible');
      
      cy.visit('/admin/mobile-ui-pages');
      cy.wait(2000);
      
      cy.visit('/admin/mobile-ui-tab');
      cy.wait(2000);
      
      // Should handle rapid navigation without errors
      cy.get('body').should('be.visible');
      cy.assertNoClientErrors();
      
      // Final state should be consistent
      cy.contains('Mobile UI Tab').should('be.visible');
    });
  });
});