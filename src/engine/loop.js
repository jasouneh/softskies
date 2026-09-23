export class GameLoop {
  constructor({ update = () => {}, render = () => {}, maxDelta = 0.05 } = {}) {
    this.update = update;
    this.render = render;
    this.maxDelta = maxDelta;
    this.running = false;
    this.frameId = 0;
    this.lastTime = 0;
    this.elapsed = 0;
    this.frame = this.frame.bind(this);
  }

  start() {
    if (this.running) {
      return;
    }
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.frame);
  }

  stop() {
    if (!this.running) {
      return;
    }
    this.running = false;
    cancelAnimationFrame(this.frameId);
  }

  frame(now) {
    if (!this.running) {
      return;
    }
    const rawDelta = (now - this.lastTime) / 1000;
    const dt = Math.min(this.maxDelta, Math.max(0, rawDelta));
    this.lastTime = now;
    this.elapsed += dt;

    this.update({ dt, elapsed: this.elapsed, now });
    this.render({ dt, elapsed: this.elapsed, now });
    this.frameId = requestAnimationFrame(this.frame);
  }

  dispose() {
    this.stop();
  }
}
