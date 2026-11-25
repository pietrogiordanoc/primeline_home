import { createClient } from '@supabase/supabase-js';

export const verifyWebStaff = async ({ email, authUserId, staffId }, create = createClient) => {
  const url = process.env.WEB_CATALOG_SUPABASE_URL;
  const key = process.env.WEB_CATALOG_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Web Catalog staff verification is not configured.');

  const supabase = create(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(authUserId);
  if (userError) {
    if (userError.status === 404) return false;
    throw userError;
  }
  const user = userData.user;
  if (!user || user.id !== authUserId || user.email?.trim().toLowerCase() !== email ||
      (user.banned_until && Date.parse(user.banned_until) > Date.now())) return false;

  const { data: staff, error } = await supabase.from('staff')
    .select('id,auth_user_id,email,status')
    .eq('id', staffId)
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(staff && staff.status === 'Active' && staff.email?.trim().toLowerCase() === email);
};

export const verifyTransferredStaffSession = async (session, verify = verifyWebStaff) => {
  if (session.source !== 'web_catalog_mode') return true;
  if (typeof session.authUserId !== 'string' || typeof session.staffId !== 'string') return false;
  return verify({ email: session.email, authUserId: session.authUserId, staffId: session.staffId });
};
