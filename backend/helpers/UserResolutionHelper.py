from typing import List, Dict, Optional
from bson import ObjectId
from datetime import datetime

from mongo.database import DB
from firebase_admin import auth
from models.user import get_family_member_by_id


class UserResolutionHelper:
    """
    Helper class for resolving user and family member names for event registration display.
    """
    
    @staticmethod
    async def resolve_user_name(uid: str) -> str:
        """
        Resolve a Firebase UID to user's display name.
        Returns a fallback name if user is not found.
        """
        try:
            user = auth.get_user(uid)
            if user.display_name:
                return user.display_name
            elif user.email:
                # Fallback to email if displayName not available
                return user.email.split('@')[0].title()
            else:
                return f"User {uid[:8]}..."
        except Exception:
            return f"User {uid[:8]}..."
    
    @staticmethod
    async def resolve_family_member_name(uid: str, person_id: ObjectId) -> Optional[str]:
        """
        Resolve a family member's name by their person_id and parent user uid.
        Returns None if family member is not found.
        """
        try:
            # Get family member data
            member = await get_family_member_by_id(uid, str(person_id))
            if member:
                # PersonOut has first_name and last_name attributes
                return f"{member.first_name} {member.last_name}".strip()
            else:
                return None
        except Exception:
            return None
    
    @staticmethod
    async def create_display_name(user_uid: str, person_id: Optional[ObjectId], user_name: str, person_name: Optional[str]) -> str:
        """
        Create a display name for registration entry.
        """
        if person_id is None:
            # This is the user themselves
            return user_name
        elif person_name:
            # This is a family member with a known name
            return person_name
        else:
            # Family member exists but name couldn't be resolved
            return "Family Member"
    
    @staticmethod
    async def resolve_registration_display_names(attendees: List[Dict]) -> List[Dict]:
        """
        Resolve display names for a list of event attendees.
        Returns enhanced attendee list with resolved names and display information.
        """
        enhanced_attendees = []
        
        # Batch resolve user names to avoid N+1 queries
        user_uids = list(set(attendee.get('user_uid') for attendee in attendees if attendee.get('user_uid')))
        user_name_cache = {}
        
        for uid in user_uids:
            if uid:  # Only process valid UIDs
                user_name_cache[uid] = await UserResolutionHelper.resolve_user_name(uid)
        
        for attendee in attendees:
            user_uid = attendee.get('user_uid')
            person_id = attendee.get('person_id')
            
            if not user_uid:
                continue
            
            user_name = user_name_cache.get(user_uid, f"User {user_uid[:8]}...")
            person_name = None
            
            # Resolve family member name if this is a family member registration
            if person_id:
                person_name = await UserResolutionHelper.resolve_family_member_name(user_uid, person_id)
            
            # Create display name
            display_name = await UserResolutionHelper.create_display_name(user_uid, person_id, user_name, person_name)
            
            # Create enhanced attendee entry
            enhanced_attendee = {
                "user_uid": user_uid,
                "user_name": user_name,
                "person_id": str(person_id) if person_id else None,
                "person_name": person_name,
                "display_name": display_name,
                "registered_on": attendee.get('addedOn', datetime.now()),
                "kind": attendee.get('kind', 'rsvp')
            }
            
            enhanced_attendees.append(enhanced_attendee)
        
        return enhanced_attendees
    
    @staticmethod
    async def get_event_registration_summary(event_id: str) -> Dict:
        """
        Get comprehensive registration summary for an event including resolved names.
        """
        try:
            from models.event import rsvp_list
            
            # Get event data and attendees
            rsvp_data = await rsvp_list(event_id)
            attendees = rsvp_data.get('attendees', [])
            seats_taken = rsvp_data.get('seats_taken', 0)
            total_spots = rsvp_data.get('spots', 0)
            
            # Resolve names for all attendees
            enhanced_attendees = await UserResolutionHelper.resolve_registration_display_names(attendees)
            
            # Calculate available spots
            available_spots = max(0, total_spots - seats_taken)
            
            return {
                "success": True,
                "registrations": enhanced_attendees,
                "total_registrations": seats_taken,
                "available_spots": available_spots,
                "total_spots": total_spots,
                "can_register": available_spots > 0
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "registrations": [],
                "total_registrations": 0,
                "available_spots": 0,
                "total_spots": 0,
                "can_register": False
            }