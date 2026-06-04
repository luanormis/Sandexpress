import TestRealClient from "./TestRealClient";

export const dynamic = "force-dynamic";

async function loadInitialData() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:3002");

  try {
    const [healthRes, flowRes] = await Promise.all([
      fetch(`${baseUrl}/api/health`, { cache: "no-store" }),
      fetch(`${baseUrl}/api/test/flow`, { cache: "no-store" }),
    ]);

    return {
      health: await healthRes.json(),
      data: await flowRes.json(),
    };
  } catch {
    return {
      health: null,
      data: null,
    };
  }
}

export default async function TestRealPage() {
  const initial = await loadInitialData();
  return <TestRealClient initialHealth={initial.health} initialData={initial.data} />;
}
