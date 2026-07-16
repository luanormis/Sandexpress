import { NextRequest, NextResponse } from 'next/server';
import { canAccessVendor, getRequestSession } from '@/lib/auth-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isCanonicalUuid } from '@/lib/uuid';
import { fetchWeatherForecast } from '@/lib/weather-forecast';

export async function GET(req: NextRequest) {
  try {
    const vendorId = new URL(req.url).searchParams.get('vendor_id') || '';
    if (!isCanonicalUuid(vendorId) || !canAccessVendor(getRequestSession(req), vendorId)) return NextResponse.json({ error: 'Nao autorizado.' }, { status: 403 });
    const { data: vendor, error } = await supabaseAdmin.from('vendors').select('city, state, beach_name').eq('id', vendorId).single();
    if (error || !vendor?.city) return NextResponse.json({ available: false, error: 'Cadastre cidade e estado do quiosque.' });
    return NextResponse.json(await fetchWeatherForecast(vendor.city, vendor.state, vendor.beach_name));
  } catch (error) {
    console.error('Weather forecast API error:', error);
    return NextResponse.json({ available: false, error: 'Erro ao consultar clima.' }, { status: 500 });
  }
}
