import * as THREE from 'three';

// ── Shaders ────────────────────────────────────────────────────────────────────
// World-space approach: pass light direction as a uniform, use Three.js's
// built-in cameraPosition uniform for the view direction.
// This avoids the lights_pars_begin / NUM_DIR_LIGHTS define timing issues
// that plague ShaderMaterial when lights are added after first compile.

const vertexShader = /* glsl */`
  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec4 worldPos  = modelMatrix * vec4(position, 1.0);
    vWorldPos      = worldPos.xyz;
    // mat3(modelMatrix) is correct for rotation + uniform scale (no shear)
    vWorldNormal   = normalize(mat3(modelMatrix) * normal);
    gl_Position    = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3  uColor;
  uniform float uGlossiness;
  uniform vec3  uLightDir;    // world-space, toward light, normalised
  uniform vec3  uLightColor;  // light colour × intensity
  uniform vec3  uAmbient;     // ambient colour

  varying vec3 vWorldNormal;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(cameraPosition - vWorldPos); // cameraPosition: Three.js built-in
    vec3 L = uLightDir;

    // ── diffuse — crisp toon snap at NdotL = 0 ────────────────────────────
    float NdotL   = dot(N, L);
    float shadow  = smoothstep(0.0, 0.01, NdotL);
    vec3  diffuse = uLightColor * shadow;

    // ── specular (Blinn-Phong) ────────────────────────────────────────────
    vec3  H    = normalize(L + V);
    float spec = pow(max(0.0, dot(N, H)) * shadow, 1000.0 / uGlossiness);
    spec = smoothstep(0.05, 0.1, spec);
    vec3  specular = spec * uLightColor;

    // ── rim light ─────────────────────────────────────────────────────────
    float rimDot = 1.0 - max(0.0, dot(V, N));
    float rim    = smoothstep(0.59, 0.61, rimDot * pow(max(0.0, NdotL), 0.2));
    vec3  rimCol = rim * uLightColor;

    gl_FragColor = vec4(uColor * (uAmbient + diffuse + specular + rimCol), 1.0);
  }
`;

// ── Hardcoded light — matches GameScene.svelte DirectionalLight position ──────
// Lit faces reach full colour (ambient + light = 1.0); shadow faces = 0.35 brightness.
const LIGHT_DIR   = new THREE.Vector3(3, 6, 5).normalize();
const LIGHT_COLOR = new THREE.Color(0.65, 0.65, 0.65);
const AMBIENT     = new THREE.Color(0.35, 0.35, 0.35);

// ── Material cache — share compiled programs across tiles ──────────────────────
const _cache = new Map<string, THREE.ShaderMaterial>();

export function makeToonMaterial(hexColor: string, glossiness = 64): THREE.ShaderMaterial {
  const key = `${hexColor}:${glossiness}`;
  if (_cache.has(key)) return _cache.get(key)!;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor:      { value: new THREE.Color(hexColor) },
      uGlossiness: { value: glossiness },
      uLightDir:   { value: LIGHT_DIR },
      uLightColor: { value: LIGHT_COLOR },
      uAmbient:    { value: AMBIENT },
    },
    vertexShader,
    fragmentShader,
  });

  _cache.set(key, mat);
  return mat;
}
