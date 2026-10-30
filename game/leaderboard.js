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
    if (!endpoint) throw new Error("Leaderboard not connected. Please configure the online service.");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint + query, {
        method: data ? "POST" : "GET", signal: controller.signal,
        headers: data ? {"Content-Type": "application/json"} : {},
        body: data ? JSON.stringify(data) : undefined, credentials: "omit"
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Leaderboard temporarily unavailable");
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Connection timed out. Please try again later.");
      if (error instanceof TypeError) throw new Error("Cannot connect to the leaderboard. Check your connection or try again later.");
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
        td.colSpan = 3; td.textContent = "No scores for this difficulty yet."; tr.append(td); rows.append(tr);
      }
    } catch (error) { if (version === readVersion) status(error.message); }
  }
  async function send() {
    const item = pending;
    if (!item || sending) return;
    const name = nickname.value.trim();
    if (!name || Array.from(name).length > 24) { status("Enter a nickname with 1-24 characters."); panel.open = true; return; }
    if (!item.eligible) { status("Difficulty changed during this game. Score saved locally only. Keep one difficulty next game to rank."); return; }
    sending = true; submit.disabled = true; status("Submitting score...");
    store("snake.global.nickname", name);
    try {
      const session = await item.round.session;
      if (session.error) throw new Error(session.error + " No online session was created. Connect to the internet and start a new game.");
      const result = await request({action: "finish", player_token: token,
        run_id: session.run_id, nickname: name, score: item.score, duration: item.duration});
      if (pending === item) pending = null;
      status(result.improved ? "Score saved! New personal best for this difficulty!" : "Score submitted. The leaderboard keeps your best score for each difficulty.");
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
      panel.innerHTML = `<summary>Global Leaderboard - Click to expand</summary><label>Nickname<input id="sg-name" maxlength="48" placeholder="Enter to auto-submit when the game ends"></label><label>Difficulty<select id="sg-difficulty"></select></label><button id="sg-refresh" type="button">Refresh</button><table><thead><tr><th>Rank</th><th>Player</th><th>Score</th></tr></thead><tbody id="sg-rows"></tbody></table><button id="sg-submit" type="button" disabled>Submit / Retry Score</button><p id="sg-message" role="status" aria-live="polite"></p><small>Each browser identifies a separate player. Only your best score per difficulty is kept. Ties go to the earlier score. Games with difficulty changes are not ranked.</small>`;
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
      status(endpoint ? "Enter a nickname, then click the game and press 1-9 to choose a difficulty." : "Global leaderboard not connected. You can still play and save local high scores.");
    },
    startRound(level) {
      if (!panel) return;
      const current = {difficulty: level, session: null}; round = current;
      difficulty.value = String(level);
      current.session = request({action: "start", player_token: token, difficulty: level})
        .catch(error => ({error: error.message}));
      status("Difficulty: " + names[level] + ". Submit your score when the game ends.");
    },
    endRound(score, level, duration, eligible) {
      if (!panel || !round) return;
      pending = {round, score, difficulty: level, duration, eligible};
      submit.disabled = sending || !eligible;
      if (!eligible) { status("Difficulty changed during this game. Score saved locally only."); return; }
      if (nickname.value.trim()) { void send(); }
      else { panel.open = true; status("Score: " + score + ". Enter a nickname and click Submit."); }
    }
  };
})();
