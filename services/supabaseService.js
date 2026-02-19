const { createClient } = require('@supabase/supabase-js')

let supabase = null

function getClient() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    }
    supabase = createClient(url, key, {
      auth: { persistSession: false },
    })
  }
  return supabase
}

/**
 * Insert one registration row into the `registrations` table.
 * If the table doesn't exist yet, this will throw — see the
 * SQL setup in SETUP_GUIDE.md / your Supabase dashboard.
 *
 * Fails silently: logs the error but does NOT throw, so the
 * PDF is always returned to the user even if Supabase is down.
 */
async function insertRegistration(data) {
  try {
    const client = getClient()
    const { error } = await client.from('registrations').insert({
      form_no:             data.formNo,
      submitted_at:        data.submittedDate,
      full_name:           data.fullName,
      phone_number:        data.phoneNumber,
      date_of_birth:       data.dateOfBirth,
      lga:                 data.lga,
      home_address:        data.homeAddress,
      gender:              data.gender,
      qualification:       data.qualification,
      has_security_exp:    data.hasSecurityExp,
      organization_name:   data.organizationName || null,
      membership_duration: data.membershipDuration || null,
      special_skill:       data.specialSkill || null,
      other_info:          data.otherInfo || null,
    })
    if (error) throw error
    console.log(`[Supabase] Saved registration: ${data.formNo}`)
  } catch (err) {
    console.error('[Supabase] Failed to save registration:', err.message)
    // Retry once after 2 s
    setTimeout(async () => {
      try {
        const client = getClient()
        await client.from('registrations').insert({
          form_no:             data.formNo,
          submitted_at:        data.submittedDate,
          full_name:           data.fullName,
          phone_number:        data.phoneNumber,
          date_of_birth:       data.dateOfBirth,
          lga:                 data.lga,
          home_address:        data.homeAddress,
          gender:              data.gender,
          qualification:       data.qualification,
          has_security_exp:    data.hasSecurityExp,
          organization_name:   data.organizationName || null,
          membership_duration: data.membershipDuration || null,
          special_skill:       data.specialSkill || null,
          other_info:          data.otherInfo || null,
        })
        console.log(`[Supabase] Retry succeeded: ${data.formNo}`)
      } catch (retryErr) {
        console.error('[Supabase] Retry failed:', retryErr.message)
      }
    }, 2000)
  }
}

module.exports = { insertRegistration }
