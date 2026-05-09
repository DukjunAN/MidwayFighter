import * as THREE from 'three';

// 성능 최적화: 모든 탄환이 공유하는 지오메트리와 재질
const SHARED_BULLET_GEO = new THREE.CapsuleGeometry(0.1, 4, 4, 8);
const SHARED_BULLET_MAT = new THREE.MeshBasicMaterial({ 
    color: 0xffff00,
    transparent: true,
    opacity: 0.9
});

export class Bullet {
    constructor(scene, startPos, direction, config = {}) {
        this.scene = scene;
        this.mesh = null;
        this.speed = config.speed || 300; // m/s 기준
        this.active = true;
        this.maxDistance = config.maxDistance || 4000;
        this.distanceTraveled = 0;
        this.direction = direction.clone().normalize();

        this.init(startPos);
    }

    init(startPos) {
        this.mesh = new THREE.Mesh(SHARED_BULLET_GEO, SHARED_BULLET_MAT);
        this.mesh.position.copy(startPos);
        const targetPos = startPos.clone().add(this.direction);
        this.mesh.lookAt(targetPos);
        this.mesh.rotateX(Math.PI / 2); 
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.active || !this.mesh) return;

        // [수정] 프레임 보정(deltaTime)을 적용한 실제 속도 계산
        const moveStep = this.speed * deltaTime;
        this.mesh.position.addScaledVector(this.direction, moveStep);
        this.distanceTraveled += moveStep;

        if (this.distanceTraveled > this.maxDistance) {
            this.destroy();
        }
    }

    destroy() {
        if (!this.active) return;
        this.active = false;
        if (this.mesh) {
            this.scene.remove(this.mesh);
        }
    }
}
