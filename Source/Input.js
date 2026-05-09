import * as THREE from 'three';

/**
 * [Module] Input
 * 키보드 및 마우스 조작을 독립적으로 처리하여 충돌을 방지합니다.
 * WASD/화살표 키 조작을 최우선으로 보장합니다.
 */
export class Input {
    constructor() {
        this.keys = {};
        this.throttle = 0.5; 
        this.isFiring = false;
        this.invertPitch = false;

        // 마우스/터치 드래그 상태
        this.drag = {
            active: false,
            start: new THREE.Vector2(),
            delta: new THREE.Vector2()
        };

        // 전역 이벤트 리스너 등록
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    }

    update(deltaTime) {
        // 속도 조절 (Shift/Ctrl)
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
            this.throttle = Math.min(1.0, this.throttle + deltaTime * 0.5);
        }
        if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
            this.throttle = Math.max(0.0, this.throttle - deltaTime * 0.5);
        }
    }

    getAxis() {
        let kX = 0;
        let kY = 0;
        let mX = 0;
        let mY = 0;

        // 1. 키보드 입력 계산 (최우선)
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) kX -= 1;
        if (this.keys['ArrowRight'] || this.keys['KeyD']) kX += 1;
        if (this.keys['ArrowUp'] || this.keys['KeyW']) kY += 1;   
        if (this.keys['ArrowDown'] || this.keys['KeyS']) kY -= 1; 

        // 2. 마우스 드래그 입력 계산 (합산)
        if (this.drag.active) {
            mX = THREE.MathUtils.clamp(this.drag.delta.x / 250, -1, 1);
            mY = -THREE.MathUtils.clamp(this.drag.delta.y / 250, -1, 1);
        }

        // 키보드와 마우스 값을 안전하게 합산 후 제한
        let finalX = THREE.MathUtils.clamp(kX + mX, -1, 1);
        let finalY = THREE.MathUtils.clamp(kY + mY, -1, 1);

        // 인버트 옵션 적용
        if (this.invertPitch) finalY *= -1;

        return { x: finalX, y: finalY };
    }

    isPressed(code) {
        return !!this.keys[code];
    }
}
