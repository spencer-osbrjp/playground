import "dotenv/config";
import Anthropic, { type Anthropic as AnthropicT } from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

type Metadata = Record<string, string>;

const run = async () => {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log("Thinking...");

  // Load the mario.jpg image
  const imagePath = path.join(__dirname, "assets", "mario.jpg");
  const imageData = fs.readFileSync(imagePath);
  const base64Image = imageData.toString("base64");

  const out = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "assistant",
        content: [
          {
            type: "text",
            text: `
You are an expert SVG artist and image analyzer. Your must fufill the follwing tasks.

<tasks>
1. Carefully examine the character in the provided image
2. Identify and extract the following components:
   - Face (Face shap and color)
   - Hat/cap (including emblem or logo)
   - Eyes (including pupils, highlights, and outlines)
   - Nose (shape and shading)
   - Mouth (including lips and expression details)
   - Mustache (including texture and shape)
   - Any other distinctive facial features

3. For each component, generate a separate, detailed SVG:
   - Use accurate colors and gradients from the original image
   - Include proper layering (shadows, highlights, outlines)
   - Center each component within the viewBox
   - Add descriptive comments in the SVG code
   - Make the SVG scalable and clean
   - CRITICAL: Every SVG MUST use viewBox="0 0 200 200"
</tasks>

<output_format>
MUST be valid JSON, for example:
   {
     "hat": "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
     "eyes": "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
     "nose": "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
     "mouth": "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>",
     "mustache": "<svg viewBox=\"0 0 200 200\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
   }
 You can modify the key names if needed.
<output_format/>

<important_note>
- Output ONLY valid JSON, no additional text or markdown
- Component names as keys (lowercase, underscore for spaces)
- Each SVG string must be properly escaped for JSON
- All SVGs must have identical viewBox="0 0 200 200"
- Use semantic grouping with <g> tags where appropriate
<important_note/>

Be as detailed and accurate as possible in capturing the character's distinctive style and features.`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/jpeg",
              data: base64Image,
            },
          },
        ],
      },
    ],
  });

  const output: string | null =
    out.content[0].type === "text" ? out.content[0].text : null;

  console.log("Output: ", output);

  try {
    if (output) {
      // Remove markdown code fences if present
      let cleanedOutput = output.trim();
      if (cleanedOutput.startsWith("```json")) {
        cleanedOutput = cleanedOutput
          .replace(/^```json\n?/, "")
          .replace(/\n?```$/, "");
      } else if (cleanedOutput.startsWith("```")) {
        cleanedOutput = cleanedOutput
          .replace(/^```\n?/, "")
          .replace(/\n?```$/, "");
      }

      const outputToJSON: Metadata = JSON.parse(cleanedOutput);

      // Save metadata to assets/metadata.json
      const metadataPath = path.join(__dirname, "assets", "metadata.json");
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(outputToJSON, null, 2),
        "utf-8",
      );

      console.log(`Metadata saved to ${metadataPath}`);
    }
  } catch (err) {
    console.error(`Error: `, err);
  }

  if (output) {
    const mergedSVG = await merger(output, client);

    if (mergedSVG) {
      animator(mergedSVG, client);
    }
  }
};

const merger = async (
  output: string,
  client: AnthropicT,
): Promise<string | undefined> => {
  console.log("Merging...");

  const merge = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are an expert SVG compositor. Your task is to merge individual SVG components into one unified, well-structured SVG file.

<component_data>
${output}
</component_data>

<requirements>
- Parse the JSON data containing individual SVG components
- Create a single SVG with viewBox="0 0 200 200"
- Wrap each component in a <g> tag with descriptive id and class
- Maintain proper layering order (background to foreground):
  1. face (bottom layer)
  2. nose
  3. mouth
  4. mustache
  5. eyes
  6. eyebrows
  7. hat (top layer)
- Preserve all colors, gradients, and styling from original components
- Ensure all elements are properly positioned and centered
- Remove duplicate defs (merge gradients with unique IDs)
- Add xmlns="http://www.w3.org/2000/svg" to root SVG
</requirements>

<output_format>
Return ONLY the complete SVG code without any markdown formatting, explanations, or additional text.
The output must start with <svg and end with </svg>
</output_format>`,
      },
    ],
  });

  const mergeOutput = merge.content[0];

  if (mergeOutput.type === "text") {
    const output = mergeOutput.text;

    console.log(output);

    const svgPath = path.join(__dirname, "assets", "output.svg");
    fs.writeFileSync(svgPath, output, "utf8");

    console.log("Output SVG: ", svgPath);

    return output;
  }

  return undefined;
};

const animator = async (
  svgContent: string,
  client: AnthropicT,
): Promise<string | undefined> => {
  console.log("Animating...");

  const animate = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `You are an expert SVG animation specialist. Your task is to add smooth, engaging CSS animations to an SVG character.

<svg_input>
${svgContent}
</svg_input>

<instructions>
Step 1: Parse and identify the mouth component
- Examine the SVG structure carefully
- Look for <g> tags with id attributes containing "mouth"
- This may be id="mouth", id="mouth_component", or similar variations
- Identify the exact id value to target

Step 2: Create talking animation
- Target ONLY the mouth <g> element by its id in your CSS selector
- Create a natural talking/speaking animation
- Example: #mouth { animation: talk 0.6s ease-in-out infinite; }
</instructions>

<animation_requirements>
Create a natural talking animation for the mouth ONLY:

1. Animation target:
   - Find <g> tag with id containing "mouth" (e.g., id="mouth", id="mouth_component")
   - ONLY animate this component - DO NOT animate any other parts (hat, eyes, eyebrows, mustache, nose, etc.)
   - IMPORTANT: Search for partial matches in id attributes

2. Talking animation characteristics:
   - Simulate natural mouth movement during speech
   - Open and close motion (vertical scale or rotation)
   - Smooth transitions that mimic talking rhythm
   - Fast enough to feel like talking (0.4s - 0.8s per cycle)
   - Use transform: scaleY() or rotateX() for mouth opening effect
   - Or use transform: translateY() to move lower lip/jaw

3. Technical specifications:
   - Use CSS @keyframes for the animation
   - Add <style> tag inside <svg> after opening <svg> tag
   - Target element using ID selector (e.g., #mouth)
   - Apply animation-timing-function: ease-in-out or cubic-bezier for natural motion
   - Set animation-duration: 0.4s - 0.8s (talking speed)
   - Use animation-iteration-count: infinite for looping
   - Add transform-origin: center or bottom center for proper mouth pivot
   - Performance-optimized (use transform only, avoid layout changes)

4. Preserve structure:
   - Keep all existing groups, IDs, and classes unchanged
   - Maintain viewBox="0 0 200 200"
   - Do NOT modify the structure of any <g> elements
   - Keep all colors, gradients, and styling intact
   - Only add the <style> tag and CSS animation for mouth
</animation_requirements>

<output_format>
Return ONLY the complete animated SVG code including the <style> tag with CSS animations.
- No markdown code blocks or backticks
- No explanations or additional text
- Output must start with <svg and end with </svg>
- Include complete, valid CSS within <style> tags
- CSS must target existing id attributes from the input SVG
</output_format>`,
      },
    ],
  });

  const animateOutput = animate.content[0];

  if (animateOutput.type === "text") {
    const output = animateOutput.text;

    console.log(output);

    const animatedSvgPath = path.join(__dirname, "assets", "animated.svg");
    fs.writeFileSync(animatedSvgPath, output, "utf8");

    console.log("Animated SVG: ", animatedSvgPath);

    return output;
  }

  return undefined;
};

const main = () => {
  run();
};

main();
