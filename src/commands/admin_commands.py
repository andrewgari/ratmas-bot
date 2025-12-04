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

    @bot.tree.command(name="start-ratmas", description="[ADMIN] Step 1: Initialize a new gift exchange season")
    @app_commands.default_permissions(administrator=True)
    async def start_ratmas(interaction: discord.Interaction):
        """Start a new Ratmas season."""
        if db.is_season_active():
            await interaction.response.send_message(
                "❌ **A season is already running!**\n\n"
                "You need to end the current season first with `/end-ratmas` before starting a new one.\n"
                "This prevents accidentally losing current participant data.",
                ephemeral=True
            )
            return

        db.start_season()
        await interaction.response.send_message(
            "✅ **Ratmas Season Started!**\n\n"
            "The season has begun!\n\n"
            "**Next step:** Use `/custom-assignments` to let participants choose who they're sending gifts to.",
            ephemeral=True,
        )
        logger.info(f"Ratmas season started by {interaction.user.name}")

    @bot.tree.command(
        name="end-ratmas", description="[ADMIN] Step 4: End the gift exchange and archive all data"
    )
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(permanent="Permanently delete data without archiving (use with caution!)")
    async def end_ratmas(interaction: discord.Interaction, permanent: bool = False):
        """End the current Ratmas season."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ **No active season found.**\n\n"
                "There's no season currently running. Use `/start-ratmas` to begin a new one!",
                ephemeral=True
            )
            return

        archive = not permanent
        db.end_season(archive=archive)

        if archive:
            message = (
                "✅ **Ratmas Season Ended**\n\n"
                "All data has been safely archived. You can start a new season anytime with `/start-ratmas`!"
            )
        else:
            message = (
                "✅ **Ratmas Season Ended**\n\n"
                "⚠️ All data has been permanently deleted (no archive created)."
            )

        await interaction.response.send_message(message, ephemeral=True)
        logger.info(f"Ratmas season ended by {interaction.user.name} (permanent={permanent})")

    @bot.tree.command(
        name="custom-assignments",
        description="[ADMIN] Step 2: Let participants choose who they're sending gifts to",
    )
    @app_commands.default_permissions(administrator=True)
    async def custom_assignments(interaction: discord.Interaction):
        """Send DMs to participants to select their gift recipients."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ **No active season found.**\n\n"
                "Please run `/start-ratmas` first to initialize a new gift exchange season.",
                ephemeral=True
            )
            return

        # Check if assignments already exist
        assignments = db.get_all_assignments()
        official_assignments = [a for a in assignments if a.get("is_official")]
        if official_assignments:
            await interaction.response.send_message(
                "❌ **Assignments already exist!**\n\n"
                "Participants have already chosen their gift recipients. "
                "If you need to reset, run `/end-ratmas` first to clear the current season.",
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True)

        # Get all participants (users with the participant role)
        guild = interaction.guild
        role = guild.get_role(bot.config.PARTICIPANT_ROLE_ID)

        if not role:
            await interaction.followup.send(
                "❌ **Participant role not found!**\n\n"
                "The configured participant role doesn't exist in this server. "
                "Please check the PARTICIPANT_ROLE_ID setting in your configuration.",
                ephemeral=True,
            )
            return

        participants = [member for member in guild.members if role in member.roles]

        if len(participants) < 2:
            await interaction.followup.send(
                f"❌ **Not enough participants!**\n\n"
                f"Found {len(participants)} participant(s), but you need at least 2 people for a gift exchange.\n"
                f"Make sure users have the participant role assigned.",
                ephemeral=True
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
        message = f"✅ **Assignment DMs sent!**\n\nSuccessfully sent to {success_count}/{len(participants)} participants."
        if failed_users:
            message += f"\n\n❌ **Failed to send to:** {', '.join(failed_users)}\n"
            message += "These users may have DMs disabled. Please ask them to enable DMs from server members."

        await interaction.followup.send(message, ephemeral=True)
        logger.info(
            f"Custom assignments initiated by {interaction.user.name}: {success_count} sent"
        )

    @bot.tree.command(
        name="package-update-query",
        description="[ADMIN] Step 3: Ask participants how many packages they're sending",
    )
    @app_commands.default_permissions(administrator=True)
    async def package_update_query(interaction: discord.Interaction):
        """Send package update DMs to all participants."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ **No active season found.**\n\n"
                "Please run `/start-ratmas` first to initialize a new gift exchange season.",
                ephemeral=True
            )
            return

        await interaction.response.defer(ephemeral=True)

        # Get all users
        users = db.get_all_users()

        if not users:
            await interaction.followup.send(
                "❌ **No participants found.**\n\n"
                "You need to run `/custom-assignments` first so participants can choose their gift recipients.",
                ephemeral=True
            )
            return

        # Send package update DMs
        from ..handlers.package_handler import send_package_update_dm

        # Get guild to fetch members
        guild = bot.get_guild(Config.DISCORD_GUILD_ID)
        if not guild:
            await interaction.followup.send(
                "❌ **Server not found!**\n\n"
                "Could not find the configured Discord server. Please check your DISCORD_GUILD_ID setting.",
                ephemeral=True
            )
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
        message = f"✅ **Package update requests sent!**\n\nSuccessfully sent to {success_count}/{len(users)} participants."
        if failed_users:
            message += f"\n\n❌ **Failed to send to:** {', '.join(failed_users)}\n"
            message += "These users may have DMs disabled. Please ask them to enable DMs from server members."

        await interaction.followup.send(message, ephemeral=True)
        logger.info(
            f"Package update query initiated by {interaction.user.name}: {success_count} sent"
        )
