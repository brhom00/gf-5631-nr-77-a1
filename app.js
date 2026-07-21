"use strict";
const $ = (id) => document.getElementById(id);
const state = { bank:null, config:null, type:"keywords", query:"", excluded:new Set() };
const HISTORY_KEY = "keywordBankV3History";

const scopeDescriptions = {
  precise:"يستخدم أول 7 كلمات ذات أولوية لنتائج أكثر تركيزًا.",
  expanded:"يستخدم حتى 14 كلمة لتغطية المرادفات والصيغ الشائعة.",
  comprehensive:"يستخدم جميع كلمات المجموعة، وقد يزيد عدد النتائج غير المطابقة."
};

const platformDescriptions = {
  google:"Google يدعم عبارات البحث المتقدمة وOR، لذلك يُرسل الاستعلام كاملًا.",
  x:"X يدعم OR والعبارات بين علامتي اقتباس، مع تقليل الاستعلام الطويل تلقائيًا.",
  youtube:"YouTube يعمل أفضل باستعلام مختصر دون معاملات منطقية معقدة.",
  tiktok:"TikTok يعمل أفضل بعدد قليل من الكلمات المباشرة؛ ستُبسط الصيغة تلقائيًا.",
  facebook:"Facebook يعمل أفضل بكلمات مباشرة وقصيرة؛ ستُحذف معاملات OR تلقائيًا."
};

document.addEventListener("DOMContentLoaded", init);

async function init(){
  try{
    const [bankRes, configRes] = await Promise.all([
      fetch("./data/bank.json", {cache:"no-store"}),
      fetch("./data/config.json", {cache:"no-store"})
    ]);
    if(!bankRes.ok || !configRes.ok) throw new Error("تعذر تحميل ملفات البيانات.");
    state.bank = await bankRes.json();
    state.config = await configRes.json();
    bind();
    fillLanguages();
    fillPlatforms();
    fillCategories();
    renderStats();
    renderHistory();
    refreshAll();
  }catch(error){
    document.querySelector("main").insertAdjacentHTML("afterbegin",
      `<p class="error">${escapeHtml(error.message)} افتح المشروع عبر GitHub Pages أو خادم محلي، وليس بصيغة file://.</p>`);
  }
}

function bind(){
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.type = btn.dataset.type;
    state.excluded.clear();
    updateCustomField();
    fillCategories();
    refreshAll();
  }));
  $("language").addEventListener("change", () => { state.excluded.clear(); refreshAll(); });
  $("platform").addEventListener("change", refreshAll);
  $("category").addEventListener("change", () => { state.excluded.clear(); fillGroups(); refreshAll(); });
  $("group").addEventListener("change", () => { state.excluded.clear(); refreshAll(); });
  $("scope").addEventListener("change", () => { state.excluded.clear(); refreshAll(); });
  $("primary").addEventListener("input", refreshQuery);
  $("custom").addEventListener("input", refreshAll);
  $("build").addEventListener("click", refreshQuery);
  $("searchNow").addEventListener("click", searchNow);
  $("clear").addEventListener("click", clearForm);
  $("copy").addEventListener("click", copyQuery);
  $("restoreWords").addEventListener("click", () => { state.excluded.clear(); refreshAll(); });
  $("referenceSearch").addEventListener("input", renderReference);
  $("clearHistory").addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
  });
}

function currentCollection(){
  return state.type === "tags" ? state.bank.tagCategories : state.bank.categories;
}

function fillLanguages(){
  $("language").innerHTML = state.config.languages.map(x =>
    `<option value="${x.code}">${escapeHtml(x.name)}</option>`).join("");
}

function fillPlatforms(){
  $("platform").innerHTML = state.config.platforms.map(x =>
    `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
}

function fillCategories(){
  if(state.type === "handles"){
    $("category").innerHTML = `<option value="handles">المعرفات المخصصة</option>`;
    $("group").innerHTML = `<option value="handles">بحث بالمعرفات</option>`;
    return;
  }
  const items = currentCollection() || [];
  $("category").innerHTML = items.map((x,i) =>
    `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
  fillGroups();
}

function fillGroups(){
  if(state.type === "handles") return;
  const category = currentCollection()[Number($("category").value)] || {groups:[]};
  $("group").innerHTML = category.groups.map((x,i) =>
    `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
}

function updateCustomField(){
  const handles = state.type === "handles";
  $("customLabelText").textContent = handles ? "إضافة معرفات مخصصة" : "إضافة كلمات مخصصة";
  $("custom").placeholder = handles ? "مثال: @username أو username — افصل المعرفات بفاصلة أو سطر جديد" : "افصل الكلمات بفاصلة أو سطر جديد";
  $("primary").closest("label").hidden = handles;
  $("scope").closest("label").hidden = handles;
}

function renderScenario(){
  if(state.type === "handles"){
    $("scenario").textContent = "أدخل المعرفات المخصصة، وسيتم تجهيزها تلقائيًا بالصيغة المناسبة للمنصة.";
    return;
  }
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  $("scenario").textContent = group?.scenario || category?.desc || "";
}

function baseWords(){
  const custom = splitWords($("custom").value);
  if(state.type === "handles"){
    return unique(custom.map(x => x.startsWith("@") ? x : "@" + x.replace(/^@/,"")));
  }
  const language = $("language").value;
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  const allWords = splitWords(group?.langs?.[language]?.words || "");
  const scope = $("scope").value;
  const limit = scope === "precise" ? 7 : scope === "expanded" ? 14 : allWords.length;
  return unique([...allWords.slice(0, limit), ...custom]);
}

function getWords(){
  return baseWords().filter(word => !state.excluded.has(word));
}

function splitWords(text){
  return String(text || "").split(/[\n،,]+/).map(x => x.trim()).filter(Boolean);
}

function unique(values){
  const seen = new Set();
  return values.filter(value => {
    const key = value.trim().toLocaleLowerCase();
    if(!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function quote(term){
  return /\s/.test(term) ? `"${term.replaceAll('"','')}"` : term;
}

function platformTerms(platform, words){
  const limits = {google:40, x:20, youtube:12, tiktok:6, facebook:8};
  return words.slice(0, limits[platform] || 20);
}

function composeQuery(platform, words, primary){
  const selected = platformTerms(platform, words);
  if(!selected.length) return "";
  if(platform === "google" || platform === "x"){
    const joined = selected.map(quote).join(" OR ");
    const body = selected.length > 1 ? `(${joined})` : joined;
    return primary ? `${quote(primary)} ${body}` : body;
  }
  const plain = selected.map(x => x.replace(/[()]/g, "").replaceAll('"', "")).join(" ");
  return primary ? `${primary.replaceAll('"', "")} ${plain}`.trim() : plain;
}

function refreshAll(){
  renderScenario();
  renderScopeHelp();
  renderPlatformHint();
  renderPreview();
  refreshQuery();
  renderReference();
}

function renderScopeHelp(){
  $("scopeHelp").textContent = state.type === "handles" ? "" : scopeDescriptions[$("scope").value];
}

function renderPlatformHint(){
  const platform = $("platform").value;
  $("platformHint").textContent = platformDescriptions[platform] || "";
}

function renderPreview(){
  const words = baseWords();
  const active = getWords();
  const platform = $("platform").value;
  const acceptedCount = platformTerms(platform, active).length;
  $("previewNote").textContent = words.length
    ? `${active.length} محددة حاليًا، وستستخدم المنصة حتى ${acceptedCount} منها. اضغط على أي كلمة لاستبعادها مؤقتًا.`
    : "أدخل عنصرًا واحدًا على الأقل.";
  $("restoreWords").hidden = state.excluded.size === 0;
  $("wordPreview").innerHTML = words.length ? words.map(word => {
    const excluded = state.excluded.has(word);
    return `<button type="button" class="chip${excluded ? " excluded" : ""}" data-word="${escapeHtml(word)}" aria-pressed="${excluded}">${escapeHtml(word)}<span>${excluded ? "+" : "×"}</span></button>`;
  }).join("") : `<p class="empty">لا توجد عناصر للمعاينة.</p>`;
  $("wordPreview").querySelectorAll(".chip").forEach(btn => btn.addEventListener("click", () => {
    const word = btn.dataset.word;
    state.excluded.has(word) ? state.excluded.delete(word) : state.excluded.add(word);
    renderPreview();
    refreshQuery();
  }));
}

function refreshQuery(){
  const words = getWords();
  const platform = $("platform").value;
  const primary = state.type === "handles" ? "" : $("primary").value.trim();
  const query = composeQuery(platform, words, primary);
  state.query = query;
  $("query").value = query;
  if(!query){
    $("resultTitle").textContent = "لا توجد عناصر للبحث";
    $("copy").disabled = true;
    $("openSearch").href = "#";
    $("openSearch").classList.add("disabled");
    return false;
  }
  const used = platformTerms(platform, words).length;
  $("resultTitle").textContent = `${used} عنصرًا — ${$("platform").selectedOptions[0].textContent}`;
  $("copy").disabled = false;
  $("openSearch").href = makeSearchUrl(platform, query);
  $("openSearch").classList.remove("disabled");
  return true;
}

function searchNow(){
  if(!refreshQuery()){
    alert(state.type === "handles" ? "أدخل معرفًا واحدًا على الأقل." : "لا توجد كلمات محددة للبحث.");
    return;
  }
  saveHistory(state.query);
  window.open(makeSearchUrl($("platform").value, state.query), "_blank", "noopener");
}

function makeSearchUrl(platform, query){
  const q = encodeURIComponent(query);
  const urls = {
    google:`https://www.google.com/search?q=${q}`,
    x:`https://x.com/search?q=${q}&src=typed_query&f=live`,
    tiktok:`https://www.tiktok.com/search?q=${q}`,
    facebook:`https://www.facebook.com/search/top?q=${q}`,
    youtube:`https://www.youtube.com/results?search_query=${q}`
  };
  return urls[platform] || urls.google;
}

async function copyQuery(){
  try{
    await navigator.clipboard.writeText(state.query);
    const old = $("copy").textContent;
    $("copy").textContent = "تم النسخ";
    setTimeout(() => $("copy").textContent = old, 1200);
  }catch{
    $("query").select();
    document.execCommand("copy");
  }
}

function clearForm(){
  $("primary").value = "";
  $("custom").value = "";
  state.excluded.clear();
  refreshAll();
}

function renderReference(){
  if(!state.bank) return;
  if(state.type === "handles"){
    $("referenceList").innerHTML = `<p class="empty">مرجع المجموعات متاح عند اختيار الكلمات المفتاحية أو الوسوم.</p>`;
    return;
  }
  const language = $("language").value;
  const needle = $("referenceSearch").value.trim().toLocaleLowerCase();
  const collection = currentCollection() || [];
  const html = collection.map((category, categoryIndex) => {
    const groups = (category.groups || []).map((group, groupIndex) => {
      const words = splitWords(group?.langs?.[language]?.words || "");
      const haystack = `${category.title} ${group.title} ${group.scenario || ""} ${words.join(" ")}`.toLocaleLowerCase();
      if(needle && !haystack.includes(needle)) return "";
      const isCurrent = Number($("category").value) === categoryIndex && Number($("group").value) === groupIndex;
      return `<details class="reference-item${isCurrent ? " current" : ""}">
        <summary><span>${escapeHtml(group.title)}</span><small>${words.length} كلمة</small></summary>
        ${group.scenario ? `<p>${escapeHtml(group.scenario)}</p>` : ""}
        <div class="reference-words">${words.map(word => `<span>${escapeHtml(word)}</span>`).join("")}</div>
        <button type="button" class="use-group" data-category="${categoryIndex}" data-group="${groupIndex}">استخدام هذه المجموعة</button>
      </details>`;
    }).join("");
    return groups ? `<section class="reference-category"><h3>${escapeHtml(category.title)}</h3>${groups}</section>` : "";
  }).join("");
  $("referenceList").innerHTML = html || `<p class="empty">لا توجد نتائج مطابقة داخل المرجع.</p>`;
  $("referenceList").querySelectorAll(".use-group").forEach(btn => btn.addEventListener("click", () => {
    $("category").value = btn.dataset.category;
    fillGroups();
    $("group").value = btn.dataset.group;
    state.excluded.clear();
    refreshAll();
    window.scrollTo({top:document.querySelector(".controls").offsetTop - 20, behavior:"smooth"});
  }));
}

function saveHistory(query){
  const list = getHistory().filter(x => x.query !== query);
  list.unshift({query, platform:$("platform").value, time:new Date().toLocaleString("ar-SA")});
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0,12)));
  renderHistory();
}

function getHistory(){
  try{return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");}
  catch{return [];}
}

function renderHistory(){
  const list = getHistory();
  $("historyList").innerHTML = list.length ? list.map((x,i) => `
    <div class="history-item">
      <button data-index="${i}" title="إعادة استخدام الاستعلام">
        ${escapeHtml(x.query)}
        <small>${escapeHtml(x.time)} · ${escapeHtml(x.platform)}</small>
      </button>
    </div>`).join("") : `<p class="empty">لا توجد عمليات بحث محفوظة بعد.</p>`;
  $("historyList").querySelectorAll("button").forEach(btn => btn.addEventListener("click", () => {
    const item = getHistory()[Number(btn.dataset.index)];
    $("query").value = item.query;
    state.query = item.query;
    $("copy").disabled = false;
    $("openSearch").href = makeSearchUrl(item.platform, item.query);
    $("openSearch").classList.remove("disabled");
    $("resultTitle").textContent = "استعلام من السجل";
    window.scrollTo({top:$("query").offsetTop - 120, behavior:"smooth"});
  }));
}

function renderStats(){
  const meta = state.bank.meta || {};
  $("stats").innerHTML = [
    `${meta.categories || 0} تصنيفات`,
    `${meta.keywordGroups || 0} مجموعة كلمات`,
    `${meta.tagGroups || 0} مجموعات وسوم`,
    `${state.config.languages.length} لغات`
  ].map(x => `<span class="stat">${x}</span>`).join("");
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[ch]);
}
