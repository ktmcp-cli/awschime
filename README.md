> "Six months ago, everyone was talking about MCPs. And I was like, screw MCPs. Every MCP would be better as a CLI."
>
> — [Peter Steinberger](https://twitter.com/steipete), Founder of OpenClaw
> [Watch on YouTube (~2:39:00)](https://www.youtube.com/@lexfridman) | [Lex Fridman Podcast #491](https://lexfridman.com/peter-steinberger/)

# Amazon Chime CLI

Production-ready CLI for the Amazon Chime Communications API. Manage meetings, attendees, and messaging channels from your terminal.

## Installation

```bash
npm install -g @ktmcp-cli/awschime
```

## Configuration

```bash
awschime config set --access-key-id YOUR_ACCESS_KEY_ID \
  --secret-access-key YOUR_SECRET_ACCESS_KEY
```

## Usage

### Config

```bash
# Set AWS credentials
awschime config set --access-key-id <id> --secret-access-key <secret>

# Get a config value
awschime config get accessKeyId

# List all config
awschime config list
```

### Meetings

```bash
# List active meetings
awschime meetings list

# Get meeting details
awschime meetings get <meeting-id>

# Create a new meeting
awschime meetings create
awschime meetings create --external-id "team-standup-2024-01-15" --region us-east-1

# Delete a meeting
awschime meetings delete <meeting-id>

# JSON output
awschime meetings list --json
```

### Attendees

```bash
# List attendees in a meeting
awschime attendees list <meeting-id>

# Get attendee details
awschime attendees get <meeting-id> <attendee-id>

# Add an attendee to a meeting
awschime attendees create <meeting-id> --user-id "user@company.com"

# Remove an attendee
awschime attendees delete <meeting-id> <attendee-id>
```

### Channels (Chime SDK Messaging)

```bash
# List messaging channels
awschime channels list
awschime channels list --app-instance-arn arn:aws:chime:us-east-1:123456789012:app-instance/abc123

# Get channel details
awschime channels get <channel-arn>

# Create a channel
awschime channels create \
  --app-instance-arn arn:aws:chime:us-east-1:123456789012:app-instance/abc123 \
  --name "Engineering Team" \
  --mode UNRESTRICTED \
  --privacy PUBLIC

# Delete a channel
awschime channels delete <channel-arn>
```

## Media Regions

Amazon Chime supports these media regions for optimal latency:
- `us-east-1` (N. Virginia) — default
- `us-west-2` (Oregon)
- `eu-west-1` (Ireland)
- `eu-central-1` (Frankfurt)
- `ap-southeast-1` (Singapore)
- `ap-northeast-1` (Tokyo)

## JSON Output

All commands support `--json` for scripting:

```bash
# Get all meetings as JSON
awschime meetings list --json

# Get attendees and pipe to jq
awschime attendees list <meeting-id> --json | jq '.[].ExternalUserId'
```

## License

MIT


---

## Support KTMCP

If you find this CLI useful, we'd greatly appreciate your support! Share your experience on:
- Reddit
- Twitter/X
- Hacker News

**Incentive:** Users who can demonstrate that their support/advocacy helped advance KTMCP will have their feature requests and issues prioritized.

Just be mindful - these are real accounts and real communities. Authentic mentions and genuine recommendations go a long way!

## Support This Project

If you find this CLI useful, we'd appreciate support across Reddit, Twitter, Hacker News, or Moltbook. Please be mindful - these are real community accounts. Contributors who can demonstrate their support helped advance KTMCP will have their PRs and feature requests prioritized.
