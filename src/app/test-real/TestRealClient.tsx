"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, ExternalLink, Play, RefreshCw, ShieldCheck, ShoppingBag, Store, Umbrella } from "lucide-react";

type FlowData = {
  vendor?: { id: string; name: string; document_login: string; city?: string; address?: string };
  umbrella?: { id: string; number: number; is_occupied?: boolean; current_order_id?: string | null };
  customer?: { id: string; name: string; phone: string };
  products?: Array<{ id: string; name: string; category: string; price: number }>;
  orders?: Array<{ id: string; status: string; total: number; paid?: boolean; payment_method?: string | null; created_at?: string }>;
  links?: { admin: string; vendor: string; customer: string };
  credentials?: { vendor_login: string; vendor_password: string; admin: string; customer_otp: string };
  last_action?: string;
  closed?: boolean;
  error?: string;
};

type HealthData = {
  status?: string;
  database?: string;
  env?: string;
  error?: string;
};

const actionLabels: Record<string, string> = {
  seed: "Preparar dados",
  order: "Criar pedido",
  close: "Fechar conta",
  full: "Fluxo completo",
};

export default function TestRealClient({
  initialHealth,
  initialData,
}: {
  initialHealth: HealthData | null;
  initialData: FlowData | null;
}) {
  const [health, setHealth] = useState<HealthData | null>(initialHealth);
  const [data, setData] = useState<FlowData | null>(initialData);
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");

  async function loadSummary() {
    setLoading("summary");
    setMessage("");
    try {
      const [healthRes, summaryRes] = await Promise.all([
        fetch("/api/health"),
        fetch("/api/test/flow"),
      ]);
      setHealth(await healthRes.json());
      setData(await summaryRes.json());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao carregar teste.");
    } finally {
      setLoading("");
    }
  }

  async function runAction(action: string) {
    setLoading(action);
    setMessage("");
    try {
      const res = await fetch("/api/test/flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      setData(json);
      setMessage(res.ok ? `${actionLabels[action]} executado com sucesso.` : json.error || "Erro no teste.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erro ao executar acao.");
    } finally {
      setLoading("");
    }
  }

  useEffect(() => {
    if (!initialHealth || !initialData) {
      loadSummary();
    }
  }, []);

  const latestOrder = data?.orders?.[0];
  const customerUrl = data?.links?.customer || "#";

  return (
    <main className="min-h-screen bg-[#F7F3EA] text-[#1F2933]">
      <header className="border-b border-[#E7DCCB] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#FF6B00]">SandExpress Local</p>
            <h1 className="text-2xl font-black md:text-3xl">Painel de teste do fluxo completo</h1>
          </div>
          <button
            onClick={loadSummary}
            disabled={!!loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#394E59] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Atualizar
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {message && (
          <div className="rounded-lg border border-[#FFB26B] bg-[#FFF2E5] px-4 py-3 text-sm font-semibold text-[#82533F]">
            {message}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <StatusTile icon={<Activity size={18} />} label="Servidor" value={health?.status || "..."} ok={health?.status === "ok"} />
          <StatusTile icon={<ShieldCheck size={18} />} label="Banco" value={health?.database || "..."} ok={health?.database === "connected"} />
          <StatusTile icon={<Store size={18} />} label="Quiosque" value={data?.vendor?.name || "..."} ok={!!data?.vendor} />
          <StatusTile icon={<Umbrella size={18} />} label="Guarda-sol" value={data?.umbrella?.is_occupied ? "Ocupado" : "Livre"} ok={!data?.umbrella?.is_occupied} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-lg border border-[#E7DCCB] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black mb-4">Acoes do fluxo local</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(["seed", "order", "close", "full"] as const).map((action) => (
                <button
                  key={action}
                  onClick={() => runAction(action)}
                  disabled={!!loading}
                  className="flex min-h-24 flex-col items-start justify-between rounded-lg border border-[#E7DCCB] bg-[#FFF9F0] p-4 text-left transition hover:border-[#FF6B00] hover:bg-[#FFF2E5] disabled:opacity-60"
                >
                  <Play size={18} className="text-[#FF6B00]" />
                  <span className="font-black">{actionLabels[action]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#E7DCCB] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black mb-4">Credenciais de teste</h2>
            <div className="space-y-3 text-sm">
              <InfoLine label="Vendor login" value={data?.credentials?.vendor_login || "TEST-FLOW-001"} />
              <InfoLine label="Vendor senha" value={data?.credentials?.vendor_password || "teste12345"} />
              <InfoLine label="Cliente OTP" value={data?.credentials?.customer_otp || "000000"} />
              <InfoLine label="Admin" value="Use ADMIN_PASSWORD do .env.local" />
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-[#E7DCCB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black mb-4">Abrir paginas reais</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <OpenLink href="/admin" icon={<ShieldCheck size={18} />} title="Admin" subtitle="Analytics, quiosques e relatorios" />
            <OpenLink href="/vendor/login" icon={<Store size={18} />} title="Vendor" subtitle="Login e Kanban do quiosque" />
            <OpenLink href={customerUrl} icon={<ShoppingBag size={18} />} title="Cliente" subtitle="Cardapio do guarda-sol teste" />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-[#E7DCCB] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black mb-4">Estado atual</h2>
            <div className="space-y-3 text-sm">
              <InfoLine label="Cliente" value={data?.customer ? `${data.customer.name} - ${data.customer.phone}` : "..."} />
              <InfoLine label="Local" value={data?.vendor ? `${data.vendor.address || "Praia"} - ${data.vendor.city || "Cidade"}` : "..."} />
              <InfoLine label="Pedido mais recente" value={latestOrder ? `${latestOrder.status} - R$ ${Number(latestOrder.total || 0).toFixed(2)}` : "Nenhum pedido"} />
              <InfoLine label="Pagamento" value={latestOrder?.paid ? `Pago via ${latestOrder.payment_method || "n/d"}` : "Pendente"} />
            </div>
          </section>

          <section className="rounded-lg border border-[#E7DCCB] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black mb-4">Produtos no teste</h2>
            <div className="space-y-2">
              {(data?.products || []).map((product) => (
                <div key={product.id} className="flex items-center justify-between rounded-lg bg-[#F7F3EA] px-3 py-2 text-sm">
                  <span className="font-bold">{product.name}</span>
                  <span className="text-[#FF6B00] font-black">R$ {Number(product.price || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusTile({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-lg border border-[#E7DCCB] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[#82533F]">
        {icon}
        <span className="text-xs font-bold uppercase">{label}</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <CheckCircle2 size={18} className={ok ? "text-green-600" : "text-gray-300"} />
        <p className="truncate text-lg font-black">{value}</p>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[#F1E7D8] pb-2 last:border-0">
      <span className="text-[#82533F]">{label}</span>
      <span className="text-right font-black">{value}</span>
    </div>
  );
}

function OpenLink({ href, icon, title, subtitle }: { href: string; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <a
      href={href}
      target="_blank"
      className="flex items-center justify-between gap-4 rounded-lg border border-[#E7DCCB] bg-[#FFF9F0] p-4 transition hover:border-[#FF6B00] hover:bg-[#FFF2E5]"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-lg bg-[#FF6B00] p-2 text-white">{icon}</span>
        <span>
          <span className="block font-black">{title}</span>
          <span className="block text-sm text-[#82533F]">{subtitle}</span>
        </span>
      </span>
      <ExternalLink size={18} className="text-[#82533F]" />
    </a>
  );
}
