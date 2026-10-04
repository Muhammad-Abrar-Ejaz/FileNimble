export const trustPages = {
  about: {
    title: 'About FileNimble', description: 'Learn how FileNimble approaches file conversion, browser privacy, temporary server processing and realistic format limits.',
    sections: [
      ['Useful conversions, clear limits', 'FileNimble brings image, PDF, document and data tools into one interface. The tool directory lists currently available tools. Planned tools are not promises of a release date. Every format has tradeoffs: changing a filename is not conversion, and converting a document cannot guarantee that its original layout or features survive.'],
      ['Choose where your files are processed', 'Image tools, PDF page tools and supported text/data tools run in your browser. OCR and supported document conversions need isolated server workers. The processing label on each tool explains the difference before conversion.'],
      ['Review the result', 'Check page order, layout, extracted text and data types before relying on output. OCR recognizes printed English within the limits shown on the tool; it can misread characters. FileNimble does not certify legal validity, accessibility, archival compliance or malware safety of ordinary conversion results.'],
    ],
  },
  privacy: {
    title: 'Privacy and file handling', description: 'Understand local file processing, temporary server uploads, one-hour expiry, download links, ownership cookies and job metadata retention.',
    sections: [
      ['Browser tools', 'Tools labelled Runs in browser process file content locally without uploading it to FileNimble. The website still requests its pages and application assets. Clearing a tool or leaving its page releases application references; browsers control memory reclamation, so this is not secure erasure. Your source files and saved downloads remain on your device.'],
      ['Temporary server processing', 'Server tools upload files only when you start conversion. Temporary storage holds the upload, validated input and generated output. Isolated conversion workers process those files. File content is not stored in the job database, queue messages or application logs. There is no permanent file library.'],
      ['Optional AI processing', 'AI tools are disabled unless the operator configures an external provider. When enabled, the page explains the data sent and asks for consent before each request. For current AI tools, PDF bytes are extracted locally in your browser; only the text you enter or extracted text is sent to FileNimble’s API and then to the configured provider. AI text is not stored in conversion jobs, object storage, databases or application logs. The provider may handle requests under its own terms and retention policy. AI output can be wrong and should be reviewed.'],
      ['Expiry and deletion', 'Abandoned jobs expire one hour after creation. Completed outputs expire one hour after completion. Failed, cancelled or deleted jobs become eligible for immediate cleanup. Clear files requests early deletion. Cleanup is retried, but outages can delay physical deletion. Expiry is not a promise of instant erasure. Saved downloads are outside this cleanup process.'],
      ['Download links and job records', 'Downloads require the session that owns the job. Issued download links last at most 60 seconds and do not intentionally extend expiry. An already issued link can remain valid briefly if deletion is delayed; do not share it. Minimal job records, including status, size, format, checksums and attempt information, are purged seven days after confirmed artifact removal. These records do not contain document bytes or original filenames.'],
      ['Cookies, advertising and operational information', 'Server jobs use a necessary anonymous ownership cookie lasting up to 24 hours to authorize access without an account. When monetization is configured and enabled by the operator, third-party advertising partners such as Google AdSense may place or read cookies and device identifiers to serve, personalize, and measure advertisements in accordance with their privacy policies and applicable user consent. Users can manage personalized ad preferences through Google Ads Settings or industry opt-out tools. File contents, uploaded documents, filenames, and conversion data are strictly isolated: they are never shared with, processed by, or accessible to advertising services. Application diagnostics use bounded error categories and operational counters, never document content, passwords, or signed URLs. Hosting infrastructure receives connection information such as IP addresses; provider logging and retention must be reviewed before public deployment.'],
      ['Your choices', 'Choose browser tools when you need file content to stay on your device. Avoid uploading information you are not authorized to process. Download results before they expire, clear server jobs when finished, and remove local downloads yourself when no longer needed. Contact details, when configured by the operator, are on the Contact page.'],
    ],
  },
  terms: {
    title: 'Terms of use', description: 'Read FileNimble usage conditions: authorized files, conversion limitations, temporary availability and responsible use of generated results.',
    sections: [
      ['Authorized use', 'Use FileNimble only for files you own or are authorized to process. Respect applicable copyright, privacy and other rights. Do not use the service to distribute unlawful content, probe other users’ jobs, bypass access controls or disrupt processing.'],
      ['Conversion limits', 'Supported formats and size limits are stated on each tool. Conversion can change layout, lose unsupported features or produce inaccurate text. Review output before publication or important decisions, keep an original copy and do not treat conversion as professional advice or certification.'],
      ['Temporary availability', 'Server files and results expire under the Privacy policy. FileNimble is not a backup or long-term storage service. Processing can fail, be interrupted or reach resource limits. No uninterrupted availability, perfect fidelity or recovery of expired files is promised.'],
      ['Questions and deployment', 'Use the Contact page for the operator’s published contact channel when available. These usage conditions do not identify a registered company, select a legal jurisdiction or waive rights that applicable law does not allow to be waived. Operator-specific legal information and deployment policies must be reviewed before a public launch.'],
    ],
  },
  contact: {
    title: 'Contact FileNimble', description: 'Find the configured FileNimble support channel and learn what to include in conversion bug reports or privacy questions without sharing private files.',
    sections: [
      ['Report a conversion problem', 'Include the tool name, input format, approximate size, browser and a short description of what you expected. Include a visible error code if one is shown. Describe sensitive documents without attaching them. A small synthetic example is usually more useful than a private original.'],
      ['Privacy or security questions', 'Do not send passwords, session cookies, temporary upload/download links or private document contents. Describe the issue and affected feature first so an appropriate next step can be agreed. There is no guaranteed response time.'],
    ],
  },
} as const;

/** Operator-supplied public address, never inferred from a domain or company name. */
export function supportEmail() {
  const value = process.env.FILENIMBLE_SUPPORT_EMAIL?.trim();
  return value && /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value) ? value : undefined;
}
