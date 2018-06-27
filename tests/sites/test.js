import { sites } from './index.json';

sites.forEach(site => {
  fixture `${site.name}`
    .meta('slug', site.slug)
    .page `${site.url}`;

  test(`Loads ${site.url}`, async t => {
    await t;
  });
});
