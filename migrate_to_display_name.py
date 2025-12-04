#!/usr/bin/env python3
"""One-time migration script to rename 'username' to 'display_name' in Redis."""
import redis
import json
import sys

# Redis connection settings (use 'redis' hostname in Docker)
REDIS_HOST = "redis"
REDIS_PORT = 6379
REDIS_DB = 0

def migrate():
    """Migrate username field to display_name in all user records."""
    try:
        # Connect to Redis
        r = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            decode_responses=True
        )
        
        # Test connection
        r.ping()
        print("✅ Connected to Redis")
        
        # Get all users
        users_data = r.hgetall("ratmas:users")
        if not users_data:
            print("⚠️  No users found in database")
            return
        
        print(f"📦 Found {len(users_data)} users to migrate")
        
        # Migrate each user
        migrated = 0
        for user_id, user_json in users_data.items():
            user = json.loads(user_json)
            
            # Check if already migrated
            if "display_name" in user:
                print(f"  ⏭️  User {user_id} already migrated")
                continue
            
            # Migrate: rename 'username' to 'display_name'
            if "username" in user:
                user["display_name"] = user.pop("username")
                
                # Save back to Redis
                r.hset("ratmas:users", user_id, json.dumps(user))
                print(f"  ✅ Migrated user {user_id}: {user['display_name']}")
                migrated += 1
            else:
                print(f"  ⚠️  User {user_id} has neither 'username' nor 'display_name'")
        
        print(f"\n🎉 Migration complete! Migrated {migrated} users")
        
    except redis.ConnectionError:
        print("❌ Failed to connect to Redis. Is it running?", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"❌ Migration failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    print("🔄 Starting migration: username → display_name\n")
    migrate()

