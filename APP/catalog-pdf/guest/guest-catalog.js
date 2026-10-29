const linkPanel = document.querySelector('#guestLinkPanel');
const linkDescription = document.querySelector('#guestLinkDescription');
const openButton = document.querySelector('#openGuestCatalog');
const renewPanel = document.querySelector('#guestRenewPanel');
const requestLinkForm = document.querySelector('#requestGuestLinkForm');
const guestFormStatus = document.querySelector('#guestFormStatus');
const guestStatus = document.querySelector('#guestStatus');
const guestAccessNote = document.querySelector('#guestAccessNote');
const guestViewer = document.querySelector('#guestViewer');
const pdfFrame = document.querySelector('#guestPdfFrame');
const reloadButton = document.querySelector('#reloadGuestCatalog');

const hashParameters = new URLSearchParams(location.hash.slice(1));
const invitationToken = hashParameters.get('invite') || '';
const verificationToken = hashParameters.get('verify') || '';
const linkPurpose = invitationToken ? 'invite' : verificationToken ? 'verify' : '';
let magicToken = invitationToken || verificationToken;
let viewerLoadTimeout;

if (location.hash) history.replaceState(null, '', `${location.pathname}${location.search}`);

const setStatus = (message, isError = false) => {
  guestStatus.textContent = message;
  guestStatus.classList.toggle('is-error', isError);
};

const setAccessNote = (expiresAt) => {
  guestAccessNote.textContent = expiresAt === null
    ? 'Catalog Access · No Expiration'
    : `Catalog Access · Expires ${new Date(expiresAt).toLocaleDateString(undefined, { dateStyle: 'long' })}`;
  guestAccessNote.hidden = false;
};

const showRenewal = (message = '') => {
  guestViewer.hidden = true;
  linkPanel.hidden = true;
  renewPanel.hidden = false;
  setStatus(message);
};

const loadCatalogPdf = async () => {
  reloadButton.disabled = true;
  setStatus('Loading the catalog...');
  try {
    const response = await fetch('/api/catalog/guest/pdf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (response.status === 401) {
      showRenewal('Your browser session has expired. Request a fresh verification link to continue.');
      return;
    }
    if (!response.ok || typeof result.url !== 'string') {
      throw new Error(result.error || 'The catalog could not be loaded.');
    }
    pdfFrame.src = result.url;
    guestViewer.hidden = false;
    renewPanel.hidden = true;
    linkPanel.hidden = true;
    setStatus('');
    clearTimeout(viewerLoadTimeout);
    viewerLoadTimeout = setTimeout(() => setStatus('The PDF may still be loading. Use Reload catalog to try again.'), 20000);
  } catch (error) {
    setStatus(error.message || 'The catalog could not be loaded.', true);
  } finally {
    reloadButton.disabled = false;
  }
};

pdfFrame.addEventListener('load', () => {
  clearTimeout(viewerLoadTimeout);
  setStatus('');
});

reloadButton.addEventListener('click', loadCatalogPdf);

openButton.addEventListener('click', async () => {
  if (!magicToken || !linkPurpose) return;
  openButton.disabled = true;
  setStatus(linkPurpose === 'invite' ? 'Verifying your invitation...' : 'Verifying your access link...');
  try {
    const response = await fetch('/api/catalog/guest/redeem', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: magicToken, purpose: linkPurpose })
    });
    const result = await response.json();
    if (!response.ok || result.authenticated !== true || result.resource !== 'catalog-guest') {
      throw new Error(result.error || 'This catalog link is invalid or expired.');
    }
    magicToken = '';
    setAccessNote(result.expiresAt);
    await loadCatalogPdf();
  } catch (error) {
    setStatus(error.message || 'This catalog link could not be verified.', true);
    openButton.disabled = false;
  }
});

requestLinkForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!requestLinkForm.reportValidity()) return;
  const submitButton = requestLinkForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  guestFormStatus.textContent = 'Requesting a verification link...';
  try {
    const response = await fetch('/api/catalog/guest/request-link', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.querySelector('#guestEmail').value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request could not be processed.');
    guestFormStatus.textContent = result.message;
    requestLinkForm.reset();
  } catch (error) {
    guestFormStatus.textContent = error.message || 'The request could not be processed.';
  } finally {
    submitButton.disabled = false;
  }
});

const initialize = async () => {
  if (magicToken) {
    linkPanel.hidden = false;
    renewPanel.hidden = true;
    linkDescription.textContent = linkPurpose === 'invite'
      ? 'This single-use invitation expires 48 hours after it was sent. Your selected access duration starts when you continue.'
      : 'This single-use verification link confirms your existing catalog access. It does not extend the access expiration.';
    openButton.textContent = linkPurpose === 'invite' ? 'Open Catalog' : 'Verify and Open Catalog';
    return;
  }

  try {
    const response = await fetch('/api/catalog/guest/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (response.status === 401 || result.authenticated !== true || result.resource !== 'catalog-guest') {
      showRenewal('Enter the invited email address to request a fresh verification link.');
      return;
    }
    setAccessNote(result.expiresAt);
    await loadCatalogPdf();
  } catch {
    showRenewal('We could not verify your access. Please try again or request a fresh verification link.');
  }
};

initialize();
