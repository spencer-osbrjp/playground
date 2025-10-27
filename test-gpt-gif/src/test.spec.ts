import "dotenv/config";
import OpenAI from "openai";
import { describe, test } from "vitest";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

describe("Generate GIF", () => {
  const apiKey = process.env.OPENAI_API_KEY;
  // Load the image as base64 data URI
  const imagePath = join(process.cwd(), "public", "input.png");
  const imageBuffer = readFileSync(imagePath);
  const gridPath = join(process.cwd(), "public", "grid-3x3.png");
  const gridBuffer = readFileSync(gridPath);
  const inputImage = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  const gridTemplate = `data:image/png;base64,${gridBuffer.toString("base64")}`;

  test.skip("Generate", async () => {
    const client = new OpenAI({
      apiKey,
    });

    const result = await client.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: `
Create a 9-frame character animation sprite sheet showing a walking cycle.

CRITICAL REQUIREMENTS:
- Grid: 3 rows × 3 columns (1024×1024px total, each cell 341×341px)
- Frame order: Left to right, top to bottom (frames 1-9)
- Character MUST stay within cell boundaries (max 341×341px per frame)
- Maintain EXACT grid dimensions from reference image
- Transparent background for each frame

STEP 1 - ANALYZE THE CHARACTER:
Before drawing anything, carefully examine the provided character image:
- Describe the character's current pose (leg positions, arm positions, body angle)
- Note the character's proportions (height, limb length ratios, torso size)
- Identify all clothing, accessories, and distinctive features
- Determine the character's art style and color palette

STEP 2 - PLAN THE WALKING ANIMATION:
Based on your analysis, plan out each frame's pose in text first:

Frame 1: [Describe leg position, arm position, body posture]
Frame 2: [Describe how the character transitions from Frame 1]
Frame 3: [Continue the sequence]
Frame 4: [Mid-cycle, opposite of Frame 1]
Frame 5: [Continue]
Frame 6: [Continue]
Frame 7: [Continue]
Frame 8: [Continue]
Frame 9: [Complete or near-loop to Frame 1]

Consider these walking mechanics:
- Which leg is forward/back in the starting pose?
- Arms swing opposite to legs (right arm forward = left leg forward)
- Body weight shifts with each step
- Feet alternate: plant → lift → swing forward → plant

STEP 3 - CREATE THE SPRITE SHEET:
Now create a 9-frame character animation sprite sheet with this exact structure:

GRID SPECIFICATIONS:
- Total size: 1024×1024px
- Grid: 3 rows × 3 columns
- Each cell: 341×341px (width) × 341×341px (height)
- MUST match the grid template from the reference image
- DO NOT modify grid or image dimensions

FRAME ORDER & LAYOUT:
Row 1: Frames 1, 2, 3 (left to right)
Row 2: Frames 4, 5, 6 (left to right)
Row 3: Frames 7, 8, 9 (left to right)

CHARACTER REQUIREMENTS:
✓ Character size MUST NOT exceed 341×341px per cell
✓ Maintain EXACT same proportions in every frame
✓ Keep character height consistent (same eye-level across all frames)
✓ Preserve all clothing details, colors, and accessories
✓ Same art style and line quality throughout
✓ Transparent background for each frame
✓ Feet should touch the same baseline/ground level

ANIMATION QUALITY:
- Each frame must show a DISTINCT pose that flows sequentially
- Clear progression from frame to frame
- Proper weight shift visible in body posture
- Natural arm swing opposite to leg movement
- Subtle vertical bounce in walking cycle
- Smooth, loopable animation when played in sequence

Execute your planned animation from Step 2, ensuring each frame precisely matches your written description while maintaining perfect character consistency.

**Key additions:**

1. **Three-step process** - Forces the model to analyze, plan, then execute
2. **Explicit analysis step** - Model must describe what it sees first
3. **Text-based planning** - Model writes out each frame''s body facing direction?
   - Measure the character's proportions (head-to-body ratio, limb lengths)

2. WALKING CYCLE LOGIC:
   Think: If the character is mid-walk, which foot would naturally move next?
   - Frame 1: [Starting position - describe all limbs]
   - Frame 2: [Which limb moves? How far?]
   - Frame 3: [Continue motion - what shifts?]
   - Frame 4: [Opposite position - mirror of Frame 1]
   - Frame 5: [Mirror of Frame 2]
   - Frame 6: [Mirror of Frame 3]
   - Frame 7: [Returning toward Frame 1]
   - Frame 8: [Almost back to start]
   - Frame 9: [Complete the loop]

3. CONSISTENCY CHECK:
   For EACH frame, verify:
   - Character height matches Frame 1? (YES/NO)
   - Proportions identical? (YES/NO)
   - All details present? (YES/NO)
   - Pose flows from previous frame? (YES/NO)

ONLY AFTER COMPLETING THIS ANALYSIS, create the sprite sheet following these specifications:

ANIMATION SEQUENCE (Walking Cycle):
Frame 1: Starting pose - right foot forward, left foot back, right arm back, left arm forward
Frame 2: Transition - right foot plants, left foot lifts, arms begin to swing
Frame 3: Mid-stride - left foot moves forward, body shifts weight, arms continue swing
Frame 4: Contact - left foot forward, right foot back, left arm back, right arm forward (opposite of frame 1)
Frame 5: Transition - left foot plants, right foot lifts, arms swing opposite direction
Frame 6: Mid-stride - right foot moves forward, body shifts weight
Frame 7: Similar to Frame 1 but showing progression
Frame 8: Similar to Frame 2 but continuing the cycle
Frame 9: Return to starting pose or near-completion of cycle

CHARACTER CONSISTENCY CHECKLIST:
- Same height, proportions, and body ratios in every frame
- Same clothing, colors, and design details throughout
- Same art style and line weight
- Head position maintains consistent eye-level across frames
- Feet should touch the same baseline/ground level

ANIMATION PRINCIPLES:
- Show clear weight shift between steps
- Arms swing opposite to legs (right arm forward = left leg forward)
- Body should have subtle up/down bounce
- Keep head relatively stable with slight natural movement
- Each pose should flow smoothly into the next

Reference the provided character image for exact appearance, colors, and style. Maintain these precisely across all 9 frames.
`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: gridTemplate,
              detail: "auto",
            },
            {
              type: "input_image",
              image_url: inputImage,
              detail: "high",
            },
          ],
        },
      ],
      tools: [
        {
          type: "image_generation",
          size: "1024x1024",
          output_format: "png",
          quality: "high",
          input_fidelity: "low",
          background: "transparent",
        },
      ],
      tool_choice: {
        type: "image_generation",
      },
    });

    // Extract the edited image
    const imageBase64 = result.output.find(
      (o) => o.type === "image_generation_call",
    )?.result;
    // Extract and save the generated image

    if (imageBase64) {
      // Remove the data URI prefix if present
      const imageBuffer = Buffer.from(imageBase64, "base64");

      // Save to public/output-grid.png
      const outputPath = join(process.cwd(), "public", "output-grid.png");
      writeFileSync(outputPath, imageBuffer);
      console.log(`Image saved to: ${outputPath}`);
    }
  }, 500000);

  // ------------------------------------------------------
  let previous_response_id: string | undefined;
  let plansOutput: string | undefined;
  const Frame = z.object({
    frame_index: z.number(),
    pose: z.string(),
    propotion: z.string(),
  });

  const Planner = z.object({
    frames: z.array(Frame),
  });

  test.skip("Flow Generation", async () => {
    const client = new OpenAI({
      apiKey,
    });

    const plans = await client.responses.create({
      model: "gpt-5",
      reasoning: {
        effort: "medium",
      },
      input: [
        {
          role: "developer",
          content: [
            {
              type: "input_text",
              text: `
You are an expert animation planner creating a smooth walking animation cycle.

STEP 1 - ANALYZE THE CHARACTER:
Carefully examine the provided character image and document:
- Current pose: leg positions, arm positions, body angle, weight distribution
- Proportions: height, head-to-body ratio, limb length ratios, torso size
- Clothing & Features: ALL visible clothing, accessories, colors, patterns, and distinctive features
- Art Style: art style characteristics, line weight, shading style, color palette (list specific colors)

STEP 2 - PLAN A SMOOTH WALKING CYCLE:
Create exactly 9 sequential frames that form a complete, loopable walking cycle.

CRITICAL ANIMATION PRINCIPLES:
1. **Sequential Flow**: Each frame MUST be a small incremental change from the previous frame
2. **Contact Positions**: Frame 1 and Frame 5 are key "contact" poses (feet planted, opposite positions)
3. **Passing Positions**: Frame 3 and Frame 7 are "passing" poses (one leg passes the other)
4. **Natural Timing**: Distribute the motion evenly across all 9 frames
5. **Weight Shift**: Show clear weight transfer from one leg to the other
6. **Arm Coordination**: Arms swing opposite to legs (right arm forward = left leg forward)
7. **Vertical Bounce**: Body should rise slightly during passing positions, lower during contact
8. **Loop Continuity**: Frame 9 should nearly return to Frame 1 pose for seamless looping

FRAME SEQUENCE STRUCTURE:
Frame 1: RIGHT CONTACT - Right leg extended forward (heel contact), left leg extended back (toe push-off), left arm forward, right arm back, body weight transitioning to right leg
Frame 2: Right leg plants and bends slightly absorbing weight, left leg begins lifting off ground, arms continue swinging
Frame 3: RIGHT PASSING - Right leg straight and supporting full weight, left leg lifted and passing right leg at knee height, arms at neutral/crossing position, body at highest point
Frame 4: Left leg swings forward past right, right leg begins to extend back, arms continue swing
Frame 5: LEFT CONTACT - Left leg extended forward (heel contact), right leg extended back (toe push-off), right arm forward, left arm back, body weight transitioning to left leg (MIRROR of Frame 1)
Frame 6: Left leg plants and bends slightly absorbing weight, right leg begins lifting off ground, arms continue swinging
Frame 7: LEFT PASSING - Left leg straight and supporting full weight, right leg lifted and passing left leg at knee height, arms at neutral/crossing position, body at highest point
Frame 8: Right leg swings forward past left, left leg begins to extend back, arms continue swing
Frame 9: RETURN TO START - Nearly identical to Frame 1 but slightly before full contact to enable smooth loop

For each frame, output the following fields:
- frame_index: Integer from 1 to 9
- pose: Detailed description of leg positions, arm positions, body tilt, weight distribution, and foot placement
- propotion: Character's exact proportions that MUST remain identical across all frames (e.g., "head is 1/7 of total height, arms reach mid-thigh, legs are 55% of total height")

VALIDATION CHECKLIST:
✓ All 9 frames show small, incremental changes
✓ Each frame naturally flows into the next
✓ Proportions are IDENTICAL in all frames
✓ ALL clothing/features present in every frame
✓ Art style and colors consistent throughout
✓ Frame 1 and Frame 5 are opposite contact poses
✓ Frame 3 and Frame 7 are passing poses
✓ Frame 9 nearly matches Frame 1 for looping

Output exactly 9 frames following this structure for a smooth, professional walking animation.
`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_image",
              image_url: inputImage,
              detail: "auto",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(Planner, "planner"),
        verbosity: "low",
      },
    });

    plansOutput = plans.output_text;
    previous_response_id = plans.id;

    // Save metadata to JSON
    try {
      const plansJSON: z.infer<typeof Planner> = JSON.parse(plansOutput);
      const metadata = {
        response_id: previous_response_id,
        timestamp: new Date().toISOString(),
        model: "gpt-5",
        plans: plansJSON,
      };

      const metadataPath = join(process.cwd(), "public", "metadata.json");
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      console.log(`Metadata saved to: ${metadataPath}`);
    } catch (err) {
      console.error("Failed to save metadata:", err);
    }

    console.log("OUTPUT: ", plansOutput, previous_response_id);
  }, 50000000);

  test.skip("Frame Generation", async () => {
    const client = new OpenAI({
      apiKey,
    });

    if (!plansOutput || !previous_response_id) {
      throw new Error(
        "Plans output not found. Run 'Flow Generation' test first.",
      );
    }

    let previous_image: string | undefined = undefined;

    try {
      const plansJSON: z.infer<typeof Planner> = JSON.parse(plansOutput);
      const framesData: Record<string, string> = {};

      for (let i = 1; i <= plansJSON.frames.length; i++) {
        const result = await client.responses.create({
          model: "gpt-5",
          previous_response_id,
          tools: [
            {
              type: "image_generation",
              size: "1024x1024",
              quality: "medium",
              background: "transparent",
            },
          ],
          tool_choice: {
            type: "image_generation",
          },
          input: [
            {
              role: "developer",
              content: [
                {
                  type: "input_text",
                  text: `
Generate frame ${i} of the walking animation based on your previous detailed analysis and the provided image.

ABSOLUTE REQUIREMENTS - CHARACTER CONSISTENCY:
1. **Exact Proportions**: Use the EXACT proportions specified in frame_index ${i} from your analysis (head size, limb lengths, body ratios)
2. **Identical Appearance**: Character must be PIXEL-PERFECT identical to the reference image except for the pose
   - Same face, same hairstyle, same clothing, same colors, same accessories
   - Same art style, line weight, and shading technique
   - Same color palette (use exact color values from your analysis)
3. **Same Character Height**: Character must be the EXACT same height as in all other frames
4. **Same Ground Level**: Feet must touch the same baseline/ground position across all frames

POSE REQUIREMENTS FOR FRAME ${i}:
- Follow the EXACT pose description from frame_index ${i} in your previous response
- Leg positions: Match the specified leg angles and positions precisely
- Arm positions: Match the specified arm swing positions precisely
- Body tilt: Match the specified weight distribution and body angle
- This frame should flow naturally from frame ${i - 1} and into frame ${i + 1}

ANIMATION CONTINUITY:
- This is frame ${i} of 9 in a walking cycle
- The pose should be a SMALL, INCREMENTAL change from the previous frame
- Ensure smooth motion - avoid large jumps in position
- Keep character centered in frame with consistent scale

TECHNICAL SPECS:
- Full body visible from head to toe
- Character centered in 1024x1024px canvas
- Transparent background
- Character should not exceed 80% of canvas height
- Maintain exact art style from reference image

Create this frame with absolute consistency to the reference character, changing ONLY the pose as specified.
`,
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_image",
                  image_url: previous_image || inputImage,
                  detail: "auto",
                },
              ],
            },
          ],
        });

        // Extract the edited image
        const imageBase64: string | null | undefined = result.output.find(
          (o) => o.type === "image_generation_call",
        )?.result;
        // Extract and save the generated image

        if (imageBase64) {
          previous_image = `data:image/png;base64,${imageBase64}`;
          // Remove the data URI prefix if present
          const imageBuffer = Buffer.from(imageBase64, "base64");

          // Save to public/output-frame-${i}.png
          const frameNumber = i.toString().padStart(2, "0");
          const outputPath = join(
            process.cwd(),
            "public",
            `output-frame-${frameNumber}.png`,
          );
          writeFileSync(outputPath, imageBuffer);
          console.log(`Image saved to: ${outputPath}`);

          // Store base64 in frames data object
          framesData[frameNumber] = imageBase64;
        }
      }

      // Save frames data as JSON
      const framesJsonPath = join(process.cwd(), "public", "frames.json");
      writeFileSync(framesJsonPath, JSON.stringify(framesData, null, 2));
      console.log(`Frames JSON saved to: ${framesJsonPath}`);
    } catch (err) {
      console.error(`Failed to parse string to JSON: `, err);
    }
  }, 5000000);
});
