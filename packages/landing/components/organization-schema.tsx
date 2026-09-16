const schema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Note Companion',
  legalName: 'JPF Nexus Inc.',
  description:
    'Note Companion builds an AI-powered Obsidian plugin that transcribes audio and YouTube, chats with your vault, and auto-organizes notes.',
  url: 'https://www.notecompanion.ai',
  logo: 'https://www.notecompanion.ai/notecompanion.png',
  sameAs: [
    'https://github.com/Nexus-JPF/note-companion',
    'https://www.youtube.com/@note-companion',
    'https://www.youtube.com/channel/UCd24YzGlvtIG4DYD3zlYLwg',
    'https://www.linkedin.com/company/note-companion',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'info@notecompanion.ai',
    contactType: 'customer support',
  },
};

export function OrganizationSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
