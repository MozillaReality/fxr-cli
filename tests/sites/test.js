import { Selector } from 'testcafe';

import { sites } from './index.json';

let sitesBySlug = {};
sites.forEach(site => {
  sitesBySlug[site.slug] = site;
});

const site = sitesBySlug.mozilla;

const PAGE_LOAD_TIMEOUT = 12000;

sites.forEach(site => {
  fixture `${site.name}`
    .meta('slug', site.slug)
    .page `${site.url}`;
  test(`Loads ${site.url}`, async t => {
    // await t.navigateTo(${site.url});
    await t;
  });
});
