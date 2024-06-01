const { chromium } = require('playwright');

async function toArray(asyncIterator) {
  const arr = [];
  for await (const i of asyncIterator) {
    arr.push(i);
  }
  return arr;
}

async function * getUpcomingEventsFromSquarespaceEventsList(page) {
  await page.goto('https://www.ps154.org/events');

  const allUpcomingEvents = await page.locator('.eventlist-event.eventlist-event--upcoming').all()

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
      description = (await descriptionLocator.innerHTML()).trim();
    }

    let category;
    const categoryLocator = await event.locator('.eventlist-cats');
    if (await categoryLocator.isVisible()) {
      category = (await categoryLocator.textContent()).trim();
    }

    yield {
      title,
      href: `https://www.ps154.org${href}`,
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

async function * addZoomLinksToEvents(page, events) {
  for (const event of events) {
    await page.goto(event.href);
    const allLinks = await page.locator('.eventitem-column-content a').all();
    const zoomLinks = [];
    for (const link of allLinks) {
      const href = await link.getAttribute('href');
      if (href.includes('https://zoom.us') || href.includes('https://nycdoe.zoom.us')) {
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
    console.error('fetching upcoming events...');
    const events = await toArray(getUpcomingEventsFromSquarespaceEventsList(page));
    console.error('fetching event tags...');
    const eventsWithTags = await toArray(addTagsToEvents(page, events));
    console.error('fetching event zoom links...');
    const eventsWithZoomLinks = await toArray(addZoomLinksToEvents(page, events));
    return eventsWithZoomLinks;
  } finally {
    await browser.close();
  }
}

async function main() {
  const events = await getEventsFromSquarespace();
  console.log(JSON.stringify(events));
}

main();
