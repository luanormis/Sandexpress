import crypto from "crypto";

export const TERMS_VERSION = "2026-06-24";
export const TERMS_DOCUMENT_TITLE = "Termos de Uso e Política de Privacidade do SandExpress";
export const TERMS_CONSENT_TEXT =
  "Li e aceito os Termos de Uso e a Política de Privacidade do SandExpress, incluindo o registro eletrônico do aceite e o tratamento de dados pessoais para cadastro, autenticação, pedidos, atendimento, relatórios, cobranças, segurança, suporte e cumprimento de obrigações legais.";
export const TERMS_DOCUMENT_HASH = crypto
  .createHash("sha256")
  .update(`${TERMS_VERSION}:${TERMS_DOCUMENT_TITLE}:${TERMS_CONSENT_TEXT}`)
  .digest("hex");

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
      document_title: TERMS_DOCUMENT_TITLE,
      document_hash_sha256: TERMS_DOCUMENT_HASH,
      software: "SandExpress",
      legal_basis: "Aceite eletrônico dos Termos de Uso e da Política de Privacidade",
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
      consent_text: TERMS_CONSENT_TEXT,
    },
  };
}
