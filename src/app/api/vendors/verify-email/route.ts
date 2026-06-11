import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/vendor/login?verified=missing-token', req.url));
    }

    const { data: vendor, error } = await (supabaseAdmin.from('vendors') as any)
      .select('id, owner_email_verification_expires_at')
      .eq('owner_email_verification_token', hashToken(token))
      .maybeSingle();

    if (error) throw error;
    if (!vendor) {
      return NextResponse.redirect(new URL('/vendor/login?verified=invalid', req.url));
    }

    if (vendor.owner_email_verification_expires_at && new Date(vendor.owner_email_verification_expires_at) < new Date()) {
      return NextResponse.redirect(new URL('/vendor/login?verified=expired', req.url));
    }

    const { error: updateError } = await (supabaseAdmin.from('vendors') as any)
      .update({
        owner_email_verified: true,
        owner_email_verified_at: new Date().toISOString(),
        owner_email_verification_token: null,
        owner_email_verification_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vendor.id);

    if (updateError) throw updateError;

    return NextResponse.redirect(new URL('/vendor/login?verified=success', req.url));
  } catch (err) {
    console.error('Vendor email verification error:', err);
    return NextResponse.redirect(new URL('/vendor/login?verified=error', req.url));
  }
}
