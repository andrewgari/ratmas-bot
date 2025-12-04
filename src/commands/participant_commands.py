"""Participant commands for Ratmas bot."""

import logging
from typing import TYPE_CHECKING

import discord
from discord import app_commands

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


def has_participant_role():
    """Check decorator for participant role."""

    async def predicate(interaction: discord.Interaction) -> bool:
        from ..config import Config

        role = interaction.guild.get_role(Config.PARTICIPANT_ROLE_ID)
        if role and role in interaction.user.roles:
            return True
        await interaction.response.send_message(
            "❌ You need the participant role to use this command.", ephemeral=True
        )
        return False

    return app_commands.check(predicate)


async def setup_participant_commands(bot, db: "RatmasDB"):
    """Setup participant commands."""

    @bot.tree.command(
        name="list-packages", description="Check how many packages people are sending to you"
    )
    @has_participant_role()
    async def list_packages(interaction: discord.Interaction):
        """Check how many packages are coming to you."""
        user_id = interaction.user.id

        # Get total packages coming to this user
        total_packages = db.get_total_packages_for_receiver(user_id)

        if total_packages == 0:
            message = (
                "🎁 **The Rats are still hunting for your gifts!** 📦\n\n"
                "No packages have been reported yet. Check back after everyone updates their package counts!"
            )
        else:
            message = (
                f"🎁 **The rats have sent {total_packages} package{'s' if total_packages != 1 else ''} to you!** 📦\n\n"
                f"This helps you know when all your gifts have arrived. Happy Ratmas! 🐀🎄"
            )

        await interaction.response.send_message(message, ephemeral=True)
        logger.info(f"User {interaction.user.name} checked status: {total_packages} packages")

    @bot.tree.command(
        name="update-packages",
        description="Tell us how many packages you're sending to each person",
    )
    @has_participant_role()
    async def update_packages(interaction: discord.Interaction):
        """Update package counts for all participants."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ **No active season.**\n\n"
                "There's no gift exchange currently running. Wait for an admin to start a new season!",
                ephemeral=True,
            )
            return

        # Send package update DM
        from ..handlers.package_handler import send_package_update_dm

        try:
            await send_package_update_dm(bot, db, interaction.user)
            await interaction.response.send_message(
                "✅ Check your DMs to update package counts!", ephemeral=True
            )
            logger.info(f"User {interaction.user.name} requested package update")
        except Exception as e:
            logger.error(f"Failed to send package update DM to {interaction.user.name}: {e}")
            await interaction.response.send_message(
                "❌ Failed to send DM. Please make sure you have DMs enabled from server members.",
                ephemeral=True,
            )
