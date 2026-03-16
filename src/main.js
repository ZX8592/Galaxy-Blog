import * as THREE from 'three';
import { createStar } from './star.js';
import { createSkybox } from './skybox.js';
import { createPlanet } from './planet.js';
import { CameraController } from './cameraController.js';
import { SecondaryView } from './secondaryView.js';
import { UI } from './ui.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import blogPosts, { starData } from './blogData.js';
import { playClickSound } from './audio.js';

// ============================================
//  Setup Document
// ============================================
document.title = starData.name || 'Galaxy Blog — 星系博客';

// ============================================
//  Setup
// ============================================

const canvas = document.getElementById('galaxy-canvas');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020210);
scene.fog = new THREE.FogExp2(0x020210, 0.003);

const camera = new THREE.PerspectiveCamera(
    55, window.innerWidth / window.innerHeight, 0.1, 1000
);
camera.position.set(10, 5, 10);

// ============================================
//  Create objects
// ============================================

const star = createStar(scene, starData);
const skybox = createSkybox(scene);

const planets = blogPosts.map((post, i) => {
    const planet = createPlanet(post, i);
    scene.add(planet.orbit);
    scene.add(planet.orbitLine);
    return planet;
});

// ============================================
//  Focus targets: [star, ...planets]
// ============================================

const starTarget = {
    getWorldPosition() { return new THREE.Vector3(0, 0, 0); },
    config: { name: starData.title || '星系博客', subtitle: starData.meta || '', size: starData.size || 2.2 },
    index: -1,
    isStar: true
};

const focusTargets = [starTarget, ...planets];

// ============================================
//  Mode state: 'galaxy' | 'secondary'
// ============================================

let mode = 'galaxy';

// ============================================
//  Camera, SecondaryView & UI
// ============================================

const cameraCtrl = new CameraController(camera, focusTargets);
const secondaryView = new SecondaryView(scene, camera);
const ui = new UI(focusTargets.length);

// Initial state: star focused
ui.updateHUD(focusTargets[0]);
ui.showStarHome(true);

// ============================================
//  Click / Enter interaction
// ============================================

function handleInteraction() {
    if (ui.isOpen) return;

    if (mode === 'galaxy') {
        const target = cameraCtrl.getFocusedTarget();
        if (!target) return;

        if (target.isStar) {
            // Star: open star content overlay
            ui.openStar();
            cameraCtrl.overlayOpen = true;
            playClickSound();
        } else {
            // Planet: check if it has moons
            const post = blogPosts[target.index];
            if (post.moons && post.moons.length > 0) {
                // Enter secondary view
                enterSecondaryView(target.index);
                playClickSound();
            } else {
                // No moons: open content directly
                ui.open(target.index);
                cameraCtrl.overlayOpen = true;
                playClickSound();
            }
        }
    } else if (mode === 'secondary') {
        // In secondary view: open focused item's content
        const item = secondaryView.getFocusedItem();
        if (item) {
            ui.openSecondaryContent(item);
        }
    }
}

canvas.addEventListener('click', handleInteraction);

window.addEventListener('mousedown', (e) => {
    if (e.button === 2) {
        // Right click: if in secondary view, exit it.
        if (mode === 'secondary' && !ui.isOpen) {
            exitSecondaryView();
        }
    }
});

function enterSecondaryView(planetIdx) {
    mode = 'secondary';
    cameraCtrl.overlayOpen = true; // freeze galaxy camera
    ui.showStarHome(false);
    ui.enterSecondary(blogPosts[planetIdx], planetIdx);

    secondaryView.enter(planetIdx, (item) => {
        // Called when focus changes in secondary view
        ui.updateSecondaryHUD(item);
    });
}

function exitSecondaryView() {
    // Get the planet's current world position to return camera to
    const planetIdx = secondaryView.planetIndex;
    const focusTargetIdx = planetIdx + 1; // offset by 1 for star at index 0

    // Compute where the galaxy camera should be
    const targetFocusObj = focusTargets[focusTargetIdx];
    const targetPos = targetFocusObj.getWorldPosition();
    const returnCamPos = targetPos.clone().add(new THREE.Vector3(4, 3, 6));

    secondaryView.exit(returnCamPos, targetPos, () => {
        // Exit complete
        mode = 'galaxy';
        cameraCtrl.focusIndex = focusTargetIdx;
        cameraCtrl.overlayOpen = false;
        cameraCtrl.currentLookAt.copy(targetPos);
        ui.exitSecondary();
        ui.updateHUD(targetFocusObj);
    });
}

// Escape and Enter key mapping
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (ui.isOpen) {
            ui.close();
            if (mode === 'galaxy') cameraCtrl.overlayOpen = false;
        } else if (mode === 'secondary') {
            exitSecondaryView();
        }
    } else if (e.key === 'Enter') {
        if (!ui.isOpen) {
            handleInteraction();
        }
    }
});

// Back button
document.getElementById('back-btn')?.addEventListener('click', () => {
    if (ui.isOpen) {
        ui.close();
    } else if (mode === 'secondary') {
        exitSecondaryView();
    }
});

// When overlay closes, re-enable camera (galaxy mode only)
const originalClose = ui.close.bind(ui);
ui.close = () => {
    originalClose();
    if (mode === 'galaxy') cameraCtrl.overlayOpen = false;
};

// ============================================
//  Resize
// ============================================

window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
});

// ============================================
//  Post-Processing (Bloom)
// ============================================

const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.42, // strength
    0.58, // radius
    0.72  // threshold to preserve surface detail and keep only bright edges blooming
);
const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// ============================================
//  Animation loop
// ============================================

const clock = new THREE.Clock();
let lastFocusIndex = -1;

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    star.update(elapsed);
    skybox.update(elapsed, delta);
    planets.forEach(p => p.update(elapsed));

    if (mode === 'galaxy') {
        cameraCtrl.update(delta);

        if (cameraCtrl.focusIndex !== lastFocusIndex) {
            lastFocusIndex = cameraCtrl.focusIndex;
            const target = focusTargets[cameraCtrl.focusIndex];
            ui.updateHUD(target);
            ui.showStarHome(cameraCtrl.isStarFocused());
        }
    } else if (mode === 'secondary') {
        secondaryView.update(delta, elapsed);
    }

    composer.render();
}

animate();
