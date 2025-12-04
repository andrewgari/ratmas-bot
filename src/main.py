"""Main entry point for Ratmas bot."""
import discord
from discord import app_commands
import sys
import logging
from .config import Config
from .database import RatmasDB
from .handlers.dm_handler import DMHandler

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class RatmasBot(discord.Client):
    """Ratmas Discord bot."""
    
    def __init__(self):
        """Initialize bot."""
        intents = discord.Intents.default()
        intents.message_content = True
        intents.members = True
        intents.guilds = True
        intents.dm_messages = True
        
        super().__init__(intents=intents)
        
        self.config = Config
        self.tree = app_commands.CommandTree(self)
        self.db = RatmasDB()
        self.dm_handler = DMHandler(self, self.db)
    
    async def setup_hook(self):
        """Setup hook called when bot starts."""
        # Register commands
        from .commands.admin_commands import setup_admin_commands
        from .commands.participant_commands import setup_participant_commands
        
        await setup_admin_commands(self, self.db)
        await setup_participant_commands(self, self.db)
        
        # Sync commands to guild
        guild = discord.Object(id=Config.DISCORD_GUILD_ID)
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)
        logger.info(f"Commands synced to guild {Config.DISCORD_GUILD_ID}")
    
    async def on_ready(self):
        """Called when bot is ready."""
        logger.info(f"Bot logged in as {self.user} (ID: {self.user.id})")
        logger.info(f"Connected to {len(self.guilds)} guild(s)")
    
    async def on_message(self, message: discord.Message):
        """Handle incoming messages."""
        # Ignore bot messages
        if message.author.bot:
            return
        
        # Only handle DMs
        if not isinstance(message.channel, discord.DMChannel):
            return
        
        # Relay the DM
        await self.dm_handler.handle_dm(message)
    
    async def on_member_remove(self, member: discord.Member):
        """Handle user leaving the server."""
        # Check if this is in our guild
        if member.guild.id != Config.DISCORD_GUILD_ID:
            return
        
        # Check if user is a participant
        user = self.db.get_user(member.id)
        if not user:
            return
        
        # User is a participant who left - notify manager
        try:
            manager = await self.fetch_user(Config.MANAGER_USER_ID)
            
            # Get their assignments
            assignments = self.db.get_all_assignments()
            sending_to = [a for a in assignments if a["sender_id"] == member.id and a.get("is_official")]
            receiving_from = [a for a in assignments if a["receiver_id"] == member.id and a.get("is_official")]
            
            message = f"⚠️ **Participant Left Server**\n\n"
            message += f"User **{member.display_name}** (ID: {member.id}) has left the server.\n\n"

            if sending_to:
                receiver_id = sending_to[0]["receiver_id"]
                receiver = self.db.get_user(receiver_id)
                receiver_name = receiver["display_name"] if receiver else "Unknown"
                message += f"They were sending to: **{receiver_name}** (ID: {receiver_id})\n"

            if receiving_from:
                sender_id = receiving_from[0]["sender_id"]
                sender = self.db.get_user(sender_id)
                sender_name = sender["display_name"] if sender else "Unknown"
                message += f"They were receiving from: **{sender_name}** (ID: {sender_id})\n"

            message += "\nYou may need to reassign participants."

            await manager.send(message)
            logger.warning(f"User {member.display_name} ({member.id}) left server - manager notified")
            
            # Remove user from database
            self.db.remove_user(member.id)
            
        except Exception as e:
            logger.error(f"Failed to handle user leave for {member.id}: {e}")


async def main():
    """Main entry point."""
    try:
        Config.validate()
    except ValueError as e:
        print(f"Configuration error: {e}", file=sys.stderr)
        sys.exit(1)
    
    bot = RatmasBot()
    
    try:
        await bot.start(Config.DISCORD_TOKEN)
    except KeyboardInterrupt:
        logger.info("Shutting down bot...")
        await bot.close()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
