import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getConfig, setConfig, isConfigured, getAllConfig } from './config.js';
import {
  listMeetings, getMeeting, createMeeting, deleteMeeting,
  listAttendees, getAttendee, createAttendee, deleteAttendee,
  listChannels, getChannel, createChannel, deleteChannel
} from './api.js';

const program = new Command();

// ============================================================
// Helpers
// ============================================================

function printSuccess(message) {
  console.log(chalk.green('✓') + ' ' + message);
}

function printError(message) {
  console.error(chalk.red('✗') + ' ' + message);
}

function printTable(data, columns) {
  if (!data || data.length === 0) {
    console.log(chalk.yellow('No results found.'));
    return;
  }

  const widths = {};
  columns.forEach(col => {
    widths[col.key] = col.label.length;
    data.forEach(row => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      if (val.length > widths[col.key]) widths[col.key] = val.length;
    });
    widths[col.key] = Math.min(widths[col.key], 40);
  });

  const header = columns.map(col => col.label.padEnd(widths[col.key])).join('  ');
  console.log(chalk.bold(chalk.cyan(header)));
  console.log(chalk.dim('─'.repeat(header.length)));

  data.forEach(row => {
    const line = columns.map(col => {
      const val = String(col.format ? col.format(row[col.key], row) : (row[col.key] ?? ''));
      return val.substring(0, widths[col.key]).padEnd(widths[col.key]);
    }).join('  ');
    console.log(line);
  });

  console.log(chalk.dim(`\n${data.length} result(s)`));
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

async function withSpinner(message, fn) {
  const spinner = ora(message).start();
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

function requireAuth() {
  if (!isConfigured()) {
    printError('AWS credentials not configured.');
    console.log('\nRun the following to configure:');
    console.log(chalk.cyan('  awschime config set --access-key-id <id> --secret-access-key <secret>'));
    process.exit(1);
  }
}

// ============================================================
// Program metadata
// ============================================================

program
  .name('awschime')
  .description(chalk.bold('Amazon Chime CLI') + ' - Meeting and communications from your terminal')
  .version('1.0.0');

// ============================================================
// CONFIG
// ============================================================

const configCmd = program.command('config').description('Manage CLI configuration');

configCmd
  .command('set')
  .description('Set configuration values')
  .option('--access-key-id <id>', 'AWS Access Key ID')
  .option('--secret-access-key <secret>', 'AWS Secret Access Key')
  .option('--session-token <token>', 'AWS Session Token (for temporary credentials)')
  .action((options) => {
    if (options.accessKeyId) { setConfig('accessKeyId', options.accessKeyId); printSuccess('Access Key ID set'); }
    if (options.secretAccessKey) { setConfig('secretAccessKey', options.secretAccessKey); printSuccess('Secret Access Key set'); }
    if (options.sessionToken) { setConfig('sessionToken', options.sessionToken); printSuccess('Session Token set'); }
    if (!options.accessKeyId && !options.secretAccessKey && !options.sessionToken) {
      printError('No options provided. Use --access-key-id, --secret-access-key, or --session-token');
    }
  });

configCmd
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Configuration key')
  .action((key) => {
    const value = getConfig(key);
    if (value === undefined) {
      printError(`Key '${key}' not found`);
    } else {
      console.log(value);
    }
  });

configCmd
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const all = getAllConfig();
    console.log(chalk.bold('\nAmazon Chime CLI Configuration\n'));
    console.log('Access Key ID:     ', all.accessKeyId ? chalk.green(all.accessKeyId) : chalk.red('not set'));
    console.log('Secret Access Key: ', all.secretAccessKey ? chalk.green('*'.repeat(8)) : chalk.red('not set'));
    console.log('Session Token:     ', all.sessionToken ? chalk.green('set') : chalk.dim('not set'));
    console.log('');
  });

// ============================================================
// MEETINGS
// ============================================================

const meetingsCmd = program.command('meetings').description('Manage Chime meetings');

meetingsCmd
  .command('list')
  .description('List active meetings')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const meetings = await withSpinner('Fetching meetings...', () => listMeetings());

      if (options.json) { printJson(meetings); return; }

      printTable(meetings, [
        { key: 'MeetingId', label: 'Meeting ID' },
        { key: 'ExternalMeetingId', label: 'External ID' },
        { key: 'MediaRegion', label: 'Region' },
        { key: 'MeetingArn', label: 'ARN', format: (v) => v ? v.split('/').pop() : '' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

meetingsCmd
  .command('get <meeting-id>')
  .description('Get details of a specific meeting')
  .option('--json', 'Output as JSON')
  .action(async (meetingId, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Fetching meeting...', () => getMeeting(meetingId));
      const meeting = result.Meeting || result;

      if (options.json) { printJson(meeting); return; }

      console.log(chalk.bold('\nMeeting Details\n'));
      console.log('Meeting ID:     ', chalk.cyan(meeting.MeetingId));
      console.log('External ID:    ', meeting.ExternalMeetingId || 'N/A');
      console.log('Region:         ', meeting.MediaRegion || 'N/A');
      console.log('ARN:            ', meeting.MeetingArn || 'N/A');
      if (meeting.MediaPlacement) {
        console.log('\nMedia Endpoints:');
        console.log('  Audio Host:   ', meeting.MediaPlacement.AudioHostUrl || 'N/A');
        console.log('  Signaling:    ', meeting.MediaPlacement.SignalingUrl || 'N/A');
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

meetingsCmd
  .command('create')
  .description('Create a new meeting')
  .option('--external-id <id>', 'External meeting ID for your system')
  .option('--region <region>', 'Media region (us-east-1, us-west-2, eu-west-1, etc.)', 'us-east-1')
  .option('--host-id <id>', 'Meeting host ID')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const result = await withSpinner('Creating meeting...', () =>
        createMeeting({
          externalMeetingId: options.externalId,
          mediaRegion: options.region,
          meetingHostId: options.hostId
        })
      );
      const meeting = result.Meeting || result;

      if (options.json) { printJson(meeting); return; }

      printSuccess('Meeting created');
      console.log('Meeting ID:  ', chalk.cyan(meeting.MeetingId));
      console.log('Region:      ', meeting.MediaRegion);
      if (meeting.MediaPlacement?.AudioHostUrl) {
        console.log('Audio Host:  ', meeting.MediaPlacement.AudioHostUrl);
      }
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

meetingsCmd
  .command('delete <meeting-id>')
  .description('Delete a meeting')
  .action(async (meetingId) => {
    requireAuth();
    try {
      await withSpinner(`Deleting meeting ${meetingId}...`, () => deleteMeeting(meetingId));
      printSuccess(`Meeting '${meetingId}' deleted`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// ATTENDEES
// ============================================================

const attendeesCmd = program.command('attendees').description('Manage meeting attendees');

attendeesCmd
  .command('list <meeting-id>')
  .description('List attendees in a meeting')
  .option('--json', 'Output as JSON')
  .action(async (meetingId, options) => {
    requireAuth();
    try {
      const attendees = await withSpinner('Fetching attendees...', () => listAttendees(meetingId));

      if (options.json) { printJson(attendees); return; }

      printTable(attendees, [
        { key: 'AttendeeId', label: 'Attendee ID' },
        { key: 'ExternalUserId', label: 'External User ID' },
        { key: 'JoinToken', label: 'Join Token', format: (v) => v ? v.substring(0, 20) + '...' : 'N/A' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

attendeesCmd
  .command('get <meeting-id> <attendee-id>')
  .description('Get details of a specific attendee')
  .option('--json', 'Output as JSON')
  .action(async (meetingId, attendeeId, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Fetching attendee...', () => getAttendee(meetingId, attendeeId));
      const attendee = result.Attendee || result;

      if (options.json) { printJson(attendee); return; }

      console.log(chalk.bold('\nAttendee Details\n'));
      console.log('Attendee ID:      ', chalk.cyan(attendee.AttendeeId));
      console.log('External User ID: ', attendee.ExternalUserId || 'N/A');
      console.log('Join Token:       ', attendee.JoinToken ? attendee.JoinToken.substring(0, 30) + '...' : 'N/A');
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

attendeesCmd
  .command('create <meeting-id>')
  .description('Add an attendee to a meeting')
  .requiredOption('--user-id <id>', 'External user ID for the attendee')
  .option('--json', 'Output as JSON')
  .action(async (meetingId, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Creating attendee...', () =>
        createAttendee(meetingId, { externalUserId: options.userId })
      );
      const attendee = result.Attendee || result;

      if (options.json) { printJson(attendee); return; }

      printSuccess('Attendee added to meeting');
      console.log('Attendee ID:  ', chalk.cyan(attendee.AttendeeId));
      console.log('User ID:      ', attendee.ExternalUserId);
      console.log('Join Token:   ', attendee.JoinToken ? attendee.JoinToken.substring(0, 30) + '...' : 'N/A');
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

attendeesCmd
  .command('delete <meeting-id> <attendee-id>')
  .description('Remove an attendee from a meeting')
  .action(async (meetingId, attendeeId) => {
    requireAuth();
    try {
      await withSpinner('Removing attendee...', () => deleteAttendee(meetingId, attendeeId));
      printSuccess(`Attendee '${attendeeId}' removed from meeting`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// CHANNELS
// ============================================================

const channelsCmd = program.command('channels').description('Manage Chime messaging channels');

channelsCmd
  .command('list')
  .description('List messaging channels')
  .option('--app-instance-arn <arn>', 'App Instance ARN')
  .option('--max-results <n>', 'Maximum results', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const channels = await withSpinner('Fetching channels...', () =>
        listChannels({ appInstanceArn: options.appInstanceArn, maxResults: parseInt(options.maxResults) })
      );

      if (options.json) { printJson(channels); return; }

      printTable(channels, [
        { key: 'ChannelArn', label: 'Channel ARN', format: (v) => v ? v.split('/').pop() : '' },
        { key: 'Name', label: 'Name' },
        { key: 'Mode', label: 'Mode' },
        { key: 'Privacy', label: 'Privacy' },
        { key: 'LastMessageTimestamp', label: 'Last Message', format: (v) => v ? new Date(v).toLocaleString() : 'N/A' }
      ]);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

channelsCmd
  .command('get <channel-arn>')
  .description('Get details of a specific channel')
  .option('--json', 'Output as JSON')
  .action(async (channelArn, options) => {
    requireAuth();
    try {
      const result = await withSpinner('Fetching channel...', () => getChannel(channelArn));
      const channel = result.Channel || result;

      if (options.json) { printJson(channel); return; }

      console.log(chalk.bold('\nChannel Details\n'));
      console.log('Name:     ', chalk.bold(channel.Name));
      console.log('ARN:      ', chalk.cyan(channel.ChannelArn));
      console.log('Mode:     ', channel.Mode);
      console.log('Privacy:  ', channel.Privacy);
      console.log('Created:  ', channel.CreatedTimestamp ? new Date(channel.CreatedTimestamp).toLocaleString() : 'N/A');
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

channelsCmd
  .command('create')
  .description('Create a new messaging channel')
  .requiredOption('--app-instance-arn <arn>', 'App Instance ARN')
  .requiredOption('--name <name>', 'Channel name')
  .option('--mode <mode>', 'Channel mode (UNRESTRICTED|RESTRICTED)', 'UNRESTRICTED')
  .option('--privacy <privacy>', 'Channel privacy (PUBLIC|PRIVATE)', 'PUBLIC')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    requireAuth();
    try {
      const result = await withSpinner('Creating channel...', () =>
        createChannel({
          appInstanceArn: options.appInstanceArn,
          name: options.name,
          mode: options.mode,
          privacy: options.privacy
        })
      );
      const channelArn = result.ChannelArn || result;

      if (options.json) { printJson(result); return; }

      printSuccess(`Channel '${options.name}' created`);
      console.log('Channel ARN: ', chalk.cyan(typeof channelArn === 'string' ? channelArn : JSON.stringify(channelArn)));
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

channelsCmd
  .command('delete <channel-arn>')
  .description('Delete a messaging channel')
  .action(async (channelArn) => {
    requireAuth();
    try {
      await withSpinner(`Deleting channel...`, () => deleteChannel(channelArn));
      printSuccess(`Channel deleted`);
    } catch (error) {
      printError(error.message);
      process.exit(1);
    }
  });

// ============================================================
// Parse
// ============================================================

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
