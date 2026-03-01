<script lang="ts">
  import { T } from '@threlte/core';
  import { makeToonMaterial } from './toonMaterial.js';

  const mat = makeToonMaterial('#D8DEE9');
</script>

<!-- Simple round felt disc, Nord snow storm colour -->
<T.Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} material={mat}>
  <T.CircleGeometry args={[5.5, 72]} />
</T.Mesh>
