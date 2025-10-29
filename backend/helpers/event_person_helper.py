import logging
from typing import Optional, Dict, Any, List
from fastapi import HTTPException
from bson import ObjectId
from datetime import datetime

from models.user import get_family_member_by_id
from helpers.MongoHelper import serialize_objectid
from backend.controllers.event_controllers.admin_event_controller import cancel_rsvp, register_rsvp
from mongo.churchuser import UserHandler
from models.event import rsvp_list


class EventPersonHelper:
    """Helper class for event person management and registration operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    async def watch_event(
        self,
        event_id: str,
        user_uid: str,
        scope: str = "series",
        occurrence_start: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add an event to user's 'My Events' as a 'watch' reference.
        
        Args:
            event_id: Event ID to watch
            user_uid: User's UID
            scope: Either 'series' or 'occurrence'
            occurrence_start: ISO8601 start time for single occurrence
            
        Returns:
            Dict with success status and added event info
        """
        try:
            ev_oid = ObjectId(event_id)
            occurrence_dt = None
            
            if scope == "occurrence" and occurrence_start:
                try:
                    occurrence_dt = datetime.fromisoformat(occurrence_start)
                except Exception:
                    raise HTTPException(
                        status_code=400, 
                        detail="Invalid occurrenceStart; must be ISO8601"
                    )

            added = await UserHandler.add_to_my_events(
                uid=user_uid,
                event_id=ev_oid,
                reason="watch",
                scope=scope,
                occurrence_start=occurrence_dt,
            )
            
            if not added:
                # Already present or user not found
                return {"success": True, "added": False}
            
            return {
                "success": True, 
                "added": True, 
                "event": serialize_objectid(added)
            }
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error adding event {event_id} to My Events for user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error adding event to My Events: {str(e)}"
            )

    async def unwatch_event(
        self,
        event_id: str,
        user_uid: str,
        scope: Optional[str] = None,
        occurrence_start: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Remove user's 'watch' reference for an event.
        
        Args:
            event_id: Event ID to unwatch
            user_uid: User's UID
            scope: Either 'series' or 'occurrence' or None
            occurrence_start: ISO8601 start time for specific occurrence
            
        Returns:
            Dict with success status and removal confirmation
        """
        try:
            ev_oid = ObjectId(event_id)
            occurrence_dt = None
            
            if occurrence_start:
                try:
                    occurrence_dt = datetime.fromisoformat(occurrence_start)
                except Exception:
                    raise HTTPException(
                        status_code=400, 
                        detail="Invalid occurrenceStart; must be ISO8601"
                    )

            # Build a precise removal; only removes reason="watch"
            removed = await UserHandler.remove_from_my_events(
                uid=user_uid,
                event_id=ev_oid,
                reason="watch",
                scope=scope,
                occurrence_start=occurrence_dt,
            )
            
            return {"success": True, "removed": bool(removed)}
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error removing event {event_id} from My Events for user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error removing event from My Events: {str(e)}"
            )

    async def get_user_events(
        self,
        user_uid: str,
        expand: bool = False
    ) -> Dict[str, Any]:
        """
        Get all events for a user (My Events).
        
        Args:
            user_uid: User's UID
            expand: Whether to expand event details
            
        Returns:
            Dict with success status and events list
        """
        try:
            if not user_uid:
                raise HTTPException(
                    status_code=401, 
                    detail="User authentication required"
                )

            self.logger.info(f"[MY_EVENTS] Fetching events for user {user_uid}, expand={expand}")
            events = await UserHandler.list_my_events(user_uid, expand=expand)
            self.logger.info(f"[MY_EVENTS] Found {len(events)} events for user {user_uid}")
            
            return {
                "success": True, 
                "events": serialize_objectid(events)
            }
            
        except HTTPException:
            raise
        except ValueError as e:
            self.logger.error(f"Invalid data format in user events for user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail="Invalid data format in user events"
            )
        except Exception as e:
            self.logger.error(f"Unexpected error fetching user events for user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=500, 
                detail="An unexpected error occurred while fetching user events"
            )

    async def get_registration_status(
        self,
        event_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Check whether the user is registered for an event.
        
        Args:
            event_id: Event ID to check
            user_uid: User's UID
            
        Returns:
            Dict with registration status information
        """
        try:
            data = await rsvp_list(event_id)
            attendees = data.get("attendees", [])
            
            # Check if user is registered (not family member)
            user_registered = any(
                a.get("user_uid") == user_uid and a.get("person_id") is None 
                for a in attendees
            )

            return {
                "success": True,
                "status": {
                    "event_id": event_id,
                    "user_id": user_uid,
                    "registered": user_registered
                }
            }
            
        except Exception as e:
            self.logger.error(f"Error fetching registration status for event {event_id}, user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error fetching registration status: {str(e)}"
            )

    async def register_user_for_event(
        self,
        event_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Register a user for an event.
        
        Args:
            event_id: Event ID to register for
            user_uid: User's UID
            
        Returns:
            Dict with registration success confirmation
        """
        try:
            self.logger.info(f"Registration attempt for event_id={event_id}, uid={user_uid}")
            
            result, reason = await register_rsvp(event_id, user_uid)
            
            if not result:
                self.logger.warning(f"Registration failed for event_id={event_id}, uid={user_uid}, reason={reason}")
                
                if reason == "already_registered":
                    raise HTTPException(
                        status_code=400, 
                        detail="You are already registered for this event"
                    )
                elif reason == "event_full":
                    raise HTTPException(
                        status_code=400, 
                        detail="This event is full and cannot accept more registrations"
                    )
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail="Registration failed - please try again or contact support"
                    )
            
            self.logger.info(f"Registration successful for event_id={event_id}, uid={user_uid}")
            return {"success": True, "registration": True}
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Registration error for event_id={event_id}, uid={user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error registering for event: {str(e)}"
            )

    async def unregister_user_from_event(
        self,
        event_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Unregister a user from an event.
        
        Args:
            event_id: Event ID to unregister from
            user_uid: User's UID
            
        Returns:
            Dict with unregistration success confirmation
        """
        try:
            self.logger.info(f"Attempting to unregister user {user_uid} from event {event_id}")
            
            # Try to remove with default 'rsvp' kind first
            result = await cancel_rsvp(event_id, user_uid)
            
            if not result:
                self.logger.warning(f"Unregistration failed for user {user_uid} from event {event_id} - user may not be registered")
                raise HTTPException(
                    status_code=400, 
                    detail="Unregistration failed - you may not be registered for this event or have already been unregistered"
                )
            
            self.logger.info(f"Successfully unregistered user {user_uid} from event {event_id}")
            return {"success": True, "message": "Unregistered successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error unregistering user {user_uid} from event {event_id}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error unregistering from event: {str(e)}"
            )

    async def register_family_member_for_event(
        self,
        event_id: str,
        family_member_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Register a family member for an event.
        
        Args:
            event_id: Event ID to register for
            family_member_id: Family member's ID
            user_uid: User's UID (owner of family member)
            
        Returns:
            Dict with registration success confirmation
        """
        try:
            # Validate family member ownership
            member = await get_family_member_by_id(user_uid, family_member_id)
            if not member:
                raise HTTPException(
                    status_code=404, 
                    detail="Family member not found"
                )

            result, reason = await register_rsvp(event_id, user_uid, family_member_id)
            
            if not result:
                if reason == "already_registered":
                    raise HTTPException(
                        status_code=400, 
                        detail="Family member is already registered for this event"
                    )
                elif reason == "event_full":
                    raise HTTPException(
                        status_code=400, 
                        detail="This event is full and cannot accept more registrations"
                    )
                else:
                    raise HTTPException(
                        status_code=400, 
                        detail="Registration failed"
                    )

            self.logger.info(f"Family member {family_member_id} registered for event {event_id} by user {user_uid}")
            return {"success": True, "registration": True}
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error registering family member {family_member_id} for event {event_id}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error registering family member for event: {str(e)}"
            )

    async def unregister_family_member_from_event(
        self,
        event_id: str,
        family_member_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Unregister a family member from an event.
        
        Args:
            event_id: Event ID to unregister from
            family_member_id: Family member's ID
            user_uid: User's UID (owner of family member)
            
        Returns:
            Dict with unregistration success confirmation
        """
        try:
            # Validate family member ownership
            member = await get_family_member_by_id(user_uid, family_member_id)
            if not member:
                raise HTTPException(
                    status_code=404, 
                    detail="Family member not found"
                )

            result = await cancel_rsvp(event_id, user_uid, family_member_id)
            
            if not result:
                raise HTTPException(
                    status_code=400, 
                    detail="Unregistration failed"
                )

            self.logger.info(f"Family member {family_member_id} unregistered from event {event_id} by user {user_uid}")
            return {"success": True, "message": "Family member unregistered successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(f"Error unregistering family member {family_member_id} from event {event_id}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error unregistering family member from event: {str(e)}"
            )

    async def get_family_member_events(
        self,
        family_member_id: str,
        user_uid: str
    ) -> Dict[str, Any]:
        """
        Get events for a specific family member.
        
        Args:
            family_member_id: Family member's ID
            user_uid: User's UID (owner of family member)
            
        Returns:
            Dict with family member's events
        """
        try:
            if not user_uid:
                raise HTTPException(
                    status_code=401, 
                    detail="User authentication required"
                )

            try:
                family_member_object_id = ObjectId(family_member_id)
            except Exception:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid family member ID format"
                )

            # Validate family member ownership
            member = await get_family_member_by_id(user_uid, family_member_id)
            if not member:
                raise HTTPException(
                    status_code=404, 
                    detail="Family member not found or not owned by user"
                )

            # Filter by person_id
            events = await UserHandler.list_my_events(user_uid, person_id=family_member_object_id)
            
            return {
                "success": True,
                "events": serialize_objectid(events),
                "family_member_id": family_member_id
            }
            
        except HTTPException:
            raise
        except ValueError as e:
            self.logger.error(
                f"Invalid data format in family member events for user {user_uid}, "
                f"family member {family_member_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=400, 
                detail="Invalid data format in family member events"
            )
        except Exception as e:
            self.logger.error(
                f"Unexpected error fetching family member events for user {user_uid}, "
                f"family member {family_member_id}: {str(e)}"
            )
            raise HTTPException(
                status_code=500, 
                detail="An unexpected error occurred while fetching family member events"
            )

    async def get_family_members_events(
        self,
        user_uid: str,
        filters: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get all events for user's family members.
        
        Args:
            user_uid: User's UID
            filters: Optional filters to apply
            
        Returns:
            Dict with family members' events
        """
        try:
            # Note: Currently returns all events; could be enhanced to filter by family members only
            events = await UserHandler.list_my_events(user_uid)
            
            return {
                "success": True, 
                "events": serialize_objectid(events)
            }
            
        except Exception as e:
            self.logger.error(f"Error fetching family member events for user {user_uid}: {str(e)}")
            raise HTTPException(
                status_code=400, 
                detail=f"Error fetching family member events: {str(e)}"
            )


# Create singleton instance for easy import
event_person_helper = EventPersonHelper()