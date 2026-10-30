export interface ImageToolData {
  slug: string;
  title: string;
  description: string;
  features: string[];
  steps: { name: string; text: string }[];
  faqs: { q: string; a: string }[];
}

export const IMAGE_TOOLS: ImageToolData[] = [
  {
    "slug": "png-to-jpg",
    "title": "Convert PNG to JPG",
    "description": "Convert PNG images to JPG with adjustable quality, custom background colors for transparent areas, and batch processing. 100% free, private, and client-side.",
    "features": [
      "Convert PNG to JPG with adjustable quality (10%–100%)",
      "Custom background color replacement for transparent PNGs",
      "Batch process up to 20 images with client-side ZIP export",
      "Runs in the browser; images are not uploaded to FileNimble"
    ],
    "steps": [
      {
        "name": "Upload PNG Files",
        "text": "Drag and drop one or multiple PNG images into the uploader, or click Choose Files from your computer or phone."
      },
      {
        "name": "Configure Options",
        "text": "Select your preferred JPG quality (85% recommended) and pick a background color to flatten transparent areas."
      },
      {
        "name": "Convert & Download",
        "text": "Click Convert to JPG to generate your files instantly. Download each JPG individually or save all in a single ZIP file."
      }
    ],
    "faqs": [
      {
        "q": "Is PNG to JPG conversion free on FileNimble?",
        "a": "Yes, 100% free. There are no daily limits, watermarks, or paid subscriptions required to convert your images."
      },
      {
        "q": "Are my PNG files uploaded to your servers?",
        "a": "No. This conversion runs in your browser using HTML5 Canvas and createImageBitmap. FileNimble does not upload the selected image for this conversion."
      },
      {
        "q": "What happens to transparent PNG backgrounds?",
        "a": "JPEG is a format that does not support transparency (alpha channels). FileNimble lets you select a solid background color (white by default, black, or any custom color) to replace transparent pixels cleanly before encoding."
      },
      {
        "q": "Can I convert multiple PNG files at once?",
        "a": "Yes. You can select or drop up to 20 PNG images at once. FileNimble processes them with client-side concurrency and gives you individual download buttons plus a 'Download All as ZIP' option."
      },
      {
        "q": "Can I choose the JPG compression quality?",
        "a": "Yes. Use the quality slider to adjust output compression from 10% to 100%. The recommended default is 85%, which produces great visual fidelity while reducing file size significantly."
      },
      {
        "q": "Does converting PNG to JPG reduce image quality?",
        "a": "PNG uses lossless compression, whereas JPG is a lossy compression format. While converting reduces file size, setting the quality to 85%–95% preserves virtually identical visual appearance for everyday photos, web graphics, and screenshots."
      }
    ]
  },
  {
    "slug": "jpg-to-png",
    "title": "Convert JPG to PNG",
    "description": "Transform JPG photos into high-fidelity, uncompressed PNG graphics entirely in your browser with zero server uploads and complete privacy.",
    "features": [
      "Lossless PNG re-encoding with full fidelity preservation",
      "Batch convert up to 20 JPG files simultaneously",
      "Client-side download individually or combined in a ZIP archive",
      "Runs in the browser; images are not uploaded to FileNimble"
    ],
    "steps": [
      {
        "name": "Upload JPG Images",
        "text": "Drag & drop or select your JPG files. You can convert single images or batches up to 20 files."
      },
      {
        "name": "Process in Browser",
        "text": "Click Convert. FileNimble instantly re-encodes the image into standard lossless PNG pixels locally."
      },
      {
        "name": "Download PNG",
        "text": "Download your converted PNG files individually or bundle all files together as a single ZIP archive."
      }
    ],
    "faqs": [
      {
        "q": "Does converting JPG to PNG add transparent backgrounds?",
        "a": "No. Original JPG files do not contain an alpha transparency channel. Converting a JPG to PNG produces an opaque PNG image; it cannot retroactively create transparent areas or restore transparency that was never there."
      },
      {
        "q": "Does converting JPG to PNG improve image quality?",
        "a": "No. While PNG is a lossless format, converting a JPG to PNG cannot restore image detail, sharpness, or compression artifacts that were already discarded during original JPEG compression."
      },
      {
        "q": "Are my images uploaded to FileNimble servers?",
        "a": "This conversion runs in your browser using HTML5 Canvas. FileNimble does not upload the selected image for this conversion."
      },
      {
        "q": "Why convert JPG to PNG if quality does not increase?",
        "a": "PNG is ideal when you need to prevent further quality degradation during subsequent edits, when integrating images into graphics pipelines that require PNG input, or when preparing assets for overlays."
      },
      {
        "q": "Can I convert multiple JPG images at once?",
        "a": "Yes. You can upload up to 20 images in batch mode. FileNimble processes them with memory-safe concurrency and provides a single ZIP download option."
      }
    ]
  },
  {
    "slug": "jpg-to-webp",
    "title": "Convert JPG to WebP",
    "description": "Convert JPG images to modern WebP format for superior web compression. Reduce file sizes by 30% or more while maintaining visual fidelity.",
    "features": [
      "Convert JPG to WebP with adjustable quality control",
      "Batch convert up to 20 images simultaneously",
      "Runs in the browser; images are not uploaded to FileNimble",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Upload JPGs",
        "text": "Drag and drop your JPG or JPEG files into the secure drop zone."
      },
      {
        "name": "Adjust Quality",
        "text": "Choose your desired compression quality slider setting."
      },
      {
        "name": "Download WebP",
        "text": "Download your converted WebP files individually or as a ZIP archive."
      }
    ],
    "faqs": [
      {
        "q": "Why convert JPG to WebP?",
        "a": "WebP is a modern image format developed by Google that delivers superior lossy compression compared to JPEG. File size depends on image content and quality; this converter shows the actual result rather than promising a fixed saving."
      },
      {
        "q": "Do all modern browsers support WebP?",
        "a": "Yes. WebP is supported by all major modern web browsers including Google Chrome, Apple Safari (iOS and macOS), Mozilla Firefox, and Microsoft Edge."
      },
      {
        "q": "Are my images uploaded to any server during conversion?",
        "a": "No. FileNimble converts your JPG images to WebP directly on your device using native browser Canvas APIs. Zero image data is sent across the network."
      },
      {
        "q": "What quality setting is recommended for JPG to WebP?",
        "a": "Start at 80% and inspect the download. Lower quality can introduce visible artifacts; higher settings may increase size."
      }
    ]
  },
  {
    "slug": "png-to-webp",
    "title": "Convert PNG to WebP",
    "description": "Convert PNG images to modern WebP format with full alpha transparency support. Cut file sizes dramatically while keeping crisp edges.",
    "features": [
      "Converts PNG to WebP while preserving alpha transparency",
      "Adjustable lossy or lossless compression settings",
      "Runs in the browser; images are not uploaded to FileNimble",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Upload PNGs",
        "text": "Select or drag your PNG images into the uploader."
      },
      {
        "name": "Configure Options",
        "text": "Choose lossy or lossless compression and quality settings."
      },
      {
        "name": "Download WebP",
        "text": "Download converted WebP images individually or as a single ZIP."
      }
    ],
    "faqs": [
      {
        "q": "Does WebP support transparent PNG backgrounds?",
        "a": "Yes! Unlike JPG, WebP includes native support for 8-bit alpha channel transparency. Converting your transparent PNGs to WebP will keep all transparent areas intact with file size determined by content and quality."
      },
      {
        "q": "How much smaller is WebP compared to PNG?",
        "a": "There is no fixed reduction. WebP output depends on image content and quality, and small or already optimized PNGs can become larger. Compare actual results."
      },
      {
        "q": "Are my PNG files uploaded to a remote server?",
        "a": "No. FileNimble executes the full conversion directly in your browser using HTML5 Canvas APIs. Your files never leave your computer."
      }
    ]
  },
  {
    "slug": "webp-to-jpg",
    "title": "Convert WebP to JPG",
    "description": "Turn WebP images into widely compatible JPG photos in seconds. Set your preferred quality and replace transparent areas cleanly.",
    "features": [
      "Convert WebP to standard JPG with customizable background color",
      "Adjustable JPG compression quality",
      "Runs in the browser; images are not uploaded to FileNimble",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Select WebP Files",
        "text": "Drag & drop or select your WebP images."
      },
      {
        "name": "Choose Background & Quality",
        "text": "Pick a background color for transparent pixels and set JPG quality."
      },
      {
        "name": "Download JPG",
        "text": "Save your JPG images individually or as a ZIP."
      }
    ],
    "faqs": [
      {
        "q": "Why convert WebP to JPG?",
        "a": "Although WebP is modern and compact, some older desktop image viewers, printers, document editors, and legacy websites only accept JPG/JPEG files. Converting to JPG ensures universal compatibility everywhere."
      },
      {
        "q": "What happens if my WebP has a transparent background?",
        "a": "JPG files do not support transparency. FileNimble lets you select a background color (White by default, Black, or a custom color) to fill any transparent areas smoothly before generating the JPG."
      },
      {
        "q": "Are my images uploaded to your servers?",
        "a": "This conversion runs in your browser using HTML5 Canvas. FileNimble does not upload the selected image for this conversion."
      },
      {
        "q": "Can I choose the JPG output quality?",
        "a": "Yes. Use the quality slider to pick your desired compression level between 10% and 100% (85% recommended)."
      }
    ]
  },
  {
    "slug": "webp-to-png",
    "title": "Convert WebP to PNG",
    "description": "Convert WebP images into standard PNG files with full alpha transparency preserved. Free, instant, and private in your browser.",
    "features": [
      "Converts WebP to lossless PNG with transparent alpha channels",
      "Client-side batch processing up to 20 images",
      "Runs in the browser; images are not uploaded to FileNimble",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Select WebP Files",
        "text": "Drag & drop your WebP images into the secure drop zone."
      },
      {
        "name": "Convert to PNG",
        "text": "FileNimble decodes WebP and re-encodes to lossless PNG locally."
      },
      {
        "name": "Download PNG",
        "text": "Download converted PNG files individually or as a ZIP."
      }
    ],
    "faqs": [
      {
        "q": "Does converting WebP to PNG preserve transparency?",
        "a": "Yes. PNG fully supports alpha transparency. If your WebP image has transparent regions, they will be preserved accurately in the generated PNG."
      },
      {
        "q": "Why convert WebP to PNG?",
        "a": "PNG is universally supported by virtually every image editor (like Photoshop, GIMP, Figma), desktop publishing software, and legacy systems that do not natively open WebP files."
      },
      {
        "q": "Does converting WebP to PNG increase file size?",
        "a": "Yes, in most cases. WebP uses more advanced compression than PNG. Converting to lossless PNG ensures compatibility across all software at the expense of a slightly larger file size."
      },
      {
        "q": "Are my images uploaded to any server?",
        "a": "No. This conversion runs locally in your browser using HTML5 Canvas. FileNimble does not upload the selected image for this conversion."
      }
    ]
  },
  {
    "slug": "image-to-pdf",
    "title": "Image to PDF Converter",
    "description": "Combine JPG, PNG, and WebP images into clean, printable PDF documents. Set page sizes, margins, and orientation locally in your browser.",
    "features": [
      "Combine up to 20 images into a single multi-page PDF document",
      "A4, Letter, and Fit to Image page size choices with custom margins",
      "Runs in the browser; image content is not uploaded",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Upload Images",
        "text": "Drag & drop up to 20 JPG, PNG, or WebP images into the uploader."
      },
      {
        "name": "Configure PDF",
        "text": "Choose your page format (A4, Letter, Fit to image), margins, and whether to merge into 1 PDF."
      },
      {
        "name": "Download PDF",
        "text": "Download your compiled PDF document instantly with standard PDF formatting."
      }
    ],
    "faqs": [
      {
        "q": "Can I combine multiple images into a single PDF document?",
        "a": "Yes! FileNimble allows you to upload up to 20 images (JPG, PNG, or WebP) and combines them into a single multi-page PDF document in the exact order you select."
      },
      {
        "q": "What page sizes and layouts are supported?",
        "a": "You can choose between standard A4, Letter, or Fit to Image (which sizes each page to match the exact image pixel dimensions). You can also choose between Portrait, Landscape, or Auto orientation."
      },
      {
        "q": "Are my photos uploaded to your servers to create the PDF?",
        "a": "No. The entire PDF assembly runs client-side in your web browser. Your private documents and images never touch an external server."
      },
      {
        "q": "Can I set custom page margins?",
        "a": "Yes. Choose 0pt, 20pt, or 40pt margins. Fit Image maps one image pixel to one PDF point, plus margins. JPEG and WebP are rendered to PNG pixels for embedding, so the PDF can be larger than the source files. Animation and source metadata are not retained."
      }
    ]
  },
  {
    "slug": "image-compress",
    "title": "Compress Images Online",
    "description": "Shrink image file size with real-time quality control. Fast, private, and 100% browser-based with zero server uploads.",
    "features": [
      "Adjustable quality compression for JPG and WebP images",
      "Real measured byte comparison, never estimated",
      "Runs in the browser; image content is not uploaded",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Upload Images",
        "text": "Select or drag your image files into the compressor."
      },
      {
        "name": "Set Quality",
        "text": "Adjust the quality slider to find your balance of size and visual clarity."
      },
      {
        "name": "Download Compressed Images",
        "text": "Download the compressed image results individually or as a ZIP."
      }
    ],
    "faqs": [
      {
        "q": "How does browser-side image compression work?",
        "a": "FileNimble passes your quality setting to the browser JPEG or WebP encoder. Lower quality can discard visible detail. Actual output can be smaller or larger; compare the generated result before keeping it."
      },
      {
        "q": "Can PNG files be compressed using a quality slider?",
        "a": "No. PNG is strictly a lossless format. Standard browser encoders do not support lossy quality reduction for PNG. If you need substantial file size reductions for PNGs, FileNimble offers the option to convert them to lossy WebP, which supports transparency. Savings depend on the image and are not guaranteed."
      },
      {
        "q": "Are percentage savings estimated or real?",
        "a": "All savings shown on FileNimble are calculated directly from the real output file size compared to the original input file size (never estimated or faked)."
      },
      {
        "q": "Are my images uploaded to any server?",
        "a": "No. This compression tool processes the selected image in your browser; FileNimble does not upload it for this conversion."
      }
    ]
  },
  {
    "slug": "image-resize",
    "title": "Resize Images Online",
    "description": "Resize JPG, PNG, and WebP images by pixels or percentage. Maintain aspect ratio and process files entirely in your browser.",
    "features": [
      "Resize images by exact pixel dimensions or percentage scale",
      "Lock aspect ratio option with client-side bicubic resampling",
      "Runs in the browser; image content is not uploaded",
      "Limits: Up to 20 images, 50 MiB total batch size"
    ],
    "steps": [
      {
        "name": "Upload Images",
        "text": "Select or drop your JPG, PNG, or WebP images into the uploader."
      },
      {
        "name": "Set Dimensions",
        "text": "Enter new width/height in pixels or choose a percentage scale."
      },
      {
        "name": "Download Resized Images",
        "text": "Download resized images individually or as a ZIP archive."
      }
    ],
    "faqs": [
      {
        "q": "Can I lock the aspect ratio while resizing?",
        "a": "Yes. By default, the aspect ratio lock is enabled. Entering a new width will automatically calculate the proportional height, preventing unwanted image stretching or distortion."
      },
      {
        "q": "What formats can I resize?",
        "a": "You can resize JPG, JPEG, PNG, and WebP images. FileNimble retains the original format and transparency where applicable."
      },
      {
        "q": "Does resizing decrease image quality?",
        "a": "Downscaling an image reduces pixel count and file size while keeping visual clarity crisp. Upscaling beyond the original resolution cannot invent missing detail, but FileNimble applies browser-provided high-quality Canvas smoothing. Upscaling is disabled unless you explicitly enable it."
      },
      {
        "q": "Are my photos uploaded to a server?",
        "a": "No. This resizing conversion runs in your browser using HTML5 Canvas; FileNimble does not upload the selected image for this conversion."
      }
    ]
  },
  {
    "slug": "image-crop",
    "title": "Crop Images Online",
    "description": "Crop images interactively with preset aspect ratios (1:1, 16:9, 4:3) or freeform selection. Fast, private, and client-side.",
    "features": [
      "Interactive cropper with 1:1, 16:9, 4:3, and freeform aspect ratios",
      "Lossless pixel cropping executed client-side in canvas",
      "Runs in the browser; image content is not uploaded",
      "Limits: Single image crop at a time, 50 MiB max size"
    ],
    "steps": [
      {
        "name": "Upload Image",
        "text": "Select or drop your image into the interactive cropper."
      },
      {
        "name": "Adjust Crop Box",
        "text": "Drag the handles or choose an aspect ratio preset."
      },
      {
        "name": "Download Cropped Image",
        "text": "Download your cropped image instantly."
      }
    ],
    "faqs": [
      {
        "q": "Can I crop images to exact aspect ratios like 1:1 or 16:9?",
        "a": "Yes! FileNimble includes preset buttons for standard ratios including 1:1 (Square for avatars/Instagram), 4:3 (Standard photography), and 16:9 (Widescreen/YouTube thumbnails), as well as freeform cropping."
      },
      {
        "q": "Does cropping reduce the resolution of the image?",
        "a": "Cropping removes outer pixels outside your selection box while preserving the full pixel density of the remaining cropped area without resampling or quality loss."
      },
      {
        "q": "Are my photos uploaded to any server?",
        "a": "No. The visual cropper and canvas pipeline process the selected image in your browser; FileNimble does not upload it for this conversion."
      }
    ]
  },
  {
    "slug": "bmp-to-jpg",
    "title": "Convert BMP to JPG",
    "description": "Convert uncompressed Windows BMP bitmap images to lightweight, web-ready JPG format directly in your browser.",
    "features": [
      "Convert BMP bitmaps to standard JPEG with adjustable quality",
      "Optional solid background color to flatten alpha or transparency keys",
      "Batch convert up to 20 BMP images with instant ZIP export",
      "Runs entirely in your browser; images are never uploaded"
    ],
    "steps": [
      {
        "name": "Upload BMP Files",
        "text": "Select or drag and drop BMP bitmap images from your device."
      },
      {
        "name": "Adjust Quality",
        "text": "Select your desired JPEG quality and background color."
      },
      {
        "name": "Convert & Download",
        "text": "Click Convert to JPG to generate lightweight JPEG images instantly."
      }
    ],
    "faqs": [
      {
        "q": "Why should I convert BMP to JPG?",
        "a": "BMP files are uncompressed bitmap graphics that produce huge file sizes. Converting BMP to JPG drastically reduces file size by 80% to 95%, making them suitable for web sharing, email attachments, and storage."
      },
      {
        "q": "Are my BMP images uploaded to a server?",
        "a": "No. Conversion runs locally in your browser using HTML5 Canvas. Your images are never sent over the network."
      },
      {
        "q": "Can I convert multiple BMP images at once?",
        "a": "Yes. You can select up to 20 BMP images and convert them simultaneously, with single-click individual downloads or a bundled ZIP archive."
      }
    ]
  },
  {
    "slug": "bmp-to-png",
    "title": "Convert BMP to PNG",
    "description": "Convert legacy BMP bitmap images into modern, lossless PNG format directly in your browser.",
    "features": [
      "Lossless pixel-perfect conversion from BMP to PNG",
      "Supports 24-bit and 32-bit BMP bitmaps",
      "Batch convert up to 20 BMP images with ZIP download",
      "Runs entirely in your browser; images are never uploaded"
    ],
    "steps": [
      {
        "name": "Upload BMP Files",
        "text": "Drag and drop or select your BMP files."
      },
      {
        "name": "Convert to PNG",
        "text": "Click Convert to encode your bitmap into compressed lossless PNG."
      },
      {
        "name": "Download Files",
        "text": "Save your PNG images individually or download all in a ZIP file."
      }
    ],
    "faqs": [
      {
        "q": "Does converting BMP to PNG lose quality?",
        "a": "No. Both BMP and PNG are lossless formats. PNG uses Deflate compression to reduce file size without discarding any pixel data."
      },
      {
        "q": "Are my files uploaded to FileNimble?",
        "a": "No. All image decoding and PNG encoding are performed client-side in your web browser."
      },
      {
        "q": "Can I batch convert BMP files?",
        "a": "Yes. FileNimble lets you convert up to 20 BMP files at once and export them as a single ZIP archive."
      }
    ]
  },
  {
    "slug": "gif-to-jpg",
    "title": "Convert GIF to JPG",
    "description": "Convert GIF images and animations to compressed JPEG format in your browser.",
    "features": [
      "Convert GIF graphics or animation cover frames to JPEG",
      "Custom background color for transparent GIF pixels",
      "Batch convert up to 20 GIF files with ZIP export",
      "Runs entirely in your browser; images are never uploaded"
    ],
    "steps": [
      {
        "name": "Upload GIF Files",
        "text": "Select or drop your GIF files into the converter."
      },
      {
        "name": "Set Quality & Color",
        "text": "Choose your JPEG quality and solid background color."
      },
      {
        "name": "Convert & Download",
        "text": "Click Convert to JPG and download your images immediately."
      }
    ],
    "faqs": [
      {
        "q": "Does converting GIF to JPG retain animation?",
        "a": "No. JPEG is a static image format. Converting an animated GIF captures and saves the first frame as a high-quality static JPEG."
      },
      {
        "q": "What happens to transparent GIF areas?",
        "a": "JPEG does not support transparency. Transparent areas in your GIF are automatically filled with your chosen background color (white by default)."
      },
      {
        "q": "Is GIF to JPG conversion private?",
        "a": "Yes. All processing happens entirely within your web browser using HTML5 Canvas. Your files are not uploaded."
      }
    ]
  },
  {
    "slug": "gif-to-png",
    "title": "Convert GIF to PNG",
    "description": "Convert 256-color GIF images into crisp 24-bit PNG images with full alpha channel support in your browser.",
    "features": [
      "Upgrade 8-bit indexed GIF graphics into full 24-bit/32-bit PNG",
      "Full transparency preservation without color banding",
      "Batch convert up to 20 GIF files with ZIP export",
      "Runs entirely in your browser; images are never uploaded"
    ],
    "steps": [
      {
        "name": "Upload GIF Files",
        "text": "Select or drop your GIF files."
      },
      {
        "name": "Convert to PNG",
        "text": "Click Convert to generate crisp PNG images locally."
      },
      {
        "name": "Download PNG",
        "text": "Download individual PNG files or download all files bundled in a ZIP."
      }
    ],
    "faqs": [
      {
        "q": "Does GIF to PNG conversion preserve transparency?",
        "a": "Yes. Transparent pixels in the original GIF are mapped directly to the PNG alpha channel, maintaining full transparency."
      },
      {
        "q": "Does this convert animated GIFs to animated PNGs (APNG)?",
        "a": "No. FileNimble converts the primary still frame of the GIF into a standard, widely compatible static PNG image."
      },
      {
        "q": "Are my GIF files uploaded to a server?",
        "a": "No. Processing is 100% client-side in your browser; no images are uploaded to any server."
      }
    ]
  }
];
