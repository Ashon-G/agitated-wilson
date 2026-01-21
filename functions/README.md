# Firebase Cloud Functions

This directory contains Firebase Cloud Functions that power the Reddit AI lead generation system.

## Overview

The cloud functions provide backend functionality for:

1. **User-Agent Communication** - Chat with your AI agent and handle questions
2. **HubSpot Integration** - Sync qualified leads to HubSpot CRM
3. **Autonomous Reddit Agent** - Scheduled function that hunts for leads every 30 minutes
4. **Comment Approval** - AI quality check and user approval before posting to Reddit
5. **Push Notifications** - Register and manage device tokens
6. **Admin Functions** - User management and cleanup

## File Structure

```
functions/
├── src/
│   ├── index.ts                      # Main exports and function definitions
│   ├── userAgentChat.ts              # User-agent communication
│   ├── aiCommentGenerator.ts         # AI comment generation
│   ├── autonomousRedditAgent.ts      # Scheduled lead hunting (every 30 min)
│   ├── approveComment.ts             # Comment approval workflow
│   ├── postPendingComment.ts         # Post approved comments to Reddit
│   ├── syncLeadToHubSpot.ts          # HubSpot CRM integration
│   ├── knowledgeBaseQuery.ts         # Knowledge base queries
│   ├── pushNotificationService.ts    # Push notifications
│   ├── adminUserDeletion.ts          # Admin user management
│   └── scheduledCleanup.ts           # Scheduled data cleanup
└── README.md                         # This file
```

## Functions

### User-Agent Functions
- `userAgentChat` - Chat with your AI sales agent
- `getUserAgentConversations` - Get conversation history
- `agentAskUser` - Agent asks user a question
- `respondToAgentQuestion` - User responds to agent question
- `getPendingAgentQuestions` - Get pending questions from agent

### Lead Management
- `syncLeadToHubSpot` - Sync qualified leads to HubSpot CRM
- `autonomousRedditAgent` - Scheduled function that runs every 30 minutes to find leads

### Comment Approval
- `onPendingCommentCreated` - AI quality check when new comment is created
- `approveAndPostComment` - User approves and posts comment to Reddit
- `rejectComment` - User rejects a pending comment

### Push Notifications
- `registerPushToken` - Register device for push notifications
- `unregisterPushToken` - Unregister device token

### Admin
- `adminDeleteUser` - Delete user account with cascading deletion
- `setAdminClaim` - Set admin privileges
- `weeklyOrphanedDataCleanup` - Scheduled cleanup of orphaned data

## Deployment

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:autonomousRedditAgent
```

## Environment Variables

Set these in Firebase:

```bash
firebase functions:config:set \
  openai.key="YOUR_OPENAI_KEY" \
  reddit.client_id="YOUR_REDDIT_CLIENT_ID" \
  reddit.client_secret="YOUR_REDDIT_CLIENT_SECRET"
```

## How Lead Hunting Works

1. **In-App Hunting Engine** - The mobile app runs the HuntingEngine when Reddit is connected
2. **Autonomous Cloud Function** - `autonomousRedditAgent` runs every 30 minutes as backup
3. **Lead Scoring** - Both use Gemini AI to score leads based on buying intent
4. **Inbox Items** - Qualified leads create inbox items for user approval
5. **Comment Posting** - After approval, comments are posted via Cloud Function to Reddit
