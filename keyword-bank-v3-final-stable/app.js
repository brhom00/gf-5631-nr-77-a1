"use strict";
const $ = (id) => document.getElementById(id);
const state = { bank:null, config:null, type:"keywords", query:"" };
const HISTORY_KEY = "keywordBankV2History";

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
    fillCategories();
  }));
  $("category").addEventListener("change", fillGroups);
  $("group").addEventListener("change", renderScenario);
  $("build").addEventListener("click", buildQuery);
  $("clear").addEventListener("click", clearForm);
  $("copy").addEventListener("click", copyQuery);
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
    `<option value="${x.code}">${x.name}</option>`).join("");
}

function fillPlatforms(){
  $("platform").innerHTML = state.config.platforms.map(x =>
    `<option value="${x.id}">${x.name}</option>`).join("");
}

function fillCategories(){
  if(state.type === "handles"){
    $("category").innerHTML = `<option value="handles">المعرفات المخصصة</option>`;
    $("group").innerHTML = `<option value="handles">بحث OR بالمعرفات</option>`;
    return;
  }
  const items = currentCollection() || [];
  $("category").innerHTML = items.map((x,i) =>
    `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
  fillGroups();
  renderScenario();
}

function fillGroups(){
  if(state.type === "handles"){
    renderScenario();
    return;
  }
  const category = currentCollection()[Number($("category").value)] || {groups:[]};
  $("group").innerHTML = category.groups.map((x,i) =>
    `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
  renderScenario();
}

function renderScenario(){
  if(state.type === "handles"){
    $("scenario").textContent = "أدخل المعرفات المخصصة، وسيتم تجهيزها تلقائيًا بصيغة OR.";
    return;
  }
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  $("scenario").textContent = group?.scenario || category?.desc || "";
}

function getWords(){
  const language = $("language").value;
  const custom = splitWords($("custom").value);
  if(state.type === "handles"){
    return custom.map(x => x.startsWith("@") ? x : "@" + x.replace(/^@/,""));
  }
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  const raw = group?.langs?.[language]?.words || "";
  const allWords = splitWords(raw);
  const scope = $("scope").value;
  const limit = scope === "precise" ? 7 : scope === "expanded" ? 14 : allWords.length;
  return unique([...allWords.slice(0, limit), ...custom]);
}

function splitWords(text){
  return text.split(/[\n،,]+/).map(x => x.trim()).filter(Boolean);
}

function unique(values){
  return [...new Set(values.map(x => x.trim()).filter(Boolean))];
}

function quote(term){
  return /\s/.test(term) ? `"${term.replaceAll('"','')}"` : term;
}

function buildQuery(){
  const words = getWords();
  if(!words.length){
    alert(state.type === "handles" ? "أدخل معرفًا واحدًا على الأقل." : "لا توجد كلمات في هذه المجموعة.");
    return;
  }
  const primary = $("primary").value.trim();
  let terms = words.map(quote).join(" OR ");
  let query = words.length > 1 ? `(${terms})` : terms;
  if(primary) query = `${quote(primary)} ${query}`;

  state.query = query;
  $("query").value = query;
  $("resultTitle").textContent = `${words.length} عنصرًا — ${$("platform").selectedOptions[0].textContent}`;
  $("copy").disabled = false;
  const url = makeSearchUrl($("platform").value, query);
  $("openSearch").href = url;
  $("openSearch").classList.remove("disabled");
  saveHistory(query);
}

function makeSearchUrl(platform, query){
  const q = encodeURIComponent(query);
  const urls = {
    google:`https://www.google.com/search?q=${q}`,
    x:`https://x.com/search?q=${q}&src=typed_query`,
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
  $("query").value = "";
  $("resultTitle").textContent = "جاهز للبناء";
  $("copy").disabled = true;
  $("openSearch").href = "#";
  $("openSearch").classList.add("disabled");
  state.query = "";
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