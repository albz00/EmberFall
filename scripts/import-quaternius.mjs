// Rebuild the CC0 Universal Animation Library subset and offline fighter retarget.
// Usage: node scripts/import-quaternius.mjs --source /path/to/UAL1_Standard.glb
// Add --all for every character, or --target avatar-robot.glb for one rig.
// The default source is the retained, mesh-free animation subset.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as THREE from '../dist/vendor/three.module.js';
import { GLTFLoader } from '../dist/vendor/GLTFLoader.js';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(project, 'dist/assets');
const sourcePath = process.argv.includes('--source') ? process.argv[process.argv.indexOf('--source') + 1] : path.join(assets, 'quaternius-source.glb');
const diagnosticPath = process.argv.includes('--diagnostics') ? process.argv[process.argv.indexOf('--diagnostics') + 1] : null;
const targetAsset = process.argv.includes('--target') ? process.argv[process.argv.indexOf('--target') + 1] : 'fighter-adventurer.glb';
const assetStem = targetAsset.startsWith('fighter-') ? 'fighter' : targetAsset.replace(/\.glb$/, '');
const animationAsset = `quaternius-${assetStem}-animations.glb`;
const targetAssets = ['fighter-adventurer.glb', 'actor-knight.glb', 'avatar-adventurer.glb', 'avatar-astronaut.glb', 'avatar-mask.glb', 'avatar-pirate.glb', 'avatar-robot.glb', 'avatar-skeleton.glb', 'avatar-tribal.glb', 'avatar-wizard.glb'];
const characterAnimationAssets = Object.fromEntries([...targetAssets, 'fighter-king.glb', 'fighter-punk.glb'].map(file => [file, `quaternius-${file.startsWith('fighter-') ? 'fighter' : file.replace(/\.glb$/, '')}-animations.glb`]));
if (process.argv.includes('--all')) {
  for (const file of targetAssets) {
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--source', sourcePath, '--target', file], { encoding: 'utf8' });
    if (run.status) throw new Error(run.stderr || run.stdout);
    console.log(file + ' -> ' + characterAnimationAssets[file]);
  }
  process.exit(0);
}
// Only motions included in the official free Standard archive are retained.
// Keeping the original ten first also keeps their exported data reproducible.
const selected = [
  'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start',
  'Jump_Loop', 'Jump_Land', 'Sword_Idle', 'Sword_Attack', 'Hit_Chest',
  'Crouch_Fwd_Loop', 'Crouch_Idle_Loop', 'Dance_Loop', 'Death01',
  'Hit_Head', 'Idle_Talking_Loop', 'Interact', 'PickUp_Table', 'Roll',
  'Spell_Simple_Enter', 'Spell_Simple_Exit', 'Spell_Simple_Idle_Loop',
  'Spell_Simple_Shoot', 'Walk_Formal_Loop',
];
const V = THREE.Vector3, Q = THREE.Quaternion, M = THREE.Matrix4;
const round = n => Math.round(n * 1e6) / 1e6;
const sizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function readGlb(buffer) {
  const bytes = Buffer.from(buffer); let offset = 12, json, bin;
  while (offset < bytes.length) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) json = JSON.parse(bytes.subarray(offset + 8, offset + 8 + length));
    if (type === 0x004e4942) bin = bytes.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length;
  }
  return { json, bin, bytes };
}
function accessorData(g, index) {
  const a = g.json.accessors[index], view = g.json.bufferViews[a.bufferView];
  if (a.componentType !== 5126 || a.sparse) throw new Error('Only dense float accessors are expected.');
  const size = sizes[a.type], data = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let j = 0; j < size; j++) data[i * size + j] = g.bin.readFloatLE((view.byteOffset || 0) + (a.byteOffset || 0) + i * (view.byteStride || size * 4) + j * 4);
  return data;
}
function sceneOnly(g) {
  const json = structuredClone(g.json);
  for (const key of ['meshes', 'materials', 'textures', 'images', 'samplers', 'animations', 'accessors', 'bufferViews', 'buffers', 'extensionsUsed', 'extensionsRequired']) delete json[key];
  for (const node of json.nodes) { delete node.mesh; delete node.skin; }
  json.asset = { version: '2.0', generator: 'Emberfall offline Quaternius import (see scripts/import-quaternius.mjs)', copyright: 'Quaternius, Universal Animation Library Standard, CC0-1.0' };
  return json;
}
function writer(json) {
  const binary = [], cache = new Map(); let length = 0;
  json.accessors = []; json.bufferViews = []; json.animations = [];
  function add(data, type, limits = false) {
    const values = Float32Array.from(data), bytes = Buffer.from(values.buffer);
    const key = type + ':' + bytes.toString('base64');
    if (cache.has(key)) return cache.get(key);
    const view = json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length }) - 1;
    binary.push(bytes); length += bytes.length;
    const a = { bufferView: view, componentType: 5126, count: values.length / sizes[type], type };
    if (limits) { a.min = [Math.min(...values)]; a.max = [Math.max(...values)]; }
    const index = json.accessors.push(a) - 1; cache.set(key, index); return index;
  }
  function addTrack(anim, node, property, times, values, interpolation = 'LINEAR') {
    const type = property === 'rotation' ? 'VEC4' : 'VEC3', size = sizes[type];
    // Exporters bake constants at 30 fps. Keeping the endpoints is lossless to
    // one millionth of a unit and preserves their duration and binding.
    let constant = true;
    for (let i = size; i < values.length; i++) if (Math.abs(values[i] - values[i % size]) > 1e-7) { constant = false; break; }
    if (constant && times.length > 2 && interpolation !== 'CUBICSPLINE') {
      times = [times[0], times[times.length - 1]];
      values = [...values.slice(0, size), ...values.slice(0, size)];
    }
    const sampler = anim.samplers.push({ input: add(times, 'SCALAR', true), output: add(values, type), interpolation }) - 1;
    anim.channels.push({ sampler, target: { node, path: property } });
  }
  function finish() {
    json.buffers = [{ byteLength: length }];
    let head = Buffer.from(JSON.stringify(json)); head = Buffer.concat([head, Buffer.alloc((4 - head.length % 4) % 4, 32)]);
    const body = Buffer.concat(binary), total = 12 + 8 + head.length + 8 + body.length;
    const header = Buffer.alloc(12), jc = Buffer.alloc(8), bc = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(total, 8);
    jc.writeUInt32LE(head.length); jc.writeUInt32LE(0x4e4f534a, 4); bc.writeUInt32LE(body.length); bc.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jc, head, bc, body]);
  }
  return { add, addTrack, finish };
}
async function load(g) {
  const loader = new GLTFLoader();
  // Texture pixels are irrelevant to animation baking and have browser-only
  // decoding paths. Mesh geometry remains available for pose diagnostics.
  loader.register(() => ({ name: 'OFFLINE_TEXTURE_STUB', loadTexture: () => Promise.resolve(new THREE.Texture()) }));
  return await new Promise((resolve, reject) => loader.parse(g.bytes.buffer.slice(g.bytes.byteOffset, g.bytes.byteOffset + g.bytes.byteLength), '', resolve, reject));
}
function restData(g, gltf) {
  const skin = g.json.skins[0], ibm = accessorData(g, skin.inverseBindMatrices), byName = new Map(), byNode = new Map();
  skin.joints.forEach((index, i) => {
    const node = g.json.nodes[index], name = THREE.PropertyBinding.sanitizeNodeName(node.name), bone = gltf.scene.getObjectByName(name);
    if (!bone) throw new Error('Missing bone: ' + name);
    const world = new M().fromArray(ibm, i * 16).invert(), p = new V(), q = new Q(), s = new V(); world.decompose(p, q, s);
    const item = { name, originalName: node.name, node: index, bone, world, worldP: p, worldQ: q, worldS: s };
    byName.set(name, item); byNode.set(index, item);
  });
  // The model nodes store an arbitrary animation pose; inverse bind matrices
  // provide the actual reference pose. Do not use the imported node rotation.
  for (const item of byName.values()) {
    const parent = byName.get(item.bone.parent?.name);
    const local = parent ? parent.world.clone().invert().multiply(item.world) : item.world.clone();
    item.p = new V(); item.q = new Q(); item.s = new V(); local.decompose(item.p, item.q, item.s);
  }
  return { byName, byNode, ordered: [...byName.values()] };
}
function resetRest(rest) {
  for (const t of rest.ordered) { t.bone.position.copy(t.p); t.bone.quaternion.copy(t.q); t.bone.scale.copy(t.s); }
}

const source = readGlb(await fs.readFile(sourcePath)), targetPath = path.join(assets, targetAsset);
const target = readGlb(await fs.readFile(targetPath));
const [sourceGltf, targetGltf] = await Promise.all([load(source), load(target)]);
const sr = restData(source, sourceGltf), tr = restData(target, targetGltf);
const mapping = { Body: 'pelvis', Torso: 'spine_02', Chest: 'spine_03', Neck: 'neck_01', Head: 'Head' };
if (tr.byName.has('Root')) mapping.Root = 'root';
if (tr.byName.has('Abdomen')) mapping.Abdomen = 'spine_01';
for (const side of ['L', 'R']) {
  const s = side.toLowerCase();
  Object.assign(mapping, { ['Shoulder' + side]: 'clavicle_' + s, ['UpperArm' + side]: 'upperarm_' + s, ['LowerArm' + side]: 'lowerarm_' + s, ['Wrist' + side]: 'hand_' + s, ['UpperLeg' + side]: 'thigh_' + s, ['LowerLeg' + side]: 'calf_' + s, ['Foot' + side]: 'foot_' + s });
  for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) for (let j = 1; j <= 3; j++) if (tr.byName.has(finger + (j + 1) + side)) mapping[finger + (j + 1) + side] = finger.toLowerCase() + '_0' + j + '_' + s;
  for (let j = 1; j <= 3; j++) if (tr.byName.has('Thumb' + j + side)) mapping['Thumb' + j + side] = 'thumb_0' + j + '_' + s;
}
for (const [name, sourceName] of Object.entries(mapping)) if (!tr.byName.has(name) || !sr.byName.has(sourceName)) throw new Error('Rig mapping does not match: ' + name + ' -> ' + sourceName);
const referenceRotations = new Map(tr.ordered.map(t => [t.name, t.worldQ.clone()]));
if (tr.ordered.length === 19) {
  // The smaller character pack mixes A-pose and T-pose reference meshes.
  // Align arm reference directions before transferring source motion; merely
  // reusing the A-pose world rotation folds lowered arms into the torso.
  for (const side of ['L', 'R']) {
    const s = side.toLowerCase();
    for (const [name, child, sourceName, sourceChild] of [['UpperArm' + side, 'LowerArm' + side, 'upperarm_' + s, 'lowerarm_' + s], ['LowerArm' + side, 'Wrist' + side, 'lowerarm_' + s, 'hand_' + s]]) {
      const direction = tr.byName.get(child).worldP.clone().sub(tr.byName.get(name).worldP).normalize();
      const sourceDirection = sr.byName.get(sourceChild).worldP.clone().sub(sr.byName.get(sourceName).worldP).normalize();
      const alignment = new Q().setFromUnitVectors(direction, sourceDirection);
      referenceRotations.set(name, alignment.clone().multiply(tr.byName.get(name).worldQ));
      if (name.startsWith('LowerArm')) referenceRotations.set('Wrist' + side, alignment.multiply(tr.byName.get('Wrist' + side).worldQ));
    }
  }
}
const sourceSubset = sceneOnly(source), sourceWriter = writer(sourceSubset);
for (const skin of sourceSubset.skins) skin.inverseBindMatrices = sourceWriter.add(accessorData(source, source.json.skins[sourceSubset.skins.indexOf(skin)].inverseBindMatrices), 'MAT4');
const sourceStats = [];
for (const name of selected) {
  const original = source.json.animations.find(a => a.name === name);
  if (!original) throw new Error('Missing source clip ' + name);
  const animation = { name, samplers: [], channels: [] }; sourceSubset.animations.push(animation);
  for (const channel of original.channels) {
    const sampler = original.samplers[channel.sampler];
    sourceWriter.addTrack(animation, channel.target.node, channel.target.path, accessorData(source, sampler.input), accessorData(source, sampler.output), sampler.interpolation || 'LINEAR');
  }
  const clip = sourceGltf.animations.find(a => a.name === name);
  sourceStats.push(source.json.extras?.originalClipStats?.find(s => s.name === name) || { name, duration: round(clip.duration), originalTracks: clip.tracks.length, originalKeyframes: clip.tracks.reduce((sum, t) => sum + t.times.length, 0), sourceFrames: Math.max(...clip.tracks.map(t => t.times.length)) });
}
sourceSubset.extras = { originalClipStats: sourceStats, originalSourceSha256: source.json.extras?.originalSourceSha256 || createHash('sha256').update(source.bytes).digest('hex'), originalSourceBytes: source.json.extras?.originalSourceBytes || source.bytes.length };
const subsetBuffer = sourceWriter.finish();

const output = sceneOnly(target), out = writer(output);
if (targetAsset === 'actor-knight.glb') output.asset.copyright += '; target Knight rig adapted from Dawid2K, CC-BY-3.0, https://poly.pizza/m/isC73B8SKq (see ANIMATION-CREDITS.txt and V3-CREDITS.txt)';
for (const skin of output.skins) skin.inverseBindMatrices = out.add(accessorData(target, target.json.skins[output.skins.indexOf(skin)].inverseBindMatrices), 'MAT4');
const targetBody = tr.byName.get('Body'), sourcePelvis = sr.byName.get('pelvis');
const sourceLeg = sr.byName.get('thigh_l').worldP.distanceTo(sr.byName.get('calf_l').worldP) + sr.byName.get('calf_l').worldP.distanceTo(sr.byName.get('foot_l').worldP);
const targetLeg = tr.byName.get('UpperLegL').worldP.distanceTo(tr.byName.get('LowerLegL').worldP) + tr.byName.get('LowerLegL').worldP.distanceTo(tr.byName.get('FootL').worldP);
const legScale = targetLeg / sourceLeg;
const footOffsets = {};
for (const side of ['L', 'R']) footOffsets[side] = tr.byName.get('Foot' + side).worldP.clone().applyMatrix4(tr.byName.get('LowerLeg' + side).world.clone().invert());
const mixer = new THREE.AnimationMixer(sourceGltf.scene), stats = [], diagnostics = [];
const sampleBoneNames = ['Body', 'Head', 'UpperArmL', 'LowerArmL', 'WristL', 'UpperArmR', 'LowerArmR', 'WristR', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR'];

for (const name of selected) {
  mixer.stopAllAction(); resetRest(sr); resetRest(tr);
  const clip = sourceGltf.animations.find(a => a.name === name), action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  const frames = Math.round(clip.duration * 30) + 1, times = Float32Array.from({ length: frames }, (_, i) => i * clip.duration / (frames - 1));
  const data = new Map(tr.ordered.map(t => [t.name, { position: [], rotation: [], scale: [] }]));
  const clipStats = { name, duration: round(clip.duration), frames, tracks: tr.ordered.length * 3, boneBounds: { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }, footMinY: Infinity, footMaxY: -Infinity, maxFootSeamError: 0, maxQuaternionError: 0, bodyCorrection: [Infinity, -Infinity] };
  for (let frame = 0; frame < frames; frame++) {
    mixer.setTime(times[frame]); sourceGltf.scene.updateMatrixWorld(true); resetRest(tr); targetGltf.scene.updateMatrixWorld(true);
    // Transfer each animated world-space rotation through both rigs' bind
    // orientations. Parent-local reconstruction handles different bone axes
    // and the target's additional Hips link without changing limb lengths.
    for (const t of tr.ordered) {
      const sourceName = mapping[t.name];
      if (sourceName) {
        const s = sr.byName.get(sourceName), animated = s.bone.getWorldQuaternion(new Q());
        const desired = animated.multiply(s.worldQ.clone().invert()).multiply(referenceRotations.get(t.name));
        const parentQ = t.bone.parent?.getWorldQuaternion(new Q()) || new Q();
        t.bone.quaternion.copy(parentQ.invert().multiply(desired).normalize());
      }
      if (t.name === 'Body') {
        const worldP = sourcePelvis.bone.getWorldPosition(new V()).sub(sourcePelvis.worldP).multiplyScalar(legScale).add(targetBody.worldP);
        t.bone.position.copy(t.bone.parent.worldToLocal(worldP));
      }
      t.bone.updateMatrixWorld(true);
    }
    // The fighter's feet are weighted bones parented directly to Root, not
    // descendants of the shin. Bake their world positions from each shin's
    // bind offset so the feet stay attached through every pose.
    for (const side of ['L', 'R']) {
      const foot = tr.byName.get('Foot' + side).bone, shin = tr.byName.get('LowerLeg' + side).bone;
      const p = footOffsets[side].clone().applyMatrix4(shin.matrixWorld); foot.position.copy(foot.parent.worldToLocal(p)); foot.updateMatrixWorld(true);
    }
    const sourceSupport = Math.min(...['l', 'r'].map(side => sr.byName.get('foot_' + side).bone.getWorldPosition(new V()).y - sr.byName.get('foot_' + side).worldP.y));
    const targetSupport = Math.min(...['L', 'R'].map(side => tr.byName.get('Foot' + side).bone.getWorldPosition(new V()).y - tr.byName.get('Foot' + side).worldP.y));
    // Match source support height while accommodating the fighter's longer
    // lower legs. Preserve genuine air phases instead of pinning feet down.
    const correction = sourceSupport * legScale - targetSupport;
    targetBody.bone.position.y += correction; targetBody.bone.updateMatrixWorld(true);
    for (const side of ['L', 'R']) {
      const foot = tr.byName.get('Foot' + side).bone, shin = tr.byName.get('LowerLeg' + side).bone;
      const desired = footOffsets[side].clone().applyMatrix4(shin.matrixWorld);
      foot.position.copy(foot.parent.worldToLocal(desired.clone())); foot.updateMatrixWorld(true);
      clipStats.maxFootSeamError = Math.max(clipStats.maxFootSeamError, foot.getWorldPosition(new V()).distanceTo(desired));
    }
    targetGltf.scene.updateMatrixWorld(true);
    clipStats.bodyCorrection[0] = Math.min(clipStats.bodyCorrection[0], correction); clipStats.bodyCorrection[1] = Math.max(clipStats.bodyCorrection[1], correction);
    for (const t of tr.ordered) {
      const values = data.get(t.name); values.position.push(...t.bone.position); values.rotation.push(...t.bone.quaternion); values.scale.push(...t.bone.scale);
      const p = t.bone.getWorldPosition(new V());
      if (sampleBoneNames.includes(t.name)) for (let k = 0; k < 3; k++) { clipStats.boneBounds.min[k] = Math.min(clipStats.boneBounds.min[k], p.getComponent(k)); clipStats.boneBounds.max[k] = Math.max(clipStats.boneBounds.max[k], p.getComponent(k)); }
      if (t.name === 'FootL' || t.name === 'FootR') { clipStats.footMinY = Math.min(clipStats.footMinY, p.y); clipStats.footMaxY = Math.max(clipStats.footMaxY, p.y); }
      clipStats.maxQuaternionError = Math.max(clipStats.maxQuaternionError, Math.abs(t.bone.quaternion.length() - 1));
      if (!Number.isFinite(t.bone.position.length() + t.bone.quaternion.length())) throw new Error(name + ': invalid transform');
    }
    if (diagnosticPath && (frame === 0 || frame === Math.round((frames - 1) * .25) || frame === Math.round((frames - 1) * .5) || frame === Math.round((frames - 1) * .75))) {
      const meshes = [];
      targetGltf.scene.traverse(mesh => {
        if (!mesh.isSkinnedMesh) return;
        mesh.skeleton.update(); const attr = mesh.geometry.attributes.position, vertices = [];
        for (let i = 0; i < attr.count; i++) vertices.push(...mesh.applyBoneTransform(i, new V().fromBufferAttribute(attr, i)).applyMatrix4(mesh.matrixWorld));
        meshes.push({ name: mesh.name, vertices, indices: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : Array.from({ length: attr.count }, (_, i) => i), color: mesh.material.color.toArray(), groups: mesh.geometry.groups });
      });
      diagnostics.push({ clip: name, time: round(times[frame]), meshes, bones: Object.fromEntries(sampleBoneNames.map(n => [n, tr.byName.get(n).bone.getWorldPosition(new V()).toArray()])) });
    }
  }
  const animation = { name, samplers: [], channels: [] }; output.animations.push(animation);
  for (const t of tr.ordered) for (const property of ['position', 'rotation', 'scale']) out.addTrack(animation, t.node, property === 'position' ? 'translation' : property, times, data.get(t.name)[property]);
  stats.push(clipStats);
}
const outputBuffer = out.finish();
await fs.writeFile(path.join(assets, 'quaternius-source.glb'), subsetBuffer);
await fs.writeFile(path.join(assets, animationAsset), outputBuffer);
const manifest = {
  source: 'https://quaternius.itch.io/universal-animation-library',
  sourceUploadId: 17958403,
  sourceArchive: 'Universal Animation Library[Standard].zip',
  sourceFile: 'Unreal-Godot/UAL1_Standard.glb',
  sourceRelease: '2026-06-17 archive (Universal Animation Library v3.0)',
  originalSourceSha256: sourceSubset.extras.originalSourceSha256,
  originalSourceBytes: sourceSubset.extras.originalSourceBytes,
  license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  targetRigLicense: targetAsset === 'actor-knight.glb' ? 'CC-BY-3.0 (Knight by Dawid2K; https://poly.pizza/m/isC73B8SKq; see V3-CREDITS.txt)' : 'CC0-1.0 (see CREDITS.txt and V3-CREDITS.txt)',
  rig: assetStem === 'fighter' ? 'fighter-adventurer.glb / fighter-punk.glb / fighter-king.glb (identical inverse bind matrices)' : targetAsset,
  animationAsset, characterAnimationAssets,
  sourceBytes: subsetBuffer.length, targetBytes: outputBuffer.length,
  sourceBones: source.json.skins[0].joints.map(i => source.json.nodes[i].name),
  targetBones: target.json.skins[0].joints.map(i => target.json.nodes[i].name),
  mapping, legScale, armReferenceAligned: tr.ordered.length === 19, clips: sourceStats.map((s, i) => ({ ...s, retarget: stats[i] })),
  notes: ['World bind rotations are transferred and reconstructed in each target parent space.', 'Where present, the extra Hips and finger metacarpal links retain target bind transforms.', 'FootL/FootR receive explicit position tracks derived from the shin and bind offset; this also supports the larger fighter rig with root-parented feet.', 'The 19-bone avatar rigs receive arm reference alignment from their individual bind poses to the source T-pose; their limb lengths and skin bind matrices are preserved.', 'Gameplay controls translation; these are the root-motion-disabled source clips.', 'Use AnimationMixer crossfades and LoopOnce for Jump_Start, Jump_Land, Sword_Attack, Hit_Chest, Hit_Head, Death01, Interact, PickUp_Table, Roll, Spell_Simple_Enter, Spell_Simple_Exit, and Spell_Simple_Shoot.', 'The free Standard source contains only one Sword_Attack and no directional strafe, backward locomotion, or bow clips; no such motions are claimed or synthesized here.', 'Existing +45-degree local wrist-Z correction and +90-degree sword mount keep the idle blade pointing upward and forward on all 12 characters.'],
};
await fs.writeFile(path.join(assets, assetStem === 'fighter' ? 'quaternius-animation-info.json' : `quaternius-${assetStem}-animation-info.json`), JSON.stringify(manifest, (key, value) => typeof value === 'number' ? round(value) : value, 2) + '\n');
if (diagnosticPath) await fs.writeFile(diagnosticPath, JSON.stringify(diagnostics));
console.log(JSON.stringify({ sourceBytes: subsetBuffer.length, targetBytes: outputBuffer.length, legScale, clips: stats }, null, 2));
