// Servidor da agenda (Cloudflare Pages Functions).
// GET  /api/agenda -> devolve a agenda salva
// POST /api/agenda -> exige login e senha (guardados como variáveis secretas no painel da Cloudflare)

const CAB = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const resp = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: CAB });

// comparação em tempo constante, para não vazar informação pelo tempo de resposta
function igual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let d = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

function limpar(lista) {
  if (!Array.isArray(lista) || lista.length > 200) return null;
  const out = [];
  for (const s of lista) {
    const o = {
      data: txt(s && s.data, 10),
      hora: txt(s && s.hora, 5),
      local: txt(s && s.local, 120),
      cidade: txt(s && s.cidade, 120),
      obs: txt(s && s.obs, 120),
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.data) || !o.local) return null;
    if (o.hora && !/^\d{2}:\d{2}$/.test(o.hora)) return null;
    out.push(o);
  }
  return out;
}

export async function onRequestGet({ env }) {
  if (!env.AGENDA_KV) return resp({ shows: null });
  const v = await env.AGENDA_KV.get("agenda");
  return resp({ shows: v ? JSON.parse(v) : null });
}

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return resp({ erro: "Requisição inválida." }, 400); }
  if (!env.ADMIN_USER || !env.ADMIN_PASS || !env.AGENDA_KV) {
    return resp({ erro: "Servidor ainda não configurado." }, 500);
  }
  const okU = igual(String(b.usuario || "").trim().toLowerCase(), String(env.ADMIN_USER).trim().toLowerCase());
  const okP = igual(b.senha || "", env.ADMIN_PASS);
  if (!(okU && okP)) {
    await new Promise((r) => setTimeout(r, 800));
    return resp({ erro: "Login ou senha incorretos." }, 401);
  }
  if (b.acao === "login") return resp({ ok: true });
  if (b.acao === "salvar") {
    const lista = limpar(b.shows);
    if (!lista) return resp({ erro: "Dados inválidos: confira data e local de cada show." }, 400);
    await env.AGENDA_KV.put("agenda", JSON.stringify(lista));
    return resp({ ok: true, shows: lista });
  }
  return resp({ erro: "Ação desconhecida." }, 400);
}
