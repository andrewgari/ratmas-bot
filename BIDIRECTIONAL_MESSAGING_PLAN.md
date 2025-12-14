# BIDIRECTIONAL MESSAGING IMPLEMENTATION PLAN

## Executive Summary

This plan enables users to reply to messages from their sender (the person sending them packages) while maintaining the ability to send messages to their recipient. The solution uses a **conversation context tracking system** with **Discord UI buttons** for intuitive mode switching.

---

## Current System Analysis

### How DM Routing Currently Works

**File: `/home/andrewgari/Repos/ratmas-js/src/handlers/dm_handler.py`**

1. User sends a DM to the bot
2. Bot checks if user is a participant (`get_user()`)
3. Messages are queued for 5 seconds to combine rapid-fire messages
4. Bot looks up user's **official assignment** (`get_official_assignment()`)
5. Message is forwarded to `receiver_id` (the person the sender chose)
6. Message includes "Reminder" and "Report Issue" buttons

**Key Problem:** The system only knows about sender → receiver relationships (who you're sending TO), not receiver → sender relationships (who's sending TO YOU).

### Database Schema Analysis

**File: `/home/andrewgari/Repos/ratmas-js/src/database.py`**

**Current Assignment Structure:**
```python
{
    "sender_id": int,      # Person sending gifts
    "receiver_id": int,    # Person receiving gifts
    "is_official": bool,   # True for official assignment
    "packages_count": int  # Number of packages
}
```

**Key Methods:**
- `get_official_assignment(sender_id)` → Gets who sender is sending TO
- `get_assignment(sender_id, receiver_id)` → Gets specific assignment
- **MISSING:** Method to get who is sending TO a specific user

### Message Flow Problem

**Scenario:**
- User A → User B (A's official recipient)
- User B → User C (B's official recipient)

**Current Behavior:**
1. A sends DM → Bot forwards to B ✅
2. B wants to reply to A's message
3. B sends DM → Bot looks up B's official assignment
4. Bot forwards to C (B's recipient) ❌ Should go to A!

---

## Proposed Solution: Conversation Context Tracking

### Design Philosophy

**Core Principle:** Track the last person who messaged you, allowing natural reply behavior while preserving the default "send to my recipient" functionality.

**UI Approach:** Use Discord buttons to let users explicitly choose the destination when needed.

### Solution Architecture

#### 1. **Conversation Context Storage** (Redis)

Store recent message history to track who last messaged whom:

```python
# Redis key structure
"ratmas:conversation:{user_id}"
# Value: JSON
{
    "last_received_from": int,        # User ID who last messaged you
    "last_received_at": timestamp,     # When they messaged you
    "last_sent_to": int,               # User ID you last messaged
    "last_sent_at": timestamp,         # When you sent it
    "mode": "recipient" | "sender"     # Current messaging mode
}
```

**Expiration:** Context expires after 24 hours of inactivity (configurable)

#### 2. **Enhanced DM Handler Logic**

**New Flow:**

```python
async def handle_dm(message):
    user_id = message.author.id

    # Get conversation context
    context = get_conversation_context(user_id)

    # Determine destination based on mode
    if context and context["mode"] == "sender":
        # Reply mode: send to your sender
        destination = context["last_received_from"]
    else:
        # Default mode: send to your recipient
        assignment = get_official_assignment(user_id)
        destination = assignment["receiver_id"]

    # Forward message
    await forward_message(user_id, destination, message.content)

    # Update context
    update_conversation_context(user_id, sent_to=destination)
```

#### 3. **UI Enhancement: Mode Switching Buttons**

When a user **RECEIVES** a message, attach buttons for easy reply:

```
📬 Message from someone receiving your gifts:
"What's your wishlist link?"

[💬 Reply to Sender] [📤 Message My Recipient]
```

**Button Behavior:**
- **Reply to Sender:** Sets mode to "sender", opens a modal for quick reply
- **Message My Recipient:** Sets mode to "recipient", opens a modal to send to your official recipient

#### 4. **Database Enhancements**

**New Methods in `/home/andrewgari/Repos/ratmas-js/src/database.py`:**

```python
def get_official_senders(receiver_id: int) -> List[Dict]:
    """Get all users who have receiver_id as their official recipient."""
    assignments = self.get_all_assignments()
    return [a for a in assignments
            if a["receiver_id"] == receiver_id and a.get("is_official")]

def get_conversation_context(user_id: int) -> Optional[Dict]:
    """Get conversation context for a user."""
    data = self.redis.get(f"ratmas:conversation:{user_id}")
    return json.loads(data) if data else None

def set_conversation_context(user_id: int, context: Dict):
    """Set conversation context with 24hr expiration."""
    key = f"ratmas:conversation:{user_id}"
    self.redis.setex(key, 86400, json.dumps(context))  # 24hr TTL

def clear_conversation_context(user_id: int):
    """Clear conversation context."""
    self.redis.delete(f"ratmas:conversation:{user_id}")
```

---

## Implementation Plan: Step-by-Step

### Phase 1: Database Layer (Foundation)

**File: `/home/andrewgari/Repos/ratmas-js/src/database.py`**

1. Add `get_official_senders(receiver_id)` method
2. Add `get_conversation_context(user_id)` method
3. Add `set_conversation_context(user_id, context)` method
4. Add `clear_conversation_context(user_id)` method
5. Add method to get all senders (official + rogue) for a receiver

**Testing:** Create unit tests for new database methods

### Phase 2: Conversation Context Handler

**New File: `/home/andrewgari/Repos/ratmas-js/src/handlers/conversation_handler.py`**

Create a new handler to manage conversation state:

```python
class ConversationHandler:
    def __init__(self, db):
        self.db = db

    def record_message_sent(self, sender_id, receiver_id):
        """Update context when user sends a message."""
        # Update sender's context
        # Set last_sent_to, last_sent_at

    def record_message_received(self, receiver_id, sender_id):
        """Update context when user receives a message."""
        # Update receiver's context
        # Set last_received_from, last_received_at

    def get_destination(self, user_id, mode=None):
        """Get destination user ID based on mode."""
        # If mode == "sender": return last_received_from
        # If mode == "recipient": return official assignment
        # If mode == None: return based on context.mode

    def set_mode(self, user_id, mode):
        """Set conversation mode for user."""
        # Update context with new mode
```

### Phase 3: Enhanced Button Handler

**File: `/home/andrewgari/Repos/ratmas-js/src/handlers/button_handler.py`**

Add new button classes:

```python
class ReplyToSenderButton(ui.Button):
    """Button to reply to the person who sent you this message."""

    def __init__(self, receiver_id, sender_id, bot, db, conv_handler):
        super().__init__(
            label="💬 Reply to Sender",
            style=discord.ButtonStyle.primary
        )
        # Store IDs and handlers

    async def callback(self, interaction):
        # Set mode to "sender"
        # Show modal for quick reply
        # Send message to sender

class MessageRecipientButton(ui.Button):
    """Button to send a new message to your official recipient."""

    def __init__(self, user_id, bot, db, conv_handler):
        super().__init__(
            label="📤 Message My Recipient",
            style=discord.ButtonStyle.secondary
        )
        # Store IDs and handlers

    async def callback(self, interaction):
        # Set mode to "recipient"
        # Show modal for message
        # Send to official recipient
```

### Phase 4: Update DM Handler

**File: `/home/andrewgari/Repos/ratmas-js/src/handlers/dm_handler.py`**

Major changes needed:

1. **Initialize conversation handler** in `__init__`
2. **Determine destination** using conversation context
3. **Update context** after sending/receiving messages
4. **Attach new buttons** when forwarding messages
5. **Handle multiple senders** (show who sent what if multiple senders exist)

**Key Logic Changes:**

```python
async def handle_dm(self, message: discord.Message):
    user_id = message.author.id
    user = self.db.get_user(user_id)
    if not user:
        return

    # Queue message (existing combine logic)
    # ... existing code ...

async def _relay_after_delay(self, sender_id: int):
    # Combine messages (existing)
    messages = self.pending_messages.get(sender_id, [])
    combined_text = "\n\n".join(msg[0] for msg in messages)

    # NEW: Determine destination using conversation context
    context = self.db.get_conversation_context(sender_id)

    if context and context.get("mode") == "sender":
        # User is replying to their sender
        destination_id = context.get("last_received_from")
        if not destination_id:
            # Fallback to official recipient if no sender context
            destination_id = self.get_official_destination(sender_id)
    else:
        # Default: send to official recipient
        destination_id = self.get_official_destination(sender_id)

    # Forward message
    await self.forward_message(
        sender_id,
        destination_id,
        combined_text,
        is_reply=(context and context.get("mode") == "sender")
    )

    # Update conversation context
    self.conversation_handler.record_message_sent(sender_id, destination_id)
    self.conversation_handler.record_message_received(destination_id, sender_id)

async def forward_message(self, sender_id, receiver_id, text, is_reply=False):
    """Forward a message with appropriate buttons."""
    receiver = await self.bot.fetch_user(receiver_id)

    # Create view with reply buttons
    from .button_handler import create_message_view
    view = create_message_view(
        sender_id=sender_id,
        receiver_id=receiver_id,
        original_message=text,
        bot=self.bot,
        db=self.db,
        conv_handler=self.conversation_handler
    )

    # Determine message header
    if is_reply:
        header = "📬 **Reply from someone receiving your gifts:**"
    else:
        header = "📬 **Message from someone receiving your gifts:**"

    # Send message
    await receiver.send(
        f"{header}\n\n{text}\n\n"
        f"━━━━━━━━━━━━━━━━━━━━━━\n"
        f"💡 **Quick actions:**\n"
        f"• **Reply to Sender** - Respond to this message\n"
        f"• **Message My Recipient** - Send to your official recipient\n"
        f"• **Send Reminder** - Resend this message to your gift giver\n"
        f"• **Report Issue** - Contact the manager",
        view=view
    )

    # Confirm to sender
    sender = await self.bot.fetch_user(sender_id)
    await sender.send(
        "✅ **Message delivered!**\n\n"
        f"Your message has been sent. "
        "They can reply using the button in their message!"
    )
```

### Phase 5: Update Button Handler View Creator

**File: `/home/andrewgari/Repos/ratmas-js/src/handlers/button_handler.py`**

Update `create_message_buttons` to include reply buttons:

```python
def create_message_view(
    sender_id: int,
    receiver_id: int,
    original_message: str,
    bot,
    db: "RatmasDB",
    conv_handler
) -> ui.View:
    """Create a view with all message interaction buttons."""
    view = ui.View(timeout=None)

    # Add reply button
    view.add_item(ReplyToSenderButton(
        receiver_id, sender_id, bot, db, conv_handler
    ))

    # Add message recipient button
    view.add_item(MessageRecipientButton(
        receiver_id, bot, db, conv_handler
    ))

    # Add existing buttons
    view.add_item(ReminderButton(...))
    view.add_item(EscalateButton(...))

    return view
```

### Phase 6: Main Bot Integration

**File: `/home/andrewgari/Repos/ratmas-js/src/main.py`**

1. Initialize `ConversationHandler` in `RatmasBot.__init__`
2. Pass conversation handler to DM handler

```python
class RatmasBot(discord.Client):
    def __init__(self):
        # ... existing code ...
        self.db = RatmasDB()
        self.conversation_handler = ConversationHandler(self.db)
        self.dm_handler = DMHandler(self, self.db, self.conversation_handler)
```

### Phase 7: Configuration Updates

**File: `/home/andrewgari/Repos/ratmas-js/src/config.py`**

Add new configuration options:

```python
# Conversation context timeout (hours)
CONVERSATION_CONTEXT_TIMEOUT_HOURS = int(
    os.getenv("CONVERSATION_CONTEXT_TIMEOUT_HOURS", 24)
)
```

**File: `/home/andrewgari/Repos/ratmas-js/.env.example`**

```bash
# Conversation context timeout (how long to remember last sender)
CONVERSATION_CONTEXT_TIMEOUT_HOURS=24
```

---

## UI/UX Flow

### Scenario 1: User Receives First Message

**User B receives message from User A:**

```
📬 Message from someone receiving your gifts:

"What's your wishlist link?"

━━━━━━━━━━━━━━━━━━━━━━
💡 Quick actions:
• Reply to Sender - Respond to this message
• Message My Recipient - Send to your official recipient
• Send Reminder - Resend this message to your gift giver
• Report Issue - Contact the manager

[💬 Reply to Sender] [📤 Message My Recipient]
[🔔 Send Reminder] [⚠️ Report Issue]
```

**User B clicks "Reply to Sender":**
- Modal opens with text input
- Message sends to User A
- Confirmation: "✅ Reply sent!"

### Scenario 2: User Wants to Switch Recipients

**User B has been replying to A, but wants to message C (their recipient):**

1. User B clicks "📤 Message My Recipient" button
2. Modal opens for new message
3. Mode switches to "recipient"
4. Next regular DM goes to C (their official recipient)

### Scenario 3: Multiple Senders

**User B receives from both A (official) and D (rogue):**

```
📬 Message from someone receiving your gifts:

"Do you like cats or dogs?"

━━━━━━━━━━━━━━━━━━━━━━
💡 Quick actions:
• Reply to Sender - Respond to this message
• Message My Recipient - Send to your official recipient
• Send Reminder - Resend this message
• Report Issue - Contact the manager

[💬 Reply to Sender] [📤 Message My Recipient]
[🔔 Send Reminder] [⚠️ Report Issue]
```

- Each message tracks its sender
- "Reply to Sender" replies to the specific sender who sent that message
- Context remembers the LAST sender who messaged you

---

## Edge Cases & Handling

### Edge Case 1: User Has No Official Recipient

**Scenario:** User hasn't chosen their recipient yet

**Solution:**
```python
def get_official_destination(self, user_id):
    assignment = self.db.get_official_assignment(user_id)
    if not assignment:
        # Send error to user
        await self.send_no_recipient_error(user_id)
        return None
    return assignment["receiver_id"]

async def send_no_recipient_error(self, user_id):
    user = await self.bot.fetch_user(user_id)
    await user.send(
        "❌ **You haven't chosen a recipient yet!**\n\n"
        "Wait for the assignment DM and select who you're sending gifts to."
    )
```

### Edge Case 2: User Has No Sender (No One Messaged Them)

**Scenario:** User tries to reply but no one has messaged them

**Solution:**
```python
if context.get("mode") == "sender":
    if not context.get("last_received_from"):
        await self.send_no_sender_error(user_id)
        # Fall back to sending to recipient
        destination = self.get_official_destination(user_id)
```

### Edge Case 3: Sender Left the Server

**Scenario:** User's sender left, context points to invalid user

**Solution:**
```python
async def forward_message(self, sender_id, receiver_id, text, is_reply=False):
    try:
        receiver = await self.bot.fetch_user(receiver_id)
        # ... send message ...
    except discord.NotFound:
        # User doesn't exist
        sender = await self.bot.fetch_user(sender_id)
        await sender.send(
            "❌ **Recipient not found!**\n\n"
            "The person you're trying to message is no longer available. "
            "They may have left the server."
        )
        # Clear their context
        self.db.clear_conversation_context(sender_id)
```

### Edge Case 4: Context Expires

**Scenario:** User hasn't messaged in 24 hours, context expires

**Solution:**
- Redis TTL automatically expires context after 24 hours
- Next DM defaults to sending to official recipient
- User gets confirmation: "Sending to your official recipient: [Name]"

### Edge Case 5: Multiple Rogue Senders

**Scenario:** User receives from Official A + Rogue D + Rogue E

**Solution:**
- Each incoming message updates "last_received_from"
- Reply goes to whoever sent the MOST RECENT message
- User can use "Message My Recipient" to reset to official

### Edge Case 6: User Clicks Wrong Button

**Scenario:** User accidentally clicks "Message My Recipient" when they meant to reply

**Solution:**
- Modal shows clear header: "Message to [Recipient Name]"
- User can cancel the modal
- Provide `/reset-mode` command to clear context

---

## Testing Strategy

### Unit Tests

**File: `/home/andrewgari/Repos/ratmas-js/tests/test_conversation_handler.py`**

```python
def test_record_message_sent():
    # Test context updates when sending

def test_record_message_received():
    # Test context updates when receiving

def test_get_destination_sender_mode():
    # Test routing to sender

def test_get_destination_recipient_mode():
    # Test routing to recipient

def test_context_expiration():
    # Test TTL expiration
```

**File: `/home/andrewgari/Repos/ratmas-js/tests/test_dm_handler.py`**

```python
async def test_dm_routes_to_recipient_by_default():
    # User sends DM without context → goes to recipient

async def test_dm_routes_to_sender_in_reply_mode():
    # User receives message, replies → goes to sender

async def test_mode_switches_with_button():
    # Button click changes mode correctly

async def test_multiple_senders():
    # Latest sender gets replies
```

### Integration Tests

1. **Full conversation flow:** A → B → A (reply)
2. **Mode switching:** B receives from A, messages C, then replies to A
3. **Multiple senders:** A and D message B, B replies to D
4. **Error handling:** No recipient, no sender, invalid user

### Manual Testing Checklist

- [ ] User A sends message to official recipient B
- [ ] User B receives message with all 4 buttons
- [ ] User B clicks "Reply to Sender", message goes to A
- [ ] User B clicks "Message My Recipient", message goes to C
- [ ] User B sends regular DM after replying, goes to last context
- [ ] Context expires after 24 hours
- [ ] Error messages appear when no recipient/sender exists
- [ ] Buttons work on mobile Discord client
- [ ] Modals display correctly

---

## Database Schema Changes

### New Redis Keys

```
ratmas:conversation:{user_id}
```

**Value Structure:**
```json
{
    "last_received_from": 123456789,
    "last_received_at": "2025-12-13T10:30:00Z",
    "last_sent_to": 987654321,
    "last_sent_at": "2025-12-13T10:35:00Z",
    "mode": "sender"
}
```

**TTL:** 86400 seconds (24 hours)

### No Changes to Existing Schema

- `ratmas:users` - unchanged
- `ratmas:assignments` - unchanged
- `ratmas:active` - unchanged

---

## Code Changes Summary

### Files to Create

1. **`/home/andrewgari/Repos/ratmas-js/src/handlers/conversation_handler.py`**
   - ConversationHandler class
   - Context management logic

### Files to Modify

1. **`/home/andrewgari/Repos/ratmas-js/src/database.py`**
   - Add `get_official_senders(receiver_id)`
   - Add `get_conversation_context(user_id)`
   - Add `set_conversation_context(user_id, context)`
   - Add `clear_conversation_context(user_id)`

2. **`/home/andrewgari/Repos/ratmas-js/src/handlers/dm_handler.py`**
   - Update `__init__` to accept conversation_handler
   - Update `_relay_after_delay` to use conversation context
   - Add `forward_message` method
   - Add `get_official_destination` method
   - Add error handling methods

3. **`/home/andrewgari/Repos/ratmas-js/src/handlers/button_handler.py`**
   - Add `ReplyToSenderButton` class
   - Add `MessageRecipientButton` class
   - Add `ReplyModal` class
   - Add `MessageRecipientModal` class
   - Update `create_message_buttons` → `create_message_view`

4. **`/home/andrewgari/Repos/ratmas-js/src/main.py`**
   - Initialize ConversationHandler
   - Pass to DMHandler

5. **`/home/andrewgari/Repos/ratmas-js/src/config.py`**
   - Add `CONVERSATION_CONTEXT_TIMEOUT_HOURS`

6. **`/home/andrewgari/Repos/ratmas-js/.env.example`**
   - Document new config option

### Files to Test

1. **`/home/andrewgari/Repos/ratmas-js/tests/test_conversation_handler.py`** (new)
2. **`/home/andrewgari/Repos/ratmas-js/tests/test_dm_handler.py`** (update)
3. **`/home/andrewgari/Repos/ratmas-js/tests/test_button_handler.py`** (new)

---

## Migration Strategy

### For Existing Conversations

**No migration needed** - this is a new feature:

1. Deploy new code
2. Existing message flow continues to work (sends to recipient)
3. New context tracking starts automatically
4. Users see new buttons on next received message

### Rollback Plan

If issues arise:

1. Revert to previous Docker image tag
2. Conversation context expires naturally (no data corruption)
3. No database migration needed (Redis keys auto-expire)

---

## User Documentation Updates

### Update README.md

**Section: "Send Anonymous Messages"**

Add:

```markdown
#### Send Anonymous Messages

Just DM the bot directly! Your messages are automatically forwarded:

**Sending to your recipient (default):**
- Send a regular DM to the bot
- It forwards to your official gift recipient

**Replying to your sender:**
- When you receive a message, click "💬 Reply to Sender"
- Your next messages go to the person who sent you that message
- Click "📤 Message My Recipient" to switch back to your official recipient

**Buttons on received messages:**
- **Reply to Sender** - Respond to whoever sent this specific message
- **Message My Recipient** - Send to your official gift recipient
- **Send Reminder** - Resend this message if no response
- **Report Issue** - Contact the manager for help

Messages are combined if sent within 5 seconds (configurable).
```

### Update Admin Guide

**Section: "How Communication Works"**

Update FAQ:

```markdown
**Q: How do I reply to messages from my sender?**
A: When you receive a message, click the "Reply to Sender" button.
   Your next messages will go to them instead of your official recipient.

**Q: How do I switch back to messaging my recipient?**
A: Click "Message My Recipient" button, or wait 24 hours for context to reset.

**Q: What if multiple people message me?**
A: Each message has a "Reply to Sender" button that replies to whoever
   sent that specific message. The system remembers the last person who
   messaged you for easy replying.
```

---

## Performance Considerations

### Redis Memory Impact

**Context per user:** ~200 bytes
**Max participants:** 100 users
**Total memory:** ~20 KB (negligible)

### Network Impact

**Additional Discord API calls:** +2 per message
- Fetch sender user (existing)
- Fetch receiver user (existing)
- No new API calls needed

### Button Interaction Latency

**Expected:** <500ms for button click → modal display
**Acceptable:** <2s for message send → delivery

---

## Security Considerations

### Privacy Maintained

- Messages remain anonymous
- User IDs stored in context (not message content)
- Context expires after 24 hours
- No message history stored (only metadata)

### Abuse Prevention

- Rate limiting via Discord (built-in)
- Manager escalation path exists (Report Issue button)
- Context TTL prevents indefinite storage

### Data Retention

- Context auto-expires (24hr TTL)
- No PII beyond existing user_id + display_name
- Archives don't include conversation context

---

## Monitoring & Observability

### Logging Additions

```python
logger.info(f"Conversation context updated: {user_id} → mode={mode}")
logger.info(f"Message routed to sender: {sender_id} → {receiver_id} (reply)")
logger.warning(f"No sender context for user {user_id}, falling back to recipient")
logger.error(f"Failed to deliver message: receiver {receiver_id} not found")
```

### Metrics to Track

- Conversation context hit rate (replies vs new messages)
- Button click distribution (Reply vs Message Recipient)
- Mode switching frequency
- Context expiration rate

---

## Alternative Solutions Considered

### Alternative 1: Message Prefix Commands

**Idea:** Users type `@sender message` or `@recipient message`

**Pros:**
- No buttons needed
- Simple to implement

**Cons:**
- Not intuitive
- Easy to make mistakes
- Breaks "natural DM" flow

**Verdict:** ❌ Rejected - worse UX

### Alternative 2: Slash Commands in DMs

**Idea:** `/reply message` or `/send-to-recipient message`

**Pros:**
- Explicit intent
- Familiar command pattern

**Cons:**
- Slash commands in DMs are awkward
- Extra step for every message
- Not as natural as buttons

**Verdict:** ❌ Rejected - too clunky

### Alternative 3: Automatic Reply Detection

**Idea:** Auto-detect if user is replying based on message timing/content

**Pros:**
- No user action needed
- "Magic" experience

**Cons:**
- Unreliable (what if they want to message recipient after receiving?)
- Confusing when it guesses wrong
- Hard to debug

**Verdict:** ❌ Rejected - too error-prone

### Alternative 4: Separate DM Channels

**Idea:** Create separate Discord channels for each conversation

**Pros:**
- Clear separation
- No mode switching

**Cons:**
- Can't use DM channels (Discord limitation)
- Would need forum/threads (complex)
- Breaks current simple DM flow

**Verdict:** ❌ Rejected - architectural overhaul

### Selected Solution: Conversation Context + Buttons

**Pros:**
- Intuitive UI (buttons on messages)
- Maintains existing DM flow
- Clear user control
- Graceful fallbacks

**Cons:**
- Requires context storage (minimal Redis space)
- Slightly more complex logic

**Verdict:** ✅ Best balance of UX and complexity

---

## Success Criteria

### Functional Requirements Met

- ✅ User can reply to messages from their sender
- ✅ User can still send to their official recipient
- ✅ UI clearly shows which mode is active
- ✅ System handles multiple senders correctly
- ✅ Error messages guide users when issues occur

### Non-Functional Requirements Met

- ✅ Response time <2s for message delivery
- ✅ Button interactions <500ms
- ✅ No data loss on context expiration
- ✅ Backward compatible (existing flows still work)
- ✅ Redis memory impact <100 KB for 100 users

### User Experience Goals

- ✅ Intuitive for non-technical users
- ✅ No confusing states
- ✅ Clear error messages
- ✅ Mobile-friendly buttons
- ✅ Natural conversation flow

---

## Post-Launch Monitoring

### Week 1: Initial Launch

- Monitor error logs for exceptions
- Track button click rates
- Collect user feedback in Discord
- Watch for mode confusion reports

### Week 2-4: Optimization

- Tune context timeout if needed
- Adjust button labels based on feedback
- Add help messages if users are confused
- Optimize Redis key structure if memory issues

### Month 2+: Analysis

- Analyze reply patterns
- Identify UX friction points
- Consider additional features (e.g., message history)

---

## Future Enhancements

### Possible V2 Features

1. **Message History View**
   - Show last 5 messages in conversation
   - Help users remember context

2. **Multi-Sender Selector**
   - Dropdown to choose which sender to reply to
   - Useful when 3+ people message you

3. **Notification Preferences**
   - Let users mute specific senders
   - Configure reply mode persistence

4. **Rich Reply Context**
   - Quote the original message in reply
   - Show sender's question when replying

5. **Analytics Dashboard**
   - Admin view of message flow
   - Identify stuck conversations

---

## Critical Files for Implementation

Here are the 5 most critical files for implementing this plan:

1. **/home/andrewgari/Repos/ratmas-js/src/handlers/dm_handler.py** - Core message routing logic that needs conversation context integration; this is where destination determination happens

2. **/home/andrewgari/Repos/ratmas-js/src/database.py** - Must add methods for conversation context storage and retrieval from Redis, plus sender lookup methods

3. **/home/andrewgari/Repos/ratmas-js/src/handlers/button_handler.py** - Need to create new button classes for reply/recipient mode switching with modal interactions

4. **/home/andrewgari/Repos/ratmas-js/src/handlers/conversation_handler.py** - New file to create that encapsulates all conversation state management logic

5. **/home/andrewgari/Repos/ratmas-js/src/main.py** - Initialize and wire up the conversation handler to the DM handler and bot lifecycle
