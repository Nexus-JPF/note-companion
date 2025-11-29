import { App, TFolder, TFile, normalizePath, parseYaml } from "obsidian";
import { FileOrganizerSettings } from "./settings";
import { logger } from "./services/logger";

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
}

export async function checkAndCreateTemplates(
  app: App,
  settings: FileOrganizerSettings
) {
  const meetingNoteTemplatePath = `${settings.templatePaths}/meeting_note.md`;
  const youtubeVideoTemplatePath = `${settings.templatePaths}/youtube_video.md`;
  const enhanceTemplatePath = `${settings.templatePaths}/enhance.md`;
  const researchPaperTemplatePath = `${settings.templatePaths}/research_paper.md`;

  if (!(await app.vault.adapter.exists(meetingNoteTemplatePath))) {
    await app.vault.create(
      meetingNoteTemplatePath,
      `Contextual Extraction of Discussion Points and Action Items

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
`
    );
  }

  if (!(await app.vault.adapter.exists(researchPaperTemplatePath))) {
    await app.vault.create(
      researchPaperTemplatePath,
      `---

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
`
    );
  }

  if (!(await app.vault.adapter.exists(youtubeVideoTemplatePath))) {
    await app.vault.create(
      youtubeVideoTemplatePath,
      `Please create an Obsidian note using the video link and any available transcript or additional context. The note must include:

1. Frontmatter (at the top) with the following properties:

---

title: "{{video title - extract from YouTube Video Information section or transcript}}"

channel: "{{channel name if available, otherwise leave empty}}"

date_published: "{{video publication date if available in transcript or metadata, otherwise leave empty}}"

topics: ["{{relevant topic 1}}", "{{relevant topic 2}}"]

tags: ["#youtube", "{{#any other relevant tags based on content}}"]

summary: "{{short summary of the video's main theme and key takeaways}}"

---

2. A YouTube embed link in the following format:

[![YouTube Video](https://www.youtube.com/watch?v=XXXXXXX)](https://www.youtube.com/watch?v=XXXXXXX)

3. A comprehensive, detailed summary of the key points from the video (below the embed link).

**Instructions:**

- Extract the video title from the "YouTube Video Information" section if provided, or infer from the transcript content.

- Extract topics by analyzing the main themes discussed in the transcript. Use 2-5 specific, relevant topics.

- Generate tags based on the video content. Always include "#youtube" and add 2-4 additional relevant tags.

- Create a concise summary (1-2 sentences) that captures the video's main theme and key takeaways.

- If a full transcript is provided in the "Full Transcript" section, use it to create an accurate, detailed summary below the embed link.

- Extract the publication date if mentioned in the transcript or metadata. If not available, leave date_published empty.

- Maintain the exact markdown syntax for the frontmatter block (\`---\` at the top and bottom).

- Use the YouTube link format exactly as provided. Extract the video ID from the URL in the content.

- In the main body, provide a comprehensive summary with bullet points covering all major points from the video transcript.

- Do not use \`\`\` code blocks or markdown code formatting in the summary.

- Focus on accuracy and completeness based on the actual transcript content provided.

**Example Output Format:**

---

title: "How to Build a React App in 2024"

channel: "Tech Tutorials"

date_published: "2024-01-15"

topics: ["React", "Web Development", "JavaScript", "Tutorial"]

tags: ["#youtube", "#react", "#webdev", "#tutorial"]

summary: "A comprehensive guide to building modern React applications with hooks, context API, and best practices for 2024."

---

[![YouTube Video](https://www.youtube.com/watch?v=XXXXXXX)](https://www.youtube.com/watch?v=XXXXXXX)

## Detailed Summary

- Introduction to React fundamentals and modern development practices
- Setting up a new React project with Vite
- Using React Hooks for state management
- Implementing Context API for global state
- Best practices for component structure and organization
- Performance optimization techniques
- Deployment strategies and recommendations`
    );
  }

  if (!(await app.vault.adapter.exists(enhanceTemplatePath))) {
    await app.vault.create(
      enhanceTemplatePath,
      `1. **Use Headings and Subheadings**: Clearly define sections with headings (e.g.,
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

10. do not use \`\`\` markdown`
    );
  }
}

/**
 * @deprecated use safeMove instead
 */
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
  const movedFile = app.vault.getAbstractFileByPath(
    normalizedFinalPath
  ) as TFile;
  return movedFile;
}

export function isTFolder(file: any): file is TFolder {
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
): Promise<void> {
  await ensureFolderExists(app, destinationPath);

  const desiredPath = `${destinationPath}/${file.name}`;
  const availablePath = await getAvailablePath(app, desiredPath);
  await app.fileManager.renameFile(file, availablePath);
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
          const frontmatter = parseYaml(parts[1]);

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
