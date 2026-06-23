import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAppBaseUrl, sendEmail } from '@/lib/email';
import { buildVendorVerificationEmail } from '@/lib/email-templates';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getRequestSession } from '@/lib/auth-session';
import { buildTenantFeatureRows } from '@/lib/features';
import { buildTermsAcceptanceSnapshot } from '@/lib/terms';
import { consumeVerifiedOtp } from '@/lib/otp-challenges';
import { hashPassword } from '@/lib/vendor-password';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/vendors/register
 * Cria um tenant isolado, o vendor e o cardapio padrao.
 * Os guarda-sois sao criados depois pelo proprio quiosque no painel.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.name || !body.owner_name || !body.owner_phone || !body.owner_email || !body.city || !body.state || !body.beach_name) {
      return NextResponse.json({
        error: 'Nome do quiosque, responsavel, telefone, email, praia, cidade e estado sao obrigatorios.',
      }, { status: 400 });
    }

    const cleanPhone = String(body.owner_phone || '').replace(/\D/g, '');
    const cleanCpf = String(body.cpf || '').replace(/\D/g, '');
    const cleanCnpj = String(body.cnpj || '').replace(/\D/g, '');
    const documentLogin = String(body.document_login || cleanCnpj || cleanCpf || cleanPhone).trim();
    const session = getRequestSession(req);
    const isAdminCreate = session?.role === 'admin';
    if (!documentLogin) {
      return NextResponse.json({ error: 'Informe telefone, CPF ou CNPJ para criar o login.' }, { status: 400 });
    }
    if (!cleanCpf && !cleanCnpj) {
      return NextResponse.json({ error: 'Informe CPF ou CNPJ para o cadastro do quiosque.' }, { status: 400 });
    }
    if (body.terms_accepted !== true) {
      return NextResponse.json({ error: 'E necessario aceitar os Termos de Uso para concluir o cadastro.' }, { status: 400 });
    }
    if (!isAdminCreate && !body.otp_challenge_id) {
      return NextResponse.json({ error: 'Valide o WhatsApp do responsavel antes de cadastrar o quiosque.' }, { status: 403 });
    }

    const duplicateFilters = [
      `document_login.eq.${documentLogin}`,
      cleanCpf ? `cpf.eq.${cleanCpf}` : '',
      cleanCnpj ? `cnpj.eq.${cleanCnpj}` : '',
    ].filter(Boolean).join(',');

    const { data: duplicateVendor, error: duplicateError } = await supabaseAdmin
      .from('vendors')
      .select('id, document_login, cpf, cnpj')
      .or(duplicateFilters)
      .maybeSingle();

    if (duplicateError) throw duplicateError;
    if (duplicateVendor) {
      return NextResponse.json({
        error: 'Ja existe um quiosque cadastrado com este CPF, CNPJ ou login. Use outro documento ou entre pelo painel do quiosque.',
      }, { status: 409 });
    }

    const initialPassword = String(body.password || '');
    const passwordConfirm = String(body.password_confirm || '');
    if (!initialPassword || !passwordConfirm) {
      return NextResponse.json({ error: 'Crie a senha e confirme a senha do quiosque.' }, { status: 400 });
    }
    if (initialPassword !== passwordConfirm) {
      return NextResponse.json({ error: 'A senha e a confirmacao de senha nao conferem.' }, { status: 400 });
    }
    if (initialPassword.length < 8) {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
    }

    const passwordHash = await hashPassword(initialPassword);
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const maxUmbrellas = 50;
    const cleanState = String(body.state).trim().toUpperCase();
    const cleanCity = String(body.city).trim();
    const cleanBeach = String(body.beach_name).trim();
    if (!isAdminCreate) {
      const otpOk = await consumeVerifiedOtp({
        challengeId: String(body.otp_challenge_id),
        phone: cleanPhone,
        purpose: 'vendor_register',
      });
      if (!otpOk) {
        return NextResponse.json({ error: 'Codigo WhatsApp nao validado para o responsavel.' }, { status: 403 });
      }
    }

    const { data: beach, error: beachError } = await (supabaseAdmin.from('beaches') as any)
      .upsert({
        name: cleanBeach,
        city: cleanCity,
        state: cleanState,
        active: true,
      }, { onConflict: 'name,city,state' })
      .select('id')
      .single();

    if (beachError && !['42P01', 'PGRST205'].includes(beachError.code)) throw beachError;
    const beachId = beachError ? null : beach?.id || null;

    const tenantPayload: Record<string, unknown> = {
      name: body.name,
      status: 'active',
      city: cleanCity,
      state: cleanState,
      beach_name: cleanBeach,
      primary_color: body.primary_color || '#ff6b00',
      secondary_color: body.secondary_color || '#82533f',
      button_color: body.button_color || body.primary_color || '#ff6b00',
      button_text_color: body.button_text_color || '#ffffff',
      logo_url: body.logo_url || '/logo-sandexpress.png',
    };
    if (beachId) tenantPayload.beach_id = beachId;

    const { data: tenant, error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .insert(tenantPayload)
      .select()
      .single();

    if (tenantError) throw tenantError;

    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const verificationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const vendorPayload: Record<string, unknown> = {
        tenant_id: tenant.id,
        name: body.name,
        owner_name: body.owner_name,
        owner_phone: body.owner_phone,
        owner_email: String(body.owner_email).trim().toLowerCase(),
        cpf: cleanCpf || null,
        cnpj: cleanCnpj || null,
        document_login: documentLogin,
        address: body.address || cleanBeach,
        city: cleanCity,
        state: cleanState,
        beach_name: cleanBeach,
        logo_url: body.logo_url || '/logo-sandexpress.png',
        primary_color: body.primary_color || '#ff6b00',
        secondary_color: body.secondary_color || '#82533f',
        button_color: body.button_color || body.primary_color || '#ff6b00',
        button_text_color: body.button_text_color || '#ffffff',
        password_hash: passwordHash,
        password_needs_reset: false,
        owner_email_verified: false,
        owner_email_verification_token: hashToken(verificationToken),
        owner_email_verification_expires_at: verificationExpiresAt,
        subscription_status: 'trial',
        plan_type: 'trial',
        trial_ends_at: trialEndsAt,
        max_umbrellas: maxUmbrellas,
        is_active: true,
      };
    if (beachId) vendorPayload.beach_id = beachId;

    const { data: vendor, error: vendorError } = await (supabaseAdmin.from('vendors') as any)
      .insert(vendorPayload)
      .select()
      .single();

    if (vendorError) throw vendorError;

    const termsAcceptance = buildTermsAcceptanceSnapshot({
      vendorId: vendor.id,
      tenantId: tenant.id,
      body,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip'),
      userAgent: req.headers.get('user-agent'),
    });
    const { error: termsError } = await supabaseAdmin
      .from('terms_acceptances')
      .insert(termsAcceptance);
    if (termsError && !['42P01', 'PGRST205', '42703'].includes(termsError.code)) throw termsError;

    const { error: featuresError } = await supabaseAdmin
      .from('tenant_features')
      .insert(buildTenantFeatureRows(tenant.id));
    if (featuresError && !['42P01', 'PGRST205'].includes(featuresError.code)) throw featuresError;

    const verificationUrl = `${getAppBaseUrl(req)}/api/vendors/verify-email?token=${encodeURIComponent(verificationToken)}`;
    const verificationEmail = buildVendorVerificationEmail({
      vendorName: vendor.name,
      ownerName: vendor.owner_name,
      login: documentLogin,
      trialEndsAt,
      verificationUrl,
    });
    const emailResult = await sendEmail({
      to: String(vendor.owner_email).trim().toLowerCase(),
      ...verificationEmail,
    });

    return NextResponse.json({
      ...vendor,
      tenant_id: tenant.id,
      document_login: documentLogin,
      email_verification: {
        sent: emailResult.ok,
        reason: emailResult.ok ? null : emailResult.reason,
        ...(process.env.NODE_ENV !== 'production' ? { verification_url: verificationUrl } : {}),
      },
      message: body.password
        ? 'Quiosque criado com senha definida pelo vendor.'
        : 'Quiosque criado.',
    }, { status: 201 });
  } catch (err) {
    console.error('Vendor register error:', err);
    return NextResponse.json({
      error: 'Erro ao gravar no Supabase. Confirme que o banco foi criado com infra/sql-iniciar-novo-projeto.sql e que as variaveis do Vercel apontam para esse projeto.',
    }, { status: 500 });
  }
}
