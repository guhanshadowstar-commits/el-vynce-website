/* EL VYNCE — site-wide luxury interaction layer.
   Custom cursor, smooth scroll easing, scroll-reveal, magnetic buttons, scroll progress.
   Vanilla JS, no dependencies. Does not touch the hero's three.js scene. */

function initCustomCursor() {
  const isCoarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
  const isTouch = "ontouchstart" in window;
  if (isCoarse || noHover || isTouch) return;

  // Dot + trailing ring cursor — dot snaps instantly, ring follows with CSS lag.
  const dot = document.createElement("div");
  dot.className = "ev-cursor-dot";
  const ring = document.createElement("div");
  ring.className = "ev-cursor-ring";
  document.body.appendChild(dot);
  document.body.appendChild(ring);
  document.documentElement.classList.add("ev-cursor-active");

  window.addEventListener("mousemove", (e) => {
    const x = e.clientX, y = e.clientY;
    dot.style.transform  = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
    ring.style.transform = `translate(calc(${x}px - 50%), calc(${y}px - 50%))`;
  });

  const hoverSelector = "a, button, [data-cursor-grow], input, textarea, select, .product-image, label";
  document.addEventListener("mouseover", (e) => {
    if (e.target.closest && e.target.closest(hoverSelector)) {
      dot.classList.add("is-hovering");
      ring.classList.add("is-hovering");
    }
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest && e.target.closest(hoverSelector)) {
      dot.classList.remove("is-hovering");
      ring.classList.remove("is-hovering");
    }
  });
  document.addEventListener("mousedown", () => {
    dot.classList.add("is-clicking");
    ring.classList.add("is-clicking");
  });
  document.addEventListener("mouseup", () => {
    dot.classList.remove("is-clicking");
    ring.classList.remove("is-clicking");
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
