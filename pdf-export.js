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

  // Fetch the image by URL and return { dataUrl, width, height }. This avoids
  // lazy-loading and canvas-taint problems: the bytes come from fetch (no CORS
  // needed for same-origin/relative URLs or file:// in most browsers), and the
  // canvas is drawn from a blob: URL which never taints the canvas.
  const loadImageData = (img) => new Promise((resolve, reject) => {
    const url = img.currentSrc || img.src;
    const timeout = window.setTimeout(() => reject(new Error(`Image load timed out: ${url}`)), 8000);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
        return res.blob();
      })
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const source = new Image();
        source.onload = () => {
          window.clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          canvas.width = source.naturalWidth;
          canvas.height = source.naturalHeight;
          canvas.getContext('2d').drawImage(source, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(objectUrl);
          resolve({ dataUrl, width: source.naturalWidth, height: source.naturalHeight });
        };
        source.onerror = () => {
          window.clearTimeout(timeout);
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Image could not be decoded: ${url}`));
        };
        source.src = objectUrl;
      })
      .catch((err) => {
        window.clearTimeout(timeout);
        reject(err);
      });
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

  // Stamp "Page N of M" at the bottom-right of every page. Call after all
  // content has been added so the page count is final.
  const addPageNumbers = (pdf) => {
    const pageCount = pdf.internal.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Page ${i} of ${pageCount}`, pageWidth - 18, pageHeight - 10, { align: 'right' });
    }
    pdf.setFontSize(12);
  };

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
      // Add Lesson Description before the Intro Activity (if present)
      const lessonDesc = document.getElementById('lessonSummary')?.textContent.trim();
      if (lessonDesc) {
        if (y > 265) { pdf.addPage(); y = 18; }
        pdf.setFont(undefined, 'bold');
        y = addText(pdf, 'Lesson Description', 18, y, pageWidth - 36, 8) + 3;
        pdf.setFont(undefined, 'normal');
        y = addText(pdf, lessonDesc, 18, y, pageWidth - 36) + 5;
      }
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
          const rawTitle = step.querySelector('.step-head')?.textContent.trim() || '';
          // Insert a period after the leading number (e.g., "1 Title" → "1. Title").
          const title = rawTitle.replace(/^(\d+)(.*)/, '$1. $2');
          const copy = [...step.querySelectorAll('.step-copy > div:not(.step-head)')]
            .map((item) => item.textContent.trim()).join(' ');
          // Use normal font weight for step titles and copy (no bold).
          pdf.setFont(undefined, 'normal');
          y = addText(pdf, title, 18, y, pageWidth - 36) + 1;
          y = addText(pdf, copy, 24, y, pageWidth - 42) + 4;
        });

        const finalCodeImages = [...codingSet.querySelectorAll('.example-grid img')];
        for (const img of finalCodeImages) {
          if (y > 245) { pdf.addPage(); y = 18; }
          pdf.setFont(undefined, 'bold');
          y = addText(pdf, 'Final Code', 18, y, pageWidth - 36, 6) + 3;
          pdf.setFont(undefined, 'normal');
          try {
            // Load the image straight from its src URL so it works regardless of
            // lazy loading, collapsed <details>, or file:// canvas restrictions.
            const { dataUrl, width, height } = await loadImageData(img);
            const imageWidth = pageWidth - 36;
            const imageHeight = Math.min((height / width) * imageWidth, 130);
            if (y + imageHeight > 280) { pdf.addPage(); y = 18; }
            pdf.addImage(dataUrl, 'PNG', 18, y, imageWidth, imageHeight);
            y += imageHeight + 10;
          } catch (e) {
            console.warn('Skipping image in PDF due to error:', e);
          }
        }
      }
      // Add "Finished early?" section after all steps and pictures
      let finishedEarlyText = '';
      const finishedHeader = Array.from(document.querySelectorAll('.card-header')).find(h =>
        h.textContent.trim() === 'Finished early?');
      if (finishedHeader) {
        const callout = finishedHeader.parentElement?.querySelector('.card-body .callout');
        if (callout) finishedEarlyText = callout.textContent.trim();
      }
      if (finishedEarlyText) {
        if (y > 265) { pdf.addPage(); y = 18; }
        pdf.setFont(undefined, 'bold');
        y = addText(pdf, 'Finished early?', 18, y, pageWidth - 36, 6) + 3;
        pdf.setFont(undefined, 'normal');
        y = addText(pdf, finishedEarlyText, 18, y, pageWidth - 36) + 5;
      }
      // Estimated time no longer displayed per user request.

      // Stamp page numbers at the bottom-right of every page before saving.
      addPageNumbers(pdf);

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
