import * as THREE from 'three';

/**
 * Creates a procedural starfield background with twinkling particles + a massive procedural nebula.
 */
export function createSkybox(scene) {
    const skyGroup = new THREE.Group();
    skyGroup.name = 'skybox';

    // 1. Particle Stars
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinklePhases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        // Distribute on a large sphere shell
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 300 + Math.random() * 200;

        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);

        sizes[i] = 0.5 + Math.random() * 2.0;
        twinklePhases[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(twinklePhases, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio }
        },
        vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 0.5 + 0.5 * sin(uTime * 0.3 + aPhase); // slow down twinkle
        vAlpha = 0.15 + 0.6 * twinkle; // slightly dimmer overall stars
        gl_PointSize = aSize * uPixelRatio * (200.0 / -mvPosition.z) * 1.5;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
        fragmentShader: `
      varying float vAlpha;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = vAlpha * smoothstep(0.5, 0.1, dist);
        gl_FragColor = vec4(0.85, 0.9, 1.0, alpha);
      }
    `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geometry, material);
    skyGroup.add(points);

    // 2. Procedural Nebula Sphere
    const nebulaGeo = new THREE.SphereGeometry(450, 64, 64);
    const nebulaMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color(0x050919) },
            uColor2: { value: new THREE.Color(0x101c44) },
            uColor3: { value: new THREE.Color(0x0e4f73) },
            uColor4: { value: new THREE.Color(0x4e2f7f) },
        },
        vertexShader: `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform vec3 uColor1;
            uniform vec3 uColor2;
            uniform vec3 uColor3;
            uniform vec3 uColor4;
            varying vec3 vWorldPosition;

            // 3D Simplex noise
            vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
            vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
            float snoise(vec3 v){ 
              const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
              const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
              vec3 i  = floor(v + dot(v, C.yyy) );
              vec3 x0 = v - i + dot(i, C.xxx) ;
              vec3 g = step(x0.yzx, x0.xyz);
              vec3 l = 1.0 - g;
              vec3 i1 = min( g.xyz, l.zxy );
              vec3 i2 = max( g.xyz, l.zxy );
              vec3 x1 = x0 - i1 + 1.0 * C.xxx;
              vec3 x2 = x0 - i2 + 2.0 * C.xxx;
              vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
              i = mod(i, 289.0 ); 
              vec4 p = permute( permute( permute( 
                         i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                       + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                       + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
              float n_ = 1.0/7.0;
              vec3  ns = n_ * D.wyz - D.xzx;
              vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
              vec4 x_ = floor(j * ns.z);
              vec4 y_ = floor(j - 7.0 * x_ );
              vec4 x = x_ *ns.x + ns.yyyy;
              vec4 y = y_ *ns.x + ns.yyyy;
              vec4 h = 1.0 - abs(x) - abs(y);
              vec4 b0 = vec4( x.xy, y.xy );
              vec4 b1 = vec4( x.zw, y.zw );
              vec4 s0 = floor(b0)*2.0 + 1.0;
              vec4 s1 = floor(b1)*2.0 + 1.0;
              vec4 sh = -step(h, vec4(0.0));
              vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
              vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
              vec3 p0 = vec3(a0.xy,h.x);
              vec3 p1 = vec3(a0.zw,h.y);
              vec3 p2 = vec3(a1.xy,h.z);
              vec3 p3 = vec3(a1.zw,h.w);
              vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
              p0 *= norm.x;
              p1 *= norm.y;
              p2 *= norm.z;
              p3 *= norm.w;
              vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
              m = m * m;
              return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
            }

            // FBM sum
            float fbm(vec3 p) {
                float f = 0.0;
                float w = 0.5;
                for (int i = 0; i < 4; i++) {
                    f += w * snoise(p);
                    p *= 2.0;
                    w *= 0.5;
                }
                return f;
            }

            void main() {
                // Slower movement across the sky
                vec3 p = normalize(vWorldPosition) * 3.0;
                float n1 = fbm(p + uTime * 0.015);
                float n2 = fbm(p * 2.0 - uTime * 0.02 + vec3(5.2, 1.3, 2.8));
                
                // Combine for smooth cloud-like swirls
                float mixFactor = smoothstep(0.2, 0.9, n1 * 0.6 + n2 * 0.4);
                
                // Extra layer of bright cyan/blue
                float highlight = smoothstep(0.5, 1.0, snoise(p * 2.5 + uTime * 0.01));
                float veil = smoothstep(0.15, 0.95, snoise(p * 1.7 - uTime * 0.008 + vec3(-2.4, 1.6, 0.8)));

                vec3 finalColor = mix(uColor1, uColor2, mixFactor);
                finalColor = mix(finalColor, uColor3, highlight * 0.8);
                finalColor = mix(finalColor, uColor4, veil * 0.34 * (1.0 - mixFactor * 0.35));
                
                // Make the base deep space slightly visible where there are no clouds
                finalColor = mix(vec3(0.008, 0.01, 0.024), finalColor, mixFactor + 0.1);

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `,
        side: THREE.BackSide, // Render on the inside of the sphere
        depthWrite: false
    });
    
    const nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    skyGroup.add(nebulaMesh);

    // 3. Shooting Stars (Meteors) - Fixed to be on background layer
    const meteorGroup = new THREE.Group();
    skyGroup.add(meteorGroup);
    
    const meteors = [];
    const meteorCount = 4;

    const meteorGeo = new THREE.PlaneGeometry(60, 0.4); // Long thin line
    const meteorMat = new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(0xaaccff) },
            uProgress: { value: 0.0 } // 0 to 1 life cycle
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
            uniform float uProgress;
            varying vec2 vUv;
            void main() {
                // The meteor moves toward local -X, so the head lives near vUv.x = 0.
                float trail = 1.0 - smoothstep(0.0, 1.0, vUv.x);
                // vUv.y for thickness profile (smooth fade at edges)
                float thickness = sin(vUv.y * 3.14159);
                float alpha = trail * pow(thickness, 2.0);
                float head = pow(max(1.0 - length(vec2(vUv.x * 3.8, (vUv.y - 0.5) * 2.2)), 0.0), 3.0);
                
                // Fade out overall based on life cycle (sine wave fade in/out)
                float fade = sin(uProgress * 3.14159);
                vec3 color = uColor * (1.0 + head * 1.6);
                gl_FragColor = vec4(color, (alpha + head * 0.35) * fade * 1.8);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.FrontSide
    });

    for (let i = 0; i < meteorCount; i++) {
        // Orbit group handles sweeping across the sky perfectly on the sphere surface
        const orbitGroup = new THREE.Group();
        meteorGroup.add(orbitGroup);

        const mesh = new THREE.Mesh(meteorGeo, meteorMat.clone());
        mesh.position.set(0, 0, -380); // Placed at edge of skybox
        mesh.visible = false;
        mesh.renderOrder = -1; // Ensure it stays behind planets
        orbitGroup.add(mesh);

        meteors.push({ 
            mesh, 
            orbitGroup,
            active: false, 
            life: 0, 
            maxLife: 0, 
            speed: 0
        });
    }

    scene.add(skyGroup);

    return {
        update(time, delta = 0.016) {
            material.uniforms.uTime.value = time;
            nebulaMat.uniforms.uTime.value = time;
            skyGroup.rotation.y = time * 0.005; // Entire sky very slowly rotates

            // Update shooting stars
            meteors.forEach(m => {
                if (!m.active) {
                    if (Math.random() < delta * 0.016) {
                        m.active = true;
                        m.maxLife = 3.4 + Math.random() * 2.2; // Longer, calmer trails
                        m.life = 0;
                        m.speed = 0.055 + Math.random() * 0.085; // Noticeably slower sweep
                        
                        // Randomize spawn angle
                        m.orbitGroup.rotation.set(
                            Math.random() * Math.PI * 2,
                            Math.random() * Math.PI * 2,
                            Math.random() * Math.PI * 2
                        );
                        
                        m.mesh.visible = true;
                        m.mesh.material.uniforms.uProgress.value = 0.0;
                    }
                } else {
                    m.life += delta;
                    
                    // Rotate the orbit group to sweep the meteor exactly across the sky surface!
                    m.orbitGroup.rotateY(m.speed * delta); // Move across local X axis (width of plane)
                    
                    const progress = m.life / m.maxLife;
                    m.mesh.material.uniforms.uProgress.value = progress;

                    if (m.life >= m.maxLife) {
                        m.active = false;
                        m.mesh.visible = false;
                    }
                }
            });
        }
    };
}
