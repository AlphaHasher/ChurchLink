#!/usr/bin/env python3
"""
Admin User Management CLI Tool

This script allows you to search for users by email and grant them admin privileges.
It provides a live-updating interface for user management.
"""

import asyncio
import curses
import argparse
import sys
import os
import logging
from typing import List, Dict, Any
import firebase_admin
from firebase_admin import credentials, auth

# Add the current directory to Python path to import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from mongo.database import DB as DatabaseManager
from mongo.churchuser import UserHandler
from mongo.roles import RoleHandler


class AdminManager:
    """Handles admin privilege management for users"""

    def __init__(self):
        self.db_initialized = False
        self.firebase_initialized = False

    async def initialize(self):
        """Initialize database and Firebase connections"""
        try:
            # Initialize database
            await DatabaseManager.init_db()
            self.db_initialized = True
            logger.info("Database connection established")

            # Initialize Firebase if not already initialized
            if not firebase_admin._apps:
                from firebase.firebase_credentials import get_firebase_credentials
                cred = credentials.Certificate(get_firebase_credentials())
                firebase_admin.initialize_app(cred)
                self.firebase_initialized = True
                logger.info("Firebase connection established")

            # Verify admin role exists
            await RoleHandler.verify_admin_role()
            logger.info("Administrator role verified")

        except Exception as e:
            logger.error(f"Initialization failed: {str(e)}")
            sys.exit(1)

    async def search_users(self, email_query: str = "", limit: int = 50) -> List[Dict[str, Any]]:
        """Search users by email pattern"""
        try:
            if not email_query:
                # Get all users if no search query
                users = await UserHandler.find_all_users()
            else:
                # Search by email pattern (case-insensitive)
                users = await DatabaseManager.find_documents(
                    "users",
                    {"email": {"$regex": email_query, "$options": "i"}}
                )

            # Limit results and sort by email
            users = users[:limit]
            users.sort(key=lambda x: x.get('email', '').lower())

            return users
        except Exception as e:
            logger.error(f"Error searching users: {str(e)}")
            return []

    async def get_user_roles_info(self, user: Dict[str, Any]) -> Dict[str, Any]:
        """Get detailed role information for a user"""
        try:
            user_roles = user.get('roles', [])
            role_names = []

            for role_id in user_roles:
                try:
                    role = await RoleHandler.find_role_by_id(str(role_id))
                    if role:
                        role_names.append(role.get('name', 'Unknown'))
                except:
                    role_names.append('Invalid Role ID')

            # Check if user has admin role
            admin_role_id = await RoleHandler.find_role_id("Administrator")
            is_admin = False
            if admin_role_id:
                admin_role_id_str = str(admin_role_id)
                # Check if any of the user's roles (as strings) match the admin role ID
                user_role_strings = [str(role) for role in user_roles]
                is_admin = admin_role_id_str in user_role_strings

            return {
                'role_names': role_names,
                'is_admin': is_admin,
                'role_count': len(user_roles)
            }
        except Exception:
            return {
                'role_names': ['Error loading roles'],
                'is_admin': False,
                'role_count': 0
            }

    async def grant_admin_privileges(self, user: Dict[str, Any]) -> bool:
        """Grant admin privileges to a user (both MongoDB and Firebase)"""
        try:
            uid = user.get('uid')
            email = user.get('email')

            if not uid:
                logger.error("Cannot grant admin: User has no UID")
                return False

            # Get admin role ID
            admin_role_id = await RoleHandler.find_role_id("Administrator")
            if not admin_role_id:
                logger.error("Cannot grant admin: Administrator role not found")
                return False

            # Check if user already has admin role
            user_roles = user.get('roles', [])

            # Convert admin_role_id to string for comparison and storage
            admin_role_id_str = str(admin_role_id)

            # Check if user already has admin role by comparing string representations
            user_role_strings = [str(role) for role in user_roles]
            has_admin = admin_role_id_str in user_role_strings
            if has_admin:
                logger.info(f"User {email} already has admin privileges")
                return True

            # Add admin role to user's roles in MongoDB as string
            # Convert all existing roles to strings for consistency
            new_roles = [str(role) for role in user_roles]
            if admin_role_id_str not in new_roles:
                new_roles.append(admin_role_id_str)

            # Update user roles in MongoDB
            result = await UserHandler.update_roles(uid, new_roles)
            if not result:
                logger.error(f"Failed to update MongoDB roles for user {email}")
                return False

            # Update Firebase custom claims
            try:
                firebase_user = auth.get_user(uid)
                current_claims = firebase_user.custom_claims or {}
                current_firebase_roles = set(current_claims.get('roles', []))

                # Add admin role to Firebase claims
                current_firebase_roles.add('admin')
                new_claims = {**current_claims, 'roles': list(current_firebase_roles)}
                auth.set_custom_user_claims(uid, new_claims)

                logger.info(f"Successfully granted admin privileges to {email}")
                logger.info("  - Added Administrator role to MongoDB")
                logger.info("  - Added admin role to Firebase claims")
                return True

            except auth.UserNotFoundError:
                logger.warning(f"MongoDB updated but Firebase user {uid} not found")
                logger.warning(f"  - Admin role granted in MongoDB only")
                return True
            except Exception as e:
                logger.warning(f"MongoDB updated but Firebase claims update failed: {str(e)}")
                return True

        except Exception as e:
            logger.error(f"Failed to grant admin privileges: {str(e)}")
            return False

    async def revoke_admin_privileges(self, user: Dict[str, Any]) -> bool:
        """Revoke admin privileges from a user"""
        try:
            uid = user.get('uid')
            email = user.get('email')

            if not uid:
                logger.error("Cannot revoke admin: User has no UID")
                return False

            # Get admin role ID
            admin_role_id = await RoleHandler.find_role_id("Administrator")
            if not admin_role_id:
                logger.error("Cannot revoke admin: Administrator role not found")
                return False

            # Check if user has admin role
            user_roles = user.get('roles', [])
            admin_role_id_str = str(admin_role_id)

            # Check if user has admin role by comparing string representations
            user_role_strings = [str(role) for role in user_roles]
            has_admin = admin_role_id_str in user_role_strings
            if not has_admin:
                logger.info(f"User {email} doesn't have admin privileges")
                return True

            # Remove admin role from user's roles in MongoDB
            # Convert all roles to strings and filter out the admin role
            new_roles = [str(role) for role in user_roles if str(role) != admin_role_id_str]

            # Update user roles in MongoDB
            result = await UserHandler.update_roles(uid, new_roles)
            if not result:
                logger.error(f"Failed to update MongoDB roles for user {email}")
                return False

            # Update Firebase custom claims
            try:
                firebase_user = auth.get_user(uid)
                current_claims = firebase_user.custom_claims or {}
                current_firebase_roles = set(current_claims.get('roles', []))

                # Remove admin role from Firebase claims
                current_firebase_roles.discard('admin')
                new_claims = {**current_claims, 'roles': list(current_firebase_roles)}
                auth.set_custom_user_claims(uid, new_claims)

                logger.info(f"Successfully revoked admin privileges from {email}")
                logger.info("  - Removed Administrator role from MongoDB")
                logger.info("  - Removed admin role from Firebase claims")
                return True

            except auth.UserNotFoundError:
                logger.warning(f"MongoDB updated but Firebase user {uid} not found")
                return True
            except Exception as e:
                logger.warning(f"MongoDB updated but Firebase claims update failed: {str(e)}")
                return True

        except Exception as e:
            logger.error(f"Failed to revoke admin privileges: {str(e)}")
            return False


class UserInterface:
    """Curses-based user interface for the admin tool"""

    def __init__(self, admin_manager: AdminManager):
        self.admin_manager = admin_manager
        self.search_query = ""
        self.selected_index = 0
        self.users = []
        self.user_details = []

    def run(self, stdscr):
        """Main curses interface loop"""
        curses.curs_set(0)  # Hide cursor
        curses.start_color()
        curses.init_pair(1, curses.COLOR_WHITE, curses.COLOR_BLUE)    # Header
        curses.init_pair(2, curses.COLOR_BLACK, curses.COLOR_WHITE)    # Normal text
        curses.init_pair(3, curses.COLOR_WHITE, curses.COLOR_RED)      # Error
        curses.init_pair(4, curses.COLOR_BLACK, curses.COLOR_GREEN)    # Success
        curses.init_pair(5, curses.COLOR_WHITE, curses.COLOR_MAGENTA)  # Selected

        self.stdscr = stdscr
        self.height, self.width = stdscr.getmaxyx()

        try:
            # Run the main loop synchronously using the provided loop
            self._run_sync_main_loop()
        except KeyboardInterrupt:
            pass

    def _run_sync_main_loop(self):
        """Main interface loop (synchronous wrapper)"""
        while True:
            # Update user list asynchronously
            self.loop.run_until_complete(self._update_user_list())
            self._draw_interface()
            self._handle_input()

    async def _update_user_list(self):
        """Update the user list based on current search query"""
        self.users = await self.admin_manager.search_users(self.search_query)

        # Get detailed role information for each user
        self.user_details = []
        for user in self.users:
            details = await self.admin_manager.get_user_roles_info(user)
            self.user_details.append(details)

        # Ensure selected index is valid
        if self.selected_index >= len(self.users):
            self.selected_index = max(0, len(self.users) - 1)

    def _draw_interface(self):
        """Draw the user interface"""
        self.stdscr.clear()

        # Draw header
        header = " ChurchLink Admin User Management "
        header_pad = (self.width - len(header)) // 2
        self.stdscr.addstr(0, 0, " " * header_pad, curses.color_pair(1))
        self.stdscr.addstr(0, header_pad, header, curses.color_pair(1))
        self.stdscr.addstr(0, header_pad + len(header), " " * (self.width - header_pad - len(header)), curses.color_pair(1))

        # Draw search instructions at the top
        search_help = "Press '/' or 's' to enter search mode, 'q' to quit"
        search_help_pad = (self.width - len(search_help)) // 2
        self.stdscr.addstr(1, 0, " " * search_help_pad, curses.color_pair(2))
        self.stdscr.addstr(1, search_help_pad, search_help, curses.color_pair(2))
        self.stdscr.addstr(1, search_help_pad + len(search_help), " " * (self.width - search_help_pad - len(search_help)), curses.color_pair(2))

        # Draw search box
        search_label = "Search by email: "
        self.stdscr.addstr(3, 0, search_label, curses.color_pair(2))
        self.stdscr.addstr(3, len(search_label), self.search_query, curses.color_pair(2) | curses.A_BOLD)

        # Draw cursor in search box
        cursor_pos = len(search_label) + len(self.search_query)
        if cursor_pos < self.width:
            self.stdscr.addstr(3, cursor_pos, " ", curses.color_pair(2) | curses.A_REVERSE)

        # Draw user count
        if self.search_query:
            count_text = f"Found {len(self.users)} users (filtered by: '{self.search_query}')"
        else:
            count_text = f"Found {len(self.users)} users"
        self.stdscr.addstr(4, 0, count_text, curses.color_pair(2))

        # Draw user list
        list_start_y = 6
        visible_rows = self.height - list_start_y - 3  # Leave space for instructions

        for i, user in enumerate(self.users):
            if i >= visible_rows:
                break

            y_pos = list_start_y + i

            # Highlight selected user
            color = curses.color_pair(5) if i == self.selected_index else curses.color_pair(2)

            # Format user info
            email = user.get('email', 'No email')
            name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            uid = user.get('uid', 'No UID')[:8] + "..."

            # Get admin status
            if i < len(self.user_details):
                details = self.user_details[i]
                admin_indicator = " [ADMIN]" if details['is_admin'] else ""
                role_count = details['role_count']
            else:
                admin_indicator = ""
                role_count = 0

            # Create display line
            display_line = f"{email:<30} | {name:<20} | {uid:<12} | {role_count} roles{admin_indicator}"

            # Truncate if too long
            if len(display_line) > self.width - 2:
                display_line = display_line[:self.width - 5] + "..."

            self.stdscr.addstr(y_pos, 0, display_line, color)

        # Draw instructions
        instructions_y = self.height - 3
        instructions = [
            "↑/↓/k/j: Navigate | Enter: Toggle admin | / or s: Search | q: Quit | h: Help"
        ]

        for i, instruction in enumerate(instructions):
            if instructions_y + i < self.height:
                self.stdscr.addstr(instructions_y + i, 0, instruction, curses.color_pair(2))

        self.stdscr.refresh()

    def _handle_input(self):
        """Handle user input"""
        try:
            key = self.stdscr.getch()

            if key == ord('q') or key == 27:  # q or ESC
                raise KeyboardInterrupt
            elif key == ord('/') or key == ord('s'):  # / or s for search
                # Start search mode
                self._search_mode()
            elif key == curses.KEY_UP or key == ord('k'):  # Up arrow or k
                self.selected_index = max(0, self.selected_index - 1)
            elif key == curses.KEY_DOWN or key == ord('j'):  # Down arrow or j
                self.selected_index = min(len(self.users) - 1, self.selected_index + 1)
            elif key == 10 or key == 13:  # Enter
                if self.users:
                    self._toggle_admin()
            elif key == ord('h'):
                self._show_help()
            elif key > 0:
                # Debug: show key code for unknown keys
                self.stdscr.addstr(self.height - 2, 0, f"Key pressed: {key} ({chr(key) if 32 <= key <= 126 else 'special'})", curses.color_pair(3))
                self.stdscr.refresh()
                self.stdscr.getch()  # Wait for another key to clear the message

        except curses.error:
            pass

    def _search_mode(self):
        """Enter search mode"""
        curses.curs_set(1)  # Show cursor
        original_query = self.search_query  # Save original query in case user cancels

        # Show search prompt
        search_prompt = "SEARCH MODE: Type email to filter, ESC to cancel, Enter to confirm"
        self.stdscr.addstr(1, 0, search_prompt, curses.color_pair(4))
        self.stdscr.refresh()

        while True:
            self._draw_interface()
            # Redraw the search prompt
            self.stdscr.addstr(1, 0, search_prompt, curses.color_pair(4))

            # Position cursor in search field
            cursor_pos = len("Search by email: ") + len(self.search_query)
            if cursor_pos < self.width:
                self.stdscr.move(3, cursor_pos)
            self.stdscr.refresh()

            key = self.stdscr.getch()

            if key == 27:  # ESC - cancel search
                self.search_query = original_query
                break
            elif key == 10 or key == 13:  # Enter - confirm search
                break
            elif key == curses.KEY_BACKSPACE or key == 127 or key == ord('\b'):
                if self.search_query:  # Only delete if there's something to delete
                    self.search_query = self.search_query[:-1]
            elif 32 <= key <= 126:  # Printable characters
                self.search_query += chr(key)
            # Update user list immediately when search changes
            self.loop.run_until_complete(self._update_user_list())

        curses.curs_set(0)  # Hide cursor

    def _toggle_admin(self):
        """Toggle admin privileges for selected user"""
        if not self.users or self.selected_index >= len(self.users):
            return

        user = self.users[self.selected_index]

        # Check if user is admin
        is_admin = False
        if self.selected_index < len(self.user_details):
            is_admin = self.user_details[self.selected_index]['is_admin']

        try:
            if is_admin:
                success = self.loop.run_until_complete(self.admin_manager.revoke_admin_privileges(user))
            else:
                success = self.loop.run_until_complete(self.admin_manager.grant_admin_privileges(user))

            # Wait for user to see result
            self.stdscr.addstr(self.height - 1, 0, "Press any key to continue...", curses.color_pair(4) if success else curses.color_pair(3))
            self.stdscr.refresh()
            self.stdscr.getch()

        except Exception as e:
            # Handle any errors
            error_msg = f"Error: {str(e)}"
            if len(error_msg) > self.width - 2:
                error_msg = error_msg[:self.width - 5] + "..."
            self.stdscr.addstr(self.height - 1, 0, error_msg, curses.color_pair(3))
            self.stdscr.refresh()
            self.stdscr.getch()

    def _show_help(self):
        """Show help screen"""
        self.stdscr.clear()

        help_lines = [
            "ChurchLink Admin User Management - Help",
            "",
            "Navigation:",
            "  ↑/↓        - Navigate user list",
            "  Enter       - Toggle admin privileges for selected user",
            "  /           - Enter search mode",
            "  q or ESC    - Quit application",
            "  h           - Show this help",
            "",
            "Search:",
            "  Type email address or part of it",
            "  Press ESC or Enter to exit search mode",
            "",
            "Admin Management:",
            "  Green [ADMIN] indicator shows admin users",
            "  Press Enter on a user to grant/revoke admin privileges",
            "  Both MongoDB roles and Firebase claims are updated",
            "",
            "Press any key to return..."
        ]

        for i, line in enumerate(help_lines):
            if i < self.height:
                self.stdscr.addstr(i, 0, line, curses.color_pair(2))

        self.stdscr.refresh()
        self.stdscr.getch()


def interactive_mode():
    """Run the interactive curses-based interface"""
    # Create new event loop for this session
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        admin_manager = AdminManager()
        loop.run_until_complete(admin_manager.initialize())

        ui = UserInterface(admin_manager)
        ui.loop = loop  # Pass the loop to the UI

        curses.wrapper(ui.run)
    except KeyboardInterrupt:
        logger.info("Goodbye!")
    except Exception as e:
        logger.error(f"Error: {str(e)}")
    finally:
        loop.close()


def direct_mode(email: str, grant: bool = True):
    """Direct mode for granting/revoking admin privileges via command line"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        admin_manager = AdminManager()
        loop.run_until_complete(admin_manager.initialize())

        # Search for user by exact email
        users = loop.run_until_complete(DatabaseManager.find_documents("users", {"email": email}))

        if not users:
            logger.error(f"User with email '{email}' not found")
            return False

        if len(users) > 1:
            logger.error(f"Multiple users found with email '{email}'. Use interactive mode for selection.")
            return False

        user = users[0]
        logger.info(f"Found user: {user.get('email')} ({user.get('first_name')} {user.get('last_name')})")

        if grant:
            return loop.run_until_complete(admin_manager.grant_admin_privileges(user))
        else:
            return loop.run_until_complete(admin_manager.revoke_admin_privileges(user))
    finally:
        loop.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="ChurchLink Admin User Management Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                           # Interactive mode
  %(prog)s --email user@example.com  # Grant admin to specific user
  %(prog)s --email user@example.com --revoke  # Revoke admin from user
        """
    )

    parser.add_argument(
        '--email',
        help='Email address of user to modify (direct mode)'
    )

    parser.add_argument(
        '--revoke',
        action='store_true',
        help='Revoke admin privileges instead of granting'
    )

    parser.add_argument(
        '--search',
        help='Search query for email (starts interactive mode with search)'
    )

    args = parser.parse_args()

    if args.email:
        # Direct mode
        success = direct_mode(args.email, not args.revoke)
        sys.exit(0 if success else 1)
    else:
        # Interactive mode
        if args.search:
            # Set initial search query
            pass  # This would require modifying the UI class

        interactive_mode()


if __name__ == "__main__":
    main()
