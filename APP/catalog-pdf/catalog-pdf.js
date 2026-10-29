const ISSUU_URL = 'https://e.issuu.com/embed.html?d=florida_spring_2021_compressed&hideIssuuLogo=true&hideShareButton=true&u=primelinedist';
const accessStatus = document.querySelector('#catalogAccessStatus');
const accessRetry = document.querySelector('#catalogAccessRetry');
const viewer = document.querySelector('#catalogViewer');
const viewerStatus = document.querySelector('#catalogViewerStatus');
const viewerError = document.querySelector('#catalogViewerError');
const viewerRetry = document.querySelector('#catalogViewerRetry');
const frame = document.querySelector('#catalogFrame');
let loadTimeout;

const setAccessStatus = (message, isError = false) => {
  accessStatus.textContent = message;
  accessStatus.classList.toggle('is-error', isError);
  accessStatus.hidden = !message;
};

const showViewerError = () => {
  clearTimeout(loadTimeout);
  viewerStatus.hidden = true;
  viewerError.hidden = false;
};

const loadViewer = () => {
  viewer.hidden = false;
  viewerError.hidden = true;
  viewerStatus.hidden = false;
  frame.src = ISSUU_URL;
  clearTimeout(loadTimeout);
  loadTimeout = setTimeout(showViewerError, 20000);
};

frame.addEventListener('load', () => {
  clearTimeout(loadTimeout);
  viewerStatus.hidden = true;
});
frame.addEventListener('error', showViewerError);

const validateCatalogSession = async () => {
  accessRetry.hidden = true;
  setAccessStatus('Verifying your Catalog PDF access...');

  try {
    const response = await fetch('/api/access/catalog-session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    });

    if (response.status === 401) {
      setAccessStatus('Your Catalog PDF session is missing or expired. Please return home and request a new access code.', true);
      return;
    }
    if (!response.ok) throw new Error('session-validation-failed');

    const result = await response.json();
    if (result.authenticated !== true || result.resource !== 'catalog-pdf') {
      setAccessStatus('This catalog is available only to authorized Prime Line employees.', true);
      return;
    }

    setAccessStatus('');
    loadViewer();
  } catch {
    setAccessStatus('We could not verify your access right now. Please try again.', true);
    accessRetry.hidden = false;
  }
};

accessRetry.addEventListener('click', validateCatalogSession);
viewerRetry.addEventListener('click', validateCatalogSession);
validateCatalogSession();
