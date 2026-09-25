import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';

const taskRoot = process.env.LAMBDA_TASK_ROOT || process.cwd();
const templatePath = path.join(taskRoot, 'PDF', '1. PLD Job Application-Fillable.pdf');

const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const MAX_FIELD_COUNT = 150;
const TEMPLATE_VERSION = 'pld-job-application-2026-09';
const BUCKET = 'prime-line-home-documents';

const json = (body, statusCode = 200) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

const dataUrlToBuffer = (value, allowedTypes, maxBytes) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !allowedTypes.has(match[1])) throw new Error('Invalid file type.');
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > maxBytes) throw new Error('File is too large.');
  return { buffer, contentType: match[1] };
};

const pdfSignatureTarget = (form, pages) => {
  for (const field of form.getFields()) {
    if (!/signature|sign/i.test(field.getName())) continue;
    const widgets = field.acroField?.getWidgets?.() || [];
    for (const widget of widgets) {
      const pageRef = widget.getP?.();
      const pageIndex = pages.findIndex((page) => page.ref?.toString() === pageRef?.toString());
      if (pageIndex >= 0) return { page: pages[pageIndex], rectangle: widget.getRectangle() };
    }
  }
  return null;
};

const fillPdf = async (fields, signatureData) => {
  let template;
  try {
    template = await readFile(templatePath);
  } catch (error) {
    template = await readFile(path.join(process.cwd(), 'PDF', '1. PLD Job Application-Fillable.pdf'));
  }
  const pdf = await PDFDocument.load(template);
  const form = pdf.getForm();
  const pages = pdf.getPages();
  const signatureTarget = pdfSignatureTarget(form, pages);

  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === 'undefined' || value === null) continue;
    try {
      const field = form.getField(name);
      const type = field.constructor.name;
      if (type === 'PDFTextField') field.setText(String(value).slice(0, 500));
      else if (type === 'PDFRadioGroup' && field.getOptions().includes(String(value))) field.select(String(value));
      else if (type === 'PDFCheckBox') {
        if (value === true || value === 'true') field.check();
        else field.uncheck();
      }
    } catch {
      // The browser only submits fields from the inspected template; unknown names are ignored.
    }
  }

  try {
    form.flatten({ updateFieldAppearances: true });
  } catch (error) {
    console.error('Flatten failed, saving with the form left interactive:', error);
  }
  const signature = dataUrlToBuffer(signatureData, new Set(['image/png']), 512 * 1024);
  if (signature && signatureTarget) {
    try {
      const image = await pdf.embedPng(signature.buffer);
      const { x, y, width, height } = signatureTarget.rectangle;
      signatureTarget.page.drawImage(image, { x, y, width, height, opacity: .95 });
    } catch (error) {
      console.error('Signature embed failed:', error);
    }
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
};

const getSupabase = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Application service is not configured.' }, 503);

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return json({ error: 'Invalid request.' }, 400); }
  const fields = payload.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields) || Object.keys(fields).length > MAX_FIELD_COUNT) return json({ error: 'Invalid application fields.' }, 400);
  const testMode = payload.testMode === true && process.env.ALLOW_TEST_APPLICATIONS === 'true';
  if (payload.testMode === true && !testMode) return json({ error: 'Test mode is not enabled on the server.' }, 403);
  const signature = payload.signature ? dataUrlToBuffer(payload.signature, new Set(['image/png']), 512 * 1024) : null;
  if (!signature && !testMode) return json({ error: 'A signature is required.' }, 400);

  const submittedName = String(fields['First Name'] || fields['Last Name'] || fields.name || '').trim().slice(0, 160);
  const submittedEmail = String(fields['Email Address_2'] || fields['Email Address'] || '').trim().toLowerCase().slice(0, 254);
  const applicantName = submittedName || (testMode ? 'Test Applicant' : '');
  const applicantEmail = submittedEmail || (testMode ? 'test@example.com' : '');
  if (!applicantName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) return json({ error: 'Please provide your name and a valid email address.' }, 400);

  const idempotencyKey = createHash('sha256').update(JSON.stringify({ fields, signature: payload.signature })).digest('hex');
  const supabase = getSupabase();
  const { data: existing } = await supabase.from('job_applications').select('id,final_pdf_path').eq('idempotency_key', idempotencyKey).maybeSingle();
  if (existing) {
    const { data: download } = await supabase.storage.from(BUCKET).createSignedUrl(existing.final_pdf_path, 60 * 60);
    return json({ received: true, downloadUrl: download?.signedUrl || null, duplicate: true });
  }

  let pdfBuffer;
  try {
    pdfBuffer = await fillPdf(fields, payload.signature);
  } catch (error) {
    console.error('PDF generation failed:', error);
    return json({ error: testMode ? `Could not generate the completed application: ${error.message}` : 'Could not generate the completed application.' }, 422);
  }
  let resume;
  try {
    if (payload.resume) resume = dataUrlToBuffer(payload.resume, new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']), MAX_RESUME_BYTES);
  } catch (error) { return json({ error: error.message }, 400); }

  const id = randomUUID();
  const pdfPath = `applications/${id}/completed-application.pdf`;
  const resumePath = resume ? `applications/${id}/resume` : null;
  const uploaded = [];
  try {
    const pdfUpload = await supabase.storage.from(BUCKET).upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
    if (pdfUpload.error) throw pdfUpload.error;
    uploaded.push(pdfPath);
    if (resume) {
      const resumeUpload = await supabase.storage.from(BUCKET).upload(resumePath, resume.buffer, { contentType: resume.contentType, upsert: false });
      if (resumeUpload.error) throw resumeUpload.error;
      uploaded.push(resumePath);
    }
    const { error: insertError } = await supabase.from('job_applications').insert({ id, idempotency_key: idempotencyKey, applicant_name: applicantName, applicant_email: applicantEmail, template_version: TEMPLATE_VERSION, final_pdf_path: pdfPath, resume_path: resumePath, signature_accepted_at: signature ? new Date().toISOString() : null });
    if (insertError) {
      if (insertError.code === '23505') {
        const { data: duplicate } = await supabase.from('job_applications').select('final_pdf_path').eq('idempotency_key', idempotencyKey).single();
        const { data: download } = await supabase.storage.from(BUCKET).createSignedUrl(duplicate.final_pdf_path, 3600);
        return json({ received: true, downloadUrl: download?.signedUrl || null, duplicate: true });
      }
      throw insertError;
    }
    const { data: download } = await supabase.storage.from(BUCKET).createSignedUrl(pdfPath, 3600);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const testRecipients = testMode && Array.isArray(payload.testNotifyEmails)
      ? payload.testNotifyEmails.filter((value) => typeof value === 'string' && emailPattern.test(value)).slice(0, 5)
      : [];
    const recipients = testRecipients.length ? testRecipients : (process.env.HR_EMAIL ? [process.env.HR_EMAIL] : []);
    if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL && recipients.length) {
      const siteUrl = process.env.URL || 'https://primelinehome.netlify.app';
      await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({
        from: process.env.FROM_EMAIL,
        to: recipients,
        subject: `New Prime Line job application — ${applicantName}`,
        text: `${applicantName} (${applicantEmail}) submitted a new job application.\n\nReview it in the protected HR area:\n${siteUrl}/careers/admin/\n\nSign in with your HR account. This email does not include the application document.`
      }) });
    }
    return json({ received: true, downloadUrl: download?.signedUrl || null });
  } catch (error) {
    console.error('Application save failed:', error);
    await Promise.all(uploaded.map((path) => supabase.storage.from(BUCKET).remove([path])));
    return json({ error: testMode ? `The application could not be saved: ${error.message || error}` : 'The application could not be saved. Please try again.' }, 502);
  }
};