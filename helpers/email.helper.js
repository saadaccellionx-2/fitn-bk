var nodemailer = require("nodemailer");

// Create transporter using environment variables
// Falls back to hardcoded values for backward compatibility (should be removed in production)
var transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER || "cl9nepay@gmail.com",
    pass: process.env.EMAIL_PASS || "cqmowlohxbkuhptn",
  },
});

// Default from address
const DEFAULT_FROM =
  process.env.EMAIL_FROM || "FITN <cl9nepay@gmail.com>";

/**
 * Original email helper function (backward compatibility)
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email text content
 */
const sendEmail = ({ to, subject, text }) => {
  var mailOptions = {
    from: DEFAULT_FROM,
    to,
    subject,
    text,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.error("Email send error:", error);
      return false;
    } else {
      console.log("Email sent:", info.response);
      return true;
    }
  });
};

/**
 * Generate HTML email template for password reset
 * @param {Object} options - Email options
 * @param {string} options.resetUrl - Password reset URL
 * @param {string} options.userName - User's name or email
 * @returns {string} HTML email content
 */
const generatePasswordResetEmailHTML = ({ resetUrl, userName }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background-color: #000000; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #24FF96; font-size: 28px; font-weight: bold;">FITN</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #000000; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.5;">
                                Hello ${userName || "there"},
                            </p>
                            <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.5;">
                                We received a request to reset your password. Click the button below to create a new password. This link will expire in 12 hours.
                            </p>
                            <table role="presentation" style="width: 100%; margin: 30px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #24FF96; color: #000000; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 30px 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
                                If the button doesn't work, copy and paste this link into your browser:
                            </p>
                            <p style="margin: 10px 0 0; color: #24FF96; font-size: 14px; word-break: break-all;">
                                ${resetUrl}
                            </p>
                            <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                                If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f5f5f5; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #999999; font-size: 12px;">
                                © ${new Date().getFullYear()} FITN. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};

/**
 * Send password reset email with HTML template
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.resetUrl - Password reset URL
 * @param {string} options.userName - User's name or email
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetEmail = ({ to, resetUrl, userName }) => {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from: DEFAULT_FROM,
      to,
      subject: "Reset Your FITN Password",
      html: generatePasswordResetEmailHTML({ resetUrl, userName }),
      text: `Reset Your FITN Password\n\nHello ${userName || "there"},\n\nWe received a request to reset your password. Click the link below to create a new password. This link will expire in 12 hours.\n\n${resetUrl}\n\nIf you didn't request a password reset, you can safely ignore this email. Your password will not be changed.\n\n© ${new Date().getFullYear()} FITN. All rights reserved.`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Password reset email send error:", error);
        reject(error);
      } else {
        console.log("Password reset email sent:", info.response);
        resolve(true);
      }
    });
  });
};

/**
 * Generate HTML email template for password reset confirmation
 * @param {Object} options - Email options
 * @param {string} options.userName - User's name or email
 * @returns {string} HTML email content
 */
const generatePasswordResetConfirmationEmailHTML = ({ userName }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset Successful</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; background-color: #000000; border-radius: 8px 8px 0 0;">
                            <h1 style="margin: 0; color: #24FF96; font-size: 28px; font-weight: bold;">FITN</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <h2 style="margin: 0 0 20px; color: #000000; font-size: 24px; font-weight: 600;">Password Reset Successful</h2>
                            <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.5;">
                                Hello ${userName || "there"},
                            </p>
                            <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.5;">
                                Your password has been successfully reset. If you did not make this change, please contact our support team immediately.
                            </p>
                            <div style="background-color: #f0f9ff; border-left: 4px solid #24FF96; padding: 16px; margin: 30px 0; border-radius: 4px;">
                                <p style="margin: 0; color: #333333; font-size: 14px; line-height: 1.5;">
                                    <strong>Security Tip:</strong> For your account security, make sure to use a strong, unique password that you don't use elsewhere.
                                </p>
                            </div>
                            <p style="margin: 30px 0 0; color: #999999; font-size: 12px; line-height: 1.5;">
                                If you did not reset your password, please contact our support team immediately to secure your account.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 20px 40px; background-color: #f5f5f5; border-radius: 0 0 8px 8px; text-align: center;">
                            <p style="margin: 0; color: #999999; font-size: 12px;">
                                © ${new Date().getFullYear()} FITN. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};

/**
 * Send password reset confirmation email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.userName - User's name or email
 * @returns {Promise<boolean>} Success status
 */
const sendPasswordResetConfirmationEmail = ({ to, userName }) => {
  return new Promise((resolve, reject) => {
    const mailOptions = {
      from: DEFAULT_FROM,
      to,
      subject: "Your FITN Password Has Been Reset",
      html: generatePasswordResetConfirmationEmailHTML({ userName }),
      text: `Your FITN Password Has Been Reset\n\nHello ${userName || "there"},\n\nYour password has been successfully reset. If you did not make this change, please contact our support team immediately.\n\nSecurity Tip: For your account security, make sure to use a strong, unique password that you don't use elsewhere.\n\nIf you did not reset your password, please contact our support team immediately to secure your account.\n\n© ${new Date().getFullYear()} FITN. All rights reserved.`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.error("Password reset confirmation email send error:", error);
        reject(error);
      } else {
        console.log("Password reset confirmation email sent:", info.response);
        resolve(true);
      }
    });
  });
};

// Export all functions
module.exports = sendEmail;
module.exports.sendPasswordResetEmail = sendPasswordResetEmail;
module.exports.sendPasswordResetConfirmationEmail = sendPasswordResetConfirmationEmail;
