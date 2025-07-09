const emailService = require('./emailService');

// Convert phone number to email for testing
function phoneToEmail(phoneNumber) {
  // Convert +9779812345678 to nepal.9812345678@gmail.com
  const cleaned = phoneNumber.replace(/[^\d]/g, '');
  const withoutCountryCode = cleaned.startsWith('977') ? cleaned.slice(3) : cleaned;
  return `nepal.${withoutCountryCode}@gmail.com`;
}

// Main send OTP function
async function sendOTP(phoneNumber, otp, purpose = 'signup') {
  try {
    console.log('📱 Sending OTP via email for phone:', phoneNumber);
    
    // Convert phone to email format
    const email = phoneToEmail(phoneNumber);
    console.log('📧 Converted to email:', email);
    
    // Send via email service
    const result = await emailService.sendOTP(email, otp, purpose);
    
    if (result.success) {
      console.log('✅ OTP sent successfully to:', email);
    } else {
      console.log('❌ Failed to send OTP:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('💥 SMS Service error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Send custom message
async function sendMessage(phoneNumber, message) {
  try {
    const email = phoneToEmail(phoneNumber);
    
    const result = await emailService.transporter.sendMail({
      from: `"🇳🇵 Nepal App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '📱 Nepal App Message',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>🇳🇵 Nepal App</h2>
          <p>${message}</p>
        </div>
      `
    });

    return {
      success: true,
      messageId: result.messageId,
      provider: 'email'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get service status
function getStatus() {
  return {
    provider: 'email',
    configured: !!(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD),
    type: 'Gmail SMTP'
  };
}

module.exports = {
  sendOTP,
  sendMessage,
  getStatus
};