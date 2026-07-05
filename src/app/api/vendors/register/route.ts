import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import { buildVendorRegistrationConfirmationEmail } from '@/lib/email-templates';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantFeatureRows } from '@/lib/features';
import { buildTermsAcceptanceSnapshot } from '@/lib/terms';
import { isRateLimited } from '@/lib/rate-limit';
import { hashPassword } from '@/lib/vendor-password';
import { getPlatformPlanSettings } from '@/lib/platform-plans';
import { seedDefaultMenuForVendor } from '@/lib/default-menu-products';

function safeText(value: unknown, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

/**
 * POST /api/vendors/register
 * Cria um tenant isolado, o vendor e o cardapio padrao.
 * Os guarda-sois sao criados depois pelo proprio quiosque no painel.
 */
export async function POST(req: NextRequest) {
  try {
    if (await isRateLimited(req, 'vendor-register', 5, 30 * 60 * 1000)) {
      return NextResponse.json({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, { status: 429 });
    }

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
    if (!documentLogin) {
      return NextResponse.json({ error: 'Informe telefone, CPF ou CNPJ para criar o login.' }, { status: 400 });
    }
    if (!cleanCpf && !cleanCnpj) {
      return NextResponse.json({ error: 'Informe CPF ou CNPJ para o cadastro do quiosque.' }, { status: 400 });
    }
    if (body.terms_accepted !== true) {
      return NextResponse.json({ error: 'E necessario aceitar os Termos de Uso e a Politica de Privacidade para concluir o cadastro.' }, { status: 400 });
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
    const planSettings = await getPlatformPlanSettings();
    const trialEndsAt = new Date(Date.now() + planSettings.trial_days * 24 * 60 * 60 * 1000).toISOString();
    const maxUmbrellas = planSettings.max_umbrellas;
    const cleanState = safeText(body.state, 40).toUpperCase();
    const cleanCity = safeText(body.city, 80);
    const cleanBeach = safeText(body.beach_name, 120);
    const cleanName = safeText(body.name, 120);
    const cleanOwnerName = safeText(body.owner_name, 120);
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
      name: cleanName,
      status: 'active',
      city: cleanCity,
      state: cleanState,
      beach_name: cleanBeach,
      primary_color: body.primary_color || '#ff6b00',
      secondary_color: body.secondary_color || '#82533f',
      button_color: body.button_color || body.primary_color || '#ff6b00',
      button_text_color: body.button_text_color || '#ffffff',
      logo_url: body.logo_url || '/sandexpress-logo-fluid.png',
    };
    if (beachId) tenantPayload.beach_id = beachId;

    const { data: tenant, error: tenantError } = await (supabaseAdmin.from('tenants') as any)
      .insert(tenantPayload)
      .select()
      .single();

    if (tenantError) throw tenantError;

    const vendorPayload: Record<string, unknown> = {
        tenant_id: tenant.id,
        name: cleanName,
        owner_name: cleanOwnerName,
        owner_phone: cleanPhone,
        owner_email: String(body.owner_email).trim().toLowerCase(),
        cpf: cleanCpf || null,
        cnpj: cleanCnpj || null,
        document_login: documentLogin,
        address: body.address || cleanBeach,
        city: cleanCity,
        state: cleanState,
        beach_name: cleanBeach,
        logo_url: body.logo_url || '/sandexpress-logo-fluid.png',
        primary_color: body.primary_color || '#ff6b00',
        secondary_color: body.secondary_color || '#82533f',
        button_color: body.button_color || body.primary_color || '#ff6b00',
        button_text_color: body.button_text_color || '#ffffff',
        password_hash: passwordHash,
        password_needs_reset: false,
        owner_email_verified: true,
        owner_email_verification_token: null,
        owner_email_verification_expires_at: null,
        subscription_status: 'trial',
        plan_type: 'trial',
        trial_ends_at: trialEndsAt,
        plan_monthly_price: planSettings.monthly_price,
        plan_annual_monthly_price: planSettings.annual_monthly_price,
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

    try {
      await seedDefaultMenuForVendor(tenant.id, vendor.id);
    } catch (menuError) {
      console.error('Default menu seed error:', menuError);
    }

    const confirmationEmail = buildVendorRegistrationConfirmationEmail({
      vendorName: vendor.name,
      ownerName: vendor.owner_name,
      login: documentLogin,
      trialEndsAt,
    });
    const emailResult = await sendEmail({
      to: String(vendor.owner_email).trim().toLowerCase(),
      ...confirmationEmail,
    });

    return NextResponse.json({
      ...vendor,
      tenant_id: tenant.id,
      document_login: documentLogin,
      email_confirmation: {
        sent: emailResult.ok,
        reason: emailResult.ok ? null : emailResult.reason,
      },
      message: body.password
        ? 'Quiosque criado com senha definida pelo vendor.'
        : 'Quiosque criado.',
    }, { status: 201 });
  } catch (err: any) {
    console.error('Vendor register error:', {
      code: err?.code,
      message: err?.message,
      details: err?.details,
      hint: err?.hint,
    });
    if (['42P01', 'PGRST205', '42703'].includes(err?.code || '')) {
      return NextResponse.json({
        error: 'Banco Supabase com schema desatualizado. Rode os SQLs de atualizacao no Supabase antes de cadastrar.',
        code: err?.code,
        missing: err?.message,
      }, { status: 500 });
    }
    return NextResponse.json({
      error: 'Erro ao gravar no Supabase. Confirme que o banco foi criado com infra/sql-iniciar-novo-projeto.sql e que as variaveis do Vercel apontam para esse projeto.',
    }, { status: 500 });
  }
}
