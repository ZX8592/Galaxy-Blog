import * as THREE from 'three';

/**
 * Creates the central star with dynamic colors, animated surface, and lighting.
 */
export function createStar(scene, starData) {
  const group = new THREE.Group();
  group.name = 'star';

  const starSize = starData?.size || 2.2;
  group.scale.setScalar(starSize / 2.2);

  const cConfig = starData?.colors || { core: '#d95914', halo: '#ff9926', corona: '#ff8c1f' };
  const colorCore = new THREE.Color(cConfig.core);
  const colorHalo = new THREE.Color(cConfig.halo);
  const colorCorona = new THREE.Color(cConfig.corona);

  const flareGeo = new THREE.PlaneGeometry(12.5, 0.44);
  const flareMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: colorHalo.clone().lerp(new THREE.Color(0xffffff), 0.35) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float line = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 4.5);
        float core = smoothstep(0.48, 0.5, abs(vUv.x - 0.5));
        float sweep = exp(-pow((vUv.x - (0.5 + sin(uTime * 0.4) * 0.08)) * 10.0, 2.0));
        float alpha = line * (0.08 + sweep * 0.22) * (1.0 - core);
        gl_FragColor = vec4(uColor * (1.0 + sweep * 0.8), alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flare = new THREE.Mesh(flareGeo, flareMat);
  flare.renderOrder = 5;
  group.add(flare);

  // Core sphere with animated surface
  const coreGeo = new THREE.SphereGeometry(2.2, 48, 48);
  const coreMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorCore: { value: colorCore }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vUv = uv;
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorCore;
      varying vec3 vWorldNormal;
      varying vec2 vUv;
      varying vec3 vWorldPosition;

      // Simple noise function
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      void main() {
        // Animated surface detail
        vec2 uv = vUv * 6.0;
        float n1 = noise(uv + uTime * 0.15);
        float n2 = noise(uv * 2.0 - uTime * 0.2);
        float n3 = noise(uv * 0.5 + uTime * 0.08);
        float pattern = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;

        // Color gradient: uses base uColorCore and brightens it
        vec3 deepOrange = uColorCore;
        vec3 amber = min(uColorCore * 1.5 + vec3(0.2, 0.2, 0.0), vec3(1.0));
        vec3 gold = min(uColorCore * 2.0 + vec3(0.4, 0.4, 0.2), vec3(1.0));

        vec3 baseColor = mix(deepOrange, amber, pattern);
        baseColor = mix(baseColor, gold, pow(pattern, 2.0) * 0.6);

        // Slight pulsing
        float pulse = 0.92 + 0.08 * sin(uTime * 1.2);
        vec3 norm = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = max(dot(norm, viewDir), 0.0);
        float centerGlow = pow(facing, 0.7);
        float edgeHeat = pow(1.0 - facing, 1.6);
        float flare = smoothstep(0.62, 0.95, pattern) * (0.5 + 0.5 * sin(uTime * 2.1 + pattern * 8.0));

        vec3 color = baseColor * (1.18 + centerGlow * 0.72) * pulse;
        color += amber * edgeHeat * 0.34;
        color += gold * flare * 0.52;
        color += gold * centerGlow * 0.18;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  // Inner glow layer
  const glowGeo = new THREE.SphereGeometry(2.8, 24, 24);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorHalo: { value: colorHalo }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorHalo;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normalDir = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 2.6);
        float pulse = 0.85 + 0.15 * sin(uTime * 1.5);
        vec3 color1 = uColorHalo * 1.7 + vec3(0.18, 0.12, 0.04);
        vec3 color2 = uColorHalo * 1.02;
        vec3 color = mix(color2, color1, fresnel) * pulse;
        gl_FragColor = vec4(color, fresnel * 1.18);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  group.add(glow);

  // Outer corona
  const coronaGeo = new THREE.SphereGeometry(4.0, 24, 24);
  const coronaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorCorona: { value: colorCorona }
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorCorona;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;
      void main() {
        vec3 normalDir = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(dot(normalDir, viewDir), 0.0), 3.4);
        float shimmer = 0.82 + 0.18 * sin(uTime * 3.0 + normalDir.y * 9.0 + normalDir.x * 5.0);
        float flicker = 0.9 + 0.1 * sin(uTime * 3.0 + 1.5);
        vec3 color = (uColorCorona * 1.28 + vec3(0.12, 0.08, 0.02)) * flicker * shimmer;
        gl_FragColor = vec4(color, fresnel * 0.64);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const corona = new THREE.Mesh(coronaGeo, coronaMat);
  group.add(corona);

  // Point light (warm amber) - matches halo color approximately
  const pointLightColor = colorHalo.clone().lerp(new THREE.Color(0xffffff), 0.3);
  const pointLight = new THREE.PointLight(pointLightColor, 3.6, 220);
  group.add(pointLight);

  // Ambient
  const ambientLight = new THREE.AmbientLight(0x222244, 0.4);
  scene.add(ambientLight);

  scene.add(group);

  return {
    group,
    update(time) {
      coreMat.uniforms.uTime.value = time;
      glowMat.uniforms.uTime.value = time;
      coronaMat.uniforms.uTime.value = time;
      flareMat.uniforms.uTime.value = time;
      core.rotation.y = time * 0.08;
      core.rotation.x = time * 0.03;
    }
  };
}
