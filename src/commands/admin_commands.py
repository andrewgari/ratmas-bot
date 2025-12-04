"""Admin commands for Ratmas bot."""

import logging
from typing import TYPE_CHECKING

import discord
from discord import app_commands

from ..config import Config

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


async def setup_admin_commands(bot, db: "RatmasDB"):
    """Setup admin commands."""

    @bot.tree.command(name="start-ratmas", description="[ADMIN] Start a new gift exchange season")
    @app_commands.default_permissions(administrator=True)
    async def start_ratmas(interaction: discord.Interaction):
        """Start a new Ratmas season."""
        if db.is_season_active():
            await interaction.response.send_message(
                "❌ Ratmas is already in progress. Please run `/end-ratmas` first.", ephemeral=True
            )
            return

        db.start_season()
        await interaction.response.send_message(
            "✅ **Ratmas Season Started!**\n\n"
            "The season has begun. Use `/custom-assignments` to set up participant assignments.",
            ephemeral=True,
        )
        logger.info(f"Ratmas season started by {interaction.user.name}")

    @bot.tree.command(
        name="end-ratmas", description="[ADMIN] End the gift exchange and archive all data"
    )
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(permanent="Permanently delete data without archiving")
    async def end_ratmas(interaction: discord.Interaction, permanent: bool = False):
        """End the current Ratmas season."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ No active Ratmas season to end.", ephemeral=True
            )
            return

        archive = not permanent
        db.end_season(archive=archive)

        if archive:
            message = "✅ **Ratmas Season Ended**\n\nData has been archived."
        else:
            message = "✅ **Ratmas Season Ended**\n\n⚠️ All data has been permanently deleted."

        await interaction.response.send_message(message, ephemeral=True)
        logger.info(f"Ratmas season ended by {interaction.user.name} (permanent={permanent})")

    @bot.tree.command(
        name="custom-assignments",
        description="[ADMIN] Send DMs so participants can choose who they're sending gifts to",
    )
    @app_commands.default_permissions(administrator=True)
    async def custom_assignments(interaction: discord.Interaction):
        """Send DMs to participants to select their rats."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ No active Ratmas season. Please run `/start-ratmas` first.", ephemeral=True
            )
            return

        # Check if assignments already exist
        assignments = db.get_all_assignments()
        official_assignments = [a for a in assignments if a.get("is_official")]
        if official_assignments:
            await interaction.response.send_message(
                "❌ Assignments already exist. Please run `/end-ratmas` first to reset.",
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True)

        # Get all participants (users with the participant role)
        guild = interaction.guild
        role = guild.get_role(bot.config.PARTICIPANT_ROLE_ID)

        if not role:
            await interaction.followup.send(
                "❌ Participant role not found. Please check PARTICIPANT_ROLE_ID in config.",
                ephemeral=True,
            )
            return

        participants = [member for member in guild.members if role in member.roles]

        if len(participants) < 2:
            await interaction.followup.send(
                f"❌ Need at least 2 participants. Found {len(participants)}.", ephemeral=True
            )
            return

        # Add all participants to database
        for member in participants:
            db.add_user(member.id, member.display_name)

        # Send assignment DMs
        from ..handlers.assignment_handler import send_assignment_dm

        success_count = 0
        failed_users = []

        for member in participants:
            try:
                await send_assignment_dm(bot, db, member)
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to send assignment DM to {member.display_name}: {e}")
                failed_users.append(member.display_name)

        # Report results
        message = f"✅ Sent assignment DMs to {success_count}/{len(participants)} participants."
        if failed_users:
            message += f"\n\n❌ Failed to send to: {', '.join(failed_users)}"

        await interaction.followup.send(message, ephemeral=True)
        logger.info(
            f"Custom assignments initiated by {interaction.user.name}: {success_count} sent"
        )

    @bot.tree.command(
        name="package-update-query",
        description="[ADMIN] Send DMs asking everyone to update how many packages they're sending",
    )
    @app_commands.default_permissions(administrator=True)
    async def package_update_query(interaction: discord.Interaction):
        """Send package update DMs to all participants."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ No active Ratmas season. Please run `/start-ratmas` first.", ephemeral=True
            )
            return

        await interaction.response.defer(ephemeral=True)

        # Get all users
        users = db.get_all_users()

        if not users:
            await interaction.followup.send(
                "❌ No participants found. Run `/custom-assignments` first.", ephemeral=True
            )
            return

        # Send package update DMs
        from ..handlers.package_handler import send_package_update_dm

        # Get guild to fetch members
        guild = bot.get_guild(Config.DISCORD_GUILD_ID)
        if not guild:
            await interaction.followup.send("❌ Could not find guild.", ephemeral=True)
            return

        success_count = 0
        failed_users = []

        for user_data in users:
            try:
                member = await guild.fetch_member(user_data["user_id"])
                await send_package_update_dm(bot, db, member)
                success_count += 1
            except Exception as e:
                logger.error(
                    f"Failed to send package update DM to {user_data['display_name']}: {e}"
                )
                failed_users.append(user_data["display_name"])

        # Report results
        message = f"✅ Sent package update DMs to {success_count}/{len(users)} participants."
        if failed_users:
            message += f"\n\n❌ Failed to send to: {', '.join(failed_users)}"

        await interaction.followup.send(message, ephemeral=True)
        logger.info(
            f"Package update query initiated by {interaction.user.name}: {success_count} sent"
        )
