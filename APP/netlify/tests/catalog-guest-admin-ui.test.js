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
  showModal() { this.open = true; },
  close() { this.open = false; },
  setAttribute(name, value) { this.attributes[name] = value; },
  removeAttribute(name) { delete this.attributes[name]; }
});

test('delete confirmation shows the unfiltered eligible count and prevents double submission', async () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, createElement());
    return elements.get(selector);
  };
  let entries = [
    { id: 'expired', customerEmail: 'one@example.com', status: 'expired', canDelete: true, canBulkDelete: true, recordType: 'invitation' },
    { id: 'revoked', customerEmail: 'two@example.com', status: 'revoked', canDelete: true, canBulkDelete: false, recordType: 'grant' }
  ];
  let resolveDelete;
  let posts = 0;
  const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
    .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
  const context = {
    document: { querySelector: element, querySelectorAll: () => [], createElement },
    fetch: async (_url, options) => {
      if (options.method === 'GET') return { ok: true, json: async () => ({ entries, asOf: 1700000000000 }) };
      posts++;
      await new Promise(resolve => { resolveDelete = resolve; });
      entries = entries.filter(entry => entry.id !== 'expired');
      return { ok: true, json: async () => ({ deleted: 1 }) };
    }
  };
  runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
  await context.initialize();
  element('#guestAccessSearch').value = 'two@example.com';
  element('#guestAccessSearch').listeners.input();
  element('#deleteExpiredGuests').listeners.click();
  assert.equal(element('#deleteGuestDialog').open, true);
  assert.equal(element('#deleteGuestTitle').textContent, 'Delete Records?');
  assert.match(element('#deleteGuestCount').textContent, /1 eligible record/);
  assert.match(element('#deleteGuestCount').textContent, /regardless of filters/);
  const first = element('#confirmDeleteGuests').listeners.click();
  await element('#confirmDeleteGuests').listeners.click();
  assert.equal(posts, 1);
  assert.equal(element('#confirmDeleteGuests').disabled, true);
  resolveDelete();
  await first;
  assert.equal(element('#deleteGuestDialog').open, false);
  assert.equal(element('#guestAccessStatus').textContent, '1 record(s) deleted.');
  await element('#reloadGuestAccess').listeners.click({ type: 'click' });
  assert.equal(element('#guestAccessStatus').textContent, '');
  assert.equal(element('#guestAccessList').children.length, 1);
  const actions = element('#guestAccessList').children[0].children[6].children[0].children;
  assert.equal(actions[0].textContent, 'Delete Record');
  actions[0].listeners.click();
  assert.equal(element('#deleteGuestDialog').open, true);
  assert.equal(element('#deleteGuestTitle').textContent, 'Delete Invitation?');
  assert.match(element('#deleteGuestMessage').textContent, /immediately revokes access/);
  assert.match(element('#deleteGuestMessage').textContent, /downloaded PDFs.*Issuu URLs cannot be recalled/);
  element('#cancelDeleteGuests').listeners.click();
  assert.equal(element('#deleteGuestDialog').open, false);
  assert.equal(posts, 1);
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
