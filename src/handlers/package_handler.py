"""Package count update handler."""

import asyncio
import logging
from typing import TYPE_CHECKING, Optional

import discord
from discord import ui

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


class PackageCountModal(ui.Modal, title="Enter Package Count"):
    """Modal for entering package count."""

    def __init__(
        self,
        sender_id: int,
        target_user_id: int,
        target_display_name: str,
        is_official: bool,
        db: "RatmasDB",
    ):
        super().__init__()
        self.sender_id = sender_id
        self.target_user_id = target_user_id
        self.target_display_name = target_display_name
        self.is_official = is_official
        self.db = db

        self.count_input = ui.TextInput(
            label=f"Packages for {target_display_name}",
            placeholder="Enter a number (0-99)",
            required=True,
            max_length=2,
            default="0",
        )
        self.add_item(self.count_input)

    async def on_submit(self, interaction: discord.Interaction):
        try:
            count = int(self.count_input.value)
            if count < 0:
                try:
                    await interaction.response.send_message(
                        "❌ Count must be 0 or greater!", ephemeral=True
                    )
                except Exception as e:
                    logger.error(f"Failed to send error response: {e}")
                return

            # Update the database FIRST (so it saves even if Discord response fails)
            self.db.update_package_count(
                self.sender_id, self.target_user_id, count, is_official=self.is_official
            )
            logger.info(f"User {self.sender_id} set {count} packages for {self.target_user_id}")

            # Try to send confirmation (with retry on network error)
            star = "⭐ " if self.is_official else ""
            message = f"✅ Updated: **{count}** packages → {star}{self.target_display_name}"

            for attempt in range(3):
                try:
                    await interaction.response.send_message(message, ephemeral=True)
                    break
                except Exception as e:
                    if attempt < 2:
                        logger.warning(f"Retry {attempt+1}/3 sending response: {e}")
                        await asyncio.sleep(1)
                    else:
                        logger.error(f"Failed to send confirmation after 3 attempts: {e}")
                        # Data is still saved, just couldn't confirm to user

        except ValueError:
            try:
                await interaction.response.send_message(
                    "❌ Please enter a valid number!", ephemeral=True
                )
            except Exception as e:
                logger.error(f"Failed to send error response: {e}")


class RecipientSelect(ui.Select):
    """Dropdown for selecting which recipient to update."""

    def __init__(
        self, sender_id: int, all_users: list, official_receiver_id: Optional[int], db: "RatmasDB"
    ):
        self.sender_id = sender_id
        self.db = db
        self.official_receiver_id = official_receiver_id

        # Create options for all users except sender
        options = []
        for user in all_users:
            if user["user_id"] != sender_id:
                is_official = (
                    official_receiver_id is not None and user["user_id"] == official_receiver_id
                )
                label_prefix = "⭐ " if is_official else ""
                options.append(
                    discord.SelectOption(
                        label=f"{label_prefix}{user['display_name']}",
                        value=str(user["user_id"]),
                        description="Your official rat" if is_official else None,
                    )
                )

        # Handle empty options (sender is the only participant)
        if not options:
            options.append(
                discord.SelectOption(
                    label="No recipients available",
                    value="none",
                    description="No other participants in the event",
                )
            )

        super().__init__(
            placeholder="Select a recipient to update...",
            options=options,
            min_values=1,
            max_values=1,
        )

    async def callback(self, interaction: discord.Interaction):
        """Show modal to enter package count."""
        target_user_id_str = self.values[0]

        # Handle "no recipients available" case
        if target_user_id_str == "none":
            await interaction.response.send_message("❌ No recipients available.", ephemeral=True)
            return

        target_user_id = int(target_user_id_str)
        target_user = self.db.get_user(target_user_id)
        is_official = (
            self.official_receiver_id is not None and target_user_id == self.official_receiver_id
        )

        modal = PackageCountModal(
            self.sender_id, target_user_id, target_user["display_name"], is_official, self.db
        )

        # Try to send modal with retry
        for attempt in range(3):
            try:
                await interaction.response.send_modal(modal)
                break
            except Exception as e:
                if attempt < 2:
                    logger.warning(f"Retry {attempt+1}/3 sending modal: {e}")
                    await asyncio.sleep(1)
                else:
                    logger.error(f"Failed to send modal after 3 attempts: {e}")


class PackageUpdateView(ui.View):
    """View with recipient selector and done button."""

    def __init__(
        self,
        sender_id: int,
        all_users: list,
        official_receiver_id: Optional[int],
        bot,
        db: "RatmasDB",
    ):
        super().__init__(timeout=600)  # 10 minute timeout
        self.sender_id = sender_id
        self.bot = bot
        self.db = db

        # Add recipient selector
        self.add_item(RecipientSelect(sender_id, all_users, official_receiver_id, db))

        # Add done button
        done_button = ui.Button(label="✅ Done", style=discord.ButtonStyle.success, row=1)
        done_button.callback = self.done_callback
        self.add_item(done_button)

    async def done_callback(self, interaction: discord.Interaction):
        """Handle done button."""
        try:
            await interaction.response.send_message(
                "✅ **All done!** Your package counts have been saved.", ephemeral=True
            )
        except Exception as e:
            logger.error(f"Failed to send done confirmation: {e}")
        logger.info(f"User {self.sender_id} finished updating package counts")


async def send_package_update_dm(bot, db: "RatmasDB", member: discord.Member):
    """Send package update DM to a member.

    Args:
        bot: Discord bot instance
        db: Database instance
        member: Discord Member object (has display_name with server nickname)
    """
    # Update the user's display name in database (in case nickname changed)
    db.add_user(member.id, member.display_name)

    all_users = db.get_all_users()

    # Get user's official assignment (if any)
    official_assignment = db.get_official_assignment(member.id)
    official_receiver_id = official_assignment["receiver_id"] if official_assignment else None

    view = PackageUpdateView(member.id, all_users, official_receiver_id, bot, db)

    message = "📦 **Tell Us How Many Packages You're Sending**\n\n"
    message += "We need to know how many packages each person should expect to receive.\n\n"

    if official_receiver_id:
        official_user = db.get_user(official_receiver_id)
        official_name = official_user["display_name"] if official_user else "Unknown"
        message += f"**Your official rat:** {official_name} ⭐\n"
        message += "This is the person you chose to send gifts to.\n\n"

    message += "**What to do:**\n"
    message += "1. Click the dropdown below\n"
    message += "2. Select a person's name\n"
    message += "3. Enter how many packages you're sending to THEM\n"
    message += "4. Repeat for anyone else you're sending packages to (optional)\n"
    message += "5. Click **Done** when finished\n\n"
    message += '**Example:** If you\'re sending 3 packages to your official rat, select their name and enter "3"\n\n'
    message += "**Note:** You can send to people other than your official rat if you want! "
    message += "Just select their name and enter the count."

    await member.send(message, view=view)
    logger.info(f"Sent package update DM to {member.display_name}")
