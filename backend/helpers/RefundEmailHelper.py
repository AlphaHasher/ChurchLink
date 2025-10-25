import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, Dict, Any, List
from datetime import datetime
import httpx

# Configuration
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", SMTP_USERNAME)
FROM_NAME = os.getenv("FROM_NAME", "ChurchLink")

# SendGrid Configuration (alternative)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")

# Church/Organization info
CHURCH_NAME = os.getenv("CHURCH_NAME", "Your Church")
CHURCH_WEBSITE = os.getenv("CHURCH_WEBSITE", "https://yourchurch.com")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@yourchurch.com")

class RefundEmailTemplates:
    """Email templates for different refund scenarios"""
    
    @staticmethod
    def refund_request_submitted(user_name: str, event_name: str, amount: float, request_id: str) -> Dict[str, str]:
        """Template for when user submits a refund request"""
        subject = f"Refund Request Submitted - {event_name}"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px 0; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }}
                .amount {{ font-size: 18px; font-weight: bold; color: #28a745; }}
                .request-id {{ font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2>Refund Request Received</h2>
                </div>
                
                <div class="content">
                    <p>Dear {user_name},</p>
                    
                    <p>We have received your refund request for the following event:</p>
                    
                    <p><strong>Event:</strong> {event_name}<br>
                    <strong>Refund Amount:</strong> <span class="amount">${amount:.2f}</span><br>
                    <strong>Request ID:</strong> <span class="request-id">{request_id}</span></p>
                    
                    <p>Your refund request is now being reviewed by our administrators. You will receive email updates as your request is processed.</p>
                    
                    <p><strong>What happens next?</strong></p>
                    <ul>
                        <li>Our team will review your request within 1-2 business days</li>
                        <li>You'll receive an email when your request is approved or if we need additional information</li>
                        <li>If approved, the refund will be processed back to your original payment method</li>
                        <li>Refunds typically take 3-5 business days to appear in your account</li>
                    </ul>
                    
                    <p>Your event registration will remain active until the refund is completed.</p>
                </div>
                
                <div class="footer">
                    <p>Thank you for your patience.</p>
                    <p><strong>{CHURCH_NAME}</strong><br>
                    <a href="{CHURCH_WEBSITE}">{CHURCH_WEBSITE}</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Refund Request Received

Dear {user_name},

We have received your refund request for the following event:

Event: {event_name}
Refund Amount: ${amount:.2f}
Request ID: {request_id}

Your refund request is now being reviewed by our administrators. You will receive email updates as your request is processed.

What happens next?
- Our team will review your request within 1-2 business days
- You'll receive an email when your request is approved or if we need additional information
- If approved, the refund will be processed back to your original payment method
- Refunds typically take 3-5 business days to appear in your account

Your event registration will remain active until the refund is completed.

Thank you for your patience.

{CHURCH_NAME}
{CHURCH_WEBSITE}
        """
        
        return {"subject": subject, "html": html_body, "text": text_body}
    
    @staticmethod
    def refund_approved(user_name: str, event_name: str, amount: float, request_id: str, admin_notes: Optional[str] = None) -> Dict[str, str]:
        """Template for when refund is approved"""
        subject = f"Refund Approved - {event_name}"
        
        admin_section = ""
        if admin_notes and admin_notes.strip():
            admin_section = f"<p><strong>Additional Notes:</strong><br>{admin_notes.replace('\n', '<br>')}</p>"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #d4edda; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px 0; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }}
                .amount {{ font-size: 18px; font-weight: bold; color: #28a745; }}
                .request-id {{ font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; }}
                .success {{ color: #155724; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 class="success">✅ Refund Approved</h2>
                </div>
                
                <div class="content">
                    <p>Dear {user_name},</p>
                    
                    <p>Great news! Your refund request has been approved.</p>
                    
                    <p><strong>Event:</strong> {event_name}<br>
                    <strong>Refund Amount:</strong> <span class="amount">${amount:.2f}</span><br>
                    <strong>Request ID:</strong> <span class="request-id">{request_id}</span></p>
                    
                    {admin_section}
                    
                    <p><strong>Next Steps:</strong></p>
                    <ul>
                        <li>Your refund is being processed automatically via PayPal</li>
                        <li>You should see the refund in your account within 3-5 business days</li>
                        <li>Your event registration will be cancelled once the refund is completed</li>
                        <li>You'll receive a final confirmation email when the refund is processed</li>
                    </ul>
                    
                    <p>If you don't see the refund within 5 business days, please contact us with your request ID.</p>
                </div>
                
                <div class="footer">
                    <p>Thank you for your understanding.</p>
                    <p><strong>{CHURCH_NAME}</strong><br>
                    <a href="{CHURCH_WEBSITE}">{CHURCH_WEBSITE}</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Refund Approved

Dear {user_name},

Great news! Your refund request has been approved.

Event: {event_name}
Refund Amount: ${amount:.2f}
Request ID: {request_id}

{admin_notes if admin_notes else ''}

Next Steps:
- Your refund is being processed automatically via PayPal
- You should see the refund in your account within 3-5 business days
- Your event registration will be cancelled once the refund is completed
- You'll receive a final confirmation email when the refund is processed

If you don't see the refund within 5 business days, please contact us with your request ID.

Thank you for your understanding.

{CHURCH_NAME}
{CHURCH_WEBSITE}
        """
        
        return {"subject": subject, "html": html_body, "text": text_body}
    
    @staticmethod
    def refund_completed(user_name: str, event_name: str, amount: float, request_id: str, completion_method: str = "PayPal") -> Dict[str, str]:
        """Template for when refund is completed"""
        subject = f"Refund Completed - {event_name}"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #d1ecf1; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px 0; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }}
                .amount {{ font-size: 18px; font-weight: bold; color: #17a2b8; }}
                .request-id {{ font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; }}
                .completed {{ color: #0c5460; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 class="completed">✅ Refund Completed</h2>
                </div>
                
                <div class="content">
                    <p>Dear {user_name},</p>
                    
                    <p>Your refund has been successfully processed and completed!</p>
                    
                    <p><strong>Event:</strong> {event_name}<br>
                    <strong>Refund Amount:</strong> <span class="amount">${amount:.2f}</span><br>
                    <strong>Request ID:</strong> <span class="request-id">{request_id}</span><br>
                    <strong>Completion Method:</strong> {completion_method}</p>
                    
                    <p><strong>What this means:</strong></p>
                    <ul>
                        <li>Your refund of ${amount:.2f} has been processed</li>
                        <li>The funds should appear in your account within 3-5 business days</li>
                        <li>Your event registration has been cancelled</li>
                        <li>This completes your refund request</li>
                    </ul>
                    
                    <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                </div>
                
                <div class="footer">
                    <p>Thank you for choosing {CHURCH_NAME}.</p>
                    <p><strong>{CHURCH_NAME}</strong><br>
                    <a href="{CHURCH_WEBSITE}">{CHURCH_WEBSITE}</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Refund Completed

Dear {user_name},

Your refund has been successfully processed and completed!

Event: {event_name}
Refund Amount: ${amount:.2f}
Request ID: {request_id}
Completion Method: {completion_method}

What this means:
- Your refund of ${amount:.2f} has been processed
- The funds should appear in your account within 3-5 business days
- Your event registration has been cancelled
- This completes your refund request

If you have any questions or concerns, please don't hesitate to contact us.

Thank you for choosing {CHURCH_NAME}.

{CHURCH_NAME}
{CHURCH_WEBSITE}
        """
        
        return {"subject": subject, "html": html_body, "text": text_body}
    
    @staticmethod
    def refund_rejected(user_name: str, event_name: str, amount: float, request_id: str, reason: str) -> Dict[str, str]:
        """Template for when refund is rejected"""
        subject = f"Refund Request Update - {event_name}"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #f8d7da; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px 0; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }}
                .amount {{ font-size: 18px; font-weight: bold; color: #dc3545; }}
                .request-id {{ font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; }}
                .warning {{ color: #721c24; }}
                .reason {{ background-color: #fff3cd; padding: 15px; border-radius: 4px; border-left: 4px solid #ffc107; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 class="warning">Refund Request Update</h2>
                </div>
                
                <div class="content">
                    <p>Dear {user_name},</p>
                    
                    <p>We have reviewed your refund request for the following event:</p>
                    
                    <p><strong>Event:</strong> {event_name}<br>
                    <strong>Requested Amount:</strong> <span class="amount">${amount:.2f}</span><br>
                    <strong>Request ID:</strong> <span class="request-id">{request_id}</span></p>
                    
                    <div class="reason">
                        <p><strong>Status Update:</strong></p>
                        <p>{reason}</p>
                    </div>
                    
                    <p>If you have questions about this decision or would like to provide additional information, please contact us at <a href="mailto:{ADMIN_EMAIL}">{ADMIN_EMAIL}</a> with your request ID.</p>
                    
                    <p>Your event registration remains active.</p>
                </div>
                
                <div class="footer">
                    <p>Thank you for your understanding.</p>
                    <p><strong>{CHURCH_NAME}</strong><br>
                    <a href="{CHURCH_WEBSITE}">{CHURCH_WEBSITE}</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
Refund Request Update

Dear {user_name},

We have reviewed your refund request for the following event:

Event: {event_name}
Requested Amount: ${amount:.2f}
Request ID: {request_id}

Status Update:
{reason}

If you have questions about this decision or would like to provide additional information, please contact us at {ADMIN_EMAIL} with your request ID.

Your event registration remains active.

Thank you for your understanding.

{CHURCH_NAME}
{CHURCH_WEBSITE}
        """
        
        return {"subject": subject, "html": html_body, "text": text_body}
    
    @staticmethod
    def admin_new_refund_request(user_name: str, event_name: str, amount: float, request_id: str, reason: str) -> Dict[str, str]:
        """Template for notifying admins of new refund requests"""
        subject = f"New Refund Request - {event_name} - ${amount:.2f}"
        
        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #fff3cd; padding: 20px; text-align: center; border-radius: 8px; }}
                .content {{ padding: 20px 0; }}
                .footer {{ background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 8px; margin-top: 20px; }}
                .amount {{ font-size: 18px; font-weight: bold; color: #856404; }}
                .request-id {{ font-family: monospace; background-color: #e9ecef; padding: 5px 10px; border-radius: 4px; }}
                .urgent {{ color: #856404; }}
                .action-needed {{ background-color: #d1ecf1; padding: 15px; border-radius: 4px; border-left: 4px solid #17a2b8; }}
                .reason {{ background-color: #f8f9fa; padding: 10px; border-radius: 4px; font-style: italic; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 class="urgent">🔔 New Refund Request</h2>
                </div>
                
                <div class="content">
                    <p>A new refund request requires your attention:</p>
                    
                    <p><strong>Requester:</strong> {user_name}<br>
                    <strong>Event:</strong> {event_name}<br>
                    <strong>Amount:</strong> <span class="amount">${amount:.2f}</span><br>
                    <strong>Request ID:</strong> <span class="request-id">{request_id}</span></p>
                    
                    <div class="reason">
                        <p><strong>Reason for Refund:</strong></p>
                        <p>{reason}</p>
                    </div>
                    
                    <div class="action-needed">
                        <p><strong>Action Required:</strong></p>
                        <p>Please review this refund request and take appropriate action (approve/reject) through the admin dashboard.</p>
                        <p>Target response time: 1-2 business days</p>
                    </div>
                </div>
                
                <div class="footer">
                    <p><strong>{CHURCH_NAME} Admin Team</strong></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
New Refund Request

A new refund request requires your attention:

Requester: {user_name}
Event: {event_name}
Amount: ${amount:.2f}
Request ID: {request_id}

Reason for Refund:
{reason}

Action Required:
Please review this refund request and take appropriate action (approve/reject) through the admin dashboard.
Target response time: 1-2 business days

{CHURCH_NAME} Admin Team
        """
        
        return {"subject": subject, "html": html_body, "text": text_body}


async def send_email_smtp(to_email: str, subject: str, html_body: str, text_body: str) -> Dict[str, Any]:
    """Send email using SMTP"""
    try:
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            logging.warning("SMTP credentials not configured")
            return {"success": False, "error": "SMTP not configured"}
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{FROM_NAME} <{FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Add text and HTML parts
        text_part = MIMEText(text_body, 'plain')
        html_part = MIMEText(html_body, 'html')
        
        msg.attach(text_part)
        msg.attach(html_part)
        
        # Send email
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        
        logging.info(f"Email sent successfully to {to_email}")
        return {"success": True, "message": "Email sent successfully"}
        
    except Exception as e:
        logging.error(f"Failed to send email via SMTP: {e}")
        return {"success": False, "error": str(e)}


async def send_email_sendgrid(to_email: str, subject: str, html_body: str, text_body: str) -> Dict[str, Any]:
    """Send email using SendGrid API"""
    try:
        if not SENDGRID_API_KEY:
            logging.warning("SendGrid API key not configured")
            return {"success": False, "error": "SendGrid not configured"}
        
        payload = {
            "personalizations": [
                {
                    "to": [{"email": to_email}],
                    "subject": subject
                }
            ],
            "from": {"email": FROM_EMAIL, "name": FROM_NAME},
            "content": [
                {"type": "text/plain", "value": text_body},
                {"type": "text/html", "value": html_body}
            ]
        }
        
        headers = {
            "Authorization": f"Bearer {SENDGRID_API_KEY}",
            "Content-Type": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                json=payload,
                headers=headers
            )
        
        if response.status_code == 202:
            logging.info(f"Email sent successfully via SendGrid to {to_email}")
            return {"success": True, "message": "Email sent successfully"}
        else:
            logging.error(f"SendGrid error: {response.status_code} - {response.text}")
            return {"success": False, "error": f"SendGrid error: {response.status_code}"}
            
    except Exception as e:
        logging.error(f"Failed to send email via SendGrid: {e}")
        return {"success": False, "error": str(e)}


async def send_refund_email(to_email: str, template_data: Dict[str, str], use_sendgrid: bool = False) -> Dict[str, Any]:
    """
    Send refund email using the configured email provider
    
    Args:
        to_email: Recipient email address
        template_data: Dict with keys: subject, html, text
        use_sendgrid: Whether to use SendGrid instead of SMTP
    """
    try:
        if use_sendgrid and SENDGRID_API_KEY:
            return await send_email_sendgrid(
                to_email, 
                template_data["subject"], 
                template_data["html"], 
                template_data["text"]
            )
        else:
            return await send_email_smtp(
                to_email, 
                template_data["subject"], 
                template_data["html"], 
                template_data["text"]
            )
            
    except Exception as e:
        logging.error(f"Failed to send refund email to {to_email}: {e}")
        return {"success": False, "error": str(e)}


# Convenience functions for specific refund events
async def send_refund_request_confirmation(to_email: str, user_name: str, event_name: str, amount: float, request_id: str) -> Dict[str, Any]:
    """Send confirmation email when refund request is submitted"""
    template_data = RefundEmailTemplates.refund_request_submitted(user_name, event_name, amount, request_id)
    return await send_refund_email(to_email, template_data)


async def send_refund_approved_notification(to_email: str, user_name: str, event_name: str, amount: float, request_id: str, admin_notes: Optional[str] = None) -> Dict[str, Any]:
    """Send notification when refund is approved"""
    template_data = RefundEmailTemplates.refund_approved(user_name, event_name, amount, request_id, admin_notes)
    return await send_refund_email(to_email, template_data)


async def send_refund_completed_notification(to_email: str, user_name: str, event_name: str, amount: float, request_id: str, completion_method: str = "PayPal") -> Dict[str, Any]:
    """Send notification when refund is completed"""
    template_data = RefundEmailTemplates.refund_completed(user_name, event_name, amount, request_id, completion_method)
    return await send_refund_email(to_email, template_data)


async def send_refund_rejected_notification(to_email: str, user_name: str, event_name: str, amount: float, request_id: str, reason: str) -> Dict[str, Any]:
    """Send notification when refund is rejected"""
    template_data = RefundEmailTemplates.refund_rejected(user_name, event_name, amount, request_id, reason)
    return await send_refund_email(to_email, template_data)


async def send_admin_refund_alert(admin_emails: List[str], user_name: str, event_name: str, amount: float, request_id: str, reason: str) -> List[Dict[str, Any]]:
    """Send alert to admins about new refund request"""
    template_data = RefundEmailTemplates.admin_new_refund_request(user_name, event_name, amount, request_id, reason)
    
    results = []
    for admin_email in admin_emails:
        result = await send_refund_email(admin_email, template_data)
        results.append({"email": admin_email, "result": result})
    
    return results