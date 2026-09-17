import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://txpaodpyejwyhahdnrlu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wN3nsuAd3D47oBVr_BLS2w_YS-oFnf0';
const BUCKET = 'prime-line-home-documents';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginSection = document.querySelector('#loginSection');
const listSection = document.querySelector('#listSection');
const loginStatus = document.querySelector('#loginStatus');
const listStatus = document.querySelector('#listStatus');
const applicationsBody = document.querySelector('#applicationsBody');

const setLoginStatus = (message, isError = false) => {
  loginStatus.textContent = message;
  loginStatus.classList.toggle('is-error', isError);
};

const setListStatus = (message, isError = false) => {
  listStatus.textContent = message;
  listStatus.classList.toggle('is-error', isError);
};

const formatDate = (value) => (value ? new Date(value).toLocaleString() : '—');

const linkButton = (label, path) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'text-button';
  button.textContent = label;
  button.addEventListener('click', async () => {
    button.disabled = true;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
    button.disabled = false;
    if (error || !data?.signedUrl) return setListStatus('Could not generate the download link.', true);
    window.open(data.signedUrl, '_blank', 'noopener');
  });
  return button;
};

const loadApplications = async () => {
  setListStatus('Loading applications...');
  const { data, error } = await supabase
    .from('job_applications')
    .select('id, submitted_at, applicant_name, applicant_email, status, final_pdf_path, resume_path')
    .order('submitted_at', { ascending: false });
  if (error) return setListStatus(`Could not load applications: ${error.message}`, true);

  applicationsBody.replaceChildren();
  data.forEach((row) => {
    const tr = document.createElement('tr');
    [formatDate(row.submitted_at), row.applicant_name, row.applicant_email, row.status].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    });
    const pdfCell = document.createElement('td');
    pdfCell.append(linkButton('Open PDF', row.final_pdf_path));
    tr.append(pdfCell);
    const resumeCell = document.createElement('td');
    if (row.resume_path) resumeCell.append(linkButton('Open résumé', row.resume_path));
    else resumeCell.textContent = '—';
    tr.append(resumeCell);
    applicationsBody.append(tr);
  });
  setListStatus(`${data.length} application(s).`);
};

const showSignedIn = async () => {
  loginSection.hidden = true;
  listSection.hidden = false;
  await loadApplications();
};

const showSignedOut = () => {
  loginSection.hidden = false;
  listSection.hidden = true;
};

document.querySelector('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoginStatus('Signing in...');
  const email = document.querySelector('#loginEmail').value.trim();
  const password = document.querySelector('#loginPassword').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) setLoginStatus(error.message, true);
});

document.querySelector('#signOutButton').addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) showSignedIn();
  else showSignedOut();
});

const { data: { session } } = await supabase.auth.getSession();
if (session?.user) await showSignedIn();
else showSignedOut();
