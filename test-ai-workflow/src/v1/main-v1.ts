type AcceptedType =
  | "string"
  | "imageBase64[]"
  | "string,imageBase64[]"
  | "dateTimeString"
  | "string,imageBase64[],dateTimeString"
  | "response";

type OperationBaseType = {
  id: string;
  description: string;
};

type Processor = OperationBaseType & {
  inputType: AcceptedType;
  outputType: AcceptedType;
  process: (medium: unknown) => unknown;
};

type Switcher = OperationBaseType & {
  inputType: AcceptedType;
  outputWhenTrue: AcceptedType;
  outputWhenFalse: AcceptedType;
  check: (medium: unknown) => unknown;
};

const processors: Processor[] = [
  {
    id: "plan",
    description: `
Create a character design plan including:

- Color Scheme
- Character Concept
- Scenario
- Detailed Description
`,
    inputType: "string",
    outputType: "string",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Generate plan
       * @return Character design plan with detailed description, color scheme, scenario and concept.
       */
      return "Character design plan with detailed description, color scheme, scenario and concept.";
    },
  },
  {
    id: "collect-artifacts",
    description:
      "Perform web crawl to collect appropriate data based on the given plan.",
    inputType: "string",
    outputType: "string,imageBase64[]",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Perform web crawling to collect images that is related to the given prompt
       * 3: Contruct output object { output1: string, output2: imageBase64[]}
       * @return { output1: the original character plan, output2: an array of images }
       */
      return {
        output1: "Character Plan",
        output2: [
          {
            base64: "base64ImageString",
          },
        ],
      };
    },
  },
  {
    id: "gen-image",
    description:
      "Generate a character based on the given plan and reference images",
    inputType: "string,imageBase64[]",
    outputType: "imageBase64[]",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Perform image generation based on the given plan and reference images
       * @return generated image
       */
      return [
        {
          base64: "base64ImageString",
        },
      ];
    },
  },
  {
    id: "gen-spread",
    description: `Generate a 4 panels spread comic using the given character as reference. 
Critical insctruction:
- DO NOT alter the character style and color scheme
    `,
    inputType: "imageBase64[]",
    outputType: "imageBase64[]",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Perform spread generation
       * @return generated spread image
       */

      return [
        {
          base64: "base64ImageString",
        },
      ];
    },
  },
  {
    id: "gen-post-copy",
    description:
      "Generate a suitable tag line and copy writing for the instagram post based on the given images",
    inputType: "imageBase64[]",
    outputType: "string,imageBase64[]",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Generate copywriting based on the given details
       * @return { output1: Generated Copy, output2: input images }
       */

      return {
        output1: "Post copy",
        output2: [
          {
            base64: "base64ImageString",
          },
        ],
      };
    },
  },
  {
    id: "post-images",
    description:
      "Connect to instagram api, create a container with the images and copy title to post",
    inputType: "string,imageBase64[]",
    outputType: "response",
    process: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Connect to instagram API
       * 3: Create instagram container with given images and copywriting
       * 4: Send POST request to instagram API to post container
       * @return Instagram API response
       */
      return {
        status: 200,
        message: "Upload successful.",
      };
    },
  },
];

const switcher: Switcher[] = [
  {
    id: "check-validity",
    description: "Checks for inappropriate content in images",
    inputType: "imageBase64[]",
    outputWhenTrue: "imageBase64[]",
    outputWhenFalse: "string",
    check: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Check image validity
       * @return
       * if true: return the original images
       * if false: return the prompt to re-plan
       */

      return [
        {
          base64: "base64ImageString",
        },
      ];
    },
  },
  {
    id: "check-consistency",
    description: `
Check if the character design is consistent based on the provided images.

Check:
- Color Scheme
- Character components such as eye, nose, hands, legs, etc
`,
    inputType: "imageBase64[]",
    outputWhenTrue: "imageBase64[]",
    outputWhenFalse: "string",
    check: () => {
      /**
       * 1: Perform type checking
       * 2: Examine the given image, check if the generated character is consistent
       * @return
       * if true: return the image.
       * if false: return the prompt to fix the character generation.
       */

      return [
        {
          base64: "base64ImageString",
        },
      ];

      // Or
      // return `
      //   Regenerate the image with the following fix:
      //   Fix:
      //     - Color scheme should be #HEX value...
      // `
    },
  },
  {
    id: "check-scheduling",
    description:
      "Check if the content is needed to be scheduled to reach the optimal target audience for user engagement.",
    inputType: "string,imageBase64[]",
    outputWhenTrue: "string,imageBase64[],dateTimeString",
    outputWhenFalse: "string,imageBase64[]",
    check: (medium) => {
      /**
       * 1: Perform type checking
       * 2: Determine if scheduling is needed for the given content
       * @return
       * if true: return an object with { output1: Given post copy, output2: Given images, output3: Best time to post }
       * if false: return an object with { output1: Given post copy, output2: Given images }
       */

      return {
        output1: "Given post copy",
        output2: [
          {
            base64: "base64ImageString",
          },
        ],
        output3: "schedule datetime format",
      };
    },
  },
];
