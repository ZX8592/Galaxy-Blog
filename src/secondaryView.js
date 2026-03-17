import * as THREE from 'three';
import blogPosts from './blogData.js';

/**
 * SecondaryView — manages the "planet + moons row" sub-scene.
 *
 * When entering:
 *   - Creates planet + moon meshes in a horizontal row at y=200
 *   - Smoothly moves camera to face the row
 *   - Scroll switches focus left/right
 *   - Click opens blog content
 *   - Escape returns to galaxy
 *
 * Visual: planet on left, moons to the right, all self-rotating.
 * Camera looks directly at the row from front (no mouse orbit).
 */

const ROW_Y = 200; // far above galaxy to avoid visual interference
const ROW_SPACING = 3.5; // space between items
const CAM_DISTANCE = 8; // camera distance from row

export class SecondaryView {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        this.active = false;
        this.planetIndex = -1; // which planet (blogPosts index) we're viewing

        /** All items in the row: [{ mesh, group, name, content, isMoon, moonIndex }] */
        this.items = [];
        this.focusIndex = 0;
        this.rowGroup = null;

        // Camera targets for smooth transition
        this.targetCamPos = new THREE.Vector3();
        this.targetLookAt = new THREE.Vector3();
        this.currentCamPos = new THREE.Vector3();
        this.currentLookAt = new THREE.Vector3();

        // Transition state
        this.entering = false;
        this.exiting = false;
        this.exitCallback = null;

        // Cooldown for scroll
        this.switchCooldown = 0;

        this._bindEvents();
    }

    _bindEvents() {
        window.addEventListener('wheel', (e) => {
            if (!this.active || this.entering || this.exiting) return;
            if (this.switchCooldown > 0) return;
            if (e.deltaY < 0) this._switchFocus(1);
            else if (e.deltaY > 0) this._switchFocus(-1);
        }, { passive: true });

        window.addEventListener('keydown', (e) => {
            if (!this.active || this.entering || this.exiting) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                this._switchFocus(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                this._switchFocus(-1);
            }
        });
    }

    _switchFocus(dir) {
        if (this.switchCooldown > 0) return;
        let newIdx = this.focusIndex + dir;
        // Wrap-around
        if (newIdx < 0) newIdx = this.items.length - 1;
        else if (newIdx >= this.items.length) newIdx = 0;
        this.focusIndex = newIdx;
        this.switchCooldown = 0.35;
        this._updateCameraTarget();
    }

    /**
     * Enter secondary view for a given planet.
     * @param {number} planetIdx — index in blogPosts array
     * @param {Function} onHudUpdate — callback(item) to update HUD
     */
    enter(planetIdx, onHudUpdate) {
        if (this.active) return;

        this.planetIndex = planetIdx;
        this.focusIndex = 0;
        this.active = true;
        this.entering = true;
        this.onHudUpdate = onHudUpdate;

        const post = blogPosts[planetIdx];
        const moons = post.moons || [];

        // Create container group
        this.rowGroup = new THREE.Group();
        this.rowGroup.position.set(0, ROW_Y, 0);
        this.scene.add(this.rowGroup);

        this.items = [];

        // Planet (first item on the left)
        const planetItem = this._createItemMesh(post.colors, post.size, post.hasRing, post.ringColor);
        planetItem.group.position.set(0, 0, 0);
        this.rowGroup.add(planetItem.group);
        this.items.push({
            mesh: planetItem.mesh,
            group: planetItem.group,
            name: post.name,
            content: post.content,
            date: post.date,
            subtitle: post.subtitle,
            type: post.type,
            url: post.url,
            isMoon: false,
            moonIndex: -1
        });

        // Moons (to the right)
        let xPos = ROW_SPACING;
        moons.forEach((moon, i) => {
            const moonItem = this._createItemMesh(moon.colors, moon.size, false, null);
            moonItem.group.position.set(xPos, 0, 0);
            this.rowGroup.add(moonItem.group);
            this.items.push({
                mesh: moonItem.mesh,
                group: moonItem.group,
                name: moon.name,
                content: moon.content,
                type: moon.type,
                url: moon.url,
                date: null,
                subtitle: null,
                isMoon: true,
                moonIndex: i
            });
            xPos += ROW_SPACING;
        });

        // Save where camera was
        this.savedCamPos = this.camera.position.clone();

        // Set up camera transition targets
        this.currentCamPos.copy(this.camera.position);
        this.currentLookAt.copy(this.camera.position).add(
            new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion)
        );
        this._updateCameraTarget();

        // Notify HUD
        if (this.onHudUpdate) this.onHudUpdate(this.items[0]);
    }

    /**
     * Exit secondary view, return to galaxy.
     * @param {THREE.Vector3} returnCamPos — camera position to return to
     * @param {THREE.Vector3} returnLookAt — look-at to return to
     * @param {Function} onComplete — called when exit transition finishes
     */
    exit(returnCamPos, returnLookAt, onComplete) {
        if (!this.active) return;
        this.exiting = true;
        this.targetCamPos.copy(returnCamPos);
        this.targetLookAt.copy(returnLookAt);
        this.exitCallback = onComplete;
    }

    _cleanup() {
        if (this.rowGroup) {
            // Dispose geometries/materials
            this.rowGroup.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.dispose) child.material.dispose();
                }
            });
            this.scene.remove(this.rowGroup);
            this.rowGroup = null;
        }
        this.items = [];
        this.active = false;
        this.entering = false;
        this.exiting = false;
        this.planetIndex = -1;
    }

    /** Get the currently focused item */
    getFocusedItem() {
        return this.items[this.focusIndex] || null;
    }

    _updateCameraTarget() {
        const item = this.items[this.focusIndex];
        if (!item) return;

        const itemWorldPos = new THREE.Vector3();
        item.group.getWorldPosition(itemWorldPos);

        // Zoom closer for moons, further for planets
        const distance = item.isMoon ? CAM_DISTANCE * 0.55 : CAM_DISTANCE;
        const yOffset = item.isMoon ? 0.1 : 0.3;

        this.targetLookAt.copy(itemWorldPos);
        this.targetCamPos.set(
            itemWorldPos.x,
            itemWorldPos.y + yOffset,
            itemWorldPos.z + distance
        );

        // Notify HUD
        if (this.onHudUpdate) this.onHudUpdate(item);
    }

    /** Create a toon-shaded sphere mesh for the row view */
    _createItemMesh(colors, size, hasRing, ringColor) {
        const group = new THREE.Group();

        // Main sphere with simplified toon shading
        const geo = new THREE.SphereGeometry(size, 48, 48);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uBaseColor: { value: new THREE.Color(colors.base) },
                uAccentColor: { value: new THREE.Color(colors.accent) },
                uTime: { value: 0 }
            },
            vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
            fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uAccentColor;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec2 vUv;
        varying vec3 vWorldPos;

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
          float NdotL = dot(vNormal, vec3(0.0, 0.3, 0.95));
          float band;
          if (NdotL > 0.6) band = 1.0;
          else if (NdotL > 0.15) band = 0.65;
          else if (NdotL > -0.2) band = 0.35;
          else band = 0.18;

          vec2 st = vUv * vec2(6.0, 3.0) + vec2(uTime * 0.03, 0.0);
          float noiseVal = fbm(st) * 2.0 - 1.0;
          float stripes = sin(vUv.y * 20.0 + noiseVal * 3.0 + uTime * 0.08) * 0.5 + 0.5;
          float cyclone = fbm(vUv * 12.0 - vec2(uTime * 0.02));
          float pattern = mix(stripes, cyclone, 0.3);

          vec3 surfaceColor = mix(uBaseColor, uAccentColor, pattern);
          vec3 color = surfaceColor * band;

          // Soft rim
          float rim = 1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
          rim = smoothstep(0.6, 1.0, rim);
          color += uAccentColor * rim * 0.2;

          gl_FragColor = vec4(color, 1.0);
        }
      `
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);

        // Atmosphere
        const atmosGeo = new THREE.SphereGeometry(size * 1.15, 32, 32);
        const atmosMat = new THREE.ShaderMaterial({
            uniforms: { uColor: { value: new THREE.Color(colors.atmosphere) } },
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
          float intensity = pow(max(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
          gl_FragColor = vec4(uColor, intensity * 0.25);
        }
      `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        group.add(new THREE.Mesh(atmosGeo, atmosMat));

        // Ring
        if (hasRing && ringColor) {
            const ringGeo = new THREE.RingGeometry(size * 1.5, size * 2.2, 64);
            const ringMat = new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(ringColor) } },
                vertexShader: `varying vec2 vUv; void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                fragmentShader: `
          uniform vec3 uColor; varying vec2 vUv;
          void main() {
            float dist=abs(vUv.y-0.5)*2.0;
            float alpha=smoothstep(1.0,0.2,dist)*0.25;
            float stripe=sin(vUv.x*120.0)*0.15+0.85;
            gl_FragColor=vec4(uColor*stripe*0.7,alpha);
          }
        `,
                transparent: true, side: THREE.DoubleSide, depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = -Math.PI * 0.4;
            group.add(ring);
        }

        return { group, mesh, mat };
    }

    /** Called every frame */
    update(deltaTime, elapsed) {
        if (!this.active) return;

        this.switchCooldown = Math.max(0, this.switchCooldown - deltaTime);

        // Self-rotate all items
        this.items.forEach((item) => {
            item.mesh.rotation.y = elapsed * 0.4;
            // Update shader time
            if (item.mesh.material.uniforms && item.mesh.material.uniforms.uTime) {
                item.mesh.material.uniforms.uTime.value = elapsed;
            }
        });

        // Camera transition
        const lerpSpeed = (this.entering || this.exiting) ? 2.5 : 5.0;
        this.currentCamPos.lerp(this.targetCamPos, lerpSpeed * deltaTime);
        this.currentLookAt.lerp(this.targetLookAt, lerpSpeed * deltaTime);

        this.camera.position.copy(this.currentCamPos);
        this.camera.lookAt(this.currentLookAt);

        // Check if enter transition is done
        if (this.entering && this.currentCamPos.distanceTo(this.targetCamPos) < 0.1) {
            this.entering = false;
        }

        // Check if exit transition is done
        if (this.exiting && this.currentCamPos.distanceTo(this.targetCamPos) < 0.3) {
            const cb = this.exitCallback;
            this._cleanup();
            if (cb) cb();
        }
    }
}
