const cal = require('./cal');
const squarespace = require('./squarespace');
const log = require('./log');

async function syncEventsInGoogleCalender(squarespaceEvents) {
  const changes = {
    toDelete: [],
    toCreate: [],
  };

  const existingGoogleEvents = await cal.getAllEvents();
  log.debugJSON(existingGoogleEvents);

  // Find new squarespace events to add
  for (const squarespaceEvent of squarespaceEvents) {
    // let found = false;
    // for (const existingGoogleEvent of existingGoogleEvents.items) {
    //   if (cal.areEventsEqual(squarespaceEvent, existingGoogleEvent)) {
    //     found = true;
    //     break;
    //   }
    // }
    // if (!found) {
      changes.toCreate.push(squarespaceEvent);
    // }
  }

  // Find existing Google Calendar events to remove
  for (const existingGoogleEvent of existingGoogleEvents) {
    // let found = false;
    // for (const squarespaceEvent of squarespaceEvents) {
    //   if (cal.areEventsEqual(squarespaceEvent, existingGoogleEvent)) {
    //     found = true;
    //     break;
    //   }
    // }
    // if (!found) {
      changes.toDelete.push(existingGoogleEvent);
    // }
  }

  log.debugJSON(changes);

  for (const e of changes.toDelete) {
    log.info('Google Calendar delete event:', e.summary, e.creator.email);

    if (e.creator.email !== cal.creator) {
      throw new Error(`Will only delete events created by ${cal.creator}`);
    }
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
  const events = await squarespace.getAllEvents();
  await syncEventsInGoogleCalender(events);
}

main();
