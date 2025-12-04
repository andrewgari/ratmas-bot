"""Configuration management for Ratmas bot."""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Bot configuration from environment variables."""

    # Discord Configuration
    DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
    DISCORD_GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", 0))

    # Manager Configuration
    MANAGER_USER_ID = int(os.getenv("MANAGER_USER_ID", 0))

    # Participant Role
    PARTICIPANT_ROLE_ID = int(os.getenv("PARTICIPANT_ROLE_ID", 0))

    # Redis Configuration
    REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
    REDIS_DB = int(os.getenv("REDIS_DB", 0))

    # Bot Configuration
    MESSAGE_COMBINE_WINDOW_SECONDS = int(os.getenv("MESSAGE_COMBINE_WINDOW_SECONDS", 5))

    @classmethod
    def validate(cls):
        """Validate required configuration."""
        errors = []

        if not cls.DISCORD_TOKEN:
            errors.append("DISCORD_TOKEN is required")
        if not cls.DISCORD_GUILD_ID:
            errors.append("DISCORD_GUILD_ID is required")
        if not cls.MANAGER_USER_ID:
            errors.append("MANAGER_USER_ID is required")
        if not cls.PARTICIPANT_ROLE_ID:
            errors.append("PARTICIPANT_ROLE_ID is required")

        if errors:
            raise ValueError(f"Configuration errors: {', '.join(errors)}")

        return True
