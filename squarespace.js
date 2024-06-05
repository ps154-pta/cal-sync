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

async function * getUpcomingEventsFromSquarespaceEventsList(page) {
  await page.goto(PS154_EVENTS_URI);

  const allUpcomingEvents = await page.locator('.eventlist-event.eventlist-event--upcoming').all();

  for (const event of allUpcomingEvents) {
    const title = (await event.locator('.eventlist-title').textContent()).trim();
    const href = await event.locator('.eventlist-title-link').getAttribute('href');

    const startDateTimeLocator = await event.locator('.event-time-24hr > .event-time-24hr-start');
    const startDate = await startDateTimeLocator.getAttribute('datetime');
    const startTime = (await startDateTimeLocator.textContent()).trim();

    let endDateTimeLocator = await event.locator('.event-time-24hr > .event-time-24hr-end');
    if (!await endDateTimeLocator.isVisible()) {
      // 12hr is a bug in squarespace :(
      endDateTimeLocator = await event.locator('.event-time-24hr > .event-time-12hr-end');
    }
    const endDate = await endDateTimeLocator.getAttribute('datetime');
    const endTime = (await endDateTimeLocator.textContent()).trim();

    let address;
    const addressLocator = await event.locator('.eventlist-meta-address');
    if (await addressLocator.isVisible()) {
      address = (await addressLocator.textContent()).trim();
    }

    let description;
    const descriptionLocator = await event.locator('.eventlist-description');
    if (await descriptionLocator.isVisible()) {
      description = await descriptionLocator.innerHTML();
    }

    let category;
    const categoryLocator = await event.locator('.eventlist-cats');
    if (await categoryLocator.isVisible()) {
      category = (await categoryLocator.textContent()).trim();
    }

    yield {
      title,
      href: `${PS154_ROOT}${href}`,
      category,
      startDate,
      startTime,
      endDate,
      endTime,
      address,
      description,
    };
  }
}

async function * getAllEventsFromSquarespaceCalendar(page) {
  const previousMonthButton = await page.locator('a[aria-label="Go to previous month"]');
  const title = page.getByRole('heading');
  const daysThatHaveEvents = page.locator('.has-event[role="gridcell]"').all();
  for (const day of daysThatHaveEvents) {
    const dayNumber = page.locator('.marker-daynum').textContent();
    const eventLink = page.locator('.item-link');
    eventLink.click();
    // TODO Scrape event page
  }
}

async function getEventFromSquarespaceEventPage(uri) {

}

async function * addZoomLinksToEvents(page, events) {
  for (const event of events) {
    await page.goto(event.href);
    const allLinks = await page.locator('.eventitem-column-content a').all();
    const zoomLinks = [];
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (utils.any(VALID_ZOOM_ROOTS, (uri) => href.includes(uri))) {
        zoomLinks.push(href);
      }
    }
    yield {
      ...event,
      zoomLinks,
    };
  }
}

async function * addTagsToEvents(page, events) {
  for (const event of events) {
    await page.goto(event.href);
    const tagsLocator = await page.locator('.eventitem-meta-tags');
    let tags;
    if (await tagsLocator.isVisible()) {
      const tagString = (await tagsLocator.textContent()).trim();
      tags = tagString.split('Tagged ')[1];
    }
    yield {
      ...event,
      tags,
    };
  }
}

async function getEventsFromSquarespace() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    log.info('Fetching Squarespace upcoming events...');
    const events = await utils.toArray(getUpcomingEventsFromSquarespaceEventsList(page));
    log.debugJSON(events);
    log.info('Fetching Squarespace event tags...');
    const eventsWithTags = await utils.toArray(addTagsToEvents(page, events));
    log.debugJSON(eventsWithTags);
    log.info('Fetching Squarespace event zoom links...');
    const eventsWithZoomLinks = await utils.toArray(addZoomLinksToEvents(page, events));
    log.debugJSON(eventsWithZoomLinks);
    return eventsWithZoomLinks;
  } finally {
    await browser.close();
  }
}

module.exports = {
  getEvents: getEventsFromSquarespace,
};
