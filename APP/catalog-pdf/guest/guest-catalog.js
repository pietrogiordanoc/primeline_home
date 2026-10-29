const ISSUU_URL = 'https://e.issuu.com/embed.html?d=florida_spring_2021_compressed&hideIssuuLogo=true&hideShareButton=true&u=primelinedist';
const linkPanel = document.querySelector('#guestLinkPanel');
const linkDescription = document.querySelector('#guestLinkDescription');
const openButton = document.querySelector('#openGuestCatalog');
const renewPanel = document.querySelector('#guestRenewPanel');
const requestLinkForm = document.querySelector('#requestGuestLinkForm');
const guestFormStatus = document.querySelector('#guestFormStatus');
const guestStatus = document.querySelector('#guestStatus');
const guestAccessNote = document.querySelector('#guestAccessNote');
const guestInviterNote = document.querySelector('#guestInviterNote');
const guestInviterName = document.querySelector('#guestInviterName');
const guestInviterCompany = document.querySelector('#guestInviterCompany');
const guestInviterEmail = document.querySelector('#guestInviterEmail');
const guestViewer = document.querySelector('#guestViewer');
const guestViewerStatus = document.querySelector('#guestViewerStatus');
const guestViewerError = document.querySelector('#guestViewerError');
const guestViewerRetry = document.querySelector('#guestViewerRetry');
const pdfFrame = document.querySelector('#guestPdfFrame');

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

const setInviterDetails = (name, email) => {
  const verifiedEmail = typeof email === 'string' && /^[^\s@]+@primelinedist\.com$/i.test(email)
    ? email.trim().toLowerCase()
    : '';
  if (!verifiedEmail) {
    guestInviterNote.hidden = true;
    return;
  }
  const fullName = typeof name === 'string' &&
    name.trim().length <= 120 &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(name)
    ? name.trim().replace(/\s+/g, ' ')
    : '';
  guestInviterName.textContent = fullName;
  guestInviterName.hidden = !fullName;
  guestInviterCompany.hidden = !fullName;
  guestInviterEmail.textContent = verifiedEmail;
  guestInviterEmail.href = `mailto:${verifiedEmail}`;
  guestInviterNote.hidden = false;
};

const showRenewal = (message = '') => {
  guestViewer.hidden = true;
  linkPanel.hidden = true;
  renewPanel.hidden = false;
  setStatus(message);
};

const showViewerError = () => {
  clearTimeout(viewerLoadTimeout);
  guestViewerStatus.hidden = true;
  guestViewerError.hidden = false;
};

const loadCatalogViewer = async () => {
  linkPanel.hidden = true;
  renewPanel.hidden = true;
  setStatus('');
  guestViewer.hidden = false;
  guestViewerError.hidden = true;
  guestViewerStatus.hidden = false;
  clearTimeout(viewerLoadTimeout);
  guestViewerStatus.textContent = 'Verifying your catalog access...';

  try {
    const response = await fetch('/api/catalog/guest/pdf', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });
    if (response.status === 401) {
      showRenewal('Your browser session has expired. Request a fresh verification link to continue.');
      return;
    }
    if (!response.ok) throw new Error('Catalog access could not be verified. Please try again.');

    guestViewerStatus.textContent = 'Loading the catalog...';
    pdfFrame.src = ISSUU_URL;
    viewerLoadTimeout = setTimeout(showViewerError, 20000);
  } catch (error) {
    guestViewerStatus.hidden = true;
    guestViewerError.hidden = false;
    guestViewerError.querySelector('p').textContent = error.message || 'The catalog could not be loaded.';
  }
};

pdfFrame.addEventListener('load', () => {
  clearTimeout(viewerLoadTimeout);
  guestViewerStatus.hidden = true;
});

pdfFrame.addEventListener('error', showViewerError);
guestViewerRetry.addEventListener('click', loadCatalogViewer);

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
    setInviterDetails(result.sharedByName, result.sharedBy);
    loadCatalogViewer();
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
    setInviterDetails(result.sharedByName, result.sharedBy);
    loadCatalogViewer();
  } catch {
    showRenewal('We could not verify your access. Please try again or request a fresh verification link.');
  }
};

initialize();
