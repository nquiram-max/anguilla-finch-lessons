/* ============================================================
   Shared render engine for every Finch lesson page.
   Edit this ONE file to change how ANY lesson behaves/renders
   (carousel logic, new fields, layout tweaks, bug fixes, etc.)

   Each lesson page only needs:
     1. The standard HTML skeleton (see lesson-template.html)
     2. <script>const lessonData = { ... };</script>
     3. <script src="../lesson-engine.js"></script>  (load LAST)

   Optional sections are data-driven: if a lesson's data doesn't
   include a field, the matching card hides itself instead of
   erroring or leaving an empty box.
   ============================================================ */
(function () {
  if (typeof lessonData === 'undefined') {
    console.error('lesson-engine.js loaded but no `lessonData` was defined on this page.');
    return;
  }

  const el = (id) => document.getElementById(id);

  // Hides a card entirely if it has no content to show.
  const showOrHide = (id, hasContent) => {
    const node = el(id);
    if (!node) return;
    const card = node.closest('.card') || node;
    card.style.display = hasContent ? '' : 'none';
  };

  const formatMethod = (method) => {
    if (!method) return '';
    const match = method.match(/^(.*?)\s*\((https?:\/\/[^)]+)\)$/);
    return match
      ? `<a href="${match[2]}" target="_blank" rel="noopener noreferrer">${match[1]}</a>`
      : method;
  };

  // ---- Header ----
  el('lessonTitle').textContent = lessonData.title || '';
  el('lessonSummary').textContent = lessonData.summary || '';

  el('overviewList').innerHTML = [
    { label: 'Coding Method', value: lessonData.method },
    { label: 'Estimated time', value: lessonData.time },
    { label: 'Audience', value: lessonData.audience }
  ].map(item => `
    <div class="info-item">
      <div class="label">${item.label}</div>
      <div class="value">${item.label === 'Coding Method' ? formatMethod(item.value) : (item.value || '')}</div>
    </div>
  `).join('');

  // ---- Instructions (optional) ----
  showOrHide('instructionsBox', !!lessonData.instructions);
  if (lessonData.instructions) {
    el('instructionsBox').innerHTML = `<p style="margin-top:0">${lessonData.instructions}</p>`;
  }

  // ---- Standards ----
  if (el('standardsBox')) {
    el('standardsBox').innerHTML = (lessonData.standards || [])
      .map(s => `<span class="tag">${s}</span>`).join('');
  }

  // ---- Materials ----
  if (el('materialsBox')) {
    el('materialsBox').innerHTML = `<ul>${(lessonData.materials || []).map(m => `<li>${m}</li>`).join('')}</ul>`;
  }

  // ---- Setup ----
  if (el('setupNote')) {
    el('setupNote').innerHTML = lessonData.setupNote
      ? `<a href="../getting-ready-for-use.html" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:none;">${lessonData.setupNote}</a>`
      : '';
  }
  if (el('setupTips')) el('setupTips').textContent = lessonData.setupTips || '';

  // ---- Intro activity (optional) ----
  showOrHide('introBox', !!lessonData.intro);
  if (lessonData.intro) {
    el('introBox').innerHTML = `<p style="margin-top:0">${lessonData.intro}</p>`;
  }

  // ---- Finished early? (optional, data-driven instead of hardcoded per file) ----
  showOrHide('finishedEarlyBox', !!lessonData.finishedEarly);
  if (lessonData.finishedEarly && el('finishedEarlyBox')) {
    el('finishedEarlyBox').innerHTML = `<div class="callout">${lessonData.finishedEarly}</div>`;
  }

  // ---- Coding stages ----
  if (el('codingSetsBox')) {
    el('codingSetsBox').innerHTML = (lessonData.codingSets || []).map((set, setIndex) => {
      const steps = set.steps || [];
      const setInstructions = set.instructions || set.instruction || '';
      const instructionsMarkup = setInstructions
        ? `<p style="margin:0 0 14px; font-weight:normal;">${setInstructions}</p>`
        : '';

      const stepsMarkup = steps.map((step, i) => {
        const gifMarkup = (!step.gif) ? '' : `
          <div class="gif-box">
            <img src="${step.gif}" alt="Guiding animation for step ${i + 1}" loading="lazy" decoding="async" />
          </div>
        `;
        return `
          <div class="step carousel-slide${i === 0 ? ' active' : ''}" data-slide="${i}">
            <div class="step-layout">
              ${gifMarkup}
              <div class="step-copy">
                <div class="step-head"><span class="step-num">${i + 1}</span><span>${step.title || ''}</span></div>
                <div>${step.text || ''}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      const finalCode = set.finalCode || {};
      const codeCard = finalCode.image ? `
        <div class="example-card">
          <img class="final-code-image" src="${finalCode.image}" alt="${finalCode.title || ''}" loading="lazy" decoding="async" />
          <div class="example-caption">
            <strong>${finalCode.title || ''}</strong>
            ${finalCode.caption || ''}
          </div>
        </div>
      ` : `
        <div class="example-card">
          <div class="media-box">
            <div>
              <strong>Insert finished code image here</strong><br />
              Add the completed program for ${(set.title || '').toLowerCase()}.
            </div>
          </div>
          <div class="example-caption">
            <strong>${finalCode.title || `Finished Code: Set ${setIndex + 1}`}</strong>
            ${finalCode.caption || 'Insert a screenshot or photo of the final code.'}
          </div>
        </div>
      `;

      return `
        <details class="expandable-card" ${setIndex === 0 ? 'open' : ''}>
          <summary>${set.title || ''}</summary>
          <div class="card-body">
            ${instructionsMarkup}
            ${steps.length ? `
            <div class="carousel" data-carousel>
              <div class="carousel-viewport">${stepsMarkup}</div>
              <div class="carousel-controls">
                <button class="carousel-button" type="button" data-carousel-previous aria-label="Previous step">&#8592;</button>
                <span class="carousel-counter" aria-live="polite">Step 1 of ${steps.length}</span>
                <button class="carousel-button" type="button" data-carousel-next aria-label="Next step">&#8594;</button>
              </div>
            </div>
            <div style="margin-top: 18px;">
              <div class="footer-note" style="margin: 0 0 12px; font-weight: 700; color: var(--text);">Finished Code</div>
              <div class="example-grid">${codeCard}</div>
            </div>` : ''}
          </div>
        </details>
      `;
    }).join('');
  }

  // ---- Carousels ----
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const slides = [...carousel.querySelectorAll('.carousel-slide')];
    const counter = carousel.querySelector('.carousel-counter');
    const previous = carousel.querySelector('[data-carousel-previous]');
    const next = carousel.querySelector('[data-carousel-next]');
    let currentSlide = 0;

    const showSlide = (slideIndex) => {
      currentSlide = Math.max(0, Math.min(slideIndex, slides.length - 1));
      slides.forEach((slide, index) => slide.classList.toggle('active', index === currentSlide));
      counter.textContent = `Step ${currentSlide + 1} of ${slides.length}`;
      previous.disabled = currentSlide === 0;
      next.disabled = currentSlide === slides.length - 1;
    };

    previous.addEventListener('click', () => showSlide(currentSlide - 1));
    next.addEventListener('click', () => showSlide(currentSlide + 1));
    showSlide(0);
  });
})();
