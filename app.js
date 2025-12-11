
const QUESTIONS = await (await fetch('./questions.json')).json();

const ls = window.localStorage;
const STATE_KEY = 'qm_final_state_v1';
const FAV_KEY = 'qm_final_favs_v1';
const MISSED_KEY = 'qm_final_missed_v1';
const HISTORY_KEY = 'qm_final_hist_v1';

let state = {};
let favorites = new Set(JSON.parse(ls.getItem(FAV_KEY) || '[]'));
let missed = new Set(JSON.parse(ls.getItem(MISSED_KEY) || '[]'));

const UI = {};

function init() {
  UI.search = document.getElementById('search');
  UI.darkToggle = document.getElementById('darkToggle');
  UI.installBtn = document.getElementById('installBtn');
  UI.navBtns = document.querySelectorAll('.nav-btn');
  UI.views = document.querySelectorAll('.view');
  UI.quizCard = document.getElementById('card');
  UI.quizScore = document.getElementById('score');
  UI.qcount = document.getElementById('qcount');
  UI.progressFill = document.getElementById('progressFill');
  UI.prevBtn = document.getElementById('prevBtn');
  UI.nextBtn = document.getElementById('nextBtn');
  UI.markBtn = document.getElementById('markBtn');
  UI.studyCard = document.getElementById('studyCard');
  UI.studyNext = document.getElementById('studyNext');
  UI.flashCard = document.getElementById('flashCard');
  UI.flipBtn = document.getElementById('flipBtn');
  UI.flashNext = document.getElementById('flashNext');
  UI.favoritesList = document.getElementById('favoritesList');
  UI.missedList = document.getElementById('missedList');
  UI.analyticsCanvas = document.getElementById('analyticsChart');
  UI.resetBtn = document.getElementById('resetProgress');
  UI.exportBtn = document.getElementById('exportData');
  UI.importBtn = document.getElementById('importBtn');
  UI.importFile = document.getElementById('importFile');

  bindEvents();
  loadState();
  if(!state.shuffled) resetSession();
  showView('home');
  renderCurrent();
  updateAnalytics();
}

function bindEvents() {
  UI.search.addEventListener('input', renderSearchList);
  UI.darkToggle.addEventListener('click', toggleDark);
  UI.navBtns.forEach(function(b){ b.addEventListener('click', function(){ showView(b.dataset.view); }); });
  UI.prevBtn.addEventListener('click', function(){ state.index = Math.max(0, state.index-1); renderCurrent(); saveState(); });
  UI.nextBtn.addEventListener('click', function(){ nextQuestion(); });
  UI.markBtn.addEventListener('click', toggleFavorite);
  UI.studyNext.addEventListener('click', function(){ nextQuestion(true); });
  UI.flipBtn.addEventListener('click', flipFlash);
  UI.flashNext.addEventListener('click', function(){ nextQuestion(true, 'flash'); });
  UI.resetBtn.addEventListener('click', resetAllData);
  UI.exportBtn.addEventListener('click', exportJSON);
  UI.importBtn.addEventListener('click', function(){ UI.importFile.click(); });
  UI.importFile.addEventListener('change', importJSON);

  window.addEventListener('beforeinstallprompt', function(e){ e.preventDefault(); window.deferredPrompt = e; UI.installBtn.style.display='inline-block'; });
  UI.installBtn.addEventListener('click', async function(){ if(window.deferredPrompt) { window.deferredPrompt.prompt(); await window.deferredPrompt.userChoice; window.deferredPrompt = null; UI.installBtn.style.display='none'; } });
}

function resetSession() {
  state.shuffled = shuffleArray(QUESTIONS.map(function(q){ return q.id; }));
  state.index = 0;
  state.score = 0;
  state.attempted = 0;
  state.mode = 'quiz';
  saveState();
}

function renderSearchList() {
  UI.qcount.textContent = QUESTIONS.length + ' questions';
}

function renderCurrent() {
  updateProgress();
  var id = state.shuffled[state.index];
  var q = QUESTIONS.find(function(x){ return x.id===id; });
  if(!q) return;
  UI.quizCard.innerHTML = renderQuestionCard(q);
  UI.quizScore.textContent = 'Score: ' + state.score + '/' + state.attempted;
  UI.markBtn.textContent = favorites.has(q.id)? '★ Unfavorite' : '★ Favorite';
}

function renderQuestionCard(q) {
  var html = '<div class="card-inner"><h3>' + escapeHtml(q.question) + '</h3><div class="opts-vertical">';
  Object.keys(q.choices).forEach(function(k){
    html += '<button class="choice-btn" data-choice="'+k+'"><strong>'+k.toUpperCase()+'.</strong> '+escapeHtml(q.choices[k])+'</button>';
  });
  html += '</div><div class="explain" style="display:none"><strong>Answer:</strong> ' + (q.answer? q.answer.toUpperCase(): '') + ' - ' + escapeHtml((q.choices && q.choices[q.answer])||'') + '</div>';
  html += '<div class="explain-text" style="display:none">' + escapeHtml(q.explanation||'') + '</div></div>';
  return html;
}

document.addEventListener('click', function(e){ if(e.target && e.target.matches('.choice-btn')) handleAnswer(e.target); });

function handleAnswer(btn) {
  var choice = btn.dataset.choice;
  var id = state.shuffled[state.index];
  var q = QUESTIONS.find(function(x){ return x.id===id; });
  var correct = q.answer;
  var opts = UI.quizCard.querySelectorAll('.choice-btn');
  opts.forEach(function(o){ o.disabled=true; });
  if(choice === correct) { btn.classList.add('correct'); state.score++; saveHistory(id, true); } else { btn.classList.add('wrong'); missed.add(id); saveMissed(); saveHistory(id, false); }
  state.attempted++;
  var expl = UI.quizCard.querySelector('.explain');
  var explText = UI.quizCard.querySelector('.explain-text');
  expl.style.display='block'; explText.style.display='block';
  saveState(); updateAnalytics();
}

function nextQuestion(skip) { state.index++; if(state.index >= state.shuffled.length) state.index = 0; saveState(); renderCurrent(); }

function toggleFavorite() { var id = state.shuffled[state.index]; if(favorites.has(id)) favorites.delete(id); else favorites.add(id); ls.setItem(FAV_KEY, JSON.stringify(Array.from(favorites))); UI.markBtn.textContent = favorites.has(id)? '★ Unfavorite' : '★ Favorite'; }

function updateProgress() { var pct = Math.round((state.index / state.shuffled.length) * 100); document.getElementById('progressFill').style.width = pct + '%'; }

function flipFlash() { var id = state.shuffled[state.index]; var q = QUESTIONS.find(function(x){ return x.id===id; }); var el = UI.flashCard; if(el.dataset.side === 'front') { el.innerHTML = '<h3>' + escapeHtml(q.answer.toUpperCase()) + ') ' + escapeHtml(q.choices[q.answer]||'') + '</h3><p>' + escapeHtml(q.explanation||'') + '</p>'; el.dataset.side='back'; } else { el.innerHTML = '<h3>' + escapeHtml(q.question) + '</h3>'; el.dataset.side='front'; } }

function shuffleArray(arr) { var a = arr.slice(); for(var i=a.length-1;i>0;i--) { var j=Math.floor(Math.random()*(i+1)); var tmp=a[i]; a[i]=a[j]; a[j]=tmp; } return a; }

function saveState() { ls.setItem(STATE_KEY, JSON.stringify(state)); }
function loadState() { var s = ls.getItem(STATE_KEY); if(s) state = JSON.parse(s); else state = {}; }

function saveMissed() { ls.setItem(MISSED_KEY, JSON.stringify(Array.from(missed))); }
function saveHistory(qid, correct) { var h = JSON.parse(ls.getItem(HISTORY_KEY) || '[]'); h.push({id:qid, correct:correct, t:Date.now()}); ls.setItem(HISTORY_KEY, JSON.stringify(h)); }

function resetAllData() { if(confirm('Reset all progress?')) { ls.removeItem(STATE_KEY); ls.removeItem(FAV_KEY); ls.removeItem(MISSED_KEY); ls.removeItem(HISTORY_KEY); location.reload(); } }

function exportJSON() { var blob = new Blob([JSON.stringify(QUESTIONS,null,2)],{type:'application/json'}); var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'questions.json'; a.click(); URL.revokeObjectURL(url); }

function importJSON(e) { var f = UI.importFile.files[0]; if(!f) return; var r = new FileReader(); r.onload = function(){ try{ var data = JSON.parse(r.result); if(Array.isArray(data)){ alert('Import successful — reload to use new questions'); ls.setItem('qm_imported_questions', JSON.stringify(data)); location.reload(); } else alert('Invalid format'); }catch(err){alert('Import failed')}; }; r.readAsText(f); }

function updateAnalytics() { var h = JSON.parse(ls.getItem(HISTORY_KEY) || '[]'); var total = h.length; var correct = h.filter(function(x){return x.correct;}).length; var acc = total? Math.round((correct/total)*100):0; document.getElementById('stats').innerText = 'Attempts: ' + total + ' — Correct: ' + correct + ' — Accuracy: ' + acc + '%'; var ctx = UI.analyticsCanvas.getContext('2d'); ctx.clearRect(0,0,UI.analyticsCanvas.width, UI.analyticsCanvas.height); var counts = {}; h.forEach(function(entry){ if(!entry.correct) counts[entry.id] = (counts[entry.id]||0)+1; }); var items = Object.entries(counts).slice(0,5); ctx.fillStyle = '#0ea5a4'; items.forEach(function(it, idx){ ctx.fillRect(20, 20+idx*40, Math.min(400, it[1]*20), 30); ctx.fillStyle = '#000'; ctx.fillText(it[0]+': '+it[1], 30+Math.min(400, it[1]*20), 20+idx*40+20); ctx.fillStyle = '#0ea5a4'; }); }

function escapeHtml(s) { if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function toggleDark() { var app = document.getElementById('app'); if(app.classList.contains('dark')){ app.classList.remove('dark'); ls.setItem('qm_theme','light'); } else { app.classList.add('dark'); ls.setItem('qm_theme','dark'); } }

function showView(v) { document.querySelectorAll('.view').forEach(function(x){ x.style.display='none'; }); document.getElementById(v+'View').style.display='block'; if(v==='favorites') renderFavorites(); if(v==='missed') renderMissed(); if(v==='analytics') updateAnalytics(); }

function renderFavorites() { var el = UI.favoritesList; el.innerHTML=''; Array.from(favorites).forEach(function(id){ var q = QUESTIONS.find(function(x){ return x.id===id; }); var d = document.createElement('div'); d.className='card'; d.innerHTML = '<strong>'+q.id+'</strong>: '+q.question; el.appendChild(d); }); }
function renderMissed() { var el = UI.missedList; el.innerHTML=''; Array.from(missed).forEach(function(id){ var q = QUESTIONS.find(function(x){ return x.id===id; }); var d = document.createElement('div'); d.className='card'; d.innerHTML = '<strong>'+q.id+'</strong>: '+q.question; el.appendChild(d); }); }

loadState();
if(!state.shuffled) resetSession();
init();
renderCurrent();
updateAnalytics();

if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function(){});

// --- Added Reset Button Handler (top bar) ---
function topReset() {
  if (!confirm('Reset entire quiz? This will clear all progress and restart.')) return;
  try {
    // Clear all stored data for this app
    localStorage.clear();
  } catch(e) { console.warn('Failed to clear localStorage', e); }
  // Reload to initialize fresh state
  location.reload();
}

// Attach handler when DOM is ready
window.addEventListener('load', function(){
  var btn = document.getElementById('topResetBtn');
  if(btn) btn.addEventListener('click', topReset);
});
// --- end Reset handler ---
