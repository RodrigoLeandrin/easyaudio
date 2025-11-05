class EasyAudioApp {
  constructor() {
    // Legacy single-item storage (kept for back-compat with older UI/share)
    this.items = this.loadItems();
    this.currentId = null;

    // New lessons model
    this.lessons = this.loadLessons();
    this.draft = { title: '', phrases: [] };
    this.currentLessonId = null;
    this.currentPhraseIndex = 0;

    this.bindEvents();
    this.bindShareEvents();
    this.bindTabs();
    this.tryLoadSharedLesson();
    // Render lessons and draft on load
    this.renderDraft();
    this.renderLessons();

    // Load Supabase config if available
    this.supabase = null;
    const url = localStorage.getItem('supabase_url') || '';
    const key = localStorage.getItem('supabase_key') || '';
    this.supabaseBucket = localStorage.getItem('supabase_bucket') || 'audio';
    if (url && key && window.supabase?.createClient) {
      try { this.supabase = window.supabase.createClient(url, key); } catch(_){}
    }
  }

  bindEvents() {
    // Legacy buttons (may not exist in new UI)
    const addBtn = document.getElementById('addItemBtn');
    addBtn?.addEventListener('click', () => this.addItem());
    const clearBtn = document.getElementById('clearAllBtn');
    clearBtn?.addEventListener('click', () => this.clearAll());

    // Builder buttons
    const addPhraseBtn = document.getElementById('addPhraseBtn');
    addPhraseBtn?.addEventListener('click', () => this.addPhraseToDraft());
    const clearDraftBtn = document.getElementById('clearDraftBtn');
    clearDraftBtn?.addEventListener('click', () => this.clearDraft());
    const saveLessonBtn = document.getElementById('saveLessonBtn');
    saveLessonBtn?.addEventListener('click', () => this.saveLesson());

    const replayBtn = document.getElementById('replayBtn');
    replayBtn?.addEventListener('click', () => {
      const p = document.getElementById('audioPlayer');
      p.currentTime = 0; p.play();
    });
    const checkBtn = document.getElementById('checkTypingBtn');
    checkBtn?.addEventListener('click', () => this.checkTyping());
    const submitBubbleBtn = document.getElementById('submitBubbleBtn');
    submitBubbleBtn?.addEventListener('click', () => this.submitBubbles());
    const resetBubbleBtn = document.getElementById('resetBubbleBtn');
    resetBubbleBtn?.addEventListener('click', () => this.resetBubbles());

    const nextBtn1 = document.getElementById('nextPhraseBtn');
    nextBtn1?.addEventListener('click', () => this.nextPhrase());
    const nextBtn2 = document.getElementById('nextPhraseBtn2');
    nextBtn2?.addEventListener('click', () => this.nextPhrase());

    // Supabase config
    const saveSbBtn = document.getElementById('saveSupabaseConfigBtn');
    saveSbBtn?.addEventListener('click', () => {
      const urlEl = document.getElementById('supabaseUrlInput');
      const keyEl = document.getElementById('supabaseKeyInput');
      const bucketEl = document.getElementById('supabaseBucketInput');
      const url = (urlEl?.value || '').trim();
      const key = (keyEl?.value || '').trim();
      const bucket = (bucketEl?.value || '').trim() || 'audio';
      if (!url || !key) { alert('Enter both Supabase URL and anon key'); return; }
      try {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_key', key);
        localStorage.setItem('supabase_bucket', bucket);
        if (window.supabase?.createClient) {
          this.supabase = window.supabase.createClient(url, key);
          this.supabaseBucket = bucket;
          alert('Supabase configured. MP3s will upload to Storage bucket "audio".');
        } else {
          alert('Supabase client not available in this page.');
        }
      } catch(_) { alert('Could not save config'); }
    });
  }

  bindShareEvents() {
    const copyBtn = document.getElementById('copyShareBtn');
    copyBtn?.addEventListener('click', () => {
      const out = document.getElementById('shareLinkOutput');
      const status = document.getElementById('shareStatus');
      if (!out?.value) { status.textContent = 'No link yet. Click Share Lesson first.'; status.className = 'feedback error'; return; }
      navigator.clipboard.writeText(out.value).then(() => {
        status.textContent = 'Link copied to clipboard.'; status.className = 'feedback success';
      }).catch(() => {
        status.textContent = 'Unable to copy automatically. Please copy manually.'; status.className = 'feedback error';
      });
    });
  }

  bindTabs() {
    const tabCreate = document.getElementById('tabCreate');
    const tabLessons = document.getElementById('tabLessons');
    tabCreate?.addEventListener('click', () => this.switchTab('create'));
    tabLessons?.addEventListener('click', () => this.switchTab('lessons'));
  }

  switchTab(name) {
    const create = document.getElementById('createTab');
    const lessons = document.getElementById('lessonsTab');
    const tabCreate = document.getElementById('tabCreate');
    const tabLessons = document.getElementById('tabLessons');
    const showCreate = name === 'create';
    create.style.display = showCreate ? 'block' : 'none';
    lessons.style.display = showCreate ? 'none' : 'block';
    tabCreate.setAttribute('aria-selected', showCreate ? 'true' : 'false');
    tabLessons.setAttribute('aria-selected', showCreate ? 'false' : 'true');
  }

  async addItem() {
    const sentenceEl = document.getElementById('sentenceInput');
    const audioEl = document.getElementById('audioInput');
    const sentence = (sentenceEl?.value || '').trim();
    const file = audioEl?.files?.[0] || null;
    if (!sentence || !file) { alert('Provide both sentence and MP3'); return; }
    const base64 = await this.readFileAsDataURL(file);
    const item = { id: Date.now().toString(), sentence, audio: base64, createdAt: new Date().toISOString() };
    this.items.push(item);
    this.saveItems();
    try { sentenceEl.value = ''; audioEl.value = ''; } catch(_){}
    this.renderItems();
  }

  // --- Builder: lesson with multiple phrases ---
  async addPhraseToDraft() {
    const sentenceEl = document.getElementById('sentenceInput');
    const audioEl = document.getElementById('audioInput');
    const titleEl = document.getElementById('lessonTitleInput');
    const text = (sentenceEl?.value || '').trim();
    const file = audioEl?.files?.[0] || null;
    if (!text || !file) { alert('Provide both phrase text and MP3'); return; }
    let audioUrl = null;
    if (this.supabase) {
      const upStatus = document.getElementById('uploadStatus');
      if (upStatus) { upStatus.textContent = 'Uploading to Supabase…'; }
      audioUrl = await this.uploadToSupabase(file).catch((err)=>{
        if (upStatus) { upStatus.textContent = 'Upload failed. Using local file.'; }
        return null;
      });
      if (audioUrl && upStatus) { upStatus.textContent = 'Uploaded to Supabase.'; }
    }
    const base64 = audioUrl ? null : await this.readFileAsDataURL(file);
    this.draft.title = (titleEl?.value || '').trim();
    this.draft.phrases.push({ text, audio: audioUrl || base64 });
    try { sentenceEl.value=''; audioEl.value=''; } catch(_){}
    this.renderDraft();
  }

  clearDraft() {
    this.draft = { title: '', phrases: [] };
    const titleEl = document.getElementById('lessonTitleInput');
    if (titleEl) titleEl.value = '';
    this.renderDraft();
  }

  renderDraft() {
    const list = document.getElementById('draftList');
    if (!list) return;
    if (!this.draft.phrases.length) { list.innerHTML = '<p>No draft phrases yet. Add some above.</p>'; return; }
    list.innerHTML = this.draft.phrases.map((p, idx) => `
      <div class="item-card">
        <div>
          <strong>${this.escapeHtml(p.text)}</strong>
          <div style="color:#718096; font-size:0.85rem;">Phrase ${idx+1}</div>
        </div>
        <div class="item-actions">
          <button data-idx="${idx}" class="play-draft-btn">Play</button>
          <button data-idx="${idx}" class="remove-draft-btn" style="background:#e53e3e;">Remove</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.play-draft-btn').forEach(b => b.addEventListener('click', e => {
      const idx = parseInt(e.target.getAttribute('data-idx'),10);
      const p = this.draft.phrases[idx]; if (!p) return;
      const player = document.getElementById('audioPlayer');
      const sec = document.getElementById('practiceSection');
      sec.style.display = 'block';
      if (p.audio) { player.src = p.audio; player.currentTime = 0; player.play(); }
      else { player.removeAttribute('src'); this.speak(p.text); }
    }));
    list.querySelectorAll('.remove-draft-btn').forEach(b => b.addEventListener('click', e => {
      const idx = parseInt(e.target.getAttribute('data-idx'),10);
      this.draft.phrases.splice(idx,1);
      this.renderDraft();
    }));
  }

  saveLesson() {
    const titleEl = document.getElementById('lessonTitleInput');
    this.draft.title = (titleEl?.value || '').trim();
    if (!this.draft.title) { alert('Add a lesson title'); return; }
    if (!this.draft.phrases.length) { alert('Add at least one phrase'); return; }
    const lesson = {
      id: Date.now().toString(),
      title: this.draft.title,
      phrases: this.draft.phrases.map(p => ({ text: p.text, audio: p.audio })),
      createdAt: new Date().toISOString()
    };
    this.lessons.push(lesson);
    this.saveLessons();
    this.clearDraft();
    this.switchTab('lessons');
    this.renderLessons();
  }

  renderItems() {
    const list = document.getElementById('itemsList');
    if (!list) return;
    if (!this.items.length) { list.innerHTML = '<p>No items yet. Add one above!</p>'; return; }
    list.innerHTML = this.items.map(d => `
      <div class="item-card">
        <div>
          <strong>${this.escapeHtml(d.sentence)}</strong>
          <div style="color:#718096; font-size:0.85rem;">${new Date(d.createdAt).toLocaleString()}</div>
        </div>
        <div class="item-actions">
          <button data-id="${d.id}" class="play-btn">Play</button>
          <button data-id="${d.id}" class="start-btn">Start</button>
          <button data-id="${d.id}" class="delete-btn" style="background:#e53e3e;">Delete</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.play-btn').forEach(b => b.addEventListener('click', e => this.playItem(e.target.getAttribute('data-id'))));
    list.querySelectorAll('.start-btn').forEach(b => b.addEventListener('click', e => this.startItem(e.target.getAttribute('data-id'))));
    list.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', e => this.deleteItemSecured(e.target.getAttribute('data-id'))));
  }

  renderLessons() {
    const list = document.getElementById('lessonsList');
    if (!list) return;
    if (!this.lessons.length) { list.innerHTML = '<p>No lessons yet. Create one in the Create tab.</p>'; return; }
    list.innerHTML = this.lessons.map(l => `
      <div class="item-card">
        <div>
          <strong>${this.escapeHtml(l.title)}</strong>
          <div class="subtitle">${l.phrases.length} phrase${l.phrases.length===1?'':'s'} • ${new Date(l.createdAt).toLocaleString()}</div>
        </div>
        <div class="item-actions">
          <button data-id="${l.id}" class="play-lesson-btn">Play</button>
          <button data-id="${l.id}" class="start-lesson-btn">Start</button>
          <button data-id="${l.id}" class="share-lesson-btn">Share</button>
          <button data-id="${l.id}" class="delete-lesson-btn" style="background:#e53e3e;">Delete</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.play-lesson-btn').forEach(b => b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      const l = this.lessons.find(x=>x.id===id); if (!l || !l.phrases.length) return;
      this.playLessonPhrase(id, 0);
    }));
    list.querySelectorAll('.start-lesson-btn').forEach(b => b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      this.startLesson(id);
    }));
    list.querySelectorAll('.delete-lesson-btn').forEach(b => b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      this.deleteLessonSecured(id);
    }));
    list.querySelectorAll('.share-lesson-btn').forEach(b => b.addEventListener('click', e => {
      const id = e.target.getAttribute('data-id');
      this.shareLessonFromId(id);
    }));
  }

  playItem(id) {
    const d = this.items.find(x => x.id === id); if (!d) return;
    const p = document.getElementById('audioPlayer');
    const sec = document.getElementById('practiceSection');
    sec.style.display = 'block';
    if (d.audio) { p.src = d.audio; p.currentTime = 0; p.play(); }
    else { p.removeAttribute('src'); this.speak(d.sentence); }
  }

  playLessonPhrase(lessonId, idx) {
    const l = this.lessons.find(x=>x.id===lessonId); if (!l) return;
    const phrase = l.phrases[idx]; if (!phrase) return;
    const p = document.getElementById('audioPlayer');
    const sec = document.getElementById('practiceSection');
    sec.style.display = 'block';
    if (phrase.audio) { p.src = phrase.audio; p.currentTime = 0; p.play(); }
    else { p.removeAttribute('src'); this.speak(phrase.text); }
  }

  startItem(id) {
    const d = this.items.find(x => x.id === id); if (!d) return;
    this.currentId = id;
    const p = document.getElementById('audioPlayer');
    const sec = document.getElementById('practiceSection');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    const tf = document.getElementById('typingFeedback');
    const bf = document.getElementById('bubbleFeedback');
    const inEl = document.getElementById('typingInput');
    sec.style.display = 'block'; typing.style.display = 'block'; bubbles.style.display = 'none'; tf.textContent=''; bf.textContent=''; inEl.value='';
    if (d.audio) { p.src = d.audio; p.currentTime = 0; p.play(); }
    else { p.removeAttribute('src'); this.speak(d.sentence); }
  }

  startLesson(id) {
    // Navigate to dedicated lesson page using local id
    const basePath = location.pathname.replace(/index\.html?$/, '');
    window.location.href = `${basePath}lesson.html?id=${encodeURIComponent(id)}`;
  }

  checkTyping() {
    const targetText = this.getActiveTargetText(); if (!targetText) return;
    const inEl = document.getElementById('typingInput');
    const tf = document.getElementById('typingFeedback');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    const pool = document.getElementById('bubblePool');
    const res = document.getElementById('bubbleResult');
    const student = this.wordsArray(inEl.value);
    const target = this.wordsArray(targetText);
    const correctCount = student.filter((w,i)=>w===target[i]).length;
    const perfect = student.length===target.length && correctCount===target.length;
    if (perfect) {
      tf.textContent='Great job! Perfect match.'; tf.className='feedback success';
      const next1 = document.getElementById('nextPhraseBtn');
      if (this.currentLessonId) next1.style.display = 'inline-block';
      return;
    }
    tf.textContent='Not quite. Try Round 2 with word bubbles.'; tf.className='feedback error';
    typing.style.display='none'; bubbles.style.display='block';
    const words=[...target]; for (let i=words.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[words[i],words[j]]=[words[j],words[i]];}
    pool.innerHTML=''; res.innerHTML='';
    words.forEach(w=>{ const btn=document.createElement('button'); btn.className='word-bubble'; btn.textContent=w; btn.setAttribute('data-word',w);
      btn.addEventListener('click',()=>{ const chip=document.createElement('span'); chip.className='chosen-bubble'; chip.textContent=w; chip.setAttribute('data-word',w);
        chip.addEventListener('click',()=>{ res.removeChild(chip); pool.appendChild(btn); });
        res.appendChild(chip); pool.removeChild(btn);
      });
      pool.appendChild(btn);
    });
  }

  submitBubbles() {
    const targetText = this.getActiveTargetText(); if (!targetText) return;
    const res = document.getElementById('bubbleResult');
    const bf = document.getElementById('bubbleFeedback');
    const chosen = Array.from(res.querySelectorAll('[data-word]')).map(el=>el.getAttribute('data-word'));
    const target = this.wordsArray(targetText);
    const ok = chosen.length===target.length && chosen.every((w,i)=>w===target[i]);
    if (ok) {
      bf.textContent='Excellent! That matches the target sentence.'; bf.className='feedback success';
      const next2 = document.getElementById('nextPhraseBtn2');
      if (this.currentLessonId) next2.style.display = 'inline-block';
    }
    else { bf.textContent='Not quite. Review and try again.'; bf.className='feedback error'; }
  }

  resetBubbles() {
    const pool = document.getElementById('bubblePool');
    const res = document.getElementById('bubbleResult');
    const chips = Array.from(res.querySelectorAll('.chosen-bubble'));
    chips.forEach(ch=>{
      const w = ch.getAttribute('data-word')||'';
      const btn = document.createElement('button'); btn.className='word-bubble'; btn.textContent=w; btn.setAttribute('data-word',w);
      btn.addEventListener('click',()=>{ const chip=document.createElement('span'); chip.className='chosen-bubble'; chip.textContent=w; chip.setAttribute('data-word',w);
        chip.addEventListener('click',()=>{ res.removeChild(chip); pool.appendChild(btn); });
        res.appendChild(chip); pool.removeChild(btn);
      });
      pool.appendChild(btn);
    });
    res.innerHTML='';
    const bf = document.getElementById('bubbleFeedback'); bf.textContent=''; bf.className='feedback';
  }

  deleteItem(id) { this.items = this.items.filter(d=>d.id!==id); this.saveItems(); this.renderItems(); }
  deleteItemSecured(id) { if (!this.checkDeletePassword()) { alert('Incorrect password.'); return; } this.deleteItem(id); }
  deleteLessonSecured(id) {
    if (!this.checkDeletePassword()) { alert('Incorrect password.'); return; }
    this.lessons = this.lessons.filter(x=>x.id!==id);
    this.saveLessons();
    this.renderLessons();
  }
  clearAll() { if (!this.checkDeletePassword()) { alert('Incorrect password.'); return; } if (!confirm('Delete all activities?')) return; this.items=[]; this.saveItems(); this.renderItems(); }

  saveItems() { try { localStorage.setItem('audio_dictations', JSON.stringify(this.items)); } catch(_){} }
  loadItems() { try { const raw=localStorage.getItem('audio_dictations'); if(!raw) return []; const p=JSON.parse(raw); return Array.isArray(p)?p:[]; } catch(_) { return []; } }

   saveLessons() { try { localStorage.setItem('audio_lessons', JSON.stringify(this.lessons)); } catch(_){} }
   loadLessons() { try { const raw=localStorage.getItem('audio_lessons'); if(!raw) return []; const p=JSON.parse(raw); return Array.isArray(p)?p:[]; } catch(_) { return []; } }

  wordsArray(text) { return this.normalizeText(text).split(' ').filter(Boolean); }
  normalizeText(text) { return (text||'').toLowerCase().replace(/[^a-z0-9\s']/g,' ').replace(/\s+/g,' ').trim(); }
  escapeHtml(t){ return (t||'').replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
  readFileAsDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

  async uploadToSupabase(file) {
    if (!this.supabase) throw new Error('Supabase not configured');
    const bucket = this.supabaseBucket || 'audio';
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
    const path = `${new Date().toISOString().slice(0,10)}/${Date.now()}_${Math.random().toString(36).slice(2)}_${safeName}`;
    const { error } = await this.supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: `audio/${ext}` });
    if (error) throw error;
    const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  checkDeletePassword() {
    try {
      const input = prompt('Enter password to delete:');
      return input === '281194';
    } catch(_) { return false; }
  }

  // --- Share per-lesson (omit audio; use TTS on load) ---
  shareLessonFromId(lessonId) {
    const l = this.lessons.find(x=>x.id===lessonId);
    const status = document.getElementById('shareStatus');
    const out = document.getElementById('shareLinkOutput');
    if (!l) { status.textContent = 'Select a lesson to share.'; status.className = 'feedback error'; return; }
    if (!l.phrases.length) { status.textContent = 'Lesson has no phrases to share.'; status.className = 'feedback error'; return; }
    const payload = { version: 2, lesson: { title: l.title, phrases: l.phrases.map(p => ({ text: p.text, audio: (p.audio && /^https?:\/\//.test(p.audio)) ? p.audio : undefined })) } };
    const encoded = this.toUrlSafeBase64(JSON.stringify(payload));
    const basePath = location.pathname.replace(/index\.html?$/, '');
    const fullUrl = `${location.origin}${basePath}lesson.html?lesson=${encoded}`;
    out.value = fullUrl;
    status.textContent = 'Share link ready.'; status.className = 'feedback success';
  }

  tryLoadSharedLesson() {
    const params = new URLSearchParams(location.search);
    const lz = params.get('lesson'); if (!lz) return;
    try {
      const json = this.fromUrlSafeBase64(lz);
      const data = JSON.parse(json);
      const status = document.getElementById('shareStatus');
      if (data && data.lesson && Array.isArray(data.lesson.phrases)) {
        // New v2 structure: create a lesson (audio omitted; use TTS)
        const newLesson = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          title: data.lesson.title || 'Shared Lesson',
          phrases: data.lesson.phrases.map(p => ({ text: p.text, audio: p.audio || null })),
          createdAt: new Date().toISOString()
        };
        this.lessons.push(newLesson);
        this.saveLessons();
        this.renderLessons();
        if (status) { status.textContent = 'Loaded shared lesson. You can practice immediately.'; status.className = 'feedback success'; }
      } else if (data && Array.isArray(data.items)) {
        // Legacy v1 structure: convert items to a lesson
        const newLesson = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          title: 'Shared Lesson',
          phrases: data.items.map(x => ({ text: x.sentence, audio: null })),
          createdAt: new Date().toISOString()
        };
        this.lessons.push(newLesson);
        this.saveLessons();
        this.renderLessons();
        if (status) { status.textContent = 'Loaded shared lesson. You can practice immediately.'; status.className = 'feedback success'; }
      }
    } catch (_) {
      if (status) { status.textContent = 'Could not load shared lesson.'; status.className = 'feedback error'; }
    }
  }

  toUrlSafeBase64(text) {
    const b64 = btoa(unescape(encodeURIComponent(text)));
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  fromUrlSafeBase64(s) {
    const padLen = (4 - (s.length % 4)) % 4; const padded = s + '='.repeat(padLen);
    const b64 = padded.replace(/-/g,'+').replace(/_/g,'/');
    return decodeURIComponent(escape(atob(b64)));
  }

  async shortenUrl(url) {
    try {
      const r = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      if (r.ok) { const t = await r.text(); if (t && /^https?:\/\//.test(t)) return t; }
    } catch(_){}
    try {
      const r2 = await fetch('https://cleanuri.com/api/v1/shorten', { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: `url=${encodeURIComponent(url)}` });
      if (r2.ok) { const j = await r2.json(); if (j && j.result_url) return j.result_url; }
    } catch(_){}
    return null;
  }

  getActiveTargetText() {
    if (this.currentLessonId) {
      const l = this.lessons.find(x=>x.id===this.currentLessonId); if (!l) return '';
      const ph = l.phrases[this.currentPhraseIndex]; return ph ? ph.text : '';
    }
    const d = this.items.find(x => x.id === this.currentId); return d ? d.sentence : '';
  }

  nextPhrase() {
    if (!this.currentLessonId) return;
    const l = this.lessons.find(x=>x.id===this.currentLessonId); if (!l) return;
    const next1 = document.getElementById('nextPhraseBtn');
    const next2 = document.getElementById('nextPhraseBtn2');
    next1.style.display='none'; next2.style.display='none';
    this.currentPhraseIndex += 1;
    if (this.currentPhraseIndex >= l.phrases.length) {
      const typing = document.getElementById('typingRound');
      const bubbles = document.getElementById('bubbleRound');
      const tf = document.getElementById('typingFeedback');
      const bf = document.getElementById('bubbleFeedback');
      typing.style.display='none'; bubbles.style.display='none';
      tf.textContent=''; bf.textContent='';
      const sec = document.getElementById('practiceSection');
      sec.style.display='none';
      alert('Lesson complete!');
      this.currentLessonId = null; this.currentPhraseIndex = 0;
      return;
    }
    const inEl = document.getElementById('typingInput');
    const tf = document.getElementById('typingFeedback');
    const bf = document.getElementById('bubbleFeedback');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    inEl.value=''; tf.textContent=''; bf.textContent='';
    typing.style.display='block'; bubbles.style.display='none';
    const header = document.getElementById('practiceHeader');
    header.textContent = `Round 1: Type what you hear (Phrase ${this.currentPhraseIndex+1} of ${l.phrases.length})`;
    this.playLessonPhrase(this.currentLessonId, this.currentPhraseIndex);
  }

  speak(text) {
    try { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(_){}
  }
}

const app = new EasyAudioApp();