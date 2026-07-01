/* EL VYNCE — Cart state management.
   Real client-side cart: persists to localStorage, drives nav badge,
   drawer line items, and subtotal across all pages. No backend / payment. */

const EL_VYNCE_CART_KEY = "elvynce_cart_v1";

function evGetCart() {
  try {
    const raw = localStorage.getItem(EL_VYNCE_CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("EL VYNCE cart: failed to read localStorage", e);
    return [];
  }
}

function evSaveCart(cart) {
  localStorage.setItem(EL_VYNCE_CART_KEY, JSON.stringify(cart));
  evRenderCart();
}

function evAddToCart(item) {
  // item: { id, name, price, color, size, image, drop, qty }
  const cart = evGetCart();
  const existing = cart.find(
    (c) => c.id === item.id && c.color === item.color && c.size === item.size
  );
  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({ ...item, qty: item.qty || 1 });
  }
  evSaveCart(cart);
  evOpenCart();
}

function evUpdateQty(index, delta) {
  const cart = evGetCart();
  if (!cart[index]) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  evSaveCart(cart);
}

function evRemoveItem(index) {
  const cart = evGetCart();
  cart.splice(index, 1);
  evSaveCart(cart);
}

function evCartCount() {
  return evGetCart().reduce((sum, item) => sum + item.qty, 0);
}

function evCartSubtotal() {
  return evGetCart().reduce((sum, item) => sum + item.qty * item.price, 0);
}

function evFormatPrice(amount) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function evRenderCart() {
  const cart = evGetCart();

  // Badge(s) in nav — may exist on multiple nav instances
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    const count = evCartCount();
    el.textContent = count;
    el.style.display = count > 0 ? "flex" : "none";
  });

  const listEl = document.getElementById("cart-items-list");
  const emptyEl = document.getElementById("cart-empty-state");
  const subtotalEl = document.getElementById("cart-subtotal");

  if (subtotalEl) subtotalEl.textContent = evFormatPrice(evCartSubtotal());

  if (!listEl) return;

  listEl.innerHTML = "";

  if (cart.length === 0) {
    if (emptyEl) emptyEl.classList.remove("hidden");
    return;
  }
  if (emptyEl) emptyEl.classList.add("hidden");

  cart.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "flex gap-6 items-start fade-in";
    const thumb = item.image
      ? `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover" />`
      : (typeof evRenderPlaceholderSwatch === "function"
          ? evRenderPlaceholderSwatch({ name: item.name, placeholderSwatch: item.placeholderSwatch }, { sizeClass: "w-full h-full" })
          : "");
    row.innerHTML = `
      <div class="w-24 h-24 bg-surface-container flex-shrink-0 overflow-hidden">
        ${thumb}
      </div>
      <div class="flex-1 space-y-1">
        <div class="flex justify-between items-start">
          <h3 class="font-body-md text-primary font-medium">${item.name}</h3>
          <span class="label-sm text-primary">${evFormatPrice(item.price)}</span>
        </div>
        <p class="label-sm text-on-surface-variant">${item.color || ""} / Size ${item.size || ""}</p>
        <p class="label-sm text-on-surface-variant/60">${item.drop || ""}</p>
        <div class="flex items-center justify-between pt-4">
          <div class="flex items-center border border-[#E5E5E5] px-3 py-1 gap-4">
            <button class="material-symbols-outlined text-xs" style="font-size:16px;" onclick="evUpdateQty(${index}, -1)">remove</button>
            <span class="label-sm">${item.qty}</span>
            <button class="material-symbols-outlined text-xs" style="font-size:16px;" onclick="evUpdateQty(${index}, 1)">add</button>
          </div>
          <button class="label-sm text-on-surface-variant hover:text-primary underline underline-offset-4 transition-colors" onclick="evRemoveItem(${index})">Remove</button>
        </div>
      </div>
    `;
    listEl.appendChild(row);
  });
}

function evOpenCart() {
  const overlay = document.getElementById("cart-overlay");
  const drawer = document.getElementById("cart-drawer");
  if (!overlay || !drawer) return;
  overlay.classList.remove("pointer-events-none");
  overlay.classList.remove("opacity-0");
  overlay.classList.add("opacity-100");
  drawer.classList.remove("translate-x-full");
  drawer.classList.add("translate-x-0");
  document.body.style.overflow = "hidden";
}

function evCloseCart() {
  const overlay = document.getElementById("cart-overlay");
  const drawer = document.getElementById("cart-drawer");
  if (!overlay || !drawer) return;
  drawer.classList.add("translate-x-full");
  drawer.classList.remove("translate-x-0");
  overlay.classList.remove("opacity-100");
  overlay.classList.add("opacity-0");
  document.body.style.overflow = "";
  setTimeout(() => {
    overlay.classList.add("pointer-events-none");
  }, 400);
}

function evToggleCart() {
  const overlay = document.getElementById("cart-overlay");
  if (!overlay) return;
  if (overlay.classList.contains("opacity-100")) {
    evCloseCart();
  } else {
    evOpenCart();
  }
}

document.addEventListener("DOMContentLoaded", evRenderCart);
