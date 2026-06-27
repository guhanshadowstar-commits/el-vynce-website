/* EL VYNCE — shared site behaviors: sticky nav shadow, accordions, mobile menu. */

document.addEventListener("DOMContentLoaded", () => {
  const nav = document.querySelector("nav[data-main-nav]");
  if (nav) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 20) {
        nav.classList.add("shadow-sm");
      } else {
        nav.classList.remove("shadow-sm");
      }
    });
  }

  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }
});

function evToggleAccordion(button) {
  const parent = button.parentElement;
  const isOpen = parent.classList.contains("accordion-active");
  document.querySelectorAll(".accordion").forEach((acc) => {
    acc.classList.remove("accordion-active");
  });
  if (!isOpen) {
    parent.classList.add("accordion-active");
  }
}

/* Placeholder visual renderer for products that don't yet have real photography
   (e.g. Drop 01 "Rebel Soul"/"Frequency", and the Warrior Drop tees). Renders a
   flat color swatch in the product's real garment color with the print text
   overlaid, keyed by product — not a generic gray box. */
function evRenderPlaceholderSwatch(product, options) {
  options = options || {};
  const sizeClass = options.sizeClass || "w-full h-full";
  if (!product || !product.placeholderSwatch) {
    return `<div class="${sizeClass} bg-surface-container flex items-center justify-center"><span class="label-sm text-secondary">Image coming soon</span></div>`;
  }
  const swatch = product.placeholderSwatch;
  const front = swatch.front || {};
  return `
    <div class="${sizeClass} flex items-center justify-center text-center p-6" style="background:${swatch.bg};">
      <div class="flex flex-col items-center gap-3">
        <span class="material-symbols-outlined" style="color:${front.color || "#000000"}; opacity:0.7; font-size:28px;">checkroom</span>
        <p class="label-sm font-medium leading-snug" style="color:${front.color || "#000000"};">${front.text || product.name}</p>
        <span class="label-sm text-[9px] opacity-60" style="color:${front.color || "#000000"};">Placeholder visual — pending product photography</span>
      </div>
    </div>
  `;
}

function evToggleModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (modal.classList.contains("hidden")) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    document.body.style.overflow = "hidden";
  } else {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    document.body.style.overflow = "";
  }
}
