"""Admin commands for Ratmas bot."""

import logging
from typing import TYPE_CHECKING

import discord
from discord import app_commands

from ..config import Config

if TYPE_CHECKING:
    from ..database import RatmasDB

logger = logging.getLogger(__name__)


async def post_guide_embeds(channel):
    """Post the Ratmas guide embeds to a channel.

    Args:
        channel: Discord channel to post to

    Raises:
        discord.Forbidden: If bot lacks permissions to send messages
        discord.HTTPException: If Discord API request fails
    """
    # Welcome header
    embed1 = discord.Embed(
        title="🎁 Welcome to Ratmas!",
        description="Your complete guide to this year's Secret Santa gift exchange. Read through each section to understand how everything works!",
        color=0xE74C3C,  # Red
    )
    embed1.set_footer(text="Happy Ratmas! 🐀🎄")
    await channel.send(embed=embed1)

    # Communication section
    embed2 = discord.Embed(
        title="📱 How Communication Works",
        description="All communication happens through me (the bot) to keep everything anonymous!",
        color=0x3498DB,  # Blue
    )
    embed2.add_field(
        name="Step 1: Receive Your Assignment",
        value="I'll send you a DM asking you to choose who you're sending gifts to. This person is your **official recipient**.",
        inline=False,
    )
    embed2.add_field(
        name="Step 2: Message Anonymously",
        value='Want to ask your recipient what they like? Just **send a DM to me** and I\'ll forward it anonymously!\n\n**Example:**\n• You DM me: "What\'s your favorite color?"\n• They receive: "📬 Message from your gift sender: What\'s your favorite color?"\n• They reply to me → You get their response!',
        inline=False,
    )
    embed2.add_field(
        name="⚠️ Stay Anonymous!",
        value="**Only** send messages through this bot. Don't message your recipient directly in the server or you'll spoil the surprise!",
        inline=False,
    )
    await channel.send(embed=embed2)

    # Commands section
    embed3 = discord.Embed(
        title="🛠️ Commands You Can Use",
        color=0xF1C40F,  # Yellow
    )
    embed3.add_field(
        name="/list-packages",
        value="**Check how many gifts are coming to you**\n\n• Shows total packages people reported sending to you\n• Helps you know when all gifts have arrived\n• Updates as people report their package counts",
        inline=False,
    )
    embed3.add_field(
        name="/update-packages",
        value="**Report how many packages you're sending**\n\n• Opens a DM with a dropdown menu\n• Select each person you're sending to\n• Enter the number of packages for each\n• Can send to multiple people (not just your official recipient!)",
        inline=False,
    )
    await channel.send(embed=embed3)

    # Timeline section
    embed4 = discord.Embed(
        title="📅 Event Timeline - What to Expect",
        color=0x9B59B6,  # Purple
    )
    embed4.add_field(
        name="Phase 1: Assignment 📋",
        value="✅ Check your DMs for my message\n✅ Choose ONE person as your official recipient\n✅ This ensures everyone gets at least one sender!",
        inline=False,
    )
    embed4.add_field(
        name="Phase 2: Anonymous Chat 💬",
        value="✅ DM me to send anonymous messages to your recipient\n✅ Ask about their interests, hobbies, wishlists\n✅ They can reply through me - stays anonymous!",
        inline=False,
    )
    embed4.add_field(
        name="Phase 3: Gift Sending 📦",
        value="✅ Buy and send your gifts\n✅ Use `/update-packages` to report counts\n✅ Update for everyone you're sending to",
        inline=False,
    )
    embed4.add_field(
        name="Phase 4: Tracking 📊",
        value="✅ Use `/list-packages` to check incoming gifts\n✅ Know when everything has arrived!",
        inline=False,
    )
    embed4.add_field(
        name="Phase 5: Reveal Day 🎉",
        value="✅ Identities revealed!\n✅ Find out who your Secret Santa was!",
        inline=False,
    )
    await channel.send(embed=embed4)

    # FAQ section
    embed5 = discord.Embed(
        title="❓ Frequently Asked Questions",
        color=0x2ECC71,  # Green
    )
    embed5.add_field(
        name="Can I send gifts to multiple people?",
        value="**Yes!** You have one official recipient (required), but you can send extras to anyone. Just update package counts for each person.",
        inline=False,
    )
    embed5.add_field(
        name="How do I stay anonymous?",
        value="**Only communicate through this bot.** Never message your recipient directly in the server or through regular DMs.",
        inline=False,
    )
    embed5.add_field(
        name="How do I ask my recipient something?",
        value="Send a DM to me (Ratmas Bot) with your question. I'll forward it anonymously and send you their reply!",
        inline=False,
    )
    embed5.add_field(
        name="When do I update package counts?",
        value="You'll get a DM reminder, but you can use `/update-packages` anytime.",
        inline=False,
    )
    embed5.add_field(
        name="Why do package counts matter?",
        value="So your recipient knows when all gifts have arrived! They use `/list-packages` to see the total expected.",
        inline=False,
    )
    await channel.send(embed=embed5)

    # Checklist section
    embed6 = discord.Embed(
        title="🎯 Quick Checklist",
        description="Your simple step-by-step guide:",
        color=0x1ABC9C,  # Teal
    )
    embed6.add_field(
        name="What You Need to Do",
        value="✅ Wait for assignment DM and choose your recipient\n✅ DM the bot to chat anonymously\n✅ Buy and send your gifts\n✅ Use `/update-packages` to report how many sent\n✅ Use `/list-packages` to see gifts coming to you\n✅ Keep everything secret until reveal day!",
        inline=False,
    )
    embed6.add_field(
        name="Need Help?",
        value="Ask an admin or use the buttons in your DM messages to report issues.",
        inline=False,
    )
    embed6.set_footer(text="Happy Ratmas! 🐀🎄")
    await channel.send(embed=embed6)


async def setup_admin_commands(bot, db: "RatmasDB"):
    """Setup admin commands."""

    @bot.tree.command(
        name="post-guide", description="[ADMIN] Post the Ratmas guide to the current channel"
    )
    @app_commands.default_permissions(administrator=True)
    async def post_guide(interaction: discord.Interaction):
        """Post the complete Ratmas guide as embeds."""
        await interaction.response.defer(ephemeral=True)

        channel = interaction.channel
        await post_guide_embeds(channel)

        await interaction.followup.send("✅ Guide posted to channel!", ephemeral=True)
        logger.info(f"Guide posted by {interaction.user.name} to {channel.name}")

    @bot.tree.command(
        name="start-ratmas", description="[ADMIN] Step 1: Initialize a new gift exchange season"
    )
    @app_commands.default_permissions(administrator=True)
    async def start_ratmas(interaction: discord.Interaction):
        """Start a new Ratmas season."""
        if db.is_season_active():
            await interaction.response.send_message(
                "❌ **A season is already running!**\n\n"
                "You need to end the current season first with `/end-ratmas` before starting a new one.\n"
                "This prevents accidentally losing current participant data.",
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True)

        db.start_season()

        # Post guide to the channel
        channel = interaction.channel
        try:
            await post_guide_embeds(channel)
            message = (
                "✅ **Ratmas Season Started!**\n\n"
                "The season has begun and the guide has been posted to this channel!\n\n"
                "**Next step:** Use `/custom-assignments` to let participants choose who they're sending gifts to."
            )
        except discord.Forbidden:
            logger.error(f"Failed to post guide in {channel.name}: Missing send permissions")
            message = (
                "✅ **Ratmas Season Started!**\n\n"
                "⚠️ However, I couldn't post the guide (missing send permissions). "
                "Please use `/post-guide` in a channel where I have permissions.\n\n"
                "**Next step:** Use `/custom-assignments` to let participants choose who they're sending gifts to."
            )
        except discord.HTTPException as e:
            logger.error(f"Failed to post guide during season start: {e}")
            message = (
                "✅ **Ratmas Season Started!**\n\n"
                "⚠️ However, the guide failed to post due to an error. "
                "Please use `/post-guide` to post it manually.\n\n"
                "**Next step:** Use `/custom-assignments` to let participants choose who they're sending gifts to."
            )

        await interaction.followup.send(message, ephemeral=True)
        logger.info(f"Ratmas season started by {interaction.user.name}")

    @bot.tree.command(
        name="end-ratmas", description="[ADMIN] Step 4: End the gift exchange and archive all data"
    )
    @app_commands.default_permissions(administrator=True)
    @app_commands.describe(
        permanent="Permanently delete data without archiving (use with caution!)"
    )
    async def end_ratmas(interaction: discord.Interaction, permanent: bool = False):
        """End the current Ratmas season."""
        if not db.is_season_active():
            await interaction.response.send_message(
                "❌ **No active season found.**\n\n"
                "There's no season currently running. Use `/start-ratmas` to begin a new one!",
                ephemeral=True,
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
                ephemeral=True,
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
                ephemeral=True,
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
                ephemeral=True,
            )
            return

        await interaction.response.defer(ephemeral=True)

        # Get all users
        users = db.get_all_users()

        if not users:
            await interaction.followup.send(
                "❌ **No participants found.**\n\n"
                "You need to run `/custom-assignments` first so participants can choose their gift recipients.",
                ephemeral=True,
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
                ephemeral=True,
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

    @bot.tree.command(
        name="reset-assignment",
        description="[ADMIN] Reset a user's rat assignment (debug/fix option)",
    )
    @app_commands.describe(user="The user whose assignment to reset")
    @app_commands.default_permissions(administrator=True)
    async def reset_assignment(interaction: discord.Interaction, user: discord.Member):
        """Reset a user's official rat assignment."""
        await interaction.response.defer(ephemeral=True)

        # Check if season is active
        if not db.is_season_active():
            await interaction.followup.send(
                "❌ **No active season!**\n\nStart a season with `/start-ratmas` first.",
                ephemeral=True,
            )
            return

        # Check if user is a participant
        user_data = db.get_user(user.id)
        if not user_data:
            await interaction.followup.send(
                f"❌ **{user.display_name} is not a participant!**\n\n"
                "They need to have the participant role to be in the exchange.",
                ephemeral=True,
            )
            return

        # Reset the assignment
        reset_info = db.reset_user_assignment(user.id)

        if not reset_info:
            await interaction.followup.send(
                f"❌ **{user.display_name} has no official assignment to reset.**\n\n"
                "They either haven't selected a rat yet, or their assignment was already reset.",
                ephemeral=True,
            )
            return

        # Get receiver info
        receiver_data = db.get_user(reset_info["receiver_id"])
        receiver_name = receiver_data["display_name"] if receiver_data else "Unknown"
        packages_count = reset_info["packages_count"]

        # Build message
        message = f"✅ **Assignment reset for {user.display_name}**\n\n"
        message += f"Previous assignment: **{receiver_name}**\n"

        if packages_count > 0:
            message += f"Package count ({packages_count}) preserved as rogue assignment.\n\n"
        else:
            message += "No packages were recorded.\n\n"

        message += (
            f"**Next steps:**\n"
            f"1. {user.mention} will need to reselect their rat using `/custom-assignments`\n"
            f"2. Or you can notify them manually to check their DMs for the assignment selector"
        )

        await interaction.followup.send(message, ephemeral=True)
        logger.info(
            f"Assignment reset for {user.display_name} (was sending to {receiver_name}) by {interaction.user.name}"
        )

        # Notify the user and send new assignment selector
        try:
            # Send assignment selector DM
            from ..handlers.assignment_handler import send_assignment_dm

            await send_assignment_dm(bot, db, user)

            await interaction.channel.send(
                f"✅ Sent new assignment selector to {user.mention}", delete_after=10
            )
        except Exception as e:
            logger.error(f"Failed to send new assignment selector to {user.display_name}: {e}")
            await interaction.channel.send(
                f"⚠️ Failed to send new assignment selector to {user.mention}. "
                "You may need to run `/custom-assignments` again.",
                delete_after=15,
            )
