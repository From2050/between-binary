import * as THREE from "three";
import { civilizationStars } from "../data/civilizationStars";
import {
  destinations,
  overview,
  easeJourney,
  journeyPoints,
  type DestinationId,
} from "./journey";
import { Soundscape } from "./soundscape";

type Place = { hitBox: THREE.Mesh; href: string; hint: string; lights: THREE.PointLight[] };
export function createExploration(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  stars: THREE.Group,
  places: Place[],
) {
  const el = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const card = el("place-card"),
    title = el("place-title"),
    description = el("place-description"),
    eyebrow = el("place-eyebrow");
  const link = el<HTMLAnchorElement>("place-link"),
    status = el("journey-status"),
    intro = el("arrival");
  const sound = new Soundscape();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reduced.matches,
    begun = false,
    selected: DestinationId | null = null;
  let hover: Place | null = null,
    starIndex = -1,
    drag = false,
    moved = false,
    downX = 0,
    downY = 0,
    lastX = 0,
    lastY = 0;
  let yaw = 0,
    pitch = 0;
  let journey: {
    curve: THREE.CatmullRomCurve3;
    from: THREE.Quaternion;
    to: THREE.Quaternion;
    age: number;
    duration: number;
    done: () => void;
  } | null = null;
  const ray = new THREE.Raycaster();
  ray.params.Points = { threshold: 3 };
  const pointer = new THREE.Vector2();
  const tooltip = el("tooltip");
  const starSelect = el<HTMLSelectElement>("star-select");
  civilizationStars.forEach((star, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${star.name} · ${star.year}`;
    starSelect.append(option);
  });
  function syncAngles() {
    const e = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ");
    yaw = e.y;
    pitch = e.x;
  }
  camera.position.fromArray(overview.position);
  camera.lookAt(new THREE.Vector3(...overview.target));
  syncAngles();
  function clearCard() {
    card.hidden = true;
    el("star-picker").hidden = true;
  }
  function announce(message: string) {
    status.textContent = message;
  }
  function move(
    position: readonly number[],
    target: readonly number[],
    done: () => void,
  ) {
    clearCard();
    hover = null;
    tooltip.hidden = true;
    el("star-focus").hidden = true;
    const end = new THREE.Vector3(...position);
    const ghost = camera.clone();
    ghost.position.copy(end);
    ghost.lookAt(new THREE.Vector3(...target));
    if (paused || camera.position.distanceTo(end) < 0.1) {
      camera.position.copy(end);
      camera.quaternion.copy(ghost.quaternion);
      syncAngles();
      journey = null;
      done();
      return;
    }
    const from = camera.position.clone();
    const route = journeyPoints(from.toArray(), end.toArray()).map(point => new THREE.Vector3(...point));
    const curve=new THREE.CatmullRomCurve3(route, false, "centripetal");
    journey = {
      curve,
      from: camera.quaternion.clone(),
      to: ghost.quaternion.clone(),
      age: 0,
      duration: Math.min(18, Math.max(2.8, curve.getLength() / 1.9)),
      done,
    };
  }
  function showDestination(id: DestinationId) {
    const d = destinations[id];
    eyebrow.textContent = `${d.number} / ${d.collection}`;
    title.textContent = d.title;
    description.textContent = d.description;
    link.href = d.href;
    link.textContent = `${d.action} ↗`;
    card.hidden = false;
    el("star-picker").hidden = id !== "sky";
    announce(
      `You are at ${d.name.toLowerCase()}. Stay a while, or return to the clearing.`,
    );
  }
  function visit(id: DestinationId) {
    if (!begun) return;
    selected = id;
    el("return-clearing").hidden = false;
    el<HTMLDetailsElement>("field-guide").open = false;
    document
      .querySelectorAll<HTMLButtonElement>("[data-destination]")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.destination === id),
        ),
      );
    announce(`Following the path to ${destinations[id].name.toLowerCase()}…`);
    move(destinations[id].position, destinations[id].target, () =>
      showDestination(id),
    );
    canvas.focus({ preventScroll: true });
  }
  function showStar(index: number) {
    const star = civilizationStars[index];
    if (!star) return;
    journey = null;
    syncAngles();
    tooltip.hidden = true;
    el("star-focus").hidden = true;
    clearCard();
    eyebrow.textContent = `Civilization / ${star.year}`;
    title.textContent = star.name;
    description.textContent = `${star.role}. ${star.desc}`;
    link.href = "/lab/civilization-star-map/";
    link.textContent = "About this constellation ↗";
    card.hidden = false;
    el("star-picker").hidden = false;
    starSelect.value = String(index);
    announce(
      `Selected ${star.name}. Read their contribution in the information panel.`,
    );
  }
  function returnToPath() {
    selected = null;
    el<HTMLDetailsElement>("field-guide").open = false;
    announce("Returning to the front clearing…");
    document
      .querySelectorAll("[data-destination]")
      .forEach((button) => button.setAttribute("aria-pressed", "false"));
    move(overview.position, overview.target, () => {
      el("return-clearing").hidden = true;
      announce("Back in the clearing. Click the fire, the house, or a bright star.");
    });
    canvas.focus({ preventScroll: true });
  }
  async function toggleSound() {
    try {
      const on = await sound.toggle();
      const button = el<HTMLButtonElement>("sound-toggle");
      button.setAttribute("aria-pressed", String(on));
      button.textContent = on ? "Sound on" : "Sound off";
    } catch {
      announce(
        "Sound is unavailable in this browser. You can keep exploring quietly.",
      );
    }
  }
  function enter(withSound: boolean) {
    begun = true;
    intro.hidden = true;
    el("world-controls").hidden = false;
    el("wayfinding").hidden = false;
    announce(
      "Drag to look around. Click the fire or the house. Some stars have stories, too.",
    );
    canvas.focus({ preventScroll: true });
    if (withSound) void toggleSound();
  }
  el("enter-quiet").addEventListener("click", () => enter(false));
  el("enter-sound").addEventListener("click", () => enter(true));
  el("sound-toggle").addEventListener("click", toggleSound);
  el<HTMLInputElement>("volume").addEventListener("input", (e) =>
    sound.setVolume(Number((e.target as HTMLInputElement).value) / 100),
  );
  document.addEventListener("world-audio-unavailable", () => {
    el("sound-toggle").setAttribute("aria-pressed", "false");
    el("sound-toggle").textContent = "Sound off";
    announce("Music is paused. Use Sound on to resume.");
  });
  const pauseButton = el<HTMLButtonElement>("motion-toggle");
  function syncPause() {
    pauseButton.setAttribute("aria-pressed", String(paused));
    pauseButton.textContent = paused ? "Motion paused" : "Pause motion";
  }
  syncPause();
  pauseButton.addEventListener("click", () => {
    paused = !paused;
    syncPause();
    if (paused && journey) {
      const j = journey;
      journey = null;
      camera.position.copy(j.curve.getPoint(1));
      camera.quaternion.copy(j.to);
      syncAngles();
      j.done();
    }
  });
  reduced.addEventListener("change", (e) => {
    paused = e.matches;
    syncPause();
    if (paused && journey) {
      const j = journey;
      journey = null;
      camera.position.copy(j.curve.getPoint(1));
      camera.quaternion.copy(j.to);
      syncAngles();
      j.done();
    }
    window.dispatchEvent(new Event("input"));
  });
  document
    .querySelectorAll<HTMLButtonElement>("[data-destination]")
    .forEach((button) =>
      button.addEventListener("click", () =>
        visit(button.dataset.destination as DestinationId),
      ),
    );
  el("return-path").addEventListener("click", returnToPath);
  el("return-clearing").addEventListener("click", returnToPath);
  el("close-card").addEventListener("click", () => {
    clearCard();
    canvas.focus({ preventScroll: true });
  });
  starSelect.addEventListener("change", () =>
    showStar(Number(starSelect.value)),
  );
  el("next-star").addEventListener("click", () =>
    showStar(
      starSelect.value === ""
        ? 0
        : (Number(starSelect.value) + 1) % civilizationStars.length,
    ),
  );
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && begun) {
      returnToPath();
      canvas.focus({ preventScroll: true });
    }
  });
  canvas.addEventListener("keydown", (e) => {
    if (
      !begun ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    journey = null;
    yaw += e.key === "ArrowLeft" ? 0.07 : e.key === "ArrowRight" ? -0.07 : 0;
    pitch += e.key === "ArrowUp" ? 0.05 : e.key === "ArrowDown" ? -0.05 : 0;
    pitch = Math.max(-0.35, Math.min(1.25, pitch));
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  });
  function pick(x: number, y: number) {
    pointer.set((x / innerWidth) * 2 - 1, (-y / innerHeight) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    hover = null;
    starIndex = -1;
    let closest = Infinity;
    for (const place of places) {
      const hit = ray.intersectObject(place.hitBox, false)[0];
      if (hit && hit.distance < closest) {
        closest = hit.distance;
        hover = place;
      }
    }
    const focus = el("star-focus");
    focus.hidden = true;
    if (!hover) {
      const points = stars.getObjectByName("civ-stars") as THREE.Points;
      const positions = points.geometry.attributes.position;
      let best = matchMedia("(pointer: coarse)").matches ? 26 : 18;
      for (let i=0;i<positions.count;i++) {
        const v = new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(points.matrixWorld).project(camera);
        if (v.z < -1 || v.z > 1) continue;
        const sx=(v.x+1)*innerWidth/2, sy=(1-v.y)*innerHeight/2;
        const distance=Math.hypot(x-sx,y-sy);
        if (distance < best) {
          best=distance; starIndex=i;
          focus.style.left=`${sx}px`; focus.style.top=`${sy}px`;
        }
      }
      focus.hidden=starIndex<0;
    }
    tooltip.hidden = !hover && starIndex < 0;
    if (!tooltip.hidden) {
      el("tooltip-name").textContent = hover
        ? `${destinations[hover.href === "/thoughts/" ? "fire" : hover.href === "/garden/" ? "grove" : "workshop"].name} · Approach`
        : civilizationStars[starIndex].name;
      el("tooltip-role").textContent = hover
        ? "Stay a while before you read"
        : civilizationStars[starIndex].role;
      tooltip.style.left = `${Math.max(12, Math.min(x + 18, innerWidth - 270))}px`;
      tooltip.style.top = `${Math.min(y + 18, innerHeight - 100)}px`;
    }
    canvas.style.cursor = hover || starIndex >= 0 ? "pointer" : "grab";
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (!begun) return;
    el("star-focus").hidden = true;
    drag = true;
    moved = false;
    downX = lastX = e.clientX;
    downY = lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    tooltip.hidden = true;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!begun) return;
    if (drag) {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) <= 6 && !moved) return;
      if (journey) {
        journey = null;
        syncAngles();
        announce(
          "The walk is paused. Look around, or choose a place to continue.",
        );
      }
      yaw += (e.clientX - lastX) * 0.003;
      pitch += (e.clientY - lastY) * 0.0025;
      pitch = Math.max(-0.35, Math.min(1.25, pitch));
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      lastX = e.clientX;
      lastY = e.clientY;
      moved ||= Math.hypot(e.clientX - downX, e.clientY - downY) > 6;
      canvas.style.cursor = "grabbing";
    } else if (!journey) pick(e.clientX, e.clientY);
  });
  canvas.addEventListener("pointerup", (e) => {
    drag = false;
    canvas.style.cursor = "grab";
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    drag = false;
    moved = true;
  });
  canvas.addEventListener("pointerleave", () => {
    if (!drag) {
      hover = null;
      tooltip.hidden = true;
      el("star-focus").hidden = true;
    }
  });
  canvas.addEventListener("click", (e) => {
    if (!begun || moved) return;
    pick(e.clientX, e.clientY);
    if (hover)
      visit(
        hover.href === "/thoughts/"
          ? "fire"
          : hover.href === "/garden/"
            ? "grove"
            : "workshop",
      );
    else if (starIndex >= 0) showStar(starIndex);
  });
  document.addEventListener("visibilitychange", () =>
    sound.visibility(document.hidden),
  );
  window.addEventListener("pagehide", () => sound.dispose(), { once: true });
  let audioTick = 0;
  return {
    dispose() {
      sound.dispose();
    },
    get paused() {
      return paused || !begun;
    },
    get hoveredPlace() {
      return hover;
    },
    update(dt: number) {
      if (journey) {
        journey.age += dt;
        const k = easeJourney(journey.age / journey.duration);
        camera.position.copy(journey.curve.getPointAt(k));
        camera.quaternion.slerpQuaternions(journey.from, journey.to, k);
        if (k >= 1) {
          const done = journey.done;
          journey = null;
          syncAngles();
          done();
        }
      }
      audioTick += dt;
      if (audioTick > 0.15) {
        audioTick = 0;
        const toFire = new THREE.Vector3(-1, 1.7, -5).sub(camera.position);
        const distance = toFire.length();
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(
          camera.quaternion,
        );
        sound.proximity(distance, right.dot(toFire.normalize()));
      }
    },
  };
}
