import logging
import os
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from fastapi import HTTPException
from mongo.database import DB
from models.transaction import Transaction
from models.event import Event
from helpers.audit_logger import PaymentAuditLogger, AuditEventType

class FinanceHelper:
    """Helper class for finance-related operations and analytics"""
    
    def __init__(self):
        self.audit_logger = PaymentAuditLogger()
        self.logger = logging.getLogger(__name__)

    async def get_all_transactions(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
        payment_type: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        event_id: Optional[str] = None,
        form_id: Optional[str] = None,
        user_email: Optional[str] = None,
        request_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive transaction details across all payment types with advanced filtering.
        """
        try:
            # Log the transaction query
            await self.audit_logger.log_transaction_query(
                user_id=user_id,
                query_params={
                    "skip": skip, "limit": limit, "payment_type": payment_type,
                    "status": status, "start_date": start_date, "end_date": end_date,
                    "event_id": event_id, "form_id": form_id, "user_email": user_email
                },
                request_ip=request_ip
            )

            # Build query filter
            query = {}
            
            if payment_type:
                query["payment_type"] = payment_type
            
            if status:
                query["status"] = status
                
            if event_id:
                query["event_id"] = event_id
                
            if form_id:
                query["form_id"] = form_id
                
            if user_email:
                query["user_email"] = user_email

            # Date range filtering
            if start_date or end_date:
                date_filter = {}
                if start_date:
                    try:
                        start_dt = datetime.fromisoformat(start_date)
                        date_filter["$gte"] = start_dt.isoformat()
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
                
                if end_date:
                    try:
                        end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)  # Include full end day
                        date_filter["$lt"] = end_dt.isoformat()
                    except ValueError:
                        raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
                
                query["created_on"] = date_filter

            # Get total count for pagination
            total_count = await DB.db["transactions"].count_documents(query)
            
            # Get transactions with pagination
            sort_options = [("created_on", -1), ("time", -1), ("_id", -1)]
            tx_docs = await DB.db["transactions"].find(query).sort(sort_options).skip(skip).limit(limit).to_list(length=limit)
            
            # Enhance transaction data with related information
            enhanced_transactions = await self._enhance_transactions_with_related_data(tx_docs)

            return {
                "success": True,
                "transactions": enhanced_transactions,
                "pagination": {
                    "total": total_count,
                    "skip": skip,
                    "limit": limit,
                    "has_more": (skip + limit) < total_count
                },
                "filters_applied": {
                    "payment_type": payment_type,
                    "status": status,
                    "start_date": start_date,
                    "end_date": end_date,
                    "event_id": event_id,
                    "form_id": form_id,
                    "user_email": user_email
                }
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error fetching transactions: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch transactions: {str(e)}")

    async def get_transaction_detail(
        self,
        user_id: str,
        transaction_id: str,
        request_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed information for a specific transaction including related data.
        """
        try:
            # Log the transaction detail access
            await self.audit_logger.log_transaction_detail_access(
                user_id=user_id,
                transaction_id=transaction_id,
                request_ip=request_ip
            )

            # Get the transaction
            transaction = await Transaction.get_transaction_by_id(transaction_id)
            if not transaction:
                raise HTTPException(status_code=404, detail="Transaction not found")

            transaction_data = transaction.model_dump()
            
            # Enhance with related information
            enhanced_data = {
                "transaction": transaction_data,
                "related_data": {}
            }

            # Add event details if it's an event payment
            if transaction.event_id:
                event_data = await self._get_event_related_data(transaction)
                if event_data:
                    enhanced_data["related_data"]["event"] = event_data

            # Add form details if it's a form payment  
            if transaction.form_id:
                form_data = await self._get_form_related_data(transaction)
                if form_data:
                    enhanced_data["related_data"]["form"] = form_data

            # Add payment method specific details
            if transaction.payment_method == "paypal":
                payment_details = self._get_paypal_payment_details(transaction)
                enhanced_data["related_data"]["payment_details"] = payment_details

            return {
                "success": True,
                **enhanced_data
            }

        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error fetching transaction detail {transaction_id}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch transaction details: {str(e)}")

    async def get_financial_summary(
        self,
        user_id: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        period: str = "month",
        request_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get comprehensive financial analytics and summary across all payment types.
        """
        try:
            # Log the financial report access
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="summary",
                date_range=f"{start_date} to {end_date}" if start_date or end_date else "all time",
                request_ip=request_ip
            )

            # Build date filter
            date_filter = await self._build_date_filter(start_date, end_date)

            # Get payment type summary
            payment_type_summary = await self._get_payment_type_summary(date_filter)
            
            # Get status summary
            status_summary = await self._get_status_summary(date_filter)
            
            # Get time series data
            time_series_data = await self._get_time_series_data(date_filter, period)
            
            # Get overall totals
            overall_totals = await self._get_overall_totals(date_filter)

            return {
                "success": True,
                "summary": {
                    "overall": {
                        "total_revenue": round(overall_totals.get("total_revenue", 0), 2),
                        "total_transactions": overall_totals.get("total_transactions", 0),
                        "average_transaction_amount": round(overall_totals.get("avg_transaction_amount", 0), 2)
                    },
                    "by_payment_type": [
                        {
                            "payment_type": item["_id"] or "unknown",
                            "total_amount": round(item["total_amount"], 2),
                            "transaction_count": item["transaction_count"],
                            "average_amount": round(item["avg_amount"], 2)
                        }
                        for item in payment_type_summary
                    ],
                    "by_status": [
                        {
                            "status": item["_id"] or "unknown",
                            "total_amount": round(item["total_amount"], 2),
                            "transaction_count": item["transaction_count"]
                        }
                        for item in status_summary
                    ],
                    "time_series": [
                        {
                            "period": item["_id"],
                            "total_amount": round(item["total_amount"], 2),
                            "transaction_count": item["transaction_count"]
                        }
                        for item in time_series_data
                    ]
                },
                "analysis_period": period,
                "date_range": {
                    "start_date": start_date,
                    "end_date": end_date
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error generating financial summary: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate financial summary: {str(e)}")

    async def get_event_financial_analytics(
        self,
        user_id: str,
        event_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        request_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed financial analytics for event payments.
        """
        try:
            # Log the analytics access
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="event_analytics",
                event_id=event_id,
                date_range=f"{start_date} to {end_date}" if start_date or end_date else "all time",
                request_ip=request_ip
            )

            # Build query
            match_query = {"payment_type": "event_registration"}
            
            if event_id:
                match_query["event_id"] = event_id

            # Add date filtering
            date_filter = await self._build_date_filter(start_date, end_date)
            if date_filter:
                match_query["created_on"] = date_filter

            # Get event analytics
            event_analytics = await self._get_event_analytics_data(match_query)
            
            # Format results
            formatted_analytics = self._format_event_analytics(event_analytics)

            return {
                "success": True,
                "event_analytics": formatted_analytics,
                "filters_applied": {
                    "event_id": event_id,
                    "start_date": start_date,
                    "end_date": end_date
                },
                "summary": {
                    "total_events_analyzed": len(formatted_analytics),
                    "total_revenue_all_events": round(sum(e["financial_summary"]["total_revenue"] for e in formatted_analytics), 2),
                    "total_registrations_all_events": sum(e["financial_summary"]["registration_count"] for e in formatted_analytics)
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error generating event financial analytics: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate event analytics: {str(e)}")

    async def get_form_financial_analytics(
        self,
        user_id: str,
        form_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        request_ip: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get detailed financial analytics for form payments.
        """
        try:
            # Log the analytics access
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="form_analytics",
                form_id=form_id,
                date_range=f"{start_date} to {end_date}" if start_date or end_date else "all time",
                request_ip=request_ip
            )

            # Build query
            match_query = {"payment_type": "form_submission"}
            
            if form_id:
                match_query["form_id"] = form_id

            # Add date filtering
            date_filter = await self._build_date_filter(start_date, end_date)
            if date_filter:
                match_query["created_on"] = date_filter

            # Get form analytics
            form_analytics = await self._get_form_analytics_data(match_query)
            
            # Format results with form details
            formatted_analytics = await self._format_form_analytics(form_analytics)

            return {
                "success": True,
                "form_analytics": formatted_analytics,
                "filters_applied": {
                    "form_id": form_id,
                    "start_date": start_date,
                    "end_date": end_date
                },
                "summary": {
                    "total_forms_analyzed": len(formatted_analytics),
                    "total_revenue_all_forms": round(sum(f["financial_summary"]["total_revenue"] for f in formatted_analytics), 2),
                    "total_submissions_all_forms": sum(f["financial_summary"]["submission_count"] for f in formatted_analytics)
                }
            }

        except HTTPException:
            raise
        except Exception as e:
            logging.error(f"Error generating form financial analytics: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to generate form analytics: {str(e)}")

    # Private helper methods
    async def _enhance_transactions_with_related_data(self, tx_docs: List[Dict]) -> List[Dict]:
        """Enhance transaction documents with related event/form data"""
        enhanced_transactions = []
        for tx in tx_docs:
            tx["id"] = str(tx.pop("_id"))
            
            # Add event details if it's an event payment
            if tx.get("event_id"):
                try:
                    event = await Event.get_event_by_id(tx["event_id"])
                    if event:
                        tx["event_details"] = {
                            "event_name": event.get("title"),
                            "event_date": event.get("date"),
                            "event_location": event.get("location")
                        }
                except:
                    pass
            
            # Add form details if it's a form payment
            if tx.get("form_id"):
                try:
                    form_doc = await DB.db["forms"].find_one({"form_id": tx["form_id"]})
                    if form_doc:
                        tx["form_details"] = {
                            "form_title": form_doc.get("title"),
                            "form_slug": form_doc.get("slug")
                        }
                except:
                    pass
            
            enhanced_transactions.append(tx)
        
        return enhanced_transactions

    async def _get_event_related_data(self, transaction: Transaction) -> Optional[Dict[str, Any]]:
        """Get event-related data for a transaction"""
        try:
            event = await Event.get_event_by_id(transaction.event_id)
            if not event:
                return None
                
            event_data = {
                "id": transaction.event_id,
                "title": event.get("title"),
                "date": event.get("date"),
                "location": event.get("location"),
                "price": event.get("price"),
                "donation_option": event.get("donation_option")
            }
            
            # Get registration details if available
            if transaction.registration_key:
                try:
                    registration = await DB.db["event_registrations"].find_one({
                        "registration_key": transaction.registration_key
                    })
                    if registration:
                        event_data["registration"] = {
                            "registration_key": transaction.registration_key,
                            "attendee_name": registration.get("name"),
                            "attendee_email": registration.get("email"),
                            "registration_date": registration.get("created_at")
                        }
                except:
                    pass
                    
            return event_data
        except:
            return None

    async def _get_form_related_data(self, transaction: Transaction) -> Optional[Dict[str, Any]]:
        """Get form-related data for a transaction"""
        try:
            form_doc = await DB.db["forms"].find_one({"form_id": transaction.form_id})
            if not form_doc:
                return None
                
            form_data = {
                "id": transaction.form_id,
                "title": form_doc.get("title"),
                "slug": form_doc.get("slug"),
                "description": form_doc.get("description")
            }
            
            # Get form submission details if available
            try:
                submission = await DB.db["form_submissions"].find_one({
                    "transaction_id": transaction.transaction_id
                })
                if submission:
                    form_data["submission"] = {
                        "submission_id": str(submission.get("_id")),
                        "submitted_at": submission.get("submitted_at"),
                        "form_data": submission.get("form_data", {})
                    }
            except:
                pass
                
            return form_data
        except:
            return None

    def _get_paypal_payment_details(self, transaction: Transaction) -> Dict[str, Any]:
        """Get PayPal-specific payment details"""
        payment_details = {}
        if transaction.type == "one-time":
            payment_details["payment_type"] = "One-time payment"
            payment_details["order_id"] = transaction.order_id
        elif transaction.type == "subscription":
            payment_details["payment_type"] = "Recurring payment"
            payment_details["subscription_id"] = transaction.subscription_id
            payment_details["plan_id"] = transaction.plan_id
            payment_details["next_billing_time"] = transaction.next_billing_time
        
        return payment_details

    async def _build_date_filter(self, start_date: Optional[str], end_date: Optional[str]) -> Dict[str, Any]:
        """Build date filter for MongoDB queries"""
        date_filter = {}
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                date_filter["$gte"] = start_dt.isoformat()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
        
        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date) + timedelta(days=1)
                date_filter["$lt"] = end_dt.isoformat()
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
        
        return date_filter

    async def _get_payment_type_summary(self, date_filter: Dict[str, Any]) -> List[Dict]:
        """Get payment type summary using aggregation"""
        match_filter = {"created_on": date_filter} if date_filter else {}
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": "$payment_type",
                "total_amount": {"$sum": "$amount"},
                "transaction_count": {"$sum": 1},
                "avg_amount": {"$avg": "$amount"}
            }}
        ]
        
        return await DB.db["transactions"].aggregate(pipeline).to_list(None)

    async def _get_status_summary(self, date_filter: Dict[str, Any]) -> List[Dict]:
        """Get status summary using aggregation"""
        match_filter = {"created_on": date_filter} if date_filter else {}
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": "$status",
                "total_amount": {"$sum": "$amount"},
                "transaction_count": {"$sum": 1}
            }}
        ]
        
        return await DB.db["transactions"].aggregate(pipeline).to_list(None)

    async def _get_time_series_data(self, date_filter: Dict[str, Any], period: str) -> List[Dict]:
        """Get time series data using aggregation"""
        time_grouping = {
            "day": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$created_on"}}}},
            "week": {"$dateToString": {"format": "%Y-W%U", "date": {"$dateFromString": {"dateString": "$created_on"}}}},
            "month": {"$dateToString": {"format": "%Y-%m", "date": {"$dateFromString": {"dateString": "$created_on"}}}},
            "year": {"$dateToString": {"format": "%Y", "date": {"$dateFromString": {"dateString": "$created_on"}}}}
        }

        match_filter = {"created_on": date_filter} if date_filter else {}
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": time_grouping.get(period, time_grouping["month"]),
                "total_amount": {"$sum": "$amount"},
                "transaction_count": {"$sum": 1}
            }},
            {"$sort": {"_id": 1}}
        ]
        
        return await DB.db["transactions"].aggregate(pipeline).to_list(None)

    async def _get_overall_totals(self, date_filter: Dict[str, Any]) -> Dict[str, Any]:
        """Get overall financial totals"""
        match_filter = {"created_on": date_filter} if date_filter else {}
        pipeline = [
            {"$match": match_filter},
            {"$group": {
                "_id": None,
                "total_revenue": {"$sum": "$amount"},
                "total_transactions": {"$sum": 1},
                "avg_transaction_amount": {"$avg": "$amount"}
            }}
        ]
        
        result = await DB.db["transactions"].aggregate(pipeline).to_list(None)
        return result[0] if result else {
            "total_revenue": 0,
            "total_transactions": 0,
            "avg_transaction_amount": 0
        }

    async def _get_event_analytics_data(self, match_query: Dict[str, Any]) -> List[Dict]:
        """Get event analytics data using aggregation"""
        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": "$event_id",
                "event_name": {"$first": "$event_name"},
                "total_revenue": {"$sum": "$amount"},
                "registration_count": {"$sum": 1},
                "avg_payment": {"$avg": "$amount"},
                "statuses": {"$push": "$status"}
            }},
            {"$addFields": {
                "successful_payments": {
                    "$size": {
                        "$filter": {
                            "input": "$statuses",
                            "cond": {"$in": ["$$this", ["COMPLETED", "completed", "APPROVED"]]}
                        }
                    }
                },
                "failed_payments": {
                    "$size": {
                        "$filter": {
                            "input": "$statuses", 
                            "cond": {"$in": ["$$this", ["FAILED", "failed", "CANCELLED", "cancelled"]]}
                        }
                    }
                }
            }},
            {"$project": {
                "statuses": 0  # Remove the temporary statuses array
            }}
        ]

        return await DB.db["transactions"].aggregate(pipeline).to_list(None)

    def _format_event_analytics(self, event_analytics: List[Dict]) -> List[Dict]:
        """Format event analytics data for response"""
        formatted_analytics = []
        for event in event_analytics:
            success_rate = (event["successful_payments"] / event["registration_count"] * 100) if event["registration_count"] > 0 else 0
            
            formatted_analytics.append({
                "event_id": event["_id"],
                "event_name": event["event_name"] or "Unknown Event",
                "financial_summary": {
                    "total_revenue": round(event["total_revenue"], 2),
                    "registration_count": event["registration_count"],
                    "average_payment": round(event["avg_payment"], 2),
                    "successful_payments": event["successful_payments"],
                    "failed_payments": event["failed_payments"],
                    "success_rate_percentage": round(success_rate, 2)
                }
            })
        
        return formatted_analytics

    async def _get_form_analytics_data(self, match_query: Dict[str, Any]) -> List[Dict]:
        """Get form analytics data using aggregation"""
        pipeline = [
            {"$match": match_query},
            {"$group": {
                "_id": "$form_id",
                "form_slug": {"$first": "$form_slug"},
                "total_revenue": {"$sum": "$amount"},
                "submission_count": {"$sum": 1},
                "avg_payment": {"$avg": "$amount"},
                "statuses": {"$push": "$status"}
            }},
            {"$addFields": {
                "successful_payments": {
                    "$size": {
                        "$filter": {
                            "input": "$statuses",
                            "cond": {"$in": ["$$this", ["COMPLETED", "completed", "APPROVED"]]}
                        }
                    }
                },
                "failed_payments": {
                    "$size": {
                        "$filter": {
                            "input": "$statuses",
                            "cond": {"$in": ["$$this", ["FAILED", "failed", "CANCELLED", "cancelled"]]}
                        }
                    }
                }
            }},
            {"$project": {
                "statuses": 0
            }}
        ]

        return await DB.db["transactions"].aggregate(pipeline).to_list(None)

    async def _format_form_analytics(self, form_analytics: List[Dict]) -> List[Dict]:
        """Format form analytics data with form details"""
        formatted_analytics = []
        for form_data in form_analytics:
            # Get form details
            try:
                form_doc = await DB.db["forms"].find_one({"form_id": form_data["_id"]})
                form_title = form_doc.get("title", "Unknown Form") if form_doc else "Unknown Form"
            except:
                form_title = "Unknown Form"

            success_rate = (form_data["successful_payments"] / form_data["submission_count"] * 100) if form_data["submission_count"] > 0 else 0
            
            formatted_analytics.append({
                "form_id": form_data["_id"],
                "form_title": form_title,
                "form_slug": form_data["form_slug"],
                "financial_summary": {
                    "total_revenue": round(form_data["total_revenue"], 2),
                    "submission_count": form_data["submission_count"],
                    "average_payment": round(form_data["avg_payment"], 2),
                    "successful_payments": form_data["successful_payments"],
                    "failed_payments": form_data["failed_payments"],
                    "success_rate_percentage": round(success_rate, 2)
                }
            })
        
        return formatted_analytics

    # =============================================================================
    # PAYPAL CONFIGURATION METHODS
    # =============================================================================

    async def get_paypal_status(self, user_id: str, request_ip: str) -> Dict[str, Any]:
        """Get PayPal configuration status from environment variables"""
        try:
            # Log PayPal status check
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="paypal_status_check",
                request_ip=request_ip
            )
            
            # Check environment variables
            client_id = os.getenv("PAYPAL_CLIENT_ID", "")
            client_secret = os.getenv("PAYPAL_CLIENT_SECRET", "")
            mode = os.getenv("PAYPAL_MODE", "sandbox")
            
            return {
                "success": True,
                "configured": bool(client_id and client_secret),
                "mode": mode,
                "client_id_set": bool(client_id),
                "client_secret_set": bool(client_secret),
                "message": "PayPal credentials are configured via environment variables"
            }
            
        except Exception as e:
            self.logger.error(f"Error checking PayPal status: {str(e)}")
            self.audit_logger.log_error(
                event_type=AuditEventType.VALIDATION_FAILED,
                user_uid=user_id,
                event_id=None,
                error_message=f"PayPal status check failed: {str(e)}",
                exception=e,
                request_ip=request_ip
            )
            raise HTTPException(status_code=500, detail=str(e))

    async def test_paypal_connection(self, user_id: str, request_ip: str) -> Dict[str, Any]:
        """Test PayPal API connection with current credentials"""
        try:
            # Log PayPal connection test
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="paypal_connection_test",
                request_ip=request_ip
            )
            
            # Try to get an access token using environment variables
            from helpers.paypalHelper import get_paypal_access_token
            access_token = get_paypal_access_token()
            
            if access_token:
                result = {
                    "success": True,
                    "message": "PayPal connection successful",
                    "connected": True
                }
                
                # Log successful connection
                await self.audit_logger.log_financial_report_access(
                    user_id=user_id,
                    report_type="paypal_connection_success",
                    request_ip=request_ip
                )
                
                return result
            else:
                result = {
                    "success": False,
                    "message": "Failed to connect to PayPal API. Please check your credentials in the .env file.",
                    "connected": False
                }
                
                # Log failed connection
                await self.audit_logger.log_financial_report_access(
                    user_id=user_id,
                    report_type="paypal_connection_failed",
                    request_ip=request_ip
                )
                
                return result
        
        except Exception as e:
            self.logger.error(f"Error testing PayPal connection: {str(e)}")
            result = {
                "success": False,
                "message": f"PayPal connection test failed: {str(e)}",
                "connected": False
            }
            
            self.audit_logger.log_error(
                event_type=AuditEventType.VALIDATION_FAILED,
                user_uid=user_id,
                event_id=None,
                error_message=f"PayPal connection test failed: {str(e)}",
                exception=e,
                request_ip=request_ip
            )
            
            return result

    async def get_paypal_credentials_info(self, user_id: str, request_ip: str) -> Dict[str, Any]:
        """Information about updating PayPal credentials"""
        # Log credentials info request
        await self.audit_logger.log_financial_report_access(
            user_id=user_id,
            report_type="paypal_credentials_info",
            request_ip=request_ip
        )
        
        return {
            "success": False,
            "message": "PayPal credentials must be configured via environment variables (.env file). This ensures secure credential management.",
            "instructions": {
                "step1": "Open your .env file",
                "step2": "Add or update the following variables:",
                "variables": {
                    "PAYPAL_CLIENT_ID": "Your PayPal Client ID from PayPal Developer Dashboard",
                    "PAYPAL_CLIENT_SECRET": "Your PayPal Client Secret from PayPal Developer Dashboard", 
                    "PAYPAL_MODE": "sandbox (for testing) or live (for production)"
                },
                "step3": "Restart the application to load the new credentials",
                "step4": "Use the test connection endpoint to verify the credentials work"
            }
        }

    async def get_paypal_settings(self, user_id: str, request_ip: str) -> Dict[str, Any]:
        """Get PayPal settings (non-credential settings stored in database)"""
        try:
            # Log settings retrieval
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="paypal_settings",
                request_ip=request_ip
            )
            
            settings = await DB.get_paypal_settings()
            return {"success": True, "settings": settings}
            
        except Exception as e:
            self.logger.error(f"Error getting PayPal settings: {str(e)}")
            self.audit_logger.log_error(
                event_type=AuditEventType.VALIDATION_FAILED,
                user_uid=user_id,
                event_id=None,
                error_message=f"Failed to get PayPal settings: {str(e)}",
                exception=e,
                request_ip=request_ip
            )
            raise HTTPException(status_code=500, detail=str(e))

    async def update_paypal_settings(
        self, 
        user_id: str, 
        settings: Dict[str, Any], 
        request_ip: str
    ) -> Dict[str, Any]:
        """Update PayPal settings (non-credential settings like church name, allowed funds)"""
        try:
            # Log settings update attempt
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="paypal_settings_update",
                request_ip=request_ip
            )
            
            # Define which keys can be updated in the database
            # Credentials (PAYPAL_MODE, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
            # are kept in .env file and cannot be updated through the API
            allowed_keys = [
                "PAYPAL_PLAN_NAME", 
                "PAYPAL_PLAN_DESCRIPTION", 
                "CHURCH_NAME",
                "ALLOWED_FUNDS"
            ]
            
            # Update each setting in the database
            updated_settings = {}
            for key, value in settings.items():
                if key in allowed_keys:
                    # For ALLOWED_FUNDS, handle as a list
                    if key == "ALLOWED_FUNDS":
                        # If value is a string (comma-separated), convert to list
                        if isinstance(value, str):
                            value = [item.strip() for item in value.split(",") if item.strip()]
                        # If already a list, use as is
                        elif isinstance(value, list):
                            value = [str(item).strip() for item in value if str(item).strip()]
                    
                    success = await DB.set_setting(key, value)
                    if success:
                        updated_settings[key] = value
            
            # Log successful update
            await self.audit_logger.log_financial_report_access(
                user_id=user_id,
                report_type="paypal_settings_updated",
                request_ip=request_ip
            )
            
            return {
                "success": True,
                "message": "PayPal settings updated successfully",
                "updated": updated_settings
            }
        
        except Exception as e:
            self.logger.error(f"Error updating PayPal settings: {str(e)}")
            self.audit_logger.log_error(
                event_type=AuditEventType.VALIDATION_FAILED,
                user_uid=user_id,
                event_id=None,
                error_message=f"Failed to update PayPal settings: {str(e)}",
                exception=e,
                request_ip=request_ip
            )
            raise HTTPException(status_code=500, detail=f"Failed to update PayPal settings: {str(e)}")


# Create singleton instance for easy import
finance_helper = FinanceHelper()