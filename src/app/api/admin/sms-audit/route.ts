// See docs/twilio-sms-testing.md for Twilio sandbox/test credential usage and magic numbers reference.
// Official docs: https://www.twilio.com/docs/iam/test-credentials

const express = require('express');
const router = express.Router();
const twilio = require('twilio');

router.get('/sms/:to', async (req, res) => {
  const { to } = req.params;
  const { body } = req;

  try {
    const result = await twilio.messages.create({
      body,
      from: 'whatsapp:+1415523888',
      to
    });
    res.json(result);
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;