import * as THREE from 'three';
import { BaseAircraft } from './BaseAircraft.js';
import { AircraftPresets } from './AircraftPresets.js';

export class Player extends BaseAircraft {
    constructor(scene, camera, type = 'f4f') {
        const config = AircraftPresets[type];
        super(scene, config);
        
        this.camera = camera;
        this.planeGroup = new THREE.Group();
        
        this.currentPitch = 0;
        this.currentRoll = 0;
        this.currentYaw = 0;
        
        this.hp = config.stats.hp;
        this.maxHp = config.stats.hp;
        this.minSpeed = 130;
        this.avgSpeed = 250;
        this.maxSpeed = 500;
        this.currentSpeed = this.avgSpeed;
        
        this.boostTimer = 0;
        this.maxBoostTime = 3.0; 
        this.isOverheated = false;
        
        // 특수 기동 상태
        this.evadeRoll = 0;
        this.evadeDirection = 0;
        this.isBoosting = false;
        this.boostDuration = 0;

        this.fireRate = config.stats.fireRate;

        this.camDist = 30.0;      
        this.camHeight = 22.0;    
        this.camPitchDeg = -35.0; 

        this.init();
    }

    async init() {
        await this.load();
        this.planeGroup.add(this.mesh);
        this.mesh.visible = true;
        
        this.scene.add(this.planeGroup); 
        this.planeGroup.position.set(0, this.altitude, 0);
        this.mesh.position.set(0, 0, 0); 
        this.mesh.rotation.set(0, Math.PI, 0); 
    }

    update(input, deltaTime) {
        if (!this.isLoaded) return;

        // 특수 기동 트리거
        if (input.boostActive) {
            this.isBoosting = true;
            this.boostDuration = 2.0;
            input.boostActive = false;
        }
        if (input.evadeDirection !== 0 && this.evadeRoll === 0) {
            this.evadeDirection = input.evadeDirection;
            this.evadeRoll = Math.PI * 2;
            input.evadeDirection = 0;
        }

        this.handleSpeed(input, deltaTime);

        const axes = input.getAxis(); // x: 좌우, y: 상하 (-1 ~ 1)
        // [골든 세팅] 묵직한 조작감을 위해 0.01 보간 사용
        const lerpFactor = 0.01;

        // --- [상하 조작: 고정형 레일 방식] ---
        // 기체는 화면 하단(-120)을 기준으로 상하 범위를 아주 좁게 제한하여 
        // 카메라 시야와 항상 일정한 간격을 유지하게 합니다.
        const planeTargetY = -120 + (axes.y * 30); // 상하 가동폭 최소화 (±30)
        this.planeGroup.position.y += (planeTargetY - this.planeGroup.position.y) * lerpFactor;

        // 상하 카메라는 건사이트가 기체 코앞에 붙어있는 느낌을 주도록 
        // 기체 위치보다 약간 높은 곳을 고정적으로 바라봅니다.
        const lookAtY = planeTargetY + 60; // 기체보다 항상 60유닛 위를 주시 (겹침 방지)

        // --- [좌우 조작: 다이내믹 방식 유지] ---
        const planeTargetX = axes.x * 120; 
        this.planeGroup.position.x += (planeTargetX - this.planeGroup.position.x) * lerpFactor;
        
        const lookAtX = axes.x * 250; 
        // ------------------------------------------

        // 최종 카메라 주시 포인트 적용 (월드 좌표 기준 오프셋)
        const targetLookAt = new THREE.Vector3(
            this.camera.position.x + lookAtX, 
            this.camera.position.y + lookAtY, 
            this.camera.position.z - 1000
        );
        this.camera.lookAt(targetLookAt);

        // [회전 및 기울기 설정]
        const maxRollRad = Math.PI / 3;    // 좌우 기울기 60도
        const maxPitchRad = Math.PI / 18;  // 상하 각도는 10도 내외로 극소화 (시야 확보)

        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, -axes.x * maxRollRad, lerpFactor);
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, axes.y * maxPitchRad, lerpFactor);
        this.currentYaw = THREE.MathUtils.lerp(this.currentYaw, -axes.x * 0.1, lerpFactor);

        this.planeGroup.rotation.set(-this.currentPitch, this.currentYaw, this.currentRoll, 'YXZ');

        // 회피 기동(Barrel Roll) 애니메이션을 비행기 메쉬에만 적용
        if (this.evadeRoll > 0) {
            const step = deltaTime * 12;
            this.evadeRoll = Math.max(0, this.evadeRoll - step);
            const extraRoll = this.evadeDirection * (Math.PI * 2 - this.evadeRoll);
            this.mesh.rotation.set(0, Math.PI, extraRoll); 
        } else {
            this.mesh.rotation.set(0, Math.PI, 0); 
        }

        const propellerSpeed = 0.3 + (this.currentSpeed / 500) * 1.5;
        super.update(propellerSpeed, input.isFiringUI);

        // 시야각 연출 (속도감 체감 강화)
        const speedFactor = (this.currentSpeed - this.minSpeed) / (this.maxSpeed - this.minSpeed);
        const targetFOV = 75 + speedFactor * 35; 
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.1);
        this.camera.updateProjectionMatrix();
    }

    handleSpeed(input, deltaTime) {
        let targetSpeed = this.avgSpeed;
        
        // 부스트 상태 처리
        if (this.isBoosting) {
            targetSpeed = this.maxSpeed * 1.1; // 일시적 한계 돌파
            this.boostDuration -= deltaTime;
            if (this.boostDuration <= 0) this.isBoosting = false;
        } else if (input.throttle > 0.5) {
            const t = (input.throttle - 0.5) * 2;
            targetSpeed = THREE.MathUtils.lerp(this.avgSpeed, this.maxSpeed, t);
        } else {
            const t = input.throttle * 2;
            targetSpeed = THREE.MathUtils.lerp(this.minSpeed, this.avgSpeed, t);
        }

        // 피치(Pitch)에 따른 속도 변화 계산 (상승 시 감속, 하강 시 가속)
        // currentPitch: -1 (하강/피치다운) ~ 1 (상승/피치업) 기준
        let pitchFactor = 0;
        if (this.currentPitch > 0) { // 피치업 (상승)
            pitchFactor = -this.currentPitch * 0.3; // 최대 30% 감소
        } else if (this.currentPitch < 0) { // 피치다운 (하강)
            pitchFactor = -this.currentPitch * 0.3; // 최대 30% 증가 (음수 * 음수 = 양수)
        }
        targetSpeed *= (1 + pitchFactor);

        if (this.isOverheated) {
            this.currentSpeed -= deltaTime * 200;
            if (this.currentSpeed <= this.avgSpeed) {
                this.currentSpeed = this.avgSpeed;
                this.isOverheated = false;
            }
        } else {
            const accelRate = (this.isBoosting || input.throttle > 0.5) ? 150 : 200;
            const diff = targetSpeed - this.currentSpeed;
            this.currentSpeed += diff * deltaTime * (accelRate / 100);
            
            // 과열 시스템
            if (!this.isBoosting && this.currentSpeed >= this.maxSpeed * 0.95) {
                this.boostTimer += deltaTime;
                if (this.boostTimer >= this.maxBoostTime) this.isOverheated = true;
            } else {
                this.boostTimer = Math.max(0, this.boostTimer - deltaTime * 0.5);
            }
        }
        
        // 속도 하한치 보장 (실속 방지)
        this.currentSpeed = Math.max(this.minSpeed * 0.5, this.currentSpeed);
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }
}
