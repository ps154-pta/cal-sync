const { chromium } = require('playwright');

const log = require('./log');
const utils = require('./utils');

const PS154_ROOT = 'https://www.ps154.org';
const PS154_EVENTS_URI = `${PS154_ROOT}/events`;
const PS154_CALENDAR_URI = `${PS154_ROOT}/calendar`;
const VALID_ZOOM_ROOTS = [
  'https://zoom.us',
  'https://nycdoe.zoom.us',
];
const MAX_FETCHED_MONTHS = -1;
const MAX_CONSECUTIVE_EMPTY_MONTHS = 4;

async function * getAllEventURIsFromSquarespaceCalendar(page) {
  await page.goto(PS154_CALENDAR_URI);

  const previousMonthButton = await page.locator('a[aria-label="Go to previous month"]');

  let fetchedMonths = 0;
  let consecutiveEmptyMonths = 0;
  while (consecutiveEmptyMonths < MAX_CONSECUTIVE_EMPTY_MONTHS) {
    const title = (await page.locator('.yui3-calendar-header [aria-role="heading"]').textContent()).trim();
    log.info(`Loading events from ${title}`);
    let emptyMonth = false;
    try {
      await page.locator('.has-event').nth(0).waitFor({state: 'attached', timeout: 5000});
    } catch (e) {
      emptyMonth = true;
    }
    if (!emptyMonth) {
      const daysThatHaveEvents = await page.locator('.has-event[role="gridcell"]').all();
      emptyMonth = true;
      for (const day of daysThatHaveEvents) {
        const eventLinks = await day.locator('li:not([class*="item--ongoing"]) > .item-link').all();
        for (const eventLink of eventLinks) {
          emptyMonth = false;
          const eventURI = await eventLink.getAttribute('href');
          log.info(`Found event ${eventURI}`);
          yield `${PS154_ROOT}${eventURI}`;
        }
      }
    }
    if (emptyMonth) {
      log.info('(empty month)');
      consecutiveEmptyMonths++;
    } else {
      consecutiveEmptyMonths = 0;
    }

    if (MAX_FETCHED_MONTHS > 0 && fetchedMonths > MAX_FETCHED_MONTHS) {
      break;
    }
    await previousMonthButton.click();
    fetchedMonths++;
  }
}

async function getEventFromSquarespaceEventPage(page, uri) {
  log.info(`Loading event from ${uri}`);

  let retry = 5;
  while (retry > 0) {
    await page.goto(uri);
    try {
      await page.locator('.eventitem-title').waitFor({state: 'attached', timeout: 5000});
      break;
    } catch {
      retry--;
      log.info(`Retrying ${uri}`);
    }
  }
  if (retry <= 0) {
    throw new Error(`Failed to properly load ${uri}`);
  }

  // Event title
  const title = (await page.locator('.eventitem-title').textContent()).trim();

  // Event page URI
  const href = `${PS154_ROOT}${page.url()}`;

  // Event start/end date/time
  let startDateTimeLocator = await page.locator('.event-time-24hr > .event-time-24hr-start');
  let endDateTimeLocator = await page.locator('.event-time-24hr > .event-time-24hr-end');
  if (await endDateTimeLocator.count() === 0) {
    // 12hr is a bug in squarespace :(
    endDateTimeLocator = await page.locator('.event-time-24hr > .event-time-12hr-end');
  }
  const startDateTimeLocatorCount = await startDateTimeLocator.count();
  const endDateTimeLocatorCount = await endDateTimeLocator.count();
  console.log(startDateTimeLocatorCount, endDateTimeLocatorCount);
  if (startDateTimeLocatorCount === 0 && endDateTimeLocatorCount === 0) {
    // If no start/end dates visible, then assume this is the multi-day format:
    /*
     * <li class="eventitem-meta-date">
     *   <span class="eventitem-meta-time">
     *     <time class="event-time-24hr" datetime="2024-05-23">14:00</time>
     *   </span>
     *   <span class="eventitem-meta-time">
     *     <time class="event-time-24hr" datetime="2024-05-24">14:00</time>
     *   </span>
     * </li>
     */
    startDateTimeLocator = await page.locator('.event-time-24hr').nth(0);
    endDateTimeLocator = await page.locator('.event-time-24hr').nth(1);
  }
  const startDate = await startDateTimeLocator.getAttribute('datetime');
  const startTime = (await startDateTimeLocator.textContent()).trim();
  const endDate = await endDateTimeLocator.getAttribute('datetime');
  const endTime = (await endDateTimeLocator.textContent()).trim();

  // Event address
  let address;
  const addressLocator = await page.locator('.eventitem-meta-address');
  if (await addressLocator.count() > 0) {
    address = (await addressLocator.textContent()).trim();
  }

  // Event description
  let description;
  const descriptionLocator = await page.locator('.eventitem-column-content');
  if (await descriptionLocator.count() > 0) {
    description = await descriptionLocator.innerHTML();
  }

  // Event category
  let category;
  const categoryLocator = await page.locator('.eventitem-meta-cats');
  if (await categoryLocator.count() > 0) {
    category = (await categoryLocator.textContent()).trim();
  }

  // Event zoom links
  const allLinks = await page.locator('.eventitem-column-content a').all();
  const zoomLinks = [];
  for (const link of allLinks) {
    const href = await link.getAttribute('href');
    if (utils.any(VALID_ZOOM_ROOTS, (uri) => href.includes(uri))) {
      zoomLinks.push(href);
    }
  }

  // Event tags
  const tagsLocator = await page.locator('.eventitem-meta-tags');
  let tags;
  if (await tagsLocator.count() > 0) {
    const tagString = (await tagsLocator.textContent()).trim();
    tags = tagString.split('Tagged ')[1];
  }

  const squarespaceEvent = {
    title,
    href,
    startDate,
    startTime,
    endDate,
    endTime,
    address,
    description,
    category,
    tags,
    zoomLinks,
  };

  log.debugJSON(squarespaceEvent);

  if (!title || !href || !startDate || !startTime || !endDate || !endTime) {
    throw new Error('Invalid event');
  }

  return squarespaceEvent;
}

async function getAllEventsFromSquarespace() {
  const browser = await chromium.launch();
  try{
    const page = await browser.newPage();
    log.info('Fetching Squarespace events...');
    const eventURIs = await utils.toArray(getAllEventURIsFromSquarespaceCalendar(page));
    eventURIs.sort();
    log.debugJSON(eventURIs);
    const events = [];
    for (const eventURI of eventURIs) {
      const event = await getEventFromSquarespaceEventPage(page, eventURI);
      events.push(event);
    }
    return events;
  } finally {
    await browser.close();
  }
}

module.exports = {
  getAllEvents: getAllEventsFromSquarespace,
};
