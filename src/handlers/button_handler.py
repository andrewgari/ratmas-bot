"""Button handlers for Reminder and Escalate functionality."""

import logging
from typing import TYPE_CHECKING

import discord
from discord import ui

if TYPE_CHECKING:
    from ..database import RatmasDB

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
            ephemeral=True
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


def create_message_buttons(
    sender_id: int, receiver_id: int, original_message: str, bot, db: "RatmasDB"
) -> ui.View:
    """Create a view with Reminder and Escalate buttons."""
    view = ui.View(timeout=None)
    view.add_item(ReminderButton(sender_id, receiver_id, original_message, bot, db))
    view.add_item(EscalateButton(sender_id, receiver_id, original_message, bot, db))
    return view
