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
const routingRulesList = document.querySelector('#routingRulesList');
const ruleForm = document.querySelector('#routingRuleForm');
const ruleCountry = document.querySelector('#ruleCountry');
const ruleStateSelect = document.querySelector('#ruleStateSelect');
const ruleStateText = document.querySelector('#ruleStateText');
const ruleRecipientsInput = document.querySelector('#ruleRecipients');
let routingConfig = null;
let editingRuleId = null;

const newId = () => crypto.randomUUID();

const setContactStatus = (message, isError = false) => {
  contactConfigStatus.textContent = message;
  contactConfigStatus.classList.toggle('is-error', isError);
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
      renderRecipients();
    });
    enabledLabel.append(enabled, document.createTextNode(' Enabled'));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'admin-text-button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      routingConfig.generalRecipients = routingConfig.generalRecipients.filter((item) => item.id !== recipient.id);
      renderRecipients();
    });
    row.append(email, enabledLabel, remove);
    generalRecipientsList.append(row);
  });
};

const renderRules = () => {
  routingRulesList.replaceChildren();
  routingConfig.stateRules.forEach((rule) => {
    const row = document.createElement('article');
    row.className = 'admin-rule-row';
    const location = document.createElement('div');
    location.className = 'admin-rule-location';
    const countryName = contactData.countries.find((country) => country.code === rule.countryCode)?.name || rule.countryCode;
    const stateName = rule.countryCode === 'US'
      ? contactData.usStates.find((state) => state.code === rule.state)?.name || rule.state
      : rule.state;
    const title = document.createElement('strong');
    title.textContent = `${countryName} · ${stateName}`;
    const recipientText = document.createElement('span');
    recipientText.textContent = rule.recipients.join(', ');
    location.append(title, recipientText);
    const enabledLabel = document.createElement('label');
    enabledLabel.className = 'admin-toggle-label';
    const enabled = document.createElement('input');
    enabled.type = 'checkbox';
    enabled.checked = rule.enabled;
    enabled.setAttribute('aria-label', `Enable routing for ${countryName}, ${stateName}`);
    enabled.addEventListener('change', () => {
      rule.enabled = enabled.checked;
      renderRules();
    });
    enabledLabel.append(enabled, document.createTextNode(' Enabled'));
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
    });
    actions.append(enabledLabel, edit, remove);
    row.append(location, actions);
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
    setContactStatus(result.updatedAt ? `Last saved: ${new Date(result.updatedAt).toLocaleString()}` : 'Using the initial default recipient. Save to confirm configuration.');
  } catch (error) {
    routingConfig = null;
    setContactStatus(error.message || 'Configuration could not be loaded.', true);
  }
};

const updateRuleStateField = (clear = false) => {
  const isUnitedStates = ruleCountry.value === 'US';
  if (clear) {
    ruleStateSelect.value = '';
    ruleStateText.value = '';
  }
  document.querySelector('#ruleStateSelectLabel').hidden = !isUnitedStates;
  ruleStateSelect.disabled = !isUnitedStates;
  ruleStateSelect.required = isUnitedStates;
  document.querySelector('#ruleStateTextLabel').hidden = isUnitedStates;
  ruleStateText.disabled = isUnitedStates;
  ruleStateText.required = !isUnitedStates;
};

const editRule = (rule) => {
  editingRuleId = rule.id;
  ruleCountry.value = rule.countryCode;
  updateRuleStateField();
  if (rule.countryCode === 'US') ruleStateSelect.value = rule.state;
  else ruleStateText.value = rule.state;
  ruleRecipientsInput.value = rule.recipients.join('\n');
  document.querySelector('#routingRuleFormTitle').textContent = 'Edit routing rule';
  document.querySelector('#saveRuleButton').textContent = 'Update rule';
  document.querySelector('#cancelRuleEdit').hidden = false;
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
ruleStateSelect.add(new Option('Choose a state', ''));
ruleStateSelect.options[0].disabled = true;
ruleStateSelect.options[0].selected = true;
contactData.usStates.forEach((state) => ruleStateSelect.add(new Option(state.name, state.code)));
ruleCountry.addEventListener('change', () => updateRuleStateField(true));
updateRuleStateField();

document.querySelector('#addRecipientForm').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!routingConfig) return;
  const input = document.querySelector('#newRecipientEmail');
  const email = input.value.trim();
  if (routingConfig.generalRecipients.some((recipient) => recipient.email.toLowerCase() === email.toLowerCase())) {
    setContactStatus('That recipient is already in the list.', true);
    return;
  }
  routingConfig.generalRecipients.push({ id: newId(), email, enabled: true });
  input.value = '';
  renderRecipients();
  setContactStatus('Recipient added. Save changes to apply it.');
});

ruleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!routingConfig) return;
  if (!ruleForm.reportValidity()) return;
  const countryCode = ruleCountry.value;
  const state = countryCode === 'US' ? ruleStateSelect.value : ruleStateText.value.trim();
  const recipients = ruleRecipientsInput.value.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean);
  const existing = routingConfig.stateRules.find((rule) => rule.id === editingRuleId);
  const rule = {
    id: editingRuleId || newId(),
    countryCode,
    state,
    recipients,
    enabled: existing ? existing.enabled : true
  };
  if (existing) {
    routingConfig.stateRules = routingConfig.stateRules.map((item) => item.id === editingRuleId ? rule : item);
  } else {
    routingConfig.stateRules.push(rule);
  }
  ruleForm.reset();
  editingRuleId = null;
  updateRuleStateField();
  document.querySelector('#routingRuleFormTitle').textContent = 'Add a routing rule';
  document.querySelector('#saveRuleButton').textContent = 'Add rule';
  document.querySelector('#cancelRuleEdit').hidden = true;
  renderRules();
  setContactStatus('Rule updated. Save changes to apply it.');
});

document.querySelector('#cancelRuleEdit').addEventListener('click', () => {
  ruleForm.reset();
  editingRuleId = null;
  updateRuleStateField();
  document.querySelector('#routingRuleFormTitle').textContent = 'Add a routing rule';
  document.querySelector('#saveRuleButton').textContent = 'Add rule';
  document.querySelector('#cancelRuleEdit').hidden = true;
});

document.querySelector('#reloadContactConfig').addEventListener('click', loadContactConfig);
document.querySelector('#saveContactConfig').addEventListener('click', async (event) => {
  if (!routingConfig || event.currentTarget.disabled) return;
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
