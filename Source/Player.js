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

        const axes = input.getAxis();
        const lerpFactor = 0.05; 

        // [Toy Model: 시각적 기울기 애니메이션]
        // 제공된 시뮬레이션 소스의 기울기 가중치를 적용합니다.
        const maxRollRad = Math.PI / 3; // 60도
        this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, -axes.x * maxRollRad, lerpFactor);
        this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, axes.y * 0.2, lerpFactor);

        // 기체 그룹 회전 (카메라에 자식으로 붙어있는 상태)
        this.planeGroup.rotation.z = (this.currentRoll * 2.0); 
        this.planeGroup.rotation.x = this.currentPitch * 0.5;

        // 회피 기동(Barrel Roll)
        if (this.evadeRoll > 0) {
            const step = deltaTime * 12;
            this.evadeRoll = Math.max(0, this.evadeRoll - step);
            const extraRoll = this.evadeDirection * (Math.PI * 2 - this.evadeRoll);
            this.mesh.rotation.set(0, Math.PI, extraRoll); 
        } else {
            this.mesh.rotation.set(0, Math.PI, 0); 
        }

        const propellerSpeed = 0.3 + (this.currentSpeed / 500) * 1.5;
        const isFiring = input.isFiringUI || input.isPressed('KeyF');
        super.update(propellerSpeed, isFiring);
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
