import axios from 'axios';
import crypto from 'crypto';
import { getConfig } from './config.js';

const SERVICE = 'chime';
const BASE_URL = 'https://chime.us-east-1.amazonaws.com';
const HOST = 'chime.us-east-1.amazonaws.com';
const REGION = 'us-east-1';

// ============================================================
// AWS SigV4 Request Signing
// ============================================================

function sign(key, msg) {
  return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, region, service) {
  const kDate = sign('AWS4' + key, dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  return sign(kService, 'aws4_request');
}

function getAmzDate() {
  return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function buildSignedHeaders({ method, path, body, queryString, accessKeyId, secretAccessKey, sessionToken }) {
  const amzDate = getAmzDate();
  const dateStamp = amzDate.substring(0, 8);

  const bodyStr = body ? JSON.stringify(body) : '';
  const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');

  const headers = {
    'content-type': 'application/json',
    'host': HOST,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': contentHash
  };
  if (sessionToken) headers['x-amz-security-token'] = sessionToken;

  const signedHeaderNames = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map(k => `${k}:${headers[k]}\n`).join('');
  const canonicalRequest = [method, path, queryString || '', canonicalHeaders, signedHeaderNames, contentHash].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, REGION, SERVICE);
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderNames}, Signature=${signature}`;

  return { headers: { ...headers, authorization }, bodyStr };
}

// ============================================================
// API Client
// ============================================================

async function apiRequest(method, path, body = null, params = null) {
  const accessKeyId = getConfig('accessKeyId');
  const secretAccessKey = getConfig('secretAccessKey');
  const sessionToken = getConfig('sessionToken');

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured. Run: awschime config set --access-key-id <id> --secret-access-key <secret>');
  }

  let queryString = '';
  if (params) {
    queryString = new URLSearchParams(params).toString();
  }

  const { headers, bodyStr } = buildSignedHeaders({
    method, path, body, queryString, accessKeyId, secretAccessKey, sessionToken
  });

  try {
    const url = BASE_URL + path + (queryString ? `?${queryString}` : '');
    const response = await axios({
      method,
      url,
      headers,
      data: bodyStr || undefined
    });
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
}

function handleApiError(error) {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    if (status === 401 || status === 403) throw new Error('Authentication failed. Check your AWS credentials.');
    if (status === 404) throw new Error('Resource not found.');
    if (status === 429) throw new Error('Rate limit exceeded. Please wait before retrying.');
    const message = data?.message || data?.Message || JSON.stringify(data);
    throw new Error(`API Error (${status}): ${message}`);
  } else if (error.request) {
    throw new Error('No response from AWS Chime API. Check your internet connection.');
  } else {
    throw error;
  }
}

// ============================================================
// MEETINGS
// ============================================================

export async function listMeetings() {
  const data = await apiRequest('GET', '/meetings');
  return data.Meetings || [];
}

export async function getMeeting(meetingId) {
  return await apiRequest('GET', `/meetings/${encodeURIComponent(meetingId)}`);
}

export async function createMeeting({ clientRequestToken, externalMeetingId, mediaRegion = 'us-east-1', meetingHostId }) {
  const body = {
    ClientRequestToken: clientRequestToken || crypto.randomUUID(),
    MediaRegion: mediaRegion
  };
  if (externalMeetingId) body.ExternalMeetingId = externalMeetingId;
  if (meetingHostId) body.MeetingHostId = meetingHostId;
  return await apiRequest('POST', '/meetings', body);
}

export async function deleteMeeting(meetingId) {
  return await apiRequest('DELETE', `/meetings/${encodeURIComponent(meetingId)}`);
}

// ============================================================
// ATTENDEES
// ============================================================

export async function listAttendees(meetingId) {
  const data = await apiRequest('GET', `/meetings/${encodeURIComponent(meetingId)}/attendees`);
  return data.Attendees || [];
}

export async function getAttendee(meetingId, attendeeId) {
  return await apiRequest('GET', `/meetings/${encodeURIComponent(meetingId)}/attendees/${encodeURIComponent(attendeeId)}`);
}

export async function createAttendee(meetingId, { externalUserId }) {
  const body = { ExternalUserId: externalUserId };
  return await apiRequest('POST', `/meetings/${encodeURIComponent(meetingId)}/attendees`, body);
}

export async function deleteAttendee(meetingId, attendeeId) {
  return await apiRequest('DELETE', `/meetings/${encodeURIComponent(meetingId)}/attendees/${encodeURIComponent(attendeeId)}`);
}

// ============================================================
// CHANNELS (Chime SDK Messaging)
// ============================================================

export async function listChannels({ appInstanceArn, maxResults = 20 } = {}) {
  const params = {};
  if (appInstanceArn) params.app_instance_arn = appInstanceArn;
  if (maxResults) params.max_results = maxResults;
  const data = await apiRequest('GET', '/channels', null, params);
  return data.Channels || [];
}

export async function getChannel(channelArn) {
  return await apiRequest('GET', `/channels/${encodeURIComponent(channelArn)}`);
}

export async function createChannel({ appInstanceArn, name, mode = 'UNRESTRICTED', privacy = 'PUBLIC', clientRequestToken }) {
  const body = {
    AppInstanceArn: appInstanceArn,
    Name: name,
    Mode: mode,
    Privacy: privacy,
    ClientRequestToken: clientRequestToken || crypto.randomUUID()
  };
  return await apiRequest('POST', '/channels', body);
}

export async function deleteChannel(channelArn) {
  return await apiRequest('DELETE', `/channels/${encodeURIComponent(channelArn)}`);
}
