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
