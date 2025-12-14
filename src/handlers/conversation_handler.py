"""Conversation context handler for bidirectional messaging."""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ..database import RatmasDB


class ConversationHandler:
    """Manages conversation context for bidirectional messaging."""

    def __init__(self, db: "RatmasDB"):
        """Initialize the conversation handler.

        Args:
            db: RatmasDB instance for context storage
        """
        self.db = db

    def record_message_sent(self, sender_id: int, receiver_id: int):
        """Update context when user sends a message.

        Args:
            sender_id: User who sent the message
            receiver_id: User who received the message
        """
        context = self.db.get_conversation_context(sender_id) or {}
        context["last_sent_to"] = receiver_id
        context["last_sent_at"] = datetime.now().isoformat()
        # Preserve mode if it exists, otherwise default to recipient
        if "mode" not in context:
            context["mode"] = "recipient"
        self.db.set_conversation_context(sender_id, context)

    def record_message_received(self, receiver_id: int, sender_id: int):
        """Update context when user receives a message.

        Args:
            receiver_id: User who received the message
            sender_id: User who sent the message
        """
        context = self.db.get_conversation_context(receiver_id) or {}
        context["last_received_from"] = sender_id
        context["last_received_at"] = datetime.now().isoformat()
        # Preserve mode if it exists, otherwise default to recipient
        if "mode" not in context:
            context["mode"] = "recipient"
        self.db.set_conversation_context(receiver_id, context)

    def get_destination(self, user_id: int, mode: Optional[str] = None) -> Optional[int]:
        """Get destination user ID based on mode.

        Args:
            user_id: User sending the message
            mode: Override mode ("sender" or "recipient"), or None to use context mode

        Returns:
            Destination user ID, or None if not available
        """
        context = self.db.get_conversation_context(user_id)

        # Determine which mode to use
        if mode is None:
            mode = context.get("mode", "recipient") if context else "recipient"

        if mode == "sender":
            # Reply to sender mode
            if context and "last_received_from" in context:
                return context["last_received_from"]
            return None
        else:
            # Default: send to official recipient
            assignment = self.db.get_official_assignment(user_id)
            return assignment["receiver_id"] if assignment else None

    def set_mode(self, user_id: int, mode: str):
        """Set conversation mode for user.

        Args:
            user_id: User to set mode for
            mode: Mode to set ("sender" or "recipient")
        """
        context = self.db.get_conversation_context(user_id) or {}
        context["mode"] = mode
        self.db.set_conversation_context(user_id, context)

    def get_mode(self, user_id: int) -> str:
        """Get current conversation mode for user.

        Args:
            user_id: User to get mode for

        Returns:
            Current mode ("sender" or "recipient"), defaults to "recipient"
        """
        context = self.db.get_conversation_context(user_id)
        return context.get("mode", "recipient") if context else "recipient"
