// ===== Electron particle scene: converge to a point, then burst =====
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('electronCanvas');

if (canvas && !reduceMotion) {
  const ctx = canvas.getContext('2d');
  const heroSection = canvas.closest('.hero');
  const colors = ['#65c1ff', '#39abd3', '#f1f4fe', '#0b35b3'];

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0, height = 0;
  let cx = 0, cy = 0;

  const PARTICLE_COUNT = 220;
  const LINK_DIST = 70;
  const CONVERGE_MS = 3200;
  const BLAST_MS = 1600;
  const HOLD_MS = 250;
  const HOT_COLOR = '#ffffff';

  let particles = [];
  let phase = 'converge'; // 'converge' | 'blast' | 'hold'
  let phaseStart = performance.now();
  let flashStrength = 0;

  function resize() {
    const rect = heroSection.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    cx = width / 2;
    cy = height * 0.42;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnParticle() {
    const angle = rand(0, Math.PI * 2);
    const radius = rand(Math.max(width, height) * 0.35, Math.max(width, height) * 0.6);
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      startX: 0, startY: 0,
      angle,
      radius,
      wobble: rand(0, Math.PI * 2),
      wobbleSpeed: rand(1.5, 3),
      size: rand(0.7, 3.4),
      twinkle: rand(0, Math.PI * 2),
      color: colors[Math.floor(rand(0, colors.length))],
      vx: 0, vy: 0,
    };
  }

  function initParticles() {
    particles = Array.from({ length: PARTICLE_COUNT }, spawnParticle);
    particles.forEach(p => { p.startX = p.x; p.startY = p.y; });
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function setPhase(next) {
    phase = next;
    phaseStart = performance.now();
    if (next === 'blast') {
      flashStrength = 1;
      const reach = Math.max(width, height);
      particles.forEach(p => {
        const a = rand(0, Math.PI * 2);
        const speed = rand(reach * 0.006, reach * 0.02);
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.x = cx;
        p.y = cy;
        p.prevX = cx;
        p.prevY = cy;
        p.blastSize = p.size * rand(1.6, 2.6);
      });
    }
    if (next === 'converge') {
      particles = Array.from({ length: PARTICLE_COUNT }, spawnParticle);
      particles.forEach(p => { p.startX = p.x; p.startY = p.y; });
    }
  }

  function draw(now) {
    // translucent overlay instead of a hard clear -> soft glowing trails
    ctx.fillStyle = 'rgba(0, 8, 42, 0.22)';
    ctx.fillRect(0, 0, width, height);
    const elapsed = now - phaseStart;

    if (phase === 'converge') {
      const t = Math.min(elapsed / CONVERGE_MS, 1);
      const eased = easeInOutCubic(t);
      particles.forEach(p => {
        p.wobble += 0.016 * p.wobbleSpeed;
        p.twinkle += 0.05;
        const wob = Math.sin(p.wobble) * (1 - eased) * 14;
        const baseX = p.startX + (cx - p.startX) * eased;
        const baseY = p.startY + (cy - p.startY) * eased;
        p.x = baseX + wob;
        p.y = baseY + Math.cos(p.wobble) * (1 - eased) * 14;
      });
      drawLinks(0.35 + eased * 0.35);
      particles.forEach(p => {
        const twk = 0.75 + Math.sin(p.twinkle) * 0.25;
        drawParticle(p, (0.55 + eased * 0.45) * twk);
      });
      if (t >= 1) setPhase('hold');
    } else if (phase === 'hold') {
      particles.forEach(p => {
        p.wobble += 0.05;
        p.twinkle += 0.08;
        p.x = cx + Math.cos(p.wobble) * 3;
        p.y = cy + Math.sin(p.wobble) * 3;
      });
      drawLinks(0.6);
      particles.forEach(p => {
        const twk = 0.75 + Math.sin(p.twinkle) * 0.25;
        drawParticle(p, twk);
      });
      if (elapsed >= HOLD_MS) setPhase('blast');
    } else if (phase === 'blast') {
      const t = Math.min(elapsed / BLAST_MS, 1);
      flashStrength = Math.max(0, 1 - t * 1.4);

      // full-screen white flash for the initial "boom"
      if (t < 0.18) {
        ctx.save();
        ctx.globalAlpha = (1 - t / 0.18) * 0.5;
        ctx.fillStyle = '#f1f4fe';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      particles.forEach(p => {
        p.prevX = p.x;
        p.prevY = p.y;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy *= 0.985;
        drawStreak(p, t);
      });

      drawFlash(flashStrength);
      drawShockwave(t, 0);
      drawShockwave(t, 0.12);
      drawShockwave(t, 0.24);
      if (t >= 1) setPhase('converge');
    }

    requestAnimationFrame(draw);
  }

  function drawLinks(baseAlpha) {
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          ctx.save();
          ctx.globalAlpha = baseAlpha * (1 - dist / LINK_DIST) * 0.5;
          ctx.strokeStyle = '#65c1ff';
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawParticle(p, alpha) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 9;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // white-hot at the core, cooling to the particle's own color as it flies out
  function drawStreak(p, t) {
    const cool = Math.min(1, t * 2.2);
    const color = cool >= 1 ? p.color : HOT_COLOR;
    const alpha = 1 - t;
    const size = p.blastSize * (1 - t * 0.5);

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha * 0.7);
    ctx.strokeStyle = color;
    ctx.lineWidth = size * 0.7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.prevX, p.prevY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFlash(strength) {
    if (strength <= 0) return;
    const radius = 340 * strength + 30;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * strength})`);
    grad.addColorStop(0.3, `rgba(241, 244, 254, ${0.55 * strength})`);
    grad.addColorStop(0.6, `rgba(101, 193, 255, ${0.35 * strength})`);
    grad.addColorStop(1, 'rgba(101, 193, 255, 0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawShockwave(t, delay) {
    const lt = Math.max(0, Math.min(1, (t - delay) / (1 - delay)));
    if (lt <= 0 || t < delay) return;
    const reach = Math.max(width, height) * 0.65;
    const radius = lt * reach;
    const alpha = Math.max(0, 1 - lt) * 0.55;
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#f1f4fe';
    ctx.lineWidth = 2.4 * (1 - lt) + 0.3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  resize();
  initParticles();
  requestAnimationFrame(draw);
  window.addEventListener('resize', () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    resize();
  });
}

// ===== 3D tilt-on-hover for cards =====
function attachTilt(selector, strength = 10) {
  if (reduceMotion) return;
  document.querySelectorAll(selector).forEach((card) => {
    card.style.transformStyle = 'preserve-3d';
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform =
        `perspective(700px) rotateY(${px * strength}deg) rotateX(${py * -strength}deg) translateZ(6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(700px) rotateY(0deg) rotateX(0deg) translateZ(0)';
    });
  });
}

// ===== Mobile nav toggle =====
const burger = document.getElementById('burger');
const mainNav = document.getElementById('mainNav');

function setMenuOpen(open) {
  mainNav.classList.toggle('open', open);
  burger.classList.toggle('active', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}

if (burger && mainNav) {
  burger.setAttribute('aria-controls', 'mainNav');
  burger.setAttribute('aria-expanded', 'false');

  burger.addEventListener('click', () => {
    setMenuOpen(!mainNav.classList.contains('open'));
  });

  mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  document.addEventListener('click', (e) => {
    if (
      mainNav.classList.contains('open') &&
      !mainNav.contains(e.target) &&
      !burger.contains(e.target)
    ) {
      setMenuOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mainNav.classList.contains('open')) {
      setMenuOpen(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setMenuOpen(false);
  });
}

// ===== Data =====
const offers = [
  { id: '32170', vertical: 'Health & Wellness', payout: '$68' },
  { id: '18327', vertical: 'Finance', payout: '$120' },
  { id: '31724', vertical: 'Dating', payout: '$42' },
  { id: '29981', vertical: 'Nutra', payout: '$55' },
  { id: '40213', vertical: 'Crypto', payout: '$95' },
  { id: '38820', vertical: 'Skincare', payout: '$60' },
  { id: '22157', vertical: 'Insurance', payout: '$140' },
  { id: '35509', vertical: 'Sweepstakes', payout: '$8' },
];

const features = [
  { color: 'var(--sp-g)', title: 'Superior commissions', text: 'High-converting, exclusive offers at rates that beat the network norm. When your volume justifies it, request a bump. We approve far more often than we decline.' },
  { color: 'var(--sp-b)', title: 'Seven-day payouts', text: 'Every single week, supported by fifteen years of never missing a single payment.' },
  { color: 'var(--accent)', title: '4,000+ opportunities', text: 'Hot lists, exclusives, and top performers, neatly organized with full details inside one dashboard.' },
  { color: 'var(--sp-y)', title: 'Premium support', text: 'You are a partner, not a ticket. Genuine five-star care as standard practice.' },
  { color: 'var(--sp-r)', title: 'Top-tier tracking', text: 'Everflow monitoring on every click, automated remittance on every sale.' },
  { color: 'var(--blue)', title: 'Direct access', text: 'Message the people who run the network directly.' },
];

const chatMessages = [
  { from: 'them', text: 'Hey — can we get offer 18327 greenlit for our push traffic?' },
  { from: 'us', text: 'Done. Also raised your payout 15% based on last month’s volume.' },
  { from: 'them', text: 'Thanks. When does this week’s commission arrive?' },
  { from: 'us', text: 'Wednesday. On schedule and in full, same as the last fifteen years.' },
];

const stats = [
  { num: 4000, suffix: '+', label: 'Live offers' },
  { num: 15, suffix: '+', label: 'Years of on-time payouts' },
  { num: 52, suffix: '', label: 'Payouts per year' },
  { num: 37000000, suffix: '+', label: 'Sales delivered' },
];

const reviews = [
  { quote: 'The best network for prompt payments. Support actually responds.', author: 'Shawan' },
  { quote: 'Commissions arrive every single week for two years running. Uncommon in this industry.', author: 'Leon G.' },
  { quote: 'Offers approved same day, payout bumps when we request them. It feels like a real alliance.', author: 'Masha' },
  { quote: 'Best-converting exclusives I have run. The dashboard is clean and fast.', author: 'Daniel K.' },
  { quote: 'Moved from a network that skipped payments twice. Peak2Partners has not missed once.', author: 'Priya R.' },
  { quote: 'Account manager understands our traffic better than we do. Genuinely helpful.', author: 'Tomas V.' },
];

const benefits = [
  { title: 'Scale', text: 'Hundreds of screened traffic partners ready to drive volume from day one.' },
  { title: 'Integrity', text: 'Every partner passes a multi-point identity and quality review.' },
  { title: 'Control', text: 'Set your own caps, approve traffic sources, and adjust payouts in real time.' },
  { title: 'Quality', text: 'We decline more affiliates than we accept. Only proven earners get in.' },
  { title: 'Insight', text: 'Full-funnel reporting so you know exactly where every sale originated.' },
  { title: 'Growth', text: 'Fifteen years of relationships across every major traffic vertical.' },
];

const securityPoints = [
  'Multi-point identity verification for every affiliate before onboarding.',
  'In-depth interview process, not a self-service signup form.',
  'Ongoing traffic quality checks across every live offer.',
  'Dedicated account manager reviewing performance each week.',
];

// ===== DOM helper =====
function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  }
  if (opts.style) node.style.cssText = opts.style;
  children.forEach(c => c && node.appendChild(c));
  return node;
}

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

// ===== Render functions (DOM-based, no innerHTML) =====
function renderOffers() {
  const track = document.getElementById('vaultTrack');
  clear(track);
  offers.forEach(o => {
    const card = el('div', { class: 'offer-card' }, [
      el('span', { class: 'offer-id', text: '#' + o.id }),
      el('div', {}, [
        el('div', { class: 'offer-payout', text: o.payout }),
        el('div', { class: 'offer-vertical', text: o.vertical }),
      ]),
    ]);
    track.appendChild(card);
  });
}

function renderFeatures() {
  const grid = document.getElementById('cardGrid');
  clear(grid);
  features.forEach(f => {
    const card = el('div', { class: 'feature-card' }, [
      el('div', { class: 'dot', style: 'background:' + f.color }),
      el('h3', { text: f.title }),
      el('p', { text: f.text }),
    ]);
    grid.appendChild(card);
  });
}

function renderChat() {
  const box = document.getElementById('chatMock');
  clear(box);
  chatMessages.forEach(m => {
    box.appendChild(el('div', { class: 'chat-msg ' + m.from, text: m.text }));
  });
}

function renderStats() {
  const grid = document.getElementById('statsGrid');
  clear(grid);
  stats.forEach((s, i) => {
    const numEl = el('div', { class: 'stat-num', text: '0', attrs: { 'data-num': s.num, 'data-suffix': s.suffix, id: 'stat-' + i } });
    const item = el('div', { class: 'stat-item' }, [
      numEl,
      el('div', { class: 'stat-label', text: s.label }),
    ]);
    grid.appendChild(item);
  });
}

function renderReviews() {
  const grid = document.getElementById('reviewGrid');
  clear(grid);
  reviews.forEach(r => {
    const card = el('div', { class: 'review-card' }, [
      el('div', { class: 'review-stars', text: '★★★★★' }),
      el('p', { class: 'review-quote', text: '"' + r.quote + '"' }),
      el('p', { class: 'review-author', text: r.author }),
    ]);
    grid.appendChild(card);
  });
}

function renderBenefits() {
  const grid = document.getElementById('benefitGrid');
  clear(grid);
  benefits.forEach(b => {
    const item = el('div', { class: 'benefit-item' }, [
      el('h4', { text: b.title }),
      el('p', { text: b.text }),
    ]);
    grid.appendChild(item);
  });
}

function renderSecurity() {
  const list = document.getElementById('securityList');
  clear(list);
  securityPoints.forEach(p => {
    list.appendChild(el('li', { text: p }));
  });
}

renderOffers();
renderFeatures();
renderChat();
renderStats();
renderReviews();
renderBenefits();
renderSecurity();

attachTilt('.offer-card', 8);
attachTilt('.feature-card', 6);

// ===== Vault carousel scroll buttons =====
const vaultCarousel = document.getElementById('vaultCarousel');
document.querySelectorAll('.carousel-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const dir = parseInt(btn.dataset.dir, 10);
    vaultCarousel.scrollBy({ left: dir * 240, behavior: 'smooth' });
  });
});

// ===== Count-up stats on scroll into view =====
function formatNum(n) {
  return n.toLocaleString('en-US');
}

function animateCount(target_el) {
  const target = parseInt(target_el.dataset.num, 10);
  const suffix = target_el.dataset.suffix || '';
  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(eased * target);
    target_el.textContent = formatNum(current) + suffix;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCount(entry.target);
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });

document.querySelectorAll('.stat-num').forEach(node => statObserver.observe(node));
