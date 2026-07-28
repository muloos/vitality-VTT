// Fundo de partículas flutuantes — versão enxuta da do protótipo.
export function startParticles(canvas, rgb = '206,196,255') {
  const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(devicePixelRatio || 1, 2);
  let W, H, parts = [];

  const sprite = (() => {
    const s = 64, cv = document.createElement('canvas');
    cv.width = cv.height = s;
    const g = cv.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.4, `rgba(${rgb},.3)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return cv;
  })();

  function seed() {
    const n = REDUCED ? 18 : Math.min(70, Math.round((W * H) / 22000));
    parts = [];
    for (let i = 0; i < n; i++) parts.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.7 + Math.random() * 1.9, a: 0.18 + Math.random() * 0.42,
      tw: 0.4 + Math.random() * 1.3, ph: Math.random() * 7,
      vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05,
    });
  }

  function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.a * (0.5 + 0.5 * Math.sin(t * p.tw + p.ph)));
      const r = p.r;
      ctx.drawImage(sprite, p.x - r * 3, p.y - r * 3, r * 6, r * 6);
    }
    ctx.globalAlpha = 1;
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(40, now - last); last = now;
    for (const p of parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
    }
    draw(now * 0.001);
    requestAnimationFrame(tick);
  }

  addEventListener('resize', resize);
  resize();
  if (REDUCED) draw(0); else requestAnimationFrame(tick);
}
