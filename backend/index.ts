// Deploy as an Edge Function named snake-leaderboard with JWT verification OFF.
// The browser sends a random player capability; only its SHA-256 hash is stored.
// The service-role key stays exclusively in this function's environment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") ||
  "https://gooongxi.github.io,https://eddiekong.com,http://localhost:8000,http://127.0.0.1:8000")
  .split(",").map(s => s.trim()).filter(Boolean);

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const headers = {
    "Content-Type": "application/json; charset=utf-8", "Vary": "Origin", "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {status, headers});
  if (origin && !allowedOrigins.includes(origin)) return reply({error: "网站域名未获允许，请检查 ALLOWED_ORIGINS。"}, 403);
  if (req.method === "OPTIONS") return new Response(null, {status: 204, headers});
  try {
    const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply({error: "排行榜服务尚未配置完成。"}, 503);
    const db = createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}});
    if (req.method === "GET") {
      const difficulty = Number(new URL(req.url).searchParams.get("difficulty"));
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 9) return reply({error: "请选择 1–9 的难度。"}, 400);
      const {data, error} = await db.from("snake_best").select("nickname,score,achieved_at")
        .eq("difficulty", difficulty).order("score", {ascending: false}).order("achieved_at").order("player_hash").limit(10);
      if (error) throw error;
      return reply({entries: data});
    }
    if (req.method !== "POST") return reply({error: "不支持此请求。"}, 405);
    const text = await req.text();
    if (new TextEncoder().encode(text).length > 4096) return reply({error: "请求过大。"}, 413);
    let body;
    try { body = JSON.parse(text); } catch { return reply({error: "请求格式错误。"}, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !/^[a-f0-9]{64}$/.test(body.player_token || "")) return reply({error: "玩家标识无效。"}, 400);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.player_token));
    const player = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
    if (body.action === "start") {
      if (!Number.isInteger(body.difficulty) || body.difficulty < 1 || body.difficulty > 9) return reply({error: "难度无效。"}, 400);
      const {data, error} = await db.rpc("snake_start", {p_player: player, p_difficulty: body.difficulty});
      if (error) {
        if (error.message.includes("Too many games")) return reply({error: "开始次数过多，请稍后再试。"}, 429);
        throw error;
      }
      return reply({run_id: data});
    }
    if (body.action !== "finish") return reply({error: "操作无效。"}, 400);
    const name = typeof body.nickname === "string" ? body.nickname.trim() : "";
    if (!name || Array.from(name).length > 24 || /[\u0000-\u001f\u007f]/.test(name) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.run_id || "") ||
        !Number.isInteger(body.score) || body.score < 0 || body.score > 1000000 ||
        typeof body.duration !== "number" || !Number.isFinite(body.duration) || body.duration < 0 || body.duration > 86400) {
      return reply({error: "成绩格式无效，请开始新一局。"}, 400);
    }
    const {data, error} = await db.rpc("snake_finish", {p_player: player, p_run: body.run_id,
      p_nickname: name, p_score: body.score, p_duration: body.duration});
    if (error) {
      if (error.message.includes("Game session") || error.message.includes("inconsistent")) return reply({error: "本局记录已过期或成绩检查未通过，请开始新一局。"}, 400);
      throw error;
    }
    return reply({improved: data});
  } catch (error) {
    console.error("Leaderboard request failed", error);
    return reply({error: "排行榜暂不可用，请稍后重试；管理员可查看函数日志。"}, 503);
  }
});
