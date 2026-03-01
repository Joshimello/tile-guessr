<script lang="ts">
  import { T, useCamera, useThrelte } from '@threlte/core';
  import { interactivity } from '@threlte/extras';
  import * as THREE from 'three';
  import Table from './Table.svelte';
  import PlayerSeat from './PlayerSeat.svelte';
  import type { TileRenderData } from './PlayerSeat.svelte';

  interface SeatData {
    tiles: TileRenderData[];
    handTile?: TileRenderData;
  }

  interface Props {
    myTiles: TileRenderData[];
    myHandTile?: TileRenderData;
    opponentSeats: SeatData[];
  }

  const { myTiles, myHandTile, opponentSeats }: Props = $props();

  // Opponent seat configs (top, left, right) — brought closer to centre
  const OPPONENT_SEATS = [
    { x: 0,    z: -2.5, rotY: Math.PI },       // seat 1: top
    { x: -4.5, z: 0,    rotY: Math.PI / 2 },   // seat 2: left
    { x:  4.5, z: 0,    rotY: -Math.PI / 2 },  // seat 3: right
  ];

  // Set Nord light background on the Three.js scene
  const { scene } = useThrelte();
  scene.background = new THREE.Color('#ECEFF4');

  // Camera: lower angle so own tiles are easier to read
  const { camera: activeCamera } = useCamera();
  let camera = $state<THREE.PerspectiveCamera | undefined>(undefined);

  $effect(() => {
    if (camera) {
      camera.lookAt(0, 0, 0);
      activeCamera.set(camera);
    }
  });

  interactivity();
</script>

<!-- Camera — lowered from y=7 to y=4.5, pulled back slightly -->
<T.PerspectiveCamera
  bind:ref={camera}
  position={[0, 4.5, 8]}
  fov={55}
/>

<!--
  Cartoon lighting: high ambient keeps everything flat and bright,
  single directional adds a clean top-front shadow split — no competing lights.
-->
<T.AmbientLight intensity={0.5} />
<T.DirectionalLight position={[3, 6, 5]} intensity={0.5} />

<!-- Round table -->
<Table />

<!-- My seat — brought in from z=3.5 to z=2.5 -->
<PlayerSeat
  seatX={0}
  seatZ={2.5}
  rotY={0}
  tiles={myTiles}
  handTile={myHandTile}
/>

<!-- Opponent seats -->
{#each opponentSeats as seat, i}
  {#if i < OPPONENT_SEATS.length}
    <PlayerSeat
      seatX={OPPONENT_SEATS[i].x}
      seatZ={OPPONENT_SEATS[i].z}
      rotY={OPPONENT_SEATS[i].rotY}
      tiles={seat.tiles}
      handTile={seat.handTile}
    />
  {/if}
{/each}
