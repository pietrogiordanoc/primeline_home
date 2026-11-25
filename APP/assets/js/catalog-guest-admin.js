const guestAccessList = document.querySelector('#guestAccessList');
const guestAccessStatus = document.querySelector('#guestAccessStatus');
const emptyGuestAccess = document.querySelector('#emptyGuestAccess');
const reloadGuestAccess = document.querySelector('#reloadGuestAccess');
const guestAccessSearch = document.querySelector('#guestAccessSearch');
const guestAccessStatusFilter = document.querySelector('#guestAccessStatusFilter');
const guestAccessSharedByFilter = document.querySelector('#guestAccessSharedByFilter');
const clearGuestAccessFilters = document.querySelector('#clearGuestAccessFilters');
const guestAccessCount = document.querySelector('#guestAccessCount');
const guestSortButtons = document.querySelectorAll('[data-guest-sort]');
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const durationOrder = new Map([['24 Hours', 1], ['7 Days', 2], ['1 Month', 3], ['3 Months', 4], ['Permanent', 5]]);
let guestEntries = [];
let sortKey = 'createdAt';
let sortDirection = 'descending';
let initialized = false;

const setGuestAccessStatus = (message, isError = false) => {
  guestAccessStatus.textContent = message;
  guestAccessStatus.classList.toggle('is-error', isError);
};

const formatExpiration = (value) => {
  if (value === null) return 'No expiration';
  if (!Number.isFinite(value)) return '—';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
};

const actionButton = (label, action) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'admin-text-button';
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
};

const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';

const refreshSharedByOptions = () => {
  const selected = guestAccessSharedByFilter.value;
  const salespeople = new Map();
  guestEntries.forEach((entry) => {
    const key = normalizeEmail(entry.sharedBy);
    if (key && !salespeople.has(key)) salespeople.set(key, entry.sharedBy.trim());
  });
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All salespeople';
  guestAccessSharedByFilter.replaceChildren(allOption);
  [...salespeople].sort((a, b) => collator.compare(a[1], b[1])).forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    guestAccessSharedByFilter.append(option);
  });
  guestAccessSharedByFilter.value = salespeople.has(selected) ? selected : '';
};

const compareEntries = (a, b) => {
  const value = (entry) => {
    if (sortKey === 'createdAt') return Number.isFinite(entry.createdAt) ? entry.createdAt : undefined;
    if (sortKey === 'duration') return durationOrder.get(entry.duration);
    if (sortKey === 'expiresAt') {
      if (entry.expiresAt === null) return Infinity;
      return Number.isFinite(entry.expiresAt) ? entry.expiresAt : undefined;
    }
    return typeof entry[sortKey] === 'string' && entry[sortKey].trim() ? entry[sortKey] : undefined;
  };
  const left = value(a);
  const right = value(b);
  if (left === undefined && right !== undefined) return 1;
  if (right === undefined && left !== undefined) return -1;
  let comparison = 0;
  if (left !== undefined && right !== undefined) {
    comparison = typeof left === 'number'
      ? (left < right ? -1 : left > right ? 1 : 0)
      : collator.compare(left, right);
  }
  return comparison * (sortDirection === 'ascending' ? 1 : -1) ||
    collator.compare(String(a.id), String(b.id));
};

const renderGuestEntries = () => {
  const search = guestAccessSearch.value.trim().toLowerCase();
  const status = guestAccessStatusFilter.value;
  const sharedBy = guestAccessSharedByFilter.value;
  const entries = guestEntries.filter((entry) =>
    (!search || normalizeEmail(entry.customerEmail).includes(search) || normalizeEmail(entry.sharedBy).includes(search)) &&
    (!status || entry.status === status) &&
    (!sharedBy || normalizeEmail(entry.sharedBy) === sharedBy)
  ).sort(compareEntries);
  guestAccessCount.textContent = `${entries.length} matching record(s).`;
  guestSortButtons.forEach((button) => {
    const active = button.dataset.guestSort === sortKey;
    if (active) button.parentElement.setAttribute('aria-sort', sortDirection);
    else button.parentElement.removeAttribute('aria-sort');
    button.querySelector('span').textContent = active ? (sortDirection === 'ascending' ? '▲' : '▼') : '';
  });
  guestAccessList.replaceChildren();
  emptyGuestAccess.hidden = entries.length > 0;
  emptyGuestAccess.textContent = guestEntries.length ? 'No matching catalog access records.' : 'No catalog guest access records yet.';
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    const values = [
      ['Customer Email', entry.customerEmail],
      ['Shared By', entry.sharedBy],
      ['Access Duration', entry.duration],
      ['Created', Number.isFinite(entry.createdAt) ? formatExpiration(entry.createdAt) : '—'],
      ['Expiration', formatExpiration(entry.expiresAt)],
      ['Status', entry.status ? `${entry.status[0].toUpperCase()}${entry.status.slice(1)}` : '—']
    ];
    values.forEach(([label, value]) => {
      const cell = document.createElement('td');
      cell.dataset.label = label;
      cell.textContent = value || '—';
      row.append(cell);
    });

    const actions = document.createElement('td');
    actions.dataset.label = 'Actions';
    const actionGroup = document.createElement('div');
    actionGroup.className = 'admin-rule-actions';
    if (entry.canRevoke) {
      actionGroup.append(actionButton('Revoke access', async () => {
        if (!window.confirm(`Revoke catalog access for ${entry.customerEmail}?`)) return;
        await updateEntry({ action: 'revoke', grantId: entry.id }, 'Access revoked.');
      }));
    }
    if (entry.canReissue) {
      actionGroup.append(actionButton('Reissue invitation', async () => {
        if (!window.confirm(`Send a new private invitation to ${entry.customerEmail}?`)) return;
        await updateEntry({ action: 'reissue', invitationId: entry.invitationId }, 'A new invitation was sent.');
      }));
    }
    actions.append(actionGroup);
    row.append(actions);
    guestAccessList.append(row);
  });
};

const loadGuestEntries = async () => {
  reloadGuestAccess.disabled = true;
  setGuestAccessStatus('Loading catalog guest access...');
  try {
    const response = await fetch('/api/admin/catalog-guests', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok || !Array.isArray(result.entries)) {
      throw new Error(result.error || 'Catalog guest access could not be loaded.');
    }
    guestEntries = result.entries;
    refreshSharedByOptions();
    renderGuestEntries();
    setGuestAccessStatus('');
  } catch (error) {
    setGuestAccessStatus(error.message || 'Catalog guest access could not be loaded.', true);
  } finally {
    reloadGuestAccess.disabled = false;
  }
};

const updateEntry = async (payload, successMessage) => {
  setGuestAccessStatus('Updating catalog access...');
  try {
    const response = await fetch('/api/admin/catalog-guests', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Catalog access could not be updated.');
    setGuestAccessStatus(successMessage);
    await loadGuestEntries();
  } catch (error) {
    setGuestAccessStatus(error.message || 'Catalog access could not be updated.', true);
  }
};

export const initializeCatalogGuestAdmin = async () => {
  if (!initialized) {
    reloadGuestAccess.addEventListener('click', loadGuestEntries);
    guestAccessSearch.addEventListener('input', renderGuestEntries);
    guestAccessStatusFilter.addEventListener('change', renderGuestEntries);
    guestAccessSharedByFilter.addEventListener('change', renderGuestEntries);
    clearGuestAccessFilters.addEventListener('click', () => {
      guestAccessSearch.value = '';
      guestAccessStatusFilter.value = '';
      guestAccessSharedByFilter.value = '';
      renderGuestEntries();
    });
    guestSortButtons.forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.guestSort;
      sortDirection = sortKey === key && sortDirection === 'ascending' ? 'descending' : 'ascending';
      sortKey = key;
      renderGuestEntries();
    }));
    initialized = true;
  }
  await loadGuestEntries();
};
