/* EL VYNCE — localStorage-based wishlist. No backend; ids only, resolved
   against EL_VYNCE_PRODUCTS at render time so it never goes stale if a
   product's price/images change. */

const EV_WISHLIST_KEY = "ev-wishlist";

function evGetWishlist() {
  try {
    const raw = JSON.parse(localStorage.getItem(EV_WISHLIST_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function evSetWishlist(ids) {
  localStorage.setItem(EV_WISHLIST_KEY, JSON.stringify(ids));
  evUpdateWishlistBadge();
}

function evIsWishlisted(id) {
  return evGetWishlist().includes(id);
}

function evToggleWishlist(id) {
  const list = evGetWishlist();
  const idx = list.indexOf(id);
  if (idx === -1) list.push(id);
  else list.splice(idx, 1);
  evSetWishlist(list);
  return list.includes(id);
}

function evUpdateWishlistBadge() {
  const count = evGetWishlist().length;
  document.querySelectorAll("[data-wishlist-count]").forEach((el) => {
    el.textContent = String(count);
    el.style.display = count > 0 ? "flex" : "none";
  });
}

document.addEventListener("DOMContentLoaded", evUpdateWishlistBadge);
