import './contact-form-data.js';

const contactData = globalThis.PRIME_LINE_CONTACT_DATA;
const authDialog = document.querySelector('#authDialog');
const dashboard = document.querySelector('#dashboard');
const emailForm = document.querySelector('#emailForm');
const codeForm = document.querySelector('#codeForm');
const emailInput = document.querySelector('#adminEmail');
const codeInput = document.querySelector('#adminCode');
const authStatus = document.querySelector('#authStatus');
const signOutButton = document.querySelector('#signOutButton');
const changeEmailButton = document.querySelector('#changeEmailButton');
const contactConfig = document.querySelector('#contactConfig');
const contactConfigStatus = document.querySelector('#contactConfigStatus');
const generalRecipientsList = document.querySelector('#generalRecipientsList');
const newRecipientEmail = document.querySelector('#newRecipientEmail');
const routingRulesList = document.querySelector('#routingRulesList');
const emptyRoutingRules = document.querySelector('#emptyRoutingRules');
const ruleForm = document.querySelector('#routingRuleForm');
const ruleCountry = document.querySelector('#ruleCountry');
const ruleStateSearch = document.querySelector('#ruleStateSearch');
const ruleStateOptions = document.querySelector('#ruleStateOptions');
const selectedStateChips = document.querySelector('#selectedStateChips');
const ruleStateText = document.querySelector('#ruleStateText');
const ruleRecipientsInput = document.querySelector('#ruleRecipients');
let routingConfig = null;
let editingRuleId = null;
let savedSnapshot = '';
let ruleEditorDirty = false;
let selectedStateCodes = new Set();

const newId = () => crypto.randomUUID();

const setContactStatus = (message, isError = false) => {
  contactConfigStatus.textContent = message;
  contactConfigStatus.classList.toggle('is-error', isError);
  contactConfigStatus.classList.remove('is-dirty');
};

const configSnapshot = () => JSON.stringify({
  generalRecipients: routingConfig?.generalRecipients,
  stateRules: routingConfig?.stateRules
});

const isConfigDirty = () => Boolean(routingConfig) &&
  (configSnapshot() !== savedSnapshot || ruleEditorDirty || Boolean(newRecipientEmail.value.trim()));

const updateDirtyStatus = () => {
  if (!isConfigDirty()) return;
  contactConfigStatus.textContent = 'Unsaved changes — save before leaving this page.';
  contactConfigStatus.classList.remove('is-error');
  contactConfigStatus.classList.add('is-dirty');
};

const renderRecipients = () => {
  generalRecipientsList.replaceChildren();
  routingConfig.generalRecipients.forEach((recipient) => {
    const row = document.createElement('div');
    row.className = 'admin-recipient-row';
    const email = document.createElement('span');
    email.className = 'admin-recipient-email';
    email.textContent = recipient.email;
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle-label';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = recipient.enabled;
    enabled.setAttribute('aria-label', `Enable ${recipient.email}`);
    enabled.addEventListener('change', () => {
      recipient.enabled = enabled.checked;
      updateDirtyStatus();
    });
    enabledLabel.append(enabled, document.createTextNode(' Enabled'));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-text-button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      routingConfig.generalRecipients = routingConfig.generalRecipients.filter((item) => item.id !== recipient.id);
      renderRecipients();
      updateDirtyStatus();
    });
    row.append(email, enabledLabel, remove);
    generalRecipientsList.append(row);
  });
};

const renderRules = () => {
  routingRulesList.replaceChildren();
  emptyRoutingRules.hidden = routingConfig.stateRules.length > 0;
  routingConfig.stateRules.forEach((rule) => {
    const row = document.createElement('tr');
    const countryName = contactData.countries.find((country) => country.code === rule.countryCode)?.name || rule.countryCode;
    const states = Array.isArray(rule.states) ? rule.states : [rule.state];
    const stateNames = rule.countryCode === 'US'
      ? states.map((code) => contactData.usStates.find((state) => state.code === code)?.name || code)
      : states;
    const stateCell = document.createElement('td');
    stateCell.dataset.label = 'States';
    stateCell.textContent = `${countryName}: ${stateNames.join(', ')}`;
    const recipientsCell = document.createElement('td');
    recipientsCell.dataset.label = 'Recipients';
    recipientsCell.textContent = rule.recipients.join(', ');
    const enabledCell = document.createElement('td');
    enabledCell.dataset.label = 'Enabled';
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle-label';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = rule.enabled;
    enabled.setAttribute('aria-label', `Enable routing for ${countryName}: ${stateNames.join(', ')}`);
    enabled.addEventListener('change', () => {
      rule.enabled = enabled.checked;
      updateDirtyStatus();
    });
    enabledLabel.append(enabled, document.createTextNode(' Enabled'));
    enabledCell.append(enabledLabel);
    const actionsCell = document.createElement('td');
    actionsCell.dataset.label = 'Actions';
    const actions = document.createElement('div');
    actions.className = 'admin-rule-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'admin-text-button';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editRule(rule));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-text-button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      routingConfig.stateRules = routingConfig.stateRules.filter((item) => item.id !== rule.id);
      renderRules();
      updateDirtyStatus();
    });
    actions.append(edit, remove);
    actionsCell.append(actions);
    row.append(stateCell, recipientsCell, enabledCell, actionsCell);
    routingRulesList.append(row);
  });
};

const renderRoutingConfig = () => {
  renderRecipients();
  renderRules();
};

const loadContactConfig = async () => {
  contactConfig.hidden = false;
  setContactStatus('Loading saved routing configuration...');
  try {
    const response = await fetch('/api/admin/contact-routing', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Configuration is unavailable.');
    routingConfig = result;
    renderRoutingConfig();
    savedSnapshot = configSnapshot();
    ruleEditorDirty = false;
    setContactStatus(result.updatedAt ? `Last saved: ${new Date(result.updatedAt).toLocaleString()}` : 'Using the initial default recipient. Save to confirm configuration.');
  } catch (error) {
    routingConfig = null;
    setContactStatus(error.message || 'Configuration could not be loaded.', true);
  }
};

const selectedUsStates = () =>
  contactData.usStates.filter((state) => selectedStateCodes.has(state.code)).map((state) => state.code);

const renderSelectedStateChips = () => {
  selectedStateChips.replaceChildren();
  contactData.usStates.filter((state) => selectedStateCodes.has(state.code)).forEach((state) => {
    const chip = document.createElement('span');
    chip.className = 'admin-state-chip';
    chip.textContent = state.code;
    selectedStateChips.append(chip);
  });
};

const renderStateOptions = () => {
  const query = ruleStateSearch.value.trim().toLocaleLowerCase('en-US');
  ruleStateOptions.replaceChildren();
  contactData.usStates
    .filter((state) => `${state.name} ${state.code}`.toLocaleLowerCase('en-US').includes(query))
    .forEach((state) => {
      const label = document.createElement('label');
      label.className = 'admin-state-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = state.code;
      checkbox.checked = selectedStateCodes.has(state.code);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedStateCodes.add(state.code);
        else selectedStateCodes.delete(state.code);
        renderSelectedStateChips();
        ruleEditorDirty = true;
        updateDirtyStatus();
      });
      label.append(checkbox, document.createTextNode(`${state.name} (${state.code})`));
      ruleStateOptions.append(label);
    });
  renderSelectedStateChips();
};

const updateRuleStateField = (clear = false) => {
  const isUnitedStates = ruleCountry.value === 'US';
  if (clear) {
    selectedStateCodes.clear();
    ruleStateSearch.value = '';
    ruleStateText.value = '';
  }
  document.querySelector('#ruleStatesField').hidden = !isUnitedStates;
  ruleStateSearch.disabled = !isUnitedStates;
  document.querySelector('#ruleStateTextLabel').hidden = isUnitedStates;
  ruleStateText.disabled = isUnitedStates;
  ruleStateText.required = !isUnitedStates;
  renderStateOptions();
};

const editRule = (rule) => {
  editingRuleId = rule.id;
  ruleCountry.value = rule.countryCode;
  updateRuleStateField(true);
  if (rule.countryCode === 'US') {
    selectedStateCodes = new Set(Array.isArray(rule.states) ? rule.states : [rule.state]);
    renderStateOptions();
    renderSelectedStateChips();
  } else {
    ruleStateText.value = (Array.isArray(rule.states) ? rule.states[0] : rule.state) || '';
  }
  ruleRecipientsInput.value = rule.recipients.join('\n');
  document.querySelector('#routingRuleFormTitle').textContent = 'Edit routing rule';
  document.querySelector('#saveRuleButton').textContent = 'Update rule';
  document.querySelector('#cancelRuleEdit').hidden = false;
  ruleForm.hidden = false;
  ruleEditorDirty = false;
  ruleForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

const showStatus = (message, isError = false) => {
  authStatus.textContent = message;
  authStatus.classList.toggle('is-error', isError);
};

const showSignedOut = () => {
  dashboard.hidden = true;
  if (!authDialog.open) authDialog.showModal();
  emailForm.hidden = false;
  codeForm.hidden = true;
  codeInput.value = '';
};

const loadSession = async () => {
  const response = await fetch('/api/admin/session', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('session-unavailable');
  const result = await response.json();
  if (result.authenticated !== true) return false;
  dashboard.hidden = false;
  if (authDialog.open) authDialog.close();
  loadContactConfig();
  return true;
};

authDialog.addEventListener('cancel', (event) => event.preventDefault());

contactData.countries.forEach((country) => ruleCountry.add(new Option(country.name, country.code)));
ruleCountry.value = 'US';
ruleCountry.selectedOptions[0].defaultSelected = true;
renderStateOptions();
ruleCountry.addEventListener('change', () => updateRuleStateField(true));
ruleStateSearch.addEventListener('input', renderStateOptions);
document.querySelector('#selectAllStates').addEventListener('click', () => {
  selectedStateCodes = new Set(contactData.usStates.map((state) => state.code));
  renderStateOptions();
  ruleEditorDirty = true;
  updateDirtyStatus();
});
document.querySelector('#clearStates').addEventListener('click', () => {
  selectedStateCodes.clear();
  renderStateOptions();
  ruleEditorDirty = true;
  updateDirtyStatus();
});
ruleForm.addEventListener('input', (event) => {
  if (event.target !== ruleStateSearch) {
    ruleEditorDirty = true;
    updateDirtyStatus();
  }
});
ruleCountry.addEventListener('change', () => {
  ruleEditorDirty = true;
  updateDirtyStatus();
});
updateRuleStateField();

document.querySelector('#addRecipientForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!routingConfig) return;
  const email = newRecipientEmail.value.trim();
  if (routingConfig.generalRecipients.some((recipient) => recipient.email.toLowerCase() === email.toLowerCase())) {
    setContactStatus('That recipient is already in the list.', true);
    return;
  }
  routingConfig.generalRecipients.push({ id: newId(), email, enabled: true });
  newRecipientEmail.value = '';
  renderRecipients();
  updateDirtyStatus();
  setContactStatus('Recipient added. Save changes to apply it.');
});

newRecipientEmail.addEventListener('input', updateDirtyStatus);

ruleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!routingConfig) return;
  const isUnitedStates = ruleCountry.value === 'US';
  const states = isUnitedStates ? selectedUsStates() : [ruleStateText.value.trim()];
  if (!ruleForm.reportValidity()) return;
  if (!states.filter(Boolean).length) {
    setContactStatus(isUnitedStates ? 'Select at least one state.' : 'Enter a state or province.', true);
    return;
  }
  const countryCode = ruleCountry.value;
  const recipients = ruleRecipientsInput.value.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean);
  const existing = routingConfig.stateRules.find((rule) => rule.id === editingRuleId);
  const rule = {
    id: editingRuleId || newId(),
    countryCode,
    states,
    recipients,
    enabled: existing ? existing.enabled : true
  };
  if (existing) {
    routingConfig.stateRules = routingConfig.stateRules.map((item) => item.id === editingRuleId ? rule : item);
  } else {
    routingConfig.stateRules.push(rule);
  }
  resetRuleEditor();
  renderRules();
  updateDirtyStatus();
  setContactStatus('Rule updated. Save changes to apply it.');
});

const resetRuleEditor = () => {
  ruleForm.reset();
  editingRuleId = null;
  ruleEditorDirty = false;
  ruleForm.hidden = true;
  document.querySelector('#addRoutingRule').hidden = false;
  updateRuleStateField();
  document.querySelector('#routingRuleFormTitle').textContent = 'Add a routing rule';
  document.querySelector('#saveRuleButton').textContent = 'Add rule';
  document.querySelector('#cancelRuleEdit').hidden = true;
  updateDirtyStatus();
};

document.querySelector('#addRoutingRule').addEventListener('click', () => {
  ruleForm.hidden = false;
  document.querySelector('#addRoutingRule').hidden = true;
  ruleCountry.value = 'US';
  updateRuleStateField(true);
  ruleForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

document.querySelector('#cancelRuleEdit').addEventListener('click', resetRuleEditor);

document.querySelector('#reloadContactConfig').addEventListener('click', () => {
  if (isConfigDirty() && !window.confirm('Discard unsaved changes and reload the saved configuration?')) return;
  resetRuleEditor();
  loadContactConfig();
});

window.addEventListener('beforeunload', (event) => {
  if (!isConfigDirty()) return;
  event.preventDefault();
  event.returnValue = '';
});

document.querySelector('#saveContactConfig').addEventListener('click', async (event) => {
  if (!routingConfig || event.currentTarget.disabled) return;
  if (ruleEditorDirty || newRecipientEmail.value.trim()) {
    setContactStatus('Finish or cancel the current edit before saving configuration.', true);
    return;
  }
  if (!routingConfig.generalRecipients.some((recipient) => recipient.enabled)) {
    setContactStatus('At least one general recipient must remain enabled.', true);
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  setContactStatus('Saving configuration...');
  try {
    const response = await fetch('/api/admin/contact-routing', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generalRecipients: routingConfig.generalRecipients,
        stateRules: routingConfig.stateRules
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Configuration could not be saved.');
    routingConfig = result;
    savedSnapshot = configSnapshot();
    renderRoutingConfig();
    setContactStatus(`Saved: ${new Date(result.updatedAt).toLocaleString()}`);
  } catch (error) {
    setContactStatus(error.message || 'Configuration could not be saved.', true);
  } finally {
    button.disabled = false;
  }
});

emailForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!emailForm.reportValidity()) return;

  const button = emailForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showStatus('Checking access and sending a code if authorized...');
  try {
    const response = await fetch('/api/admin/request-code', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailInput.value.trim() })
    });
    if (!response.ok) throw new Error('request-failed');
    emailForm.hidden = true;
    codeForm.hidden = false;
    showStatus('If this address is authorized, a code has been sent. Enter it below.');
    codeInput.focus();
  } catch {
    showStatus('We could not process the request. Please try again.', true);
  } finally {
    button.disabled = false;
  }
});

codeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!codeForm.reportValidity()) return;

  const button = codeForm.querySelector('button[type="submit"]');
  button.disabled = true;
  showStatus('Verifying your code...');
  try {
    const response = await fetch('/api/admin/verify-code', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeInput.value.trim() })
    });
    if (!response.ok) throw new Error('verification-failed');
    codeInput.value = '';
    if (!(await loadSession())) throw new Error('session-not-created');
    showStatus('');
  } catch {
    showStatus('The code is invalid or expired, or sign-in is temporarily unavailable.', true);
    codeInput.select();
  } finally {
    button.disabled = false;
  }
});

codeInput.addEventListener('input', () => {
  codeInput.value = codeInput.value.replace(/\D/g, '').slice(0, 6);
});

changeEmailButton.addEventListener('click', () => {
  emailForm.hidden = false;
  codeForm.hidden = true;
  codeInput.value = '';
  showStatus('');
  emailInput.focus();
});

signOutButton.addEventListener('click', async () => {
  if (isConfigDirty() && !window.confirm('You have unsaved changes. Sign out and discard them?')) return;
  signOutButton.disabled = true;
  try {
    const response = await fetch('/api/admin/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    if (!response.ok) throw new Error('logout-failed');
    showSignedOut();
    showStatus('You have signed out.');
  } catch {
    showStatus('Sign out could not be completed. Please try again.', true);
  } finally {
    signOutButton.disabled = false;
  }
});

loadSession().then((authenticated) => {
  if (!authenticated) showSignedOut();
}).catch(() => {
  showSignedOut();
  showStatus('Session status is temporarily unavailable. Try again shortly.', true);
});
