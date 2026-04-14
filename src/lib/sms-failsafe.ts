// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

// Centralized SMS failsafe config for inbound driver SMS actions

export const MAX_SMS_ACTIONS_PER_DAY = 4; // Default: 4 per driver per day

// Optionally, make this configurable via env or settings in the future
