"""Handle DM messages and relay system."""

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Dict, List

import discord

if TYPE_CHECKING:
    from ..database import RatmasDB
    from .conversation_handler import ConversationHandler

logger = logging.getLogger(__name__)


class DMHandler:
    """Handle DM relay system with message combining."""

    def __init__(self, bot, db: "RatmasDB", conv_handler: "ConversationHandler"):
        """Initialize DM handler."""
        self.bot = bot
        self.db = db
        self.conv_handler = conv_handler
        # Track pending messages for combining: {user_id: [(message, timestamp), ...]}
        self.pending_messages: Dict[int, List[tuple]] = {}
        # Track active relay tasks
        self.relay_tasks: Dict[int, asyncio.Task] = {}

    async def handle_dm(self, message: discord.Message):
        """Handle incoming DM from a user."""
        user_id = message.author.id

        # Check if user is a participant
        user = self.db.get_user(user_id)
        if not user:
            # Not a participant, ignore
            return

        # Add message to pending queue
        if user_id not in self.pending_messages:
            self.pending_messages[user_id] = []

        self.pending_messages[user_id].append((message.content, time.time()))

        # Cancel existing relay task if any
        if user_id in self.relay_tasks:
            self.relay_tasks[user_id].cancel()

        # Start new relay task with delay
        from ..config import Config

        self.relay_tasks[user_id] = asyncio.create_task(self._relay_after_delay(user_id))

    async def _relay_after_delay(self, sender_id: int):
        """Wait for message combining window, then relay."""
        from ..config import Config

        await asyncio.sleep(Config.MESSAGE_COMBINE_WINDOW_SECONDS)

        # Get all pending messages
        messages = self.pending_messages.get(sender_id, [])
        if not messages:
            return

        # Combine messages
        combined_text = "\n\n".join(msg[0] for msg in messages)

        # Clear pending messages
        self.pending_messages[sender_id] = []

        # Determine destination using conversation context
        context = self.db.get_conversation_context(sender_id)
        destination_id = None
        is_reply = False

        if context and context.get("mode") == "sender":
            # User is replying to their sender
            destination_id = context.get("last_received_from")
            is_reply = True
            if not destination_id:
                # Fallback to official recipient if no sender context
                destination_id = self._get_official_destination(sender_id)
                is_reply = False
        else:
            # Default: send to official recipient
            destination_id = self._get_official_destination(sender_id)

        if not destination_id:
            return

        # Send message
        await self._forward_message(sender_id, destination_id, combined_text, is_reply)

    def _get_official_destination(self, user_id: int) -> int:
        """Get the official recipient for a user."""
        assignment = self.db.get_official_assignment(user_id)
        if not assignment:
            # No official assignment, can't relay
            logger.warning(f"User {user_id} tried to send DM but has no official assignment")
            return None
        return assignment["receiver_id"]

    async def _forward_message(
        self, sender_id: int, receiver_id: int, text: str, is_reply: bool = False
    ):
        """Forward a message with appropriate buttons."""
        try:
            receiver = await self.bot.fetch_user(receiver_id)

            # Create view with all message buttons
            from .button_handler import create_message_view

            view = create_message_view(
                sender_id=sender_id,
                receiver_id=receiver_id,
                original_message=text,
                bot=self.bot,
                db=self.db,
                conv_handler=self.conv_handler,
            )

            # Determine message header
            if is_reply:
                header = "📬 **Reply from someone receiving your gifts:**"
            else:
                header = "📬 **Message from someone receiving your gifts:**"

            # Send anonymous message
            await receiver.send(
                f"{header}\n\n{text}\n\n"
                f"━━━━━━━━━━━━━━━━━━━━━━\n"
                f"💡 **Quick actions:**\n"
                f"• **Reply to Sender** - Respond to this message\n"
                f"• **Message My Recipient** - Send to your official recipient\n"
                f"• **Send Reminder** - Resend this message to your gift giver\n"
                f"• **Report Issue** - Contact the manager",
                view=view,
            )

            # Update conversation context
            self.conv_handler.record_message_sent(sender_id, receiver_id)
            self.conv_handler.record_message_received(receiver_id, sender_id)

            # Confirm to sender
            sender = await self.bot.fetch_user(sender_id)
            await sender.send(
                "✅ **Message delivered!**\n\n"
                "Your message has been sent. They can reply using the button in their message!"
            )

            logger.info(f"Relayed message from {sender_id} to {receiver_id} (reply={is_reply})")

        except discord.Forbidden:
            # Receiver has DMs disabled
            logger.error(f"Failed to relay message to {receiver_id}: DMs disabled")

            # Notify manager
            from ..config import Config

            try:
                manager = await self.bot.fetch_user(Config.MANAGER_USER_ID)
                await manager.send(
                    f"⚠️ **DM Relay Failed**\n\n"
                    f"User <@{receiver_id}> has DMs disabled and couldn't receive a message.\n"
                    f"Please ask them to enable DMs from server members."
                )
            except Exception as e:
                logger.error(f"Failed to notify manager about DM failure: {e}")

            # Notify sender
            try:
                sender = await self.bot.fetch_user(sender_id)
                await sender.send(
                    "❌ Your message couldn't be delivered because your rat has DMs disabled.\n"
                    "The manager has been notified."
                )
            except Exception as e:
                logger.error(f"Failed to notify sender about DM failure: {e}")

        except Exception as e:
            logger.error(f"Failed to relay message from {sender_id} to {receiver_id}: {e}")
