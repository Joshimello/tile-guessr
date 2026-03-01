<script lang="ts">
  import { T } from '@threlte/core';
  import * as THREE from 'three';
  import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
  import { getTileTexture, getBackTexture } from './tileTexture.js';
  import { makeToonMaterial } from './toonMaterial.js';

  interface Props {
    x?: number;
    z?: number;
    color: string;
    value: number | null;
    isRevealed?: boolean;
    isInHand?: boolean;
    isOwn?: boolean;
    isTargetable?: boolean;
    isSelected?: boolean;
    onselect?: () => void;
  }

  const {
    x = 0,
    z = 0,
    color,
    value,
    isRevealed = false,
    isInHand = false,
    isOwn = false,
    isTargetable = false,
    isSelected = false,
    onselect,
  }: Props = $props();

  // Flat tiles sit near the table surface; standing tiles are upright
  const posY = $derived(isRevealed || isInHand ? 0.1 : 0.375);
  // Revealed → face-up flat; inHand → face-down flat; otherwise standing
  const rotX = $derived(isRevealed ? -Math.PI / 2 : isInHand ? Math.PI / 2 : 0);

  // Hover tracking — only meaningful for targetable tiles
  let isHovered = $state(false);

  function onPointerEnter() { if (isTargetable) isHovered = true; }
  function onPointerLeave() { isHovered = false; }

  // Outline: visible for targetable or selected tiles
  const showOutline = $derived(isTargetable || isSelected);
  const outlineScale = $derived(
    isSelected  ? 1.10 :
    isHovered   ? 1.12 :
    /* targetable */ 1.055
  );
  const outlineColor = $derived(isSelected ? '#5E81AC' : '#88C0D0');

  // ── Geometry (rounded box, shared across all tile instances) ──────────────
  // Slight bevel radius gives a soft card-like appearance.
  const TILE_GEOM = new RoundedBoxGeometry(0.55, 0.75, 0.2, 4, 0.035);

  // ── Materials ─────────────────────────────────────────────────────────────
  let mesh = $state<THREE.Mesh | undefined>(undefined);
  let _mats: THREE.Material[] = [];

  function buildMaterials(): THREE.Material[] {
    const isDark = color === 'black';
    const bodyHex = isDark ? '#434C5E' : '#ECEFF4';
    const edgeHex = isDark ? '#3B4252' : '#E5E9F0';

    const showValue = (isOwn || isRevealed) && value !== null;
    const frontTex = showValue ? getTileTexture(color, value!) : getBackTexture(color);
    const backTex  = getBackTexture(color);

    // MeshBasicMaterial for face textures — flat/unlit keeps value always readable
    const frontMat = new THREE.MeshBasicMaterial({ map: frontTex });
    const backMat  = new THREE.MeshBasicMaterial({ map: backTex });

    // RoundedBoxGeometry groups: +X, -X, +Y, -Y, +Z (front), -Z (back)
    return [
      makeToonMaterial(bodyHex), // +X side
      makeToonMaterial(bodyHex), // -X side
      makeToonMaterial(edgeHex), // +Y top
      makeToonMaterial(edgeHex), // -Y bottom
      frontMat,                  // +Z front face
      backMat,                   // -Z back face
    ];
  }

  $effect(() => {
    if (!mesh) return;
    mesh.geometry = TILE_GEOM;
    _mats.forEach(m => m.dispose());
    _mats = buildMaterials();
    mesh.material = _mats;
  });

  function handleClick() {
    if (isTargetable) onselect?.();
  }
</script>

<!-- Main tile mesh — geometry set imperatively via $effect -->
<T.Mesh
  bind:ref={mesh}
  position={[x, posY, z]}
  rotation={[rotX, 0, 0]}
  onclick={handleClick}
  onpointerenter={onPointerEnter}
  onpointerleave={onPointerLeave}
/>

<!-- Outline mesh — BackSide scaled-up shell, only for interaction states -->
{#if showOutline}
  <T.Mesh
    position={[x, posY, z]}
    rotation={[rotX, 0, 0]}
    scale={outlineScale}
    geometry={TILE_GEOM}
  >
    <T.MeshBasicMaterial color={outlineColor} side={THREE.BackSide} />
  </T.Mesh>
{/if}
