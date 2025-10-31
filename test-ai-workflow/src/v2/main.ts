type ImageType = "png" | "jpg" | "webp";

type RelativeFilePath =
  | {
      type: "json";
      path: string;
    }
  | {
      type: "image";
      image_type: ImageType;
      path: string;
    };

type DateTimeStr = string;

type Medium<Shape> = {
  nextId: string;
  value: Shape;
};

type PromptOutput<O> = {
  output: O;
};

type Schedule =
  | {
      needed: true;
      dateTimeString: DateTimeStr;
    }
  | {
      needed: false;
    };

type MediumShape = {
  instructions: string;
  plan: PromptOutput<string>;
  pathToCharacter: PromptOutput<RelativeFilePath>;
  pathToArtifacts: PromptOutput<RelativeFilePath>;
  schedule: Schedule;
};

type Processor<T> = {
  id: string;
  description: string;
  process: (medium: Medium<T>) => Medium<T>["value"];
};

type Switcher<T> = {
  id: string;
  description: string;
  nextIdWhenTrue: string;
  nextIdWhenFalse: string;
};

const processor: Processor<MediumShape>[] = [
  {
    id: "gen-plan",
    description: `
Create a character design plan including the list stated in <requirements> based on the prompt.

<requirements>
- Color Scheme
- Character Concept
- Scenario
- Detailed Description
</requirements>

<output_format>
MUST be a string
</output_format>
`,
    process: (medium) => {
      const userPrompt = medium.value.instructions;

      if (!userPrompt) {
        throw new Error("Missing user instructions")
      }
      // const client = await client.responses.create({ ... })

      return {
        ...medium.value,
        plan: {
          output: "Blah blah blah",
        },
      };
    },
  },
  {
    id: "gen-main",
    description: `

`,
    process: (medium) => {
      return {
        ...medium.value,
      }
    }
  }
];
