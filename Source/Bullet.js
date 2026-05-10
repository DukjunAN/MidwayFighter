import * as THREE from 'three';

/**
 * [Module] Bullet
 * 시인성이 대폭 강화된 예광탄 스타일의 탄환입니다.
 */

// 성능 최적화: 탄환 크기를 키우고(0.1 -> 0.8) 예광탄 효과를 위해 길게 설정
const SHARED_BULLET_GEO = new THREE.CapsuleGeometry(0.8, 20.0, 4, 8); 

// 재질 강화: Emissive(발광)를 사용하여 어떤 배경에서도 빛나게 설정
const SHARED_BULLET_MAT = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    emissive: 0xffaa00, // 오렌지색 예광탄 빛
    emissiveIntensity: 5.0,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
});

export class Bullet {
    constructor(scene, startPos, direction, config = {}) {
        this.scene = scene;
        this.mesh = null;
        this.speed = config.speed || 2000; // Rail 모드에 맞춘 초고속
        this.active = true;
        this.maxDistance = config.maxDistance || 15000; // 사거리 연장
        this.distanceTraveled = 0;
        this.direction = direction.clone().normalize();

        this.init(startPos);
    }

    init(startPos) {
        this.mesh = new THREE.Mesh(SHARED_BULLET_GEO, SHARED_BULLET_MAT);
        this.mesh.position.copy(startPos);
        
        // 탄환이 날아가는 방향을 바라보게 설정
        const targetPos = startPos.clone().add(this.direction);
        this.mesh.lookAt(targetPos);
        this.mesh.rotateX(Math.PI / 2); 
        
        this.scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.active || !this.mesh) return;

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
