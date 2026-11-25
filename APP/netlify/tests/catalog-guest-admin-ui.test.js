import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const createElement = () => ({
  children: [],
  dataset: {},
  listeners: {},
  attributes: {},
  value: '',
  textContent: '',
  classList: { toggle() {} },
  append(...children) { this.children.push(...children); },
  replaceChildren(...children) { this.children = children; },
  addEventListener(type, listener) { this.listeners[type] = listener; },
  setAttribute(name, value) { this.attributes[name] = value; },
  removeAttribute(name) { delete this.attributes[name]; }
});

test('created date displays and sorts invitation timestamps with missing dates last', async () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, createElement());
    return elements.get(selector);
  };
  const sortButton = (key) => {
    const button = createElement();
    button.dataset.guestSort = key;
    button.parentElement = createElement();
    const indicator = createElement();
    button.querySelector = () => indicator;
    return button;
  };
  const created = sortButton('createdAt');
  const email = sortButton('customerEmail');
  const entries = [
    { id: 'legacy', customerEmail: 'legacy@example.com', sharedBy: 'sales@example.com', status: 'active', createdAt: null, expiresAt: null },
    { id: 'new', customerEmail: 'new@example.com', sharedBy: 'sales@example.com', status: 'active', createdAt: 1700000000000, expiresAt: 1700000000000 },
    { id: 'old', customerEmail: 'old@example.com', sharedBy: 'sales@example.com', status: 'pending', createdAt: 1600000000000, expiresAt: 1800000000000 }
  ];
  const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
    .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
  const context = {
    document: {
      querySelector: element,
      querySelectorAll: () => [created, email],
      createElement
    },
    fetch: async () => ({ ok: true, json: async () => ({ entries }) })
  };
  runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
  await context.initialize();
  const rows = () => element('#guestAccessList').children;
  const emails = () => rows().map(row => row.children[0].textContent);
  assert.deepEqual(emails(), ['new@example.com', 'old@example.com', 'legacy@example.com']);
  assert.equal(created.parentElement.attributes['aria-sort'], 'descending');
  assert.equal(rows()[0].children[3].dataset.label, 'Created');
  assert.equal(rows()[0].children[3].textContent, rows()[0].children[4].textContent);
  assert.equal(rows()[2].children[3].textContent, '—');

  created.listeners.click();
  assert.deepEqual(emails(), ['old@example.com', 'new@example.com', 'legacy@example.com']);
  assert.equal(created.parentElement.attributes['aria-sort'], 'ascending');
  created.listeners.click();
  assert.deepEqual(emails(), ['new@example.com', 'old@example.com', 'legacy@example.com']);
  element('#guestAccessStatusFilter').value = 'active';
  element('#guestAccessStatusFilter').listeners.change();
  element('#guestAccessSearch').value = 'example.com';
  element('#guestAccessSearch').listeners.input();
  assert.deepEqual(emails(), ['new@example.com', 'legacy@example.com']);
  email.listeners.click();
  created.listeners.click();
  assert.deepEqual(emails(), ['new@example.com', 'legacy@example.com']);
});
