import * as THREE from 'three';
import { BaseAircraft } from './BaseAircraft.js';
import { AircraftPresets } from './AircraftPresets.js';

export const ENEMY_STATE = {
    SPAWN: 'SPAWN',
    APPROACH: 'APPROACH', 
    ENGAGE: 'ENGAGE',     
    TURN_BACK: 'TURN_BACK', 
    SWOOSH: 'SWOOSH',     
    EXIT: 'EXIT'          
};

const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _v = new THREE.Vector3();
const _qTarget = new THREE.Quaternion(); // [추가] 목표 회전값

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

export class Enemy extends BaseAircraft {
    constructor(scene, type = 'zero', variant = 'green') {
        const config = AircraftPresets[type] || AircraftPresets['zero'];
        super(scene, config);
        
        this.type = type;
        this.variant = variant;
        this.active = false;
        this.state = ENEMY_STATE.SPAWN;
        
        this.targetPos = new THREE.Vector3(0, 0, 0);
        // [수정] 플레이어의 빠른 속도에 맞춰 적기 속도 대폭 상향
        this.speed = (config.stats.speed || 1.2) * 5.0; 
        this.baseSpeed = this.speed;
        
        this.hp = config.stats.hp;
        this.isFiring = false;
        this.time = 0;
        this.spawnPos = new THREE.Vector3();
        this.swooshDir = null; 

        this.placeholder = this.createPlaceholder();
        this.scene.add(this.placeholder);

        this.init();
    }

    createPlaceholder() {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; 
        ctx.beginPath(); ctx.arc(16, 16, 10, 0, Math.PI * 2); ctx.fill();
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.9 });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(15, 15, 1);
        sprite.visible = false;
        return sprite;
    }

    async init() {
        await this.load();
        if (this.mesh) this.mesh.visible = false;
    }

    async applyVariantTexture() {
        const texPath = this.variant === 'light_green' 
            ? 'Assets/Enemy/A6M Zero/texture/zero light green/zero light green _BaseColor.png'
            : 'Assets/Enemy/A6M Zero/texture/zero green/zero zelená 6_BaseColor.png';
        let texture = textureCache.get(texPath);
        if (!texture) {
            texture = await new Promise(resolve => {
                textureLoader.load(texPath, (t) => {
                    t.flipY = false;
                    t.colorSpace = THREE.SRGBColorSpace;
                    resolve(t);
                });
            });
            textureCache.set(texPath, texture);
        }
        this.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    if (!/glass|canopy|window/i.test(child.name)) {
                        m.map = texture;
                        m.needsUpdate = true;
                    }
                });
            }
        });
    }

    update(playerPos) {
        if (!this.active || !this.isLoaded || !this.mesh) {
            if (this.mesh) this.mesh.visible = false;
            if (this.placeholder) this.placeholder.visible = false;
            return;
        }
        const currentPos = this.mesh.position;
        const distanceToPlayer = currentPos.distanceTo(playerPos);
        this.time += 0.01;
        this.handleStateTransitions(distanceToPlayer);
        this.executeStateLogic(playerPos);
        super.update(0.1, this.isFiring);
    }

    handleStateTransitions(distance) {
        if (this.state === ENEMY_STATE.EXIT) return;
        if (distance < 150 && this.state !== ENEMY_STATE.SWOOSH) {
            this.state = ENEMY_STATE.SWOOSH;
            this.swooshDir = null; 
            return;
        }
        if (this.variant === 'light_green') {
            if (this.state === ENEMY_STATE.SPAWN) this.state = ENEMY_STATE.APPROACH;
            if (this.state === ENEMY_STATE.APPROACH && distance < 250) this.state = ENEMY_STATE.SWOOSH;
            else if (this.state === ENEMY_STATE.SWOOSH && distance > 800) this.state = ENEMY_STATE.TURN_BACK;
            else if (this.state === ENEMY_STATE.TURN_BACK && distance < 600) this.state = ENEMY_STATE.ENGAGE;
        } else {
            if (distance > 2500) this.state = ENEMY_STATE.APPROACH;
            else if (distance > 200) this.state = ENEMY_STATE.ENGAGE;
            else this.state = ENEMY_STATE.SWOOSH;
        }
    }

    executeStateLogic(target) {
        const currentPos = this.mesh.position;
        _target.copy(target); 
        let speedMult = 1.0;

        switch (this.state) {
            case ENEMY_STATE.APPROACH:
                this.mesh.visible = true;
                this.placeholder.visible = true;
                this.placeholder.position.copy(currentPos);
                break;
            case ENEMY_STATE.ENGAGE:
                this.mesh.visible = true;
                this.placeholder.visible = false;
                this.isFiring = currentPos.distanceTo(target) < 600;
                _target.x += 40; _target.y += 20;
                break;
            case ENEMY_STATE.TURN_BACK:
                this.mesh.visible = true;
                this.placeholder.visible = false;
                speedMult = 1.1;
                break;
            case ENEMY_STATE.SWOOSH:
                this.mesh.visible = true;
                this.placeholder.visible = false;
                speedMult = 1.3; 
                if (!this.swooshDir) {
                    const ox = (Math.random() > 0.5 ? 1 : -1) * 120;
                    const oy = (Math.random() > 0.5 ? 1 : -1) * 60;
                    _v.set(target.x + ox, target.y + oy, target.z);
                    this.swooshDir = new THREE.Vector3().subVectors(_v, currentPos).normalize();
                }
                _target.copy(currentPos).add(this.swooshDir);
                if (currentPos.distanceTo(target) > 500 && currentPos.z > target.z) {
                    this.state = this.variant === 'light_green' ? ENEMY_STATE.TURN_BACK : ENEMY_STATE.EXIT;
                    this.swooshDir = null;
                }
                break;
            case ENEMY_STATE.EXIT:
                this.mesh.visible = true;
                speedMult = 1.5;
                _v.set(0, 0, -1).applyQuaternion(this.mesh.quaternion);
                _target.copy(currentPos).add(_v);
                break;
        }
        this.moveTowards(_target, this.baseSpeed * speedMult);
    }

    moveTowards(target, speed) {
        // [수정] 떨림 방지: 부드러운 방향 회전 및 이동 로직
        _dir.subVectors(target, this.mesh.position).normalize();
        this.mesh.position.addScaledVector(_dir, speed);
        
        // 목표 방향 벡터(LookAt) 설정
        _v.copy(this.mesh.position).add(_dir);
        
        // 1. 임시 객체로 목표 회전값 계산
        const dummy = new THREE.Object3D();
        dummy.position.copy(this.mesh.position);
        dummy.lookAt(_v);
        dummy.rotateY(Math.PI); // 모델 정면 보정
        _qTarget.copy(dummy.quaternion);
        
        // 2. 현재 회전에서 목표 회전으로 부드럽게 보간 (Slerp)
        // 보간 계수 0.1로 부드러운 선회 구현
        this.mesh.quaternion.slerp(_qTarget, 0.1);
    }

    spawnAt(x, y, z) {
        if (this.mesh) {
            this.mesh.position.set(x, y, z);
            this.spawnPos.copy(this.mesh.position);
            this.state = ENEMY_STATE.APPROACH;
            this.time = 0;
            this.active = true;
            this.mesh.visible = true;
        }
    }

    destroy() {
        this.active = false;
        if (this.mesh) this.mesh.visible = false;
        if (this.placeholder) this.placeholder.visible = false;
    }
}
