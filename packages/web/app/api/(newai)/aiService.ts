import {
  LanguageModel,
  generateObject,
  generateText,
  streamObject,
} from "ai";
import { z } from "zod";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import OpenAI from "openai";

// Function to generate tags
export async function generateTags(
  content: string,
  fileName: string,
  vaultTags: string[] | null,
  model: LanguageModel
) {

  let prompt: string;
  // when in vault tags mode
  if (Array.isArray(vaultTags)) {
    // Use existing tags from the vault
    prompt = `Given the text "${content}" (and if relevant ${fileName}), identify the at most 3 relevant tags from the following list, sorted from most commonly found to least commonly found: ${vaultTags.join(
      ", "
    )}`
    // when in generate new tags mode
  } else {
    // Generate likely tags
    prompt = `Given the text "${content}" (and if relevant ${fileName}), generate 5 relevant and popular tags for the Obsidian app. The tags should be sorted from most relevant to least relevant. Each tag should be a single word, lowercase, without any spaces or special characters (except for underscores). Do not include 'none' as a tag.`;
  }

  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      tags: z.array(z.string().refine(tag => tag.toLowerCase() !== 'none')).length(3),
    }),

    prompt: prompt,
  });

  // Post-process all tags to ensure they have a '#' prefix
  response.object.tags = response.object.tags.map(tag => {
    // remove spaces from the tag
    const tagWithoutSpaces = tag.replace(/\s+/g, '');
    return tagWithoutSpaces.startsWith('#') ? tagWithoutSpaces : '#' + tagWithoutSpaces;
  });

  return response;
}

export async function generateExistingTags(
  content: string,
  fileName: string,
  vaultTags: string[],
  model: LanguageModel
) {
  const prompt = `For "${content}" (file: "${fileName}"), select up to 3 tags from: ${vaultTags.join(", ")}. Only choose tags with an evident link to the main topics that is not too specific. If none meet this criterion, return null.`;

  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    temperature: 0,
    schema: z.object({
      tags: z.array(z.string()).max(3),
    }),
    prompt: prompt,
  });

  return response;
}




// Function to generate alias variations
export async function generateAliasVariations(
  fileName: string,
  content: string,
  model: LanguageModel
) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      aliases: z.array(z.string()).default([]),
    }),
    prompt: `Generate a list of 3 closely related names (aliases) for the given document name: "${fileName}". The aliases should include variations in capitalization.  Consider the context provided by the content "${content}".`,
    system:
      "only answer with good names that could refer to a title of this document",
  });

  return response;
}

// Function to guess the relevant folder
export async function guessRelevantFolder(
  content: string,
  fileName: string,
  folders: string[],
  model: LanguageModel,
  customInstructions?: string,
) {

  const basePrompt = `Review the content: "${content}" and the file name: "${fileName}". Decide which of the following folders is the most suitable: ${folders.join(
    ", "
  )}. Base your decision on the relevance of the content and the file name to the folder themes.  If no existing folder is suitable, respond with null.`;

  const prompt = customInstructions
    ? `${basePrompt} Strictly follow these custom instructions "${customInstructions}".`
    : basePrompt;

  // eslint-disable-next-line no-case-declarations
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      suggestedFolder: z.string().nullable(),
    }),
    prompt: prompt,
  });


  return response;
}



// Function to create a new folder if none is found
export async function createNewFolder(
  content: string,
  fileName: string,
  existingFolders: string[],
  model: LanguageModel
) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      newFolderName: z.string(),
    }),
    prompt: `Given the content: "${content}" and the file name: "${fileName}", suggest a new folder name that would appropriately categorize this file. Consider the existing folder structure: ${existingFolders.join(
      ", "
    )}.`,
  });

  return response;
}

// Function to generate relationships between files
export async function generateRelationships(
  activeFileContent: string,
  files: { name: string }[],
  model: LanguageModel
) {
  const modelName = model.modelId;

  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      similarFiles: z.array(z.string()),
    }),
    prompt: `Analyze the content of the active file and compare it with the following files:

          Active File Content:
          ${activeFileContent}

          List of Files:
          ${files.map((file: { name: string }) => `${file.name}`).join(", ")}

          Determine which five files are most similar to the active file based on their content. Provide a ranked list of the top 5 similar file names, each on a new line. If no files are similar, return null.`,
  });

  return response;
}

// Function to generate document titles
export async function generateDocumentTitle(
  document: string,
  currentName: string,
  model: LanguageModel,
  renameInstructions: string
) {
  // console log the prompt and system
  const prompt = `You are an AI specialized in generating concise and relevant document titles. Ensure the title is under 50 characters, contains no special characters, and is highly specific to the document's content.
      Additional context:
      Time: ${new Date().toISOString()}
      Current Name: ${currentName}
      Document Content: ${document}
      Provide a suitable title
      ${renameInstructions}
      `;
  const system = `Only answer with human readable title`;


  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      name: z.string().max(60),
    }),
    system,
    prompt,
  });

  return response;
}

/** @deprecated Use extractTextFromVisionImage from @/lib/ocr-extract */
export async function extractTextFromImage(
  image: ArrayBuffer,
  model: LanguageModel
): Promise<string> {
  const { extractTextFromVisionImage } = await import("@/lib/ocr-extract");
  const result = await extractTextFromVisionImage({
    image: { kind: "buffer", buffer: Buffer.from(image) },
    model,
    retryOnEmpty: false,
  });
  if (result.error) {
    throw new Error(result.error);
  }
  return result.text.trim() + "\n\n";
}

// Function to classify document type
export async function classifyDocument(
  content: string,
  fileName: string,
  templateNames: string[],
  model: LanguageModel
) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      documentType: z
        .string()
        .describe(
          "Name of the matching template type, or an empty string if none match"
        ),
    }),
    system:
      "Only answer with the name of the document type if it matches one of the template types. Otherwise, answer with an empty string.",
    prompt: `Given the text content:

          "${content}"

          and if relevant, the file name:

          "${fileName}"

          Please identify which of the following document types best matches the content:

          Template Types:
          ${templateNames.join(", ")}

          If the content clearly matches one of the provided template types, respond with the name of that document type. If the content does not clearly match any of the template types, respond with an empty string.`,
  });

  return response;
}

// Function to format document content
export async function formatDocumentContent(
  content: string,
  formattingInstruction: string,
  model: LanguageModel
) {
  const { partialObjectStream } = streamObject({
    model,
    schema: z.object({
      formattedContent: z.string(),
    }),
    system: "Answer directly in markdown",
    prompt: `Format the following content according to the given instruction, only use context if asked in instruction:
        Context:
        Time: ${new Date().toISOString()}


        Content:
        "${content}"

        Formatting Instruction:
        "${formattingInstruction}"

        `,
  });

  let formattedContent = "";
  for await (const partialObject of partialObjectStream) {
    formattedContent = partialObject.formattedContent || "";
  }

  return { object: { formattedContent }, usage: { totalTokens: 0 } };
}

export async function identifyConceptsAndFetchChunks(
  content: string,
  model: LanguageModel
) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      concepts: z.array(
        z.object({
          name: z.string(),
          chunk: z.string(),
        })
      ),
    }),
    prompt: `Analyze the following content:

    ${content}

    1. Identify the key concepts in the document.
    2. For each concept, extract the most relevant chunk of information.
    3. Return a list of concepts, each with its name and associated chunk of information.

    Aim to split the document into the fewest atomic chunks possible while capturing all key concepts.`,
  });

  return response;
}

// Function to identify concepts in the document
export async function identifyConcepts(content: string, model: LanguageModel) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      concepts: z.array(z.string()),
    }),
    prompt: `Split documents into the fewest atomic chunks possible. The goal is to identify the key concepts in the document.

      ${content}

      `,
  });

  return response;
}

// Function to fetch chunks for a given concept
export async function fetchChunksForConcept(
  content: string,
  concept: string,
  model: LanguageModel
) {
  const response = await generateObject({
    model: model as any, // Type cast for AI SDK v2 compatibility
    schema: z.object({
      content: z.string(),
    }),
    prompt: `Given the document content and the concept "${concept}", extract the relevant chunks of information:

    Document Content:
    ${content}

    Concept: ${concept}

    `,
  });

  return response;
}

// Function to generate transcript from audio
export async function generateTranscriptFromAudio(
  audioBuffer: ArrayBuffer,
  fileExtension: string,
  openaiApiKey: string
): Promise<string> {
  const openai = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: process.env.OPENAI_WHISPER_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1',
    dangerouslyAllowBrowser: true,
  });

  // Save the audio buffer to a temporary file
  const tempFilePath = join(tmpdir(), `audio_${Date.now()}.${fileExtension}`);
  await fsPromises.writeFile(tempFilePath, new Uint8Array(audioBuffer));

  // Create a readable stream from the temporary file
  const audioStream = fs.createReadStream(tempFilePath);

  try {
    // Use the OpenAI API to generate the transcript
    const response = await openai.audio.transcriptions.create({
      file: audioStream,
      model: "whisper-1",
    });
    return response.text;
  } catch (error) {
    console.error("Error generating transcript:", error);
    throw error;
  } finally {
    // Clean up the temporary file
    await fsPromises.unlink(tempFilePath);
  }
}