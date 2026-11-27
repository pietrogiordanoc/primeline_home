import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';

const createElement = () => ({
  children: [],
  dataset: {},
  listeners: {},
  attributes: {},
  value: '',
  textContent: '',
  classList: {
    values: new Set(),
    toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); },
    contains(name) { return this.values.has(name); }
  },
  isConnected: true,
  append(...children) { this.children.push(...children); },
  replaceChildren(...children) { this.children = children; },
  addEventListener(type, listener) { this.listeners[type] = listener; },
  showModal() { this.open = true; },
  close() { this.open = false; },
  focus() { this.focused = true; },
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
  const actions = element('#guestAccessList').children[0].children[7].children[0].children;
  assert.equal(actions[0].textContent, 'Delete Record');
  actions[0].listeners.click();
  assert.equal(element('#deleteGuestDialog').open, true);
  assert.equal(element('#deleteGuestTitle').textContent, 'Delete Invitation?');
  assert.equal(element('#deleteGuestCustomer').textContent, 'Customer: two@example.com');
  assert.match(element('#deleteGuestMessage').textContent, /immediately revokes access/);
  assert.match(element('#deleteGuestMessage').textContent, /downloaded PDFs.*Issuu URLs cannot be recalled/);
  element('#cancelDeleteGuests').listeners.click();
  assert.equal(element('#deleteGuestDialog').open, false);
  assert.equal(posts, 1);
});

test('all guest actions use accessible confirmations, preserve payloads and prevent duplicate submissions', async () => {
  const cases = [
    { label: 'Invalidate guest sessions', title: 'Invalidate Guest Sessions?', confirm: 'Invalidate Only', action: 'reset-devices', destructive: false },
    { label: 'Revoke access', title: 'Revoke Access?', confirm: 'Confirm Revoke', action: 'revoke', destructive: true },
    { label: 'Reissue invitation', title: 'Reissue Invitation?', confirm: 'Confirm Reissue', action: 'reissue', destructive: false },
    { label: 'Delete Record', title: 'Delete Invitation?', confirm: 'Confirm Delete', action: 'delete', destructive: true }
  ];
  for (const scenario of cases) {
    const elements = new Map();
    const element = selector => {
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    };
    const entry = {
      id: 'grant-1', invitationId: 'invitation-1', recordType: 'grant', customerEmail: 'buyer@example.com',
      status: 'active', canRevoke: true, canReset: true, canReissue: true, canDelete: true
    };
    const requests = [];
    let resolvePost;
    const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
      .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
    const context = {
      document: { querySelector: element, querySelectorAll: () => [], createElement },
      crypto: { randomUUID },
      fetch: async (_url, options) => {
        if (options.method === 'GET') return { ok: true, json: async () => ({ entries: [entry], asOf: 10 }) };
        requests.push(JSON.parse(options.body));
        await new Promise(resolve => { resolvePost = resolve; });
        return { ok: true, json: async () => scenario.action === 'delete' ? { deleted: 1 }
          : scenario.action === 'reset-devices' ? { devicesReset: true, emailStatus: 'not_requested' } : {} };
      }
    };
    runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
    await context.initialize();
    const findAction = () => element('#guestAccessList').children[0].children[7].children[0].children
      .find(button => button.textContent === scenario.label);
    let trigger = findAction();
    trigger.listeners.click();
    assert.equal(element('#deleteGuestDialog').open, true, scenario.action);
    assert.equal(element('#deleteGuestTitle').textContent, scenario.title);
    assert.equal(element('#deleteGuestCustomer').textContent, 'Customer: buyer@example.com');
    assert.notEqual(element('#deleteGuestMessage').textContent, '');
    assert.equal(element('#confirmDeleteGuests').textContent, scenario.confirm);
    assert.equal(element('#confirmDeleteGuests').classList.contains('is-danger'), scenario.destructive);
    assert.equal(element('#cancelDeleteGuests').focused, true);
    element('#cancelDeleteGuests').listeners.click();
    assert.equal(element('#deleteGuestDialog').open, false);
    assert.equal(trigger.focused, true);
    assert.equal(requests.length, 0);

    trigger = findAction();
    trigger.listeners.click();
    let prevented = false;
    element('#deleteGuestDialog').listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(element('#deleteGuestDialog').open, false);
    assert.equal(trigger.focused, true);

    findAction().listeners.click();
    const first = element('#confirmDeleteGuests').listeners.click();
    await element('#confirmDeleteGuests').listeners.click();
    element('#deleteGuestDialog').listeners.cancel({ preventDefault() {} });
    assert.equal(element('#deleteGuestDialog').open, true);
    assert.equal(element('#confirmDeleteGuests').disabled, true);
    assert.equal(element('#cancelDeleteGuests').disabled, true);
    assert.equal(element('#deleteGuestDialog').attributes['aria-busy'], 'true');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].action, scenario.action);
    if (scenario.action === 'reset-devices') assert.equal(requests[0].confirmed, true);
    if (scenario.action === 'reissue') assert.equal(requests[0].invitationId, 'invitation-1');
    if (scenario.action === 'delete') {
      assert.equal(requests[0].recordType, 'grant');
      assert.equal(requests[0].id, 'grant-1');
    }
    resolvePost();
    await first;
    assert.equal(element('#deleteGuestDialog').open, false);
    assert.equal(element('#guestAccessStatus').focused, true);
    assert.notEqual(element('#guestAccessStatus').textContent, '');
    assert.equal(element('#confirmDeleteGuests').disabled, false);
    assert.equal(element('#deleteGuestDialog').attributes['aria-busy'], undefined);
  }
});

test('guest action failures are reported in the application and allow retry', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, createElement());
    return elements.get(selector);
  };
  const entry = { id: 'grant', customerEmail: 'buyer@example.com', status: 'active', canRevoke: true };
  const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
    .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
  const context = {
    document: { querySelector: element, querySelectorAll: () => [], createElement },
    fetch: async (_url, options) => options.method === 'GET'
      ? { ok: true, json: async () => ({ entries: [entry] }) }
      : { ok: false, json: async () => ({ error: 'Access denied.' }) }
  };
  runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
  await context.initialize();
  const actions = () => element('#guestAccessList').children[0].children[7].children[0].children;
  actions().find(button => button.textContent === 'Revoke access').listeners.click();
  await element('#confirmDeleteGuests').listeners.click();
  assert.equal(element('#deleteGuestDialog').open, false);
  assert.equal(element('#guestAccessStatus').textContent, 'Access denied.');
  assert.equal(element('#guestAccessStatus').classList.contains('is-error'), true);
  assert.equal(element('#guestAccessStatus').focused, true);
  actions().find(button => button.textContent === 'Revoke access').listeners.click();
  assert.equal(element('#deleteGuestDialog').open, true);
});

test('reset history is sortable and shows recorded statuses without inventing legacy data', async () => {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, createElement());
    return elements.get(selector);
  };
  const sort = createElement();
  sort.dataset.guestSort = 'resetCount';
  sort.parentElement = createElement();
  const indicator = createElement();
  sort.querySelector = () => indicator;
  const entries = [
    { id: 'legacy', customerEmail: 'legacy@example.com', resetCount: null, resetHistory: null },
    { id: 'one', customerEmail: 'one@example.com', resetCount: 1, resetHistory: [
      { timestamp: 1000, administrator: 'admin@primelinedist.com', previousDeviceCount: 2, emailStatus: 'unrecorded' }
    ] },
    { id: 'two', customerEmail: 'two@example.com', resetCount: 2, resetHistory: [
      { timestamp: 1000, administrator: 'admin@primelinedist.com', previousDeviceCount: 1, emailStatus: 'not_requested' },
      { timestamp: 2000, administrator: 'admin@primelinedist.com', previousDeviceCount: null, emailStatus: 'accepted' }
    ] }
  ];
  const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
    .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
  const context = {
    document: { querySelector: element, querySelectorAll: () => [sort], createElement },
    fetch: async () => ({ ok: true, json: async () => ({ entries }) })
  };
  runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
  await context.initialize();
  sort.listeners.click();
  const rows = () => element('#guestAccessList').children;
  assert.deepEqual(rows().map(row => row.children[0].textContent), ['one@example.com', 'two@example.com', 'legacy@example.com']);
  rows()[1].children[6].children[0].listeners.click();
  assert.equal(element('#resetHistoryDialog').open, true);
  const history = element('#resetHistoryList').children;
  assert.match(history[0].children[1].textContent, /Previous devices: Not recorded.*Accepted by Resend \(delivery not confirmed\)/);
  assert.match(history[1].children[1].textContent, /Previous devices: 1.*Email Not Requested/);
  element('#closeResetHistory').listeners.click();
  rows()[2].children[6].children[0].listeners.click();
  assert.equal(element('#resetHistoryList').children[0].textContent, 'No history available.');
  element('#resetHistoryDialog').listeners.keydown({ key: 'Escape', preventDefault() {} });
  assert.equal(element('#resetHistoryDialog').open, false);
});

test('reset and send reports provider outcomes without claiming delivery', async () => {
  for (const [status, message] of [
    ['accepted', /accepted by Resend; delivery is not confirmed/i],
    ['failed', /sessions invalidated, but the access email was not sent/i],
    ['unknown', /sessions invalidated.*pending or unknown/i]
  ]) {
    const elements = new Map();
    const element = selector => {
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    };
    const entry = { id: 'grant', customerEmail: 'buyer@example.com', status: 'active', canReset: true };
    const requests = [];
    const script = readFileSync(new URL('../../assets/js/catalog-guest-admin.js', import.meta.url), 'utf8')
      .replace('export const initializeCatalogGuestAdmin', 'const initializeCatalogGuestAdmin');
    const context = {
      document: { querySelector: element, querySelectorAll: () => [], createElement },
      crypto: { randomUUID },
      fetch: async (_url, options) => {
        if (options.method === 'GET') return { ok: true, json: async () => ({ entries: [entry] }) };
        requests.push(JSON.parse(options.body));
        return { ok: true, json: async () => ({ devicesReset: true, emailStatus: status }) };
      }
    };
    runInNewContext(`${script}\nglobalThis.initialize = initializeCatalogGuestAdmin;`, context);
    await context.initialize();
    element('#guestAccessList').children[0].children[7].children[0].children[0].listeners.click();
    assert.equal(element('#sendRecoveryAfterReset').hidden, false);
    await element('#sendRecoveryAfterReset').listeners.click();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].sendLink, true);
    assert.match(requests[0].operationId, /^[0-9a-f-]{36}$/);
    assert.match(element('#guestAccessStatus').textContent, message);
  }
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
