import { clamp } from "../world/generation/noise.js";

const KEY_TO_ACTION = new Map([
  ["KeyW", "pitchDown"],
  ["ArrowUp", "pitchDown"],
  ["KeyS", "pitchUp"],
  ["ArrowDown", "pitchUp"],
  ["KeyA", "turnLeft"],
  ["ArrowLeft", "turnLeft"],
  ["KeyD", "turnRight"],
  ["ArrowRight", "turnRight"],
  ["ShiftLeft", "boost"],
  ["ShiftRight", "boost"],
]);

export function createFlightControls(options = {}) {
  return new FlightControls(options);
}

export class FlightControls {
  constructor({ domElement, ownerDocument = document, mouseSensitivity = 0.0024 } = {}) {
    if (!domElement) {
      throw new Error("FlightControls requires a domElement.");
    }
    this.domElement = domElement;
    this.ownerDocument = ownerDocument;
    this.mouseSensitivity = mouseSensitivity;
    this.keys = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.pointerLocked = false;

    this.onClick = this.onClick.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onBlur = this.onBlur.bind(this);

    domElement.addEventListener("click", this.onClick);
    ownerDocument.addEventListener("keydown", this.onKeyDown);
    ownerDocument.addEventListener("keyup", this.onKeyUp);
    ownerDocument.addEventListener("mousemove", this.onMouseMove);
    ownerDocument.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("blur", this.onBlur);
  }

  snapshot() {
    const pitchKeyboard = (this.hasAction("pitchUp") ? 1 : 0) - (this.hasAction("pitchDown") ? 1 : 0);
    const yawKeyboard = (this.hasAction("turnRight") ? 1 : 0) - (this.hasAction("turnLeft") ? 1 : 0);
    const mouseYawDelta = -this.mouseX * this.mouseSensitivity;
    const mousePitchDelta = -this.mouseY * this.mouseSensitivity;
    this.mouseX = 0;
    this.mouseY = 0;

    return {
      pitch: clamp(pitchKeyboard, -1, 1),
      yaw: clamp(yawKeyboard, -1, 1),
      roll: clamp(yawKeyboard, -1, 1),
      throttle: 0,
      boost: this.hasAction("boost"),
      mouseYawDelta,
      mousePitchDelta,
      pointerLocked: this.pointerLocked,
    };
  }

  hasAction(action) {
    for (const [code, mappedAction] of KEY_TO_ACTION) {
      if (mappedAction === action && this.keys.has(code)) {
        return true;
      }
    }
    return false;
  }

  onClick() {
    if (this.ownerDocument.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock?.();
    }
  }

  onKeyDown(event) {
    if (!KEY_TO_ACTION.has(event.code)) {
      return;
    }
    this.keys.add(event.code);
    event.preventDefault();
  }

  onKeyUp(event) {
    if (!KEY_TO_ACTION.has(event.code)) {
      return;
    }
    this.keys.delete(event.code);
    event.preventDefault();
  }

  onMouseMove(event) {
    if (this.ownerDocument.pointerLockElement !== this.domElement) {
      return;
    }
    this.mouseX += event.movementX || 0;
    this.mouseY += event.movementY || 0;
  }

  onPointerLockChange() {
    this.pointerLocked = this.ownerDocument.pointerLockElement === this.domElement;
    if (!this.pointerLocked) {
      this.mouseX = 0;
      this.mouseY = 0;
    }
  }

  onBlur() {
    this.keys.clear();
    this.mouseX = 0;
    this.mouseY = 0;
  }

  dispose() {
    this.domElement.removeEventListener("click", this.onClick);
    this.ownerDocument.removeEventListener("keydown", this.onKeyDown);
    this.ownerDocument.removeEventListener("keyup", this.onKeyUp);
    this.ownerDocument.removeEventListener("mousemove", this.onMouseMove);
    this.ownerDocument.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("blur", this.onBlur);
  }
}
