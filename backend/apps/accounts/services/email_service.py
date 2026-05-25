from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import logging
import ssl
import certifi

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails"""

    @staticmethod
    def _build_html(*, icon: str, title: str, accent: str, body_html: str) -> str:
        """Shared email HTML wrapper matching the Malasakit PMS design system."""
        return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>{title}</title>
<!--[if mso]><style>table,td,div,p,a,span{{font-family:Arial,sans-serif!important;}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f8;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
<tr><td style="padding:28px 40px 24px;border-bottom:1px solid #e5e7eb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 12px;"><tr>
<td align="center" style="width:40px;height:40px;background:{accent}15;border-radius:8px;text-align:center;vertical-align:middle;">
<span style="font-size:18px;line-height:40px;">{icon}</span></td></tr></table>
<h1 style="margin:0;font-size:20px;font-weight:700;color:{accent};line-height:1.3;">{title}</h1>
<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Malasakit EMR Solutions</p>
</td></tr></table></td></tr>
<tr><td style="padding:32px 40px;">{body_html}</td></tr>
<tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;text-align:center;">
<p style="margin:0 0 12px;font-size:12px;color:#9ca3af;line-height:1.5;">This email was generated automatically by Malasakit PMS.<br/>Please do not reply directly to this email.</p>
<p style="margin:0;font-size:11px;color:#b0b5bc;">Powered by <strong style="color:#6b7280;font-weight:600;">Malasakit PMS</strong></p>
</td></tr>
</table></td></tr></table></body></html>"""

    @staticmethod
    def send_welcome_email(user_email: str, user_name: str, password: str, company_name: str) -> bool:
        """
        Send welcome email with auto-generated credentials.
        """
        try:
            subject = f'Welcome to Malasakit EMR Solutions - Your Account Credentials'
            
            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">Your admin account for <strong>{company_name}</strong> has been successfully created!</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f9ff;border:1px solid #d0e8f2;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0369a1;margin:0 0 12px;">Your Login Credentials</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Email</p>
<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">{user_email}</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Temporary Password</p>
<p style="font-size:22px;font-weight:700;color:#0ea5e9;letter-spacing:2px;margin:0;">{password}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;margin-bottom:16px;">
<tr><td style="padding:14px 20px;">
<p style="font-size:13px;color:#92400e;font-weight:700;margin:0 0 6px;">&#9888;&#65039; This Password is Temporary</p>
<ul style="font-size:13px;color:#78350f;margin:0;padding-left:18px;line-height:1.8;">
<li>This password works for your <strong>first login only</strong>.</li>
<li>You will be <strong>required to create a new password</strong> immediately after logging in.</li>
<li>You cannot access any part of the platform until the password change is complete.</li>
<li>Never share this temporary password with anyone.</li>
</ul>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td align="center">
<a href="{settings.FRONTEND_URL}/login" style="display:inline-block;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;">Login &amp; Set Your Password</a>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(icon='🎉', title='Welcome to Malasakit EMR Solutions', accent='#0ea5e9', body_html=body)
            
            plain_message = f"""Welcome to Malasakit EMR Solutions!

Hello {user_name},

Your admin account for {company_name} has been created!

Email:             {user_email}
Temporary Password: {password}

⚠ IMPORTANT: This password is temporary.
You will be REQUIRED to create a new password after your first login.
You cannot access any part of the platform until the password change is complete.

Login: {settings.FRONTEND_URL}/login

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""
            
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

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">Your password has been <strong>reset successfully</strong>. Use the temporary password below to log in.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0f766e;margin:0 0 12px;">Your New Temporary Password</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Email</p>
<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">{user_email}</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">New Password</p>
<p style="font-size:22px;font-weight:700;color:#0891b2;letter-spacing:3px;margin:0;">{new_password}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
<p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Important</p>
<p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">You have been logged out of all active sessions. You will be prompted to set a new password on next login. Never share your password.</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td align="center">
<a href="{settings.FRONTEND_URL}/login" style="display:inline-block;background:#0891b2;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;">Login Now</a>
</td></tr></table>
<p style="font-size:13px;color:#6b7280;margin:0 0 16px;">If you did not request this reset, contact your administrator immediately.</p>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(icon='🔐', title='Password Reset', accent='#0891b2', body_html=body)

            plain_message = f"""Malasakit EMR Solutions — Password Reset

Hello {user_name},

Your password has been reset.

Email:        {user_email}
New Password: {new_password}

Login: {settings.FRONTEND_URL}/login

You will be prompted to change this password after login.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

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

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">You requested to reset your password. Use the verification code below to proceed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0fdfa;border:2px dashed #0891b2;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:20px;text-align:center;">
<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">Your Verification Code</p>
<p style="margin:0 0 8px;font-size:32px;font-weight:700;color:#0891b2;letter-spacing:8px;">{code}</p>
<p style="margin:0;font-size:12px;color:#9ca3af;">This code expires in 10 minutes</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
<p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Security Notice</p>
<p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">Never share this code with anyone. If you didn't request this, please ignore this email.</p>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(icon='🔐', title='Password Reset Verification', accent='#0891b2', body_html=body)

            plain_message = f"""Malasakit EMR Solutions — Verification Code

Hello {user_name},

You requested to reset your password.

Your Verification Code: {code}

This code expires in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

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

    @staticmethod
    def send_password_update_confirmation_email(user_email: str, user_name: str) -> bool:
        """
        Send a security notification when a user manually updates their own password
        via Account Settings.  The new password is intentionally NOT included.
        """
        try:
            subject = 'Malasakit EMR Solutions — Your Password Has Been Changed'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">Your account password was successfully changed via Account Settings.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
<p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Did not make this change?</p>
<p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">If you did not update your password, contact your administrator immediately and change your password right away.</p>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(icon='✅', title='Password Changed', accent='#059669', body_html=body)

            plain_message = f"""Malasakit EMR Solutions — Password Changed

Hello {user_name},

Your account password was successfully changed via Account Settings.

If you did not make this change, contact your administrator immediately.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email.attach_alternative(html_message, 'text/html')
            email.send(fail_silently=False)

            logger.info(f"✅ Password update confirmation email sent to {user_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Password update confirmation email error: {str(e)}")
            return False

    @staticmethod
    def send_password_rotation_email(user_email: str, user_name: str, new_password: str) -> bool:
        """
        Send an auto-rotated password to the user via the scheduled rotation cron job.
        Structurally identical to send_password_reset_email but with distinct copy.
        """
        try:
            subject = 'Malasakit EMR Solutions — Scheduled Password Rotation'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">Your password has been automatically rotated as per your security settings.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6d28d9;margin:0 0 12px;">Your New Temporary Password</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Email</p>
<p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">{user_email}</p>
<p style="font-size:13px;color:#6b7280;margin:0 0 4px;">New Password</p>
<p style="font-size:22px;font-weight:700;color:#7c3aed;letter-spacing:3px;margin:0;">{new_password}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
<p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Action Required</p>
<p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">Log in with this temporary password. You will be prompted to set a new password on next login. Never share your password.</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;"><tr><td align="center">
<a href="{settings.FRONTEND_URL}/login" style="display:inline-block;background:#7c3aed;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 32px;border-radius:6px;">Login Now</a>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(icon='🔄', title='Scheduled Password Rotation', accent='#7c3aed', body_html=body)

            plain_message = f"""Malasakit EMR Solutions — Scheduled Password Rotation

Hello {user_name},

Your password has been automatically rotated.

Email:        {user_email}
New Password: {new_password}

Login: {settings.FRONTEND_URL}/login

You will be prompted to change this password after login.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email.attach_alternative(html_message, 'text/html')
            email.send(fail_silently=False)

            logger.info(f"✅ Password rotation email sent to {user_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Password rotation email error: {str(e)}")
            return False

    @staticmethod
    def send_admin_otp_email(user_email: str, user_name: str, otp_code: str, expiration_minutes: int = 5) -> bool:
        """
        Send a 6-digit OTP verification code to a prospective admin during registration.

        Parameters
        ----------
        user_email          : recipient address
        user_name           : display name for the greeting
        otp_code            : 6-digit numeric OTP
        expiration_minutes  : OTP validity window shown in the email (default 5)
        """
        try:
            subject = 'Your Malasakit Verification Code'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
  You requested to create a <strong>Malasakit EMR Solutions</strong> admin account.
  Use the verification code below to confirm your email address.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:8px;margin-bottom:20px;">
<tr><td style="padding:24px;text-align:center;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#0369a1;">
    Your Verification Code
  </p>
  <p style="margin:0 0 10px;font-size:40px;font-weight:700;color:#0ea5e9;letter-spacing:12px;line-height:1.1;">{otp_code}</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    This code expires in <strong>{expiration_minutes} minutes</strong>
  </p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
  <p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Security Notice</p>
  <p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">
    Never share this code with anyone — not even Malasakit support.
    If you did not attempt to register, you can safely ignore this email.
  </p>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">
  Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong>
</p>"""

            html_message = EmailService._build_html(
                icon='🔑',
                title='Email Verification',
                accent='#0ea5e9',
                body_html=body,
            )

            plain_message = f"""Malasakit EMR Solutions — Email Verification

Hello {user_name},

You requested to create an admin account on Malasakit EMR Solutions.

Your Verification Code: {otp_code}

This code expires in {expiration_minutes} minutes.

Never share this code with anyone. If you did not attempt to register, ignore this email.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email.attach_alternative(html_message, 'text/html')
            email.send(fail_silently=False)

            logger.info(f"✅ Admin OTP email sent to {user_email}")
            return True

        except Exception as e:
            logger.error(f"❌ Admin OTP email error: {str(e)}")
            return False

    @staticmethod
    def send_staff_welcome_email(
        user_email: str,
        user_name: str,
        role: str,
        password: str,
        company_name: str,
    ) -> bool:
        """
        Send onboarding email to a newly-created Staff or Practitioner account.

        The temporary password is included so the user can complete first login.
        The email clearly states that the password expires in 48 hours and that
        a mandatory password change is required before any other action.

        Parameters
        ----------
        user_email   : recipient address
        user_name    : full display name
        role         : 'STAFF' | 'PRACTITIONER'
        password     : system-generated temporary password (plain-text, single use)
        company_name : clinic / organisation name shown in the greeting
        """
        role_label = 'Practitioner' if role == 'PRACTITIONER' else 'Staff'

        try:
            subject = f'Welcome to {company_name} — Your Malasakit Account Credentials'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
  Your <strong>{role_label}</strong> account at <strong>{company_name}</strong> has been
  created by an administrator. Use the temporary credentials below to sign in.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#f0f9ff;border:1px solid #d0e8f2;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0369a1;margin:0 0 12px;">
    Your Temporary Login Credentials
  </p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Email</p>
  <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">{user_email}</p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Temporary Password</p>
  <p style="font-size:22px;font-weight:700;color:#0ea5e9;letter-spacing:2px;margin:0;">{password}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;margin-bottom:16px;">
<tr><td style="padding:14px 20px;">
  <p style="font-size:13px;color:#92400e;font-weight:700;margin:0 0 6px;">&#9888;&#65039; Important — Action Required</p>
  <ul style="font-size:13px;color:#78350f;margin:0;padding-left:18px;line-height:1.8;">
    <li>This password is valid for your <strong>first login only</strong> and expires in <strong>48 hours</strong>.</li>
    <li>You will be <strong>required to set a permanent password</strong> immediately after signing in.</li>
    <li>You cannot access any module until the password change is complete.</li>
    <li>Never share this password with anyone.</li>
    <li>If you did not expect this email, contact your clinic administrator immediately.</li>
  </ul>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin-bottom:20px;">
<tr><td align="center">
  <a href="{settings.FRONTEND_URL}/login"
     style="display:inline-block;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;
            text-decoration:none;padding:12px 32px;border-radius:6px;">
    Sign In &amp; Set Your Password
  </a>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">
  Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong>
</p>"""

            html_message = EmailService._build_html(
                icon='👋',
                title=f'Welcome to {company_name}',
                accent='#0ea5e9',
                body_html=body,
            )

            plain_message = f"""Welcome to {company_name} — Malasakit EMR Solutions

Hello {user_name},

Your {role_label} account has been created by an administrator.

Email:             {user_email}
Temporary Password: {password}

⚠ IMPORTANT:
  - This password expires in 48 hours.
  - You MUST set a permanent password immediately after your first login.
  - You cannot access the platform until the password change is complete.
  - Never share this password with anyone.

Sign in: {settings.FRONTEND_URL}/login

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email_msg.attach_alternative(html_message, 'text/html')
            email_msg.send(fail_silently=False)

            logger.info("✅ Staff/Practitioner welcome email sent to %s", user_email)
            return True

        except Exception as e:
            logger.error("❌ Staff welcome email error for %s: %s", user_email, str(e))
            return False

    @staticmethod
    def send_email_change_notification(
        user_email: str,
        user_name: str,
        temp_password: str,
        company_name: str,
    ) -> bool:
        """
        Send to the NEW email address when an admin changes a user's email.

        Delivers temporary credentials so the user can immediately sign in
        with their updated email.  The account is placed in must_change_password
        state, so the first login forces a password change before any other
        action is permitted.

        Parameters
        ----------
        user_email    : new (destination) email address
        user_name     : full display name
        temp_password : system-generated temporary password (plain-text, single use)
        company_name  : clinic / organisation name shown in the greeting
        """
        try:
            subject = f'Your {company_name} account email has been updated'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
  An administrator at <strong>{company_name}</strong> has updated the email address
  linked to your Malasakit account. Your new login email is now
  <strong>{user_email}</strong>.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#f0f9ff;border:1px solid #d0e8f2;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#0369a1;margin:0 0 12px;">
    Your New Login Credentials
  </p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">New Email</p>
  <p style="font-size:14px;font-weight:600;color:#111827;margin:0 0 12px;">{user_email}</p>
  <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Temporary Password</p>
  <p style="font-size:22px;font-weight:700;color:#0ea5e9;letter-spacing:2px;margin:0;">{temp_password}</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;margin-bottom:16px;">
<tr><td style="padding:14px 20px;">
  <p style="font-size:13px;color:#92400e;font-weight:700;margin:0 0 6px;">&#9888;&#65039; Action Required</p>
  <ul style="font-size:13px;color:#78350f;margin:0;padding-left:18px;line-height:1.8;">
    <li>Your <strong>old email address can no longer be used</strong> to log in.</li>
    <li>This temporary password is valid for your <strong>first login only</strong> and expires in <strong>48 hours</strong>.</li>
    <li>You will be <strong>required to set a new permanent password</strong> immediately after signing in.</li>
    <li>Never share this temporary password with anyone.</li>
    <li>If you did not expect this change, contact your clinic administrator immediately.</li>
  </ul>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="margin-bottom:20px;">
<tr><td align="center">
  <a href="{settings.FRONTEND_URL}/login"
     style="display:inline-block;background:#0ea5e9;color:#fff;font-size:14px;font-weight:600;
            text-decoration:none;padding:12px 32px;border-radius:6px;">
    Sign In &amp; Set Your Password
  </a>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">
  Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong>
</p>"""

            html_message = EmailService._build_html(
                icon='✉️',
                title='Email Address Updated',
                accent='#0ea5e9',
                body_html=body,
            )

            plain_message = f"""Your {company_name} Account Email Has Been Updated

Hello {user_name},

An administrator at {company_name} has updated the email address on your Malasakit account.

New Login Email: {user_email}
Temporary Password: {temp_password}

⚠ IMPORTANT:
  - Your OLD email address can no longer be used to log in.
  - This temporary password expires in 48 hours.
  - You MUST set a permanent password immediately after your first login.
  - Never share this temporary password with anyone.
  - If you did not expect this change, contact your clinic administrator immediately.

Sign in: {settings.FRONTEND_URL}/login

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email_msg.attach_alternative(html_message, 'text/html')
            email_msg.send(fail_silently=False)

            logger.info("✅ Email-change notification sent to %s", user_email)
            return True

        except Exception as e:
            logger.error("❌ Email-change notification error for %s: %s", user_email, str(e))
            return False

    @staticmethod
    def send_forgot_password_otp_email(
        user_email: str,
        user_name: str,
        otp_code: str,
        expiration_minutes: int = 5,
    ) -> bool:
        """
        Send a 6-digit OTP verification code for the forgot-password flow.

        Parameters
        ----------
        user_email          : recipient address
        user_name           : display name for the greeting
        otp_code            : 6-digit numeric OTP
        expiration_minutes  : OTP validity window shown in the email (default 5)
        """
        try:
            subject = 'Your Malasakit Password Reset Code'

            body = f"""<h2 style="margin:0 0 8px;font-size:18px;color:#111827;">Hello {user_name},</h2>
<p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
  We received a request to reset the password for your <strong>Malasakit EMR Solutions</strong> account.
  Use the verification code below to continue.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#fdf4ff;border:2px dashed #a855f7;border-radius:8px;margin-bottom:20px;">
<tr><td style="padding:24px;text-align:center;">
  <p style="margin:0 0 8px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#7e22ce;">
    Password Reset Code
  </p>
  <p style="margin:0 0 10px;font-size:40px;font-weight:700;color:#a855f7;letter-spacing:12px;line-height:1.1;">{otp_code}</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;">
    This code expires in <strong>{expiration_minutes} minutes</strong>
  </p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background:#fffbeb;border:1px solid #f5deb3;border-radius:6px;margin-bottom:20px;">
<tr><td style="padding:14px 20px;">
  <p style="font-size:13px;color:#92400e;font-weight:600;margin:0 0 6px;">&#9888;&#65039; Security Notice</p>
  <p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">
    Never share this code with anyone — not even Malasakit support.
    If you did not request a password reset, you can safely ignore this email.
    Your password will <strong>not</strong> be changed unless you complete the process.
  </p>
</td></tr></table>
<p style="font-size:14px;color:#4b5563;margin:0;">Best regards,<br/><strong>The Malasakit EMR Solutions Team</strong></p>"""

            html_message = EmailService._build_html(
                icon='🔐',
                title='Password Reset Verification',
                accent='#a855f7',
                body_html=body,
            )

            plain_message = f"""Malasakit EMR Solutions — Password Reset Code

Hello {user_name},

We received a request to reset your Malasakit account password.

Your Password Reset Code: {otp_code}

This code expires in {expiration_minutes} minutes.

SECURITY NOTICE: Never share this code with anyone.
If you did not request this, please ignore this email — your password will not change.

Best regards,
Malasakit EMR Solutions Team

---
This email was generated automatically by Malasakit PMS.
Please do not reply directly to this email."""

            email_msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[user_email],
            )
            email_msg.attach_alternative(html_message, 'text/html')
            email_msg.send(fail_silently=False)

            logger.info("✅ Forgot-password OTP email sent to %s", user_email)
            return True

        except Exception as e:
            logger.error("❌ Forgot-password OTP email error for %s: %s", user_email, str(e))
            return False