import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum
import traceback
import os

class AuditEventType(Enum):
    """Enumeration of audit event types for payment operations"""
    # Event Payment Operations
    PAYMENT_ORDER_CREATED = "payment_order_created"
    PAYMENT_ORDER_FAILED = "payment_order_failed"
    PAYMENT_COMPLETED = "payment_completed"
    PAYMENT_FAILED = "payment_failed"
    REGISTRATION_STARTED = "registration_started"
    REGISTRATION_COMPLETED = "registration_completed"
    REGISTRATION_FAILED = "registration_failed"
    
    # General PayPal Operations
    PAYPAL_ORDER_CREATED = "paypal_order_created"
    PAYPAL_ORDER_FAILED = "paypal_order_failed"
    PAYPAL_PAYMENT_CAPTURED = "paypal_payment_captured"
    PAYPAL_PAYMENT_FAILED = "paypal_payment_failed"
    DONATION_CREATED = "donation_created"
    DONATION_COMPLETED = "donation_completed"
    DONATION_FAILED = "donation_failed"
    SUBSCRIPTION_CREATED = "subscription_created"
    SUBSCRIPTION_EXECUTED = "subscription_executed"
    SUBSCRIPTION_CANCELLED = "subscription_cancelled"
    
    # Form Payment Operations
    FORM_PAYMENT_STARTED = "form_payment_started"
    FORM_PAYMENT_COMPLETED = "form_payment_completed"
    FORM_PAYMENT_FAILED = "form_payment_failed"
    FORM_SUBMISSION_CREATED = "form_submission_created"
    
    # Security and Access Control
    ACCESS_DENIED = "access_denied"
    VALIDATION_FAILED = "validation_failed"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    FAMILY_MEMBER_ACCESS = "family_member_access"
    BULK_PAYMENT_REQUEST = "bulk_payment_request"
    
    # Transaction Management
    TRANSACTION_RECORDED = "transaction_recorded"
    TRANSACTION_FAILED = "transaction_failed"
    
    # Financial Reporting and Analytics
    TRANSACTION_QUERY = "transaction_query"
    TRANSACTION_DETAIL_ACCESS = "transaction_detail_access"
    FINANCIAL_REPORT_ACCESS = "financial_report_access"
    FINANCIAL_ANALYTICS_QUERY = "financial_analytics_query"

class AuditSeverity(Enum):
    """Audit event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class PaymentAuditLogger:
    """Centralized audit logging for payment operations with security focus"""
    
    def __init__(self):
        # Create dedicated audit logger
        self.logger = logging.getLogger("payment_audit")
        self.logger.setLevel(logging.INFO)
        
        # Ensure we don't duplicate logs
        if not self.logger.handlers:
            # Create file handler for audit logs
            audit_log_file = os.path.join("logs", "payment_audit.log")
            os.makedirs(os.path.dirname(audit_log_file), exist_ok=True)
            
            file_handler = logging.FileHandler(audit_log_file)
            file_handler.setLevel(logging.INFO)
            
            # Create console handler for immediate visibility
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.WARNING)
            
            # Create structured formatter
            formatter = logging.Formatter(
                '%(asctime)s | %(levelname)s | %(message)s',
                datefmt='%Y-%m-%d %H:%M:%S'
            )
            
            file_handler.setFormatter(formatter)
            console_handler.setFormatter(formatter)
            
            self.logger.addHandler(file_handler)
            self.logger.addHandler(console_handler)
    
    def _create_audit_record(
        self,
        event_type: AuditEventType,
        user_uid: Optional[str],
        event_id: Optional[str],
        severity: AuditSeverity = AuditSeverity.INFO,
        message: str = "",
        details: Optional[Dict[str, Any]] = None,
        request_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        error: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a structured audit record"""
        
        audit_record = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "event_type": event_type.value,
            "severity": severity.value,
            "message": message,
            "user_uid": user_uid,
            "event_id": event_id,
            "request_ip": request_ip,
            "user_agent": user_agent,
            "session_id": None,  # Could be added if session tracking is implemented
            "details": details or {},
        }
        
        if error:
            audit_record["error"] = error
            audit_record["stack_trace"] = traceback.format_exc() if severity in [AuditSeverity.ERROR, AuditSeverity.CRITICAL] else None
        
        return audit_record
    
    def log_payment_order_created(
        self,
        user_uid: str,
        event_id: str,
        registration_count: int,
        total_amount: float,
        payment_method: str = "paypal",
        request_ip: Optional[str] = None
    ):
        """Log successful payment order creation"""
        record = self._create_audit_record(
            event_type=AuditEventType.PAYMENT_ORDER_CREATED,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.INFO,
            message=f"Payment order created for {registration_count} registrations totaling ${total_amount}",
            details={
                "registration_count": registration_count,
                "total_amount": total_amount,
                "payment_method": payment_method,
                "currency": "USD"
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))
    
    def log_payment_completed(
        self,
        user_uid: str,
        event_id: str,
        payment_id: str,
        amount: float,
        successful_registrations: int,
        failed_registrations: int,
        request_ip: Optional[str] = None
    ):
        """Log successful payment completion"""
        record = self._create_audit_record(
            event_type=AuditEventType.PAYMENT_COMPLETED,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.INFO,
            message=f"Payment {payment_id} completed: {successful_registrations} successful, {failed_registrations} failed registrations",
            details={
                "payment_id": payment_id,
                "amount": amount,
                "successful_registrations": successful_registrations,
                "failed_registrations": failed_registrations,
                "success_rate": successful_registrations / (successful_registrations + failed_registrations) if (successful_registrations + failed_registrations) > 0 else 0
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))
    
    def log_access_denied(
        self,
        user_uid: Optional[str],
        event_id: str,
        reason: str,
        attempted_action: str,
        request_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log access denied events for security monitoring"""
        record = self._create_audit_record(
            event_type=AuditEventType.ACCESS_DENIED,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.WARNING,
            message=f"Access denied for {attempted_action}: {reason}",
            details={
                "attempted_action": attempted_action,
                "denial_reason": reason
            },
            request_ip=request_ip,
            user_agent=user_agent
        )
        self.logger.warning(json.dumps(record))
    
    def log_validation_failed(
        self,
        user_uid: Optional[str],
        event_id: Optional[str],
        validation_errors: list,
        validation_type: str,
        request_ip: Optional[str] = None
    ):
        """Log validation failures for security monitoring"""
        record = self._create_audit_record(
            event_type=AuditEventType.VALIDATION_FAILED,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.WARNING,
            message=f"{validation_type} validation failed: {len(validation_errors)} errors",
            details={
                "validation_type": validation_type,
                "error_count": len(validation_errors),
                "errors": validation_errors[:10]  # Limit to first 10 errors to prevent log bloat
            },
            request_ip=request_ip
        )
        self.logger.warning(json.dumps(record))
    
    def log_suspicious_activity(
        self,
        user_uid: Optional[str],
        event_id: Optional[str],
        activity_type: str,
        details: Dict[str, Any],
        request_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log suspicious activities for security alerting"""
        record = self._create_audit_record(
            event_type=AuditEventType.SUSPICIOUS_ACTIVITY,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.CRITICAL,
            message=f"Suspicious activity detected: {activity_type}",
            details=details,
            request_ip=request_ip,
            user_agent=user_agent
        )
        self.logger.critical(json.dumps(record))
    
    def log_family_member_access(
        self,
        user_uid: str,
        family_member_id: str,
        family_member_name: str,
        access_granted: bool,
        reason: str,
        request_ip: Optional[str] = None
    ):
        """Log family member access attempts"""
        severity = AuditSeverity.INFO if access_granted else AuditSeverity.WARNING
        record = self._create_audit_record(
            event_type=AuditEventType.FAMILY_MEMBER_ACCESS,
            user_uid=user_uid,
            event_id=None,
            severity=severity,
            message=f"Family member access {'granted' if access_granted else 'denied'}: {family_member_name}",
            details={
                "family_member_id": family_member_id,
                "family_member_name": family_member_name,
                "access_granted": access_granted,
                "reason": reason
            },
            request_ip=request_ip
        )
        
        if access_granted:
            self.logger.info(json.dumps(record))
        else:
            self.logger.warning(json.dumps(record))
    
    def log_transaction_recorded(
        self,
        user_uid: str,
        event_id: str,
        transaction_id: str,
        amount: float,
        transaction_type: str,
        success: bool,
        error: Optional[str] = None
    ):
        """Log transaction recording events"""
        severity = AuditSeverity.INFO if success else AuditSeverity.ERROR
        record = self._create_audit_record(
            event_type=AuditEventType.TRANSACTION_RECORDED,
            user_uid=user_uid,
            event_id=event_id,
            severity=severity,
            message=f"Transaction {transaction_id} {'recorded successfully' if success else 'recording failed'}",
            details={
                "transaction_id": transaction_id,
                "amount": amount,
                "transaction_type": transaction_type,
                "success": success
            },
            error=error
        )
        
        if success:
            self.logger.info(json.dumps(record))
        else:
            self.logger.error(json.dumps(record))
    
    def log_error(
        self,
        event_type: AuditEventType,
        user_uid: Optional[str],
        event_id: Optional[str],
        error_message: str,
        exception: Optional[Exception] = None,
        request_ip: Optional[str] = None
    ):
        """Log errors in payment operations"""
        record = self._create_audit_record(
            event_type=event_type,
            user_uid=user_uid,
            event_id=event_id,
            severity=AuditSeverity.ERROR,
            message=f"Payment operation error: {error_message}",
            details={
                "error_type": type(exception).__name__ if exception else "Unknown",
                "error_message": str(exception) if exception else error_message
            },
            request_ip=request_ip,
            error=str(exception) if exception else error_message
        )
        self.logger.error(json.dumps(record))
    
    def log_bulk_payment_request(
        self,
        user_uid: str,
        event_id: str,
        registration_count: int,
        total_amount: float,
        validation_passed: bool,
        validation_errors: Optional[list] = None,
        request_ip: Optional[str] = None
    ):
        """Log bulk payment requests for monitoring"""
        severity = AuditSeverity.INFO if validation_passed else AuditSeverity.WARNING
        record = self._create_audit_record(
            event_type=AuditEventType.BULK_PAYMENT_REQUEST,
            user_uid=user_uid,
            event_id=event_id,
            severity=severity,
            message=f"Bulk payment request: {registration_count} registrations, ${total_amount}, validation {'passed' if validation_passed else 'failed'}",
            details={
                "registration_count": registration_count,
                "total_amount": total_amount,
                "validation_passed": validation_passed,
                "validation_errors": validation_errors[:5] if validation_errors else None,  # Limit errors
                "amount_per_registration": total_amount / registration_count if registration_count > 0 else 0
            },
            request_ip=request_ip
        )
        
        if validation_passed:
            self.logger.info(json.dumps(record))
        else:
            self.logger.warning(json.dumps(record))

    # PayPal-specific logging methods
    def log_paypal_order_created(
        self,
        user_email: Optional[str],
        amount: float,
        fund_name: str,
        payment_method: str = "paypal",
        payment_id: Optional[str] = None,
        request_ip: Optional[str] = None
    ):
        """Log PayPal order creation for donations"""
        record = self._create_audit_record(
            event_type=AuditEventType.PAYPAL_ORDER_CREATED,
            user_uid=None,  # PayPal donations may not have user_uid
            event_id=None,
            severity=AuditSeverity.INFO,
            message=f"PayPal order created for ${amount} donation to {fund_name}",
            details={
                "amount": amount,
                "fund_name": fund_name,
                "payment_method": payment_method,
                "payment_id": payment_id,
                "user_email": user_email,
                "currency": "USD"
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))
    
    def log_registration_completed(self, user_uid: str, event_id: str, registration_count: int, payment_id: str, total_amount: float, request_ip: Optional[str] = None):
        """Log when a bulk registration is completed after payment"""
        self.logger.info(
            f"Bulk registration completed - User: {user_uid}, Event: {event_id}, "
            f"Count: {registration_count}, PaymentID: {payment_id}, Amount: ${total_amount:.2f}, "
            f"IP: {request_ip or 'unknown'}"
        )
    
        # You might also want to add this to your audit trail database if you're storing audit logs
        audit_entry = {
            "event_type": "registration_completed",
            "user_uid": user_uid,
            "event_id": event_id,
            "registration_count": registration_count,
            "payment_id": payment_id,
            "total_amount": total_amount,
            "request_ip": request_ip,
            "timestamp": datetime.now().isoformat()
    }

    def log_donation_completed(
        self,
        user_email: str,
        amount: float,
        fund_name: str,
        payment_id: str,
        donor_name: Optional[str] = None,
        transaction_type: str = "one-time",
        request_ip: Optional[str] = None
    ):
        """Log completed donation transactions"""
        record = self._create_audit_record(
            event_type=AuditEventType.DONATION_COMPLETED,
            user_uid=None,
            event_id=None,
            severity=AuditSeverity.INFO,
            message=f"Donation completed: ${amount} to {fund_name} by {donor_name or user_email}",
            details={
                "amount": amount,
                "fund_name": fund_name,
                "payment_id": payment_id,
                "donor_name": donor_name,
                "user_email": user_email,
                "transaction_type": transaction_type,
                "currency": "USD"
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))

    def log_subscription_created(
        self,
        user_email: str,
        amount: float,
        fund_name: str,
        interval: str,
        subscription_id: str,
        request_ip: Optional[str] = None
    ):
        """Log subscription creation"""
        record = self._create_audit_record(
            event_type=AuditEventType.SUBSCRIPTION_CREATED,
            user_uid=None,
            event_id=None,
            severity=AuditSeverity.INFO,
            message=f"Subscription created: ${amount} {interval} to {fund_name}",
            details={
                "amount": amount,
                "fund_name": fund_name,
                "interval": interval,
                "subscription_id": subscription_id,
                "user_email": user_email,
                "currency": "USD"
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))

    # Form payment logging methods
    def log_form_payment_started(
        self,
        user_id: str,
        form_slug: str,
        amount: float,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log form payment initiation"""
        record = self._create_audit_record(
            event_type=AuditEventType.FORM_PAYMENT_STARTED,
            user_uid=user_id,
            event_id=form_slug,
            severity=AuditSeverity.INFO,
            message=f"Form payment started for {form_slug}: ${amount}",
            details={
                "form_slug": form_slug,
                "amount": amount,
                "currency": "USD",
                "client_ip": client_ip,
                "user_agent": user_agent,
                "metadata": metadata or {}
            },
            request_ip=client_ip
        )
        self.logger.info(json.dumps(record))

    def log_form_payment_completed(
        self,
        user_id: str,
        form_slug: str,
        amount: float,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log completed form payment"""
        record = self._create_audit_record(
            event_type=AuditEventType.FORM_PAYMENT_COMPLETED,
            user_uid=user_id,
            event_id=form_slug,
            severity=AuditSeverity.INFO,
            message=f"Form payment completed for {form_slug}: ${amount}",
            details={
                "form_slug": form_slug,
                "amount": amount,
                "currency": "USD",
                "client_ip": client_ip,
                "user_agent": user_agent,
                "metadata": metadata or {}
            },
            request_ip=client_ip
        )
        self.logger.info(json.dumps(record))

    def log_form_payment_failed(
        self,
        user_id: str,
        form_slug: str,
        error: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log failed form payment operations"""
        record = self._create_audit_record(
            event_type=AuditEventType.FORM_PAYMENT_FAILED,
            user_uid=user_id,
            event_id=form_slug,
            severity=AuditSeverity.ERROR,
            message=f"Form payment failed for {form_slug}: {error}",
            details={
                "form_slug": form_slug,
                "error": error,
                "client_ip": client_ip,
                "user_agent": user_agent,
                "metadata": metadata or {}
            },
            request_ip=client_ip
        )
        self.logger.error(json.dumps(record))

    def log_form_submission_completed(
        self,
        user_id: str,
        form_slug: str,
        payment_id: str,
        submission_id: Optional[str] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ):
        """Log completed form submission after successful payment"""
        record = self._create_audit_record(
            event_type=AuditEventType.FORM_SUBMISSION_CREATED,
            user_uid=user_id,
            event_id=form_slug,
            severity=AuditSeverity.INFO,
            message=f"Form submission completed for {form_slug} with payment {payment_id}",
            details={
                "form_slug": form_slug,
                "payment_id": payment_id,
                "submission_id": submission_id,
                "client_ip": client_ip,
                "user_agent": user_agent
            },
            request_ip=client_ip
        )
        self.logger.info(json.dumps(record))

    def log_paypal_capture_failed(
        self,
        payment_id: str,
        error_message: str,
        user_email: Optional[str] = None,
        amount: Optional[float] = None,
        request_ip: Optional[str] = None
    ):
        """Log PayPal payment capture failures"""
        record = self._create_audit_record(
            event_type=AuditEventType.PAYPAL_PAYMENT_FAILED,
            user_uid=None,
            event_id=None,
            severity=AuditSeverity.ERROR,
            message=f"PayPal payment capture failed for payment {payment_id}: {error_message}",
            details={
                "payment_id": payment_id,
                "error_message": error_message,
                "user_email": user_email,
                "amount": amount
            },
            request_ip=request_ip,
            error=error_message
        )
        self.logger.error(json.dumps(record))

    def log_form_payment_order_created(
        self,
        order_id: str,
        user_id: str,
        amount: float,
        form_slug: Optional[str] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log form payment order creation"""
        record = self._create_audit_record(
            event_type=AuditEventType.FORM_SUBMISSION_CREATED,
            user_uid=user_id,
            event_id=order_id,
            severity=AuditSeverity.INFO,
            message=f"Form payment order created: order_id={order_id}, user_id={user_id}, amount={amount}",
            details={
                "order_id": order_id,
                "form_slug": form_slug,
                "amount": amount,
                "currency": "USD",
                "client_ip": client_ip,
                "user_agent": user_agent,
                "metadata": metadata or {}
            },
            request_ip=client_ip
        )
        self.logger.info(json.dumps(record))

    def log_large_transaction(
        self,
        user_identifier: str,
        amount: float,
        transaction_type: str,
        payment_method: str,
        threshold: float = 1000.0,
        request_ip: Optional[str] = None
    ):
        """Log large transactions for monitoring"""
        if amount >= threshold:
            record = self._create_audit_record(
                event_type=AuditEventType.SUSPICIOUS_ACTIVITY,
                user_uid=user_identifier if "@" not in user_identifier else None,
                event_id=None,
                severity=AuditSeverity.WARNING,
                message=f"Large transaction detected: ${amount} via {payment_method}",
                details={
                    "amount": amount,
                    "transaction_type": transaction_type,
                    "payment_method": payment_method,
                    "threshold": threshold,
                    "user_identifier": user_identifier
                },
                request_ip=request_ip
            )
            self.logger.warning(json.dumps(record))

    async def log_transaction_query(
        self,
        user_id: str,
        query_params: Dict[str, Any],
        request_ip: Optional[str] = None
    ):
        """Log transaction query operations for financial reporting"""
        record = self._create_audit_record(
            event_type=AuditEventType.TRANSACTION_QUERY,
            user_uid=user_id,
            event_id=None,
            severity=AuditSeverity.INFO,
            message=f"Transaction query executed by user {user_id}",
            details={
                "query_parameters": query_params,
                "timestamp": datetime.now().isoformat()
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))

    async def log_transaction_detail_access(
        self,
        user_id: str,
        transaction_id: str,
        request_ip: Optional[str] = None
    ):
        """Log access to specific transaction details"""
        record = self._create_audit_record(
            event_type=AuditEventType.TRANSACTION_DETAIL_ACCESS,
            user_uid=user_id,
            event_id=None,
            severity=AuditSeverity.INFO,
            message=f"Transaction detail accessed by user {user_id}",
            details={
                "transaction_id": transaction_id,
                "access_timestamp": datetime.now().isoformat()
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))

    async def log_financial_report_access(
        self,
        user_id: str,
        report_type: str,
        date_range: Optional[str] = None,
        event_id: Optional[str] = None,
        form_id: Optional[str] = None,
        request_ip: Optional[str] = None
    ):
        """Log financial report and analytics access"""
        record = self._create_audit_record(
            event_type=AuditEventType.FINANCIAL_REPORT_ACCESS,
            user_uid=user_id,
            event_id=event_id,
            severity=AuditSeverity.INFO,
            message=f"Financial report '{report_type}' accessed by user {user_id}",
            details={
                "report_type": report_type,
                "date_range": date_range,
                "event_id": event_id,
                "form_id": form_id,
                "access_timestamp": datetime.now().isoformat()
            },
            request_ip=request_ip
        )
        self.logger.info(json.dumps(record))

# Create singleton instance
payment_audit_logger = PaymentAuditLogger()

# Helper function to extract client IP from request
def get_client_ip(request) -> Optional[str]:
    """Extract client IP address from request"""
    try:
        # Check for common forwarded headers
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if hasattr(request, 'client') and hasattr(request.client, 'host'):
            return request.client.host
        
        return None
    except Exception:
        return None

def get_user_agent(request) -> Optional[str]:
    """Extract User-Agent from request"""
    try:
        return request.headers.get('User-Agent')
    except Exception:
        return None
    

