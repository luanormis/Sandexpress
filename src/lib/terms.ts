export const TERMS_VERSION = "2026-06-17";

export type TermsAcceptanceInput = {
  vendorId: string;
  tenantId: string;
  body: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
};

export function buildTermsAcceptanceSnapshot({ vendorId, tenantId, body, ip, userAgent }: TermsAcceptanceInput) {
  const acceptedAt = new Date().toISOString();
  return {
    tenant_id: tenantId,
    vendor_id: vendorId,
    terms_version: TERMS_VERSION,
    accepted_at: acceptedAt,
    accepted_ip: ip || null,
    accepted_user_agent: userAgent || null,
    snapshot: {
      accepted_at: acceptedAt,
      terms_version: TERMS_VERSION,
      software: "SandExpress",
      responsible: {
        name: String(body.owner_name || "").trim(),
        phone: String(body.owner_phone || "").trim(),
        email: String(body.owner_email || "").trim().toLowerCase(),
        cpf: String(body.cpf || "").replace(/\D/g, "") || null,
        cnpj: String(body.cnpj || "").replace(/\D/g, "") || null,
      },
      business: {
        name: String(body.name || "").trim(),
        beach_name: String(body.beach_name || "").trim(),
        city: String(body.city || "").trim(),
        state: String(body.state || "").trim().toUpperCase(),
      },
      consent_text:
        "Li e concordo com os Termos de Uso do SandExpress, incluindo tratamento de dados para cadastro, pedidos, atendimento, pagamentos, relatorios e suporte.",
    },
  };
}

