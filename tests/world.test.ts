import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { destinations, overview, easeJourney, journeyPoints } from "../src/world/journey.ts";
import { starDirections } from "../src/world/celestial.ts";
import { Soundscape } from "../src/world/soundscape.ts";

test("journeys keep camera coordinates valid and ease without overshoot", () => {
  assert.equal(easeJourney(-1), 0);
  assert.equal(easeJourney(2), 1);
  let previous = 0;
  for (let i = 0; i <= 200; i++) {
    const position = easeJourney(i / 200);
    assert.ok(position >= previous && position <= 1);
    previous = position;
  }
  for (const destination of Object.values(destinations)) {
    assert.equal(destination.position[1], 1.7);
    assert.ok(
      [...destination.position, ...destination.target].every(Number.isFinite),
    );
    assert.match(destination.href, /^\/(garden|lab|thoughts)\//);
  }
});

test("recorded music requires consent and remains muted after returning to the tab", async () => {
  const recordings: FakeAudio[] = [];
  class FakeAudio {
    paused=true; volume=0; loop=false; preload=""; src=""; plays=0;
    constructor(src: string) { this.src=src; recordings.push(this); }
    async play() { this.paused=false; this.plays++; }
    pause() { this.paused=true; }
    removeAttribute() { this.src=""; }
    load() {}
  }
  const original=globalThis.Audio;
  globalThis.Audio=FakeAudio as unknown as typeof Audio;
  const sound=new Soundscape();
  try {
    assert.equal(recordings.length,0);
    sound.visibility(false);
    assert.equal(recordings.length,0);
    assert.equal(await sound.toggle(),true);
    assert.match(recordings[0].src,/friday-morning/);
    assert.equal(recordings[0].paused,false);
    sound.visibility(true);
    assert.equal(recordings[0].paused,true);
    sound.visibility(false);
    await Promise.resolve();
    assert.equal(recordings[0].paused,false);
    assert.equal(await sound.toggle(),false);
    sound.visibility(true);
    const plays=recordings[0].plays;
    sound.visibility(false);
    assert.equal(recordings[0].plays,plays);
    assert.equal(recordings[0].paused,true);
    sound.dispose();
    assert.equal(recordings[0].src,"");
  } finally { sound.dispose(); globalThis.Audio=original; }
});

test("a rejected playback can be retried without leaving sound enabled", async () => {
  let attempts=0;
  class RejectedAudio {
    volume=0; preload=""; loop=false;
    async play() { if (++attempts===1) throw new Error("blocked"); }
    pause() {} removeAttribute() {} load() {}
  }
  const original=globalThis.Audio;
  globalThis.Audio=RejectedAudio as unknown as typeof Audio;
  const sound=new Soundscape();
  try {
    await assert.rejects(sound.toggle(),/blocked/);
    assert.equal(await sound.toggle(),true);
    assert.equal(attempts,2);
  } finally { sound.dispose(); globalThis.Audio=original; }
});


test("every garden round trip stays outside the workshop walls", () => {
  const viewpoints = [overview, ...Object.values(destinations)];
  for (const start of viewpoints) for (const end of viewpoints) {
    if (start === end) continue;
    const points = journeyPoints(start.position, end.position).map(point => new THREE.Vector3(...point));
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    assert.deepEqual(curve.getPoint(0).toArray(), [...start.position]);
    const last=curve.getPoint(1);
    assert.ok(last.distanceTo(new THREE.Vector3(...end.position)) < 0.001);
    for (let step=0; step<=200; step++) {
      const point=curve.getPoint(step/200);
      assert.ok(!(point.x > -12 && point.x < -4 && point.z < -11.5 && point.z > -19.5), "camera must not enter the cabin during either direction of travel");
    }
  }
});


test("civilization stars have repeatable irregular directions instead of elevation rows", () => {
  const directions=starDirections(45);
  assert.deepEqual(directions,starDirections(45));
  assert.notDeepEqual(directions,starDirections(45,81));
  assert.equal(directions.length,45);
  assert.equal(new Set(directions.map(point=>point[1].toFixed(6))).size,45);
  for(const point of directions) {
    assert.ok(Math.abs(Math.hypot(...point)-1)<1e-8);
    assert.ok(point[1]>=.2 && point[1]<.97);
  }
});


// A visitor should see travelling gusts, with nearby plants responding together.
import { sampleWind } from "../src/world/wind.ts";
test("wind varies in time, remains spatially coherent and keeps a stable direction", () => {
  let min=Infinity,max=0;
  for(let t=0;t<120;t+=.25) {
    const wind=sampleWind(t,3,-7),near=sampleWind(t,3.1,-7.1);
    assert.ok(Number.isFinite(wind.x) && Number.isFinite(wind.z));
    assert.ok(wind.x>0 && wind.x<1 && wind.z>0 && wind.z<1);
    assert.ok(Math.abs(wind.x*.45-wind.z*.89)<1e-12);
    assert.ok(Math.hypot(wind.x-near.x,wind.z-near.z)<.01);
    min=Math.min(min,wind.x);max=Math.max(max,wind.x);
  }
  assert.ok(max-min>.5,"gusts must have visible lulls and peaks");
  assert.deepEqual(sampleWind(42,3,-7),sampleWind(42,3,-7));
});


import { forestTrees } from "../src/world/forest.ts";
test("new forest trunks leave every visitor route open", () => {
  const views=[overview,...Object.values(destinations)];
  for(const start of views) for(const end of views) {
    if(start===end)continue;
    const curve=new THREE.CatmullRomCurve3(journeyPoints(start.position,end.position).map(p=>new THREE.Vector3(...p)),false,"centripetal");
    for(let step=0;step<=160;step++) {
      const p=curve.getPointAt(step/160);
      for(const [x,z,scale] of forestTrees) assert.ok(Math.hypot(p.x-x,p.z-z)>.65*scale+.3,"route must clear trunk and visitor shoulder width");
    }
  }
});


import { terrainHeight, lakeLevel } from "../src/world/terrain.ts";
test("lake basin is submerged while all visitor routes remain on the dry shelf", () => {
  assert.ok(terrainHeight(180,-180)<lakeLevel-2);
  const views=[overview,...Object.values(destinations)];
  for(const start of views) for(const end of views) {
    if(start===end)continue;
    const curve=new THREE.CatmullRomCurve3(journeyPoints(start.position,end.position).map(p=>new THREE.Vector3(...p)),false,"centripetal");
    for(let i=0;i<=150;i++) {
      const p=curve.getPointAt(i/150),floor=terrainHeight(p.x,p.z);
      assert.ok(floor>lakeLevel+4,"visitor route cannot descend into lake");
      assert.ok(Math.abs(floor)<.55,"walking surface must stay close to camera foot level");
    }
  }
});
