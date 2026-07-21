const crypto = require("crypto");

const PRO_PRICE_ILS = 10;
let firebaseAccessTokenCache = null;

function billingConfig() {
  const sandbox = String(process.env.PAYPLUS_SANDBOX || "true").toLowerCase() !== "false";
  const apiKey = process.env.PAYPLUS_API_KEY?.trim();
  const secretKey = process.env.PAYPLUS_SECRET_KEY?.trim();
  const paymentPageUid = process.env.PAYPLUS_PAYMENT_PAGE_UID?.trim();
  const terminalUid = process.env.PAYPLUS_TERMINAL_UID?.trim();
  const referenceSecret = process.env.PAYPLUS_REFERENCE_SECRET?.trim() || secretKey;
  const appBaseUrl = (process.env.APP_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
  return {
    sandbox, apiKey, secretKey, paymentPageUid, terminalUid, referenceSecret, appBaseUrl,
    apiBase: sandbox ? "https://restapidev.payplus.co.il/api/v1.0" : "https://restapi.payplus.co.il/api/v1.0",
    ready: Boolean(apiKey && secretKey && paymentPageUid && referenceSecret)
  };
}

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function createReference(user, config) {
  const payload = base64Url(JSON.stringify({ uid: user.uid, email: user.email || "", planId: "pro", issuedAt: Date.now() }));
  const signature = crypto.createHmac("sha256", config.referenceSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function parseReference(reference, config) {
  const [payload, signature] = String(reference || "").split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", config.referenceSecret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.uid || parsed.planId !== "pro" || Date.now() - Number(parsed.issuedAt) > 24 * 60 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

function verifyPayPlusHash(body, headers, secretKey) {
  const suppliedHash = String(headers.hash || "");
  if (String(headers["user-agent"] || "").toLowerCase() !== "payplus" || !suppliedHash) return false;
  const expected = crypto.createHmac("sha256", secretKey).update(JSON.stringify(body || {})).digest("base64");
  const suppliedBuffer = Buffer.from(suppliedHash);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function payPlusRequest(path, { method = "POST", body } = {}) {
  const config = billingConfig();
  if (!config.ready) throw Object.assign(new Error("PAYPLUS_NOT_CONFIGURED"), { status: 503 });
  const response = await fetch(`${config.apiBase}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": config.apiKey, "secret-key": config.secretKey },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.results?.status === "error") {
    const error = new Error(data?.results?.description || data?.message || "PayPlus request failed");
    error.status = 502;
    error.details = data;
    throw error;
  }
  return data;
}

function nextMonthDate() {
  const date = new Date();
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

async function createCheckout(user, language = "en") {
  const config = billingConfig();
  if (!config.ready) throw Object.assign(new Error("PAYPLUS_NOT_CONFIGURED"), { status: 503 });
  const reference = createReference(user, config);
  const body = {
    payment_page_uid: config.paymentPageUid,
    charge_method: 3,
    amount: PRO_PRICE_ILS,
    currency_code: "ILS",
    language_code: language === "he" ? "he" : "en",
    sendEmailApproval: true,
    sendEmailFailure: true,
    send_failure_callback: false,
    create_token: true,
    refURL_success: `${config.appBaseUrl}/billing-result.html?result=success`,
    refURL_failure: `${config.appBaseUrl}/billing-result.html?result=failure`,
    refURL_cancel: `${config.appBaseUrl}/billing-result.html?result=cancelled`,
    refURL_callback: `${config.appBaseUrl}/api/billing/payplus/callback`,
    more_info: reference,
    customer: { customer_name: user.email || "FuelPhysique customer", email: user.email || "" },
    items: [{ name: "FuelPhysique Pro - Monthly", quantity: 1, price: PRO_PRICE_ILS }],
    recurring_settings: {
      recurring_type: 2,
      recurring_range: 1,
      number_of_charges: 0,
      start_date: nextMonthDate()
    }
  };
  if (config.terminalUid) body.terminal_uid = config.terminalUid;
  const response = await payPlusRequest("/PaymentPages/generateLink", { body });
  const checkoutUrl = response?.data?.payment_page_link;
  if (!checkoutUrl) throw Object.assign(new Error("PayPlus did not return a checkout URL"), { status: 502 });
  return { checkoutUrl, checkoutId: response.data.page_request_uid || null };
}

function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw Object.assign(new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing"), { status: 503 });
  try {
    const parsed = JSON.parse(raw);
    parsed.private_key = String(parsed.private_key || "").replace(/\\n/g, "\n");
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) throw new Error("Incomplete service account");
    return parsed;
  } catch (error) {
    throw Object.assign(new Error(`Invalid Firebase service account: ${error.message}`), { status: 503 });
  }
}

async function firebaseAccessToken() {
  if (firebaseAccessTokenCache?.expiresAt > Date.now() + 60000) return firebaseAccessTokenCache.token;
  const account = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({ iss: account.client_email, sub: account.client_email, aud: "https://oauth2.googleapis.com/token", scope: "https://www.googleapis.com/auth/datastore", iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), account.private_key).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw Object.assign(new Error("Could not authenticate Firebase service account"), { status: 502 });
  firebaseAccessTokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return data.access_token;
}

async function updateSubscription(uid, subscription) {
  if (!/^[a-zA-Z0-9_-]{5,128}$/.test(uid)) throw Object.assign(new Error("Invalid Firebase user ID"), { status: 400 });
  const account = serviceAccount();
  const token = await firebaseAccessToken();
  const url = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/databases/(default)/documents/users/${encodeURIComponent(uid)}`);
  url.searchParams.append("updateMask.fieldPaths", "subscription");
  const fields = {
    planId: { stringValue: subscription.planId }, status: { stringValue: subscription.status }, provider: { stringValue: "payplus" },
    providerSubscriptionId: { stringValue: String(subscription.providerSubscriptionId || "") },
    providerTransactionId: { stringValue: String(subscription.providerTransactionId || "") },
    cancelAtPeriodEnd: { booleanValue: Boolean(subscription.cancelAtPeriodEnd) },
    updatedAt: { timestampValue: new Date().toISOString() }
  };
  const response = await fetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ fields: { subscription: { mapValue: { fields } } } }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Object.assign(new Error(`Firestore subscription update failed: ${response.status}`), { status: 502 });
}

function findValue(source, keys) {
  for (const key of keys) if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  for (const value of Object.values(source || {})) if (value && typeof value === "object") { const found = findValue(value, keys); if (found !== undefined) return found; }
  return undefined;
}

async function handleCallback(body, headers) {
  const config = billingConfig();
  if (!config.ready || !verifyPayPlusHash(body, headers, config.secretKey)) throw Object.assign(new Error("Invalid PayPlus callback signature"), { status: 401 });
  const reference = findValue(body, ["more_info", "moreInfo"]);
  const userReference = parseReference(reference, config);
  if (!userReference) throw Object.assign(new Error("Invalid or expired billing reference"), { status: 400 });
  await updateSubscription(userReference.uid, {
    planId: "pro", status: "active", cancelAtPeriodEnd: false,
    providerSubscriptionId: findValue(body, ["recurring_payment_uid", "recurring_uid", "recurringPaymentUid"]),
    providerTransactionId: findValue(body, ["transaction_uid", "transactionUid", "payment_request_uid"])
  });
  return { uid: userReference.uid };
}

module.exports = { PRO_PRICE_ILS, billingConfig, createCheckout, handleCallback, verifyPayPlusHash };
