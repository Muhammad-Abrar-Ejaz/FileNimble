export const siteConfig = {
  name: "FileNimble",
  tagline: "Any file. Right format.",
  description:
    "Convert images, PDFs and structured data, or recognize scanned text. Choose browser processing or temporary server processing with clear limits for each tool.",
  url: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").origin,
  ogImage: "/brand/filenimble-logo.png",
  links: {
    github: "https://github.com/filenimble",
  },
  mainNav: [
    { title: "PDF Tools", href: "/#pdf" },
    { title: "Image Tools", href: "/#image" },
    { title: "Document Tools", href: "/#document_data" },
    { title: "Media Tools", href: "/#audio" },
    { title: "All Tools", href: "/tools" },
  ],
  footerNav: [
    { title: "Tools Directory", href: "/tools" },
    { title: "File Formats", href: "/formats" },
    { title: "About Us", href: "/about" },
    { title: "Privacy Policy", href: "/privacy" },
    { title: "Terms of Service", href: "/terms" },
    { title: "Contact", href: "/contact" },
  ],
};
