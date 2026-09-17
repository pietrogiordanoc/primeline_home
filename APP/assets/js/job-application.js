import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';

const pdfUrl = '../PDF/1.%20PLD%20Job%20Application-Fillable.pdf';
const pdfStage = document.querySelector('#pdfStage');
const status = document.querySelector('#applicationStatus');
const pageNumber = document.querySelector('#pageNumber');
const pageCount = document.querySelector('#pageCount');
const zoomValue = document.querySelector('#zoomValue');
const fieldState = new Map();
const requiredFields = new Set();
let pdfDocument;
let currentPage = 1;
let scale = 1.25;
let lastPageFields = [];

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

const setStatus = (message, isError = false) => {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
};

const viewportRect = (viewport, rect) => {
  const converted = viewport.convertToViewportRectangle(rect);
  return {
    left: Math.min(converted[0], converted[2]),
    top: Math.min(converted[1], converted[3]),
    width: Math.abs(converted[2] - converted[0]),
    height: Math.abs(converted[3] - converted[1])
  };
};

const updateProgress = () => {
  const complete = [...requiredFields].filter((name) => String(fieldState.get(name) || '').trim()).length;
  document.querySelector('#requiredCount').textContent = `${complete} / ${requiredFields.size}`;
};

const hasSignatureInk = () => {
  const pixels = signaturePad.getContext('2d').getImageData(0, 0, signaturePad.width, signaturePad.height).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) return true;
  return false;
};

const isTestMode = () => document.querySelector('#testMode').checked;

const makeControl = (annotation, box) => {
  const isRadio = annotation.fieldType === 'Btn' && annotation.radioButton;
  const isCheckbox = annotation.fieldType === 'Btn' && !annotation.radioButton;
  const control = document.createElement(isRadio || isCheckbox ? 'input' : annotation.fieldType === 'Tx' && box.height > 42 ? 'textarea' : 'input');
  control.name = annotation.fieldName || `field-${annotation.id}`;
  control.dataset.fieldName = control.name;
  control.style.left = `${box.left}px`;
  control.style.top = `${box.top}px`;
  control.style.width = `${Math.max(box.width, 8)}px`;
  control.style.height = `${Math.max(box.height, 10)}px`;
  control.autocomplete = 'off';

  if (isRadio) {
    control.type = 'radio';
    control.value = annotation.buttonValue || annotation.exportValue || annotation.fieldValue || 'On';
    if (fieldState.get(control.name) === control.value) control.checked = true;
  } else if (isCheckbox) {
    control.type = 'checkbox';
    control.value = annotation.exportValue || annotation.buttonValue || 'Yes';
    control.checked = fieldState.get(control.name) === true;
  } else {
    if (control instanceof HTMLInputElement) control.type = 'text';
    control.value = fieldState.get(control.name) || annotation.fieldValue || '';
    control.maxLength = 500;
  }

  if (annotation.fieldFlags & 2) {
    requiredFields.add(control.name);
    control.setAttribute('aria-required', 'true');
  }

  control.addEventListener('input', () => {
    fieldState.set(control.name, control.type === 'checkbox' ? control.checked : control.value);
    updateProgress();
  });
  control.addEventListener('change', () => {
    if (control.type === 'radio' && control.checked) fieldState.set(control.name, control.value);
    if (control.type === 'checkbox') fieldState.set(control.name, control.checked);
    updateProgress();
  });
  return control;
};

const renderPage = async (pageNumberValue) => {
  const page = await pdfDocument.getPage(pageNumberValue);
  const viewport = page.getViewport({ scale });
  const pageShell = document.createElement('div');
  pageShell.className = 'pdf-page';
  pageShell.style.width = `${viewport.width}px`;
  pageShell.style.height = `${viewport.height}px`;
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  pageShell.append(canvas);
  const layer = document.createElement('div');
  layer.className = 'annotation-layer';
  pageShell.append(layer);
  pdfStage.replaceChildren(pageShell);

  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const annotations = await page.getAnnotations({ intent: 'display' });
  lastPageFields = annotations.filter((annotation) => annotation.subtype === 'Widget');
  lastPageFields.forEach((annotation) => {
    const control = makeControl(annotation, viewportRect(viewport, annotation.rect));
    layer.append(control);
  });
  pageNumber.value = pageNumberValue;
  pageCount.textContent = pdfDocument.numPages;
  updateProgress();
};

const goToPage = async (value) => {
  currentPage = Math.min(Math.max(Number(value) || 1, 1), pdfDocument.numPages);
  await renderPage(currentPage);
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!file) return resolve(null);
  if (file.size > 5 * 1024 * 1024) return reject(new Error('Résumé must be 5 MB or smaller.'));
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Could not read the résumé.'));
  reader.readAsDataURL(file);
});

const signaturePad = document.querySelector('#signaturePad');
const signatureContext = signaturePad.getContext('2d');
let drawing = false;
const signaturePoint = (event) => {
  const rect = signaturePad.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * signaturePad.width / rect.width, y: (event.clientY - rect.top) * signaturePad.height / rect.height };
};
signatureContext.strokeStyle = '#16264a';
signatureContext.lineWidth = 3;
signatureContext.lineCap = 'round';
signaturePad.addEventListener('pointerdown', (event) => { drawing = true; signaturePad.setPointerCapture(event.pointerId); const point = signaturePoint(event); signatureContext.beginPath(); signatureContext.moveTo(point.x, point.y); });
signaturePad.addEventListener('pointermove', (event) => { if (!drawing) return; const point = signaturePoint(event); signatureContext.lineTo(point.x, point.y); signatureContext.stroke(); });
signaturePad.addEventListener('pointerup', () => { drawing = false; });
document.querySelector('#clearSignature').addEventListener('click', () => signatureContext.clearRect(0, 0, signaturePad.width, signaturePad.height));

document.querySelector('#previousPage').addEventListener('click', () => goToPage(currentPage - 1));
document.querySelector('#nextPage').addEventListener('click', () => goToPage(currentPage + 1));
pageNumber.addEventListener('change', () => goToPage(pageNumber.value));
document.querySelector('#zoomOut').addEventListener('click', () => { scale = Math.max(.6, scale - .1); zoomValue.textContent = `${Math.round(scale * 100)}%`; renderPage(currentPage); });
document.querySelector('#zoomIn').addEventListener('click', () => { scale = Math.min(1.8, scale + .1); zoomValue.textContent = `${Math.round(scale * 100)}%`; renderPage(currentPage); });

const reviewModal = document.querySelector('#reviewModal');
const modalStatus = document.querySelector('#modalStatus');
const setModalStatus = (message, isError = false) => {
  modalStatus.textContent = message;
  modalStatus.hidden = false;
  modalStatus.classList.toggle('is-error', isError);
};

document.querySelector('#openReviewModal').addEventListener('click', () => {
  modalStatus.hidden = true;
  reviewModal.hidden = false;
});
document.querySelector('#closeReviewModal').addEventListener('click', () => {
  reviewModal.hidden = true;
});

document.querySelector('#submitApplication').addEventListener('click', async () => {
  const missing = [...requiredFields].filter((name) => !String(fieldState.get(name) || '').trim());
  if (!isTestMode() && missing.length) return setModalStatus(`Please complete ${missing.length} required field(s) in the application before submitting.`, true);
  if (!isTestMode() && !hasSignatureInk()) return setModalStatus('Please add your signature before submitting.', true);
  if (!document.querySelector('#reviewConfirmation').checked) return setModalStatus('Please confirm that your information is accurate.', true);

  const submitButton = document.querySelector('#submitApplication');
  submitButton.disabled = true;
  setModalStatus('Submitting securely...');
  try {
    const resume = await readFileAsDataUrl(document.querySelector('#resume').files[0]);
    const testNotifyEmails = document.querySelector('#testNotifyEmails').value.split(',').map((value) => value.trim()).filter(Boolean);
    const response = await fetch('/api/careers/submit-application', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: Object.fromEntries(fieldState), signature: hasSignatureInk() ? signaturePad.toDataURL('image/png') : null, resume, testMode: isTestMode(), testNotifyEmails }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not submit the application.');
    reviewModal.hidden = true;
    document.querySelector('#modalDownloadApplication').href = result.downloadUrl;
    document.querySelector('#successModal').hidden = false;
  } catch (error) {
    submitButton.disabled = false;
    setModalStatus(error.message, true);
  }
});

document.querySelector('#closeSuccessModal').addEventListener('click', () => {
  document.querySelector('#successModal').hidden = true;
});

try {
  pdfDocument = await pdfjsLib.getDocument(pdfUrl).promise;
  pageCount.textContent = pdfDocument.numPages;
  for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
    const page = await pdfDocument.getPage(pageIndex);
    const annotations = await page.getAnnotations({ intent: 'display' });
    annotations.filter((annotation) => annotation.subtype === 'Widget' && annotation.fieldFlags & 2).forEach((annotation) => requiredFields.add(annotation.fieldName));
  }
  await renderPage(1);
  setStatus('Complete the original application. Your progress stays saved as you move between pages.');
} catch (error) {
  setStatus('The application PDF could not be loaded. Please try again later.', true);
  console.error(error);
}