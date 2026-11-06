#!/usr/bin/env node
/*
 * Локальная сборка сайта без админки (нужен только Node.js 18+):
 *
 *   node tools/build.js
 *
 * Читает content/site.json и пересобирает index.html, 404.html, robots.txt,
 * sitemap.xml, llms.txt, llms-full.txt, site.webmanifest, CNAME и ключ IndexNow.
 * Админка делает ровно то же самое в браузере при нажатии «Опубликовать».
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SiteRender = require(path.join(ROOT, 'core', 'render.js'));
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8'));

const { files, warnings, url } = SiteRender.renderAll(data, {});
for (const [name, body] of Object.entries(files)) {
  fs.writeFileSync(path.join(ROOT, name), body, 'utf8');
  console.log('  записан', name.padEnd(42), (Buffer.byteLength(body) / 1024).toFixed(1), 'КБ');
}
console.log('\nАдрес сайта:', url);
if (warnings.length) {
  console.log('\nПроверки:');
  for (const w of warnings) console.log(' ', w.level === 'error' ? '✖' : w.level === 'warn' ? '!' : '·', w.msg);
}
