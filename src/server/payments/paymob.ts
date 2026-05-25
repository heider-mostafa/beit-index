/**
 * Paymob Payment Gateway Integration
 *
 * Production-ready implementation for Egypt.
 * Documentation: https://developers.paymob.com/egypt
 */

import crypto from 'crypto';

const PAYMOB_API_BASE = 'https://accept.paymob.com/api';

interface PaymobConfig {
  apiKey: string;
  integrationId: string;
  iframeId: string;
  hmacSecret: string;
}

interface AuthResponse {
  token: string;
  profile: {
    id: number;
    user: {
      id: number;
      email: string;
    };
  };
}

interface OrderResponse {
  id: number;
  created_at: string;
  delivery_needed: boolean;
  merchant: {
    id: number;
  };
  amount_cents: number;
}

interface PaymentKeyResponse {
  token: string;
}

interface BillingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  country?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  postalCode?: string;
}

interface TransactionCallback {
  obj: {
    id: number;
    pending: boolean;
    amount_cents: number;
    success: boolean;
    is_auth: boolean;
    is_capture: boolean;
    is_standalone_payment: boolean;
    is_voided: boolean;
    is_refunded: boolean;
    is_3d_secure: boolean;
    integration_id: number;
    has_parent_transaction: boolean;
    order: {
      id: number;
    };
    created_at: string;
    currency: string;
    source_data: {
      pan: string;
      type: string;
      sub_type: string;
    };
    error_occured: boolean;
    data: {
      message?: string;
    };
  };
  type: string;
}

function getConfig(): PaymobConfig {
  const apiKey = process.env.PAYMOB_API_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const iframeId = process.env.PAYMOB_IFRAME_ID;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;

  if (!apiKey || !integrationId || !iframeId || !hmacSecret) {
    throw new Error(
      'Missing Paymob configuration. Required env vars: PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_IFRAME_ID, PAYMOB_HMAC_SECRET'
    );
  }

  return { apiKey, integrationId, iframeId, hmacSecret };
}

/**
 * Step 1: Authenticate with Paymob to get access token
 */
export async function authenticate(): Promise<string> {
  const config = getConfig();

  const response = await fetch(`${PAYMOB_API_BASE}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: config.apiKey }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob authentication failed: ${error}`);
  }

  const data: AuthResponse = await response.json();
  return data.token;
}

/**
 * Step 2: Register an order with Paymob
 */
export async function registerOrder(
  authToken: string,
  amountCents: number,
  merchantOrderId: string,
  currency: string = 'EGP'
): Promise<number> {
  const response = await fetch(`${PAYMOB_API_BASE}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: false,
      amount_cents: amountCents,
      currency,
      merchant_order_id: merchantOrderId,
      items: [],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob order registration failed: ${error}`);
  }

  const data: OrderResponse = await response.json();
  return data.id;
}

/**
 * Step 3: Generate payment key for the order
 */
export async function generatePaymentKey(
  authToken: string,
  orderId: number,
  amountCents: number,
  billingData: BillingData,
  currency: string = 'EGP'
): Promise<string> {
  const config = getConfig();

  const response = await fetch(`${PAYMOB_API_BASE}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600, // 1 hour
      order_id: orderId,
      billing_data: {
        first_name: billingData.firstName || 'N/A',
        last_name: billingData.lastName || 'N/A',
        email: billingData.email || 'na@example.com',
        phone_number: billingData.phone || '+201000000000',
        city: billingData.city || 'Cairo',
        country: billingData.country || 'EG',
        street: billingData.street || 'N/A',
        building: billingData.building || 'N/A',
        floor: billingData.floor || 'N/A',
        apartment: billingData.apartment || 'N/A',
        postal_code: billingData.postalCode || '00000',
        state: 'N/A',
        shipping_method: 'N/A',
      },
      currency,
      integration_id: parseInt(config.integrationId),
      lock_order_when_paid: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob payment key generation failed: ${error}`);
  }

  const data: PaymentKeyResponse = await response.json();
  return data.token;
}

/**
 * Get iframe URL for payment
 */
export function getIframeUrl(paymentKey: string): string {
  const config = getConfig();
  return `https://accept.paymob.com/api/acceptance/iframes/${config.iframeId}?payment_token=${paymentKey}`;
}

/**
 * Verify HMAC signature from Paymob callback
 *
 * Paymob sends HMAC in the 'hmac' query parameter for GET callbacks
 * and in the request body for POST callbacks
 */
export function verifyHmac(
  callbackData: TransactionCallback,
  receivedHmac: string
): boolean {
  const config = getConfig();
  const obj = callbackData.obj;

  // Concatenate values in the specific order Paymob expects
  // See: https://docs.paymob.com/docs/transaction-webhooks
  const concatenatedString = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    obj.order.id,
    obj.pending,
    obj.source_data.pan,
    obj.source_data.sub_type,
    obj.source_data.type,
    obj.success,
  ].join('');

  const calculatedHmac = crypto
    .createHmac('sha512', config.hmacSecret)
    .update(concatenatedString)
    .digest('hex');

  return calculatedHmac === receivedHmac;
}

/**
 * Full payment flow: authenticate, register order, get payment key
 */
export async function initiatePayment(
  amountCents: number,
  merchantOrderId: string,
  billingData: BillingData
): Promise<{
  paymobOrderId: number;
  paymentKey: string;
  iframeUrl: string;
}> {
  // Step 1: Authenticate
  const authToken = await authenticate();

  // Step 2: Register order
  const paymobOrderId = await registerOrder(authToken, amountCents, merchantOrderId);

  // Step 3: Generate payment key
  const paymentKey = await generatePaymentKey(
    authToken,
    paymobOrderId,
    amountCents,
    billingData
  );

  // Get iframe URL
  const iframeUrl = getIframeUrl(paymentKey);

  return {
    paymobOrderId,
    paymentKey,
    iframeUrl,
  };
}

/**
 * Process refund for a transaction
 */
export async function refundTransaction(
  transactionId: number,
  amountCents: number
): Promise<boolean> {
  const authToken = await authenticate();

  const response = await fetch(`${PAYMOB_API_BASE}/acceptance/void_refund/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      transaction_id: transactionId,
      amount_cents: amountCents,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob refund failed: ${error}`);
  }

  return true;
}

/**
 * Check if Paymob is properly configured
 */
export function isConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}
