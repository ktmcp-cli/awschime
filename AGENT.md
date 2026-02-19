# AGENT.md — Amazon Chime CLI for AI Agents

## Overview

The `awschime` CLI provides access to the Amazon Chime Communications API. Use it to manage video meetings, attendees, and SDK messaging channels.

## Prerequisites

Configure AWS credentials before use:

```bash
awschime config set --access-key-id <id> --secret-access-key <secret>
awschime config list
```

## All Commands

### Config

```bash
awschime config set --access-key-id <id> --secret-access-key <secret>
awschime config set --session-token <token>
awschime config get accessKeyId
awschime config list
```

### Meetings

```bash
awschime meetings list
awschime meetings get <meeting-id>
awschime meetings create
awschime meetings create --external-id <id> --region us-east-1
awschime meetings delete <meeting-id>
```

### Attendees

```bash
awschime attendees list <meeting-id>
awschime attendees get <meeting-id> <attendee-id>
awschime attendees create <meeting-id> --user-id <external-user-id>
awschime attendees delete <meeting-id> <attendee-id>
```

### Channels

```bash
awschime channels list
awschime channels list --app-instance-arn <arn>
awschime channels get <channel-arn>
awschime channels create --app-instance-arn <arn> --name <name>
awschime channels create --app-instance-arn <arn> --name <name> --mode RESTRICTED --privacy PRIVATE
awschime channels delete <channel-arn>
```

Channel modes: UNRESTRICTED, RESTRICTED
Channel privacy: PUBLIC, PRIVATE

## JSON Output

Always use `--json` when parsing results:

```bash
awschime meetings list --json
awschime attendees list <meeting-id> --json
awschime channels list --json
```

## Workflow: Create a meeting with attendees

```bash
# Create meeting
MEETING=$(awschime meetings create --external-id "team-call" --json)
MEETING_ID=$(echo $MEETING | jq -r '.MeetingId')

# Add attendees
awschime attendees create $MEETING_ID --user-id "alice@company.com"
awschime attendees create $MEETING_ID --user-id "bob@company.com"

# List attendees
awschime attendees list $MEETING_ID --json
```

## Error Handling

CLI exits with code 1 on error. Common errors:
- `Authentication failed` — Check AWS credentials
- `Resource not found` — Meeting or attendee ID may be invalid
- `Rate limit exceeded` — Chime has per-account limits
