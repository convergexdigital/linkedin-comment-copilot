// content.js - Updated version with backend API integration
(function() {
    console.log("LinkedIn Comment Copilot: Loading");
    
    // Global variables for state management
    let isInitialized = false;
    let commentBoxCheckInterval = null;
    let pendingRequests = new Map(); // Track pending API requests
    
    // Backend API URL - replace with your actual backend URL in production
    const BACKEND_API_URL = "https://your-backend-api.com/api";
    
    // Initialize when document is ready
    if (document.readyState === "complete" || document.readyState === "interactive") {
      initializeExtension();
    } else {
      document.addEventListener("DOMContentLoaded", initializeExtension);
    }
    
    // Main initialization
    function initializeExtension() {
      if (isInitialized) return;
      isInitialized = true;
      
      console.log("LinkedIn Comment Copilot: Initializing extension");
      
      // Initial check for comment boxes
      findAndEnhanceCommentBoxes();
      
      // Set up an interval to periodically check for new comment boxes (LinkedIn loads dynamically)
      commentBoxCheckInterval = setInterval(findAndEnhanceCommentBoxes, 1500);
      
      // Set up mutation observer to detect new comment boxes when DOM changes
      setupMutationObserver();
      
      // Monitor URL changes (LinkedIn is a SPA)
      let lastUrl = location.href;
      new MutationObserver(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          console.log("LinkedIn Comment Copilot: URL changed, re-checking for comment boxes");
          findAndEnhanceCommentBoxes();
        }
      }).observe(document, {subtree: true, childList: true});
      
      // Insert our stylesheet directly
      injectStylesheet();
      
      console.log("LinkedIn Comment Copilot: Initialization complete");
    }
    
    // Set up mutation observer to watch for DOM changes
    function setupMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        // Check if any mutations added new nodes that might be comment boxes
        const shouldCheck = mutations.some(mutation => {
          return mutation.addedNodes.length > 0;
        });
        
        if (shouldCheck) {
          findAndEnhanceCommentBoxes();
        }
      });
      
      // Start observing the document with the configured parameters
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    
    // Find all potential comment boxes and enhance them
    function findAndEnhanceCommentBoxes() {
      // Primary selectors for comment containers
      const containerSelectors = [
        '.comments-comment-box',
        '.comments-comment-box__form-container',
        '.comments-comment-texteditor',
        '.comments-container form',
        '.feed-shared-update-v2__comments-container',
        '.social-details-social-activity form',
        '.comments-comment-box__comment-text'
      ];
      
      // Secondary selectors for textboxes that might be part of comment boxes
      const textboxSelectors = [
        'div[role="textbox"][aria-label*="comment" i]',
        'div[role="textbox"][aria-label*="add a comment" i]',
        'div[contenteditable="true"][aria-label*="comment" i]',
        '.ql-editor[data-placeholder*="comment" i]',
        '.editor-content[aria-label*="comment" i]'
      ];
      
      // Check container selectors first
      containerSelectors.forEach(selector => {
        const containers = document.querySelectorAll(selector);
        containers.forEach(container => {
          if (!container.hasAttribute('data-copilot-processed')) {
            console.log(`LinkedIn Comment Copilot: Found container with selector ${selector}`);
            enhanceCommentBox(container);
          }
        });
      });
      
      // Now check textbox selectors and find their parent containers
      textboxSelectors.forEach(selector => {
        const textboxes = document.querySelectorAll(selector);
        textboxes.forEach(textbox => {
          // Find the closest parent that might be a comment container
          const parent = textbox.closest('.comments-comment-box') || 
                        textbox.closest('.comments-comment-box__form-container') ||
                        textbox.closest('form') ||
                        textbox.parentElement;
          
          if (parent && !parent.hasAttribute('data-copilot-processed')) {
            console.log(`LinkedIn Comment Copilot: Found textbox with selector ${selector}`);
            enhanceCommentBox(parent, textbox);
          }
        });
      });
    }
    
    // Enhance a comment box with our UI
    function enhanceCommentBox(container, textbox = null) {
      try {
        // Mark this container as processed
        container.setAttribute('data-copilot-processed', 'true');
        
        // Find the editable area if not provided
        const editableArea = textbox || 
                           container.querySelector('[contenteditable="true"]') ||
                           container.querySelector('[role="textbox"]') || 
                           container.querySelector('.ql-editor');
        
        if (!editableArea) {
          console.log("LinkedIn Comment Copilot: Could not find editable area in", container);
          return;
        }
        
        // Store original content
        const originalContent = editableArea.innerHTML;
        editableArea.setAttribute('data-original-content', originalContent);
        
        // Create our UI container
        const uiContainer = document.createElement('div');
        uiContainer.className = 'linkedin-comment-copilot-container';
        
        // Create type selector dropdown
        const typeSelector = document.createElement('select');
        typeSelector.className = 'linkedin-comment-type-selector';
        
        // Define comment types
        const commentTypes = [
          { value: 'appreciation', text: '👏 Appreciation' },
          { value: 'question', text: '❓ Question' },
          { value: 'experience', text: '🔄 Experience' },
          { value: 'valueAdd', text: '➕ Value Add' },
          { value: 'agreement', text: '✅ Agreement' }
        ];
        
        // Add options to dropdown
        commentTypes.forEach(type => {
          const option = document.createElement('option');
          option.value = type.value;
          option.textContent = type.text;
          typeSelector.appendChild(option);
        });
        
        // Create length selector dropdown
        const lengthSelector = document.createElement('select');
        lengthSelector.className = 'linkedin-comment-length-selector';
        
        // Define length options
        const lengthOptions = [
          { value: 'brief', text: '5-10 words' },
          { value: 'medium', text: '15-25 words' },
          { value: 'detailed', text: '30-50 words' }
        ];
        
        // Add options to dropdown
        lengthOptions.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.value;
          opt.textContent = option.text;
          if (option.value === 'medium') opt.selected = true;
          lengthSelector.appendChild(opt);
        });
        
        // Find the post/comment button to disable when generating
        const submitButton = findSubmitButton(container);
        
        // Create generate button
        const generateButton = document.createElement('button');
        generateButton.className = 'linkedin-comment-generate-button';
        generateButton.textContent = '✨ Generate';
        generateButton.type = 'button'; // Explicitly set button type to prevent form submission
        
        // Add event listeners to the existing form to prevent submission during generation
        if (container.tagName === 'FORM') {
          container.addEventListener('submit', function(e) {
            // If we're currently generating a comment, prevent form submission
            const uniqueId = editableArea.getAttribute('data-copilot-id');
            if (uniqueId && pendingRequests.has(uniqueId)) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);
        }
        
        generateButton.addEventListener('click', function(event) {
          // Prevent any default actions
          event.preventDefault();
          event.stopPropagation();
          
          // Check if user is logged in
          chrome.storage.local.get(['authToken', 'userEmail'], function(data) {
            if (!data.authToken || !data.userEmail) {
              // User is not logged in, show message
              const errorMessage = "Please log in to use LinkedIn Comment Copilot";
              finishGeneration(editableArea, errorMessage, null, submitButton);
              return;
            }
            
            // Check subscription status for non-free features
            chrome.storage.local.get('subscription', function(subData) {
              // Allow generation to proceed even for free users
              
              // Generate a unique ID for this generation request
              const uniqueId = Date.now().toString();
              editableArea.setAttribute('data-copilot-id', uniqueId);
              
              // Add a loading indicator inside the editable area but don't change its content
              const loadingIndicator = document.createElement('div');
              loadingIndicator.className = 'linkedin-comment-loading';
              loadingIndicator.textContent = 'Generating...';
              
              // Store original content if not already stored
              if (!editableArea.hasAttribute('data-original-content')) {
                editableArea.setAttribute('data-original-content', editableArea.innerHTML);
              }
              
              // Clear the editable area and add our loading indicator
              editableArea.innerHTML = '';
              editableArea.appendChild(loadingIndicator);
              
              // Disable the submit button during generation if found
              if (submitButton) {
                submitButton.disabled = true;
                submitButton.setAttribute('data-original-disabled', submitButton.disabled ? 'true' : 'false');
              }
              
              const commentType = typeSelector.value;
              const commentLength = lengthSelector.value;
              
              // Track this request
              pendingRequests.set(uniqueId, true);
              
              // Generate comment
              generateComment(editableArea, commentType, commentLength, uniqueId, submitButton, data.authToken);
            });
          });
          
          return false;
        });
        
        // Add elements to container
        uiContainer.appendChild(document.createTextNode('Type:'));
        uiContainer.appendChild(typeSelector);
        uiContainer.appendChild(document.createTextNode('Length:'));
        uiContainer.appendChild(lengthSelector);
        uiContainer.appendChild(generateButton);
        
        // Add container after the editable area
        if (editableArea.parentNode) {
          editableArea.parentNode.insertBefore(uiContainer, editableArea.nextSibling);
        } else {
          container.appendChild(uiContainer);
        }
        
        // Add a subtle indicator inside the footer area
        const footer = document.createElement('div');
        footer.className = 'linkedin-comment-footer';
        footer.textContent = 'LinkedIn Comment Copilot Available';
        
        if (uiContainer.parentNode) {
          uiContainer.parentNode.insertBefore(footer, uiContainer.nextSibling);
        }
        
        console.log("LinkedIn Comment Copilot: Enhanced comment box successfully", container);
      } catch (error) {
        console.error("LinkedIn Comment Copilot: Error enhancing comment box", error);
      }
    }
    
    // Find the submit/post button in a comment form
    function findSubmitButton(container) {
      // Common selectors for LinkedIn comment submit buttons
      const buttonSelectors = [
        'button[type="submit"]',
        'button.comments-comment-box__submit-button',
        'button.artdeco-button[type="submit"]',
        'button.comments-comment-texteditor__submitButton',
        'button.artdeco-button--primary',
        'button.comments-comment-box__submit'
      ];
      
      // Try each selector
      for (const selector of buttonSelectors) {
        const button = container.querySelector(selector);
        if (button) return button;
      }
      
      // If not found in the container, try to find it in nearby elements
      const parentForm = container.closest('form');
      if (parentForm) {
        for (const selector of buttonSelectors) {
          const button = parentForm.querySelector(selector);
          if (button) return button;
        }
      }
      
      // Look for any button with "post" or "comment" text
      const buttons = container.querySelectorAll('button');
      for (const button of buttons) {
        const text = button.textContent.toLowerCase();
        if (text.includes('post') || text.includes('comment')) {
          return button;
        }
      }
      
      // If still not found, try the parent container
      if (container.parentElement) {
        const parentButtons = container.parentElement.querySelectorAll('button');
        for (const button of parentButtons) {
          const text = button.textContent.toLowerCase();
          if (text.includes('post') || text.includes('comment')) {
            return button;
          }
        }
      }
      
      return null;
    }
    
    // Generate a comment
    function generateComment(editableArea, commentType, commentLength, uniqueId, submitButton, authToken) {
      console.log(`LinkedIn Comment Copilot: Generating ${commentType} comment of length ${commentLength}`);
      
      // Get post content
      const postContent = extractPostContent();
      
      // Get settings from storage
      chrome.storage.local.get(
        ['commentStyle', 'industry', 'goal', 'customInstructions'],
        function(settings) {
          try {
            // Create request payload
            const payload = {
              commentType: commentType,
              commentLength: commentLength,
              postContent: postContent,
              settings: {
                commentStyle: settings.commentStyle || 'professional',
                industry: settings.industry || 'general',
                goal: settings.goal || 'engage',
                customInstructions: settings.customInstructions || ''
              }
            };
            
            // In a real implementation, this would call your backend API
            // For demonstration, we'll simulate a backend API call
            callBackendAPI('/generate-comment', payload, authToken)
              .then(response => {
                if (response.success) {
                  // Add to comment history
                  saveToCommentHistory(postContent, response.comment);
                  
                  // Update editable area
                  finishGeneration(editableArea, response.comment, uniqueId, submitButton);
                } else {
                  throw new Error(response.error || 'Error generating comment');
                }
              })
              .catch(error => {
                console.error("LinkedIn Comment Copilot: API error", error);
                finishGeneration(editableArea, "Error generating comment. Please try again.", uniqueId, submitButton);
              });
          } catch (error) {
            console.error("LinkedIn Comment Copilot: Error", error);
            finishGeneration(editableArea, "Error generating comment. Please try again.", uniqueId, submitButton);
          }
        }
      );
    }
    
    // Save to comment history
    function saveToCommentHistory(postContent, comment) {
      chrome.storage.local.get('commentHistory', function(data) {
        const history = data.commentHistory || [];
        
        // Add new entry
        history.unshift({
          timestamp: Date.now(),
          postExcerpt: postContent.length > 100 ? postContent.substring(0, 100) + '...' : postContent,
          comment: comment
        });
        
        // Keep only the latest 50 entries
        if (history.length > 50) {
          history.pop();
        }
        
        // Save back to storage
        chrome.storage.local.set({ commentHistory: history });
      });
    }
    
    // Finish the generation process and update the UI
    function finishGeneration(editableArea, text, uniqueId, submitButton) {
      console.log("LinkedIn Comment Copilot: Generation complete:", text);
      
      // Remove this request from pending if uniqueId exists
      if (uniqueId) {
        pendingRequests.delete(uniqueId);
      }
      
      // Update the editable area with the generated text
      // We need to be careful about how we update this to avoid triggering a submit
      editableArea.innerHTML = '';
      
      // If text is error message, show it in red
      if (text.startsWith("Error") || text.startsWith("Please")) {
        const errorSpan = document.createElement('span');
        errorSpan.style.color = 'red';
        errorSpan.textContent = text;
        editableArea.appendChild(errorSpan);
      } else {
        // Otherwise just set the text content
        editableArea.textContent = text;
      }
      
      // Re-enable the submit button if found
      if (submitButton) {
        const wasDisabled = submitButton.getAttribute('data-original-disabled') === 'true';
        submitButton.disabled = wasDisabled;
      }
      
      // Focus the editable area to allow immediate editing if needed
      editableArea.focus();
    }
    
    // Extract post content
    function extractPostContent() {
      // Post content selectors
      const selectors = [
        '.feed-shared-update-v2__description',
        '.feed-shared-text',
        '.feed-shared-update-v2__commentary',
        '.update-components-text',
        '.feed-shared-inline-show-more-text',
        '.feed-shared-update-v2__update-content-text',
        'article .break-words'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent.trim()) {
            return element.textContent.trim();
          }
        }
      }
      
      return "LinkedIn post content";
    }
    
    // Call backend API
    async function callBackendAPI(endpoint, payload, authToken) {
      try {
        // For development/testing, simulate API call
        if (!BACKEND_API_URL.startsWith('http')) {
          // Simulate backend response
          return simulateBackendResponse(endpoint, payload);
        }
        
        // In production, make actual API call
        const response = await fetch(BACKEND_API_URL + endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || response.statusText);
        }
        
        return await response.json();
      } catch (error) {
        console.error("API call error:", error);
        throw error;
      }
    }
    
    // Simulate backend response for development/testing
    function simulateBackendResponse(endpoint, payload) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (endpoint === '/generate-comment') {
            // Simulate AI response based on payload
            let response = '';
            const { commentType, commentLength, postContent, settings } = payload;
            
            // Generate different responses based on comment type
            switch (commentType) {
              case 'appreciation':
                response = "Really appreciate your insights on this topic! Very valuable perspective.";
                break;
              case 'question':
                response = "Have you considered how this approach might work in different industries?";
                break;
              case 'experience':
                response = "I've seen similar results when implementing these strategies at my company.";
                break;
              case 'valueAdd':
                response = "Adding to this, research shows that companies adopting this approach see 30% better outcomes.";
                break;
              case 'agreement':
                response = "Completely agree with your points! This aligns with best practices in the field.";
                break;
              default:
                response = "Great insights shared here. Thanks for posting this!";
            }
            
            // Adjust length
            if (commentLength === 'brief') {
              response = "Excellent insights! Thanks for sharing.";
            } else if (commentLength === 'detailed') {
              response = "I really appreciate you sharing these valuable insights. Your perspective adds significant value to the conversation. I've found similar approaches to be effective in my experience, and it's great to see others advocating for these practices. Would love to discuss further!";
            }
            
            resolve({
              success: true,
              comment: response
            });
          } else {
            resolve({
              success: false,
              error: "Unknown endpoint"
            });
          }
        }, 1000); // Simulate network delay
      });
    }
    
    // Inject custom stylesheet directly
    function injectStylesheet() {
      const style = document.createElement('style');
      style.textContent = `
        .linkedin-comment-copilot-container {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background-color: #f0f4fa;
          border-top: 1px solid #d0e8ff;
          border-radius: 0 0 4px 4px;
          flex-wrap: wrap;
          margin-top: 4px;
          z-index: 1000;
        }
        
        .linkedin-comment-type-selector,
        .linkedin-comment-length-selector {
          padding: 6px 10px;
          border-radius: 16px;
          border: 1px solid #0a66c2;
          background-color: white;
          color: #0a66c2;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          min-width: 120px;
          -webkit-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%230a66c2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
          background-repeat: no-repeat;
          background-position: right 10px top 50%;
          background-size: 10px auto;
          padding-right: 25px;
        }
        
        .linkedin-comment-generate-button {
          background-color: #0a66c2;
          color: white;
          border: none;
          border-radius: 16px;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
          -webkit-appearance: none;
          appearance: none;
        }
        
        .linkedin-comment-generate-button:hover {
          background-color: #004182;
        }
        
        .linkedin-comment-footer {
          font-size: 11px;
          color: #0a66c2;
          text-align: center;
          margin-top: 2px;
          font-weight: 600;
        }
        
        .linkedin-comment-loading {
          color: #555;
          font-style: italic;
        }
        
        @media (max-width: 520px) {
          .linkedin-comment-copilot-container {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `;
      document.head.appendChild(style);
    }
  })();