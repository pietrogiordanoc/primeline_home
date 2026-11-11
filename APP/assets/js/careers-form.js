const careersForm = document.querySelector('.careers-form');

if (careersForm) {
  const status = document.querySelector('.careers-form-status');
  const panel = document.querySelector('.careers-panel-inner');
  const submitButton = careersForm.querySelector('button[type="submit"]');
  const resumeInput = careersForm.querySelector('#careerResume');
  const resumeStatus = careersForm.querySelector('#careerResumeStatus');
  const positionSelect = careersForm.querySelector('#careerPosition');
  const divisionSelect = careersForm.querySelector('#careerDivision');
  const MAX_RESUME_BYTES = 3 * 1024 * 1024;
  let optionsLoaded = false;
  let optionsLoading = false;

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
    if (file.size > MAX_RESUME_BYTES) throw new Error('This PDF is too large. The maximum file size is 3 MB.');
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (new TextDecoder().decode(signature) !== '%PDF-') {
      throw new Error('This file is not a valid PDF document.');
    }
    return file;
  };

  const readResume = async (file) => {
    if (!file) return null;
    await validatePdf(file);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
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

      const response = await fetch('/.netlify/functions/send-careers-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || result.sent !== true) {
        throw new Error(result.error || 'Your inquiry could not be sent. Please try again.');
      }

      careersForm.reset();
      showStatus(
        `Thank you — we’ve received your inquiry. Reference: ${result.reference}. Our team will review your information and contact you if there is a fit.${result.resumeReceived ? ' Your PDF résumé was received and attached.' : ''}`,
        'is-success'
      );
    } catch (error) {
      showStatus(error.message || 'Your inquiry could not be sent. Please check your connection and try again.', 'is-error');
    } finally {
      delete careersForm.dataset.submitting;
      careersForm.removeAttribute('aria-busy');
      submitButton.disabled = false;
      submitButton.textContent = 'Send Your Inquiry';
    }
  });
}
