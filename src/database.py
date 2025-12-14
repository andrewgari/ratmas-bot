"""Redis database layer for Ratmas bot."""

import json
from datetime import datetime
from typing import Dict, List, Optional

import redis

from .config import Config


class RatmasDB:
    """Database interface for Ratmas bot using Redis."""

    def __init__(self):
        """Initialize Redis connection."""
        self.redis = redis.Redis(
            host=Config.REDIS_HOST,
            port=Config.REDIS_PORT,
            password=Config.REDIS_PASSWORD if Config.REDIS_PASSWORD else None,
            db=Config.REDIS_DB,
            decode_responses=True,
        )

    # Season Management

    def is_season_active(self) -> bool:
        """Check if a Ratmas season is currently active."""
        return self.redis.exists("ratmas:active") == 1

    def start_season(self):
        """Start a new Ratmas season."""
        self.redis.set("ratmas:active", "1")
        self.redis.set("ratmas:started_at", datetime.now().isoformat())

    def end_season(self, archive: bool = True):
        """End the current season, optionally archiving data."""
        if archive:
            timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            self._archive_data(timestamp)

        # Delete all current season data
        self._delete_season_data()

    def _archive_data(self, timestamp: str):
        """Archive current season data with timestamp."""
        # Archive users
        users = self.redis.hgetall("ratmas:users")
        if users:
            self.redis.hset(f"ratmas:archive:{timestamp}:users", mapping=users)

        # Archive assignments
        assignments = self.redis.hgetall("ratmas:assignments")
        if assignments:
            self.redis.hset(f"ratmas:archive:{timestamp}:assignments", mapping=assignments)

        # Archive metadata
        metadata = {
            "started_at": self.redis.get("ratmas:started_at") or "",
            "ended_at": datetime.now().isoformat(),
        }
        self.redis.hset(f"ratmas:archive:{timestamp}:metadata", mapping=metadata)

    def _delete_season_data(self):
        """Delete all current season data."""
        keys_to_delete = []
        for key in self.redis.scan_iter("ratmas:*"):
            if not key.startswith("ratmas:archive:"):
                keys_to_delete.append(key)

        if keys_to_delete:
            self.redis.delete(*keys_to_delete)

    # User Management

    def add_user(self, user_id: int, display_name: str):
        """Add a user to the current season.

        Args:
            user_id: Discord user ID
            display_name: Server nickname if set, otherwise username (NOT the @handle)
        """
        user_data = json.dumps({"user_id": user_id, "display_name": display_name})
        self.redis.hset("ratmas:users", str(user_id), user_data)

    def get_user(self, user_id: int) -> Optional[Dict]:
        """Get user data by ID."""
        data = self.redis.hget("ratmas:users", str(user_id))
        return json.loads(data) if data else None

    def get_all_users(self) -> List[Dict]:
        """Get all users in the current season."""
        users_data = self.redis.hgetall("ratmas:users")
        return [json.loads(data) for data in users_data.values()]

    def remove_user(self, user_id: int):
        """Remove a user and their assignments."""
        # Remove user
        self.redis.hdel("ratmas:users", str(user_id))

        # Remove their assignments
        assignments = self.get_all_assignments()
        for assignment in assignments:
            if assignment["sender_id"] == user_id or assignment["receiver_id"] == user_id:
                self.remove_assignment(assignment["sender_id"], assignment["receiver_id"])

    # Assignment Management

    def add_assignment(
        self, sender_id: int, receiver_id: int, is_official: bool = True, packages_count: int = 0
    ):
        """Add or update an assignment."""
        key = f"{sender_id}:{receiver_id}"
        assignment_data = json.dumps(
            {
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "is_official": is_official,
                "packages_count": packages_count,
            }
        )
        self.redis.hset("ratmas:assignments", key, assignment_data)

    def get_assignment(self, sender_id: int, receiver_id: int) -> Optional[Dict]:
        """Get a specific assignment."""
        key = f"{sender_id}:{receiver_id}"
        data = self.redis.hget("ratmas:assignments", key)
        return json.loads(data) if data else None

    def get_official_assignment(self, sender_id: int) -> Optional[Dict]:
        """Get the official assignment for a sender (who they're sending to)."""
        assignments = self.get_all_assignments()
        for assignment in assignments:
            if assignment["sender_id"] == sender_id and assignment.get("is_official"):
                return assignment
        return None

    def get_all_assignments(self) -> List[Dict]:
        """Get all assignments."""
        assignments_data = self.redis.hgetall("ratmas:assignments")
        return [json.loads(data) for data in assignments_data.values()]

    def remove_assignment(self, sender_id: int, receiver_id: int):
        """Remove a specific assignment."""
        key = f"{sender_id}:{receiver_id}"
        self.redis.hdel("ratmas:assignments", key)

    def has_official_sender(self, receiver_id: int) -> bool:
        """Check if a receiver already has an official sender."""
        assignments = self.get_all_assignments()
        for assignment in assignments:
            if assignment["receiver_id"] == receiver_id and assignment.get("is_official"):
                return True
        return False

    def get_available_receivers(self, exclude_user_id: int) -> List[int]:
        """Get list of user IDs that don't have an official sender yet (excluding specified user)."""
        all_users = self.get_all_users()
        available = []

        for user in all_users:
            user_id = user["user_id"]
            if user_id != exclude_user_id and not self.has_official_sender(user_id):
                available.append(user_id)

        return available

    # Package Tracking

    def update_package_count(
        self, sender_id: int, receiver_id: int, count: int, is_official: bool = False
    ):
        """Update package count for a sender->receiver relationship."""
        # Check if assignment exists
        assignment = self.get_assignment(sender_id, receiver_id)

        if assignment:
            # Update existing
            assignment["packages_count"] = count
            key = f"{sender_id}:{receiver_id}"
            self.redis.hset("ratmas:assignments", key, json.dumps(assignment))
        else:
            # Create new assignment (rogue package)
            self.add_assignment(
                sender_id, receiver_id, is_official=is_official, packages_count=count
            )

    def get_total_packages_for_receiver(self, receiver_id: int) -> int:
        """Get total package count coming to a receiver from all senders."""
        assignments = self.get_all_assignments()
        total = 0

        for assignment in assignments:
            if assignment["receiver_id"] == receiver_id:
                total += assignment.get("packages_count", 0)

        return total

    def get_official_senders(self, receiver_id: int) -> List[Dict]:
        """Get all users who have receiver_id as their official recipient."""
        assignments = self.get_all_assignments()
        return [a for a in assignments if a["receiver_id"] == receiver_id and a.get("is_official")]

    # Conversation Context Management

    def get_conversation_context(self, user_id: int) -> Optional[Dict]:
        """Get conversation context for a user."""
        data = self.redis.get(f"ratmas:conversation:{user_id}")
        return json.loads(data) if data else None

    def set_conversation_context(self, user_id: int, context: Dict):
        """Set conversation context with 24hr expiration."""
        key = f"ratmas:conversation:{user_id}"
        # 86400 seconds = 24 hours
        self.redis.setex(key, 86400, json.dumps(context))

    def clear_conversation_context(self, user_id: int):
        """Clear conversation context for a user."""
        self.redis.delete(f"ratmas:conversation:{user_id}")
