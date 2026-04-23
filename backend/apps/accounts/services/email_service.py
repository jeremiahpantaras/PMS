from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging
import ssl
import certifi

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails"""
    
    @staticmethod
    def send_welcome_email(user_email: str, user_name: str, password: str, company_name: str) -> bool:
        """
        Send welcome email with auto-generated credentials.
        """
        try:
            subject = f'Welcome to Malasakit EMR Solutions - Your Account Credentials'
            
            # HTML content
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); 
                              color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }}
                    .credentials {{ background: white; padding: 20px; border-radius: 8px; 
                                   margin: 20px 0; border-left: 4px solid #0ea5e9; }}
                    .password {{ font-size: 24px; font-weight: bold; color: #0ea5e9; 
                               letter-spacing: 2px; margin: 10px 0; }}
                    .button {{ display: inline-block; padding: 12px 30px; background: #0ea5e9; 
                             color: white; text-decoration: none; border-radius: 6px; 
                             margin: 20px 0; font-weight: bold; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; 
                              padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ text-align: center; color: #6c757d; font-size: 12px; 
                             margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🎉 Welcome to Malasakit EMR Solutions!</h1>
                        <p>Your Clinic Management System</p>
                    </div>
                    
                    <div class="content">
                        <h2>Hello {user_name},</h2>
                        
                        <p>Your admin account for <strong>{company_name}</strong> has been successfully created!</p>
                        
                        <div class="credentials">
                            <h3>Your Login Credentials:</h3>
                            <p><strong>Email:</strong> {user_email}</p>
                            <p><strong>Temporary Password:</strong></p>
                            <div class="password">{password}</div>
                        </div>
                        
                        <div class="warning">
                            <strong>⚠️ Important Security Notice:</strong>
                            <ul>
                                <li>This is a temporary password</li>
                                <li>Please change it immediately after your first login</li>
                                <li>Never share your password with anyone</li>
                            </ul>
                        </div>
                        
                        <div style="text-align: center;">
                            <a href="{settings.FRONTEND_URL}/login" class="button">
                                Login to Your Account
                            </a>
                        </div>
                        
                        <p>Best regards,<br>
                        <strong>The Malasakit EMR Solutions Team</strong></p>
                    </div>
                    
                    <div class="footer">
                        <p>© 2026 Malasakit EMR Solutions. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text fallback
            plain_message = f"""
            Welcome to Malasakit EMR Solutions!
            
            Hello {user_name},
            
            Your admin account for {company_name} has been created!
            
            Email: {user_email}
            Temporary Password: {password}
            
            Login: {settings.FRONTEND_URL}/login
            
            Best regards,
            Malasakit EMR Solutions Team
            """
            
            # Create email with explicit encoding
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email]
            )
            email.attach_alternative(html_message, "text/html")
            
            # Send with fail_silently=False to catch errors
            email.send(fail_silently=False)
            
            logger.info(f"✅ Welcome email sent to {user_email}")
            return True
            
        except ssl.SSLError as e:
            logger.error(f"❌ SSL Error: {str(e)}")
            logger.error("Fix: Run '/Applications/Python 3.*/Install Certificates.command'")
            return False
            
        except Exception as e:
            logger.error(f"❌ Email error: {str(e)}")
            return False
    
    @staticmethod
    def send_password_reset_email(user_email: str, user_name: str, new_password: str) -> bool:
        """Send a new auto-generated password to the user's email."""
        try:
            subject = 'Malasakit EMR Solutions — Your Password Has Been Reset'

            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
                               color: white; padding: 30px; text-align: center;
                               border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8f9fa; padding: 30px;
                                border-radius: 0 0 10px 10px; }}
                    .credentials {{ background: white; padding: 20px; border-radius: 8px;
                                    margin: 20px 0; border-left: 4px solid #0891b2; }}
                    .password {{ font-size: 26px; font-weight: bold; color: #0891b2;
                                 letter-spacing: 3px; margin: 10px 0; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107;
                                padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .button {{ display: inline-block; padding: 12px 30px;
                               background: #0891b2; color: white; text-decoration: none;
                               border-radius: 6px; margin: 20px 0; font-weight: bold; }}
                    .footer {{ text-align: center; color: #6c757d; font-size: 12px;
                               margin-top: 30px; padding-top: 20px;
                               border-top: 1px solid #dee2e6; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset</h1>
                        <p>Malasakit EMR Solutions</p>
                    </div>
                    <div class="content">
                        <h2>Hello {user_name},</h2>
                        <p>Your password has been <strong>reset successfully</strong>.
                           Use the temporary password below to log in.</p>

                        <div class="credentials">
                            <h3>Your New Temporary Password:</h3>
                            <p><strong>Email:</strong> {user_email}</p>
                            <p><strong>New Password:</strong></p>
                            <div class="password">{new_password}</div>
                        </div>

                        <div class="warning">
                            <strong>⚠️ Important:</strong>
                            <ul>
                                <li>You have been logged out of all active sessions.</li>
                                <li>Log in with this temporary password.</li>
                                <li>You will be prompted to set a new password on next login.</li>
                                <li>Never share your password with anyone.</li>
                            </ul>
                        </div>

                        <div style="text-align:center;">
                            <a href="{settings.FRONTEND_URL}/login" class="button">
                                Login Now
                            </a>
                        </div>

                        <p>If you did not request this reset, contact your administrator
                           immediately.</p>

                        <p>Best regards,<br><strong>The Malasakit EMR Solutions Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>© 2026 Malasakit EMR Solutions. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            plain_message = f"""
            Malasakit EMR Solutions — Password Reset

            Hello {user_name},

            Your password has been reset.

            Email:        {user_email}
            New Password: {new_password}

            Login: {settings.FRONTEND_URL}/login

            You will be prompted to change this password after login.

            Best regards,
            Malasakit EMR Solutions Team
            """

            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email.attach_alternative(html_message, 'text/html')
            email.send(fail_silently=False)

            logger.info(f"✅ Password reset email sent to {user_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Password reset email error: {str(e)}")
            return False

    @staticmethod
    def send_verification_code_email(user_email: str, user_name: str, code: str) -> bool:
        """Send verification code for password reset process."""
        try:
            subject = 'Malasakit EMR Solutions — Password Reset Verification Code'

            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                    .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                    .header {{ background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
                               color: white; padding: 30px; text-align: center;
                               border-radius: 10px 10px 0 0; }}
                    .content {{ background: #f8f9fa; padding: 30px;
                                border-radius: 0 0 10px 10px; }}
                    .code-box {{ background: white; padding: 25px; border-radius: 8px;
                                 margin: 20px 0; text-align: center; border: 2px dashed #0891b2; }}
                    .code {{ font-size: 36px; font-weight: bold; color: #0891b2;
                             letter-spacing: 8px; margin: 15px 0; }}
                    .warning {{ background: #fff3cd; border-left: 4px solid #ffc107;
                                padding: 15px; margin: 20px 0; border-radius: 4px; }}
                    .footer {{ text-align: center; color: #6c757d; font-size: 12px;
                               margin-top: 30px; padding-top: 20px;
                               border-top: 1px solid #dee2e6; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 Password Reset</h1>
                        <p>Malasakit EMR Solutions</p>
                    </div>
                    <div class="content">
                        <h2>Hello {user_name},</h2>
                        <p>You requested to reset your password. Use the verification code below to proceed.</p>

                        <div class="code-box">
                            <p style="margin: 0; color: #666;">Your Verification Code:</p>
                            <div class="code">{code}</div>
                            <p style="margin: 0; color: #666; font-size: 12px;">This code expires in 10 minutes</p>
                        </div>

                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul>
                                <li>Never share this code with anyone.</li>
                                <li>If you didn't request this, please ignore this email.</li>
                            </ul>
                        </div>

                        <p>Best regards,<br><strong>The Malasakit EMR Solutions Team</strong></p>
                    </div>
                    <div class="footer">
                        <p>© 2026 Malasakit EMR Solutions. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
            """

            plain_message = f"""
            Malasakit EMR Solutions — Password Reset Verification Code

            Hello {user_name},

            You requested to reset your password.

            Your Verification Code: {code}

            This code expires in 10 minutes.

            If you didn't request this, please ignore this email.

            Best regards,
            Malasakit EMR Solutions Team
            """

            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email.attach_alternative(html_message, 'text/html')
            email.send(fail_silently=False)

            logger.info(f"✅ Verification code email sent to {user_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Verification code email error: {str(e)}")
            return False