import { Mention } from "@tiptap/extension-mention";
import slashSuggestion from "./slash-suggestion";

// Create a SlashCommand extension based on Mention but triggers on "/"
// The Mention extension uses the suggestion.char property to determine the trigger
const SlashCommand = Mention.extend({
  name: "slashCommand",

  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class:
          "slash-command bg-[--background-modifier-active-hover] text-[--text-accent] px-1 py-0.5",
      },
      suggestion: {
        char: "/",
        items: ({ query, editor }: { query: string; editor: any }) => {
          return slashSuggestion.items({ query, editor });
        },
        render: () => {
          return slashSuggestion.render();
        },
      },
    };
  },
});

export default SlashCommand;
