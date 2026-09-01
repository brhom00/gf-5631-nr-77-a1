"use strict";
const $ = (id) => document.getElementById(id);
const state = { bank:null, config:null, type:"keywords", query:"", excluded:new Set(), translating:false, calendar:"gregorian" };
const HISTORY_KEY = "keywordBankV3History";
const CUSTOM_CATEGORY = "__custom__";
const SETTINGS_KEY = "keywordBankV4Settings";

const scopeDescriptions = {
  precise:"يستخدم أول 7 كلمات ذات أولوية لنتائج أكثر تركيزًا.",
  expanded:"يستخدم حتى 14 كلمة لتغطية المرادفات والصيغ الشائعة.",
  comprehensive:"يستخدم جميع كلمات المجموعة، وقد يزيد عدد النتائج غير المطابقة."
};
const platformDescriptions = {
  google:"Google يدعم عبارات البحث المتقدمة وOR، لذلك يُرسل الاستعلام كاملًا.",
  x:"X يدعم OR والعبارات بين علامتي اقتباس، مع تقليل الاستعلام الطويل تلقائيًا.",
  youtube:"YouTube يعمل أفضل باستعلام مختصر دون معاملات منطقية معقدة.",
  tiktok:"سيتم البحث عبر Google داخل TikTok باستخدام site:tiktok.com مع دعم OR والعبارات الدقيقة.",
  instagram:"سيتم البحث عبر Google داخل Instagram باستخدام site:instagram.com مع دعم OR والعبارات الدقيقة.",
  facebook:"سيتم البحث عبر Google داخل Facebook باستخدام site:facebook.com مع دعم OR والعبارات الدقيقة."
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
    bind(); fillLanguages(); fillPlatforms(); fillCategories(); initAdvancedControls(); loadSettings(); renderStats(); renderHistory(); updateCustomField(); refreshAll();
  }catch(error){
    document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="error">${escapeHtml(error.message)} افتح المشروع عبر GitHub Pages أو خادم محلي، وليس بصيغة file://.</p>`);
  }
}

function bind(){
  document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  state.type = btn.dataset.type;

  const tiktokPanel = document.getElementById("tiktokPanel");
  const contentSection = document.querySelector(".content-section");
const keywordOnlySections = [
  document.getElementById("customWordsPanel"),
  document.querySelector(".editor-section"),
  document.querySelector(".settings-section"),
document.querySelector(".query-drawer"),
...document.querySelectorAll(".utility")
].filter(Boolean);

if (state.type === "tiktok") {
  if (contentSection) contentSection.hidden = true;
  if (tiktokPanel) tiktokPanel.hidden = false;

  keywordOnlySections.forEach(section => {
    section.hidden = true;
  });

} else {
  if (contentSection) contentSection.hidden = false;
  if (tiktokPanel) tiktokPanel.hidden = true;

  keywordOnlySections.forEach(section => {
    section.hidden = false;
  });

  fillCategories();
  updateCustomField();
  refreshAll();
}
}));
  $("language").addEventListener("change", () => { state.excluded.clear(); if(isCustomMode()){ $("translatedWords").value=""; setTranslationStatus("تغيّرت لغة البحث؛ اضغط ترجمة من جديد.","warning"); } updateTranslationLabel(); refreshAll(); });
  $("platform").addEventListener("change", refreshAll);
  $("category").addEventListener("change", () => { state.excluded.clear(); fillGroups(); updateCustomField(); refreshAll(); });
  $("group").addEventListener("change", () => { state.excluded.clear(); refreshAll(); });
  $("scope").addEventListener("change", () => { state.excluded.clear(); refreshAll(); });
  $("primary").addEventListener("input", refreshQuery);
  $("custom").addEventListener("input", refreshAll);
  $("customSource").addEventListener("input", () => { clearCustomValidation(); setTranslationStatus(""); refreshAll(); });
  $("translatedWords").addEventListener("input", refreshAll);
  $("translateWords").addEventListener("click", translateCustomWords);
  $("openGoogleTranslate").addEventListener("click", openGoogleTranslate);
  $("quickAddButton").addEventListener("click", quickAddWord);
  $("tiktokAnalyze")?.addEventListener("click", analyzeTikTokComments);
  $("quickAddWord").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); quickAddWord(); } });
  $("build").addEventListener("click", refreshQuery);
   $("tiktokQuickAddButton")?.addEventListener("click", addTikTokWord);
  $("tiktokClearWords")?.addEventListener("click", clearTikTokWords);
$("tiktokQuickAddWord")?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    addTikTokWord();
  }
});
  $("tiktokLanguage")?.addEventListener("change", translateTikTokWords);
  $("searchNow").addEventListener("click", searchNow);
  $("clear").addEventListener("click", clearForm);
  $("copy").addEventListener("click", copyQuery);
  $("restoreWords").addEventListener("click", () => { state.excluded.clear(); refreshAll(); });
  $("referenceSearch").addEventListener("input", renderReference);
  $("clearHistory").addEventListener("click", () => { localStorage.removeItem(HISTORY_KEY); renderHistory(); });
  $("timeRange").addEventListener("change", () => { saveSettings(); refreshAll(); });
  $("customDateToggle").addEventListener("change", toggleCustomDatePanel);
  $("startDate").addEventListener("change", onGregorianDateChange);
  $("endDate").addEventListener("change", onGregorianDateChange);
  $("todayShortcut").addEventListener("click", () => setDateShortcut(0));
  $("yesterdayShortcut").addEventListener("click", () => setDateShortcut(-1));
  $("exactMatch").addEventListener("change", () => { saveSettings(); refreshAll(); });
  $("includeRetweets").addEventListener("change", () => { saveSettings(); refreshAll(); });
  document.querySelectorAll(".calendar-option").forEach(btn => btn.addEventListener("click", () => switchCalendar(btn.dataset.calendar)));
  ["hStartDay","hStartMonth","hStartYear","hEndDay","hEndMonth","hEndYear"].forEach(id => $(id).addEventListener("change", onHijriDateChange));
  ["language","platform","category","group","scope"].forEach(id => $(id)?.addEventListener("change", saveSettings));
}


function currentCollection(){ return state.type === "tags" ? state.bank.tagCategories : state.bank.categories; }
function isCustomMode(){ return (state.type === "keywords" || state.type === "tags") && $("category")?.value === CUSTOM_CATEGORY; }

function fillLanguages(){ $("language").innerHTML = state.config.languages.map(x => `<option value="${x.code}">${escapeHtml(x.name)}</option>`).join(""); }
function fillPlatforms(){ $("platform").innerHTML = state.config.platforms.map(x => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join(""); }

function fillCategories(){
  if(state.type === "handles"){
    $("category").innerHTML = `<option value="handles">المعرفات المخصصة</option>`;
    $("group").innerHTML = `<option value="handles">بحث بالمعرفات</option>`;
    return;
  }
  const items = currentCollection() || [];
  let html = items.map((x,i) => `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
  if(state.type === "keywords") html += `<option value="${CUSTOM_CATEGORY}">كلمات مخصصة</option>`;
  if(state.type === "tags") html += `<option value="${CUSTOM_CATEGORY}">وسوم مخصصة</option>`;
  $("category").innerHTML = html;
  fillGroups();
}

function fillGroups(){
  if(state.type === "handles" || isCustomMode()){ $("group").innerHTML = ""; return; }
  const category = currentCollection()[Number($("category").value)] || {groups:[]};
  $("group").innerHTML = category.groups.map((x,i) => `<option value="${i}">${escapeHtml(x.title)}</option>`).join("");
}

function updateCustomField(){
  const handles = state.type === "handles";
  const customMode = isCustomMode();
  $("groupLabel").hidden = handles || customMode;
  $("languageLabel").hidden = handles;
  $("scopeLabel").hidden = handles || customMode;
  $("customWordsPanel").hidden = !customMode;
  $("customLabel").hidden = customMode;
  $("customLabelText").textContent = handles ? "إضافة معرفات مخصصة" : state.type === "tags" ? "إضافة وسوم مخصصة" : "إضافة كلمات مخصصة";
  $("custom").placeholder = handles ? "مثال: @username أو username — افصل المعرفات بفاصلة أو سطر جديد" : "افصل الكلمات بفاصلة أو سطر جديد";
  $("primary").closest("label").hidden = handles;
  $("scope").closest("label").hidden = handles || customMode;
  updateTranslationLabel();
}

function updateTranslationLabel(){
  const name = $("language")?.selectedOptions?.[0]?.textContent || "اللغة المختارة";
  $("translatedLabelText").textContent = `الترجمة إلى ${name}`;
  $("translateWords").textContent = `ترجمة إلى ${name}`;
}

function renderScenario(){
  if(state.type === "handles") return void ($("scenario").textContent = "أدخل المعرفات المخصصة، وسيتم تجهيزها تلقائيًا بالصيغة المناسبة للمنصة.");
  if(isCustomMode()) return void ($("scenario").textContent = state.type === "tags" ? "اكتب كل وسم في سطر مستقل من دون #؛ ستُترجم ثم تُجهز للبحث." : "اكتب كل كلمة أو عبارة في سطر مستقل، ثم ترجمها إلى لغة البحث المختارة وراجعها قبل التنفيذ.");
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  $("scenario").textContent = group?.scenario || category?.desc || "";
}

function baseWords(){
  if(isCustomMode()){
    const translated = splitLines($("translatedWords").value);
    return unique(translated.length ? translated : splitLines($("customSource").value));
  }
  const custom = splitWords($("custom").value);
  if(state.type === "handles") return unique(custom.map(x => x.startsWith("@") ? x : "@" + x.replace(/^@/,"")));
  const language = $("language").value;
  const category = currentCollection()[Number($("category").value)];
  const group = category?.groups?.[Number($("group").value)];
  const allWords = splitWords(group?.langs?.[language]?.words || "");
  const scope = $("scope").value;
  const limit = scope === "precise" ? 7 : scope === "expanded" ? 14 : allWords.length;
  return unique([...allWords.slice(0, limit), ...custom]);
}
function getWords(){ return baseWords().filter(word => !state.excluded.has(word)); }
function splitWords(text){ return String(text || "").split(/[\n،,]+/).map(x => x.trim()).filter(Boolean); }
function splitLines(text){ return String(text || "").split(/\n+/).map(x => x.trim()).filter(Boolean); }
function unique(values){ const seen=new Set(); return values.filter(value=>{ const key=value.trim().toLocaleLowerCase(); if(!key||seen.has(key))return false; seen.add(key); return true; }); }
function quote(term){ const clean=term.replaceAll('"',''); return $("exactMatch")?.checked || /\s/.test(clean) ? `"${clean}"` : clean; }
function platformTerms(platform, words){ const limits={google:40,x:20,youtube:12,tiktok:40,instagram:40,facebook:40}; return words.slice(0,limits[platform]||20); }
function platformSite(platform){ return {tiktok:"tiktok.com",instagram:"instagram.com",facebook:"facebook.com"}[platform] || ""; }
function composeQuery(platform, words, primary){
  const selected=platformTerms(platform,words); if(!selected.length)return "";
  if(platform==="google"||platform==="x"||platformSite(platform)){
    const joined=selected.map(quote).join(" OR "); const body=selected.length>1?`(${joined})`:joined;
    const core=primary?`${quote(primary)} ${body}`:body;
    const site=platformSite(platform);
    let result=site?`site:${site} ${core}`:core;
    if(platform==="x" && !$("includeRetweets").checked) result += " -filter:retweets";
    const xTime=platform==="x" ? getXTimeOperators() : "";
    return xTime ? `${result} ${xTime}` : result;
  }
  const plain=selected.map(x=>x.replace(/[()]/g,"").replaceAll('"',"")).join(" ");
  return primary?`${primary.replaceAll('"',"")} ${plain}`.trim():plain;
}

function refreshAll(){ renderScenario(); renderScopeHelp(); renderPlatformHint(); renderPreview(); refreshQuery(); renderReference(); renderSummary(); updateRetweetVisibility(); saveSettings(); }
function renderScopeHelp(){ $("scopeHelp").textContent = state.type === "handles" || isCustomMode() ? "" : scopeDescriptions[$("scope").value]; }
function renderPlatformHint(){
  const platform=$("platform").value,time=getTimeSelection();
  let text=platformDescriptions[platform]||"";
  if(platform==="youtube"&&time.mode!=="all") text+=" عند اختيار مدة زمنية، يُنفذ البحث عبر Google داخل YouTube لضمان تطبيق المدة.";
  if(platform==="x"&&time.mode!=="all") text+=" يستخدم X حدودًا زمنية بالثواني لأعلى دقة ممكنة.";
  $("platformHint").textContent=text;
}

function renderPreview(){
  const words=baseWords(), active=getWords(), platform=$("platform").value, acceptedCount=platformTerms(platform,active).length;
  $("previewNote").textContent=words.length?`${active.length} مستخدمة الآن · المنصة تقبل حتى ${acceptedCount}`:"أدخل عنصرًا واحدًا على الأقل.";
  $("restoreWords").hidden=state.excluded.size===0;
  $("wordPreview").innerHTML=words.length?words.map(word=>{const excluded=state.excluded.has(word);return `<span class="chip${excluded?" excluded":""}" data-word="${escapeHtml(word)}"><button type="button" class="chip-label" aria-label="تعديل ${escapeHtml(word)}">${escapeHtml(word)}</button><button type="button" class="chip-remove" aria-label="${excluded?"إعادة":"حذف"} ${escapeHtml(word)}">${excluded?"+":"×"}</button></span>`;}).join(""):`<p class="empty">لا توجد عناصر للمعاينة.</p>`;
  $("wordPreview").querySelectorAll(".chip-remove").forEach(btn=>btn.addEventListener("click",()=>{const word=btn.parentElement.dataset.word;state.excluded.has(word)?state.excluded.delete(word):state.excluded.add(word);renderPreview();refreshQuery();renderSummary();}));
  $("wordPreview").querySelectorAll(".chip-label").forEach(btn=>btn.addEventListener("click",()=>editWord(btn.parentElement.dataset.word)));
}

function quickAddWord(){
  const input=$("quickAddWord"), word=input.value.trim(); if(!word)return;
  const target=isCustomMode()?$("translatedWords"):$("custom");
  target.value=[target.value.trim(),word].filter(Boolean).join("\n"); input.value=""; state.excluded.delete(word); refreshAll(); input.focus();
}
function editWord(oldWord){
  const next=prompt("عدّل الكلمة:",oldWord); if(next===null)return; const clean=next.trim(); if(!clean)return;
  const source=isCustomMode()?$("translatedWords"):$("custom");
  let values=splitWords(source.value);
  const idx=values.findIndex(x=>x===oldWord);
  if(idx>=0) values[idx]=clean; else { state.excluded.add(oldWord); values.push(clean); }
  source.value=unique(values).join("\n"); refreshAll();
}

function refreshQuery(){
  const words=getWords(), platform=$("platform").value, primary=state.type==="handles"?"":$("primary").value.trim(), query=composeQuery(platform,words,primary);
  state.query=query; $("query").value=query;
  if(!query){ $("resultTitle").textContent="لا توجد عناصر للبحث"; $("copy").disabled=true; $("openSearch").href="#"; $("openSearch").classList.add("disabled"); return false; }
  $("resultTitle").textContent=`${platformTerms(platform,words).length} عنصرًا — ${$("platform").selectedOptions[0].textContent}`;
  $("copy").disabled=false; $("openSearch").href=makeSearchUrl(platform,query); $("openSearch").classList.remove("disabled"); return true;
}

function searchNow(){
  if(isCustomMode() && !splitLines($("customSource").value).length){ markCustomInvalid(); alert(state.type==="tags"?"اكتب وسمًا واحدًا على الأقل.":"اكتب كلمة أو عبارة واحدة على الأقل."); return; }
  if(isCustomMode()){ const source=splitLines($("customSource").value), target=$("language").value, translated=splitLines($("translatedWords").value); if(needsTranslation(source,target) && !translated.length){ setTranslationStatus("اضغط ترجمة أولًا، ثم راجع النتيجة.","error"); $("translateWords").focus(); return; } }
  if($("customDateToggle").checked && !validateDateRange()){ alert("راجع تاريخ البداية والنهاية قبل البحث."); return; }
  if(!refreshQuery()){ alert(state.type==="handles"?"أدخل معرفًا واحدًا على الأقل.":"لا توجد كلمات محددة للبحث."); return; }
  saveSettings(); saveHistory(state.query); window.open(makeSearchUrl($("platform").value,state.query),"_blank","noopener");
}
function makeSearchUrl(platform,query){
  const q=encodeURIComponent(query);
  if(platform==="x") return `https://x.com/search?q=${q}&src=typed_query&f=live`;
  const time=getTimeSelection();
  if(platform==="youtube" && time.mode==="all") return `https://www.youtube.com/results?search_query=${q}`;
  const googleQuery=platform==="youtube" ? `site:youtube.com ${query}` : query;
  const params=new URLSearchParams({q:googleQuery});
  const tbs=getGoogleTimeParam(time);
  if(tbs) params.set("tbs",tbs);
  return `https://www.google.com/search?${params.toString()}`;
}

async function translateCustomWords(){
  const sourceWords=splitLines($("customSource").value);
  if(!sourceWords.length){ markCustomInvalid(); setTranslationStatus("اكتب الكلمات أولًا.","error"); return; }
  clearCustomValidation();

  const targetLanguage=$("language").value;
  if(targetLanguage==="ar"){
    $("translatedWords").value=sourceWords.join("\n");
    setTranslationStatus("اللغة العربية لا تحتاج ترجمة.","success");
    state.excluded.clear(); refreshAll();
    return;
  }

  state.translating=true;
  $("translateWords").disabled=true;
  $("translateWords").textContent="جاري الترجمة...";
  setTranslationStatus(`جاري الترجمة: 0 من ${sourceWords.length}`,"loading");

  const target=googleTranslateApiTargetCode(targetLanguage);
  const translations=[];

  try{
    for(let i=0;i<sourceWords.length;i++){
      const term=sourceWords[i];
      let translated=findBankTranslation(term,targetLanguage);

      if(!translated){
        const url=
          "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl="+
          encodeURIComponent(target)+
          "&dt=t&q="+
          encodeURIComponent(term);

        const response=await fetch(url);
        if(!response.ok) throw new Error("فشل الاتصال بخدمة الترجمة");

        const data=await response.json();
        translated="";
        if(data && data[0] && data[0][0] && data[0][0][0]){
          translated=data[0].map(function(part){ return part[0] || ""; }).join("").trim();
        }
      }

      translations.push(translated || term);
      setTranslationStatus(`جاري الترجمة: ${i+1} من ${sourceWords.length}`,"loading");
    }

    $("translatedWords").value=translations.join("\n");
    setTranslationStatus(`تمت ترجمة ${translations.length} عنصر بنجاح.`,"success");
    state.excluded.clear();
    refreshAll();
  }catch(error){
    console.error("Translation error",error);
    setTranslationStatus("تعذرت الترجمة التلقائية. جرّب مرة أخرى أو استخدم زر Google Translate.","error");
  }finally{
    state.translating=false;
    $("translateWords").disabled=false;
    updateTranslationLabel();
  }
}

function googleTranslateApiTargetCode(langCode){
  const map={ar:"ar",ur:"ur",en:"en",ha:"ha",fr:"fr",tr:"tr",he:"iw",fa:"fa"};
  return map[langCode] || langCode;
}

function findBankTranslation(term,target){
  const normalized=normalize(term);
  for(const collection of [state.bank.categories||[],state.bank.tagCategories||[]]){
    for(const category of collection){
      for(const group of category.groups||[]){
        for(const sourceData of Object.values(group.langs||{})){
          const sourceWords=splitWords(sourceData?.words||"");
          const index=sourceWords.findIndex(word=>normalize(word)===normalized);
          if(index<0) continue;
          const targetWords=splitWords(group.langs?.[target]?.words||"");
          if(targetWords[index]) return targetWords[index];
          if(targetWords.length===1) return targetWords[0];
        }
      }
    }
  }
  return "";
}

function detectSourceLanguage(text){
  if(/[֐-׿]/.test(text)) return "he";
  if(/[؀-ۿ]/.test(text)){
    if(/[پچژگکی]/.test(text)) return "fa";
    if(/[ٹڈڑںھۓے]/.test(text)) return "ur";
    return "ar";
  }
  if(/[çğıöşüÇĞİÖŞÜ]/.test(text)) return "tr";
  return "en";
}
function termAlreadyTarget(text,target){ return detectSourceLanguage(text)===target; }
function needsTranslation(words,target){ return words.some(word=>!termAlreadyTarget(word,target)); }

function openGoogleTranslate(){
  const text=splitLines($("customSource").value).join("\n");
  if(!text){ markCustomInvalid(); setTranslationStatus("اكتب الكلمات أولًا.","error"); return; }
  const target=$("language").value;
  window.open(`https://translate.google.com/?sl=auto&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}&op=translate`,"_blank","noopener");
}
function setTranslationStatus(message,type=""){ $("translationStatus").textContent=message; $("translationStatus").className=`translation-status${type?` ${type}`:""}`; }
function markCustomInvalid(){ $("customSource").classList.add("custom-invalid"); $("customSource").focus(); }
function clearCustomValidation(){ $("customSource").classList.remove("custom-invalid"); }
function normalize(value){ return String(value||"").trim().toLocaleLowerCase().replace(/[ـًٌٍَُِّْ]/g,"").replace(/\s+/g," "); }

async function copyQuery(){ try{await navigator.clipboard.writeText(state.query);const old=$("copy").textContent;$("copy").textContent="تم النسخ";setTimeout(()=>$("copy").textContent=old,1200);}catch{$("query").select();document.execCommand("copy");} }
function clearForm(){ $("primary").value=""; $("custom").value=""; $("customSource").value=""; $("translatedWords").value=""; $("timeRange").value="all"; $("customDateToggle").checked=false; toggleCustomDatePanel(); setTranslationStatus(""); clearCustomValidation(); state.excluded.clear(); refreshAll(); }

function renderReference(){
  if(!state.bank)return;
  if(state.type==="handles"||isCustomMode()){ $("referenceList").innerHTML=`<p class="empty">مرجع المجموعات متاح عند اختيار تصنيف من قاعدة البيانات.</p>`; return; }
  const language=$("language").value,needle=$("referenceSearch").value.trim().toLocaleLowerCase(),collection=currentCollection()||[];
  const html=collection.map((category,categoryIndex)=>{const groups=(category.groups||[]).map((group,groupIndex)=>{const words=splitWords(group?.langs?.[language]?.words||"");const haystack=`${category.title} ${group.title} ${group.scenario||""} ${words.join(" ")}`.toLocaleLowerCase();if(needle&&!haystack.includes(needle))return "";const isCurrent=Number($("category").value)===categoryIndex&&Number($("group").value)===groupIndex;return `<details class="reference-item${isCurrent?" current":""}"><summary><span>${escapeHtml(group.title)}</span><small>${words.length} كلمة</small></summary>${group.scenario?`<p>${escapeHtml(group.scenario)}</p>`:""}<div class="reference-words">${words.map(word=>`<span>${escapeHtml(word)}</span>`).join("")}</div><button type="button" class="use-group" data-category="${categoryIndex}" data-group="${groupIndex}">استخدام هذه المجموعة</button></details>`;}).join("");return groups?`<section class="reference-category"><h3>${escapeHtml(category.title)}</h3>${groups}</section>`:"";}).join("");
  $("referenceList").innerHTML=html||`<p class="empty">لا توجد نتائج مطابقة داخل المرجع.</p>`;
  $("referenceList").querySelectorAll(".use-group").forEach(btn=>btn.addEventListener("click",()=>{$("category").value=btn.dataset.category;fillGroups();$("group").value=btn.dataset.group;updateCustomField();state.excluded.clear();refreshAll();window.scrollTo({top:document.querySelector(".controls").offsetTop-20,behavior:"smooth"});}));
}
function saveHistory(query){const list=getHistory().filter(x=>x.query!==query);list.unshift({query,platform:$("platform").value,time:new Date().toLocaleString("ar-SA")});localStorage.setItem(HISTORY_KEY,JSON.stringify(list.slice(0,12)));renderHistory();}
function getHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||"[]");}catch{return[];}}
function renderHistory(){const list=getHistory();$("historyList").innerHTML=list.length?list.map((x,i)=>`<div class="history-item"><button data-index="${i}" title="إعادة استخدام الاستعلام">${escapeHtml(x.query)}<small>${escapeHtml(x.time)} · ${escapeHtml(x.platform)}</small></button></div>`).join(""):`<p class="empty">لا توجد عمليات بحث محفوظة بعد.</p>`;$("historyList").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{const item=getHistory()[Number(btn.dataset.index)];$("query").value=item.query;state.query=item.query;$("copy").disabled=false;$("openSearch").href=makeSearchUrl(item.platform,item.query);$("openSearch").classList.remove("disabled");$("resultTitle").textContent="استعلام من السجل";window.scrollTo({top:$("query").offsetTop-120,behavior:"smooth"});}));}
function renderStats(){const meta=state.bank.meta||{};$("stats").innerHTML=[`${meta.categories||0} تصنيفات`,`${meta.keywordGroups||0} مجموعة كلمات`,`${meta.tagGroups||0} مجموعات وسوم`,`${state.config.languages.length} لغات`].map(x=>`<span class="stat">${x}</span>`).join("");}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"})[ch]);}

function initAdvancedControls(){
  const today=isoDate(new Date());
  $("startDate").max=today; $("endDate").max=today;
  populateHijriSelectors();
  switchCalendar("gregorian");
  toggleCustomDatePanel();
}
function toggleCustomDatePanel(){
  const enabled=$("customDateToggle").checked;
  $("customDatePanel").hidden=!enabled;
  $("timeRange").disabled=enabled;
  if(enabled && !$("startDate").value) setDateShortcut(0); else refreshAll();
}
function switchCalendar(calendar){
  state.calendar=calendar;
  document.querySelectorAll(".calendar-option").forEach(x=>x.classList.toggle("active",x.dataset.calendar===calendar));
  $("gregorianDates").hidden=calendar!=="gregorian";
  $("hijriDates").hidden=calendar!=="hijri";
  saveSettings(); refreshAll();
}
function onGregorianDateChange(){ validateDateRange(); refreshAll(); }
function setDateShortcut(offset){
  const d=new Date(); d.setDate(d.getDate()+offset);
  const value=isoDate(d); $("startDate").value=value; $("endDate").value=value;
  syncHijriFromGregorian(value,"Start"); syncHijriFromGregorian(value,"End");
  validateDateRange(); refreshAll();
}
function populateHijriSelectors(){
  const current=getHijriParts(new Date());
  const months=["محرم","صفر","ربيع الأول","ربيع الآخر","جمادى الأولى","جمادى الآخرة","رجب","شعبان","رمضان","شوال","ذو القعدة","ذو الحجة"];
  for(const side of ["Start","End"]){
    $("h"+side+"Day").innerHTML=Array.from({length:30},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("");
    $("h"+side+"Month").innerHTML=months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join("");
    $("h"+side+"Year").innerHTML=Array.from({length:21},(_,i)=>current.year-10+i).map(y=>`<option value="${y}">${y}</option>`).join("");
    $("h"+side+"Day").value=current.day; $("h"+side+"Month").value=current.month; $("h"+side+"Year").value=current.year;
  }
  onHijriDateChange();
}
function getHijriParts(date){
  const parts=new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",{year:"numeric",month:"numeric",day:"numeric"}).formatToParts(date);
  const obj={}; parts.forEach(p=>{if(["year","month","day"].includes(p.type)) obj[p.type]=Number(p.value)}); return obj;
}
function hijriToGregorian(year,month,day){
  const approxYear=year-579;
  const start=new Date(approxYear-2,0,1), end=new Date(approxYear+2,11,31);
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
    const h=getHijriParts(d); if(h.year===year&&h.month===month&&h.day===day) return isoDate(d);
  }
  return "";
}
function syncHijriFromGregorian(value,side){
  if(!value)return; const h=getHijriParts(new Date(value+"T12:00:00"));
  $("h"+side+"Day").value=h.day; $("h"+side+"Month").value=h.month; $("h"+side+"Year").value=h.year;
  $("h"+side+"Converted").textContent=`الميلادي: ${value}`;
}
function onHijriDateChange(){
  for(const side of ["Start","End"]){
    const y=Number($("h"+side+"Year").value),m=Number($("h"+side+"Month").value),d=Number($("h"+side+"Day").value);
    const g=hijriToGregorian(y,m,d); $("h"+side+"Converted").textContent=g?`الميلادي: ${g}`:"تاريخ غير صالح";
    if(g) $(side==="Start"?"startDate":"endDate").value=g;
  }
  validateDateRange(); refreshAll();
}
function validateDateRange(){
  const s=$("startDate").value,e=$("endDate").value,today=isoDate(new Date());
  let msg="",bad=false;
  if($("customDateToggle").checked){
    if(!s||!e){msg="اختر تاريخ البداية والنهاية.";bad=true}
    else if(s>e){msg="تاريخ النهاية يجب ألا يسبق تاريخ البداية.";bad=true}
    else if(e>today){msg="لا يمكن اختيار تاريخ مستقبلي.";bad=true}
  }
  $("startDate").classList.toggle("invalid-date",bad); $("endDate").classList.toggle("invalid-date",bad);
  $("dateStatus").textContent=msg; $("dateStatus").className=`translation-status${bad?" error":""}`; return !bad;
}
function getTimeSelection(){
  if($("customDateToggle").checked) return {mode:"custom",start:$("startDate").value,end:$("endDate").value};
  return {mode:$("timeRange").value};
}
function getGoogleTimeParam(time){
  const map={"1h":"qdr:h","3h":"qdr:h3","8h":"qdr:h8","24h":"qdr:d","3d":"qdr:d3","7d":"qdr:w"};
  if(time.mode==="custom"&&time.start&&time.end){
    const fmt=x=>{const [y,m,d]=x.split("-");return `${m}/${d}/${y}`};
    return `cdr:1,cd_min:${fmt(time.start)},cd_max:${fmt(time.end)}`;
  }
  return map[time.mode]||"";
}
function getXTimeOperators(){
  const time=getTimeSelection(); if(time.mode==="all")return "";
  let start,end=new Date();
  const amounts={"1h":1,"3h":3,"8h":8,"24h":24,"3d":72,"7d":168};
  if(time.mode==="custom"){
    if(!time.start||!time.end)return "";
    start=new Date(time.start+"T00:00:00"); end=new Date(time.end+"T23:59:59");
  }else start=new Date(Date.now()-amounts[time.mode]*3600000);
  return `since_time:${Math.floor(start.getTime()/1000)} until_time:${Math.floor(end.getTime()/1000)}`;
}
function renderSummary(){
  const words=getWords(),time=getTimeSelection();
  const timeNames={all:"جميع الأوقات","1h":"آخر ساعة","3h":"آخر 3 ساعات","8h":"آخر 8 ساعات","24h":"آخر 24 ساعة","3d":"آخر 3 أيام","7d":"آخر 7 أيام",custom:`${time.start||"—"} إلى ${time.end||"—"}`};
  $("wordCount").textContent=`${words.length} كلمة`;
  $("topWordCount").textContent=`${words.length} كلمة`;
  $("dockCount").textContent=`${words.length} كلمة`;
  $("dockSummary").textContent=`${$("platform").selectedOptions[0]?.textContent||"بحث"} · ${$("language").selectedOptions[0]?.textContent||""}`;
  const items=[
    ["المنصة",$("platform").selectedOptions[0]?.textContent||"—"],
    ["اللغة",$("language").selectedOptions[0]?.textContent||"—"],
    ["التصنيف",$("category").selectedOptions[0]?.textContent||"—"],
    ["المدة",timeNames[time.mode]||"—"],
    ["نوع التقويم",state.calendar==="hijri"?"هجري":"ميلادي"],
    ["المطابقة",$("exactMatch").checked?"عبارات كاملة":"مرنة"]
  ];
  $("summaryGrid").innerHTML=items.map(([k,v])=>`<div class="summary-item"><small>${escapeHtml(k)}</small><strong>${escapeHtml(v)}</strong></div>`).join("");
}
function updateRetweetVisibility(){ $("retweetOption").hidden=$("platform").value!=="x"; }
function saveSettings(){
  if(!state.bank)return;
  const data={language:$("language").value,platform:$("platform").value,category:$("category").value,group:$("group").value,scope:$("scope").value,timeRange:$("timeRange").value,customDate:$("customDateToggle").checked,calendar:state.calendar,startDate:$("startDate").value,endDate:$("endDate").value,exact:$("exactMatch").checked,retweets:$("includeRetweets").checked,type:state.type};
  localStorage.setItem(SETTINGS_KEY,JSON.stringify(data));
}
function loadSettings(){
  try{
    const x=JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}");
    if(x.language&&[...$("language").options].some(o=>o.value===x.language))$("language").value=x.language;
    if(x.platform&&[...$("platform").options].some(o=>o.value===x.platform))$("platform").value=x.platform;
    if(x.scope)$("scope").value=x.scope;
    if(x.timeRange)$("timeRange").value=x.timeRange;
    $("customDateToggle").checked=!!x.customDate; $("exactMatch").checked=!!x.exact; $("includeRetweets").checked=x.retweets!==false;
    if(x.startDate)$("startDate").value=x.startDate;if(x.endDate)$("endDate").value=x.endDate;
    switchCalendar(x.calendar||"gregorian"); toggleCustomDatePanel();
  }catch{}
}
function isoDate(date){ const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }




async function analyzeTikTokComments() {
  const url = $("tiktokUrl")?.value.trim();
  const maxComments = Number($("tiktokMaxComments")?.value || 100);
  const status = $("tiktokStatus");
  const results = $("tiktokResults");

  if (!url) {
    if (status) status.textContent = "أدخل رابط فيديو TikTok أولاً.";
    return;
  }

  if (status) status.textContent = "جاري جلب التعليقات...";
  if (results) results.innerHTML = "";

  try {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url,
        maxComments
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.details || data?.error || "تعذر جلب التعليقات");
    }

    const comments = Array.isArray(data.comments) ? data.comments : [];
    window.lastTikTokComments = comments;
const searchWords = ($("tiktokWords")?.value || "")
  .split(/[،,\n]+/)
  .map(word => word.trim())
  .filter(Boolean);
const matchedComments = comments.filter(item => {
  const text = String(
    item.text ||
    item.commentText ||
    item.comment ||
    ""
  ).toLowerCase();

  return searchWords.some(word =>
    text.includes(String(word).toLowerCase())
  );
});

if (status) status.textContent = `تم جلب ${comments.length} تعليق، ووجدنا ${matchedComments.length} تعليق مطابق.`;

if (!matchedComments.length) {
      if (results) results.innerHTML = "<p>لم يتم العثور على تعليقات.</p>";
      return;
    }

    if (results) {
     results.innerHTML = `
  <ul class="tiktok-results-list">
    ${matchedComments.map(item => {
      const text = escapeHtml(
        item.text || item.commentText || item.comment || ""
      );

      return `<li>${text}</li>`;
    }).join("")}
  </ul>
`;
    }

  } catch (error) {
    console.error(error);
    if (status) status.textContent = "حدث خطأ أثناء جلب التعليقات.";
  }
}



$("tiktokSearchButton")?.addEventListener("click", () => {
  const input = $("tiktokWords");
  const status = $("tiktokSearchStatus");
  const results = $("tiktokResults");
  const comments = window.lastTikTokComments || [];

  if (!comments.length) {
    if (status) status.textContent = "اجلب التعليقات أولاً.";
    return;
  }

  const words = (input?.value || "")
    .split(/[،,\n]+/)
    .map(word => word.trim().toLowerCase())
    .filter(Boolean);

  if (!words.length) {
    if (status) status.textContent = "اكتب كلمة أو أكثر للبحث.";
    return;
  }

  const matched = comments.filter(item => {
    const text = String(
      item.text || item.commentText || item.comment || ""
    ).toLowerCase();

    return words.some(word => text.includes(word));
  });

  if (status) {
    status.textContent =
      `تم العثور على ${matched.length} تعليق مطابق من أصل ${comments.length}.`;
  }

  if (!results) return;

  if (!matched.length) {
    results.innerHTML = "<p>لم يتم العثور على تعليقات مطابقة.</p>";
    return;
  }

  results.innerHTML = matched.map(item => {
    const text = escapeHtml(
      item.text || item.commentText || item.comment || ""
    );

    return `
      <div class="comment">
        <div>${text}</div>
      </div>
    `;
  }).join("");
});

function addTikTokWord() {
  const input = $("tiktokQuickAddWord");
  const textarea = $("tiktokWords");

  if (!input || !textarea) return;

  const word = input.value.trim();
  if (!word) return;

  let originalWords = JSON.parse(
    localStorage.getItem("tiktokOriginalWords") || "[]"
  );

  if (!originalWords.includes(word)) {
    originalWords.push(word);

    localStorage.setItem(
      "tiktokOriginalWords",
      JSON.stringify(originalWords)
    );
  }

  input.value = "";

  translateTikTokWords();
}
async function translateTikTokWords() {
  const textarea = $("tiktokWords");
  const language = $("tiktokLanguage")?.value;

  if (!textarea || !language) return;

  let originalWords = JSON.parse(
    localStorage.getItem("tiktokOriginalWords") || "[]"
  );

  // أول مرة نحفظ الكلمات العربية الأصلية
  if (!originalWords.length) {
    originalWords = textarea.value
      .split(/\n|,/)
      .map(w => w.trim())
      .filter(Boolean);

    if (originalWords.length) {
      localStorage.setItem(
        "tiktokOriginalWords",
        JSON.stringify(originalWords)
      );
    }
  }

  if (!originalWords.length) return;

  // إذا رجع للعربية نعرض الكلمات الأصلية
  if (language === "ar") {
    textarea.value = originalWords.join("\n");
    return;
  }

  const target = googleTranslateApiTargetCode(language);
  const translations = [];

  try {
    for (const term of originalWords) {

      // نحاول أولاً من بنك الكلمات
      let translated = findBankTranslation(term, language);

      // إذا ما لقيناها نستخدم Google Translate
      if (!translated) {
        const url =
          "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ar&tl=" +
          encodeURIComponent(target) +
          "&dt=t&q=" +
          encodeURIComponent(term);

        const response = await fetch(url);

        if (!response.ok) {
          throw new Error("فشل الاتصال بخدمة الترجمة");
        }

        const data = await response.json();

        translated = "";

        if (data && data[0]) {
          translated = data[0]
            .map(part => part[0] || "")
            .join("")
            .trim();
        }
      }

      translations.push(translated || term);
    }

    textarea.value = translations.join("\n");

  } catch (error) {
    console.error("TikTok translation error:", error);
  }
}

function clearTikTokWords() {
  localStorage.removeItem("tiktokOriginalWords");

  const textarea = $("tiktokWords");
  const input = $("tiktokQuickAddWord");

  if (textarea) textarea.value = "";
  if (input) input.value = "";
}
