"""Assignment selection handler."""

import logging
from typing import TYPE_CHECKING, List

import discord
from discord import ui

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


class AssignmentSelect(ui.Select):
    """Dropdown for selecting who you're sending gifts to."""

    def __init__(self, user_id: int, all_users: List[dict], bot, db: "RatmasDB"):
        self.user_id = user_id
        self.bot = bot
        self.db = db

        # Create options (exclude self)
        options = []
        for user in all_users:
            if user["user_id"] != user_id:
                options.append(
                    discord.SelectOption(label=user["display_name"], value=str(user["user_id"]))
                )

        super().__init__(
            placeholder="Select who YOU are sending gifts to...",
            options=options,
            min_values=1,
            max_values=1,
        )

    async def callback(self, interaction: discord.Interaction):
        """Handle selection."""
        selected_id = int(self.values[0])

        # Check if selected user already has an official sender
        if self.db.has_official_sender(selected_id):
            await interaction.response.send_message(
                "❌ That person already has a sender. Please pick someone else.", ephemeral=True
            )
            logger.warning(
                f"User {self.user_id} tried to select {selected_id} who already has a sender"
            )
            return

        # Create official assignment
        self.db.add_assignment(self.user_id, selected_id, is_official=True, packages_count=0)

        # Get selected user's name
        selected_user = self.db.get_user(selected_id)
        selected_name = selected_user["display_name"] if selected_user else "Unknown"

        await interaction.response.send_message(
            f"✅ **You're all set!**\n\n"
            f"You are sending gifts to: **{selected_name}**\n\n"
            f"**How to message them anonymously:**\n"
            f"Just send a message to this bot (Ratmas Bot) and it will be forwarded to {selected_name} "
            f"without revealing who you are!\n\n"
            f"**Example:**\n"
            f'• You type: "What\'s your favorite color?"\n'
            f'• They receive: "📬 Message from someone receiving your gifts: What\'s your favorite color?"\n\n'
            f"They can reply, and you'll get their response - all completely anonymous!\n\n"
            f"**Next step:** Wait for a message asking you to update your package counts.",
            ephemeral=True,
        )
        logger.info(f"Assignment created: {self.user_id} → {selected_id}")

        # Check if all assignments are complete
        await check_assignments_complete(self.bot, self.db)


async def send_assignment_dm(bot, db: "RatmasDB", member: discord.Member):
    """Send assignment DM to a participant."""
    all_users = db.get_all_users()

    view = ui.View(timeout=None)
    view.add_item(AssignmentSelect(member.id, all_users, bot, db))

    await member.send(
        "🎁 **Secret Santa Assignment**\n\n"
        "You're participating in the gift exchange!\n\n"
        "**What you need to do:**\n"
        "Choose ONE person from the dropdown below that YOU will send gifts to. "
        'This is your "official rat" - the person you\'re responsible for.\n\n'
        "**What happens next:**\n"
        "• You'll send packages to this person\n"
        "• You can message them anonymously through this bot\n"
        "• They won't know it's you until you reveal yourself!\n\n"
        "**Choose your recipient now:**",
        view=view,
    )
    logger.info(f"Sent assignment DM to {member.display_name}")


async def check_assignments_complete(bot, db: "RatmasDB"):
    """Check if all participants have made assignments."""
    all_users = db.get_all_users()
    assignments = db.get_all_assignments()
    official_assignments = [a for a in assignments if a.get("is_official")]

    if len(official_assignments) == len(all_users):
        # All assignments complete!
        from ..config import Config

        try:
            manager = await bot.fetch_user(Config.MANAGER_USER_ID)
            await manager.send(
                f"✅ **All Ratmas assignments complete!**\n\n"
                f"{len(official_assignments)} participants have all selected their rats."
            )
            logger.info("All assignments complete")
        except Exception as e:
            logger.error(f"Failed to notify manager about complete assignments: {e}")
    else:
        # Check if anyone is stuck (no valid options)
        for user in all_users:
            user_id = user["user_id"]
            # Check if this user has made an assignment
            has_assignment = any(
                a["sender_id"] == user_id and a.get("is_official") for a in official_assignments
            )

            if not has_assignment:
                # Check if they have any valid options
                available = db.get_available_receivers(user_id)
                if not available:
                    # User is stuck!
                    from ..config import Config

                    try:
                        manager = await bot.fetch_user(Config.MANAGER_USER_ID)
                        await manager.send(
                            f"⚠️ **Assignment Problem**\n\n"
                            f"User <@{user_id}> ({user['display_name']}) has no valid assignment options left.\n"
                            f"All other participants already have senders.\n\n"
                            f"Please run `/end-ratmas` and restart with different assignments."
                        )
                        logger.warning(f"User {user_id} has no valid assignment options")
                    except Exception as e:
                        logger.error(f"Failed to notify manager about stuck user: {e}")
