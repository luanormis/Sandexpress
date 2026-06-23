# Meta WhatsApp OTP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add OTP validation through Meta WhatsApp Cloud API for SandExpress customer and kiosk-owner verification without trusting unverified phone numbers.

**Architecture:** The app will generate and store OTP challenges server-side, send approved WhatsApp authentication templates through Meta Cloud API, and only create sessions after a valid OTP is confirmed. Customer QR login and vendor registration/login will call the same OTP service, with separate purposes so audit and rate limits stay clear.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, Meta WhatsApp Cloud API, Jest.

---

## External Setup Required In Meta

Before coding, the Meta account must have:

1. A Meta Business account with WhatsApp Business Platform enabled.
2. A WhatsApp Business Account (WABA).
3. A production phone number connected to the WABA.
4. The phone number ID from WhatsApp > API Setup.
5. A permanent access token from a System User with WhatsApp permissions.
6. An approved Authentication template with OTP copy-code button.
7. Business verification or an eligible scaling path if Meta blocks authentication templates for the account.
8. A real public app URL for webhooks and QR links.

Recommended template:

```json
{
  "name": "sandexpress_otp_ptbr",
  "language": "pt_BR",
  "category": "AUTHENTICATION",
  "components": [
    { "type": "BODY", "add_security_recommendation": true },
    { "type": "FOOTER", "code_expiration_minutes": 5 },
    {
      "type": "BUTTONS",
      "buttons": [
        { "type": "OTP", "otp_type": "COPY_CODE", "text": "Copiar codigo" }
      ]
    }
  ]
}
```

Required environment variables:

```bash
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v25.0
META_WHATSAPP_OTP_TEMPLATE_NAME=sandexpress_otp_ptbr
META_WHATSAPP_OTP_TEMPLATE_LANGUAGE=pt_BR
OTP_PEPPER=
OTP_TTL_SECONDS=300
```

---

## File Structure

- Create `src/lib/otp.ts`: generate OTP codes, hash OTP codes, normalize Brazilian phones, validate expiry and attempts.
- Create `src/lib/meta-whatsapp.ts`: send WhatsApp authentication template messages using Meta Cloud API.
- Create `src/app/api/otp/send/route.ts`: create challenge and send OTP.
- Create `src/app/api/otp/verify/route.ts`: validate challenge and issue/allow the next session action.
- Modify `infra/sql-iniciar-novo-projeto.sql`: add `otp_challenges` and indexes/RLS.
- Modify `src/app/api/customers/login/route.ts`: require verified OTP before opening customer session.
- Modify `src/app/api/vendors/register/route.ts`: optionally verify owner phone before completing registration.
- Modify `src/app/api/auth/vendor/route.ts`: optionally require OTP after password for owner login.
- Modify customer and vendor pages to add the "enviar codigo" and "validar codigo" screens.
- Add tests in `src/lib/otp.test.ts` and `src/lib/meta-whatsapp.test.ts`.

---

### Task 1: OTP Core Helpers

**Files:**
- Create: `src/lib/otp.ts`
- Test: `src/lib/otp.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import {
  generateOtpCode,
  hashOtpCode,
  normalizeBrazilPhoneE164,
  verifyOtpHash,
} from './otp';

describe('otp helpers', () => {
  it('normalizes Brazilian mobile phones to E.164', () => {
    expect(normalizeBrazilPhoneE164('(11) 99999-9999')).toBe('+5511999999999');
    expect(normalizeBrazilPhoneE164('5511999999999')).toBe('+5511999999999');
  });

  it('rejects invalid phone numbers', () => {
    expect(() => normalizeBrazilPhoneE164('123')).toThrow('Telefone invalido');
  });

  it('generates a six digit numeric code', () => {
    expect(generateOtpCode()).toMatch(/^[0-9]{6}$/);
  });

  it('hashes and verifies a code without storing the raw OTP', () => {
    const hash = hashOtpCode('123456', 'pepper-real');
    expect(hash).not.toContain('123456');
    expect(verifyOtpHash('123456', hash, 'pepper-real')).toBe(true);
    expect(verifyOtpHash('000000', hash, 'pepper-real')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --runTestsByPath src/lib/otp.test.ts
```

Expected: FAIL because `src/lib/otp.ts` does not exist.

- [ ] **Step 3: Implement minimal helper**

```ts
import crypto from 'crypto';

export function normalizeBrazilPhoneE164(input: string) {
  const digits = String(input || '').replace(/\D/g, '');
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  if (!/^55\d{10,11}$/.test(withCountry)) {
    throw new Error('Telefone invalido para envio de OTP.');
  }
  return `+${withCountry}`;
}

export function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

export function hashOtpCode(code: string, pepper: string) {
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export function verifyOtpHash(code: string, expectedHash: string, pepper: string) {
  const actual = Buffer.from(hashOtpCode(code, pepper), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- --runTestsByPath src/lib/otp.test.ts
```

Expected: PASS.

---

### Task 2: Database Schema

**Files:**
- Modify: `infra/sql-iniciar-novo-projeto.sql`

- [ ] **Step 1: Add table after `rate_limit_buckets`**

```sql
CREATE TABLE otp_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  purpose TEXT NOT NULL
    CHECK (purpose IN ('customer_login','vendor_register','vendor_login','password_reset')),
  code_hash TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meta_whatsapp',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verified','expired','blocked')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_ip TEXT,
  created_user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_otp_challenges_phone_purpose_created
  ON otp_challenges(phone_e164, purpose, created_at DESC);

CREATE INDEX idx_otp_challenges_vendor_created
  ON otp_challenges(vendor_id, created_at DESC);

CREATE TRIGGER trg_otp_challenges_updated_at BEFORE UPDATE ON otp_challenges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE otp_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_only_otp_challenges ON otp_challenges FOR ALL USING (FALSE) WITH CHECK (FALSE);
```

- [ ] **Step 2: Add grants and analyze**

Add:

```sql
ANALYZE otp_challenges;
```

No public `anon` access is needed because API routes use `SUPABASE_SERVICE_ROLE_KEY`.

---

### Task 3: Meta WhatsApp Sender

**Files:**
- Create: `src/lib/meta-whatsapp.ts`
- Test: `src/lib/meta-whatsapp.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { buildMetaOtpTemplatePayload } from './meta-whatsapp';

describe('meta whatsapp otp payload', () => {
  it('builds an authentication template payload with copy code button', () => {
    expect(buildMetaOtpTemplatePayload({
      to: '+5511999999999',
      templateName: 'sandexpress_otp_ptbr',
      language: 'pt_BR',
      code: '123456',
    })).toEqual({
      messaging_product: 'whatsapp',
      to: '+5511999999999',
      type: 'template',
      template: {
        name: 'sandexpress_otp_ptbr',
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: '123456' }],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: '123456' }],
          },
        ],
      },
    });
  });
});
```

- [ ] **Step 2: Implement payload and send function**

```ts
type OtpPayloadInput = {
  to: string;
  templateName: string;
  language: string;
  code: string;
};

export function buildMetaOtpTemplatePayload(input: OtpPayloadInput) {
  return {
    messaging_product: 'whatsapp',
    to: input.to,
    type: 'template',
    template: {
      name: input.templateName,
      language: { code: input.language },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: input.code }],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: input.code }],
        },
      ],
    },
  };
}

export async function sendMetaOtp(input: OtpPayloadInput) {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !token) {
    throw new Error('Meta WhatsApp nao configurado.');
  }

  const graphVersion = process.env.META_GRAPH_API_VERSION || 'v25.0';
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildMetaOtpTemplatePayload(input)),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Erro ao enviar OTP pela Meta.');
  }
  return data;
}
```

Note: During implementation, verify the exact button `sub_type` required by the approved template in the current Meta API. If Meta returns a component mismatch, adjust this helper only.

---

### Task 4: Send OTP API

**Files:**
- Create: `src/app/api/otp/send/route.ts`

- [ ] **Step 1: Implement route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateOtpCode, hashOtpCode, normalizeBrazilPhoneE164 } from '@/lib/otp';
import { sendMetaOtp } from '@/lib/meta-whatsapp';
import { isRateLimited } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'otp-send', 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const body = await req.json();
    const phoneE164 = normalizeBrazilPhoneE164(body.phone);
    const purpose = String(body.purpose || '');
    if (!['customer_login','vendor_register','vendor_login','password_reset'].includes(purpose)) {
      return NextResponse.json({ error: 'Finalidade de OTP invalida.' }, { status: 400 });
    }

    const code = generateOtpCode();
    const ttl = Number(process.env.OTP_TTL_SECONDS || 300);
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const pepper = process.env.OTP_PEPPER;
    if (!pepper || pepper.length < 32) {
      return NextResponse.json({ error: 'OTP_PEPPER nao configurado.' }, { status: 500 });
    }

    const meta = await sendMetaOtp({
      to: phoneE164,
      templateName: process.env.META_WHATSAPP_OTP_TEMPLATE_NAME || 'sandexpress_otp_ptbr',
      language: process.env.META_WHATSAPP_OTP_TEMPLATE_LANGUAGE || 'pt_BR',
      code,
    });

    const { data, error } = await supabaseAdmin
      .from('otp_challenges')
      .insert({
        tenant_id: body.tenant_id || null,
        vendor_id: body.vendor_id || null,
        phone_e164: phoneE164,
        purpose,
        code_hash: hashOtpCode(code, pepper),
        provider_message_id: meta?.messages?.[0]?.id || null,
        expires_at: expiresAt,
        created_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
        created_user_agent: req.headers.get('user-agent'),
      } as any)
      .select('id, expires_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ challenge_id: data.id, expires_at: data.expires_at });
  } catch (err) {
    console.error('OTP send error:', err);
    return NextResponse.json({ error: 'Nao foi possivel enviar o codigo.' }, { status: 500 });
  }
}
```

---

### Task 5: Verify OTP API

**Files:**
- Create: `src/app/api/otp/verify/route.ts`

- [ ] **Step 1: Implement route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyOtpHash } from '@/lib/otp';
import { isRateLimited } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'otp-verify', 10, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

    const { challenge_id, code } = await req.json();
    if (!challenge_id || !code) {
      return NextResponse.json({ error: 'challenge_id e code sao obrigatorios.' }, { status: 400 });
    }

    const { data: challenge, error } = await supabaseAdmin
      .from('otp_challenges')
      .select('*')
      .eq('id', challenge_id)
      .single();
    if (error || !challenge) {
      return NextResponse.json({ error: 'Codigo invalido.' }, { status: 400 });
    }
    if (challenge.status !== 'pending' || new Date(challenge.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Codigo expirado.' }, { status: 400 });
    }
    if (Number(challenge.attempts || 0) >= 5) {
      await supabaseAdmin.from('otp_challenges').update({ status: 'blocked' }).eq('id', challenge_id);
      return NextResponse.json({ error: 'Codigo bloqueado por tentativas.' }, { status: 429 });
    }

    const pepper = process.env.OTP_PEPPER;
    if (!pepper || pepper.length < 32) {
      return NextResponse.json({ error: 'OTP_PEPPER nao configurado.' }, { status: 500 });
    }

    const ok = verifyOtpHash(String(code), challenge.code_hash, pepper);
    if (!ok) {
      await supabaseAdmin
        .from('otp_challenges')
        .update({ attempts: Number(challenge.attempts || 0) + 1 })
        .eq('id', challenge_id);
      return NextResponse.json({ error: 'Codigo invalido.' }, { status: 400 });
    }

    await supabaseAdmin
      .from('otp_challenges')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', challenge_id);

    return NextResponse.json({
      ok: true,
      phone_e164: challenge.phone_e164,
      purpose: challenge.purpose,
      vendor_id: challenge.vendor_id,
      tenant_id: challenge.tenant_id,
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    return NextResponse.json({ error: 'Nao foi possivel validar o codigo.' }, { status: 500 });
  }
}
```

---

### Task 6: Wire Customer QR Login

**Files:**
- Modify: `src/app/(customer)/u/[vendor_id]/page.tsx`
- Modify: `src/app/api/customers/login/route.ts`

- [ ] **Step 1: UI flow**

Change customer login from one submit to two phases:

1. Customer enters name and phone.
2. Frontend calls `/api/otp/send` with `{ purpose: 'customer_login', phone, vendor_id }`.
3. Customer enters OTP.
4. Frontend calls `/api/otp/verify`.
5. Only after success, frontend calls `/api/customers/login` with `otp_challenge_id`.

- [ ] **Step 2: Server enforcement**

In `/api/customers/login`, require a verified challenge for the same phone and vendor:

```ts
const { otp_challenge_id } = await req.json();
const { data: challenge } = await supabaseAdmin
  .from('otp_challenges')
  .select('phone_e164, vendor_id, purpose, status')
  .eq('id', otp_challenge_id)
  .single();

if (
  !challenge ||
  challenge.status !== 'verified' ||
  challenge.purpose !== 'customer_login' ||
  challenge.vendor_id !== vendor_id ||
  challenge.phone_e164 !== `+55${cleanPhone}`
) {
  return NextResponse.json({ error: 'Telefone nao validado por OTP.' }, { status: 403 });
}
```

---

### Task 7: Wire Vendor Register And Login

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/(vendor)/vendor/login/page.tsx`
- Modify: `src/app/api/vendors/register/route.ts`
- Modify: `src/app/api/auth/vendor/route.ts`

- [ ] **Step 1: Vendor registration**

Before creating a kiosk, send OTP to `owner_phone` with `purpose: 'vendor_register'`.

After verification, submit registration with `otp_challenge_id`.

In `vendors/register`, require verified OTP:

```ts
const { data: challenge } = await supabaseAdmin
  .from('otp_challenges')
  .select('phone_e164, purpose, status')
  .eq('id', body.otp_challenge_id)
  .single();

if (
  !challenge ||
  challenge.status !== 'verified' ||
  challenge.purpose !== 'vendor_register' ||
  challenge.phone_e164 !== `+55${cleanPhone}`
) {
  return NextResponse.json({ error: 'Telefone do responsavel nao validado por OTP.' }, { status: 403 });
}
```

- [ ] **Step 2: Vendor login**

Keep password as the first factor. After password is valid, if feature flag `vendor_login_otp` is enabled, return:

```json
{
  "requires_otp": true,
  "vendor_id": "..."
}
```

Then the frontend sends OTP and verifies. After verification, call a new `/api/auth/vendor/otp-complete` route to issue the `vendor_session`.

---

### Task 8: Verification And Deployment

**Files:**
- Modify: `README.md`
- Modify: `env.production.example`
- Modify: `env.staging.example`

- [ ] **Step 1: Add environment docs**

Document:

```bash
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
META_GRAPH_API_VERSION=v25.0
META_WHATSAPP_OTP_TEMPLATE_NAME=sandexpress_otp_ptbr
META_WHATSAPP_OTP_TEMPLATE_LANGUAGE=pt_BR
OTP_PEPPER=
OTP_TTL_SECONDS=300
```

- [ ] **Step 2: Run tests**

Run:

```bash
npm test -- --runTestsByPath src/lib/otp.test.ts src/lib/meta-whatsapp.test.ts
npm run build
```

Expected: both pass.

- [ ] **Step 3: Manual test checklist**

1. Send customer OTP to a real WhatsApp number.
2. Enter wrong code and confirm rejection.
3. Enter correct code and confirm customer session opens.
4. Try to reuse same challenge and confirm it fails or stays single-use.
5. Register kiosk with unverified phone and confirm rejection.
6. Register kiosk after OTP and confirm success.
7. Confirm Meta dashboard shows delivered message and no template quality warning.

---

## Implementation Order

1. Meta account/template setup.
2. Database table.
3. OTP helper tests and code.
4. Meta sender tests and code.
5. `/api/otp/send`.
6. `/api/otp/verify`.
7. Customer login enforcement.
8. Vendor registration enforcement.
9. Optional vendor login 2FA.
10. Docs, examples, build, manual test.
