// Renders PDFs into every .pdf-container on the projects page (projects.md)
// using pdf.js. Depends on the pdf.js CDN script being loaded first. Each
// container's PDF URL is read from its data-pdf-url attribute (set with Liquid
// in the page); styling of the wrappers is in _sass/pdf-viewer.scss. Any number
// of viewers can coexist on one page — they're selected by class, not id.

(function () {
  if (typeof pdfjsLib === 'undefined') return;

  const containers = document.querySelectorAll('.pdf-container[data-pdf-url]');
  if (!containers.length) return;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  async function renderPDF(url, target) {
    const pdf = await pdfjsLib.getDocument(url).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.display = 'block';
      canvas.style.width = '100%';   // scales to container width
      canvas.style.marginBottom = '1rem';

      target.appendChild(canvas);
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport
      }).promise;
    }
  }

  containers.forEach(c => {
    // Clicking a viewer opens the full PDF in a new tab.
    c.addEventListener('click', () => {
      window.open(c.dataset.pdfUrl, '_blank', 'noopener');
    });
    renderPDF(c.dataset.pdfUrl, c);
  });
})();
