import { App, TFolder, TFile, normalizePath, parseYaml } from "obsidian";
import { FileOrganizerSettings } from "./settings";
import { logger } from "./services/logger";
import { classifyDefaultTemplate } from "./lib/template-fingerprints";

/**
 * The default templates the plugin ships: the single list the create, update
 * and restore code and the settings text all read. Adding a default template is
 * one entry here (plus its fingerprint, see lib/default-template-fingerprints.ts).
 */
export const DEFAULT_TEMPLATES: ReadonlyArray<{
  readonly name: string;
  readonly content: () => string;
}> = [
  { name: "meeting_note.md", content: getMeetingNoteTemplateContent },
  { name: "youtube_video.md", content: getYoutubeVideoTemplateContent },
  { name: "youtube_summary.md", content: getYoutubeSummaryTemplateContent },
  { name: "youtube_key_concepts.md", content: getYoutubeKeyConceptsTemplateContent },
  { name: "youtube_qa.md", content: getYoutubeQaTemplateContent },
  { name: "youtube_timestamped_outline.md", content: getYoutubeTimestampedOutlineTemplateContent },
  { name: "enhance.md", content: getEnhanceTemplateContent },
  { name: "research_paper.md", content: getResearchPaperTemplateContent },
  { name: "flash_cards.md", content: getFlashCardsTemplateContent },
  { name: "quiz.md", content: getQuizTemplateContent },
  { name: "lecture_notes.md", content: getLectureNotesTemplateContent },
];

// Default template names that come with the plugin
export const DEFAULT_TEMPLATE_NAMES: readonly string[] = DEFAULT_TEMPLATES.map(
  template => template.name
);

// Helper functions to get default template content
function getMeetingNoteTemplateContent(): string {
  return `Contextual Extraction of Discussion Points and Action Items

Instruction:
Analyze the provided content, which includes:
	•	Transcript 1: The first transcript of the discussion.
	•	Transcript 2: The second transcript of the discussion.
	•	Written Notes: Notes taken by a participant summarizing the discussion.

Task:
Extract the following while prioritizing the notes written by the participant to infer emphasis and key takeaways:
	1.	Discussion Points: Summarize the key topics, ideas, or issues discussed. Prioritize points that appear in the written notes and cross-reference with the transcripts for completeness.
	2.	Action Items: Identify specific tasks, responsibilities, or decisions agreed upon. For each action item, include:
	•	A brief description of the task.
	•	The person(s) responsible, if mentioned.
	•	Any deadlines, if stated.

Output Format:

**Discussion Points:**
1. [Point 1]
2. [Point 2]
...

**Action Items:**
1. [Task description] - [Responsible person(s)] - [Deadline]
2. [Task description] - [Responsible person(s)] - [Deadline]
...

**Supporting Context:**
- Key excerpts from Transcript 1: [Relevant excerpts related to discussion points and action items].
- Key excerpts from Transcript 2: [Relevant excerpts related to discussion points and action items].
- Key highlights from Written Notes: [Direct quotes or summaries from notes].
`;
}

function getResearchPaperTemplateContent(): string {
  return `---

title: "[Full paper title]"

authors: ["Author 1", "Author 2", "etc"]

year: [Publication year]

journal: "[Journal name]"

volume: "[Vol. number]"

issue: "[Issue number]"

pages: "[Page range]"

doi: "[DOI number]"

url: "[Direct URL to access paper]"

tags: ["academic", "paper", "[field]", "[specific subtopic]"]

research_question: "[Exact question/objective as stated by authors]"

significance: "[Why this research matters in 1-2 specific sentences]"

keywords: ["Keyword 1", "Keyword 2", "etc"]

citation: "[Complete citation in APA/MLA format]"

---

## 1. Key Arguments & Evidence

- **Argument 1**: [Specific claim made by authors] ([p.X])
    - Evidence: [Concrete data, statistics, or examples supporting this claim] ([p.X])
    - Methodology used: [Specific methods used to gather this evidence] ([p.X])
    - Theoretical basis: [Named theory or framework] ([Author Year, p.X])
- **Argument 2**: [Continue with same detailed format]
- **Argument 3**: [Add as many as needed with same detailed format]

## 2. Methodology Details

- **Research design**: [Exact type - e.g., "longitudinal cohort study" not just "quantitative"] ([p.X])
- **Data collection methods**: [Specific techniques used - e.g., "semi-structured interviews using protocol X"] ([p.X])
- **Sample characteristics**: [Exact details - e.g., "128 participants: 64 female, 64 male, ages 18-35, from University X"] ([p.X])
- **Key variables**: [Named variables with operational definitions] ([p.X])
- **Analytical techniques**: [Specific statistical tests or qualitative approaches with software used] ([p.X])
- **Ethical considerations**: [Any ethics committee approvals or considerations mentioned] ([p.X])

## 3. Substantive Findings

- **Primary finding**: [Most significant result with exact statistics/p-values/effect sizes] ([p.X])
- **Secondary findings**: [Additional results with specific data points] ([p.X])
- **Unexpected results**: [Any surprising outcomes with authors' explanations] ([p.X])
- **Null findings**: [What didn't work or wasn't supported] ([p.X])
- **Limitations acknowledged**: [Specific constraints identified by authors] ([p.X])

## 4. Scholarly Context

- **Builds on**: [[Author Year]] - [Named works this paper extends] ([p.X])
- **Contradicts**: [[Author Year]] - [Specific research this challenges] ([p.X])
- **Resolves**: [Specific debates this settles] ([p.X])
- **Theoretical framework**: [Named theory/framework the paper operates within] ([p.X])
- **Research gap addressed**: [Explicit gap identified by authors] ([p.X])

## 5. Key Quotes

- **Central argument**: "[Direct quote]" ([p.X])
- **Methodology**: "[Direct quote]" ([p.X])
- **Main finding**: "[Direct quote]" ([p.X])
- **Implications**: "[Direct quote]" ([p.X])
- **Future research**: "[Direct quote]" ([p.X])

## 6. Explicit Recommendations & Applications

- **Direct recommendations**: [List all specific recommendations made by authors] ([p.X])
- **Policy implications**: [Any policy changes suggested] ([p.X])
- **Practice implications**: [How practitioners should change behavior] ([p.X])
- **Industry applications**: [Business or commercial applications] ([p.X])
- **Educational implications**: [Teaching or learning applications] ([p.X])
- **Future research directions**: [Specific suggestions for further study] ([p.X])

## 7. Critical Reference Mapping

- [[Author Year]] - [Title] ([p.X in reviewed paper]) - [Precise role in paper's argument]
- [[Author Year]] - [Title] ([p.X in reviewed paper]) - [Precise role in paper's argument]
- [[Author Year]] - [Title] ([p.X in reviewed paper]) - [Precise role in paper's argument]

## 8. Personal Research Notes

- **Relevance to my work**: [Specific ways this connects to your research]
- **Methods I could adapt**: [Specific techniques that could be applied]
- **Gaps I could address**: [How your work might extend this research]
- **Potential citations**: [Where in your own writing you might cite this]
- **Related papers in vault**: [[Paper 1]], [[Paper 2]]
- **Related concepts**: [[Concept 1]], [[Concept 2]]
`;
}

function getYoutubeTemplateSharedRules(): string {
  return `- Extract the video title from the "YouTube Video Information" section if provided, or infer from the transcript content.

- Use the **Channel** line from the "YouTube Video Information" section when present. Set frontmatter \`channel\` to that name. If a **Channel URL** line is present, also set \`channel_url\` in frontmatter to that exact URL. In the body \`## Channel\` section, use plain text matching \`channel\` (a link will be added automatically when \`channel_url\` is set). If no Channel line is present, leave \`channel\` empty and omit or minimalize the Channel section. Use **Date Published** for \`date_published\` when present.

- Extract topics by analyzing the main themes discussed in the transcript. Use 2-5 specific, relevant topics.

- Generate tags based on the video content. Always include "youtube" and add 2-4 additional relevant tags. Tags in frontmatter should NOT include the "#" symbol (only use "#" for inline tags in the content body). **CRITICAL: Tags must have NO spaces between words. Use hyphens or underscores to connect multi-word tags (e.g., "web-development" or "machine_learning", not "web development" or "machine learning").**

- Create a concise summary (1-2 sentences) that captures the video's main theme and key takeaways.

- The Full Transcript section may use \`[MM:SS]\` or \`[H:MM:SS]\` timestamp prefixes. Use those bare bracket timestamps when citing specific moments in the body (e.g. bullet points or outline entries). They will be converted to clickable YouTube links automatically after formatting.

- If a full transcript is provided in the "Full Transcript" section, use it as the source of truth for the note body.

- **CRITICAL - NO RAW TRANSCRIPT IN OUTPUT: Do not include \`## YouTube Video Information\`, \`## Full Transcript\`, or the raw transcript text in the final note. The transcript is input only.**

- If "Date Published" is in the YouTube Video Information section, use it for \`date_published\`. Otherwise extract from transcript if mentioned, or leave empty.

- Maintain the exact markdown syntax for the frontmatter block (\`---\` at the top and bottom).

- Extract the video ID from the YouTube URL in the content, then create the embed using Obsidian's embed syntax:
  - Format: ![](https://www.youtube.com/watch?v=VIDEO_ID) (replace VIDEO_ID with the actual video ID)
  - This will automatically embed the YouTube video player in Obsidian

- **CRITICAL - NO SPONSOR CONTENT: Never include sponsor segments, promotional content, or ads. Exclude: "sponsored by", "use code X", "check out our sponsor", discount/promo codes, product plugs, and mid-roll ad segments. Summarize ONLY the main educational or informational content. Skip sponsor blocks entirely.**

- Do not use \`\`\` code blocks or markdown code formatting in the summary body.

- Focus on accuracy and completeness based on the actual transcript content provided.`;
}

function getYoutubeFrontmatterAndEmbedInstructions(): string {
  return `1. Frontmatter (at the top) with the following properties:

---

title: "{{video title - extract from YouTube Video Information section or transcript}}"

channel: "{{channel name if available, otherwise leave empty}}"

channel_url: "{{channel URL from YouTube Video Information if available, otherwise leave empty}}"

date_published: "{{video publication date if available in transcript or metadata, otherwise leave empty}}"

topics: ["{{relevant topic 1}}", "{{relevant topic 2}}"]

tags: ["youtube", "{{any other relevant tags based on content}}"]

summary: "{{short summary of the video's main theme and key takeaways}}"

---

2. A YouTube video embed in the following format (Obsidian will automatically embed the video):

![](https://www.youtube.com/watch?v=VIDEO_ID)

3. A **Channel** section: a \`## Channel\` heading followed by a single line containing the channel/uploader name (same value as the \`channel\` frontmatter field). If \`channel_url\` is set in frontmatter, keep the body line as plain text — it will be linked automatically. If the channel is unknown, use \`## Channel\` with the text \`Unknown\` or omit the section.`;
}

function getYoutubeVideoTemplateContent(): string {
  return `Please create an Obsidian note using the video link and any available transcript or additional context. The note must include:

${getYoutubeFrontmatterAndEmbedInstructions()}

4. A comprehensive, detailed summary of the key points from the video (below the Channel section).

**Instructions:**

${getYoutubeTemplateSharedRules()}

- In the main body under \`## Detailed Summary\`, provide bullet points covering all major points. When helpful, prefix bullets with \`[MM:SS]\` timestamps from the transcript so the reader can jump to that moment in the video.

**Example Output Format:**

---

title: "How to Build a React App in 2024"

channel: "Tech Tutorials"

channel_url: "https://www.youtube.com/@TechTutorials"

date_published: "2024-01-15"

topics: ["React", "Web Development", "JavaScript", "Tutorial"]

tags: ["youtube", "react", "webdev", "tutorial"]

summary: "A comprehensive guide to building modern React applications with hooks, context API, and best practices for 2024."

---

![](https://www.youtube.com/watch?v=VIDEO_ID)

## Channel

Tech Tutorials

## Detailed Summary

- [02:14] Introduction to React fundamentals and modern development practices
- [08:30] Setting up a new React project with Vite
- [15:02] Using React Hooks for state management
- Implementing Context API for global state
- Best practices for component structure and organization`;
}

function getYoutubeSummaryTemplateContent(): string {
  return `Please create a concise Obsidian note from the YouTube video and transcript. The note must include:

${getYoutubeFrontmatterAndEmbedInstructions()}

4. A **Short Summary** section (\`## Short Summary\`) with 1-2 paragraphs capturing the main thesis and outcome of the video.

5. A **Key Takeaways** section (\`## Key Takeaways\`) with 3-7 bullet points — the most important things to remember.

**Instructions:**

${getYoutubeTemplateSharedRules()}

- Keep the body shorter than a full lecture note. Prioritize clarity over exhaustive coverage.
- Use \`[MM:SS]\` timestamps on takeaways when they anchor a specific moment worth revisiting.`;
}

function getYoutubeKeyConceptsTemplateContent(): string {
  return `Please create an Obsidian note organized by key concepts from the YouTube video transcript. The note must include:

${getYoutubeFrontmatterAndEmbedInstructions()}

4. A **Key Concepts** section (\`## Key Concepts\`) where each concept is a \`### Concept Name\` subsection with a short explanation (2-5 sentences) of how the video presents it.

**Instructions:**

${getYoutubeTemplateSharedRules()}

- Identify 4-10 distinct concepts; merge minor mentions into related concepts.
- Under each \`###\` heading, explain the concept in your own words based on the transcript.
- Optionally start a concept subsection with \`[MM:SS]\` when the concept is first introduced in the video.`;
}

function getYoutubeQaTemplateContent(): string {
  return `Please create an Obsidian Q&A study note from the YouTube video transcript. The note must include:

${getYoutubeFrontmatterAndEmbedInstructions()}

4. A **Q&A** section (\`## Q&A\`) with 5-12 question-and-answer pairs that test understanding of the video.

**Instructions:**

${getYoutubeTemplateSharedRules()}

- Format each pair as:
  - **Q:** [Clear question]
  - **A:** [Concise answer grounded in the transcript]
- Questions should cover the main ideas, not trivia or sponsor mentions.
- Optionally include \`[MM:SS]\` after an answer when a specific moment supports it.`;
}

function getYoutubeTimestampedOutlineTemplateContent(): string {
  return `Please create a timestamped outline Obsidian note from the YouTube video transcript. The note must include:

${getYoutubeFrontmatterAndEmbedInstructions()}

4. An **Outline** section (\`## Outline\`) structured as a hierarchical outline of the video.

**Instructions:**

${getYoutubeTemplateSharedRules()}

- Use nested bullet points for sections and subtopics.
- **Every top-level outline bullet must start with a \`[MM:SS]\` or \`[H:MM:SS]\` timestamp** from the transcript marking where that section begins.
- Sub-bullets may omit timestamps unless they mark a distinct jump in the video.
- Group content by topic, not by arbitrary time intervals.
- Skip sponsor segments entirely — do not create outline entries for ads.`;
}

function getEnhanceTemplateContent(): string {
  return `1. **Use Headings and Subheadings**: Clearly define sections with headings (e.g.,
\`\`\`
#
\`\`\`
,
\`\`\`
##
\`\`\`
,
\`\`\`
###
\`\`\`
) to organize content hierarchically.

2. **Bullet Points and Lists**: Use bullet points or numbered lists to break down information into digestible parts.

3. **Consistent Spacing**: Ensure consistent spacing between sections and paragraphs for better readability.

4. **Highlight Key Points**: Use bold or italics to emphasize important information or key terms.

5. **Tables for Structured Data**: Use tables to organize data that fits into rows and columns for clarity.

6. **Quotes and References**: Use blockquotes for quotes and reference links for sources.

7. **Code Blocks**: Use code blocks for any code snippets or technical instructions.

8. **Images and Diagrams**: Include images or diagrams where applicable to visually represent information.

9. **Linking and Cross-referencing**: Use internal links to connect related notes or sections within your vault.

10. do not use \`\`\` markdown`;
}

function getLectureNotesTemplateContent(): string {
  return `Turn the spoken content below (a lecture, class, talk, or study recording) into clear study notes in Markdown.

The input is a single transcript. Work only from what was actually said. Do not invent facts, and never mention that other transcripts, written notes, or slides were or were not provided.

Structure the note like this, translating the section headings into the language of the transcript (for French: Résumé, Concepts clés, Détails et exemples, Questions à réviser, Questions ouvertes, Devoirs):

# [A short, specific title for the topic]

## Summary
3-5 sentences on what the session covered, and why it matters only if the speaker said why.

## Key concepts
For each main idea, use a "###" heading with the concept name, then a short explanation in your own words. Give a definition only for terms the speaker defined, the first time they appear.

## Details and examples
Organize the remaining content by topic with "###" headings. Use bullet points for steps, formulas, dates, names, and examples that were given. If the speaker compared things, a small table is fine, but only with the rows and values the speaker actually stated.

## Questions to review
5-8 questions that test understanding of the material, each followed by a one-line answer.

## Open questions
Anything the speaker left unresolved or that needs follow-up. Do not put homework or readings here. Omit this section if there is nothing.

## Assignments
Homework, readings, deadlines and things the speaker asked the audience to prepare, as a checklist ("- [ ] ..."). Omit this section if none were mentioned.

Rules:
- Headings are plain text: never put [[links]] in any heading. In the body, wrap at most a few terms that clearly deserve their own note in [[internal links]].
- Write the whole note, headings included, in the language the speaker used. Do not translate it into English.
- Put in the note only what the speaker said. Do not add a table row, a bullet or a sentence for something that was not stated, not even to say it was "absent", "not covered" or "not targeted". Do not state a figure or a consequence the speaker did not state, even if it seems to follow logically.
- Fix obvious transcription errors and remove filler words, but keep the speaker's meaning.
- Keep it scannable: short paragraphs, bullets, bold for key terms.
- If the content is not educational (for example small talk), write a concise summary and skip the sections that do not apply.`;
}

function getQuizTemplateContent(): string {
  return `Please create an Obsidian note with a multiple-choice quiz, using native Obsidian markdown and HTML. The note must include:

1. Frontmatter (at the top) with the following properties:

---
total: {{number of questions created}}
topics: ["{{topic 1}}", "{{topic 2}}", "{{topic 3}}"]
created: "{{current date in YYYY-MM-DD format}}"
---

2. The questions, below the frontmatter. Format every question exactly like this:

**1. {{question}}**

- A. {{option}}
- B. {{option}}
- C. {{option}}
- D. {{option}}

<details class="quiz-answer">
<summary>{{"Show answer" in the language of the content}}</summary>

**{{correct letter}}.** {{one or two sentences saying why}}

</details>

**Instructions:**

- **One question per distinct fact.** First identify the distinct testable facts in the content, privately: never print that list. Then write one question for each. Never pad: if two candidate questions test the same fact, keep only the better one. Fewer good questions beat more repetitive ones.
- **Use only facts stated in the content.** The correct option and the explanation must come from the content. Do not add outside knowledge, even if it is true.
- Each question tests exactly one fact: one definition, one reason, one number or one step. Do not bundle several facts into one question.
- Prefer "why" and "how" questions over bare definitions when the content explains a reason.
- Write exactly four options, A to D, and exactly one of them is correct.
- Each wrong option must be something the content says about a different concept, or a reversed relationship, or a different number that appears in the content. Never invent an absurd option, and never make an option wrong with an absolute word such as "always", "only", "never" or "all". A student who has not studied should find every option believable.
- Never use "all of the above", "none of the above" or "both A and B" as an option.
- Try to vary which letter is correct; the plugin also reorders the options afterwards, so do not worry about the order. Never refer to another option by its letter (for example "unlike option B") in an explanation, because the letters change.
- Keep the four options similar in length and style, so the correct one does not stand out.
- Do not give the answer away in the question, and do not repeat the same fact in two questions.
- The explanation says why the correct option is right in one or two sentences. It does not repeat all four options.
- Number the questions from 1, in order. Mix topics and difficulty rather than following the order of the content.
- Extract 3-7 main topics or themes from the content for the topics array in frontmatter.
- Write the whole quiz in the same language as the content: the topics, the questions, the four options, the explanations and the answer label. If the content is in English, write everything in English; if it is in another language, use that language everywhere. Never switch language between the content and the quiz.
- Do not add [[internal links]], "see also" or "related" lines.
- Do not use code blocks or markdown code formatting in the output.
- Total is a number without quotes and equals the number of questions you wrote. Created is a string in quotes in the format "YYYY-MM-DD". Topics is an array: topics: ["Topic 1", "Topic 2", "Topic 3"].

**Example Output Format** (the example content is in English, so the example is in English; yours follows the language of your content):

---
total: 2
topics: ["Molecular Biology", "Cell Biology"]
created: "2025-01-09"
---

**1. Which base does RNA use in place of thymine?**

- A. Adenine
- B. Uracil
- C. Cytosine
- D. Guanine

<details class="quiz-answer">
<summary>Show answer</summary>

**B.** RNA contains uracil where DNA contains thymine.

</details>

**2. What is the main function of mitochondria?**

- A. They store the genetic material of the cell
- B. They build proteins from amino acids
- C. They digest worn-out cell parts
- D. They produce ATP through cellular respiration

<details class="quiz-answer">
<summary>Show answer</summary>

**D.** Mitochondria are the organelles that produce ATP through cellular respiration.

</details>

Important Notes:
- ALWAYS include the frontmatter with total, topics and created date.
- The answer label in the summary tag is "Show answer" translated into the language of the content, and it is the same for every question.
- Output only the frontmatter and the questions: no list of facts, no headings, no commentary before, between or after the questions.
- Output the actual HTML tags directly (NOT inside markdown code blocks) and make sure every tag is closed.
- Leave a blank line after the summary tag and before the closing details tag, and a blank line between questions.
- If content is very long, focus on the most important concepts.
- Maintain the original meaning and accuracy of the source material.
- This format works natively in Obsidian without requiring any plugins: the answer is revealed by clicking the answer label.`;
}

function getFlashCardsTemplateContent(): string {
  return `Please create an Obsidian note with interactive flashcards using native Obsidian HTML features. The note must include:

1. Frontmatter (at the top) with the following properties:

---

total: {{number of flashcards created}}

topics: ["{{topic 1}}", "{{topic 2}}", "{{topic 3}}"]

created: "{{current date in YYYY-MM-DD format}}"

---

2. Interactive flashcards using HTML details/summary tags (below the frontmatter).

**Instructions:**

- Extract key concepts, facts, definitions, relationships, and important information from the content
- Identify all testable knowledge points: definitions, concepts, facts, formulas, relationships, processes, dates, names, theories, principles, etc.
- Extract 3-7 main topics or themes from the content for the topics array in frontmatter
- Write the frontmatter values, questions and answers in the language of the content. Do not translate them into English.
- **CRITICAL: Randomize the order of flashcards - mix different topics, difficulty levels, and question types together. Do NOT follow the original content order or group by topic. Create a varied, shuffled study experience.**
- **One card per distinct fact.** First identify the distinct testable facts in the content, privately: never print that list. Then write one card for each. Never pad: if two candidate cards test the same fact, keep only the better one. Aim for about one card per two or three sentences of the content, and fewer if it repeats itself, but never more than 30 cards however long the content is. Fewer good cards beat more repetitive ones.
- **Use only facts stated in the content.** Do not add outside knowledge, examples or explanations, even if they are true. If something is not in the content, there is no card for it.
- Prioritize information that is:
  - Fundamental to understanding the topic
  - Frequently referenced or important
  - Easy to forget (dates, numbers, specific details)
  - Part of a sequence or process
  - A definition or key concept

- Maintain the exact markdown syntax for the frontmatter block (\`---\` at the top and bottom).
- Each property in frontmatter must be on its own line with proper YAML indentation
- Topics should be an array: topics: ["Topic 1", "Topic 2", "Topic 3"]
- Total should be a number without quotes
- Created should be a string in quotes with format "YYYY-MM-DD"

- Format each flashcard using HTML details/summary tags:
  - Each flashcard must be a separate <details> block with class="flashcard"
  - The <summary> tag must have class="flashcard-question" and contain the question
  - The answer must be wrapped in <div class="flashcard-answer">
  - Leave a blank line after </summary> and before </details> for proper spacing
  - Answers can include markdown formatting (bold, italic, lists, etc.)
  - Answers can span multiple paragraphs

- Each question tests exactly one fact: one definition, one reason, one number or one step. Do not bundle several facts or a comparison into one card. If the content compares two things, ask about each one's distinguishing fact, not every property of each, and never write a card that only restates facts other cards already test. Describe a concept in one card (what it is); add a second card for it only for a separate fact, such as where it occurs or what it causes. Never ask for "the characteristic of X" when the answer is a single adjective. The only exception is a short ordered process, which can be one card phrased as "In what order...?" or "What are the steps of...?"
- Prefer "why" and "how" questions over bare definitions when the content explains a reason
- Answers should be complete but concise (typically 1-4 sentences, but can be longer if needed)
- Include context or an example only when it appears in the content
- Use clear, specific language
- Make questions specific and focused (avoid overly broad questions)
- Do not add [[internal links]], "see also" or "related" lines to cards
- Use **bold** for key terms in answers
- Use a list in an answer only for the steps of an ordered process

- Do not use \`\`\` code blocks or markdown code formatting in the output
- Focus on accuracy and completeness based on the actual content provided

**Example Output Format:**

---

total: 3

topics: ["Cell Biology", "Energy Production", "Molecular Biology"]

created: "2025-01-09"

---

<details class="flashcard">
<summary class="flashcard-question">What is the primary function of mitochondria?</summary>

<div class="flashcard-answer">

Mitochondria are organelles that produce ATP (adenosine triphosphate) through cellular respiration.

</div>

</details>

<details class="flashcard">
<summary class="flashcard-question">Which base does RNA use in place of thymine?</summary>

<div class="flashcard-answer">

**Uracil**. DNA contains thymine, while RNA contains uracil.

</div>

</details>

<details class="flashcard">
<summary class="flashcard-question">What are the two stages of photosynthesis, in order?</summary>

<div class="flashcard-answer">

Photosynthesis occurs in two stages:

1. **Light-dependent reactions**: Chlorophyll absorbs light energy, splits water molecules, and produces ATP and NADPH
2. **Calvin cycle**: Uses ATP and NADPH to convert carbon dioxide into glucose

</div>

</details>

Important Notes:
- ALWAYS include frontmatter with total, topics, and created date
- Each property in frontmatter must be on its own line (no nesting, flat structure like the YouTube template)
- Topics should be an array: topics: ["Topic 1", "Topic 2", "Topic 3"]
- Created should be a string in quotes: created: "2025-01-09"
- Total should be a number without quotes: total: 15
- Use proper HTML syntax - ensure all tags are properly closed
- Output the actual HTML tags directly (NOT inside markdown code blocks)
- Output only the frontmatter and the cards: no list of facts, no headings, no commentary before, between or after the cards
- Each flashcard should be separated by a blank line for readability
- **RANDOMIZE THE ORDER: Mix topics, difficulty levels, and question types - do not follow source material order**
- Do not repeat a fact across cards, and do not add [[internal links]] or "related" lines
- Answers can include markdown formatting like **bold**, *italic* and lists
- If content is very long, focus on the most important concepts
- If content is technical, ensure definitions are clear
- Maintain the original meaning and accuracy of the source material
- All flashcards will be in one note - users can click to reveal answers
- This format works natively in Obsidian without requiring any plugins`;
}

export async function ensureFolderExists(app: App, folderPath: string) {
  if (!(await app.vault.adapter.exists(folderPath))) {
    await app.vault.createFolder(folderPath);
  }
}

export async function checkAndCreateFolders(
  app: App,
  settings: FileOrganizerSettings
) {
  await ensureFolderExists(app, settings.pathToWatch);
  await ensureFolderExists(app, settings.defaultDestinationPath);
  await ensureFolderExists(app, settings.attachmentsPath);
  await ensureFolderExists(app, settings.logFolderPath);
  await ensureFolderExists(app, settings.templatePaths);

  await ensureFolderExists(app, settings.stagingFolder);
  await ensureFolderExists(app, settings.backupFolderPath);
  await ensureFolderExists(app, settings.recordingsFolderPath);
}

export async function checkAndCreateTemplates(
  app: App,
  settings: FileOrganizerSettings
) {
  for (const { name, content } of DEFAULT_TEMPLATES) {
    const path = `${settings.templatePaths}/${name}`;
    if (!(await app.vault.adapter.exists(path))) {
      await app.vault.create(path, content());
    }
  }
}

/** Where an edited template is saved before it is replaced: `<templates>/_previous/<name> (<date>).md`. */
export async function backupTemplate(
  app: App,
  settings: FileOrganizerSettings,
  name: string,
  text: string,
  now: Date = new Date()
): Promise<string> {
  const folder = `${settings.templatePaths}/_previous`;
  await ensureFolderExists(app, folder);
  const base = name.replace(/\.md$/i, "");
  const date = now.toISOString().slice(0, 10);
  const path = await getAvailablePath(app, `${folder}/${base} (${date}).md`);
  await app.vault.create(path, text);
  return path;
}

/**
 * Brings unedited default templates up to date: a template that is an unedited
 * copy of an older default is replaced with the current one. An edited
 * template is never touched, and a missing one is left to checkAndCreateTemplates.
 * Returns the names that were updated and the ones found edited.
 */
export async function reconcileDefaultTemplates(
  app: App,
  settings: FileOrganizerSettings
): Promise<{ updated: string[]; edited: string[] }> {
  const updated: string[] = [];
  const edited: string[] = [];
  for (const { name, content } of DEFAULT_TEMPLATES) {
    const file = app.vault.getAbstractFileByPath(`${settings.templatePaths}/${name}`);
    if (!(file instanceof TFile)) continue;
    try {
      const current = content();
      const state = classifyDefaultTemplate(name, await app.vault.read(file), current);
      if (state === "outdated") {
        await app.vault.modify(file, current);
        updated.push(name);
      } else if (state === "edited") {
        edited.push(name);
      }
    } catch (error) {
      logger.warn(`Could not check default template ${name}:`, error);
    }
  }
  return { updated, edited };
}

// Restore default templates to their original plugin versions
// Only restores bundled default templates, does not affect user-created templates
export async function restoreDefaultTemplates(
  app: App,
  settings: FileOrganizerSettings
) {
  // Ensure template folder exists
  await ensureFolderExists(app, settings.templatePaths);

  for (const { name, content } of DEFAULT_TEMPLATES) {
    const path = `${settings.templatePaths}/${name}`;
    const original = content();
    try {
      const existing = app.vault.getAbstractFileByPath(path);
      if (existing && existing instanceof TFile) {
        // Keep the user's changes: an edited template is saved to _previous before it is replaced.
        const text = await app.vault.read(existing);
        if (classifyDefaultTemplate(name, text, original) === "edited") {
          const backup = await backupTemplate(app, settings, name, text);
          logger.info(`Saved edited template ${path} to ${backup}`);
        }
        await app.fileManager.trashFile(existing);
      }
      await app.vault.create(path, original);
      logger.info(`Restored default template: ${path}`);
    } catch (error) {
      logger.error(`Failed to restore template ${path}:`, error);
      throw error;
    }
  }
}

export async function moveFile(
  app: App,
  sourceFile: TFile,
  newFileName: string,
  destinationFolder = ""
): Promise<TFile> {
  // Extract the file extension from the source file
  const fileExtension = sourceFile.extension;

  // Construct the initial target path
  let targetPath = `${destinationFolder}/${newFileName}.${fileExtension}`;
  const normalizedTargetPath = normalizePath(targetPath);

  // Check if a file with the same name already exists in the destination
  if (await app.vault.adapter.exists(normalizedTargetPath)) {
    // If it exists, create a unique filename by adding a timestamp
    const timestamp = Date.now();
    const uniqueFileName = `${newFileName}_${timestamp}`;
    targetPath = `${destinationFolder}/${uniqueFileName}.${fileExtension}`;
  }

  // Normalize the final path
  const normalizedFinalPath = normalizePath(targetPath);

  // Ensure the destination folder exists
  await ensureFolderExists(app, destinationFolder);

  // Move the file and update all links
  await app.fileManager.renameFile(sourceFile, normalizedFinalPath);

  // Get the moved file object and return it
  const movedFile = app.vault.getAbstractFileByPath(normalizedFinalPath);
  if (!(movedFile instanceof TFile)) {
    throw new Error(`Failed to move file to ${normalizedFinalPath}`);
  }
  return movedFile;
}

export function isTFile(file: unknown): file is TFile {
  return file instanceof TFile;
}

export function isTFolder(file: unknown): file is TFolder {
  return file instanceof TFolder;
}

export function getAllFolders(app: App): string[] {
  const allFiles = app.vault.getAllLoadedFiles();
  const folderPaths = allFiles
    .filter(file => isTFolder(file))
    .map(folder => folder.path);

  return [...new Set(folderPaths)];
}

export async function getAvailablePath(
  app: App,
  desiredPath: string
): Promise<string> {
  let available = desiredPath;
  let increment = 0;

  while (await app.vault.adapter.exists(available)) {
    increment++;
    const lastDotIndex = available.lastIndexOf(".");
    const withoutExt = available.slice(0, lastDotIndex);
    const ext = available.slice(lastDotIndex);
    available = `${withoutExt} ${increment}${ext}`;
  }

  return available;
}

export async function safeCreate(
  app: App,
  desiredPath: string,
  content = ""
): Promise<TFile> {
  const parentPath = desiredPath.substring(0, desiredPath.lastIndexOf("/"));
  await ensureFolderExists(app, parentPath);

  const availablePath = await getAvailablePath(app, desiredPath);
  return await app.vault.create(availablePath, content);
}

export async function safeRename(
  app: App,
  file: TFile,
  newName: string
): Promise<void> {
  const parentPath = file.parent?.path ?? "";
  const extension = file.extension;
  const desiredPath = `${parentPath}/${newName}.${extension}`;

  const availablePath = await getAvailablePath(app, desiredPath);
  await app.fileManager.renameFile(file, availablePath);
}

export async function safeCopy(
  app: App,
  file: TFile,
  destinationPath: string
): Promise<TFile> {
  await ensureFolderExists(app, destinationPath);

  const desiredPath = `${destinationPath}/${file.name}`;
  const availablePath = await getAvailablePath(app, desiredPath);
  return await app.vault.copy(file, availablePath);
}

export async function safeMove(
  app: App,
  file: TFile,
  destinationPath: string
): Promise<string> {
  await ensureFolderExists(app, destinationPath);

  const desiredPath = `${destinationPath}/${file.name}`;
  const availablePath = await getAvailablePath(app, desiredPath);
  await app.fileManager.renameFile(file, availablePath);
  return availablePath;
}
/**
 * Sanitizes content to ensure it's valid for Obsidian
 * Handles frontmatter and content separately for safety
 */
export async function sanitizeContent(content: string): Promise<string> {
  try {
    // If content is empty or not a string, return empty string
    if (!content || typeof content !== "string") {
      return "";
    }

    const lines = content.split("\n");
    let inFrontmatter = false;
    let validContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle frontmatter boundaries
      if (line.trim() === "---") {
        if (i === 0 || (i === 1 && !validContent.length)) {
          // Start of frontmatter
          inFrontmatter = true;
          validContent.push(line);
          continue;
        } else if (inFrontmatter) {
          // End of frontmatter
          inFrontmatter = false;
          validContent.push(line);
          continue;
        }
      }

      if (inFrontmatter) {
        // Keep all frontmatter lines as-is
        validContent.push(line);
      } else {
        // Regular content - remove null characters and other potentially problematic chars
        const sanitizedLine = line
          .replace(/\0/g, "") // Remove null characters
          .replace(/\u202E/g, "") // Remove RTL override characters
          .replace(/^\ufeff/g, "") // Remove BOM
          .replace(/\r/g, ""); // Normalize line endings

        validContent.push(sanitizedLine);
      }
    }

    // Ensure frontmatter is properly closed
    if (inFrontmatter) {
      validContent.push("---");
    }

    return validContent.join("\n");
  } catch (error) {
    logger.error("Error sanitizing content:", error);
    return content; // Return original content if sanitization fails
  }
}

/**
 * Safely modifies file content ensuring it's valid for Obsidian
 */
export async function safeModifyContent(
  app: App,
  file: TFile,
  content: string
): Promise<void> {
  try {
    const sanitizedContent = await sanitizeContent(content);

    // Check if content has frontmatter
    if (sanitizedContent.trim().startsWith("---")) {
      const parts = sanitizedContent.split(/^---\s*$/m);

      // Valid frontmatter should create 3 parts: ["", yaml content, remaining content]
      if (parts.length >= 3) {
        try {
          // Try to parse the YAML part (index 1) to validate it
          const frontmatter = parseYaml(parts[1]) as Record<string, unknown>;

          // If parsing succeeds, use processFrontMatter to ensure proper handling of arrays
          await app.fileManager.processFrontMatter(file, fm => {
            // Merge the parsed frontmatter with existing
            Object.assign(fm, frontmatter);
          });

          // Update the content after frontmatter is processed
          await app.vault.modify(file, sanitizedContent);
          return;
        } catch (e) {
          logger.debug("Frontmatter parsing failed:", e);
          // If parsing fails, preserve the original content
          await app.vault.modify(file, sanitizedContent);
          return;
        }
      }
    }

    await app.vault.modify(file, sanitizedContent);
  } catch (error) {
    logger.error("Error in safeModifyContent:", error);
    throw error;
  }
}
