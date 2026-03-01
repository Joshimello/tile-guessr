<script lang="ts">
import { useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';

interface Props {
  playerName: string;
}

const { playerName }: Props = $props();

const joinLobby = useReducer(reducers.joinLobby);

const options = [
  { maxPlayers: 2, tiles: 4, label: '2 Players', desc: '4 tiles each' },
  { maxPlayers: 3, tiles: 4, label: '3 Players', desc: '4 tiles each' },
  { maxPlayers: 4, tiles: 3, label: '4 Players', desc: '3 tiles each' },
] as const;

function join(maxPlayers: number) {
  joinLobby({ maxPlayers });
}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950">
  <div class="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
    <h1 class="mb-1 text-center text-2xl font-bold text-white">Tile Guessr</h1>
    <p class="mb-6 text-center text-sm text-slate-400">Welcome, <span class="font-semibold text-indigo-400">{playerName}</span>!</p>

    <h2 class="mb-4 text-center font-semibold text-slate-300">Choose a game size</h2>

    <div class="flex flex-col gap-3">
      {#each options as opt}
        <button
          onclick={() => join(opt.maxPlayers)}
          class="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800 px-5 py-4 text-left transition hover:border-indigo-500 hover:bg-slate-700"
        >
          <span class="font-semibold text-white">{opt.label}</span>
          <span class="rounded-full bg-slate-700 px-3 py-1 text-sm text-slate-300">{opt.desc}</span>
        </button>
      {/each}
    </div>
  </div>
</div>
