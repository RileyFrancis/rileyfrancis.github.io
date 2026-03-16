---
layout: default
title: Projects
---

# Projects
Take a peek at some of the things I've been working on!

## Methods for Autonomous Navigation of Legged Robots
As a part of my senior design project, I got the opportunity to work on various methods for autonomous navigation on legged robots such as Unitree's Go2 robot. I examined methods such as SLAM, VLMaps, Reinforcement Learning, and more to compare and evaluate their performance.

My senior design group members included myself, [Martha Condori](https://www.linkedin.com/in/martha-condori-032378358/), [Abeshan Javed](https://www.linkedin.com/in/abeshan-javed-6ba1a7265/), and [Marcus Maravilla](https://www.linkedin.com/in/marcus-maravilla-42210630a/), [Grace McPadden](https://www.linkedin.com/in/grace-mcpadden/). Our mentor was [Dr. Jonathan Shihao Ji](https://www.linkedin.com/in/jonathan-shihao-ji-78ab725/).


<div id="pdf-wrapper">
  <div id="pdf-container"></div>
</div>

<style>
#pdf-wrapper {
  height: 600px;           /* adjust to taste */
  overflow-y: scroll;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: -3px 11px 32px 8px rgba(0,0,0,0.25);
  padding: 1.5rem;
  background: #ECF3F6;
}

/* Hide the scrollbar visually but keep it scrollable */
#pdf-wrapper::-webkit-scrollbar {
  width: 6px;
}
#pdf-wrapper::-webkit-scrollbar-track {
  background: transparent;
}
#pdf-wrapper::-webkit-scrollbar-thumb {
  background: #cccccc;
  border-radius: 3px;
}
</style>

<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

async function renderPDF(url, containerId) {
  const container = document.getElementById(containerId);
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

    container.appendChild(canvas);
    await page.render({
      canvasContext: canvas.getContext('2d'),
      viewport
    }).promise;
  }
}

renderPDF('{{ "assets/Reinforcement_Learning_Methods_for_Training_Simulated_Autonomous_Robots_Inside_Habitat-Lab.pdf" | relative_url }}', 'pdf-container');
</script>
