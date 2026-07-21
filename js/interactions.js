/* EL VYNCE — site-wide luxury interaction layer.
   Custom cursor, smooth scroll easing, scroll-reveal, magnetic buttons, scroll progress.
   Vanilla JS, no dependencies. Does not touch the hero's three.js scene. */

function initCustomCursor() {
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
  const isTouch = "ontouchstart" in window;
  if (isCoarse || noHover || isTouch) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // "Glowing orb" cursor — an ambient, softly-blurred halo that drifts behind
  // a crisp tracking point. Calm and couture, matching the brand's "stillness".
  //   dot  — snaps to the pointer instantly (the precise point).
  //   glow — a blurred radial halo, physics-lerped in a rAF loop
  //          (framerate-independent) with a gentle velocity stretch so quick
  //          flicks smear like light. Both use mix-blend-mode:difference so the
  //          cursor self-inverts over the night-mode hero, dark imagery, and
  //          white type — always visible, never lost.
  const dot = document.createElement("div");
  dot.className = "ev-cursor-dot";
  const glow = document.createElement("div");
  glow.className = "ev-cursor-glow";
  const label = document.createElement("span");
  label.className = "ev-cursor-label";
  label.textContent = "↗"; // ↗ "open" glyph shown over product imagery
  glow.appendChild(label);
  document.body.appendChild(dot);
  document.body.appendChild(glow);
  document.documentElement.classList.add("ev-cursor-active");

  let mx = -100, my = -100;   // real pointer
  let gx = -100, gy = -100;   // lagged glow
  let shown = false;
  let steady = false;         // over text/image: hold shape, skip the stretch
  let pulseAt = -1;           // click-pulse timestamp
  let lastFrame = performance.now();

  function frame(now) {
    // Time-corrected lerp: identical feel at 60 Hz and 144 Hz.
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const k = 1 - Math.exp(-11 * dt);
    gx += (mx - gx) * k;
    gy += (my - gy) * k;

    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;

    // Click pulse: a quick outward bounce that decays over ~0.45s. Done in JS
    // (not a CSS keyframe) because the glow's transform is owned by this loop.
    let pulse = 1;
    if (pulseAt >= 0) {
      const p = (now - pulseAt) / 450;
      if (p >= 1) pulseAt = -1;
      else pulse = 1 + Math.sin(p * Math.PI) * 0.4 * (1 - p);
    }

    const vx = mx - gx, vy = my - gy;
    const speed = Math.hypot(vx, vy);
    if (!reduceMotion && !steady && speed > 1.5) {
      const angle = Math.atan2(vy, vx);
      const stretch = Math.min(speed * 0.007, 0.32);
      glow.style.transform =
        `translate(${gx}px, ${gy}px) translate(-50%, -50%) ` +
        `rotate(${angle}rad) scale(${(1 + stretch) * pulse}, ${(1 - stretch * 0.5) * pulse})`;
    } else {
      glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%, -50%) scale(${pulse})`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    if (!shown) {
      // First movement: materialize at the pointer, not at 0,0.
      gx = mx; gy = my;
      shown = true;
      dot.classList.add("is-shown");
      glow.classList.add("is-shown");
    }
    // The hero canvas signals clickable figures/cars via style.cursor.
    const overHero = e.target && e.target.tagName === "CANVAS" && e.target.style.cursor === "pointer";
    dot.classList.toggle("is-hero-hover", overHero);
    glow.classList.toggle("is-hero-hover", overHero);
  });

  // Fade out when the mouse leaves the window entirely.
  document.addEventListener("mouseleave", () => {
    dot.classList.remove("is-shown");
    glow.classList.remove("is-shown");
    shown = false;
  });

  // Hover states, most specific first:
  //   view  — product imagery: glow tightens and shows the ↗ glyph
  //   text  — inputs: collapse into a slim I-beam bar
  //   hover — links/buttons: glow blooms brighter, dot recedes
  const viewSelector = ".product-image, [data-cursor-view]";
  const textSelector = "input:not([type=button]):not([type=submit]), textarea, [contenteditable]";
  const hoverSelector = "a, button, [data-cursor-grow], select, label, [data-magnetic]";
  function setState(el) {
    const view = !!(el && el.closest && el.closest(viewSelector));
    const text = !view && !!(el && el.closest && el.closest(textSelector));
    const hover = !view && !text && !!(el && el.closest && el.closest(hoverSelector));
    steady = view || text;
    [dot, glow].forEach((n) => {
      n.classList.toggle("is-view", view);
      n.classList.toggle("is-text", text);
      n.classList.toggle("is-hovering", hover);
    });
  }
  document.addEventListener("mouseover", (e) => setState(e.target));
  document.addEventListener("mouseout", () => setState(null));

  // Click: dot contracts, glow gives a soft outward pulse (handled in frame()).
  document.addEventListener("mousedown", () => {
    dot.classList.add("is-clicking");
    glow.classList.add("is-clicking");
    if (!reduceMotion) pulseAt = performance.now();
  });
  document.addEventListener("mouseup", () => {
    dot.classList.remove("is-clicking");
    glow.classList.remove("is-clicking");
  });
}

function initSmoothScroll() {
  // Lightweight easing on anchor-link jumps only — leaves native scroll,
  // keyboard nav, and screen-reader behavior completely untouched.
  document.documentElement.style.scrollBehavior = "smooth";
}

function initScrollReveal() {
  const els = document.querySelectorAll("[data-reveal]");
  if (!els.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.getAttribute("data-reveal-delay") || 0;
          entry.target.style.transitionDelay = `${delay}ms`;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  els.forEach((el) => observer.observe(el));

  // Several pages render their product grids / PDP markup into the DOM
  // *after* DOMContentLoaded (via innerHTML from products.js-driven inline
  // scripts), so [data-reveal] elements inside those grids don't exist yet
  // when this function first runs. Watch for newly-inserted nodes carrying
  // data-reveal and observe them too, so dynamic content still gets the
  // reveal treatment without requiring per-page render-callback wiring.
  if ("MutationObserver" in window) {
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("[data-reveal]") && !node.classList.contains("is-revealed")) {
            observer.observe(node);
          }
          if (node.querySelectorAll) {
            node.querySelectorAll("[data-reveal]").forEach((child) => {
              if (!child.classList.contains("is-revealed")) observer.observe(child);
            });
          }
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
}

function attachMagnetic(el) {
  if (el.dataset.evMagneticBound) return;
  el.dataset.evMagneticBound = "1";

  const RADIUS = 90;
  const MAX_PULL = 8;

  let targetX = 0;
  let targetY = 0;
  let curX = 0;
  let curY = 0;
  let animating = false;

  function tick() {
    curX += (targetX - curX) * 0.2;
    curY += (targetY - curY) * 0.2;
    el.style.transform = `translate(${curX}px, ${curY}px)`;
    if (Math.abs(targetX - curX) > 0.1 || Math.abs(targetY - curY) > 0.1) {
      requestAnimationFrame(tick);
    } else {
      animating = false;
    }
  }

  function startTick() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  window.addEventListener("mousemove", (e) => {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < RADIUS) {
      const pull = 1 - dist / RADIUS;
      targetX = (dx / RADIUS) * MAX_PULL * pull;
      targetY = (dy / RADIUS) * MAX_PULL * pull;
    } else {
      targetX = 0;
      targetY = 0;
    }
    startTick();
  });

  el.addEventListener("mouseleave", () => {
    targetX = 0;
    targetY = 0;
    startTick();
  });
}

function initMagneticButtons() {
  const els = document.querySelectorAll("[data-magnetic]");
  if (!els.length) return;

  els.forEach(attachMagnetic);

  // Mirror initScrollReveal()'s approach: some [data-magnetic] CTAs (e.g.
  // the PDP "Add to Cart" button) are injected after DOMContentLoaded by
  // page-specific render functions, so watch for late-arriving nodes too.
  if ("MutationObserver" in window) {
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== 1) return;
          if (node.matches && node.matches("[data-magnetic]")) attachMagnetic(node);
          if (node.querySelectorAll) {
            node.querySelectorAll("[data-magnetic]").forEach(attachMagnetic);
          }
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
}

function initScrollProgress() {
  const bar = document.createElement("div");
  bar.className = "ev-scroll-progress";
  document.body.appendChild(bar);

  function update() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? Math.min(100, (scrollTop / max) * 100) : 0;
    bar.style.width = pct + "%";
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

document.addEventListener("DOMContentLoaded", () => {
  initCustomCursor();
  initSmoothScroll();
  initScrollReveal();
  initMagneticButtons();
  initScrollProgress();
});
