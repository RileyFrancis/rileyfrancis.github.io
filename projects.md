---
layout: default
title: Projects
---

# Projects
**Take a peek at some of the things I've been working on!**

## Methods for Autonomous Navigation of Legged Robots
As a part of my senior design project, I got the opportunity to work on various methods for autonomous navigation on legged robots such as Unitree's Go2 robot. I examined methods such as SLAM, VLMaps, Reinforcement Learning, and more to compare and evaluate their performance.

My senior design group members included myself, [Martha Condori](https://www.linkedin.com/in/martha-condori-032378358/), [Abeshan Javed](https://www.linkedin.com/in/abeshan-javed-6ba1a7265/), and [Marcus Maravilla](https://www.linkedin.com/in/marcus-maravilla-42210630a/), [Grace McPadden](https://www.linkedin.com/in/grace-mcpadden/). Our mentor was [Dr. Jonathan Shihao Ji](https://www.linkedin.com/in/jonathan-shihao-ji-78ab725/).


<div class="carousel">
  <div class="carousel-track-wrapper">
    <div class="carousel-track">
      <div class="carousel-slide">
        <img src="assets/ITE_map_SLAM.png" alt="A SLAM map of a floor in UConn's ITE building."/>
      </div>
      <!-- <div class="carousel-slide">
        <img src="your-image-2.jpg" alt="Description 2"/>
      </div>
      <div class="carousel-slide">
        <video src="your-video.mp4" controls muted loop playsinline></video>
      </div> -->
    </div>
  </div>

  <button class="carousel-btn prev">&#8592;</button>
  <button class="carousel-btn next">&#8594;</button>

  <div class="carousel-dots"></div>
</div>

<style>
.carousel {
  position: relative;
  width: 100%;
  max-width: 700px;
  margin: 0 auto 2rem auto;
}

.carousel-track-wrapper {
  overflow: hidden;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  background: #f9f9f9;
}

.carousel-track {
  display: flex;
  transition: transform 0.4s ease;
}

.carousel-slide {
  min-width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.carousel-slide img,
.carousel-slide video {
  width: 100%;
  height: 400px;          /* adjust to taste */
  object-fit: contain;
  display: block;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.85);
  border: 1px solid #ddd;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  transition: background 0.2s;
  z-index: 10;
}

.carousel-btn:hover {
  background: #fff;
}

.carousel-btn.prev { left: -20px; }
.carousel-btn.next { right: -20px; }

.carousel-dots {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
}

.carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ccc;
  cursor: pointer;
  transition: background 0.2s;
}

.carousel-dot.active {
  background: #267CB9;   /* matches your site's link color */
}
</style>

<script>
(function() {
  const track = document.querySelector('.carousel-track');
  const slides = document.querySelectorAll('.carousel-slide');
  const prevBtn = document.querySelector('.carousel-btn.prev');
  const nextBtn = document.querySelector('.carousel-btn.next');
  const dotsContainer = document.querySelector('.carousel-dots');

  let current = 0;

  // Build dots
  slides.forEach((_, i) => {
    const dot = document.createElement('div');
    dot.classList.add('carousel-dot');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function updateDots() {
    document.querySelectorAll('.carousel-dot').forEach((d, i) => {
      d.classList.toggle('active', i === current);
    });
  }

  function goTo(index) {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    updateDots();
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  // Swipe support for mobile
  let startX = 0;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
  track.addEventListener('touchend', e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
  });
})();
</script>


<div id="pdf-wrapper">
  <div id="pdf-container"></div>
</div>

<style>
#pdf-wrapper {
  height: 800px;           /* adjust to taste */
  overflow-y: scroll;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
  box-shadow: -3px 11px 32px 8px rgba(0,0,0,0.25);
  padding: 1.5rem;
  background: #ECF3F6;
  margin-bottom: 3rem;
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


<!-- ## Training Graph Neural Networks on Brain Data -->
