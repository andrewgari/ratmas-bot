"""Button handlers for Reminder and Escalate functionality."""

import logging
from typing import TYPE_CHECKING

import discord
from discord import ui

if TYPE_CHECKING:
    from ..database import RatmasDB
    from .conversation_handler import ConversationHandler

logger = logging.getLogger(__name__)


class ReminderButton(ui.Button):
    """Button to resend message and notify manager."""

    def __init__(
        self, sender_id: int, receiver_id: int, original_message: str, bot, db: "RatmasDB"
    ):
        super().__init__(label="🔔 Send Reminder", style=discord.ButtonStyle.primary)
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        self.original_message = original_message
        self.bot = bot
        self.db = db

    async def callback(self, interaction: discord.Interaction):
        """Handle reminder button click."""
        # Resend message to receiver
        try:
            receiver = await self.bot.fetch_user(self.receiver_id)
            await receiver.send(
                f"🔔 **Reminder - Message from someone receiving your gifts:**\n\n{self.original_message}"
            )
        except Exception as e:
            logger.error(f"Failed to resend message to {self.receiver_id}: {e}")

        # Notify manager
        from ..config import Config

        try:
            manager = await self.bot.fetch_user(Config.MANAGER_USER_ID)
            await manager.send(
                f"🔔 **Reminder Sent**\n\n"
                f"User <@{self.sender_id}> sent a reminder to <@{self.receiver_id}>.\n\n"
                f"Original message:\n{self.original_message}"
            )
        except Exception as e:
            logger.error(f"Failed to notify manager about reminder: {e}")

        # Confirm to user
        await interaction.response.send_message(
            "✅ **Reminder sent!**\n\n"
            "Your message has been resent to your gift recipient, and the manager has been notified in case follow-up is needed.",
            ephemeral=True,
        )
        logger.info(f"Reminder sent from {self.sender_id} to {self.receiver_id}")


class EscalateModal(ui.Modal, title="Escalate to Manager"):
    """Modal for escalation message."""

    message = ui.TextInput(
        label="What's the issue?",
        style=discord.TextStyle.paragraph,
        placeholder="Describe the problem you're experiencing...",
        required=True,
        max_length=1000,
    )

    def __init__(
        self, sender_id: int, receiver_id: int, original_message: str, bot, db: "RatmasDB"
    ):
        super().__init__()
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        self.original_message = original_message
        self.bot = bot
        self.db = db

    async def on_submit(self, interaction: discord.Interaction):
        """Handle modal submission."""
        # Send to manager
        from ..config import Config

        try:
            manager = await self.bot.fetch_user(Config.MANAGER_USER_ID)
            await manager.send(
                f"🚨 **Escalation from <@{self.sender_id}>**\n\n"
                f"**Their issue:**\n{self.message.value}\n\n"
                f"**Context:**\n"
                f"Sender: <@{self.sender_id}>\n"
                f"Receiver: <@{self.receiver_id}>\n\n"
                f"**Original message:**\n{self.original_message}"
            )

            await interaction.response.send_message(
                "✅ Your issue has been escalated to the manager. They'll help you soon!",
                ephemeral=True,
            )
            logger.info(f"Escalation from {self.sender_id}: {self.message.value}")

        except Exception as e:
            logger.error(f"Failed to send escalation to manager: {e}")
            await interaction.response.send_message(
                "❌ Failed to escalate. Please contact the manager directly.", ephemeral=True
            )


class EscalateButton(ui.Button):
    """Button to escalate to manager."""

    def __init__(
        self, sender_id: int, receiver_id: int, original_message: str, bot, db: "RatmasDB"
    ):
        super().__init__(label="⚠️ Report Issue", style=discord.ButtonStyle.danger)
        self.sender_id = sender_id
        self.receiver_id = receiver_id
        self.original_message = original_message
        self.bot = bot
        self.db = db

    async def callback(self, interaction: discord.Interaction):
        """Handle escalate button click."""
        modal = EscalateModal(
            self.sender_id, self.receiver_id, self.original_message, self.bot, self.db
        )
        await interaction.response.send_modal(modal)


class ReplyModal(ui.Modal, title="Reply to Sender"):
    """Modal for replying to sender."""

    message = ui.TextInput(
        label="Your reply",
        style=discord.TextStyle.paragraph,
        placeholder="Type your message here...",
        required=True,
        max_length=2000,
    )

    def __init__(
        self,
        receiver_id: int,
        sender_id: int,
        bot,
        db: "RatmasDB",
        conv_handler: "ConversationHandler",
    ):
        super().__init__()
        self.receiver_id = receiver_id
        self.sender_id = sender_id
        self.bot = bot
        self.db = db
        self.conv_handler = conv_handler

    async def on_submit(self, interaction: discord.Interaction):
        """Handle reply modal submission."""
        try:
            # Set mode to sender
            self.conv_handler.set_mode(self.receiver_id, "sender")

            # Send message to sender
            sender = await self.bot.fetch_user(self.sender_id)
            await sender.send(
                f"📬 **Reply from someone receiving your gifts:**\n\n{self.message.value}"
            )

            # Update conversation context
            self.conv_handler.record_message_sent(self.receiver_id, self.sender_id)
            self.conv_handler.record_message_received(self.sender_id, self.receiver_id)

            await interaction.response.send_message(
                "✅ **Reply sent!**\n\nYour message has been delivered. "
                "Any regular DMs you send will now go to this person until you use "
                "the 'Message My Recipient' button.",
                ephemeral=True,
            )
            logger.info(f"Reply sent from {self.receiver_id} to {self.sender_id}")

        except Exception as e:
            logger.error(f"Failed to send reply from {self.receiver_id} to {self.sender_id}: {e}")
            await interaction.response.send_message(
                "❌ Failed to send reply. Please try again.", ephemeral=True
            )


class MessageRecipientModal(ui.Modal, title="Message My Recipient"):
    """Modal for messaging official recipient."""

    message = ui.TextInput(
        label="Your message",
        style=discord.TextStyle.paragraph,
        placeholder="Type your message here...",
        required=True,
        max_length=2000,
    )

    def __init__(self, user_id: int, bot, db: "RatmasDB", conv_handler: "ConversationHandler"):
        super().__init__()
        self.user_id = user_id
        self.bot = bot
        self.db = db
        self.conv_handler = conv_handler

    async def on_submit(self, interaction: discord.Interaction):
        """Handle message recipient modal submission."""
        try:
            # Set mode to recipient
            self.conv_handler.set_mode(self.user_id, "recipient")

            # Get official recipient
            assignment = self.db.get_official_assignment(self.user_id)
            if not assignment:
                await interaction.response.send_message(
                    "❌ **You haven't chosen a recipient yet!**\n\n"
                    "Wait for the assignment DM and select who you're sending gifts to.",
                    ephemeral=True,
                )
                return

            recipient_id = assignment["receiver_id"]

            # Send message to recipient
            recipient = await self.bot.fetch_user(recipient_id)
            await recipient.send(
                f"📬 **Message from someone receiving your gifts:**\n\n{self.message.value}"
            )

            # Update conversation context
            self.conv_handler.record_message_sent(self.user_id, recipient_id)
            self.conv_handler.record_message_received(recipient_id, self.user_id)

            await interaction.response.send_message(
                "✅ **Message sent to your recipient!**\n\n"
                "Your message has been delivered. Any regular DMs you send will now "
                "go to your official recipient.",
                ephemeral=True,
            )
            logger.info(f"Message sent from {self.user_id} to recipient {recipient_id}")

        except Exception as e:
            logger.error(f"Failed to send message from {self.user_id} to recipient: {e}")
            await interaction.response.send_message(
                "❌ Failed to send message. Please try again.", ephemeral=True
            )


class ReplyToSenderButton(ui.Button):
    """Button to reply to the person who sent you this message."""

    def __init__(
        self,
        receiver_id: int,
        sender_id: int,
        bot,
        db: "RatmasDB",
        conv_handler: "ConversationHandler",
    ):
        super().__init__(label="💬 Reply to Sender", style=discord.ButtonStyle.primary)
        self.receiver_id = receiver_id
        self.sender_id = sender_id
        self.bot = bot
        self.db = db
        self.conv_handler = conv_handler

    async def callback(self, interaction: discord.Interaction):
        """Handle reply to sender button click."""
        modal = ReplyModal(self.receiver_id, self.sender_id, self.bot, self.db, self.conv_handler)
        await interaction.response.send_modal(modal)


class MessageRecipientButton(ui.Button):
    """Button to send a new message to your official recipient."""

    def __init__(self, user_id: int, bot, db: "RatmasDB", conv_handler: "ConversationHandler"):
        super().__init__(label="📤 Message My Recipient", style=discord.ButtonStyle.secondary)
        self.user_id = user_id
        self.bot = bot
        self.db = db
        self.conv_handler = conv_handler

    async def callback(self, interaction: discord.Interaction):
        """Handle message recipient button click."""
        modal = MessageRecipientModal(self.user_id, self.bot, self.db, self.conv_handler)
        await interaction.response.send_modal(modal)


def create_message_buttons(
    sender_id: int, receiver_id: int, original_message: str, bot, db: "RatmasDB"
) -> ui.View:
    """Create a view with Reminder and Escalate buttons."""
    view = ui.View(timeout=None)
    view.add_item(ReminderButton(sender_id, receiver_id, original_message, bot, db))
    view.add_item(EscalateButton(sender_id, receiver_id, original_message, bot, db))
    return view


def create_message_view(
    sender_id: int,
    receiver_id: int,
    original_message: str,
    bot,
    db: "RatmasDB",
    conv_handler: "ConversationHandler",
) -> ui.View:
    """Create a view with all message interaction buttons."""
    view = ui.View(timeout=None)

    # Add reply buttons
    view.add_item(ReplyToSenderButton(receiver_id, sender_id, bot, db, conv_handler))
    view.add_item(MessageRecipientButton(receiver_id, bot, db, conv_handler))

    # Add existing buttons
    view.add_item(ReminderButton(sender_id, receiver_id, original_message, bot, db))
    view.add_item(EscalateButton(sender_id, receiver_id, original_message, bot, db))

    return view
