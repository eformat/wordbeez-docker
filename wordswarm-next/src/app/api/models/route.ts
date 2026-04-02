import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAAS_HOST = 'https://maas.apps.ocp.cloud.rhai-tmm.dev';

// GET /api/models — fetch available models from MaaS API
// Token is read server-side from MODEL_TOKEN env var — never exposed to client
export async function GET() {
  const token = process.env.MODEL_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'MODEL_TOKEN not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${MAAS_HOST}/maas-api/v1/models`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `MaaS API returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    const models = (data.data || [])
      .filter((m: Record<string, unknown>) => m.ready)
      .map((m: Record<string, unknown>) => {
        const rawUrl = (m.url as string) || '';
        const url = rawUrl.replace(/^http:/, 'https:') + '/v1';
        const details = (m.modelDetails as Record<string, string>) || {};
        return {
          id: m.id,
          name: details.displayName || m.id,
          url,
        };
      });

    return NextResponse.json({ models });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch models: ${err}` },
      { status: 500 },
    );
  }
}
