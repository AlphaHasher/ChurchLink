describe('Public – Live Stream Page', () => {
  beforeEach(() => {
    // SPY on API calls (not mock) - allows live server data through
    cy.intercept('GET', '**/api/v1/youtube/livestreams').as('getStreams');
    cy.intercept('GET', '**/api/v1/youtube/channel_id').as('getChannel');
  });

  afterEach(() => {
    // Wait 0.5 seconds after each test before starting the next one
    cy.wait(500);
  });

  it('displays message when not live', () => {
    cy.visit('/live');
    
    // Wait for API call to complete
    cy.wait('@getStreams', { timeout: 15000 }).then((interception) => {
      const streamData = interception.response?.body;
      const streamIds = streamData?.stream_ids || [];
      
      // Only run this test if not live
      if (streamIds.length === 0) {
        // Wait for loading skeleton to disappear
        cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
        
        // Verify "Not currently live" message is displayed
        cy.contains('We are not currently live!').should('be.visible');
        
        // Verify message about staying tuned
        cy.contains('To keep up with our future streams').should('be.visible');
        
        // Verify YouTube channel link exists and is clickable
        cy.contains('a', 'Go to Channel')
          .should('be.visible')
          .and('have.attr', 'href')
          .and('include', 'youtube.com/channel');
        
        // Verify no stream embed is present
        cy.get('iframe[src*="youtube"]').should('not.exist');
      } else {
        cy.log('Stream is currently live, skipping "not live" test');
      }
    });
  });

  it('displays stream embed when live', () => {
    cy.visit('/live');
    
    // Wait for API call to complete
    cy.wait('@getStreams', { timeout: 15000 }).then((interception) => {
      const streamData = interception.response?.body;
      const streamIds = streamData?.stream_ids || [];
      
      // Only run this test if live
      if (streamIds.length > 0) {
        // Wait for loading skeleton to disappear
        cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
        
        // Verify "We're live!" heading is displayed
        cy.contains("We're live!").should('be.visible');
        
        // Verify StreamViewer component is rendered with iframe
        cy.get('iframe')
          .should('exist')
          .and('be.visible')
          .and('have.attr', 'src')
          .and('include', 'youtube');
        
        // Verify "Watch on YouTube" button exists
        cy.contains('a', 'Watch on YouTube')
          .should('be.visible')
          .and('have.attr', 'href')
          .and('include', 'youtube.com/watch');
        
        // Verify no "not currently live" message
        cy.contains('We are not currently live!').should('not.exist');
        
        // If multiple streams, verify stream selector tabs
        if (streamIds.length > 1) {
          cy.contains('Select which stream to view').should('be.visible');
          cy.get('[role="tablist"]').should('exist');
        }
      } else {
        cy.log('Stream is not currently live, skipping "live" test');
      }
    });
  });

  it('loads page successfully and displays correct component based on live status', () => {
    cy.visit('/live');
    
    // Wait for API calls
    cy.wait('@getStreams', { timeout: 15000 });
    cy.wait('@getChannel', { timeout: 10000 });
    
    // Wait for loading to complete
    cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
    
    // Verify page rendered (not blank)
    cy.get('body').should('be.visible');
    
    // Check what component rendered based on stream data
    cy.get('@getStreams').then((interception: any) => {
      const streamData = interception.response?.body;
      const streamIds = streamData?.stream_ids || [];
      
      if (streamIds.length > 0) {
        // Should show StreamViewer component
        cy.log('Verifying StreamViewer component for live stream');
        cy.contains("We're live!").should('be.visible');
        cy.get('iframe[src*="youtube"]').should('exist').and('be.visible');
      } else {
        // Should show NoStreams component
        cy.log('Verifying NoStreams component for offline status');
        cy.contains('We are not currently live!').should('be.visible');
        cy.contains('a', 'Go to Channel').should('be.visible');
      }
    });
  });

  it('verifies YouTube channel link is accessible', () => {
    cy.visit('/live');
    cy.wait('@getStreams', { timeout: 15000 });
    cy.wait('@getChannel', { timeout: 10000 });
    
    // Wait for loading to complete
    cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
    
    // Verify a YouTube link exists (either channel or watch link)
    cy.get('a[href*="youtube.com"]')
      .should('exist')
      .and('be.visible')
      .and('have.attr', 'target', '_blank')
      .and('have.attr', 'rel')
      .and('include', 'noopener');
  });

  it('handles API response correctly', () => {
    cy.visit('/live');
    
    // Verify API is called
    cy.wait('@getStreams', { timeout: 15000 }).then((interception) => {
      // Verify response structure
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body).to.have.property('stream_ids');
      expect(interception.response?.body.stream_ids).to.be.an('array');
      
      cy.log(`Stream IDs: ${JSON.stringify(interception.response?.body.stream_ids)}`);
    });
    
    cy.wait('@getChannel', { timeout: 10000 }).then((interception) => {
      // Verify channel response structure
      expect(interception.response?.statusCode).to.equal(200);
      expect(interception.response?.body).to.have.property('channel_id');
      
      cy.log(`Channel ID: ${interception.response?.body.channel_id}`);
    });
  });

  it('page is responsive across different viewports', () => {
    cy.visit('/live');
    cy.wait('@getStreams', { timeout: 15000 });
    
    // Test mobile viewport
    cy.viewport('iphone-x');
    cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
    cy.get('body').should('be.visible');
    
    // Verify interactive elements are accessible on mobile
    cy.get('a[href*="youtube"]').should('exist').and('be.visible');
    
    // Test tablet viewport
    cy.viewport('ipad-2');
    cy.get('body').should('be.visible');
    cy.get('a[href*="youtube"]').should('exist').and('be.visible');
    
    // Test desktop viewport
    cy.viewport(1920, 1080);
    cy.get('body').should('be.visible');
    cy.get('a[href*="youtube"]').should('exist').and('be.visible');
  });

  it('stream embed iframe has correct attributes when live', () => {
    cy.visit('/live');
    
    cy.wait('@getStreams', { timeout: 15000 }).then((interception) => {
      const streamData = interception.response?.body;
      const streamIds = streamData?.stream_ids || [];
      
      if (streamIds.length > 0) {
        // Wait for loading to complete
        cy.get('[class*="skeleton"]', { timeout: 10000 }).should('not.exist');
        
        // Verify iframe exists and has correct attributes
        cy.get('iframe[src*="youtube"]')
          .should('exist')
          .and('be.visible')
          .and('have.attr', 'allowfullscreen');
        
        // Verify iframe has allow attribute with autoplay
        cy.get('iframe[src*="youtube"]')
          .should('have.attr', 'allow')
          .and('include', 'autoplay');
      } else {
        cy.log('Stream not live, skipping iframe test');
      }
    });
  });
});
