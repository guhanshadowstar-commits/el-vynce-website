/* EL VYNCE — site-wide luxury interaction layer.
   Custom cursor, smooth scroll easing, scroll-reveal, magnetic buttons, scroll progress.
   Vanilla JS, no dependencies. Does not touch the hero's three.js scene. */

function initCustomCursor() {
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
  const isTouch = "ontouchstart" in window;
  if (isCoarse || noHover || isTouch) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // "Viewfinder" cursor — four corner brackets framing the pointer like a
  // camera focus reticle. Sharp and architectural (matches the "architectural
  // silhouette" language already in the product copy) rather than soft/ambient.
  //   4 corner brackets — a lagged square (rAF-lerped, framerate-independent)
  //     that contracts on links, flares open with a "+" zoom mark over
  //     product imagery, and gives a quick focus-lock snap on click.
  //   center dot — snaps to the pointer instantly (the precise point).
  // mix-blend-mode:difference makes it self-invert over the night-mode hero,
  // dark imagery, and white type — always visible, never lost.
  const root = document.createElement("div");
  root.className = "ev-cursor-root";
  const dot = document.createElement("div");
  dot.className = "ev-cursor-dot";
  const corners = ["tl", "tr", "bl", "br"].map((pos) => {
    const c = document.createElement("div");
    c.className = `ev-cursor-corner ev-cursor-corner-${pos}`;
    root.appendChild(c);
    return c;
  });
  const label = document.createElement("span");
  label.className = "ev-cursor-label";
  label.textContent = "+"; // zoom mark shown over product imagery
  root.appendChild(label);
  document.body.appendChild(dot);
  document.body.appendChild(root);
  document.documentElement.classList.add("ev-cursor-active");

  let mx = -100, my = -100;   // real pointer
  let cx = -100, cy = -100;   // lagged bracket-square center
  let half = 16;              // current bracket-square half-size (lerped)
  let targetHalf = 16;
  let shown = false;
  let lockAt = -1;            // click focus-lock timestamp
  let lastFrame = performance.now();

  function frame(now) {
    // Time-corrected lerp: identical feel at 60 Hz and 144 Hz.
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const k = 1 - Math.exp(-14 * dt);
    cx += (mx - cx) * k;
    cy += (my - cy) * k;
    half += (targetHalf - half) * k;

    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;

    // Focus-lock: a quick inward snap-and-release on click, like a camera
    // racking focus. Done in JS (not a CSS keyframe) since size is owned here.
    let snap = 0;
    if (lockAt >= 0) {
      const p = (now - lockAt) / 320;
      if (p >= 1) lockAt = -1;
      else snap = Math.sin(p * Math.PI) * 5 * (1 - p * 0.4);
    }
    const h = Math.max(4, half - (reduceMotion ? 0 : snap));

    root.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    corners[0].style.transform = `translate(${-h}px, ${-h}px)`;   // tl
    corners[1].style.transform = `translate(${h}px, ${-h}px)`;    // tr
    corners[2].style.transform = `translate(${-h}px, ${h}px)`;    // bl
    corners[3].style.transform = `translate(${h}px, ${h}px)`;     // br

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    if (!shown) {
      // First movement: materialize at the pointer, not at 0,0.
      cx = mx; cy = my;
      shown = true;
      dot.classList.add("is-shown");
      root.classList.add("is-shown");
    }
    // The hero canvas signals clickable figures/cars via style.cursor.
    const overHero = e.target && e.target.tagName === "CANVAS" && e.target.style.cursor === "pointer";
    dot.classList.toggle("is-hero-hover", overHero);
    root.classList.toggle("is-hero-hover", overHero);
  });

  // Fade out when the mouse leaves the window entirely.
  document.addEventListener("mouseleave", () => {
    dot.classList.remove("is-shown");
    root.classList.remove("is-shown");
    shown = false;
  });

  // Hover states, most specific first:
  //   view  — product imagery: brackets flare wide and show the "+" zoom mark
  //   text  — inputs: brackets hide, collapse into a slim I-beam bar
  //   hover — links/buttons: brackets contract into a tight lock
  const viewSelector = ".product-image, [data-cursor-view]";
  const textSelector = "input:not([type=button]):not([type=submit]), textarea, [contenteditable]";
  const hoverSelector = "a, button, [data-cursor-grow], select, label, [data-magnetic]";
  function setState(el) {
    const view = !!(el && el.closest && el.closest(viewSelector));
    const text = !view && !!(el && el.closest && el.closest(textSelector));
    const hover = !view && !text && !!(el && el.closest && el.closest(hoverSelector));
    targetHalf = view ? 26 : hover ? 9 : 16;
    [dot, root].forEach((n) => {
      n.classList.toggle("is-view", view);
      n.classList.toggle("is-text", text);
      n.classList.toggle("is-hovering", hover);
    });
  }
  document.addEventListener("mouseover", (e) => setState(e.target));
  document.addEventListener("mouseout", () => setState(null));

  // Click: dot contracts, brackets rack focus inward (handled in frame()).
  document.addEventListener("mousedown", () => {
    dot.classList.add("is-clicking");
    root.classList.add("is-clicking");
    if (!reduceMotion) lockAt = performance.now();
  });
  document.addEventListener("mouseup", () => {
    dot.classList.remove("is-clicking");
    root.classList.remove("is-clicking");
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
