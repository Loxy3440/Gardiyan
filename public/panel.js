const $ = id => document.getElementById(id);
let ROLES = [];
let groupsLoaded = false; // rol grubu seçicileri sadece ilk yüklemede doldurulur (kaydedilmemiş seçim ezilmesin)
const roleName = id => (ROLES.find(r => r.id === id) || {}).name || "silinmiş rol";

// Çoklu rol seçici: açılır listeden ekle, çipten kaldır.
function rolePicker(mount) {
  let ids = [];
  const sel = el("select", { "aria-label": "Rol ekle" });
  const chips = el("div", { class: "chips2" });
  const redraw = () => {
    sel.replaceChildren(el("option", { value: "", text: "Rol ekle…" }),
      ...ROLES.filter(r => !ids.includes(r.id) && !r.managed).map(r => el("option", { value: r.id, text: "@" + r.name })));
    chips.replaceChildren(...ids.map(id => el("span", { class: "c" }, "@" + roleName(id),
      el("button", { type: "button", "aria-label": "Kaldır", text: "×", onclick: () => { ids = ids.filter(x => x !== id); redraw(); } }))));
  };
  sel.addEventListener("change", () => { if (sel.value) { ids.push(sel.value); redraw(); } });
  mount.classList.add("rp"); mount.replaceChildren(sel, chips); redraw();
  return { get: () => [...ids], set: v => { ids = [...(v || [])]; redraw(); }, redraw };
}
const pickers = {};
const lockSub = r => (r.allowedRoleIds && r.allowedRoleIds.length ? " · 🔒 " + r.allowedRoleIds.map(roleName).join(", ") : "");

const TYPE = { WATCHING: "İzliyor", PLAYING: "Oynuyor", STREAMING: "Yayında", LISTENING: "Dinliyor", COMPETING: "Yarışıyor" };

function toast(msg, err) {
  const t = $("toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ""), 3200);
}

async function api(path, body) {
  const opt = body === undefined
    ? { credentials: "same-origin" }
    : { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-Requested-With": "panel" }, body: JSON.stringify(body) };
  const res = await fetch("/api/admin/" + path, opt);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { location.reload(); throw new Error("Oturum bitti"); }
  if (!res.ok) throw new Error(data.error || "Hata (" + res.status + ")");
  return data;
}

// Güvenli DOM üretici: kullanıcı/üye metinleri asla innerHTML'e girmez.
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  kids.flat().forEach(c => c && e.append(c));
  return e;
}

async function run(btn, fn, okMsg) {
  if (btn) btn.disabled = true;
  try { const r = await fn(); toast(r?.message || okMsg || "Kaydedildi"); return true; }
  catch (e) { toast(e.message, true); return false; }
  finally { if (btn) btn.disabled = false; }
}

function row(title, sub, ...actions) {
  return el("li", { class: "item" }, el("div", { class: "txt" }, el("div", { class: "t", text: title }), sub ? el("div", { class: "s", text: sub }) : null), el("div", { class: "acts" }, actions));
}

function render(d) {
  ROLES = d.roles || [];
  Object.values(pickers).forEach(p => p.redraw());
  if (pickers.member && !groupsLoaded) { groupsLoaded = true; pickers.member.set(d.roleGroups.member); pickers.staff.set(d.roleGroups.staff); pickers.bot.set(d.roleGroups.bot); }
  $("intVal").value = d.activity.intervalSeconds;

  $("actList").replaceChildren(...d.activity.list.map((a, i) =>
    row(a.text, (TYPE[a.type] || a.type) + (a.url ? " · " + a.url : ""), el("button", { class: "btn sm danger", text: "Sil", onclick: e => run(e.target, async () => { await api("activity/remove", { index: i }); await load(); }, "Silindi") }))));

  const mk = (list, remove, fill) => list.map(r =>
    row(r.trigger, (r.response || "(sadece medya)") + (r.mediaUrl ? " 📎" : "") + (r.cooldownSeconds ? ` · ${r.cooldownSeconds}sn` : "") + lockSub(r),
      el("button", { class: "btn sm alt", text: "Düzenle", onclick: () => fill(r) }),
      el("button", { class: "btn sm danger", text: "Sil", onclick: e => run(e.target, async () => { await api(remove, { trigger: r.trigger }); await load(); }, "Silindi") })));

  const fillForm = (form, r, picker) => { for (const k of ["trigger", "response", "mediaUrl", "cooldownSeconds"]) if (form[k]) form[k].value = r[k] ?? (k === "cooldownSeconds" ? 3 : ""); picker.set(r.allowedRoleIds); form.scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("menList").replaceChildren(...mk(d.mentionTriggers, "mention/remove", r => fillForm($("menForm"), r, pickers.men)));
  $("autoList").replaceChildren(...mk(d.autoResponses, "auto/remove", r => fillForm($("autoForm"), r, pickers.auto)));
  renderRankup(d);
}

// ---- Auto rank up (iki kategori: üye / yetkili) ----
const RK_CATS = { uye: "Üye", yetkili: "Yetkili" };
const rkEmpty = () => ({ enabled: false, channelId: "", steps: [] });
const RK = { cat: "uye", data: { uye: rkEmpty(), yetkili: rkEmpty() }, dirty: { uye: false, yetkili: false }, channels: [] };
const rkCur = () => RK.data[RK.cat];
function renderRankup(d) {
  for (const c of Object.keys(RK_CATS)) {
    const s = d.autoRankup && d.autoRankup[c];
    if (s && !RK.dirty[c]) RK.data[c] = { enabled: !!s.enabled, channelId: s.channelId || "", steps: s.steps.map(x => ({ ...x })) };
  }
  RK.channels = d.channels || [];
  drawRankup();
}
function drawRankup() {
  const cur = rkCur(), label = RK_CATS[RK.cat];
  document.querySelectorAll("#rkCats button").forEach(b => b.classList.toggle("on", b.dataset.cat === RK.cat));
  $("rkEnabled").checked = cur.enabled;
  $("rkEnabledText").textContent = label + " sistemi açık";
  $("rkChannel").replaceChildren(el("option", { value: "", text: "Duyuru yok" }), ...RK.channels.map(c => el("option", { value: c.id, text: "#" + c.name })));
  $("rkChannel").value = cur.channelId;
  // Başka kategoride kullanılan roller listelenmez (bir rol tek kategoride olabilir).
  const taken = new Set(Object.keys(RK_CATS).filter(c => c !== RK.cat).flatMap(c => RK.data[c].steps.map(s => s.roleId)));
  $("rkRole").replaceChildren(el("option", { value: "", text: cur.steps.length ? "Sıradaki rol…" : "Başlangıç rolü…" }),
    ...ROLES.filter(r => !r.managed && !taken.has(r.id) && !cur.steps.some(s => s.roleId === r.id)).map(r => el("option", { value: r.id, text: "@" + r.name })));
  $("rkInv").hidden = cur.steps.length === 0; // ilk rol (başlangıç) için davet gerekmez
  const touch = () => { RK.dirty[RK.cat] = true; drawRankup(); };
  const move = (i, to) => { const [x] = cur.steps.splice(i, 1); cur.steps.splice(to, 0, x); touch(); };
  $("rkList").replaceChildren(...cur.steps.map((s, i) => row(
    (i + 1) + ". @" + roleName(s.roleId),
    i === 0 ? "Başlangıç rolü (davet gerekmez)" : "Bir önceki rolden sonra " + (Number(s.invites) || 1) + " davet · rank alınca sayaç sıfırlanır",
    i > 0 ? el("button", { class: "btn sm alt", type: "button", text: "▲", "aria-label": "Yukarı", onclick: () => move(i, i - 1) }) : null,
    i < cur.steps.length - 1 ? el("button", { class: "btn sm alt", type: "button", text: "▼", "aria-label": "Aşağı", onclick: () => move(i, i + 1) }) : null,
    i > 0 ? el("button", { class: "btn sm alt", type: "button", text: "Davet", onclick: () => { const n = Math.floor(Number(prompt("Gereken davet (1-1000):", s.invites || 1))); if (n >= 1 && n <= 1000) { s.invites = n; touch(); } } }) : null,
    el("button", { class: "btn sm danger", type: "button", text: "Sil", onclick: () => { cur.steps.splice(i, 1); touch(); } }))));
}
function wireRankup() {
  $("rkCats").addEventListener("click", e => { const b = e.target.closest("button[data-cat]"); if (b) { RK.cat = b.dataset.cat; drawRankup(); } });
  $("rkEnabled").addEventListener("change", e => { rkCur().enabled = e.target.checked; RK.dirty[RK.cat] = true; });
  $("rkChannel").addEventListener("change", e => { rkCur().channelId = e.target.value; RK.dirty[RK.cat] = true; });
  $("rkForm").addEventListener("submit", e => {
    e.preventDefault();
    const cur = rkCur(), roleId = $("rkRole").value;
    if (!roleId) return toast("Bir rol seç", true);
    let invites = 0;
    if (cur.steps.length) {
      invites = Math.floor(Number($("rkInv").value));
      if (!(invites >= 1 && invites <= 1000)) return toast("Gereken davet 1 ile 1000 arasında olmalı", true);
    }
    cur.steps.push({ roleId, invites }); RK.dirty[RK.cat] = true; $("rkInv").value = ""; drawRankup();
  });
  $("rkSave").addEventListener("click", e => {
    const cat = RK.cat, cur = rkCur();
    return run(e.target, async () => {
      await api("rankup/save", { category: cat, enabled: $("rkEnabled").checked, channelId: $("rkChannel").value, steps: cur.steps.map((s, i) => ({ roleId: s.roleId, invites: i === 0 ? 0 : Math.max(1, Number(s.invites) || 1) })) });
      RK.dirty[cat] = false;
      await load();
    }, RK_CATS[cat] + " auto rank up kaydedildi");
  });
}
async function load() { render(await api("overview")); }

function formData(form) { return Object.fromEntries(new FormData(form)); }

function wire() {
  pickers.men = rolePicker($("menRoles")); pickers.auto = rolePicker($("autoRoles"));
  pickers.member = rolePicker($("grpMember")); pickers.staff = rolePicker($("grpStaff")); pickers.bot = rolePicker($("grpBot"));
  $("grpSave").addEventListener("click", e => run(e.target, async () => {
    await api("roles/save", { member: pickers.member.get(), staff: pickers.staff.get(), bot: pickers.bot.get() });
    await load();
  }, "Roller kaydedildi"));

  wireRankup();
  $("tabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-tab]"); if (!b) return;
    document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x === b));
    document.querySelectorAll(".pane").forEach(p => (p.hidden = p.id !== "pane-" + b.dataset.tab));
  });

  const submit = (id, path, tweak, after) => $(id).addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target, body = tweak ? tweak(formData(f)) : formData(f);
    if (await run(f.querySelector("button"), async () => { await api(path, body); await load(); })) { after?.(f); }
  });
  // Yayında seçilince Twitch/YouTube adresi alanı açılır.
  const actType = $("actForm").elements.type, actUrl = $("actUrl");
  const syncUrl = () => { const on = actType.value === "STREAMING"; actUrl.hidden = !on; actUrl.required = on; };
  actType.addEventListener("change", syncUrl); syncUrl();
  submit("actForm", "activity/add", d => (d.type === "STREAMING" ? d : { type: d.type, text: d.text }), f => { f.text.value = ""; f.url.value = ""; });
  submit("intForm", "activity/interval", d => ({ seconds: Number(d.seconds) }));
  submit("menForm", "mention/upsert", d => ({ ...d, allowedRoleIds: pickers.men.get() }), f => { f.reset(); pickers.men.set([]); });
  submit("autoForm", "auto/upsert", d => ({ ...d, cooldownSeconds: Number(d.cooldownSeconds) || 3, allowedRoleIds: pickers.auto.get() }), f => { f.reset(); f.cooldownSeconds.value = 3; pickers.auto.set([]); });

  $("searchForm").addEventListener("submit", async e => {
    e.preventDefault();
    await run(e.target.querySelector("button"), async () => {
      const { members } = await api("members?q=" + encodeURIComponent($("q").value.trim()));
      $("memList").replaceChildren(...members.map(memberRow));
      if (!members.length) toast("Üye bulunamadı", true); else return { message: members.length + " üye bulundu" };
    });
  });
}

function memberRow(m) {
  const act = (label, cls, fn) => el("button", { class: "btn sm " + cls, text: label, onclick: e => fn(e.target) });
  const li = el("li", { class: "item" },
    el("div", { class: "who2" }, el("img", { src: m.avatar, alt: "" }), el("div", { class: "txt" }, el("div", { class: "t", text: m.name }), el("div", { class: "s", text: m.tag + (m.mutedUntil ? " · susturulu" : "") }))),
    el("div", { class: "acts" },
      act("Sustur", "alt", b => {
        const d = prompt("Süre (10m, 2h, 1d):", "10m"); if (!d) return;
        const reason = prompt("Sebep (isteğe bağlı):", "") || "";
        run(b, () => api("mute", { userId: m.id, duration: d, reason }));
      }),
      act("Susturmayı kaldır", "alt", b => run(b, () => api("unmute", { userId: m.id }))),
      act("At", "danger", b => {
        if (!confirm(m.tag + " sunucudan atılsın mı?")) return;
        run(b, () => api("kick", { userId: m.id, reason: prompt("Sebep (isteğe bağlı):", "") || "" }));
      })));
  return li;
}

(async function init() {
  const err = new URLSearchParams(location.search).get("err");
  const msgs = { forbidden: "Bu hesabın panele girme yetkisi yok.", login: "Giriş tamamlanamadı. Tekrar dene.", state: "Giriş doğrulaması başarısız. Tekrar dene." };
  const me = await fetch("/api/me", { credentials: "same-origin" }).then(r => r.json()).catch(() => ({ loggedIn: false }));
  if (!me.loggedIn) {
    $("login").hidden = false;
    if (err && msgs[err]) $("loginMsg").textContent = msgs[err];
    return;
  }
  $("who").hidden = false; $("whoName").textContent = me.user.name; if (me.user.avatar) $("whoImg").src = me.user.avatar; else $("whoImg").hidden = true;
  $("app").hidden = false;
  wire();
  try { await load(); } catch (e) { toast(e.message, true); }
})();
