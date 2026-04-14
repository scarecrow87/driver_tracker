// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials
// Example usage and safe testing patterns are documented in the project README and docs/twilio-sms-testing.md

/**
 * Notification helpers for email (Microsoft Graph) and SMS (Twilio).
 * These are placeholder implementations – wire up real credentials via env vars.
 */

import { getNotificationProviderConfig, NotificationProviderConfig } from './notification-settings';

/**
 * Send an email alert using Microsoft Graph API.
 */
export async function sendEmailAlert(
  to: string,
  subject: string,
  body: string,
  configOverride?: NotificationProviderConfig
): Promise<void> {
  const config = configOverride ?? await getNotificationProviderConfig();
  const tenantId = config.emailTenantId;
  const clientId = config.emailClientId;
  const clientSecret = config.emailClientSecret;
  const from = config.emailFrom;

  if (!tenantId || !clientId || !clientSecret || !from) {
    console.log('[Email] Missing credentials, skipping email alert.');
    console.log(`[Email] Would send to: ${to}, subject: ${subject}`);
    return;
  }

  try {
    // Obtain OAuth2 token from Microsoft identity platform
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Send mail via Graph API
    await fetch(`https://graph.microsoft.com/v1.0/users/${from}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'Text', content: body },
          toRecipients: [{ emailAddress: { address: to } }],
        },
      }),
    });

    console.log(`[Email] Alert sent to ${to}`);
  } catch (err) {
    console.error('[Email] Failed to send alert:', err);
  }
}

/**
 * Send an SMS alert using Twilio.
 */
export async function sendSmsAlert(
  to: string,
  message: string,
  configOverride?: NotificationProviderConfig
): Promise<void> {
  const config = configOverride ?? await getNotificationProviderConfig();
  const accountSid = config.twilioAccountSid;
  const authToken = config.twilioAuthToken;
  const from = config.twilioFromNumber;

  if (!accountSid || !authToken || !from) {
    console.log('[SMS] Missing credentials, skipping SMS alert.');
    console.log(`[SMS] Would send to: ${to}, message: ${message}`);
    return;
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: to, From: from, Body: message }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[SMS] Twilio error:', err);
    } else {
      console.log(`[SMS] Alert sent to ${to}`);
    }
  } catch (err) {
    console.error('[SMS] Failed to send alert:', err);
  }
}
