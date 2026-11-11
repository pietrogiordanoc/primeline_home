const careersForm = document.querySelector('.careers-form');

if (careersForm) {
  const status = document.querySelector('.careers-form-status');
  const panel = document.querySelector('.careers-panel-inner');
  const careersPanelClose = document.querySelector('.careers-panel-close');
  const navPanel = document.querySelector('.nav-panel');
  const navPanelClose = document.querySelector('.nav-panel-close');
  const menuToggle = document.querySelector('.menu-toggle');
  const footerCareersTrigger = document.querySelector('footer .careers-trigger');
  const submitButton = careersForm.querySelector('button[type="submit"]');
  const resumeInput = careersForm.querySelector('#careerResume');
  const resumeStatus = careersForm.querySelector('#careerResumeStatus');
  const successDialog = document.querySelector('#careersSuccessDialog');
  const successReference = document.querySelector('#careersSuccessReference');
  const successConfirmation = document.querySelector('#careersSuccessConfirmation');
  const successDeliveryNote = document.querySelector('#careersSuccessDeliveryNote');
  const successResume = document.querySelector('#careersSuccessResume');
  const successCloseButton = document.querySelector('#careersSuccessClose');
  const positionSelect = careersForm.querySelector('#careerPosition');
  const divisionSelect = careersForm.querySelector('#careerDivision');
  const MAX_RESUME_BYTES = 3 * 1024 * 1024;
  const SUBMISSION_STORAGE_KEY = 'primeLine.joinOurTeam.submissionId';
  const MAX_IDEMPOTENCY_AGE_MS = 23 * 60 * 60 * 1000;
  let optionsLoaded = false;
  let optionsLoading = false;
  let submissionId;

  const createSubmissionId = () => `JI-${Date.now()}-${crypto.randomUUID()}`;
  const loadSubmissionId = () => {
    try {
      const saved = sessionStorage.getItem(SUBMISSION_STORAGE_KEY);
      const match = saved?.match(/^JI-(\d{13})-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      if (match) {
        const age = Date.now() - Number(match[1]);
        if (age >= -60_000 && age <= MAX_IDEMPOTENCY_AGE_MS) return saved;
      }
      const nextId = createSubmissionId();
      sessionStorage.setItem(SUBMISSION_STORAGE_KEY, nextId);
      return nextId;
    } catch (error) {
      console.warn('Join Our Team retry protection could not use session storage.', { name: error.name });
      return createSubmissionId();
    }
  };

  submissionId = loadSubmissionId();

  const startNewSubmission = () => {
    submissionId = createSubmissionId();
    try {
      sessionStorage.setItem(SUBMISSION_STORAGE_KEY, submissionId);
    } catch (error) {
      console.warn('Join Our Team retry protection could not update session storage.', { name: error.name });
    }
  };

  const closeSuccessDialog = () => {
    if (successDialog.open) successDialog.close();
    careersForm.hidden = false;
    careersPanelClose?.click();
    const menuWasOpen = navPanel?.classList.contains('is-open') === true;
    if (menuWasOpen) navPanelClose?.click();
    const focusTarget = menuWasOpen ? menuToggle : footerCareersTrigger;
    window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 550);
  };

  successCloseButton.addEventListener('click', closeSuccessDialog);
  successDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSuccessDialog();
  });

  const showStatus = (message, className) => {
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(className);
    status.hidden = false;
    panel.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const validatePdf = async (file) => {
    if (!file) return null;
    if (!file.name.toLocaleLowerCase('en-US').endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
      throw new Error('Only PDF résumés are accepted.');
    }
    if (file.size > MAX_RESUME_BYTES) throw new Error('Maximum PDF file size: 3 MB.');
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(signature) !== '%PDF-') {
      throw new Error('This file is not a valid PDF document.');
    }
    return file;
  };

  const readResume = async (file) => {
    if (!file || !file.name) return null;
    await validatePdf(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Your PDF résumé could not be read. Please try again.'));
          return;
        }
        const dataUrl = reader.result.replace(/^data:[^;]+;base64,/, 'data:application/pdf;base64,');
        resolve({ name: file.name, dataUrl });
      };
      reader.onerror = () => reject(new Error('Your PDF résumé could not be read. Please try again.'));
      reader.readAsDataURL(file);
    });
  };

  const showResumeStatus = (message, className = '') => {
    resumeStatus.textContent = message;
    resumeStatus.classList.remove('is-success', 'is-error');
    if (className) resumeStatus.classList.add(className);
  };

  resumeInput.addEventListener('change', async () => {
    const file = resumeInput.files[0];
    if (!file) {
      showResumeStatus('No résumé attached. If you upload one, it must be a PDF no larger than 3 MB.');
      return;
    }
    showResumeStatus('Checking your PDF résumé...');
    try {
      await validatePdf(file);
      showResumeStatus(`PDF résumé ready to attach (${(file.size / (1024 * 1024)).toFixed(2)} MB).`, 'is-success');
    } catch (error) {
      resumeInput.value = '';
      showResumeStatus(error.message, 'is-error');
    }
  });

  const populateOptions = (select, values, placeholder) => {
    select.replaceChildren(new Option(placeholder, '', true, true));
    select.options[0].disabled = true;
    values.forEach((value) => select.add(new Option(value, value)));
  };

  const loadFormOptions = async () => {
    if (optionsLoaded || optionsLoading) return;
    optionsLoading = true;
    submitButton.disabled = true;
    try {
      const response = await fetch('/.netlify/functions/send-careers-inquiry', { method: 'GET', cache: 'no-cache' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Job application options are temporarily unavailable.');
      if (!Array.isArray(result.positions) || !result.positions.length
        || !Array.isArray(result.divisions) || !result.divisions.length) {
        throw new Error('Job application options are temporarily unavailable.');
      }
      populateOptions(positionSelect, result.positions, 'Select a position');
      populateOptions(divisionSelect, result.divisions, 'Select a division or location');
      optionsLoaded = true;
      status.hidden = true;
    } catch (error) {
      showStatus(
        error instanceof SyntaxError
          ? 'Job application options are temporarily unavailable. Please try again.'
          : error.message || 'Job application options are temporarily unavailable. Please try again.',
        'is-error'
      );
    } finally {
      optionsLoading = false;
      submitButton.disabled = !optionsLoaded;
    }
  };

  const observePanel = new MutationObserver(() => {
    if (document.querySelector('.careers-panel').classList.contains('is-open')) loadFormOptions();
  });
  observePanel.observe(document.querySelector('.careers-panel'), { attributes: true, attributeFilter: ['class'] });
  if (document.querySelector('.careers-panel').classList.contains('is-open')) loadFormOptions();

  careersForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (careersForm.dataset.submitting === 'true' || !careersForm.reportValidity()) return;

    careersForm.dataset.submitting = 'true';
    careersForm.setAttribute('aria-busy', 'true');
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';
    status.hidden = true;
    status.textContent = '';
    status.classList.remove('is-success', 'is-error');

    try {
      const formData = new FormData(careersForm);
      const resume = await readResume(formData.get('resume'));
      const payload = Object.fromEntries(formData.entries());
      delete payload.resume;
      payload.resume = resume;
      payload.submissionId = submissionId;

      const response = await fetch('/.netlify/functions/send-careers-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('We could not confirm receipt. Your information is still here; please try again.');
      }
      if (!response.ok || result?.sent !== true || !/^JI-\d{8}-[A-Z0-9]{4}$/.test(result.reference || '')) {
        throw new Error(result?.error || 'Your inquiry could not be sent. Please try again.');
      }

      careersForm.reset();
      careersForm.hidden = true;
      status.hidden = true;
      showResumeStatus('Maximum PDF file size: 3 MB. No résumé attached.');
      successReference.textContent = result.reference;
      const confirmationAccepted = result.confirmation?.acceptedByResend === true;
      successConfirmation.textContent = confirmationAccepted
        ? 'A confirmation email has been sent to your email address.'
        : 'Your application was received successfully. Please keep your application reference for your records.';
      successDeliveryNote.hidden = !confirmationAccepted;
      successResume.hidden = result.resumeReceived !== true;
      startNewSubmission();
      successDialog.showModal();
      successCloseButton.focus();
    } catch (error) {
      showStatus(
        error instanceof TypeError
          ? 'A temporary connection problem prevented submission. Your information is still here; please try again.'
          : error.message || 'Your application could not be submitted. Your information is still here; please try again.',
        'is-error'
      );
    } finally {
      delete careersForm.dataset.submitting;
      careersForm.removeAttribute('aria-busy');
      submitButton.disabled = false;
      submitButton.textContent = 'Send Your Inquiry';
    }
  });
}
