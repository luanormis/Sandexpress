import { NextResponse } from 'next/server';

/**
 * WhatsApp/OTP fica desativado no MVP.
 * A rota permanece para compatibilidade com telas antigas e sera reativada
 * quando o provedor pago for validado em teste real.
 */
export async function POST() {
  return NextResponse.json({
    disabled: true,
    message: 'Validacao por WhatsApp desativada no MVP. Login do cliente usa nome, telefone e quantidade de pessoas.',
  });
}
