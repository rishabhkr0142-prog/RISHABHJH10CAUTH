/**
 * Example Discord Bot Integration for RISHABH JH10C AUTH Seller Key System
 *
 * Requirements:
 * npm install discord.js
 *
 * Environment Configuration (.env):
 * AUTH_API_URL=https://your-domain.com
 * SELLER_KEY=jh10c_seller_your_key_here
 */

// Example function to verify Seller Key validity
async function verifySellerKey(apiUrl, sellerKey) {
  const response = await fetch(`${apiUrl}/api/seller/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sellerKey}`
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to authenticate seller key');
  }

  return data;
}

// Example function to generate licenses from Discord Bot
async function generateBotLicense({
  apiUrl,
  sellerKey,
  subscription = 'default',
  mask = 'XXXX-XXXX-XXXX',
  amount = 1,
  subscriptionLength = 30,
  characterSet = { lowercase: true, uppercase: true, numbers: true },
  note = 'Discord Bot Generated',
  allowedDevices = 1
}) {
  const response = await fetch(`${apiUrl}/api/seller/licenses/generate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sellerKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      subscription,
      mask,
      amount,
      subscriptionLength,
      characterSet,
      note,
      allowedDevices
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'License generation failed');
  }

  // Returns { success: true, applicationId: '...', licenses: [ { licenseKey, subscription, expiresAt } ] }
  return data;
}

export { verifySellerKey, generateBotLicense };
