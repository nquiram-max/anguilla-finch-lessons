(() => {
  const style = document.createElement('style');
  style.textContent = `
    .pdf-button {
      display: flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      margin-left: auto;
      margin-bottom: 18px;
      padding: 10px 14px;
      color: var(--brand-dark);
      font: inherit;
      font-weight: 700;
      background: white;
      border: 0;
      border-radius: 10px;
      cursor: pointer;
    }
    .pdf-button::before { content: "📄"; font-size: 1.05em; }
    .pdf-button:disabled { cursor: wait; opacity: 0.7; }
    .pdf-ready-link { display: inline-block; margin-left: 8px; color: white; font: inherit; font-weight: 700; text-decoration: underline; }
    .troubleshooting-button {
      position: absolute;
      top: 28px;
      left: 28px;
      padding: 10px 14px;
      color: var(--brand-dark);
      font: inherit;
      font-weight: 700;
      background: white;
      border-radius: 10px;
      text-decoration: none;
    }
    .troubleshooting-button:hover,
    .troubleshooting-button:focus-visible { background: #f0f4ff; outline: 2px solid white; }
    @media print { .pdf-button { display: none; } }
  `;
  document.head.appendChild(style);

  const hero = document.querySelector('.hero');
  if (!hero) return;

  const button = document.getElementById('createPdfButton') || document.createElement('button');
  if (!button.id) {
    button.className = 'pdf-button';
    button.id = 'createPdfButton';
    button.type = 'button';
    button.textContent = 'Create PDF';
    hero.prepend(button);
  }

  const troubleshootingLink = hero.querySelector('.hero-actions a') || document.createElement('a');
  if (!troubleshootingLink.parentElement) {
    troubleshootingLink.className = 'troubleshooting-button';
    troubleshootingLink.href = '../troubleshooting_common_problems.html';
    troubleshootingLink.target = '_blank';
    troubleshootingLink.rel = 'noopener noreferrer';
    troubleshootingLink.textContent = 'Troubleshooting & Common Problems';
    hero.append(troubleshootingLink);
  }

  const loadJsPdf = () => new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const timeout = window.setTimeout(() => reject(new Error('The PDF library took too long to load.')), 10000);
    script.onload = () => {
      window.clearTimeout(timeout);
      if (window.jspdf?.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error('The PDF library loaded without jsPDF.'));
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('The PDF library could not be loaded.'));
    };
    document.head.appendChild(script);
  });

  // Preload jsPDF library once when the script runs to avoid load delay during PDF creation
  const jsPdfPromise = loadJsPdf();

  const addText = (pdf, text, x, y, width, lineHeight = 5) => {
    const lines = pdf.splitTextToSize(text || '', width);
    lines.forEach((line) => {
      if (y > 280) { pdf.addPage(); y = 18; }
      pdf.text(line, x, y);
      y += lineHeight;
    });
    return y;
  };

  const imageDataUrl = (image) => new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const source = new Image();
    const timeout = window.setTimeout(() => reject(new Error(`Image could not be loaded: ${image.src}`)), 5000);
    source.onload = () => {
      window.clearTimeout(timeout);
      canvas.width = source.naturalWidth;
      canvas.height = source.naturalHeight;
      context.drawImage(source, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    source.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error(`Image could not be loaded: ${image.src}`));
    };
    source.src = image.currentSrc || image.src;
  });

  const waitForImage = (image) => new Promise((resolve) => {
    if (image.complete) { resolve(image.naturalWidth > 0); return; }
    const timeout = window.setTimeout(() => resolve(false), 5000);
    image.addEventListener('load', () => {
      window.clearTimeout(timeout);
      resolve(image.naturalWidth > 0);
    }, { once: true });
    image.addEventListener('error', () => {
      window.clearTimeout(timeout);
      resolve(false);
    }, { once: true });
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Creating PDF...';
    try {
      const JsPdf = await jsPdfPromise;
      const pdf = new JsPdf();
      const pageWidth = pdf.internal.pageSize.getWidth();
      let y = 20;
      pdf.setFontSize(18);
      y = addText(pdf, document.getElementById('lessonTitle')?.textContent, 18, y, pageWidth - 36, 8) + 5;
      pdf.setFontSize(12);
      // Add Intro Activity at the top of the PDF (if present)
      const introText = document.getElementById('introBox')?.innerText.trim();
      if (introText) {
        if (y > 265) { pdf.addPage(); y = 18; }
        pdf.setFont(undefined, 'bold');
        y = addText(pdf, 'Intro Activity', 18, y, pageWidth - 36, 8) + 3;
        pdf.setFont(undefined, 'normal');
        y = addText(pdf, introText, 18, y, pageWidth - 36) + 5;
      }

      pdf.setFont(undefined, 'bold');
      y = addText(pdf, 'Steps', 18, y, pageWidth - 36, 6) + 3;
      pdf.setFont(undefined, 'normal');

      const codingSets = [...document.querySelectorAll('#codingSetsBox > details')];
      codingSets.forEach((codingSet) => { codingSet.open = true; });
      for (const [setIndex, codingSet] of codingSets.entries()) {
        if (y > 265) { pdf.addPage(); y = 18; }
        // Use the summary title directly (e.g., "Stage 1: ...") without the "Coding Set X:" prefix
        const setTitle = codingSet.querySelector('summary')?.textContent.trim() || '';
        pdf.setFont(undefined, 'bold');
        y = addText(pdf, setTitle, 18, y, pageWidth - 36, 6) + 3;
        pdf.setFont(undefined, 'normal');

        codingSet.querySelectorAll('.step').forEach((step, index) => {
          const title = step.querySelector('.step-head')?.textContent.trim() || '';
          const copy = [...step.querySelectorAll('.step-copy > div:not(.step-head)')]
            .map((item) => item.textContent.trim()).join(' ');
          // Title already contains the step number via the .step-num element, so do not prepend another number.
          pdf.setFont(undefined, 'bold');
          y = addText(pdf, title, 18, y, pageWidth - 36) + 1;
          pdf.setFont(undefined, 'normal');
          y = addText(pdf, copy, 24, y, pageWidth - 42) + 4;
        });

        const finalCodeImages = [...codingSet.querySelectorAll('.example-grid img')];
        for (const image of finalCodeImages) {
          // Attempt to load images with anonymous CORS to allow canvas conversion.
          image.crossOrigin = "anonymous";
          // Ensure the image is loaded; if not, skip it without stopping the PDF build.
          if (!await waitForImage(image)) continue;
          if (y > 245) { pdf.addPage(); y = 18; }
          pdf.setFont(undefined, 'bold');
          y = addText(pdf, 'Final Code', 18, y, pageWidth - 36, 6) + 3;
          pdf.setFont(undefined, 'normal');
          try {
            const dataUrl = await imageDataUrl(image);
            const imageWidth = pageWidth - 36;
            const imageHeight = Math.min((image.naturalHeight / image.naturalWidth) * imageWidth, 130);
            if (y + imageHeight > 280) { pdf.addPage(); y = 18; }
            pdf.addImage(dataUrl, 'PNG', 18, y, imageWidth, imageHeight);
            y += imageHeight + 10;
          } catch (e) {
            // If converting the image fails (e.g., cross‑origin), log and continue.
            console.warn('Skipping image in PDF due to error:', e);
          }
        }
      }
      const title = document.getElementById('lessonTitle')?.textContent || 'lesson';
      const filename = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/-$/, '')}.pdf`;
      // Use jsPDF's built‑in save method to trigger download directly
      pdf.save(filename);
    } catch (error) {
      console.error(error);
      alert('The PDF could not be created. Please try again.');
    } finally {
      button.disabled = false;
      button.textContent = 'Create PDF';
    }
  });
})();
