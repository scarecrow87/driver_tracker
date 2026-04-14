# Twilio SMS Sandbox & Test Credentials

## Overview
Twilio provides test credentials and magic phone numbers to help you safely test SMS integration without incurring charges or sending real messages.

## How to Use
- **Find your test credentials:**
  - Log in to the Twilio Console > API Keys & Tokens > Test credentials.
  - Use the test Account SID and Auth Token in your app or API requests.
- **Magic numbers:**
  - Use special phone numbers to simulate different outcomes:
    - `+15005550006` (From): Always passes validation.
    - `+15005550001` (To): Simulates an invalid number.
    - See the [Magic Numbers Reference](https://www.twilio.com/docs/iam/test-credentials#test-sending-an-sms) for more.
- **Limitations:**
  - Test credentials only work with certain endpoints (Messages, Calls, IncomingPhoneNumbers, Lookup).
  - No real SMS is sent, and no status callbacks are triggered.
  - You cannot use live account phone numbers as `From` with test credentials.

## Useful Links
- [Twilio Test Credentials](https://www.twilio.com/docs/iam/test-credentials)
- [SMS Quickstart](https://www.twilio.com/docs/messaging/quickstart)
- [Magic Numbers Reference](https://www.twilio.com/docs/iam/test-credentials#test-sending-an-sms)

## Example
```js
const twilio = require('twilio');
const client = twilio('YOUR_TEST_ACCOUNT_SID', 'YOUR_TEST_AUTH_TOKEN');

client.messages.create({
  body: 'Test message',
  from: '+15005550006', // Magic From number
  to: '+15558675310',   // Any valid number
}).then(message => console.log(message.sid));
```

---
This file documents how to safely test SMS integration with Twilio in this project.
