<script lang="ts">
import { useSpacetimeDB, useReducer } from 'spacetimedb/svelte';
import { reducers } from '../module_bindings';
import { Button } from '$lib/components/ui/button';
import { Input } from '$lib/components/ui/input';
import { Label } from '$lib/components/ui/label';
import * as Card from '$lib/components/ui/card';

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

<div class="flex min-h-screen items-center justify-center bg-background">
  <Card.Root class="w-full max-w-sm">
    <Card.Header class="text-center">
      <Card.Title class="text-2xl">Tile Guessr</Card.Title>
      <Card.Description>Enter a name to get started</Card.Description>
    </Card.Header>
    <Card.Content>
      <form onsubmit={submit} class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <Label for="name-input">Your name</Label>
          <Input
            id="name-input"
            type="text"
            placeholder="Your name"
            bind:value={name}
            maxlength={24}
            disabled={!$conn.isActive}
          />
          {#if error}
            <p class="text-sm text-destructive">{error}</p>
          {/if}
        </div>
        <Button type="submit" disabled={!$conn.isActive || !name.trim()}>
          Continue
        </Button>
      </form>
      <p class="mt-4 text-center text-xs text-muted-foreground">
        {$conn.isActive ? 'Connected' : 'Connecting…'}
      </p>
    </Card.Content>
  </Card.Root>
</div>
