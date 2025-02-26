// server.js - Backend for LinkedIn Comment Copilot
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/linkedin-copilot', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Models
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  authToken: { type: String, required: true },
  subscriptionStatus: { type: String, default: 'inactive' }, // 'active' or 'inactive'
  subscriptionPlan: { type: String, default: 'free' }, // 'free', 'monthly', 'annual'
  subscriptionExpiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

const User = mongoose.model('User', userSchema);
const OTP = mongoose.model('OTP', otpSchema);

// API keys (should be in environment variables in production)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your_openai_api_key';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'your_claude_api_key';

// Email configuration for OTP
const transporter = nodemailer.createTransport({
  service: 'gmail', // Or your preferred email service
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Helper function for sending OTP
async function sendOTP(email) {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Save OTP to database with expiration time (10 minutes)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);
  
  await OTP.findOneAndDelete({ email }); // Delete any existing OTP
  await OTP.create({ email, otp, expiresAt });
  
  // Send email
  const mailOptions = {
    from: process.env.EMAIL_USER || 'your-email@gmail.com',
    to: email,
    subject: 'Your LinkedIn Comment Copilot OTP',
    text: `Your verification code is: ${otp}\nIt will expire in 10 minutes.`
  };
  
  await transporter.sendMail(mailOptions);
  
  return true;
}

// Middleware to authenticate requests
async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  try {
    const user = await User.findOne({ authToken: token });
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid authentication token' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Authentication error' });
  }
}

// Middleware to check subscription
function checkSubscription(req, res, next) {
  const user = req.user;
  
  // Free users can access basic features
  if (user.subscriptionStatus === 'inactive' || user.subscriptionPlan === 'free') {
    // Set a flag to indicate this is a free user
    req.isFreeUser = true;
    next();
    return;
  }
  
  // Check if subscription has expired
  if (user.subscriptionExpiresAt && new Date() > user.subscriptionExpiresAt) {
    // Update user subscription status
    User.updateOne(
      { _id: user._id },
      { subscriptionStatus: 'inactive' }
    ).catch(err => console.error('Error updating subscription status:', err));
    
    req.isFreeUser = true;
    next();
    return;
  }
  
  // User has active subscription
  req.isFreeUser = false;
  next();
}

// Routes

// Generate comment (protected route)
app.post('/api/generate-comment', authenticateToken, checkSubscription, async (req, res) => {
  try {
    const { commentType, commentLength, postContent, settings } = req.body;
    
    // If user is on free plan, apply limitations if needed
    if (req.isFreeUser) {
      // For example, you could limit certain comment types
      // For demo, we'll let it through with a note
      console.log('Free user generating comment');
    }
    
    // Create the prompt
    const prompt = createPrompt(postContent, settings, commentType, commentLength);
    
    // Choose API based on your preference
    const apiChoice = 'openai'; // or 'claude'
    
    let commentText;
    if (apiChoice === 'claude') {
      commentText = await callClaudeAPI(prompt);
    } else {
      commentText = await callOpenAIAPI(prompt);
    }
    
    // Return the generated comment
    res.json({
      success: true, 
      comment: commentText
    });
  } catch (error) {
    console.error('Error generating comment:', error);
    res.status(500).json({ success: false, error: 'Error generating comment' });
  }
});

// Request OTP
app.post('/api/request-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }
    
    await sendOTP(email);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, error: 'Error sending OTP' });
  }
});

// Verify OTP and login/signup
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp, action } = req.body;
    
    if (!email || !otp || !action) {
      return res.status(400).json({ success: false, error: 'Email, OTP, and action are required' });
    }
    
    // Verify OTP
    const otpRecord = await OTP.findOne({ email, otp });
    
    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ success: false, error: 'Invalid or expired OTP' });
    }
    
    // Delete the used OTP
    await OTP.findByIdAndDelete(otpRecord._id);
    
    // Generate auth token
    const authToken = uuidv4();
    
    // Check if user exists
    let user = await User.findOne({ email });
    
    if (action === 'signup' && user) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    
    if (action === 'login' && !user) {
      return res.status(400).json({ success: false, error: 'User does not exist' });
    }
    
    if (!user) {
      // Create new user
      user = await User.create({
        email,
        authToken,
        subscriptionStatus: 'inactive',
        subscriptionPlan: 'free'
      });
    } else {
      // Update existing user's auth token
      user.authToken = authToken;
      await user.save();
    }
    
    // Return user info
    res.json({
      success: true,
      authToken,
      email: user.email,
      subscription: {
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        expiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, error: 'Error verifying OTP' });
  }
});

// Get user profile (protected route)
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    
    res.json({
      success: true,
      email: user.email,
      subscription: {
        status: user.subscriptionStatus,
        plan: user.subscriptionPlan,
        expiresAt: user.subscriptionExpiresAt
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: 'Error fetching profile' });
  }
});

// Initiate payment (protected route)
app.post('/api/initiate-payment', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    const user = req.user;
    
    if (!plan || (plan !== 'monthly' && plan !== 'annual')) {
      return res.status(400).json({ success: false, error: 'Valid plan is required' });
    }
    
    // In a real implementation, you would integrate with a payment provider like Razorpay
    // Here, we'll just return a redirect URL to a hypothetical payment page
    
    // Generate a payment reference ID
    const paymentRef = uuidv4();
    
    // In a real implementation, store this payment reference in your database
    
    // Return a redirect URL
    res.json({
      success: true,
      redirectUrl: `https://your-payment-gateway.com/pay?ref=${paymentRef}&plan=${plan}&email=${user.email}`
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ success: false, error: 'Error initiating payment' });
  }
});

// Payment webhook (called by payment provider after successful payment)
app.post('/api/payment-webhook', async (req, res) => {
  try {
    // In a real implementation, you would verify this request is coming from your payment provider
    // using signatures or other security measures
    
    const { email, plan, paymentId } = req.body;
    
    // Find the user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update subscription details
    const now = new Date();
    let expiresAt = new Date(now);
    
    if (plan === 'monthly') {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (plan === 'annual') {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    
    user.subscriptionStatus = 'active';
    user.subscriptionPlan = plan;
    user.subscriptionExpiresAt = expiresAt;
    
    await user.save();
    
    // Respond to the webhook
    res.json({ success: true });
    
    // In a real implementation, you might send a confirmation email to the user here
  } catch (error) {
    console.error('Error processing payment webhook:', error);
    res.status(500).json({ success: false, error: 'Error processing payment' });
  }
});

// Helper functions

// Create prompt for AI
function createPrompt(postContent, settings, commentType, commentLength) {
  const style = settings.commentStyle || 'professional';
  const industry = settings.industry || 'general';
  const goal = settings.goal || 'engage';
  const instructions = settings.customInstructions || '';
  
  // Define exact word count requirements
  const lengthRequirements = {
    'brief': 'EXACTLY 5 TO 10 WORDS ONLY',
    'medium': 'EXACTLY 15 TO 25 WORDS ONLY',
    'detailed': 'EXACTLY 30 TO 50 WORDS ONLY'
  };
  
  // Define comment type guidance
  let typeGuidance = '';
  switch(commentType) {
    case 'appreciation':
      typeGuidance = 'Express genuine appreciation for the insights shared in the post.';
      break;
    case 'question':
      typeGuidance = 'Frame your response as an insightful question that builds on the post content.';
      break;
    case 'experience':
      typeGuidance = 'Share a brief relevant personal experience that resonates with the post.';
      break;
    case 'valueAdd':
      typeGuidance = 'Add a complementary piece of information or insight that extends the original post.';
      break;
    case 'agreement':
      typeGuidance = 'Express agreement with the post by providing a supporting example.';
      break;
  }
  
  return `STRICT WORD COUNT: ${lengthRequirements[commentLength]}. NO EXCEPTIONS.

You are writing a LinkedIn comment on this post:

"${postContent}"

Comment type: ${typeGuidance}
Style: ${style}
${industry !== 'general' ? `Industry context: ${industry}` : ''}
${goal !== 'engage' ? `Goal: ${goal}` : ''}
${instructions ? `Personal preferences: ${instructions}` : ''}

IMPORTANT: Your response must be ${lengthRequirements[commentLength]}. COUNT YOUR WORDS BEFORE RESPONDING.

Only provide the comment text - no explanations or other content.`;
}

// Call OpenAI API
async function callOpenAIAPI(prompt) {
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You write brief, natural-sounding LinkedIn comments that strictly follow word count requirements.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      }
    });
    
    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('No response from OpenAI API');
    }
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

// Call Claude API
async function callClaudeAPI(prompt) {
  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 150,
      messages: [
        { role: 'user', content: prompt }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    if (response.data.content && response.data.content.length > 0) {
      return response.data.content[0].text;
    } else {
      throw new Error('No response from Claude API');
    }
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

// Validate email
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});