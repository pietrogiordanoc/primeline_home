const guestAccessList = document.querySelector('#guestAccessList');
const guestAccessStatus = document.querySelector('#guestAccessStatus');
const emptyGuestAccess = document.querySelector('#emptyGuestAccess');
const reloadGuestAccess = document.querySelector('#reloadGuestAccess');
const guestAccessSearch = document.querySelector('#guestAccessSearch');
const guestAccessStatusFilter = document.querySelector('#guestAccessStatusFilter');
const guestAccessSharedByFilter = document.querySelector('#guestAccessSharedByFilter');
const clearGuestAccessFilters = document.querySelector('#clearGuestAccessFilters');
const guestAccessCount = document.querySelector('#guestAccessCount');
const deleteExpiredGuests = document.querySelector('#deleteExpiredGuests');
const deleteGuestDialog = document.querySelector('#deleteGuestDialog');
const deleteGuestTitle = document.querySelector('#deleteGuestTitle');
const deleteGuestCustomer = document.querySelector('#deleteGuestCustomer');
const deleteGuestMessage = document.querySelector('#deleteGuestMessage');
const deleteGuestCount = document.querySelector('#deleteGuestCount');
const guestActionProgress = document.querySelector('#guestActionProgress');
const cancelDeleteGuests = document.querySelector('#cancelDeleteGuests');
const confirmDeleteGuests = document.querySelector('#confirmDeleteGuests');
const sendRecoveryAfterReset = document.querySelector('#sendRecoveryAfterReset');
const resetHistoryDialog = document.querySelector('#resetHistoryDialog');
const resetHistoryCustomer = document.querySelector('#resetHistoryCustomer');
const resetHistoryList = document.querySelector('#resetHistoryList');
const closeResetHistory = document.querySelector('#closeResetHistory');
const guestSortButtons = document.querySelectorAll('[data-guest-sort]');
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const durationOrder = new Map([['24 Hours', 1], ['7 Days', 2], ['1 Month', 3], ['3 Months', 4], ['Permanent', 5]]);
let guestEntries = [];
let guestEntriesAsOf = null;
let sortKey = 'createdAt';
let sortDirection = 'descending';
let initialized = false;
let pendingAction = null;
let actionTrigger = null;
let historyTrigger = null;
let submitting = false;

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
  button.addEventListener('click', () => action(button));
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
    if (sortKey === 'resetCount') return Number.isSafeInteger(entry.resetCount) ? entry.resetCount : undefined;
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
  deleteExpiredGuests.disabled = submitting || guestEntriesAsOf === null || !guestEntries.some(entry => entry.canBulkDelete);
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

    const resetCell = document.createElement('td');
    resetCell.dataset.label = 'Resets';
    const resetCount = Number.isSafeInteger(entry.resetCount) ? String(entry.resetCount) : '—';
    if (Object.hasOwn(entry, 'resetHistory')) {
      const historyButton = actionButton(resetCount, trigger => openResetHistory(entry, trigger));
      historyButton.setAttribute('aria-label', `View reset history for ${entry.customerEmail || 'invitation'}`);
      resetCell.append(historyButton);
    } else resetCell.textContent = resetCount;
    row.append(resetCell);

    const actions = document.createElement('td');
    actions.dataset.label = 'Actions';
    const actionGroup = document.createElement('div');
    actionGroup.className = 'admin-rule-actions';
    if (entry.canReset) {
      actionGroup.append(actionButton('Reset authorized devices', (trigger) => {
        openGuestDialog({
          payload: { action: 'reset-devices', grantId: entry.id, confirmed: true, operationId: crypto.randomUUID() },
          title: 'Reset Authorized Devices?',
          message: 'Existing guest sessions will stop working. The expiration date will not change. You may also email an access link for this invitation.',
          customerEmail: entry.customerEmail,
          confirmLabel: 'Reset Only',
          successMessage: 'Authorized devices reset.'
        }, trigger);
      }));
    }
    if (entry.canRevoke) {
      actionGroup.append(actionButton('Revoke access', (trigger) => {
        openGuestDialog({
          payload: { action: 'revoke', grantId: entry.id },
          title: 'Revoke Access?',
          message: 'This immediately revokes catalog access and invalidates existing guest sessions.',
          customerEmail: entry.customerEmail,
          confirmLabel: 'Confirm Revoke',
          successMessage: 'Access revoked.',
          destructive: true
        }, trigger);
      }));
    }
    if (entry.canReissue) {
      actionGroup.append(actionButton('Reissue invitation', (trigger) => {
        openGuestDialog({
          payload: { action: 'reissue', invitationId: entry.invitationId },
          title: 'Reissue Invitation?',
          message: 'This sends a new private invitation and invalidates the previous invitation link.',
          customerEmail: entry.customerEmail,
          confirmLabel: 'Confirm Reissue',
          successMessage: 'A new invitation was sent.'
        }, trigger);
      }));
    }
    if (entry.canDelete) {
      actionGroup.append(actionButton('Delete Record', (trigger) => {
        openGuestDialog({
          payload: { action: 'delete', recordType: entry.recordType, id: entry.id },
          title: 'Delete Invitation?',
          message: 'This permanently deletes the invitation and immediately revokes access through Prime Line Home. This action cannot be undone. Previously downloaded PDFs and publicly accessible Issuu URLs cannot be recalled.',
          customerEmail: entry.customerEmail,
          confirmLabel: 'Confirm Delete',
          destructive: true
        }, trigger);
      }));
    }
    actions.append(actionGroup);
    row.append(actions);
    guestAccessList.append(row);
  });
};

const openResetHistory = (entry, trigger) => {
  historyTrigger = trigger;
  resetHistoryCustomer.textContent = entry.customerEmail ? `Customer: ${entry.customerEmail}` : '';
  resetHistoryList.replaceChildren();
  if (!Array.isArray(entry.resetHistory) || entry.resetHistory.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = Array.isArray(entry.resetHistory) ? 'No resets recorded.' : 'No history available.';
    resetHistoryList.append(empty);
  } else {
    const statuses = {
      not_requested: 'Email Not Requested',
      accepted: 'Accepted by Resend (delivery not confirmed)',
      failed: 'Email Failed',
      pending: 'Email status pending or unknown',
      unknown: 'Email status unknown',
      unrecorded: 'Email status not recorded'
    };
    entry.resetHistory.map((event, index) => ({ event, index }))
      .sort((a, b) => (b.event.timestamp || 0) - (a.event.timestamp || 0) || b.index - a.index)
      .forEach(({ event }) => {
        const item = document.createElement('div');
        item.className = 'guest-reset-event';
        const date = document.createElement('strong');
        date.textContent = Number.isFinite(event.timestamp) ? new Date(event.timestamp).toLocaleString() : 'Date unavailable';
        const detail = document.createElement('div');
        const count = Number.isSafeInteger(event.previousDeviceCount) ? event.previousDeviceCount : 'Unknown';
        const emailTime = Number.isFinite(event.emailStatusAt) ? ` (${new Date(event.emailStatusAt).toLocaleString()})` : '';
        detail.textContent = `Administrator: ${event.administrator || 'Unknown'} · Previous devices: ${count} · ${statuses[event.emailStatus] || statuses.unrecorded}${emailTime}`;
        item.append(date, detail);
        resetHistoryList.append(item);
      });
  }
  resetHistoryDialog.showModal();
  closeResetHistory.focus();
};

const dismissResetHistory = () => {
  resetHistoryDialog.close();
  if (historyTrigger?.isConnected) historyTrigger.focus();
  else guestAccessStatus.focus();
  historyTrigger = null;
};

const loadGuestEntries = async (successMessage = '') => {
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
    guestEntriesAsOf = Number.isFinite(result.asOf) ? result.asOf : null;
    refreshSharedByOptions();
    renderGuestEntries();
    setGuestAccessStatus(successMessage);
  } catch (error) {
    setGuestAccessStatus(`${successMessage ? `${successMessage} ` : ''}${error.message || 'Catalog guest access could not be loaded.'}`, true);
  } finally {
    reloadGuestAccess.disabled = false;
  }
};

const openGuestDialog = (action, trigger) => {
  if (submitting || deleteGuestDialog.open) return;
  pendingAction = action;
  actionTrigger = trigger;
  deleteGuestTitle.textContent = action.title;
  deleteGuestCustomer.textContent = action.customerEmail ? `Customer: ${action.customerEmail}` : '';
  deleteGuestMessage.textContent = action.message;
  deleteGuestCount.textContent = action.count ? `${action.count} eligible record(s). All eligible records are included, regardless of filters.` : '';
  confirmDeleteGuests.textContent = action.confirmLabel;
  confirmDeleteGuests.classList.toggle('is-danger', Boolean(action.destructive));
  sendRecoveryAfterReset.hidden = action.payload.action !== 'reset-devices';
  deleteGuestDialog.showModal();
  cancelDeleteGuests.focus();
};

const cancelGuestDialog = () => {
  if (submitting) return;
  pendingAction = null;
  deleteGuestDialog.close();
  if (actionTrigger?.isConnected) actionTrigger.focus();
  else guestAccessStatus.focus();
  actionTrigger = null;
};

const confirmGuestAction = async (sendLink = false) => {
  if (submitting || !pendingAction) return;
  const action = pendingAction;
  if (action.payload.action === 'reset-devices') action.payload.sendLink = sendLink;
  const isDeletion = action.payload.action === 'delete' || action.payload.action === 'delete-expired';
  submitting = true;
  confirmDeleteGuests.disabled = true;
  sendRecoveryAfterReset.disabled = true;
  cancelDeleteGuests.disabled = true;
  deleteExpiredGuests.disabled = true;
  guestActionProgress.textContent = 'Processing...';
  deleteGuestDialog.setAttribute('aria-busy', 'true');
  deleteGuestDialog.focus();
  try {
    const response = await fetch('/api/admin/catalog-guests', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.payload)
    });
    const result = await response.json();
    if (!response.ok || (isDeletion && !Number.isInteger(result.deleted))) {
      const count = Number.isInteger(result.deleted) ? `${result.deleted} record(s) deleted. ` : '';
      throw new Error(`${count}${result.error || (isDeletion ? 'Records could not be deleted.' : 'Catalog access could not be updated.')}`);
    }
    deleteGuestDialog.close();
    pendingAction = null;
    let message = isDeletion ? `${result.deleted} record(s) deleted.` : action.successMessage;
    let emailError = false;
    if (action.payload.action === 'reset-devices') {
      if (result.devicesReset !== true) throw new Error('Reset status could not be confirmed. Refresh the history before retrying.');
      if (result.emailStatus === 'accepted') message = 'Authorized devices reset. Access email accepted by Resend; delivery is not confirmed.';
      else if (result.emailStatus === 'failed') {
        message = 'Authorized devices reset, but the access email was not sent.';
        emailError = true;
      } else if (result.emailStatus !== 'not_requested') {
        message = 'Authorized devices reset. Email acceptance is pending or unknown; check the reset history before retrying.';
        emailError = true;
      }
    }
    await loadGuestEntries(message);
    if (emailError) setGuestAccessStatus(message, true);
  } catch (error) {
    deleteGuestDialog.close();
    pendingAction = null;
    if (isDeletion) await loadGuestEntries();
    if (action.payload.action === 'reset-devices') {
      setGuestAccessStatus(`Reset outcome could not be confirmed. Refresh the history before retrying.${error.message ? ` ${error.message}` : ''}`, true);
    } else {
      setGuestAccessStatus(error.message || (isDeletion ? 'Records could not be deleted.' : 'Catalog access could not be updated.'), true);
    }
  } finally {
    submitting = false;
    actionTrigger = null;
    guestActionProgress.textContent = '';
    deleteGuestDialog.removeAttribute('aria-busy');
    confirmDeleteGuests.disabled = false;
    sendRecoveryAfterReset.disabled = false;
    cancelDeleteGuests.disabled = false;
    renderGuestEntries();
    guestAccessStatus.focus();
  }
};

export const initializeCatalogGuestAdmin = async () => {
  if (!initialized) {
    deleteExpiredGuests.addEventListener('click', () => {
      const records = guestEntries.filter(entry => entry.canBulkDelete)
        .map(({ recordType, id }) => ({ recordType, id }));
      if (records.length && guestEntriesAsOf !== null) {
        openGuestDialog({
          payload: { action: 'delete-expired', asOf: guestEntriesAsOf, records },
          title: 'Delete Records?',
          message: 'Are you sure you want to permanently delete these records? This action cannot be undone.',
          count: records.length,
          confirmLabel: 'Confirm Delete',
          destructive: true
        }, deleteExpiredGuests);
      }
    });
    cancelDeleteGuests.addEventListener('click', cancelGuestDialog);
    closeResetHistory.addEventListener('click', dismissResetHistory);
    resetHistoryDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      dismissResetHistory();
    });
    resetHistoryDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissResetHistory();
    });
    deleteGuestDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelGuestDialog();
    });
    deleteGuestDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      cancelGuestDialog();
    });
    confirmDeleteGuests.addEventListener('click', () => confirmGuestAction(false));
    sendRecoveryAfterReset.addEventListener('click', () => confirmGuestAction(true));
    reloadGuestAccess.addEventListener('click', () => loadGuestEntries());
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
