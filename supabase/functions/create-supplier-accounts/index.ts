import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Get all suppliers from CRM
  const { data: suppliers, error: suppError } = await supabaseAdmin
    .from('suppliers')
    .select('id, name, type')
    .order('name')

  if (suppError) {
    return new Response(JSON.stringify({ error: suppError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get primary contacts for each supplier
  const results: { supplier: string; status: string; user_id?: string; error?: string }[] = []

  for (const supplier of suppliers || []) {
    // Check if profile already exists for this supplier
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('user_id')
      .or(`company_name.ilike.${supplier.name},full_name.ilike.${supplier.name}`)
      .limit(1)

    if (existingProfile && existingProfile.length > 0) {
      results.push({ supplier: supplier.name, status: 'already_exists', user_id: existingProfile[0].user_id })
      continue
    }

    // Get primary contact email
    const { data: contacts } = await supabaseAdmin
      .from('supplier_contacts')
      .select('email, full_name')
      .eq('supplier_id', supplier.id)
      .eq('is_primary', true)
      .limit(1)

    const contact = contacts?.[0]
    if (!contact?.email) {
      results.push({ supplier: supplier.name, status: 'skipped', error: 'No primary contact email' })
      continue
    }

    // Check if auth user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find(u => u.email === contact.email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
      // Ensure profile exists
      const { data: profileCheck } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (!profileCheck || profileCheck.length === 0) {
        await supabaseAdmin.from('profiles').insert({
          user_id: userId,
          full_name: contact.full_name || supplier.name,
          company_name: supplier.name,
        })
      }
    } else {
      // Create auth user (no login - random password)
      const randomPassword = crypto.randomUUID() + crypto.randomUUID()
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: contact.email,
        password: randomPassword,
        email_confirm: true,
        user_metadata: { full_name: contact.full_name || supplier.name },
      })

      if (createError || !newUser?.user) {
        results.push({ supplier: supplier.name, status: 'error', error: createError?.message || 'Failed to create user' })
        continue
      }

      userId = newUser.user.id

      // Update profile with company name (trigger creates it with full_name only)
      await supabaseAdmin
        .from('profiles')
        .update({ company_name: supplier.name })
        .eq('user_id', userId)
    }

    // Ensure supplier role exists
    const { data: roleCheck } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'supplier')
      .limit(1)

    if (!roleCheck || roleCheck.length === 0) {
      await supabaseAdmin.from('user_roles').insert({
        user_id: userId,
        role: 'supplier',
      })
    }

    results.push({ supplier: supplier.name, status: 'created', user_id: userId })
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
