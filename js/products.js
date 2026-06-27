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
    name: "Charcoal Silk Kurta",
    drop: "Drop 01",
    price: 7400,
    currency: "INR",
    colors: ["#2b2b2b", "#000000"],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDHLfudFsG5vFzSElWlHyB_d-q7O7546rbsAPDDP0jGGcoz_iigCuk1Jx7bCbLxd1QkVTRgNZ_VmJQBDjeXV_3K90lsw4XUC8zp4cOBfZORxI5h4EgOuW3w4dz7WphlV6WD53avYdsFUwKgB3JRt7tbm8OxzzEt56m52IwgEoFwniHEm7RS0K2IEvi0WHqLCIXmKMRg4mYD3mX8of2bGGV8KEtL91nR_xFRb_QMeFhdp0cV1IDzNek-TqqqnGI7SiKBFIHLkW-DXXM",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuASN45sXIdpGYr-v1KwIYw3zPx3O_pN0mGkZzyxa1bFpkUPQ9HHQuClcv8_-G45uaX9oBCSYAyJK6hzFH-m5TdkzUd_Qd7pjP9tz5DGJv2YqaMdj6o01EU9i3gd1UYA4ncpr5L5FpkXi0fh_mvs0rYEJTNSM9rVUbOimUzlkLGIoD4pJaWGRAlib9kzhrvICCsnB5iZE3tXY-f3zK_KiOw9DRbgOUMy8MN4ONzx_ulPRt9uMEh47h936LYnaLdZRrE5KLa3ywPqSFU",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA-HLKFFapCoK4zDwNDjWFvKzPNJdr9ypDqxOGeGLFYgKIwrdd2UIt0DNyZgSuRhB7Oh09EzcWT5HjghqrhlaiJ0ggr94l9PIUi63zXLrt5UFV96IU0aYfTtb4dHSeMXnjwHM4f0Gyn_LWYuBfo6IXq6ktZOwR0F5RRpZZFtijpY-WwQIxAe1nr4rMFdP59X6XKhj6Urymz68xJlxbXgUtlbGyZ4CXxApnjK3jfEJbsuljhF8v27LK4xs2rx7CET2OR231XoFgD_JQ"
    ],
    description: "Pure silk kurta with a fluid drape and concealed placket, made to order in our Chennai atelier. A quiet counterpoint to louder occasion-wear.",
    inStock: true,
    isNew: false
  },
  {
    id: "ev-003",
    name: "Columnar Trousers",
    drop: "Drop 01",
    price: 6200,
    currency: "INR",
    colors: ["#000000"],
    sizes: ["28", "30", "32", "34", "36"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD4M7_f9ramaH-TFcgc9RhKafLLb98EJLwlwO-6XENjN193fSJ8RwL2M4h8Rm4OT_yepOpYmKizQn6rIVR_86ucjdij4x9LtcQscO1Wra2I1ocIAMh2zVPX2qqNAzuKf7d1NLgfTeQT0nI-67vs7YDxmDuYIq2rekZFauxey6sTyDIsYMin0kVDZkK5_4BGQuDM1je_j0lHlqghAc-Rj1hxpAXp8HO_CPrITAiJWDiVD9ug8KfvWzdLXkspg92ySYYC_6rNVVZiKxo",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBUWzFUA-rExrm68wb_ds_Jl2P5f7Kz4iZ8CQ19YmgPlvmHbUy2Won7LDlSfe-VF3D4UcaJYI9qJPmXPQb6lH178msdhkSlRgyZHX6ncmHj3gSu3i_y7qPWHdEP8FNlwgVo2ioEefTZlzkE1iQAwFxwY4564d_SSicrAEM9rHeJc_YMYYEKiRBZYpgBd5EUcDvwrltqKdorfSPOvT7f6z-0kYdPmBd0iDT0Vz6bZ89H9IxnEm8nev7SZZOgQKqPpAnz2YPhNejMWjE"
    ],
    description: "Tailored trousers in heavy wool-blend, finished with a precise taper. Currently sold out — restock notifications coming with Drop 02.",
    inStock: false,
    isNew: false
  },
  {
    id: "ev-004",
    name: "Monolith Knit Sweater",
    drop: "Drop 02",
    price: 9800,
    currency: "INR",
    colors: ["#000000", "#4a4a4a"],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAwzXVuw-GZwZgzN00nxchcyeGywS8DEinQ8wSZroItpUyLrnCIDyOb5yRYpDYTkadgBArl2G7d0zXtOQpcs_CwaHhByDp7wpYIO-fIvXG1rsYRrdQ7Q6XtWjXojjMbJrc-mnpOTvJdgh066Neh3henkCtZ_EWL3j9p0BPOxNypbvabKlbYVL_iFPxQ1MwvZ__2qxeE-t67ENGVJrREcnNwkizIQvIINyvdS3rLcmZbRwk7XU3-1NBNDR72aCg3pp_3kYitdjyyCjg",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBfAkSNqhfIZnedaadALWZUOzP59G09XdPrMZjGsBu3fhTV1nhedmxZOZ8CwY4J-eFTA1PPVJHLO863GUKXjZQIM5RvWzH9HFXyaWk-o5yWRMGxVfMltD8tB2mRq3nFfAlsmobmLrbHyCPaNIJKVMJYsLlHJgXJ-3KXtLMj2lBDBDF269J1m1W8ocbV_WiLAlyOi0rFAjN5ykK0z3VgA0T0h3yykPlqWbk9eexbLN9bd7eiJkAuh3o0W11qjlfxeO4VXjDCzndeBto"
    ],
    description: "A structured collar knit in dense merino, designed for quiet weight and warmth. Part of our Drop 02 exploration of texture over print.",
    inStock: true,
    isNew: true
  },
  {
    id: "ev-005",
    name: "Static Tailored Blazer",
    drop: "Drop 02",
    price: 14200,
    currency: "INR",
    colors: ["#1a1a1a", "#666666"],
    sizes: ["S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBY88Mtd-JL2UJEzZ5Lo0kb0CitibzvsmF3h6CCz3p_SjZZjnU_h9a2T_LdvWxMV1laUkHl7P0mOfY9rFaRz2HCZ58DuczuTpcpZfowKu0ZBR5hd2EOyO48PKwJKCulNO5Q5NpktdF88d-IdD84K_W-Bojc-sYo5lsA0n_pSdKVgdPE6vCee3o1FjIqORMGemPNgSKuhKfpsY5Maqo-5wFHunoi1-9Zk02xpk7KvhGCXhblsvKjk84HcHDpuWfipEyM9EfD4h10-QY",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDIQPHqFHmhFgtacgqmt1Kt8eP7E2MEAQ1dOixJAkvdy-xsDY9k4_N3WIGn1Htgvna-QwBtEGMGbDSpti2mW1i-LJwROd8a_wtwdngGDJVnYH9pL7rGsZu55BwAuKz-1rg8zXC87iWGEpKMGQAukJua1zm__bGaETu-gagkS_Ltfd73XZWYls6HYFu6GGs9kce0BL3taIHZCybq6F-UjuBSI61Z1QqlsX4x5ZmUFvyCp29ElsSTa97Q1RLq2mWkMDsVhggZYeHMEnE"
    ],
    description: "Sharp lapels, minimalist horn buttons, an unlined construction for warm-weather formality. Made to order against your measurements.",
    inStock: true,
    isNew: false
  },
  {
    id: "ev-006",
    name: "Absolute Poplin Shirt",
    drop: "Drop 02",
    price: 4800,
    currency: "INR",
    colors: ["#ffffff", "#f5f5f0"],
    sizes: ["XS", "S", "M", "L", "XL"],
    images: [
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCQPgZdoPKRHs6S6mNelA7HqsE0BnaGBw0mab3Kd9b8Fl1eGdYij_lZziIXIIPKK5B7piNriV-MCthz_X38XMaj5QWTiwIdXENQTXWm-cV7v7XJxdaA7uAvlum3yOZkN8xLdKvh4gAB9VoP2AOawCDJVOgyJUfYTmG_kuqa7nfHBZggHEY9QGzr7Saq484DaHM52Rc5v77QcOqWpfdjN7pOHVLaZV6-yeQCiB_y9oeXYjdRi15eBpbAH_VL8GwfcvDpwcL_xA6WBM4",
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBd1EZX-1GvY-8HcGndSy0gcVI4pfIE1pNkOVvOTxSMgi1lEERbskoVTCe0UFxCk8A4ETxdX45FzYyFw4slZvy0SJxml0YZLJxxsuM3wyWKcMwcm0juhjSbHVqn0Jz1rx2eC0hutZcWKoJchC61JdDGulSDYAaisax5lfMDhQyAXdiW2DGbEEogypV6G4dIakk3HstT8xHfYA1p2fHPpQwn4eOuUCqLQYkFadQl-6Qk9_vlIA4YkUrt9w36tLz2zrCuOOP1Fk2S2w8"
    ],
    description: "Crisp cotton poplin with a concealed placket, cut for a clean, shadowless silhouette. An everyday essential made the EL VYNCE way.",
    inStock: true,
    isNew: false
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
