import "./style.css";
import { FrameAnimator } from "./frame-animator";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>Frame Animation Player</h1>
    <div class="animation-container">
      <canvas id="animation-canvas"></canvas>
    </div>
    <div class="controls">
      <button id="play-btn" type="button">Play</button>
      <button id="stop-btn" type="button">Stop</button>
      <button id="reset-btn" type="button">Reset</button>
    </div>
    <div class="delay-control">
      <label for="delay-slider">
        Frame Delay: <span id="delay-value">100</span>ms
      </label>
      <input
        id="delay-slider"
        type="range"
        min="10"
        max="1000"
        value="100"
        step="10"
      />
    </div>
    <div class="frame-info">
      <p id="frame-counter">Frame: 1 / 0</p>
    </div>
  </div>
`;

// Load frames data and initialize animator
let animator: FrameAnimator | null = null;

fetch("/frames.json")
  .then((response) => response.json())
  .then((framesData: Record<string, string>) => {
    const canvas = document.querySelector<HTMLCanvasElement>("#animation-canvas")!;
    animator = new FrameAnimator(canvas, framesData);

    // Setup controls after animator is ready
    setupControls();

    // Start animation automatically
    setTimeout(() => {
      if (animator?.isReady()) {
        animator.start();
        updateFrameCounter();
      }
    }, 100);
  })
  .catch((error) => {
    console.error("Error loading frames:", error);
    document.querySelector("#app")!.innerHTML = `
      <div>
        <h1>Error</h1>
        <p>Failed to load frames.json. Please run the test to generate frames first.</p>
      </div>
    `;
  });

function setupControls() {
  const playBtn = document.querySelector<HTMLButtonElement>("#play-btn")!;
  const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn")!;
  const resetBtn = document.querySelector<HTMLButtonElement>("#reset-btn")!;
  const delaySlider = document.querySelector<HTMLInputElement>("#delay-slider")!;
  const delayValue = document.querySelector<HTMLSpanElement>("#delay-value")!;

  playBtn.addEventListener("click", () => {
    animator?.start();
  });

  stopBtn.addEventListener("click", () => {
    animator?.stop();
  });

  resetBtn.addEventListener("click", () => {
    animator?.reset();
    updateFrameCounter();
  });

  delaySlider.addEventListener("input", (e) => {
    const delay = parseInt((e.target as HTMLInputElement).value);
    delayValue.textContent = delay.toString();
    animator?.setFrameDelay(delay);
  });
}

function updateFrameCounter() {
  setInterval(() => {
    if (animator?.isReady()) {
      const frameCounter = document.querySelector<HTMLParagraphElement>("#frame-counter");
      if (frameCounter) {
        frameCounter.textContent = `Frame: ${animator.getCurrentFrame()} / ${animator.getTotalFrames()}`;
      }
    }
  }, 50);
}

updateFrameCounter();
