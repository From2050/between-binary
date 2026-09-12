import * as THREE from "three";
import { overview } from "./journey.ts";

const delay = 0.8;
const cameraDuration = 4.5;
const titleDelay = 1.4;
const titleDuration = 8;

function restingRotation(camera: THREE.PerspectiveCamera) {
  const view = camera.clone();
  view.position.fromArray(overview.position);
  view.lookAt(new THREE.Vector3(...overview.target));
  return view.quaternion.clone();
}

/** Keep the welcome screen and first frame of the opening at the same viewpoint. */
export function setOpeningView(camera: THREE.PerspectiveCamera, still: boolean) {
  camera.position.fromArray(overview.position);
  camera.quaternion.copy(restingRotation(camera));
  if (!still) {
    const angles = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    camera.rotation.set(-0.85, angles.y - 0.2, 0, "YXZ");
  }
}

/** One frame clock owns the reveal; background tabs cannot consume its duration. */
export class OpeningSequence {
  private elapsed = 0;
  private from: THREE.Quaternion;
  private to: THREE.Quaternion;
  active = true;
  opacity = 0;

  private camera: THREE.PerspectiveCamera;
  private still: boolean;

  constructor(camera: THREE.PerspectiveCamera, still: boolean) {
    this.camera = camera;
    this.still = still;
    setOpeningView(camera, still);
    this.from = camera.quaternion.clone();
    this.to = restingRotation(camera);
    this.opacity = still ? 1 : 0;
  }

  reduceMotion() {
    this.still = true;
    this.camera.quaternion.copy(this.to);
    this.opacity = 1;
  }

  finish(settle = true) {
    if (!this.active) return;
    if (settle) this.camera.quaternion.copy(this.to);
    this.active = false;
    this.opacity = 0;
  }

  update(dt: number) {
    if (!this.active) return;
    this.elapsed += Math.max(0, dt);
    if (!this.still) {
      const t = THREE.MathUtils.clamp((this.elapsed - delay) / cameraDuration, 0, 1);
      const k = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.camera.quaternion.slerpQuaternions(this.from, this.to, k);
      const title = (this.elapsed - titleDelay) / titleDuration;
      const ramp = (x: number) => {
        const k = THREE.MathUtils.clamp(x, 0, 1);
        return k * k * (3 - 2 * k);
      };
      this.opacity = ramp(title / 0.22) * ramp((1 - title) / 0.28);
    }
    if (this.elapsed >= titleDelay + titleDuration) this.finish();
  }
}
