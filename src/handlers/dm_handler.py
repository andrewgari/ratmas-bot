"""Handle DM messages and relay system."""

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Dict, List

import discord

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


class DMHandler:
    """Handle DM relay system with message combining."""

    def __init__(self, bot, db: "RatmasDB"):
        """Initialize DM handler."""
        self.bot = bot
        self.db = db
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

        # Get receiver (the sender's official rat)
        assignment = self.db.get_official_assignment(sender_id)
        if not assignment:
            # No official assignment, can't relay
            logger.warning(f"User {sender_id} tried to send DM but has no official assignment")
            return

        receiver_id = assignment["receiver_id"]

        # Send to receiver
        try:
            receiver = await self.bot.fetch_user(receiver_id)

            # Create view with Reminder and Escalate buttons
            from .button_handler import create_message_buttons

            view = create_message_buttons(
                sender_id=sender_id,
                receiver_id=receiver_id,
                original_message=combined_text,
                bot=self.bot,
                db=self.db,
            )

            # Send anonymous message
            await receiver.send(
                f"📬 **Message from someone receiving your gifts:**\n\n{combined_text}", view=view
            )

            # Confirm to sender
            sender = await self.bot.fetch_user(sender_id)
            await sender.send("✅ Your message has been delivered anonymously to your rat!")

            logger.info(f"Relayed message from {sender_id} to {receiver_id}")

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
