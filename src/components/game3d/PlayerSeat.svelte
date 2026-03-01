<script lang="ts">
  import { T } from '@threlte/core';
  import TileBlock from './TileBlock.svelte';

  export interface TileRenderData {
    id: bigint;
    color: string;
    value: number | null;
    isRevealed: boolean;
    isInHand: boolean;
    isOwn: boolean;
    isTargetable: boolean;
    isSelected: boolean;
    onselect?: () => void;
  }

  interface Props {
    seatX?: number;
    seatZ?: number;
    rotY?: number;
    tiles: TileRenderData[];
    handTile?: TileRenderData;
  }

  const { seatX = 0, seatZ = 0, rotY = 0, tiles, handTile }: Props = $props();

  // Tile spacing: tile width 0.55 + 0.1 gap = 0.65 units between centers
  const SPACING = 0.65;

  const tileX = (i: number, total: number) => (i - (total - 1) / 2) * SPACING;

  // Hand tile sits to the right of the main row, slightly forward (+z local)
  const handX = $derived((tiles.length / 2 + 0.5) * SPACING);
  const handZ = 0.35;
</script>

<T.Group position={[seatX, 0, seatZ]} rotation={[0, rotY, 0]}>
  {#each tiles as tile, i (tile.id)}
    <TileBlock
      x={tileX(i, tiles.length)}
      z={0}
      color={tile.color}
      value={tile.value}
      isRevealed={tile.isRevealed}
      isInHand={false}
      isOwn={tile.isOwn}
      isTargetable={tile.isTargetable}
      isSelected={tile.isSelected}
      onselect={tile.onselect}
    />
  {/each}

  {#if handTile}
    <TileBlock
      x={handX}
      z={handZ}
      color={handTile.color}
      value={handTile.value}
      isRevealed={false}
      isInHand={true}
      isOwn={handTile.isOwn}
      isTargetable={false}
      isSelected={false}
    />
  {/if}
</T.Group>
