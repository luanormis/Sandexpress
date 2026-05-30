const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

function uniqueDigits(length) {
  const value = String(Date.now()).slice(-length).padStart(length, '0');
  return value;
}

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function readSetCookies(headers) {
  const raw = headers.get('set-cookie');
  if (!raw) return {};
  return Object.fromEntries(
    raw.split(/,(?=\s*[^;=]+=[^;]+)/)
      .map((cookie) => cookie.split(';')[0].trim().split('='))
      .filter(([key, value]) => key && value)
  );
}

async function request(path, options = {}, cookies = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
      ...options.headers,
    },
  });
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed ${res.status}: ${JSON.stringify(body)}`);
  }
  return { body, cookies: readSetCookies(res.headers), status: res.status };
}

async function main() {
  const suffix = uniqueDigits(8);
  const documentLogin = `55${suffix}`;
  const phone = `119${suffix}`;
  const vendorPassword = `Teste${suffix}!`;

  const registered = await request('/api/vendors/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `E2E Quiosque ${suffix}`,
      owner_name: 'Teste E2E',
      owner_phone: phone,
      owner_email: `e2e-${suffix}@sandexpress.local`,
      document_login: documentLogin,
      password: vendorPassword,
      city: 'Santos',
      state: 'SP',
    }),
  });

  const vendorId = registered.body.id;
  if (!vendorId) throw new Error('Vendor registration did not return id.');

  const vendorLogin = await request('/api/auth/vendor', {
    method: 'POST',
    body: JSON.stringify({ document_login: documentLogin, password: vendorPassword }),
  });
  const vendorCookies = vendorLogin.cookies;

  const product = await request('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendorId,
      category: 'Bebidas',
      name: `Agua E2E ${suffix}`,
      description: 'Produto criado pelo teste ponta a ponta',
      price: 7,
      active: true,
      stock_quantity: 10,
      blocked_by_stock: false,
    }),
  }, vendorCookies);

  const umbrella = await request('/api/umbrellas', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, number: 1, label: `Guarda-sol E2E ${suffix}` }),
  }, vendorCookies);

  const qr = await request(`/api/qr?umbrella_id=${umbrella.body.id}&number=1&format=png&base_url=${encodeURIComponent(baseUrl)}`, {}, vendorCookies);
  if (qr.body.target_url !== `${baseUrl}/u/${umbrella.body.id}`) {
    throw new Error(`QR target mismatch: ${qr.body.target_url}`);
  }

  const publicMenu = await request(`/api/public/umbrella/${umbrella.body.id}`);
  if (publicMenu.body.vendor.id !== vendorId) throw new Error('Public menu vendor mismatch.');
  if (!publicMenu.body.products.some((item) => item.id === product.body.id)) {
    throw new Error('Public menu did not include created product.');
  }

  const otp = await request('/api/customers/request-otp', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, phone }),
  });
  const otpCode = otp.body.dev_hint || '000000';

  const customerLogin = await request('/api/customers/login', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, name: 'Cliente E2E', phone, otp_code: otpCode }),
  });
  const customerCookies = customerLogin.cookies;
  const customerId = customerLogin.body.id;

  const order = await request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      vendor_id: vendorId,
      customer_id: customerId,
      umbrella_id: umbrella.body.id,
      items: [{ product_id: product.body.id, quantity: 2 }],
      notes: 'Teste E2E',
    }),
  }, customerCookies);

  const vendorOrders = await request(`/api/orders?vendor_id=${vendorId}`, {}, vendorCookies);
  if (!vendorOrders.body.some((item) => item.id === order.body.id)) {
    throw new Error('Vendor panel did not receive customer order.');
  }

  await request(`/api/orders/${order.body.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'preparing' }),
  }, vendorCookies);

  const preview = await request(`/api/close-account?vendor_id=${vendorId}&umbrella_id=${umbrella.body.id}`, {}, vendorCookies);
  if (Number(preview.body.total) !== 14) throw new Error(`Unexpected account total: ${preview.body.total}`);

  const closed = await request('/api/close-account', {
    method: 'POST',
    body: JSON.stringify({ vendor_id: vendorId, umbrella_id: umbrella.body.id, payment_method: 'cash' }),
  }, vendorCookies);
  if (!closed.body.account?.umbrella_released) throw new Error('Close account did not release umbrella.');

  const umbrellas = await request(`/api/umbrellas?vendor_id=${vendorId}`, {}, vendorCookies);
  const released = umbrellas.body.find((item) => item.id === umbrella.body.id);
  if (!released || released.is_occupied) throw new Error('Umbrella is still occupied after close account.');

  console.log(JSON.stringify({
    ok: true,
    vendorId,
    umbrellaId: umbrella.body.id,
    qrTarget: qr.body.target_url,
    orderId: order.body.id,
    totalClosed: closed.body.account.total,
    umbrellaReleased: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
