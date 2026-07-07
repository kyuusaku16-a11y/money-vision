import { copyFile, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, 'dist');
const siteUrl = 'https://kyuusaku16-a11y.github.io/money-vision/';

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  await Promise.all([
    copyFile(join(root, 'index.html'), join(dist, 'index.html')),
    copyFile(join(root, 'styles.css'), join(dist, 'styles.css')),
    copyFile(join(root, 'og-card.jpg'), join(dist, 'og-card.jpg')),
    cp(join(root, 'src'), join(dist, 'src'), { recursive: true }),
    cp(join(root, 'assets'), join(dist, 'assets'), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(join(dist, '.nojekyll'), ''),
    writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`),
    writeFile(join(dist, 'sitemap.xml'), [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      '  <url>',
      `    <loc>${siteUrl}</loc>`,
      '  </url>',
      '</urlset>',
      '',
    ].join('\n')),
  ]);

  console.log(`Built ${dist}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
