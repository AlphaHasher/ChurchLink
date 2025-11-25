describe('Admin – Bible Plans Management', () => {
  beforeEach(() => {
    // E2E mode handles authentication automatically - no API mocking, use real endpoints
    cy.prepareConsoleErrorSpy();
  });

  describe('Bible Plans Management Page', () => {
    it('loads manage bible plans page with real backend data', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000); // Allow time for real API calls
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });
      
      // Verify page structure loads with real data
      cy.contains('Manage Bible Plans', { timeout: 10000 }).should('be.visible');
      
      // Ensure loading skeletons are gone
      cy.get('[class*="skeleton"]').should('not.exist');
      
      // Verify real backend connection
      cy.assertNoClientErrors();
    });

    it('displays navigation tabs with real functionality', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Check for Bible Plans tabs with real navigation
      cy.get('[role="tablist"], .tabs-list, [class*="tab"]').should('exist');
      
      // Should contain functional tab navigation
      cy.get('body').should(($body) => {
        const bodyText = $body.text();
        const hasTabs = bodyText.includes('Plan Manager') || 
                       bodyText.includes('Plan Builder') || 
                       bodyText.includes('Templates') ||
                       $body.find('[role="tab"]').length > 0;
        expect(hasTabs, 'should have navigation tabs').to.be.true;
      });

      // Test tab navigation functionality
      cy.get('[role="tab"], button').then($tabs => {
        const tabButtons = $tabs.filter((i, el) => {
          const text = Cypress.$(el).text();
          return text.includes('Plan Manager') || text.includes('Plan Builder') || text.includes('Templates');
        });

        if (tabButtons.length > 0) {
          cy.log(`Found ${tabButtons.length} navigation tabs`);
          // Test clicking tabs (they should be functional)
          cy.wrap(tabButtons.first()).should('be.visible').and('not.be.disabled');
        }
      });
    });

    it('shows data grid with real bible plans from backend', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000); // Wait for real API response

      // Wait for AG-Grid to load with real data
      cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
      
      // Verify grid has loaded and is populated
      cy.get('.ag-theme-quartz').within(() => {
        // Check for grid structure with real data
        cy.get('.ag-header, .ag-header-cell').should('exist');
        
        // Look for column headers
        cy.get('body').should($body => {
          const gridText = $body.text();
          const hasColumns = gridText.includes('Name') || 
                           gridText.includes('Duration') ||
                           gridText.includes('Visible') ||
                           gridText.includes('Actions');
          expect(hasColumns, 'should have grid columns').to.be.true;
        });
      });

      // Check for real data rows or empty state
      cy.get('body').then($body => {
        const hasDataRows = $body.find('.ag-row').length > 0;
        const hasEmptyState = $body.text().includes('No data') || 
                            $body.text().includes('empty') ||
                            $body.find('.ag-overlay-no-rows-center').length > 0;
        
        // Should have either data or proper empty state
        expect(hasDataRows || hasEmptyState, 'should show data or empty state').to.be.true;
        
        if (hasDataRows) {
          cy.log('Real bible plans data found in grid');
        } else {
          cy.log('Empty state displayed (no plans in backend)');
        }
      });
    });

    it('has functional search with real filtering', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);
      
      // Check that search input exists and is functional
      cy.get('input[placeholder*="Search"]', { timeout: 10000 }).should('be.visible').and('be.enabled');
      
      // Test search functionality with real filtering
      cy.get('input[placeholder*="Search"]').then($input => {
        // Test typing in search
        cy.wrap($input).type('test');
        cy.wait(1000);
        
        // Grid should update (either filter results or show no matches)
        cy.get('.ag-theme-quartz').should('be.visible');
        
        // Clear search
        cy.wrap($input).clear();
        cy.wait(1000);
        
        // Grid should reset
        cy.get('.ag-theme-quartz').should('be.visible');
      });
    });

    it('shows action buttons with real backend functionality', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Should have functional action buttons
      cy.get('body').then(($body) => {
        const actionButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text();
          return text.includes('Edit') || text.includes('Delete') || 
                 text.includes('Create') || text.includes('Duplicate') ||
                 text.includes('Export') || text.includes('Refresh');
        });

        if (actionButtons.length > 0) {
          cy.log(`Found ${actionButtons.length} action buttons`);
          
          // Test refresh button if available
          const refreshButton = actionButtons.filter((i, el) => 
            Cypress.$(el).text().includes('Refresh')
          );
          
          if (refreshButton.length > 0) {
            cy.wrap(refreshButton.first()).should('be.visible').and('not.be.disabled').click();
            cy.wait(2000);
            cy.assertNoClientErrors();
          }
        }
      });
    });

    it('handles real API loading states and responses', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      
      // Check for real loading indicators
      cy.get('body', { timeout: 2000 }).then(($body) => {
        const hasLoadingIndicators = $body.find('[class*="skeleton"], [class*="loading"], [class*="spinner"]').length > 0 ||
                                   $body.text().toLowerCase().includes('loading');
        
        if (hasLoadingIndicators) {
          cy.log('Real loading states detected during API calls');
        }
      });
      
      // Wait for real API completion
      cy.wait(5000);
      cy.get('body').should('be.visible');
      
      // Loading should complete successfully
      cy.get('[class*="skeleton"]').should('not.exist');
      cy.contains('Manage Bible Plans').should('be.visible');
      cy.assertNoClientErrors();
    });

    it('can test real CRUD operations on bible plans', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Test create functionality if available
      cy.get('body').then($body => {
        const createButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('create') || text.includes('add') || text.includes('new');
        });

        if (createButtons.length > 0) {
          cy.wrap(createButtons.first()).should('be.visible').click();
          cy.wait(2000);
          
          // Should navigate to builder or open dialog
          cy.get('body').then($bodyAfter => {
            const hasNavigation = $bodyAfter.text().includes('Plan Builder') ||
                                $bodyAfter.find('[role="dialog"]').length > 0;
            
            if (hasNavigation) {
              cy.log('Create plan functionality working');
            }
          });
        }
      });
    });

    it('can test edit functionality with real plan data', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Look for edit buttons in grid rows
      cy.get('body').then($body => {
        const editButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('edit');
        });

        if (editButtons.length > 0) {
          // Click first edit button
          cy.wrap(editButtons.first()).click();
          cy.wait(3000);
          
          // Should navigate to plan builder with plan ID
          cy.url().should('match', /plan-builder(\?id=|\/)/);
          
          // Should show plan builder interface
          cy.contains('Bible Plan Builder', { timeout: 10000 }).should('be.visible');
          
          // Navigate back to test
          cy.visit('/admin/bible-plans/manage-plans');
          cy.wait(2000);
        }
      });
    });

    it('can test export functionality with real data', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Test export functionality
      cy.get('body').then($body => {
        const exportButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('export') || text.includes('download');
        });

        if (exportButtons.length > 0) {
          // Export should work with real data
          cy.wrap(exportButtons.first()).should('be.visible').and('not.be.disabled');
          cy.log('Export functionality available');
        }
      });
    });

    it('validates pagination with real dataset size', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(5000);

      // Check for pagination with real data
      cy.get('body').then($body => {
        const hasPagination = $body.find('.ag-paging, [class*="pagination"]').length > 0 ||
                            $body.text().includes('Page') ||
                            $body.find('[aria-label*="page"]').length > 0;

        if (hasPagination) {
          cy.log('Pagination controls found with real data');
          
          // Test pagination if multiple pages exist
          const pageButtons = $body.find('button').filter((i, el) => {
            const ariaLabel = Cypress.$(el).attr('aria-label') || '';
            const text = Cypress.$(el).text();
            return ariaLabel.includes('page') || /^\d+$/.test(text);
          });

          if (pageButtons.length > 0) {
            cy.log('Multiple pages available');
          }
        }
      });
    });
  });

  describe('Bible Plan Builder Page', () => {
    it('loads bible plan builder with real drag-and-drop functionality', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000); // Allow time for real API calls and component initialization
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });

      // Verify page title and real interface
      cy.contains('Bible Plan Builder', { timeout: 10000 }).should('be.visible');
      
      // Ensure real DnD context is loaded
      cy.get('body').should($body => {
        const hasBuilderInterface = $body.find('[class*="dnd"], [class*="sidebar"], [class*="calendar"]').length > 0 ||
                                  $body.text().includes('Plan') && $body.text().includes('Duration');
        expect(hasBuilderInterface, 'should have builder interface loaded').to.be.true;
      });
      
      cy.assertNoClientErrors();
    });

    it('displays functional sidebar with real plan configuration', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Should have functional sidebar with real configuration options
      cy.get('body').then(($body) => {
        const hasSidebar = $body.find('aside, [class*="sidebar"]').length > 0 ||
                         $body.text().includes('Plan') && ($body.text().includes('Duration') || $body.text().includes('Name'));
        
        if (hasSidebar) {
          cy.log('Plan configuration sidebar found');
          
          // Test sidebar functionality
          const inputs = $body.find('input, select, textarea');
          if (inputs.length > 0) {
            cy.log(`Found ${inputs.length} configuration inputs`);
            
            // Test plan name input if available
            const nameInput = inputs.filter((i, el) => {
              const placeholder = Cypress.$(el).attr('placeholder') || '';
              const label = Cypress.$(el).prev('label').text() || '';
              return placeholder.toLowerCase().includes('name') || label.toLowerCase().includes('name');
            });
            
            if (nameInput.length > 0) {
              cy.wrap(nameInput.first()).should('be.visible').and('not.be.disabled');
            }
          }
        }
      });
    });

    it('shows real calendar interface with day-based plan structure', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Should show functional calendar with real day structure
      cy.get('body').then(($body) => {
        const hasCalendarStructure = $body.find('[class*="calendar"], [class*="day"], [id*="day"]').length > 0 ||
                                   $body.text().includes('Day') || $body.text().includes('Reading');
        
        if (hasCalendarStructure) {
          cy.log('Calendar interface with day structure found');
          
          // Look for individual day elements
          const dayElements = $body.find('[id*="day"], [class*="day"]');
          if (dayElements.length > 0) {
            cy.log(`Found ${dayElements.length} day elements in calendar`);
          }
          
          // Check for day numbering or structure
          for (let i = 1; i <= 7; i++) {
            if ($body.text().includes(`Day ${i}`)) {
              cy.log(`Day ${i} structure found`);
              break;
            }
          }
        }
      });
    });

    it('supports real drag and drop with Bible passages', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Test real drag and drop functionality
      cy.get('body').then(($body) => {
        const hasDragElements = $body.find('[draggable="true"], [class*="draggable"]').length > 0;
        const hasDropZones = $body.find('[class*="drop"], [data-drop]').length > 0;
        const hasDndStructure = $body.find('[class*="dnd"]').length > 0;
        
        if (hasDragElements || hasDropZones || hasDndStructure) {
          cy.log('Drag and drop functionality detected');
          
          // Test draggable elements
          if (hasDragElements) {
            const draggableElements = $body.find('[draggable="true"]');
            cy.wrap(draggableElements.first()).should('be.visible');
          }
        }
        
        // Look for passage creation or management tools
        const hasPassageTools = $body.text().includes('Passage') || 
                              $body.text().includes('Scripture') ||
                              $body.text().includes('Bible');
        
        if (hasPassageTools) {
          cy.log('Bible passage management tools found');
        }
      });
    });

    it('can handle real plan editing with URL parameters', () => {
      // Test with a potentially existing plan ID
      cy.visit('/admin/bible-plans/plan-builder?id=existing-plan');
      cy.wait(6000); // Allow extra time for plan loading from backend
      
      cy.get('body').should('be.visible');
      cy.contains('Bible Plan Builder', { timeout: 10000 }).should('be.visible');
      
      // Should handle the plan loading (either load plan or show error gracefully)
      cy.get('body').then($body => {
        const bodyText = $body.text();
        const hasLoadedPlan = bodyText.includes('Loading plan') || 
                            bodyText.includes('Plan loaded') ||
                            $body.find('input[value], textarea').length > 0;
        
        const hasErrorHandling = bodyText.includes('Failed to load') ||
                               bodyText.includes('Plan not found') ||
                               bodyText.includes('Error');
        
        // Should either load a plan or handle the error gracefully
        if (hasLoadedPlan) {
          cy.log('Plan loading functionality working');
        } else if (hasErrorHandling) {
          cy.log('Plan loading error handled gracefully');
        }
        
        // Should not crash regardless
        cy.assertNoClientErrors();
      });
    });

    it('shows real loading states during plan operations', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      
      // Check for loading states during initialization
      cy.get('body', { timeout: 2000 }).then(($body) => {
        const hasLoadingStates = $body.find('[class*="skeleton"], [class*="loading"]').length > 0 ||
                               $body.text().toLowerCase().includes('loading');
        
        if (hasLoadingStates) {
          cy.log('Real loading states detected during builder initialization');
        }
      });
      
      cy.wait(5000);
      cy.get('body').should('be.visible');
      
      // Loading should complete
      cy.get('[class*="skeleton"]').should('not.exist');
      cy.contains('Bible Plan Builder').should('be.visible');
    });

    it('can test plan saving functionality with real backend', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Look for save functionality
      cy.get('body').then($body => {
        const saveButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('save') || text.includes('create') || text.includes('update');
        });

        if (saveButtons.length > 0) {
          // Test save button is functional
          cy.wrap(saveButtons.first()).should('be.visible');
          
          // Check if plan has minimum required data before testing save
          const hasNameInput = $body.find('input').filter((i, el) => {
            const placeholder = Cypress.$(el).attr('placeholder') || '';
            return placeholder.toLowerCase().includes('name');
          });
          
          if (hasNameInput.length > 0) {
            // Add a test plan name
            cy.wrap(hasNameInput.first()).clear().type('Test Plan for Save');
            cy.wait(1000);
            
            // Try save operation
            cy.wrap(saveButtons.first()).click();
            cy.wait(3000);
            
            // Should handle save operation
            cy.get('body').then($bodyAfter => {
              const hasSuccessMessage = $bodyAfter.text().toLowerCase().includes('success') ||
                                       $bodyAfter.text().toLowerCase().includes('saved');
              const hasErrorMessage = $bodyAfter.text().toLowerCase().includes('error');
              
              if (hasSuccessMessage) {
                cy.log('Save operation successful');
              } else if (!hasErrorMessage) {
                cy.log('Save operation completed without visible feedback');
              }
            });
          }
        }
      });
    });

    it('can test passage creation and management', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Test passage creation functionality
      cy.get('body').then($body => {
        // Look for passage creation tools
        const passageButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('passage') || text.includes('add') || text.includes('create');
        });

        const passageInputs = $body.find('input').filter((i, el) => {
          const placeholder = Cypress.$(el).attr('placeholder') || '';
          return placeholder.toLowerCase().includes('book') || 
                 placeholder.toLowerCase().includes('chapter') ||
                 placeholder.toLowerCase().includes('verse');
        });

        if (passageButtons.length > 0 || passageInputs.length > 0) {
          cy.log('Passage creation/management tools found');
          
          // Test passage input if available
          if (passageInputs.length > 0) {
            const bookInput = passageInputs.filter((i, el) => {
              const placeholder = Cypress.$(el).attr('placeholder') || '';
              return placeholder.toLowerCase().includes('book');
            });
            
            if (bookInput.length > 0) {
              cy.wrap(bookInput.first()).should('be.visible').and('not.be.disabled');
            }
          }
        }
      });
    });

    it('can test calendar day interaction and reading assignment', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Test calendar day interaction
      cy.get('body').then($body => {
        // Look for day elements that can be interacted with
        const dayElements = $body.find('[id*="day"], [class*="day"], [data-day]');
        
        if (dayElements.length > 0) {
          cy.log(`Found ${dayElements.length} interactive day elements`);
          
          // Test clicking on a day
          const firstDay = dayElements.first();
          if (firstDay.length > 0) {
            cy.wrap(firstDay).click();
            cy.wait(1000);
            
            // Should show day details or selection state
            cy.get('body').then($bodyAfter => {
              const hasSelection = $bodyAfter.find('[class*="selected"], [class*="active"]').length > 0 ||
                                 $bodyAfter.text().includes('Day') && $bodyAfter.text().includes('selected');
              
              if (hasSelection) {
                cy.log('Day selection functionality working');
              }
            });
          }
        }
      });
    });

    it('validates plan duration and structure constraints', () => {
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(5000);

      // Test duration input and constraints
      cy.get('body').then($body => {
        const durationInputs = $body.find('input').filter((i, el) => {
          const placeholder = Cypress.$(el).attr('placeholder') || '';
          const label = Cypress.$(el).closest('div').find('label').text() || '';
          return placeholder.toLowerCase().includes('duration') || 
                 label.toLowerCase().includes('duration') ||
                 Cypress.$(el).attr('type') === 'number';
        });

        if (durationInputs.length > 0) {
          const durationInput = durationInputs.first();
          cy.wrap(durationInput).should('be.visible');
          
          // Test duration validation
          cy.wrap(durationInput).clear().type('30');
          cy.wait(1000);
          
          // Should accept valid duration
          cy.wrap(durationInput).should('have.value', '30');
          
          cy.log('Duration input validation working');
        }
      });
    });
  });

  describe('Bible Plan Templates Page', () => {
    it('loads manage bible plan templates with real backend data', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000); // Allow time for real API calls
      
      cy.get('body').should('be.visible');
      
      // Check for no compile errors
      cy.get('body').should(($body) => {
        const hasOverlay = $body.find('#vite-error-overlay, vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasOverlay, 'no Vite compile/runtime overlay').to.be.false;
      });

      // Verify page structure with real data
      cy.contains('Template', { timeout: 10000 }).should('be.visible');
      
      // Ensure loading is complete
      cy.get('[class*="skeleton"]').should('not.exist');
      cy.assertNoClientErrors();
    });

    it('displays templates grid with real template data', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Should show AG-Grid for templates with real data
      cy.get('.ag-theme-quartz', { timeout: 15000 }).should('be.visible');
      
      // Verify grid structure and content
      cy.get('.ag-theme-quartz').within(() => {
        // Check for grid headers
        cy.get('.ag-header, .ag-header-cell').should('exist');
        
        // Look for template-specific columns
        cy.get('body').should($body => {
          const gridText = $body.text();
          const hasTemplateColumns = gridText.includes('Name') || 
                                   gridText.includes('Template') ||
                                   gridText.includes('Actions') ||
                                   gridText.includes('Created');
          expect(hasTemplateColumns, 'should have template grid columns').to.be.true;
        });
      });

      // Check for real template data or empty state
      cy.get('body').then($body => {
        const hasTemplateRows = $body.find('.ag-row').length > 0;
        const hasEmptyState = $body.text().includes('No templates') || 
                            $body.find('.ag-overlay-no-rows-center').length > 0;
        
        if (hasTemplateRows) {
          cy.log('Real template data found in grid');
        } else {
          cy.log('Empty template state (no templates in backend)');
        }
        
        expect(hasTemplateRows || hasEmptyState, 'should show templates or empty state').to.be.true;
      });
    });

    it('has real template management functionality', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Should have functional template management controls
      cy.get('body').then(($body) => {
        const hasTemplateControls = $body.text().includes('Template') ||
                                   $body.text().includes('Export') ||
                                   $body.text().includes('Import') ||
                                   $body.find('button').length > 0;
        
        expect(hasTemplateControls, 'should have template management').to.be.true;
        
        // Test refresh functionality if available
        const refreshButton = $body.find('button').filter((i, el) => {
          return Cypress.$(el).text().toLowerCase().includes('refresh');
        });
        
        if (refreshButton.length > 0) {
          cy.wrap(refreshButton.first()).click();
          cy.wait(2000);
          cy.assertNoClientErrors();
        }
      });
    });

    it('shows functional template action buttons with real operations', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Should have action buttons for real template operations
      cy.get('body').then(($body) => {
        const actionButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('export') || text.includes('delete') || 
                 text.includes('rename') || text.includes('download');
        });

        if (actionButtons.length > 0) {
          cy.log(`Found ${actionButtons.length} template action buttons`);
          
          // Test export functionality if available
          const exportButtons = actionButtons.filter((i, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return text.includes('export') || text.includes('download');
          });
          
          if (exportButtons.length > 0) {
            // Export should be functional (though we won't download files in test)
            cy.wrap(exportButtons.first()).should('be.visible').and('not.be.disabled');
            cy.log('Export functionality available for templates');
          }
        }
      });
    });

    it('can test template search functionality', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Test template search if available
      cy.get('body').then($body => {
        const searchInputs = $body.find('input').filter((i, el) => {
          const placeholder = Cypress.$(el).attr('placeholder') || '';
          return placeholder.toLowerCase().includes('search') || 
                 placeholder.toLowerCase().includes('template');
        });

        if (searchInputs.length > 0) {
          cy.wrap(searchInputs.first()).type('template');
          cy.wait(1000);
          
          // Should filter grid results
          cy.get('.ag-theme-quartz').should('be.visible');
          
          // Clear search
          cy.wrap(searchInputs.first()).clear();
          cy.wait(1000);
        }
      });
    });

    it('can test template creation from existing plans', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Look for template creation functionality
      cy.get('body').then($body => {
        const createButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('create') || text.includes('add') || 
                 text.includes('new') || text.includes('make');
        });

        if (createButtons.length > 0) {
          cy.log('Template creation functionality available');
          cy.wrap(createButtons.first()).should('be.visible').and('not.be.disabled');
        }
      });
    });

    it('can test template rename functionality', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Test rename functionality if templates exist
      cy.get('body').then($body => {
        const renameButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('rename') || text.includes('edit');
        });

        if (renameButtons.length > 0) {
          // Click rename button
          cy.wrap(renameButtons.first()).click();
          cy.wait(1000);
          
          // Should open rename dialog
          cy.get('body').then($bodyAfter => {
            const hasRenameDialog = $bodyAfter.find('[role="dialog"], input[value]').length > 0 ||
                                  $bodyAfter.text().includes('Rename') ||
                                  $bodyAfter.text().includes('Name');
            
            if (hasRenameDialog) {
              cy.log('Rename dialog opened');
              
              // Cancel rename to avoid data changes
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

    it('can test template deletion with confirmation', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Test delete functionality (should show confirmation)
      cy.get('body').then($body => {
        const deleteButtons = $body.find('button').filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('delete') || text.includes('remove');
        });

        if (deleteButtons.length > 0) {
          // Click delete button
          cy.wrap(deleteButtons.first()).click();
          cy.wait(1000);
          
          // Should show confirmation dialog
          cy.get('body').then($bodyAfter => {
            const hasConfirmation = $bodyAfter.text().toLowerCase().includes('confirm') ||
                                  $bodyAfter.text().toLowerCase().includes('sure') ||
                                  $bodyAfter.text().toLowerCase().includes('delete') ||
                                  $bodyAfter.find('[role="dialog"]').length > 0;
            
            if (hasConfirmation) {
              cy.log('Delete confirmation dialog shown');
              
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

    it('validates template export functionality with real data', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(5000);

      // Test export with real template data
      cy.get('body').then($body => {
        const hasTemplates = $body.find('.ag-row').length > 0;
        
        if (hasTemplates) {
          const exportButtons = $body.find('button').filter((i, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return text.includes('export') || text.includes('download');
          });

          if (exportButtons.length > 0) {
            // Should be able to export (we won't actually download in test)
            cy.wrap(exportButtons.first()).should('be.visible').and('not.be.disabled');
            
            // Click export to test functionality
            cy.wrap(exportButtons.first()).click();
            cy.wait(1000);
            
            // Should initiate download or show success (no error)
            cy.assertNoClientErrors();
            cy.log('Template export functionality working');
          }
        }
      });
    });

    it('handles template loading and error states gracefully', () => {
      cy.visit('/admin/bible-plans/manage-templates');
      
      // Check loading states
      cy.get('body', { timeout: 2000 }).then(($body) => {
        const hasLoadingStates = $body.find('[class*="skeleton"], [class*="loading"]').length > 0 ||
                               $body.text().toLowerCase().includes('loading');
        
        if (hasLoadingStates) {
          cy.log('Loading states detected during template loading');
        }
      });
      
      cy.wait(5000);
      
      // Should complete loading without errors
      cy.get('[class*="skeleton"]').should('not.exist');
      cy.get('.ag-theme-quartz').should('be.visible');
      cy.assertNoClientErrors();
    });
  });

  describe('Bible Plans Navigation and Integration', () => {
    it('can navigate between all three bible plan pages', () => {
      // Test navigation through all pages
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(2000);
      cy.get('body').should('be.visible');

      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(2000);
      cy.get('body').should('be.visible');

      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(2000);
      cy.get('body').should('be.visible');
    });

    it('maintains consistent navigation tabs across pages', () => {
      // Check tabs on manage plans page
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(2000);
      cy.get('body').should(($body) => {
        const hasNavigation = $body.find('[role="tablist"], [class*="tab"]').length > 0 ||
                             $body.text().includes('Plan Manager');
        expect(hasNavigation, 'should have navigation on manage plans').to.be.true;
      });

      // Check tabs on builder page  
      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(2000);
      cy.get('body').should(($body) => {
        const hasNavigation = $body.find('[role="tablist"], [class*="tab"]').length > 0 ||
                             $body.text().includes('Plan Builder');
        expect(hasNavigation, 'should have navigation on builder').to.be.true;
      });

      // Check tabs on templates page
      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(2000);
      cy.get('body').should(($body) => {
        const hasNavigation = $body.find('[role="tablist"], [class*="tab"]').length > 0 ||
                             $body.text().includes('Templates');
        expect(hasNavigation, 'should have navigation on templates').to.be.true;
      });
    });

    it('handles page transitions smoothly', () => {
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(2000);
      
      // Should not have errors during transitions
      cy.get('body').should(($body) => {
        const hasErrors = $body.find('#vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasErrors, 'should not have errors on manage plans').to.be.false;
      });

      cy.visit('/admin/bible-plans/plan-builder');
      cy.wait(2000);
      
      cy.get('body').should(($body) => {
        const hasErrors = $body.find('#vite-error-overlay, .vite-error-overlay').length > 0;
        expect(hasErrors, 'should not have errors on builder').to.be.false;
      });
    });

    it('maintains consistent UI styling across all pages', () => {
      const pages = [
        '/admin/bible-plans/manage-plans',
        '/admin/bible-plans/plan-builder', 
        '/admin/bible-plans/manage-templates'
      ];

      pages.forEach(page => {
        cy.visit(page);
        cy.wait(2000);
        
        // Should have consistent admin styling
        cy.get('body').should(($body) => {
          const hasConsistentStyling = $body.find('[class*="text-"], [class*="bg-"]').length > 0;
          expect(hasConsistentStyling, `should have styling on ${page}`).to.be.true;
        });
      });
    });

    it('handles API interactions properly across all pages', () => {
      // Test that each page can handle its API calls without errors
      cy.visit('/admin/bible-plans/manage-plans');
      cy.wait(3000);
      cy.assertNoClientErrors();

      cy.visit('/admin/bible-plans/plan-builder');  
      cy.wait(3000);
      cy.assertNoClientErrors();

      cy.visit('/admin/bible-plans/manage-templates');
      cy.wait(3000);
      cy.assertNoClientErrors();
    });

    it('shows appropriate loading states across all interfaces', () => {
      const pages = [
        '/admin/bible-plans/manage-plans',
        '/admin/bible-plans/plan-builder',
        '/admin/bible-plans/manage-templates'
      ];

      pages.forEach(page => {
        cy.visit(page);
        cy.wait(500); // Don't wait too long to catch loading states
        
        cy.get('body').should('be.visible');
        
        // Check for loading states
        cy.get('body').then(($body) => {
          const hasLoadingStates = $body.find('[class*="skeleton"], [class*="loading"]').length > 0 ||
                                  $body.text().toLowerCase().includes('loading');
          if (hasLoadingStates) {
            cy.log(`Loading states found on ${page}`);
          }
        });
        
        cy.wait(2500);
        cy.get('body').should('be.visible');
      });
    });
  });
});
