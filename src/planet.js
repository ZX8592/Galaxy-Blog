import * as THREE from 'three';

/**
 * Creates a cartoon-style planet from a blog post config.
 * Shadow/lighting is always relative to the star (origin) — never view-dependent.
 */
export function createPlanet(config, index) {
  const {
    name, orbitRadius, orbitSpeed, spinSpeed, size,
    colors, hasRing, ringColor
  } = config;

  const group = new THREE.Group();
  group.name = `planet-${index}`;
  group.userData = { blogIndex: index, config };

  const orbit = new THREE.Group();
  orbit.name = `orbit-${index}`;

  const initialAngle = (index / 6) * Math.PI * 2 + index * 1.23;
  orbit.rotation.y = initialAngle;

  // ---- Planet body with toon shading (star-relative lighting) ----
  const planetGeo = new THREE.SphereGeometry(size, 40, 40);

  const planetMat = new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(colors.base) },
      uAccentColor: { value: new THREE.Color(colors.accent) },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      void main() {
        vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec2 vUv;

      // Simple procedural noise for gas giant texture
      float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
      
      float fbm(vec2 p) {
          float f = 0.0;
          float w = 0.5;
          for(int i = 0; i < 4; i++) {
              f += w * noise(p);
              p *= 2.0;
              w *= 0.5;
          }
          return f;
      }

      void main() {
        // Light direction: from fragment toward the star (world origin)
        vec3 lightDir = normalize(-vWorldPos);
        vec3 norm = normalize(vNormal);
        float NdotL = dot(norm, lightDir);

        // Cartoon cel-shading bands (star-relative, never changes with camera)
        float band;
        if (NdotL > 0.65) band = 1.05;
        else if (NdotL > 0.18) band = 0.72;
        else if (NdotL > -0.2) band = 0.38;
        else band = 0.18;

        // Generate gas giant / cyclone pattern
        // uTime * 0.05 makes the noise drift (rotation), vUv * 4.0 scales the swirls
        vec2 st = vUv * vec2(6.0, 3.0) + vec2(uTime * 0.03, 0.0);
        float noiseVal = fbm(st) * 2.0 - 1.0;
        
        // Combine with a latitude band (vUv.y) to get horizontal gas giant stripes
        float stripes = sin(vUv.y * 20.0 + noiseVal * 3.0 + uTime * 0.08) * 0.5 + 0.5;
        
        // Add a second layer of noise for fine cyclone detail
        float cyclone = fbm(vUv * 12.0 - vec2(uTime * 0.02));
        float pattern = mix(stripes, cyclone, 0.3);

        vec3 surfaceColor = mix(uBaseColor, uAccentColor, pattern);

        float sunWash = smoothstep(0.08, 0.95, max(NdotL, 0.0));
        vec3 color = surfaceColor * band;
        color += surfaceColor * sunWash * 0.12;

        // Rim glow on the sunlit limb (star-relative, NOT camera-relative)
        float fresnel = 1.0 - abs(dot(norm, lightDir));
        float litSide = max(NdotL, 0.0);
        float rim = pow(max(fresnel, 0.0), 3.0) * litSide;
        color += uAccentColor * rim * 0.16;

        gl_FragColor = vec4(color, 1.0);
      }
    `
  });

  const planetMesh = new THREE.Mesh(planetGeo, planetMat);
  group.add(planetMesh);

  // ---- Stylized silhouette shell for a more animated look ----
  const outlineGeo = new THREE.SphereGeometry(size * 1.06, 24, 24);
  const outlineMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colors.atmosphere).lerp(new THREE.Color(0x030816), 0.82),
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  const outline = new THREE.Mesh(outlineGeo, outlineMat);
  group.add(outline);

  // ---- Atmosphere glow (view-dependent edge glow is fine for atmosphere) ----
  const atmosGeo = new THREE.SphereGeometry(size * 1.18, 24, 24);
  const atmosMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(colors.atmosphere) }
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec3 vNormal;
      void main() {
        float intensity = pow(max(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.7);
        gl_FragColor = vec4(uColor, intensity * 0.17);
      }
    `,
    transparent: true,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const atmosphere = new THREE.Mesh(atmosGeo, atmosMat);
  group.add(atmosphere);

  // ---- Ring (optional) ----
  if (hasRing && ringColor) {
    const ringGeo = new THREE.RingGeometry(size * 1.5, size * 2.2, 48);
    const ringMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(ringColor) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float dist = abs(vUv.y - 0.5) * 2.0;
        float alpha = smoothstep(1.0, 0.2, dist) * 0.18;
        float stripe = sin(vUv.x * 120.0) * 0.15 + 0.85;
        // Dim the ring a bit so Bloom doesn't overexpose it
        gl_FragColor = vec4(uColor * stripe * 0.52, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI * 0.4;
    group.add(ring);
  }

  // ---- Orbit path line ----
  const orbitCurve = new THREE.EllipseCurve(0, 0, orbitRadius, orbitRadius, 0, Math.PI * 2, false, 0);
  const orbitPoints = orbitCurve.getPoints(128);
  const orbitLineGeo = new THREE.BufferGeometry().setFromPoints(
    orbitPoints.map(p => new THREE.Vector3(p.x, 0, p.y))
  );
  const orbitLineMat = new THREE.LineBasicMaterial({
    color: 0x556677, // Uniform subtle gray-blue orbit
    transparent: true,
    opacity: 0.15
  });
  const orbitLine = new THREE.Line(orbitLineGeo, orbitLineMat);

  group.position.set(orbitRadius, 0, 0);
  orbit.add(group);

  return {
    group,
    orbit,
    orbitLine,
    name,
    index,
    config,

    getWorldPosition(target = new THREE.Vector3()) {
      group.getWorldPosition(target);
      return target;
    },

    update(time) {
      orbit.rotation.y = initialAngle + time * orbitSpeed;
      planetMesh.rotation.y = time * spinSpeed;
      planetMat.uniforms.uTime.value = time;
    }
  };
}
