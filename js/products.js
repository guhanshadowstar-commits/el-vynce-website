/* EL VYNCE — placeholder product catalogue.
   PLACEHOLDER DATA: pending real client product/Drop photography, copy, pricing,
   and inventory. Replace with the actual catalogue before launch.

   Image URLs point at the Stitch-export placeholder photography (Google-hosted
   AIDA preview assets) used purely as stand-ins for layout/visual purposes. */

const EL_VYNCE_PRODUCTS = [
  {
    id: "ev-001",
    name: "Void Architect Bandhgala",
    drop: "Drop 01",
    price: 18500,
    currency: "INR",
    colors: ["#000000", "#2b2b2b"],
    sizes: ["XS", "S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuADIVdNC9tftf8b7kz0ixgjwuaYu7BHvrAsQEisJ0JqA7p4WOjrJ3x4-NtM6n1nKe_Y0bQacCgD4vuAGtTkeRVVyP8mhb7hPRpZ1Y9atRXdpMZOqLb7GqLwnYt_eNsscWDyiQKzktc-k104a0RsklKNQt8CpaNT5LH5NGUac4LzuYgldWngBIzaAQ2D4oC-1F2Srg9DVIMpnKpmVMiw_vMVLTJFPci4Scf2c4OwdMrpri9sJfgBwlsyjrgdAyQDUy9nMDruyG8IEMk",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuACa6Fi8Xa96_e9RDkwukOPPOaMuOOpar2I8E9QbfSzJiXZFnxQTKW87JaENqSOk8B0VRYOwgWcfhgPajds56C6-57g-eUmms2yRaQhrof3713BouiC7i92jwYPRt-zXZpEYaaP3JC89P2s0H3KT-M0A9ihmtjwTCN4eRcIpKSb0mPo1j5HFGwdqljijUyKgd_Ot95Ll6z5ceq8GNQCXllsRYjjH60nmwSi3eV52xVdw6c9gRWWp0RmN8a5J5t3Z_CnvtWOQ_wgD2M"
    ],
    description: "A made-to-order bandhgala in heavyweight wool-blend, cut with an architectural silhouette. Hand-finished button placket, structured shoulder, and a silhouette built for stillness rather than spectacle.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-002",
    name: "Rebel Soul",
    drop: "Drop 01",
    price: 7400, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#b3001b"],
    sizes: ["S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/rebel-soul-front.png", "images/products/rebel-soul-back.png"],
    placeholderSwatch: {
      bg: "#b3001b",
      front: { text: "REBEL SOUL", style: "serif", color: "#ffffff" },
      back: { text: "I stayed quiet, that was my loudest rebellion", style: "line-art", color: "#ffffff" }
    },
    description: "Red tee — front print \"REBEL SOUL\" in white serif text. Back print: abstract line-art of overlapping face/profile silhouettes with the line \"I stayed quiet, that was my loudest rebellion.\" Made to order in our Chennai atelier.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-003",
    name: "Frequency",
    drop: "Drop 01",
    price: 6200, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#d8c3a5"],
    sizes: ["28", "30", "32", "34", "36"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/frequency-front.png", "images/products/frequency-back.png"],
    placeholderSwatch: {
      bg: "#d8c3a5",
      front: { text: "FREQUENCY", style: "thin-sans", color: "#000000" },
      back: { text: "Everything is energy and a vibrational frequency that includes you", style: "sacred-geometry", color: "#000000" }
    },
    description: "Tan/beige tee — front print \"FREQUENCY\" in a thin elegant sans-serif wordmark. Back print: a vertical column of geometric/sacred-geometry symbols (triangle, bowtie, cone, sphere, rings, cube) with the line \"Everything is energy and a vibrational frequency that includes you.\"",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-003b",
    name: "Inner Noise",
    drop: "Drop 01",
    price: 6200, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#0e6b73"],
    sizes: ["S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/inner-noise-front.png", "images/products/inner-noise-back.png"],
    description: "Teal tee — front print \"INNER NOISE\" in a tall serif wordmark. Back print: an illustrated profile portrait wrapped in looping arrow-paths with small surrounding captions, with \"INNER NOISE\" set across the chest.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-004",
    name: "Style Pays Off",
    drop: "Warrior Drop",
    price: 9800, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#f1ead9"],
    sizes: ["S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/style-pays-off-front.png"],
    placeholderSwatch: {
      bg: "#f1ead9",
      front: { text: "STYLE PAYS OFF", style: "barcode", color: "#000000" }
    },
    description: "Cream/off-white tee — front print: a barcode graphic with \"STYLE PAYS OFF\" set beneath it. Part of the Warrior Drop.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-005",
    name: "Just Be Resilient",
    drop: "Warrior Drop",
    price: 14200, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#1b2a4a"],
    sizes: ["S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/just-be-resilient-front.png", "images/products/just-be-resilient-back.png"],
    placeholderSwatch: {
      bg: "#1b2a4a",
      front: { text: "JUST BE RESILIENT", style: "elegant-serif", color: "#ffffff" },
      back: { text: "RESILIENT / facing difficulties head-on / TAKE CONTROL, LIVE YOUR DREAMS / El Vynce", style: "bold-sans-plus-script", color: "#ffffff" }
    },
    description: "Navy tee — front print \"JUST BE RESILIENT\" in elegant serif. Back print: \"RESILIENT\" in bold sans-serif, with sub-text \"facing difficulties head-on\" and \"TAKE CONTROL, LIVE YOUR DREAMS,\" plus the El Vynce signature-script logo.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-006",
    name: "Dare to Be Different",
    drop: "Warrior Drop",
    price: 4800, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#000000"],
    sizes: ["XS", "S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/dare-to-be-different-front.png", "images/products/dare-to-be-different-back.png"],
    placeholderSwatch: {
      bg: "#000000",
      front: { text: "Dare to be different. Anything is possible if you believe. The future is ours", style: "hand-drawn-scribble", color: "#ffffff" },
      back: { text: "UNREAL / Exclusive Members Only (DESIGNED AND DEVELOPED) / El Vynce", style: "collegiate-bold-plus-script", color: "#ffffff" }
    },
    description: "Black tee — front print: a hand-drawn-style squiggle/scribble wordmark with small text along it: \"Dare to be different. Anything is possible if you believe. The future is ours.\" Back print: \"UNREAL\" in bold collegiate lettering with \"Exclusive Members Only (DESIGNED AND DEVELOPED)\" and the El Vynce signature-script logo.",
    inStock: true,
    isNew: false
  },
  {
    id: "ev-006b",
    name: "Built Different",
    drop: "Warrior Drop",
    price: 4800, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#8a9a7b"],
    sizes: ["XS", "S", "M", "L", "XL"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/built-different-front.png", "images/products/built-different-back.png"],
    placeholderSwatch: {
      bg: "#8a9a7b",
      front: { text: "Built Different", style: "gothic-blackletter", color: "#000000" },
      back: { text: "COMFORT ZONES ARE OVERRATED / Built Different / ESTD.2025", style: "tall-serif-caps-plus-script", color: "#000000" }
    },
    description: "Sage green tee — front print \"Built Different\" in gothic/blackletter font. Back print: \"COMFORT ZONES ARE OVERRATED\" in tall serif caps, overlaid with the script \"Built Different\" and \"ESTD.2025.\"",
    inStock: true,
    isNew: false
  },
  {
    id: "ev-006c",
    name: "I'm Just a Girl",
    drop: "Warrior Drop",
    price: 4800, // PLACEHOLDER PRICE — pending client confirmation
    currency: "INR",
    colors: ["#c9a8c4"],
    sizes: ["XS", "S", "M", "L"], // PLACEHOLDER SIZE CHART — pending client's Drop-specific measurements
    images: ["images/products/im-just-a-girl-front.png"],
    description: "Lavender crop top — front print: a pink bow graphic with the line \"I'm just a girl.\" Note: 1 more crop-top is still pending for this Drop and is not included here.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-007",
    name: "Sculptural Wool Overcoat",
    drop: "Drop 03",
    price: 24500,
    currency: "INR",
    colors: ["#3a3a3a", "#000000"],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDIQPHqFHmhFgtacgqmt1Kt8eP7E2MEAQ1dOixJAkvdy-xsDY9k4_N3WIGn1Htgvna-QwBtEGMGbDSpti2mW1i-LJwROd8a_wtwdngGDJVnYH9pL7rGsZu55BwAuKz-1rg8zXC87iWGEpKMGQAukJua1zm__bGaETu-gagkS_Ltfd73XZWYls6HYFu6GGs9kce0BL3taIHZCybq6F-UjuBSI61Z1QqlsX4x5ZmUFvyCp29ElsSTa97Q1RLq2mWkMDsVhggZYeHMEnE",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAofetXXv8YM2CTx-VVEdTtZlDuB4VGdG-GVmgnaUUYVnYQib72kZnal5bMQwXEVAU9Q752QFpZPGPDZg5koeZ7L3clDG3UFaov73YUp8B2UZ0p_51148regRq7iVj6t67gWgmSIZSAaM6PgYjFS7ZqeOuSfmN7YuMy69HFzdOZninci0jlIdX5TIwoiQw6MkZEP_Rvz2OfQ551DnebLoqliz727Rih4pb3ZXQClynd4ymftRvlSMmA7S5U2w5hKhffOAgskLt1rTI"
    ],
    description: "A heavy structural overcoat with hidden button placket, sculpted to hold its shape in motion and at rest. Limited Drop 03 production run.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-008",
    name: "Observer Leather Carry-All",
    drop: "Drop 03",
    price: 16800,
    currency: "INR",
    colors: ["#000000"],
    sizes: ["One Size"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDeP_hoPLlSKddEupBlXLfsk2wFC0vBAp6uDa0IAtFlpIQA7AgWF5599nQ65cmqxZOTzM742zlZASRWosAWzyDbooZWlQvGKbMTQy6ce99x18XQKcCsbI4lkV1a19B-ovA_qdyqqjprHBst8uKji-Z0gaeIyBWA-YIxSgUFRf8iX1u3rL-rQ7EFOy2rYxs2YnpiFHZCZ0lCJduu5q-sBu0siy3-JvdFbgrWC5hSuTT0pdq7qTXvBpeKLkrdEW4STmBwlygDv30NpHI"
    ],
    description: "Matte black leather carry-all, hand-finished in small batches. Understated proportions built for daily structure.",
    inStock: true,
    isNew: false
  }
];

if (typeof window !== "undefined") {
  window.EL_VYNCE_PRODUCTS = EL_VYNCE_PRODUCTS;
}
