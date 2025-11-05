class LessonPage {
  constructor() {
    this.lesson = null;
    this.currentIdx = 0;
    this.bindEvents();
    this.loadFromParams();
    if (this.lesson) this.start();
  }

  bindEvents() {
    const replayBtn = document.getElementById('replayBtn');
    replayBtn?.addEventListener('click', () => { const p=document.getElementById('audioPlayer'); p.currentTime=0; p.play(); });
    const checkBtn = document.getElementById('checkTypingBtn');
    checkBtn?.addEventListener('click', () => this.checkTyping());
    const submitBubbleBtn = document.getElementById('submitBubbleBtn');
    submitBubbleBtn?.addEventListener('click', () => this.submitBubbles());
    const resetBubbleBtn = document.getElementById('resetBubbleBtn');
    resetBubbleBtn?.addEventListener('click', () => this.resetBubbles());
    const nextBtn1 = document.getElementById('nextPhraseBtn');
    nextBtn1?.addEventListener('click', () => this.next());
    const nextBtn2 = document.getElementById('nextPhraseBtn2');
    nextBtn2?.addEventListener('click', () => this.next());
    const showAnswerBtn = document.getElementById('showAnswerBtn');
    showAnswerBtn?.addEventListener('click', () => this.showBubbleAnswer());
  }

  loadFromParams() {
    const params = new URLSearchParams(location.search);
    const encoded = params.get('lesson');
    const localId = params.get('id');
    const titleEl = document.getElementById('lessonTitle');
    try {
      if (encoded) {
        const json = this.fromUrlSafeBase64(encoded);
        const data = JSON.parse(json);
        if (data && data.lesson && Array.isArray(data.lesson.phrases)) {
          this.lesson = {
            title: data.lesson.title || 'Shared Lesson',
            phrases: data.lesson.phrases.map(p => ({ text: p.text, audio: p.audio || null }))
          };
        } else if (Array.isArray(data.items)) {
          this.lesson = {
            title: 'Shared Lesson',
            phrases: data.items.map(x => ({ text: x.sentence, audio: null }))
          };
        }
      } else if (localId) {
        const raw = localStorage.getItem('audio_lessons');
        const arr = raw ? JSON.parse(raw) : [];
        const found = Array.isArray(arr) ? arr.find(x=>x.id===localId) : null;
        if (found) this.lesson = { title: found.title, phrases: found.phrases };
      }
    } catch(_) {}
    if (!this.lesson) { alert('Lesson not found'); return; }
    if (titleEl) titleEl.textContent = this.lesson.title;
  }

  start() {
    this.currentIdx = 0;
    const header = document.getElementById('practiceHeader');
    header.textContent = `Round 1: Type what you hear (Phrase 1 of ${this.lesson.phrases.length})`;
    this.playCurrent();
  }

  playCurrent() {
    const phrase = this.lesson.phrases[this.currentIdx]; if (!phrase) return;
    const p = document.getElementById('audioPlayer');
    if (phrase.audio) { p.src = phrase.audio; p.currentTime = 0; p.play(); }
    else { p.removeAttribute('src'); this.speak(phrase.text); }
  }

  checkTyping() {
    const inEl = document.getElementById('typingInput');
    const tf = document.getElementById('typingFeedback');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    const pool = document.getElementById('bubblePool');
    const res = document.getElementById('bubbleResult');
    const phrase = this.lesson.phrases[this.currentIdx]; if (!phrase) return;
    const student = this.wordsArray(inEl.value);
    const target = this.wordsArray(phrase.text);
    const correctCount = student.filter((w,i)=>w===target[i]).length;
    const perfect = student.length===target.length && correctCount===target.length;
    if (perfect) {
      tf.textContent='Great job! Perfect match.'; tf.className='feedback success';
      const next1 = document.getElementById('nextPhraseBtn'); next1.style.display='inline-block';
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
    const res = document.getElementById('bubbleResult');
    const bf = document.getElementById('bubbleFeedback');
    const phrase = this.lesson.phrases[this.currentIdx]; if (!phrase) return;
    const chosen = Array.from(res.querySelectorAll('[data-word]')).map(el=>el.getAttribute('data-word'));
    const target = this.wordsArray(phrase.text);
    const ok = chosen.length===target.length && chosen.every((w,i)=>w===target[i]);
    if (ok) { bf.textContent='Excellent! That matches the target sentence.'; bf.className='feedback success'; const next2=document.getElementById('nextPhraseBtn2'); next2.style.display='inline-block'; }
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

  showBubbleAnswer() {
    const pool = document.getElementById('bubblePool');
    const res = document.getElementById('bubbleResult');
    const bf = document.getElementById('bubbleFeedback');
    const phrase = this.lesson?.phrases?.[this.currentIdx];
    if (!phrase) return;
    const target = this.wordsArray(phrase.text);
    // Clear current selections and pool for clarity
    res.innerHTML = '';
    pool.innerHTML = '';
    // Render the correct order as chips
    target.forEach(w => {
      const chip = document.createElement('span');
      chip.className = 'chosen-bubble';
      chip.textContent = w;
      chip.setAttribute('data-word', w);
      // Allow moving back to pool if desired
      chip.addEventListener('click', () => {
        res.removeChild(chip);
        const btn = document.createElement('button');
        btn.className = 'word-bubble';
        btn.textContent = w;
        btn.setAttribute('data-word', w);
        btn.addEventListener('click', () => {
          const chip2 = document.createElement('span');
          chip2.className = 'chosen-bubble';
          chip2.textContent = w;
          chip2.setAttribute('data-word', w);
          chip2.addEventListener('click', () => { res.removeChild(chip2); pool.appendChild(btn); });
          res.appendChild(chip2);
          pool.removeChild(btn);
        });
        pool.appendChild(btn);
      });
      res.appendChild(chip);
    });
    bf.textContent = `Resposta correta: ${phrase.text}`;
    bf.className = 'feedback';
  }

  next() {
    const next1 = document.getElementById('nextPhraseBtn');
    const next2 = document.getElementById('nextPhraseBtn2');
    next1.style.display='none'; next2.style.display='none';
    this.currentIdx += 1;
    if (this.currentIdx >= this.lesson.phrases.length) { alert('Lesson complete!'); window.location.href = 'index.html'; return; }
    const inEl = document.getElementById('typingInput');
    const tf = document.getElementById('typingFeedback');
    const bf = document.getElementById('bubbleFeedback');
    const typing = document.getElementById('typingRound');
    const bubbles = document.getElementById('bubbleRound');
    inEl.value=''; tf.textContent=''; bf.textContent='';
    typing.style.display='block'; bubbles.style.display='none';
    const header = document.getElementById('practiceHeader');
    header.textContent = `Round 1: Type what you hear (Phrase ${this.currentIdx+1} of ${this.lesson.phrases.length})`;
    this.playCurrent();
  }

  wordsArray(text) { return this.normalizeText(text).split(' ').filter(Boolean); }
  normalizeText(text) { return (text||'').toLowerCase().replace(/[^a-z0-9\s']/g,' ').replace(/\s+/g,' ').trim(); }
  fromUrlSafeBase64(s) {
    const padLen = (4 - (s.length % 4)) % 4; const padded = s + '='.repeat(padLen);
    const b64 = padded.replace(/-/g,'+').replace(/_/g,'/');
    return decodeURIComponent(escape(atob(b64)));
  }
  speak(text) { try { const u=new SpeechSynthesisUtterance(text); u.rate=0.95; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(_){} }
}

new LessonPage();