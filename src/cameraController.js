import * as THREE from 'three';

/**
 * Camera controller for the galaxy blog.
 *
 * Features:
 *  - Mouse movement rotates view in the same direction
 *  - Mouse at screen edges auto-rotates continuously
 *  - Smooth focus switching with wrap-around (scroll / arrow keys)
 *  - Panoramic zoom-out on right-click hold
 */
export class CameraController {
    constructor(camera, focusTargets) {
        this.camera = camera;
        this.targets = focusTargets;
        this.focusIndex = 0; // default: star

        // Spherical coords relative to target
        this.spherical = { theta: 0.3, phi: 1.2 };
        this.baseRadius = 5.0;
        this.panoramaRadius = 60.0;

        // Smooth interpolation
        this.currentLookAt = new THREE.Vector3();
        this._targetPos = new THREE.Vector3();
        this._lookAtTarget = new THREE.Vector3();
        this._offset = new THREE.Vector3();
        this._desiredCamPos = new THREE.Vector3();
        this._origin = new THREE.Vector3(0, 0, 0);

        // Mouse state
        this.mouseX = window.innerWidth / 2;
        this.mouseY = window.innerHeight / 2;
        this.isRightDown = false;
        this.zoomFactor = 0;
        this.mouseSensitivity = 0.003;

        // Edge auto-rotate config
        this.edgeZone = 80; // pixels from edge to trigger auto-rotate
        this.edgeRotateSpeed = 1.8; // max radians/sec at the very edge

        // Switch lock
        this.switching = false;
        this.switchCooldown = 0;

        // Overlay open — pause orbit
        this.overlayOpen = false;

        this._bindEvents();
    }

    _bindEvents() {
        // Mouse move — orbit via movement deltas + track position for edge detection
        window.addEventListener('mousemove', (e) => {
            // Track position for edge auto-rotation
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            if (this.overlayOpen) return;

            // Direct rotation from mouse movement
            // Right movement → theta increases → view turns right
            this.spherical.theta += e.movementX * this.mouseSensitivity;
            // Up movement (negative movementY) → phi decreases → camera rises → view goes up
            this.spherical.phi -= e.movementY * this.mouseSensitivity;
            // Clamp phi
            this.spherical.phi = Math.max(0.3, Math.min(Math.PI - 0.3, this.spherical.phi));
        });

        // Scroll — switch focus
        window.addEventListener('wheel', (e) => {
            if (this.overlayOpen) return;
            if (this.switchCooldown > 0) return;
            if (e.deltaY < 0) this.switchFocus(1);
            else if (e.deltaY > 0) this.switchFocus(-1);
        }, { passive: true });

        // Arrow keys
        window.addEventListener('keydown', (e) => {
            if (this.overlayOpen) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.switchFocus(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                e.preventDefault();
                this.switchFocus(-1);
            }
        });

        // Right-click — panorama
        window.addEventListener('mousedown', (e) => {
            if (e.button === 2) this.isRightDown = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (e.button === 2) this.isRightDown = false;
        });

        // Prevent context menu
        window.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    switchFocus(direction) {
        if (this.switchCooldown > 0) return;
        let newIndex = this.focusIndex + direction;
        if (newIndex < 0) newIndex = this.targets.length - 1;
        else if (newIndex >= this.targets.length) newIndex = 0;
        this.focusIndex = newIndex;
        this.switching = true;
        this.switchCooldown = 0.6;
    }

    getFocusedTarget() {
        return this.targets[this.focusIndex];
    }

    getFocusPose(index = this.focusIndex) {
        const target = this.targets[index];
        if (!target) return null;

        const targetPos = target.getWorldPosition(this._targetPos);
        const targetZoom = index === 0 && !this.overlayOpen ? 1.0 : 0.0;
        const targetSize = target.config.size || 2.2;
        const normalRadius = this.baseRadius + targetSize * 1.5;
        const currentRadius = THREE.MathUtils.lerp(normalRadius, this.panoramaRadius, targetZoom);

        const sinPhi = Math.sin(this.spherical.phi);
        const cosPhi = Math.cos(this.spherical.phi);
        const sinTheta = Math.sin(this.spherical.theta);
        const cosTheta = Math.cos(this.spherical.theta);

        this._offset.set(
            currentRadius * sinPhi * cosTheta,
            currentRadius * cosPhi,
            currentRadius * sinPhi * sinTheta
        );

        this._lookAtTarget.lerpVectors(
            targetPos,
            this._origin,
            targetZoom * 0.85
        );
        this._desiredCamPos.copy(this._lookAtTarget).add(this._offset);

        return {
            cameraPos: this._desiredCamPos.clone(),
            lookAt: this._lookAtTarget.clone()
        };
    }

    snapToFocus(index = this.focusIndex) {
        const pose = this.getFocusPose(index);
        if (!pose) return;

        this.focusIndex = index;
        this.switching = false;
        this.switchCooldown = 0;
        this.currentLookAt.copy(pose.lookAt);
        this.camera.position.copy(pose.cameraPos);
        this.camera.lookAt(pose.lookAt);
    }

    isStarFocused() {
        return this.focusIndex === 0;
    }

    update(deltaTime) {
        if (this.switchCooldown > 0) {
            this.switchCooldown -= deltaTime;
        }

        // ---- Edge auto-rotation ----
        if (!this.overlayOpen) {
            const w = window.innerWidth;
            const ez = this.edgeZone;

            // Left edge
            if (this.mouseX < ez) {
                const strength = 1.0 - this.mouseX / ez; // 1 at edge, 0 at boundary
                this.spherical.theta -= this.edgeRotateSpeed * strength * deltaTime;
            }
            // Right edge
            else if (this.mouseX > w - ez) {
                const strength = 1.0 - (w - this.mouseX) / ez;
                this.spherical.theta += this.edgeRotateSpeed * strength * deltaTime;
            }
        }

        const target = this.targets[this.focusIndex];
        if (!target) return;

        const targetPos = target.getWorldPosition(this._targetPos);

        // Smooth look-at interpolation
        const lerpSpeed = this.switching ? 2.5 : 6.0;
        this.currentLookAt.lerp(targetPos, lerpSpeed * deltaTime);

        if (this.switching && this.currentLookAt.distanceTo(targetPos) < 0.15) {
            this.switching = false;
        }

        // Panorama zoom logic: right-click, OR auto-panorama when focusing the star
        let targetZoom = 0;
        if (this.isRightDown && !this.overlayOpen) {
            targetZoom = 1.0;
        } else if (this.focusIndex === 0 && !this.overlayOpen) {
            targetZoom = 1.0; // Auto panorama for star
        }

        if (this.zoomFactor < targetZoom) {
            this.zoomFactor = Math.min(targetZoom, this.zoomFactor + deltaTime * 1.5); // Fast zoom in 
        } else {
            this.zoomFactor = Math.max(targetZoom, this.zoomFactor - deltaTime * 1.2);
        }

        // Effective radius
        const targetSize = target.config.size || 2.2;
        const normalRadius = this.baseRadius + targetSize * 1.5;
        const currentRadius = THREE.MathUtils.lerp(normalRadius, this.panoramaRadius, this.zoomFactor);

        // Spherical to Cartesian
        const sinPhi = Math.sin(this.spherical.phi);
        const cosPhi = Math.cos(this.spherical.phi);
        const sinTheta = Math.sin(this.spherical.theta);
        const cosTheta = Math.cos(this.spherical.theta);

        this._offset.set(
            currentRadius * sinPhi * cosTheta,
            currentRadius * cosPhi,
            currentRadius * sinPhi * sinTheta
        );

        // When zooming out, blend look-at toward origin
        this._lookAtTarget.lerpVectors(
            this.currentLookAt,
            this._origin,
            this.zoomFactor * 0.85
        );

        this._desiredCamPos.copy(this._lookAtTarget).add(this._offset);

        this.camera.position.lerp(this._desiredCamPos, 5.8 * deltaTime);
        this.camera.lookAt(this._lookAtTarget);
    }
}
