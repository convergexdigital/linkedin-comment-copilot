// popup.js - Updated version with authentication and subscription
document.addEventListener('DOMContentLoaded', function() {
    console.log("Popup loaded");
    
    // Check if user is logged in
    checkAuthStatus();
    
    // Set up authentication elements
    setupAuthElements();
    
    // Set up tabs
    setupTabs();
    
    // Set up custom option buttons
    setupCustomOptions();
    
    // Save settings when button is clicked
    document.getElementById('saveButton').addEventListener('click', saveSettings);
  });
  
  // Check if user is logged in
  function checkAuthStatus() {
    chrome.storage.local.get(['authToken', 'userEmail', 'subscription'], function(data) {
      if (data.authToken && data.userEmail) {
        // User is logged in
        document.getElementById('main-container').style.display = 'block';
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('subscription-container').style.display = 'none';
        
        // Update user email display
        document.getElementById('current-user-email').textContent = data.userEmail;
        document.getElementById('profile-email').value = data.userEmail;
        
        // Check subscription status
        if (data.subscription && data.subscription.status === 'active') {
          document.getElementById('subscription-badge').textContent = 'Pro';
          document.getElementById('subscription-badge').style.display = 'inline-block';
          
          // Update profile tab subscription info
          document.getElementById('subscription-info').style.display = 'none';
          document.getElementById('pro-subscription-info').style.display = 'block';
          document.getElementById('subscription-status').textContent = 'Active';
          
          // Format and display expiry date
          const expiryDate = new Date(data.subscription.expiresAt);
          document.getElementById('subscription-expiry').textContent = expiryDate.toLocaleDateString();
        } else {
          document.getElementById('subscription-badge').style.display = 'none';
          document.getElementById('subscription-info').style.display = 'block';
          document.getElementById('pro-subscription-info').style.display = 'none';
        }
        
        // Load user settings
        loadSettings();
      } else {
        // User is not logged in
        document.getElementById('main-container').style.display = 'none';
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('subscription-container').style.display = 'none';
      }
    });
  }
  
  // Set up authentication elements
  function setupAuthElements() {
    // Login Form
    document.getElementById('request-otp-button').addEventListener('click', function() {
      const email = document.getElementById('login-email').value.trim();
      if (isValidEmail(email)) {
        // In a real implementation, this would call your backend API to send an OTP
        // For now, we'll simulate it
        simulateSendOTP(email, 'login');
        
        document.getElementById('otp-section').style.display = 'block';
        document.getElementById('request-otp-button').style.display = 'none';
        document.getElementById('login-button').style.display = 'block';
      } else {
        alert('Please enter a valid email address');
      }
    });
    
    document.getElementById('login-button').addEventListener('click', function() {
      const email = document.getElementById('login-email').value.trim();
      const otp = document.getElementById('otp').value.trim();
      
      if (otp) {
        // In a real implementation, this would verify the OTP with your backend
        // For now, we'll simulate it
        simulateVerifyOTP(email, otp, 'login');
      } else {
        alert('Please enter the OTP');
      }
    });
    
    // Signup Form
    document.getElementById('signup-request-otp-button').addEventListener('click', function() {
      const email = document.getElementById('signup-email').value.trim();
      if (isValidEmail(email)) {
        // In a real implementation, this would call your backend API to send an OTP
        simulateSendOTP(email, 'signup');
        
        document.getElementById('signup-otp-section').style.display = 'block';
        document.getElementById('signup-request-otp-button').style.display = 'none';
        document.getElementById('signup-button').style.display = 'block';
      } else {
        alert('Please enter a valid email address');
      }
    });
    
    document.getElementById('signup-button').addEventListener('click', function() {
      const email = document.getElementById('signup-email').value.trim();
      const otp = document.getElementById('signup-otp').value.trim();
      
      if (otp) {
        // In a real implementation, this would verify the OTP with your backend
        simulateVerifyOTP(email, otp, 'signup');
      } else {
        alert('Please enter the OTP');
      }
    });
    
    // Show Login/Signup forms
    document.getElementById('show-signup').addEventListener('click', function() {
      document.getElementById('login-form').style.display = 'none';
      document.getElementById('signup-form').style.display = 'block';
    });
    
    document.getElementById('show-login').addEventListener('click', function() {
      document.getElementById('signup-form').style.display = 'none';
      document.getElementById('login-form').style.display = 'block';
    });
    
    // Logout
    document.getElementById('logout-button').addEventListener('click', function() {
      // Clear auth data
      chrome.storage.local.remove(['authToken', 'userEmail', 'subscription'], function() {
        checkAuthStatus();
      });
    });
    
    // Subscription
    document.getElementById('upgrade-button').addEventListener('click', function() {
      document.getElementById('main-container').style.display = 'none';
      document.getElementById('subscription-container').style.display = 'block';
    });
    
    document.getElementById('back-to-profile').addEventListener('click', function() {
      document.getElementById('subscription-container').style.display = 'none';
      document.getElementById('main-container').style.display = 'block';
    });
    
    document.getElementById('monthly-plan-btn').addEventListener('click', function() {
      // Redirect to payment page or process payment
      simulatePayment('monthly');
    });
    
    document.getElementById('annual-plan-btn').addEventListener('click', function() {
      // Redirect to payment page or process payment
      simulatePayment('annual');
    });
  }
  
  // Tab management
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        // Hide all tab contents
        tabContents.forEach(content => {
          content.style.display = 'none';
        });
        
        // Remove active class from all buttons
        tabButtons.forEach(btn => {
          btn.classList.remove('active');
        });
        
        // Show selected tab content
        const tabId = this.id.replace('Btn', '');
        document.getElementById(tabId).style.display = 'block';
        
        // Add active class to clicked button
        this.classList.add('active');
        
        // Load history if history tab selected
        if (tabId === 'historyTab') {
          loadCommentHistory();
        }
      });
    });
  }
  
  // Load settings from storage
  function loadSettings() {
    chrome.storage.local.get(
      ['commentStyle', 'industry', 'goal', 'customInstructions'], 
      function(data) {
        // Log what was retrieved to verify
        console.log("Retrieved settings from storage:", data);
        
        // Set form values, with defaults if needed
        setFormValues(data);
        
        // Set radio buttons based on stored values
        if (data.industry) {
          const industryRadio = document.querySelector(`input[name="industry"][value="${data.industry}"]`);
          if (industryRadio) {
            industryRadio.checked = true;
          }
        }
        
        if (data.goal) {
          const goalRadio = document.querySelector(`input[name="goal"][value="${data.goal}"]`);
          if (goalRadio) {
            goalRadio.checked = true;
          }
        }
      }
    );
  }
  
  // Set form values
  function setFormValues(data) {
    document.getElementById('commentStyle').value = data.commentStyle || 'professional';
    document.getElementById('customInstructions').value = data.customInstructions || '';
  }
  
  // Save settings
  function saveSettings() {
    console.log("Save button clicked");
    
    // Get values from form
    const settings = {
      commentStyle: document.getElementById('commentStyle').value,
      customInstructions: document.getElementById('customInstructions').value
    };
    
    // Get selected industry
    const industryRadio = document.querySelector('input[name="industry"]:checked');
    const industry = industryRadio ? industryRadio.value : 'general';
    
    // Get selected goal
    const goalRadio = document.querySelector('input[name="goal"]:checked');
    const goal = goalRadio ? goalRadio.value : 'engage';
    
    // Add to settings object
    settings.industry = industry;
    settings.goal = goal;
    
    console.log("Saving settings:", settings);
    
    // Save to Chrome storage
    chrome.storage.local.set(settings, function() {
      console.log("Settings saved to chrome.storage.local");
      
      // Show success message
      showStatusMessage('statusMessage', 'Settings saved successfully!');
    });
  }
  
  // Show status message
  function showStatusMessage(elementId, message) {
    const statusElement = document.getElementById(elementId);
    statusElement.textContent = message;
    statusElement.style.display = 'block';
    
    // Hide after 2 seconds
    setTimeout(function() {
      statusElement.style.display = 'none';
    }, 2000);
  }
  
  // Setup custom options
  function setupCustomOptions() {
    // Add custom industry
    document.getElementById('addIndustryButton').addEventListener('click', function() {
      const customIndustry = document.getElementById('customIndustry').value.trim();
      if (customIndustry) {
        addCustomOption('industry', customIndustry);
        document.getElementById('customIndustry').value = '';
      }
    });
    
    // Add custom goal
    document.getElementById('addGoalButton').addEventListener('click', function() {
      const customGoal = document.getElementById('customGoal').value.trim();
      if (customGoal) {
        addCustomOption('goal', customGoal);
        document.getElementById('customGoal').value = '';
      }
    });
  }
  
  // Add custom option
  function addCustomOption(type, value) {
    const containerID = type === 'industry' ? 'industryOptions' : 'goalOptions';
    const container = document.getElementById(containerID);
    
    // Generate a unique ID
    const id = `${type}-${value.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Create checkbox item
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';
    
    // Create radio input
    const input = document.createElement('input');
    input.type = 'radio';
    input.id = id;
    input.name = type;
    input.value = value.toLowerCase();
    input.checked = true;
    
    // Create label
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = value;
    
    // Append elements
    checkboxItem.appendChild(input);
    checkboxItem.appendChild(label);
    container.appendChild(checkboxItem);
  }
  
  // Comment history
  function loadCommentHistory() {
    const historyList = document.getElementById('commentHistoryList');
    historyList.innerHTML = '';
    
    chrome.storage.local.get('commentHistory', function(data) {
      const history = data.commentHistory || [];
      
      if (history.length === 0) {
        historyList.innerHTML = '<p class="no-history">No comment history yet.</p>';
        return;
      }
      
      history.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'history-item';
        
        const date = new Date(entry.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
        
        item.innerHTML = `
          <div class="history-date">${formattedDate}</div>
          <div class="history-post">${entry.postExcerpt}</div>
          <div class="history-comment">${entry.comment}</div>
          <button class="history-copy">Copy</button>
        `;
        
        // Add copy functionality
        item.querySelector('.history-copy').addEventListener('click', function() {
          navigator.clipboard.writeText(entry.comment).then(function() {
            this.textContent = 'Copied!';
            setTimeout(() => {
              this.textContent = 'Copy';
            }, 1500);
          }.bind(this));
        });
        
        historyList.appendChild(item);
      });
    });
  }
  
  // Helper functions for authentication and payment simulation
  // These would be replaced with actual API calls in production
  
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  function simulateSendOTP(email, type) {
    console.log(`Simulating OTP sent to ${email} for ${type}`);
    
    // In a real implementation, this would call your backend API
    // For demonstration, we'll store the email and a fake OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    chrome.storage.local.set({
      'pendingAuth': {
        email: email,
        otp: otp,
        type: type
      }
    });
    
    // Show a message to the user
    alert(`OTP has been sent to ${email} (For demo purposes, the OTP is: ${otp})`);
  }
  
  function simulateVerifyOTP(email, otp, type) {
    chrome.storage.local.get('pendingAuth', function(data) {
      if (data.pendingAuth && data.pendingAuth.email === email && data.pendingAuth.otp === otp) {
        // OTP verified successfully
        const authData = {
          authToken: 'fake-token-' + Date.now(),
          userEmail: email,
        };
        
        if (type === 'signup') {
          // New user gets free tier
          authData.subscription = {
            status: 'inactive',
            plan: 'free'
          };
        } else {
          // For demo, we'll make existing users have a subscription
          const hasSubscription = Math.random() > 0.5;
          if (hasSubscription) {
            const today = new Date();
            const expiryDate = new Date(today.setMonth(today.getMonth() + 1));
            
            authData.subscription = {
              status: 'active',
              plan: 'monthly',
              expiresAt: expiryDate.toISOString()
            };
          } else {
            authData.subscription = {
              status: 'inactive',
              plan: 'free'
            };
          }
        }
        
        // Save auth data
        chrome.storage.local.set(authData, function() {
          // Remove pending auth
          chrome.storage.local.remove('pendingAuth');
          
          // Update UI
          checkAuthStatus();
        });
      } else {
        alert('Invalid OTP. Please try again.');
      }
    });
  }
  
  function simulatePayment(plan) {
    console.log(`Processing payment for ${plan} plan`);
    
    // In a real implementation, this would redirect to a payment gateway
    // For demo purposes, we'll simulate a successful payment after a delay
    setTimeout(function() {
      // Get current user email
      chrome.storage.local.get('userEmail', function(data) {
        if (data.userEmail) {
          const today = new Date();
          let expiryDate;
          
          if (plan === 'monthly') {
            expiryDate = new Date(today.setMonth(today.getMonth() + 1));
          } else {
            expiryDate = new Date(today.setFullYear(today.getFullYear() + 1));
          }
          
          // Update subscription status
          chrome.storage.local.set({
            'subscription': {
              status: 'active',
              plan: plan,
              expiresAt: expiryDate.toISOString()
            }
          }, function() {
            alert(`Thank you! Your ${plan} subscription has been activated.`);
            document.getElementById('subscription-container').style.display = 'none';
            document.getElementById('main-container').style.display = 'block';
            checkAuthStatus();
          });
        }
      });
    }, 1500);
  }