/**
 * sheetsService.js
 *
 * Sends registration data to a Google Sheet via an Apps Script Web App.
 * NO Google Cloud Console or service account required.
 * Just a URL you get by deploying a small script inside your Google Sheet.
 *
 * Setup instructions are in SETUP_GUIDE.md (Google Sheets section).
 */

const SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL

async function appendRow(data) {
  if (!SCRIPT_URL) {
    console.warn('[Sheets] GOOGLE_APPS_SCRIPT_URL not set — skipping sheet write')
    return
  }

  const row = {
    formNo:             data.formNo             || '',
    submittedDate:      data.submittedDate       || '',
    fullName:           data.fullName            || '',
    phoneNumber:        data.phoneNumber         || '',
    dateOfBirth:        data.dateOfBirth         || '',
    lga:                data.lga                 || '',
    homeAddress:        data.homeAddress         || '',
    gender:             data.gender              || '',
    qualification:      data.qualification       || '',
    hasSecurityExp:     data.hasSecurityExp      || '',
    organizationName:   data.organizationName    || '',
    membershipDuration: data.membershipDuration  || '',
    specialSkill:       data.specialSkill        || '',
    otherInfo:          data.otherInfo           || '',
  }

  const attempt = async () => {
    const res = await fetch(SCRIPT_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(row),
      // Apps Script sometimes redirects — follow it
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    console.log(`[Sheets] Row saved for ${data.formNo}`)
  }

  try {
    await attempt()
  } catch (err) {
    console.error('[Sheets] First attempt failed:', err.message, '— retrying in 3 s')
    setTimeout(async () => {
      try {
        await attempt()
        console.log(`[Sheets] Retry succeeded for ${data.formNo}`)
      } catch (retryErr) {
        console.error('[Sheets] Retry failed:', retryErr.message)
      }
    }, 3000)
  }
}

module.exports = { appendRow }
