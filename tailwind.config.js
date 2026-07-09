/* EL VYNCE — Tailwind build config.
   This replaces the old runtime CDN (cdn.tailwindcss.com). The compiled,
   minified output lives at css/tailwind.css and is what every page loads.

   When you ADD or CHANGE Tailwind utility classes in any .html or js/*.js file,
   regenerate the stylesheet:  npm run build:css   (see BUILD.md)

   The theme below mirrors the old inline `tailwind.config` exactly, so the
   site's look is unchanged. maxWidth.container-max is added explicitly because
   `max-w-container-max` reads Tailwind's maxWidth scale (not spacing). */
module.exports = {
  content: ["./*.html", "./js/*.js"],
  theme: {
    extend: {
      colors: {
        primary: "#000000",
        "on-primary": "#ffffff",
        secondary: "#666666",
        "on-surface-variant": "#666666",
        "surface-container": "#f3f3f3",
        "surface-container-low": "#f9f9f9",
        "outline-variant": "#e5e5e5",
      },
      spacing: {
        unit: "8px",
        gutter: "24px",
        "section-gap": "120px",
        "container-max": "1440px",
        "margin-desktop": "64px",
        "margin-mobile": "20px",
      },
      maxWidth: { "container-max": "1440px" },
      fontFamily: {
        "headline-lg": ["Bodoni Moda"],
        "label-sm": ["Inter"],
        "headline-md": ["Bodoni Moda"],
        "body-lg": ["Inter"],
        "body-md": ["Inter"],
        "display-lg": ["Bodoni Moda"],
      },
      fontSize: {
        "headline-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.01em", fontWeight: "400" }],
        "headline-lg-mobile": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "400" }],
        "headline-md": ["32px", { lineHeight: "40px", fontWeight: "400" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.1em", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "28px", letterSpacing: "0.01em", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "display-lg": ["80px", { lineHeight: "90px", letterSpacing: "-0.02em", fontWeight: "400" }],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
