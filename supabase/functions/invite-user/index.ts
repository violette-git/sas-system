import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── Verify the caller is authenticated ───────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing authorization header' }, 401);
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await callerClient.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Verify caller is admin or owner ──────────────────────
    const { data: callerProfile } = await callerClient
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single();

    if (!callerProfile || !['admin', 'owner'].includes(callerProfile.role)) {
      return json({ error: 'Forbidden' }, 403);
    }

    // ── Parse request body ───────────────────────────────────
    const { email, full_name, role, company_id, redirect_to } = await req.json();

    if (!email || !full_name || !role || !company_id) {
      return json({ error: 'Missing required fields: email, full_name, role, company_id' }, 400);
    }

    // Admins can only invite to their own company
    if (callerProfile.role === 'admin' && callerProfile.company_id !== company_id) {
      return json({ error: 'Forbidden: cannot invite to another company' }, 403);
    }

    // ── Use service role for privileged operations ───────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Send invite email (creates auth.users row)
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: redirect_to ?? `${Deno.env.get('APP_URL')}/set-password`,
        data: { full_name },
      });

    if (inviteError) throw new Error(inviteError.message);

    // Create the profile row
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: inviteData.user.id,
        company_id,
        full_name,
        email,
        role,
      });

    if (profileError) {
      // Roll back the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(inviteData.user.id);
      throw new Error(profileError.message);
    }

    return json({ success: true, user_id: inviteData.user.id });

  } catch (err: any) {
    console.error('[invite-user]', err);
    return json({ error: err.message ?? 'Internal server error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
