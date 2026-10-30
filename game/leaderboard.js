(() => {
  "use strict";
  if (window.SnakeBoard) return;
  const names = ["", "1 Baby", "2 Kiddie", "3 Super easy", "4 Easy", "5 Medium", "6 Hard", "7 Super hard", "8 Insane", "9 Impossible"];
  let endpoint = "", token = "", round = null, pending = null, sending = false, readVersion = 0;
  let panel, nickname, difficulty, message, rows, submit;
  const saved = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  function status(text) { message.textContent = text; }
  async function request(data, query = "") {
    if (!endpoint) throw new Error("尚未连接排行榜，请先配置在线服务。");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint + query, {
        method: data ? "POST" : "GET", signal: controller.signal,
        headers: data ? {"Content-Type": "application/json"} : {},
        body: data ? JSON.stringify(data) : undefined, credentials: "omit"
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "排行榜服务暂不可用");
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("连接超时，请稍后重试。");
      if (error instanceof TypeError) throw new Error("无法连接排行榜，请检查网络或稍后重试。");
      throw error;
    } finally { clearTimeout(timeout); }
  }
  async function refresh() {
    const version = ++readVersion;
    try {
      const data = await request(null, "?difficulty=" + difficulty.value);
      if (version !== readVersion) return;
      rows.replaceChildren();
      for (const [i, entry] of data.entries.entries()) {
        const tr = document.createElement("tr");
        for (const text of [String(i + 1), entry.nickname, String(entry.score)]) {
          const td = document.createElement("td"); td.textContent = text; tr.append(td);
        }
        rows.append(tr);
      }
      if (!data.entries.length) {
        const tr = document.createElement("tr"), td = document.createElement("td");
        td.colSpan = 3; td.textContent = "这个难度还没有成绩。"; tr.append(td); rows.append(tr);
      }
    } catch (error) { if (version === readVersion) status(error.message); }
  }
  async function send() {
    const item = pending;
    if (!item || sending) return;
    const name = nickname.value.trim();
    if (!name || Array.from(name).length > 24) { status("请填写 1–24 个字符的昵称。"); panel.open = true; return; }
    if (!item.eligible) { status("这一局更换过难度，仅保留本地成绩。下一局固定难度即可上榜。"); return; }
    sending = true; submit.disabled = true; status("正在提交成绩……");
    store("snake.global.nickname", name);
    try {
      const session = await item.round.session;
      if (session.error) throw new Error(session.error + " 本局未建立在线记录，请联网后开始新一局。");
      const result = await request({action: "finish", player_token: token,
        run_id: session.run_id, nickname: name, score: item.score, duration: item.duration});
      if (pending === item) pending = null;
      status(result.improved ? "成绩已保存，刷新了该难度的个人最佳！" : "成绩已提交，排行榜保留该难度的个人最佳。");
      if (Number(difficulty.value) === item.difficulty) await refresh();
    } catch (error) { status(error.message); }
    finally {
      sending = false; submit.disabled = !pending || !pending.eligible;
      if (pending && pending !== item && pending.eligible && nickname.value.trim()) void send();
    }
  }
  window.SnakeBoard = {
    setup(config) {
      endpoint = String(config.endpoint || "").replace(/\/$/, "");
      token = saved("snake.global.player_token");
      if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
        store("snake.global.player_token", token);
      }
      const style = document.createElement("style");
      style.textContent = `#snake-global{position:fixed;right:12px;bottom:12px;z-index:9999;width:min(340px,calc(100vw - 24px));box-sizing:border-box;background:#fff;color:#173b2b;border:1px solid #96b8a5;border-radius:12px;padding:12px;font:15px/1.5 system-ui,sans-serif;box-shadow:0 5px 24px #0003;max-height:80vh;overflow:auto}#snake-global summary{cursor:pointer;font-weight:700}#snake-global input,#snake-global select{box-sizing:border-box;width:100%;padding:7px;margin:6px 0;border:1px solid #a8bfb0;border-radius:5px}#snake-global button{padding:7px 12px;margin:6px 6px 6px 0;cursor:pointer}#snake-global table{width:100%;text-align:left;border-collapse:collapse}#snake-global td,#snake-global th{padding:5px;border-bottom:1px solid #eee;overflow-wrap:anywhere}#snake-global p{margin:8px 0}#snake-global small{color:#526b5c}`;
      document.head.append(style);
      panel = document.createElement("details"); panel.id = "snake-global";
      panel.innerHTML = `<summary>全球排行榜 · 点击展开</summary><label>玩家昵称<input id="sg-name" maxlength="48" placeholder="填写后，游戏结束时自动提交"></label><label>查看难度<select id="sg-difficulty"></select></label><button id="sg-refresh" type="button">刷新榜单</button><table><thead><tr><th>名次</th><th>玩家</th><th>分数</th></tr></thead><tbody id="sg-rows"></tbody></table><button id="sg-submit" type="button" disabled>提交 / 重试本局成绩</button><p id="sg-message" role="status" aria-live="polite"></p><small>每个浏览器独立识别玩家；每个难度保留最高分。同分按先取得成绩排序。游戏中换难度的局不上榜。</small>`;
      document.body.append(panel);
      nickname = panel.querySelector("#sg-name"); nickname.value = saved("snake.global.nickname") || "";
      difficulty = panel.querySelector("#sg-difficulty");
      for (let i = 1; i <= 9; i++) { const option = document.createElement("option"); option.value = String(i); option.textContent = names[i]; difficulty.append(option); }
      message = panel.querySelector("#sg-message"); rows = panel.querySelector("#sg-rows"); submit = panel.querySelector("#sg-submit");
      // Typing into the panel must not move/restart the Pygame snake.
      for (const event of ["keydown", "keyup", "keypress"]) panel.addEventListener(event, e => e.stopPropagation());
      nickname.addEventListener("change", () => store("snake.global.nickname", nickname.value.trim()));
      panel.querySelector("#sg-refresh").onclick = refresh;
      submit.onclick = send; difficulty.onchange = refresh;
      panel.addEventListener("toggle", () => { if (panel.open && endpoint) refresh(); });
      status(endpoint ? "填写昵称后开始游戏。点击游戏画面，使用 1–9 选择难度。" : "尚未连接全球排行；游戏和本地最高分仍可正常使用。");
    },
    startRound(level) {
      if (!panel) return;
      const current = {difficulty: level, session: null}; round = current;
      difficulty.value = String(level);
      current.session = request({action: "start", player_token: token, difficulty: level})
        .catch(error => ({error: error.message}));
      status("本局难度：" + names[level] + "。结束后提交成绩。");
    },
    endRound(score, level, duration, eligible) {
      if (!panel || !round) return;
      pending = {round, score, difficulty: level, duration, eligible};
      submit.disabled = sending || !eligible;
      if (!eligible) { status("这一局更换过难度，仅保留本地成绩。"); return; }
      if (nickname.value.trim()) { void send(); }
      else { panel.open = true; status("本局 " + score + " 分。填写昵称后点击提交。"); }
    }
  };
})();
