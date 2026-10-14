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

const TYPE = { WATCHING: "İzliyor", PLAYING: "Oynuyor", LISTENING: "Dinliyor", COMPETING: "Yarışıyor" };

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
    row(a.text, TYPE[a.type] || a.type, el("button", { class: "btn sm danger", text: "Sil", onclick: e => run(e.target, async () => { await api("activity/remove", { index: i }); await load(); }, "Silindi") }))));

  const mk = (list, remove, fill) => list.map(r =>
    row(r.trigger, (r.response || "(sadece medya)") + (r.mediaUrl ? " 📎" : "") + (r.cooldownSeconds ? ` · ${r.cooldownSeconds}sn` : "") + lockSub(r),
      el("button", { class: "btn sm alt", text: "Düzenle", onclick: () => fill(r) }),
      el("button", { class: "btn sm danger", text: "Sil", onclick: e => run(e.target, async () => { await api(remove, { trigger: r.trigger }); await load(); }, "Silindi") })));

  const fillForm = (form, r, picker) => { for (const k of ["trigger", "response", "mediaUrl", "cooldownSeconds"]) if (form[k]) form[k].value = r[k] ?? (k === "cooldownSeconds" ? 3 : ""); picker.set(r.allowedRoleIds); form.scrollIntoView({ behavior: "smooth", block: "center" }); };
  $("menList").replaceChildren(...mk(d.mentionTriggers, "mention/remove", r => fillForm($("menForm"), r, pickers.men)));
  $("autoList").replaceChildren(...mk(d.autoResponses, "auto/remove", r => fillForm($("autoForm"), r, pickers.auto)));
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
  submit("actForm", "activity/add", null, f => (f.text.value = ""));
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
