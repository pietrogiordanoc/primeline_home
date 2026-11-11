const careersForm = document.querySelector('.careers-form');

if (careersForm) {
  const status = document.querySelector('.careers-form-status');
  const panel = document.querySelector('.careers-panel-inner');
  const submitButton = careersForm.querySelector('button[type="submit"]');
  const MAX_RESUME_BYTES = 3 * 1024 * 1024;

  const showStatus = (message, className) => {
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    status.classList.add(className);
    status.hidden = false;
    panel.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const readResume = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > MAX_RESUME_BYTES) {
      reject(new Error('Please upload a résumé no larger than 3 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, dataUrl: reader.result });
    reader.onerror = () => reject(new Error('Your résumé could not be read. Please try again.'));
    reader.readAsDataURL(file);
  });

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

      const response = await fetch('/api/careers/send-inquiry', {
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
        'Thank you — we’ve received your inquiry. Our team will review your information and contact you if there is a fit.',
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
