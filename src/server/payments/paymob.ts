/**
 * Paymob Payment Gateway Integration — Intention API / Unified Checkout (Egypt)
 *
 * Flow:
 *   1. createIntention() -> POST /v1/intention/ with `Authorization: Token <secret>`
 *      returns { id, client_secret }
 *   2. getCheckoutUrl(clientSecret) -> /unifiedcheckout/?publicKey=<pk>&clientSecret=<cs>
 *   3. Customer pays on the hosted checkout; Paymob calls our notification_url
 *      (webhook) and redirects to redirection_url. verifyHmac() validates both.
 *
 * Docs: https://developers.paymob.com/egypt
 */

import crypto from 'crypto';

const PAYMOB_BASE = 'https://accept.paymob.com';

interface PaymobConfig {
  secretKey: string;
  publicKey: string;
  integrationId: string;
  hmacSecret: string;
}

export interface BillingData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  country?: string;
  state?: string;
  street?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  postalCode?: string;
}

export interface TransactionCallback {
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
      merchant_order_id?: string;
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
  const secretKey = process.env.PAYMOB_SECRET_KEY;
  const publicKey = process.env.PAYMOB_PUBLIC_KEY;
  const integrationId = process.env.PAYMOB_INTEGRATION_ID;
  const hmacSecret = process.env.PAYMOB_HMAC_SECRET;

  if (!secretKey || !publicKey || !integrationId || !hmacSecret) {
    throw new Error(
      'Missing Paymob configuration. Required env vars: PAYMOB_SECRET_KEY, PAYMOB_PUBLIC_KEY, PAYMOB_INTEGRATION_ID, PAYMOB_HMAC_SECRET'
    );
  }

  return { secretKey, publicKey, integrationId, hmacSecret };
}

interface InitiateOptions {
  currency?: string;
  items?: Array<{ name: string; amount: number; description?: string; quantity?: number }>;
  customer?: { firstName: string; lastName: string; email: string };
  notificationUrl?: string;
  redirectionUrl?: string;
}

/**
 * Create a payment intention. `merchantOrderId` is our own unique reference
 * (e.g. the payment/purchase row id) — Paymob echoes it back on the webhook as
 * obj.order.merchant_order_id, which is how we match the callback to our record.
 */
export async function createIntention(
  amountCents: number,
  merchantOrderId: string,
  billingData: BillingData,
  options: InitiateOptions = {}
): Promise<{ intentionId: string; clientSecret: string }> {
  const config = getConfig();

  const billing = {
    first_name: billingData.firstName || 'NA',
    last_name: billingData.lastName || 'NA',
    email: billingData.email || 'na@example.com',
    phone_number: billingData.phone || '+201000000000',
    city: billingData.city || 'Cairo',
    country: billingData.country || 'EG',
    state: billingData.state || 'NA',
    street: billingData.street || 'NA',
    building: billingData.building || 'NA',
    floor: billingData.floor || 'NA',
    apartment: billingData.apartment || 'NA',
  };

  const items =
    options.items && options.items.length > 0
      ? options.items.map((i) => ({
          name: i.name,
          amount: i.amount,
          description: i.description || i.name,
          quantity: i.quantity || 1,
        }))
      : [{ name: 'Beit Index', amount: amountCents, description: 'Beit Index payment', quantity: 1 }];

  const body: Record<string, unknown> = {
    amount: amountCents,
    currency: options.currency || 'EGP',
    payment_methods: [parseInt(config.integrationId, 10)],
    special_reference: merchantOrderId,
    items,
    billing_data: billing,
  };
  if (options.customer) {
    body.customer = {
      first_name: options.customer.firstName,
      last_name: options.customer.lastName,
      email: options.customer.email,
    };
  }
  if (options.notificationUrl) body.notification_url = options.notificationUrl;
  if (options.redirectionUrl) body.redirection_url = options.redirectionUrl;

  const response = await fetch(`${PAYMOB_BASE}/v1/intention/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${config.secretKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Paymob intention creation failed: ${error}`);
  }

  const data = await response.json();
  return { intentionId: String(data.id), clientSecret: data.client_secret };
}

/**
 * Build the Unified Checkout URL the customer is redirected to.
 */
export function getCheckoutUrl(clientSecret: string): string {
  const config = getConfig();
  return `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${config.publicKey}&clientSecret=${clientSecret}`;
}

/**
 * Full payment flow: create an intention and return the checkout URL.
 */
export async function initiatePayment(
  amountCents: number,
  merchantOrderId: string,
  billingData: BillingData,
  options: InitiateOptions = {}
): Promise<{ intentionId: string; clientSecret: string; checkoutUrl: string }> {
  const { intentionId, clientSecret } = await createIntention(
    amountCents,
    merchantOrderId,
    billingData,
    options
  );
  return { intentionId, clientSecret, checkoutUrl: getCheckoutUrl(clientSecret) };
}

/**
 * Verify the HMAC signature Paymob sends with webhooks/redirects.
 * Paymob sends the HMAC in the `hmac` query parameter; the body (or query for
 * the redirect) carries the transaction object whose fields are concatenated in
 * a fixed order and HMAC-SHA512'd with the merchant HMAC secret.
 */
export function verifyHmac(callbackData: TransactionCallback, receivedHmac: string): boolean {
  const config = getConfig();
  const obj = callbackData.obj;

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
 * Process a refund for a transaction. Uses the secret key for authentication.
 */
export async function refundTransaction(transactionId: number, amountCents: number): Promise<boolean> {
  const config = getConfig();

  const response = await fetch(`${PAYMOB_BASE}/api/acceptance/void_refund/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${config.secretKey}`,
    },
    body: JSON.stringify({
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
 * Whether Paymob is configured (used to gate payment endpoints).
 */
export function isConfigured(): boolean {
  try {
    getConfig();
    return true;
  } catch {
    return false;
  }
}
