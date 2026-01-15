import { Mention } from "@tiptap/extension-mention";

// Extend Mention to allow spaces in queries and remove @ prefix from display
// This is needed because file names can contain spaces
// We don't configure suggestion here - it will be configured in tiptap.tsx
// to avoid duplicate plugin instances
const MentionWithSpaces = Mention.extend({
  name: "mention",

  // Override renderText to display label without @ prefix
  renderText({ node }) {
    return node.attrs.label || node.attrs.id || "";
  },
});

export default MentionWithSpaces;

