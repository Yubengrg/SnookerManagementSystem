const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    console.log('🔧 Initializing Email Service...');
    
    // Debug environment variables
    console.log('📧 Email Configuration:');
    console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✅ Set' : '❌ Missing');
    console.log('EMAIL_APP_PASSWORD:', process.env.EMAIL_APP_PASSWORD ? '✅ Set' : '❌ Missing');
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.error('❌ Missing email configuration! Please check your .env file');
      console.error('Required: EMAIL_USER and EMAIL_APP_PASSWORD');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      },
      debug: true, // Enable debug logging
      logger: true // Enable logging
    });

    // Test connection on startup
    this.testConnection().then(result => {
      if (result.success) {
        console.log('✅ Email service initialized successfully');
      } else {
        console.error('❌ Email service initialization failed:', result.error);
      }
    });
  }

  async sendOTP(email, otp, purpose = 'signup') {
    try {
      console.log('📧 Attempting to send OTP email...');
      console.log('To:', email);
      console.log('OTP:', otp);
      console.log('Purpose:', purpose);
      console.log('From:', process.env.EMAIL_USER);

      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error('Email configuration missing. Please check EMAIL_USER and EMAIL_APP_PASSWORD in .env file');
      }

      const mailOptions = {
        from: `"🇳🇵 Nepal App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: this.getSubject(purpose),
        html: this.generateHTML(otp, purpose)
      };

      console.log('📮 Sending email with options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      });

      const result = await this.transporter.sendMail(mailOptions);

      console.log('✅ Email sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Response:', result.response);

      return {
        success: true,
        messageId: result.messageId,
        provider: 'gmail'
      };

    } catch (error) {
      console.error('❌ Email sending failed:');
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Full error:', error);

      // Provide specific error messages for common issues
      let userMessage = error.message;
      
      if (error.code === 'EAUTH') {
        userMessage = 'Gmail authentication failed. Please check your app password.';
      } else if (error.code === 'ENOTFOUND') {
        userMessage = 'Cannot connect to Gmail servers. Check your internet connection.';
      } else if (error.message.includes('Invalid login')) {
        userMessage = 'Invalid Gmail credentials. Please check EMAIL_USER and EMAIL_APP_PASSWORD.';
      }

      return {
        success: false,
        error: userMessage,
        provider: 'gmail',
        code: error.code
      };
    }
  }

  getSubject(purpose) {
    const subjects = {
      signup: '🇳🇵 Nepal App - Verify Your Account',
      login: '🔐 Nepal App - Login Code', 
      email_verification: '📧 Nepal App - Email Verification',
      password_reset: '🔑 Nepal App - Password Reset'
    };
    return subjects[purpose] || '🇳🇵 Nepal App - Verification Code';
  }

  generateHTML(otp, purpose) {
    return `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f8f9fa;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">🇳🇵 Nepal App</h1>
                <p style="color: #e0e7ff; margin: 8px 0 0 0; font-size: 16px;">
                    ${this.getPurposeText(purpose)}
                </p>
            </div>
            
            <div style="padding: 40px 30px; text-align: center;">
                <h2 style="color: #1a1a1a; margin: 0 0 20px 0;">Your Verification Code</h2>
                
                <div style="background-color: #f8f9fa; border: 2px solid #e5e7eb; border-radius: 12px; padding: 30px; margin: 30px 0;">
                    <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1a1a; font-family: monospace;">
                        ${otp}
                    </div>
                </div>
                
                <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin: 30px 0; text-align: left;">
                    <p style="margin: 0; color: #1e40af; font-size: 14px;">
                        <strong>⚠️ Important:</strong> This code expires in 10 minutes. 
                        Do not share with anyone.
                    </p>
                </div>
                
                ${this.getAdditionalMessage(purpose)}
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                    © ${new Date().getFullYear()} Nepal App • Made with ❤️ for Nepal
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  getPurposeText(purpose) {
    const texts = {
      signup: 'Welcome! Please verify your email to complete registration',
      login: 'Login verification required',
      email_verification: 'Please verify your email address', 
      password_reset: 'Password reset verification'
    };
    return texts[purpose] || 'Email verification';
  }

  getAdditionalMessage(purpose) {
    const messages = {
      signup: `
        <div style="background-color: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 16px; margin: 20px 0; text-align: left;">
          <p style="margin: 0; color: #0c4a6e; font-size: 14px;">
            <strong>Welcome to Nepal App!</strong> 🎉<br>
            Enter this code to verify your email and start using the app.
          </p>
        </div>
      `,
      password_reset: `
        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin: 20px 0; text-align: left;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>Password Reset Request</strong><br>
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
      email_verification: `
        <div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; text-align: left;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">
            <strong>Email Verification</strong><br>
            Complete your account setup by verifying your email address.
          </p>
        </div>
      `
    };
    return messages[purpose] || '';
  }

  // Send general email notification
  async sendNotification(email, subject, message) {
    try {
      console.log('📧 Sending notification email to:', email);

      const result = await this.transporter.sendMail({
        from: `"🇳🇵 Nepal App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🇳🇵 Nepal App - ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🇳🇵 Nepal App</h1>
            </div>
            <div style="background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${message}
            </div>
            <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
              © ${new Date().getFullYear()} Nepal App • Made with ❤️ for Nepal
            </div>
          </div>
        `
      });

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error('Notification email failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Test email configuration
  async testConnection() {
    try {
      console.log('🔍 Testing email service connection...');
      
      if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
        throw new Error('Email configuration missing');
      }

      await this.transporter.verify();
      console.log('✅ Email service connection successful');
      
      return {
        success: true,
        message: 'Email service is properly configured'
      };
    } catch (error) {
      console.error('❌ Email service connection failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Debug method to check configuration
  getConfiguration() {
    return {
      emailUser: process.env.EMAIL_USER ? 'Set' : 'Missing',
      emailPassword: process.env.EMAIL_APP_PASSWORD ? 'Set' : 'Missing',
      service: 'Gmail SMTP'
    };
  }
}

module.exports = new EmailService();