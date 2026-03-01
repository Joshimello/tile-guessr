<script lang="ts">
import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';

const conn = useSpacetimeDB();
const setName = useReducer(reducers.setName);

let name = $state('');
let error = $state('');

function submit(e: SubmitEvent) {
  e.preventDefault();
  const trimmed = name.trim();
  if (!trimmed) { error = 'Name cannot be empty'; return; }
  if (trimmed.length > 24) { error = 'Name must be 24 characters or fewer'; return; }
  error = '';
  setName({ name: trimmed });
}
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-950">
  <div class="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
    <h1 class="mb-2 text-center text-2xl font-bold text-white">Tile Guessr</h1>
    <p class="mb-6 text-center text-sm text-slate-400">Enter a name to get started</p>

    <form onsubmit={submit} class="flex flex-col gap-3">
      <input
        type="text"
        placeholder="Your name"
        bind:value={name}
        maxlength={24}
        disabled={!$conn.isActive}
        class="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
      />
      {#if error}
        <p class="text-sm text-red-400">{error}</p>
      {/if}
      <button
        type="submit"
        disabled={!$conn.isActive || !name.trim()}
        class="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
      </button>
    </form>

    <p class="mt-4 text-center text-xs text-slate-600">
      {$conn.isActive ? 'Connected' : 'Connecting…'}
    </p>
  </div>
</div>
