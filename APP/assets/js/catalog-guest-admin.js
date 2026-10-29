const guestAccessList = document.querySelector('#guestAccessList');
const guestAccessStatus = document.querySelector('#guestAccessStatus');
const emptyGuestAccess = document.querySelector('#emptyGuestAccess');
const reloadGuestAccess = document.querySelector('#reloadGuestAccess');
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

const renderGuestEntries = (entries) => {
  guestAccessList.replaceChildren();
  emptyGuestAccess.hidden = entries.length > 0;
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    const values = [
      ['Customer Email', entry.customerEmail],
      ['Shared By', entry.sharedBy],
      ['Access Duration', entry.duration],
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
    renderGuestEntries(result.entries);
    setGuestAccessStatus(`${result.entries.length} invitation or grant record(s).`);
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
    initialized = true;
  }
  await loadGuestEntries();
};
