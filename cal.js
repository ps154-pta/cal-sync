const querystring = require('querystring');
const { GoogleAuth } = require('google-auth-library');
const sanitizeHtml = require('sanitize-html');

const SERVICE_ACCOUNT_KEY = require('./service-account-key.json');
const utils = require('./utils');

const creator = "ps-154-calendar-sync@my-project-1470240980331.iam.gserviceaccount.com";
const calendarId = querystring.escape('728f7eeb1f5d4129b649b2e91273feac0a4ce664660c23c11ef879e5a16a628e@group.calendar.google.com');
const EVENTS_URI = (pageToken, maxResults) => {
  const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const params = {};
  if (pageToken) params.pageToken = pageToken;
  if (maxResults) params.maxResults = maxResults;
  if (utils.isEmpty(params)) return base;
  const qs = querystring.stringify(params);
  return `${base}?${qs}`;
};
const EVENT_URI = (eventId) =>
  `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;

let DEFAULT_OPTIONS;

async function init() {
  if (DEFAULT_OPTIONS) {
    return;
  }
  const auth = new GoogleAuth({
    credentials: SERVICE_ACCOUNT_KEY,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const accessToken = await auth.getAccessToken();
  DEFAULT_OPTIONS = {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  };
}

function formatDateTime(date, time) {
  return `${date}T${time}:00`
}

const DEFAULT_TIMEZONE = 'America/New_York';

function payloadFromEvent(event) {
  const conferenceDataEntryPoints = (event.zoomLinks || []).map(uri => ({
    entryPointType: 'video',
    uri,
  }));
  let description = event.description;
  if (description) {
    description = description.replace(/\n/g, '');
    description = sanitizeHtml(description, {
      exclusiveFilter: function(frame) {
        return !frame.text.trim();
      },
      textFilter: function(text, tagName) {
        return text.trim();
      },
      allowedTags: sanitizeHtml.defaults.allowedTags.filter(tag => tag !== 'div'),
    });
    description = description.trim();
    description = `<p><a href="${event.href}">Event page</a></p><div>${description}</div>`;
  }
  const payload = {
    summary: event.title,
    description,
    location: event.address,
    source: {
      url: event.href,
    },
    start: {
      dateTime: formatDateTime(event.startDate, event.startTime),
      timeZone: DEFAULT_TIMEZONE,
    },
    end: {
      dateTime: formatDateTime(event.endDate, event.endTime),
      timeZone: DEFAULT_TIMEZONE,
    },
  };
  if (conferenceDataEntryPoints.length > 0) {
    payload.conferenceData = {
      conferenceSolution: {
        key: {
          type: 'addOn',
        },
        name: 'Zoom',
      },
      entryPoints: conferenceDataEntryPoints,
    };
  }
  return payload;
}

function areEventsEqual(event, googleCalendarEvent) {
  const eventPayload = payloadFromEvent(event);
  return eventPayload.summary === googleCalendarEvent.summary &&
    eventPayload.start.dateTime === googleCalendarEvent.start.dateTime &&
    eventPayload.end.dateTime === googleCalendarEvent.end.dateTime &&
    eventPayload.location === googleCalendarEvent.location &&
    eventPayload.description === googleCalendarEvent.description &&
    eventPayload.source.url === googleCalendarEvent.source.url;
}

async function getAllEvents() {
  await init();
  let items = [];
  let pageToken;
  do {
    const res = await fetch(EVENTS_URI(pageToken, 250), {
      ...DEFAULT_OPTIONS,
    });
    const resBody = await res.json();
    items = [
      ...items,
      ...resBody.items,
    ];
    if (res.nextPageToken && pageToken === res.nextPageToken) {
      throw new Error('Google Calendar nextPageToken error');
    }
    pageToken = resBody.nextPageToken;
  } while (pageToken);
  return items;
}

async function getEvent(eventId) {
  await init();
  const res = await fetch(EVENT_URI(eventId), {
    ...DEFAULT_OPTIONS,
  });
  return await res.json();
}

async function createEvent(event) {
  await init();
  const options = {
    method: 'POST',
    body: JSON.stringify(payloadFromEvent(event)),
    ...DEFAULT_OPTIONS,
  };
  const res = await fetch(EVENTS_URI(), options);
  return res.json();
}

async function updateEvent(eventId, event) {
  await init();
  return await fetch(EVENT_URI(eventId), {
    method: 'PUT',
    body: JSON.stringify(payloadFromEvent(event)),
    ...DEFAULT_OPTIONS,
  });
}

async function deleteEvent(eventId) {
  await init();
  return await fetch(EVENT_URI(eventId), {
    method: 'DELETE',
    ...DEFAULT_OPTIONS,
  });
}

module.exports = {
  init,
  formatDateTime,
  getAllEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  areEventsEqual,
  creator,
};
