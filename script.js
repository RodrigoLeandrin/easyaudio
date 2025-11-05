class EasyAudioApp {
  constructor() {
    this.items = this.loadItems();
    this.currentId = null;
    this.bindEvents();
    this.bindShareEvents();
    this.tryLoadSharedLesson();
    this.renderItems();
  }

  bindEvents() {
    const addBtn = document.getElementById('addItemBtn');
    addBtn?.addEventListener('click', () => this.addItem());
    const clearBtn = document.getElementById('clearAllBtn');
    clearBtn?.addEventListener('click', () => this.clearAll());
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
  }

  bindShareEvents() {
    const shareBtn = document.getElementById('shareLessonBtn');
    const copyBtn = document.getElementById('copyShareBtn');
    shareBtn?.addEventListener('click', () => this.shareLesson());
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
    list.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', e => this.deleteItem(e.target.getAttribute('data-id'))));
  }

  playItem(id) {
    const d = this.items.find(x => x.id === id); if (!d) return;
    const p = document.getElementById('audioPlayer');
    const sec = document.getElementById('practiceSection');
    sec.style.display = 'block';
    if (d.audio) { p.src = d.audio; p.currentTime = 0; p.play(); }
    else { p.removeAttribute('src'); this.speak(d.sentence); }
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

  checkTyping() {
    const d = this.items.find(x => x.id === this.currentId); if (!d) return;
    const inEl = document.getElementById('typingInput');
    const tf = document.getElementById('typingFeedback');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    const pool = document.getElementById('bubblePool');
    const res = document.getElementById('bubbleResult');
    const student = this.wordsArray(inEl.value);
    const target = this.wordsArray(d.sentence);
    const correctCount = student.filter((w,i)=>w===target[i]).length;
    const perfect = student.length===target.length && correctCount===target.length;
    if (perfect) { tf.textContent='Great job! Perfect match.'; tf.className='feedback success'; return; }
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
    const d = this.items.find(x => x.id === this.currentId); if (!d) return;
    const res = document.getElementById('bubbleResult');
    const bf = document.getElementById('bubbleFeedback');
    const chosen = Array.from(res.querySelectorAll('[data-word]')).map(el=>el.getAttribute('data-word'));
    const target = this.wordsArray(d.sentence);
    const ok = chosen.length===target.length && chosen.every((w,i)=>w===target[i]);
    if (ok) { bf.textContent='Excellent! That matches the target sentence.'; bf.className='feedback success'; }
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
  clearAll() { if (!confirm('Delete all activities?')) return; this.items=[]; this.saveItems(); this.renderItems(); }

  saveItems() { try { localStorage.setItem('audio_dictations', JSON.stringify(this.items)); } catch(_){} }
  loadItems() { try { const raw=localStorage.getItem('audio_dictations'); if(!raw) return []; const p=JSON.parse(raw); return Array.isArray(p)?p:[]; } catch(_) { return []; } }

  wordsArray(text) { return this.normalizeText(text).split(' ').filter(Boolean); }
  normalizeText(text) { return (text||'').toLowerCase().replace(/[^a-z0-9\s']/g,' ').replace(/\s+/g,' ').trim(); }
  escapeHtml(t){ return (t||'').replace(/[&<>"']/g,(m)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
  readFileAsDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }

  // --- Share Lesson ---
  shareLesson() {
    const status = document.getElementById('shareStatus');
    const out = document.getElementById('shareLinkOutput');
    if (!this.items.length) { status.textContent = 'Add at least one dictation before sharing.'; status.className = 'feedback error'; return; }
    // Build lesson payload (omit audio to keep URL small; use TTS fallback on load)
    const payload = { version: 1, items: this.items.map(d => ({ sentence: d.sentence })) };
    const encoded = this.toUrlSafeBase64(JSON.stringify(payload));
    const fullUrl = `${location.origin}${location.pathname}?lesson=${encoded}`;
    status.textContent = 'Generating share link...'; status.className = 'feedback';
    this.shortenUrl(fullUrl).then(short => {
      out.value = short || fullUrl;
      status.textContent = short ? 'Short link generated.' : 'Share link ready.';
      status.className = 'feedback success';
    }).catch(() => {
      out.value = fullUrl;
      status.textContent = 'Shortening failed. Using full link.'; status.className = 'feedback error';
    });
  }

  tryLoadSharedLesson() {
    const params = new URLSearchParams(location.search);
    const lz = params.get('lesson'); if (!lz) return;
    try {
      const json = this.fromUrlSafeBase64(lz);
      const data = JSON.parse(json);
      if (data && Array.isArray(data.items)) {
        // Create items with no audio; TTS will be used for playback
        this.items = data.items.map(x => ({ id: Date.now().toString() + Math.random().toString(36).slice(2), sentence: x.sentence, audio: null, createdAt: new Date().toISOString() }));
        this.saveItems();
        this.renderItems();
        const status = document.getElementById('shareStatus');
        if (status) { status.textContent = 'Loaded shared lesson. You can practice immediately.'; status.className = 'feedback success'; }
      }
    } catch (_) {
      const status = document.getElementById('shareStatus');
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

  speak(text) {
    try { const u = new SpeechSynthesisUtterance(text); u.rate = 0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(_){}
  }
}

const app = new EasyAudioApp();