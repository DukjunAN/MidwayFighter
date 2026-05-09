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
        this.maxSpeed = 512;
        this.currentSpeed = this.avgSpeed;
        
        this.boostTimer = 0;
        this.maxBoostTime = 3.0; 
        this.isOverheated = false;
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
        
        this.camera.position.set(0, this.camHeight, this.camDist);
        this.camera.rotation.set(THREE.MathUtils.degToRad(this.camPitchDeg), 0, 0);
        this.planeGroup.add(this.camera);

        this.scene.add(this.planeGroup); 
        this.planeGroup.position.set(0, this.altitude, 0);
        this.mesh.position.set(0, 0, 0); 
        this.mesh.rotation.set(0, Math.PI, 0); 
    }

    update(input, deltaTime) {
        if (!this.isLoaded) return;

        this.handleSpeed(input, deltaTime);

        const axes = input.getAxis();
        // [골든 세팅] 0.01 보간 계수 엄수
        const lerpFactor = 1 - Math.pow(1 - 0.01, deltaTime * 60);
        
        this.currentRoll += (axes.x - this.currentRoll) * lerpFactor;
        this.currentPitch += (axes.y - this.currentPitch) * lerpFactor;
        this.currentYaw -= this.currentRoll * (deltaTime * 0.2); 

        const moveSpeed = this.currentSpeed / 3.6;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.planeGroup.quaternion);
        this.planeGroup.position.add(forward.multiplyScalar(moveSpeed * deltaTime));

        // [수정] 표준 게임 조작(Uninverted) 기준: 양수(+) 입력 시 기수 상승
        const maxRollRad = Math.PI / 3; 
        const maxPitchRad = Math.PI / 6; 
        
        const targetEuler = new THREE.Euler(
            this.currentPitch * maxPitchRad, // 마이너스 부호 제거: y=1(W)일 때 기수 상승
            this.currentYaw, 
            -this.currentRoll * maxRollRad,
            'YXZ'
        );
        this.planeGroup.quaternion.setFromEuler(targetEuler);

        super.update(0.2 + (this.currentSpeed / 512) * 0.8, input.isFiring);
    }

    handleSpeed(input, deltaTime) {
        let targetSpeed = this.avgSpeed;
        if (input.throttle > 0.5) {
            const t = (input.throttle - 0.5) * 2;
            targetSpeed = THREE.MathUtils.lerp(this.avgSpeed, this.maxSpeed, t);
        } else {
            const t = input.throttle * 2;
            targetSpeed = THREE.MathUtils.lerp(this.minSpeed, this.avgSpeed, t);
        }

        if (this.isOverheated) {
            this.currentSpeed -= deltaTime * 200;
            if (this.currentSpeed <= this.avgSpeed) {
                this.currentSpeed = this.avgSpeed;
                this.isOverheated = false;
            }
        } else {
            const accelRate = input.throttle > 0.5 ? 150 : 200;
            const diff = targetSpeed - this.currentSpeed;
            this.currentSpeed += diff * deltaTime * (accelRate / 100);
            if (this.currentSpeed >= this.maxSpeed * 0.95) {
                this.boostTimer += deltaTime;
                if (this.boostTimer >= this.maxBoostTime) this.isOverheated = true;
            } else {
                this.boostTimer = Math.max(0, this.boostTimer - deltaTime * 0.5);
            }
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp < 0) this.hp = 0;
    }
}
