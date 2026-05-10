import * as THREE from 'three';

/**
 * [Module] Input
 * 키보드 조작의 정밀도를 높이기 위해 '누적 입력 시스템'을 적용했습니다.
 * 이제 키보드로도 마우스 드래그처럼 미세한 조준이 가능합니다.
 */
export class Input {
    constructor() {
        this.keys = {};
        this.throttle = 0.5; 
        this.isFiringUI = false; 
        this.invertPitch = false;

        // [추가] 키보드 누적 가상 조이스틱 값
        this.kAxis = new THREE.Vector2(0, 0);

        // 특수 기동 상태
        this.boostActive = false;
        this.evadeDirection = 0; 

        // 마우스/터치 드래그 상태
        this.drag = {
            active: false,
            delta: new THREE.Vector2()
        };

        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }

    activateBoost() {
        this.boostActive = true;
    }

    activateEvade(direction) {
        this.evadeDirection = direction;
    }

    update(deltaTime) {
        // 1. 속도 조절
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.throttle = Math.min(1.0, this.throttle + deltaTime * 0.5);
        }
        if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
            this.throttle = Math.max(0.0, this.throttle - deltaTime * 0.5);
        }

        // 2. [핵심] 키보드 입력 스무딩 (누적 방식)
        // 키를 누르고 있으면 값이 서서히 증가하고, 떼면 멈추거나 서서히 복귀합니다.
        const sensitivity = 1.8; // 2.5 -> 1.8 (키보드 속도 하향)
        const friction = 2.2;    // 3.0 -> 2.2 (복귀 속도 하향)

        let targetKX = 0;
        let targetKY = 0;

        if (this.keys['ArrowLeft'] || this.keys['KeyA']) targetKX -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) targetKX += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) targetKY += 1;
        if (this.keys['ArrowDown'] || this.keys['KeyS']) targetKY -= 1;

        // X축 보간
        if (targetKX !== 0) {
            this.kAxis.x += targetKX * sensitivity * deltaTime;
        } else {
            // 키를 떼면 중앙으로 서서히 복귀 (원하는 곳에서 멈추기 쉽게)
            this.kAxis.x -= Math.sign(this.kAxis.x) * friction * deltaTime;
            if (Math.abs(this.kAxis.x) < 0.1) this.kAxis.x = 0;
        }

        // Y축 보간
        if (targetKY !== 0) {
            this.kAxis.y += targetKY * sensitivity * deltaTime;
        } else {
            this.kAxis.y -= Math.sign(this.kAxis.y) * friction * deltaTime;
            if (Math.abs(this.kAxis.y) < 0.1) this.kAxis.y = 0;
        }

        this.kAxis.x = THREE.MathUtils.clamp(this.kAxis.x, -1, 1);
        this.kAxis.y = THREE.MathUtils.clamp(this.kAxis.y, -1, 1);
    }

    getAxis() {
        let mX = 0;
        let mY = 0;

        // 마우스 드래그 입력 (감도 하향 조정)
        if (this.drag.active) {
            mX = THREE.MathUtils.clamp(this.drag.delta.x / 400, -1, 1); // 250 -> 400
            mY = -THREE.MathUtils.clamp(this.drag.delta.y / 400, -1, 1);
        }

        // 키보드 누적 값과 마우스 값을 합산
        let finalX = THREE.MathUtils.clamp(this.kAxis.x + mX, -1, 1);
        let finalY = THREE.MathUtils.clamp(this.kAxis.y + mY, -1, 1);

        if (this.invertPitch) finalY *= -1;

        return { x: finalX, y: finalY };
    }

    isPressed(code) {
        return !!this.keys[code];
    }
}
