const cal = require('./cal');
const squarespace = require('./squarespace');
const log = require('./log');

function areEventsEqual(squarespaceEvent, googleCalendarEvent) {
  return squarespaceEvent.title === googleCalendarEvent.summary &&
    cal.formatDateTime(squarespaceEvent.startDate, squarespaceEvent.startTime) === googleCalendarEvent.start.dateTime &&
    cal.formatDateTime(squarespaceEvent.endDate, squarespaceEvent.endTime) === googleCalendarEvent.end.dateTime &&
    squarespaceEvent.address === googleCalendarEvent.locator &&
    squarespaceEvent.description === googleCalendarEvent.description &&
    squarespaceEvent.href === googleCalendarEvent.source.url;
}

async function syncEventsInGoogleCalender(latestSquarespaceEvents) {
  const changes = {
    toDelete: [],
    toCreate: [],
  };

  const existingGoogleEvents = await cal.getAllEvents();

  // Find new squarespace events to add
  for (const latestSquarespaceEvent of latestSquarespaceEvents) {
    let found = false;
    for (const existingGoogleEvent of existingGoogleEvents.items) {
      if (areEventsEqual(latestSquarespaceEvent, existingGoogleEvent)) {
        found = true;
        break;
      }
    }
    if (!found) {
      changes.toCreate.push(latestSquarespaceEvent);
    }
  }

  // Find existing Google Calendar events to remove
  for (const existingGoogleEvent of existingGoogleEvents.items) {
    let found = false;
    for (const latestSquarespaceEvent of latestSquarespaceEvents) {
      if (areEventsEqual(latestSquarespaceEvent, existingGoogleEvent)) {
        found = true;
        break;
      }
    }
    if (!found && new Date(existingGoogleEvent.start.dateTime) > new Date()) {
      changes.toDelete.push(existingGoogleEvent);
    }
  }

  log.debugJSON(changes);

  for (const e of changes.toDelete) {
    log.info('Google Calendar delete event:', e.summary);
    const result = await cal.deleteEvent(e.id);
    log.debugJSON(result);
  }

  for (const e of changes.toCreate) {
    log.info('Google Calendar create event:', e.title);
    const result = await cal.createEvent(e);
    log.debugJSON(result);
  }
}

async function main() {
  const events = await squarespace.getEvents();
  await syncEventsInGoogleCalender(events);
}

main();
