export class FrameAnimator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frames: HTMLImageElement[] = [];
  private currentFrame: number = 0;
  private lastFrameTime: number = 0;
  private animationId: number | null = null;
  private isLoaded: boolean = false;
  private frameDelay: number = 100; // Default 100ms per frame

  constructor(canvas: HTMLCanvasElement, framesData: Record<string, string>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.loadFrames(framesData);
  }

  private async loadFrames(framesData: Record<string, string>) {
    const frameKeys = Object.keys(framesData).sort();
    const loadPromises = frameKeys.map((key) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load frame ${key}`));
        // Handle base64 with or without data URI prefix
        const base64 = framesData[key];
        img.src = base64.startsWith("data:")
          ? base64
          : `data:image/png;base64,${base64}`;
      });
    });

    try {
      this.frames = await Promise.all(loadPromises);
      this.isLoaded = true;

      if (this.frames.length > 0) {
        // Set canvas size to 50% of first frame
        const scale = 0.5;
        this.canvas.width = this.frames[0].width * scale;
        this.canvas.height = this.frames[0].height * scale;

        console.log("Frames loaded:", {
          totalFrames: this.frames.length,
          originalSize: `${this.frames[0].width}x${this.frames[0].height}`,
          canvasSize: `${this.canvas.width}x${this.canvas.height}`,
          frameDelay: this.frameDelay,
        });

        this.drawFrame();
      }
    } catch (error) {
      console.error("Error loading frames:", error);
    }
  }

  private animate = (timestamp: number) => {
    if (!this.isLoaded || this.frames.length === 0) return;

    if (timestamp - this.lastFrameTime >= this.frameDelay) {
      this.lastFrameTime = timestamp;
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
      this.drawFrame();
    }

    this.animationId = requestAnimationFrame(this.animate);
  };

  private drawFrame() {
    if (!this.isLoaded || this.frames.length === 0) return;

    const frame = this.frames[this.currentFrame];

    // Clear canvas and fill with white background
    this.ctx.fillStyle = "white";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Disable image smoothing for crisp rendering
    this.ctx.imageSmoothingEnabled = false;

    // Draw the current frame
    this.ctx.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height);
  }

  public start() {
    if (!this.animationId && this.isLoaded) {
      this.lastFrameTime = performance.now();
      this.animationId = requestAnimationFrame(this.animate);
    }
  }

  public stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  public reset() {
    this.currentFrame = 0;
    if (this.isLoaded) {
      this.drawFrame();
    }
  }

  public setFrameDelay(delayMs: number) {
    this.frameDelay = Math.max(1, delayMs); // Minimum 1ms
  }

  public getFrameDelay(): number {
    return this.frameDelay;
  }

  public isReady(): boolean {
    return this.isLoaded;
  }

  public getTotalFrames(): number {
    return this.frames.length;
  }

  public getCurrentFrame(): number {
    return this.currentFrame + 1; // Return 1-indexed for display
  }
}
