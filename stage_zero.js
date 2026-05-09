import * as THREE from 'three';
import { Player } from './Source/Player.js';
import { Enemy } from './Source/Enemy.js';
import { EnvironmentManager } from './Source/Environment.js';
import { Input } from './Source/Input.js';

class ZeroInterceptStage {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.player = null;
        this.input = new Input();
        this.environment = null;
        this.enemies = [];
        
        // 스폰 상태 트래킹
        this.aceActive = false;
        this.eliteAceActive = false;
        
        this.spawnTimer15 = 0;
        this.spawnTimer60 = 0;
        
        this.lastTime = performance.now();
        this.textureLoader = new THREE.TextureLoader();
        this.textureCache = new Map();
        
        this.zeroTextures = {
            green: 'Assets/Enemy/A6M Zero/texture/zero green/zero zelená 6_BaseColor.png',
            light_green: 'Assets/Enemy/A6M Zero/texture/zero light green/zero light green _BaseColor.png',
            white: 'Assets/Enemy/A6M Zero/texture/zero white/zero white_BaseColor.png'
        };

        this.init();
    }

    async init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);

        this.environment = new EnvironmentManager(this.scene);
        // EnvironmentManager의 init이 비동기이므로 잠시 대기 (구름 로딩 등)
        await new Promise(r => setTimeout(resolve => {
            if (this.environment.cloudModel) r();
            else {
                const check = setInterval(() => {
                    if (this.environment.cloudModel) { clearInterval(check); r(); }
                }, 100);
            }
        }, 100));

        this.player = new Player(this.scene, this.camera, 'f4f');
        await this.player.init();
        this.player.planeGroup.position.set(0, 500, 0);

        this.setupEventListeners();
        
        // 첫 웨이브 스폰
        this.spawnWave();
        this.showMessage("WAVE START", 2000);
        
        this.animate();
    }

    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    showMessage(text, duration = 3000) {
        const el = document.getElementById('game-msg');
        el.textContent = text;
        el.style.opacity = 1;
        setTimeout(() => { el.style.opacity = 0; }, duration);
    }

    async spawnWave() {
        const pPos = this.player.planeGroup.position;
        const randomX = (Math.random() - 0.5) * 600;
        const randomY = 500 + (Math.random() - 0.5) * 200;
        
        const offsets = [
            { dx: 0, dy: 0, dz: 0 },
            { dx: -70, dy: 20, dz: 100 },
            { dx: 70, dy: -20, dz: 100 }
        ];

        let hasAceInThisWave = false;

        for (const offset of offsets) {
            let variant = 'green';
            
            // 에이스(엷은 녹색) 출현 조건
            if (!this.aceActive && !hasAceInThisWave) {
                variant = 'light_green';
                hasAceInThisWave = true;
                this.aceActive = true;
            }

            const enemy = new Enemy(this.scene, 'zero', variant);
            await enemy.load();
            await this.applyCachedTexture(enemy.mesh, this.zeroTextures[variant]);
            enemy.spawnAt(pPos.x + randomX + offset.dx, randomY + offset.dy, pPos.z - 2500 + offset.dz);
            this.enemies.push(enemy);
        }
    }

    async spawnElite() {
        const pPos = this.player.planeGroup.position;
        const enemy = new Enemy(this.scene, 'zero', 'white');
        await enemy.load();
        await this.applyCachedTexture(enemy.mesh, this.zeroTextures['white']);
        enemy.spawnAt(pPos.x, 600, pPos.z - 3000);
        this.enemies.push(enemy);
        this.eliteAceActive = true;
        this.showMessage("!!! ELITE ACE DETECTED !!!", 4000);
    }

    async applyCachedTexture(mesh, path) {
        let tex = this.textureCache.get(path);
        if (!tex) {
            tex = await new Promise(res => this.textureLoader.load(path, t => {
                t.flipY = false;
                t.colorSpace = THREE.SRGBColorSpace;
                res(t);
            }));
            this.textureCache.set(path, tex);
        }
        mesh.traverse(c => {
            if (c.isMesh && c.material && !/glass|canopy/i.test(c.name)) {
                const mats = Array.isArray(c.material) ? c.material : [c.material];
                mats.forEach(m => { m.map = tex; m.needsUpdate = true; });
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const now = performance.now();
        const deltaTime = Math.min(0.1, (now - this.lastTime) / 1000);
        this.lastTime = now;

        // 1. 입력 및 플레이어 업데이트
        this.input.update(deltaTime);
        if (this.player && this.player.isLoaded) {
            this.player.update(this.input, deltaTime);
            if (this.environment) this.environment.update(deltaTime, 0, this.camera.position);
            this.updatePlayerHUD();
        }

        // 2. 스폰 타이머 업데이트
        this.spawnTimer15 += deltaTime;
        this.spawnTimer60 += deltaTime;

        if (this.spawnTimer15 >= 15.0) {
            this.spawnWave();
            this.spawnTimer15 = 0;
        }

        if (this.spawnTimer60 >= 60.0) {
            if (!this.eliteAceActive) this.spawnElite();
            this.spawnTimer60 = 0;
        }

        // 3. 적 업데이트 및 관리
        let nearest = null;
        let minDist = Infinity;
        const pPos = this.player.planeGroup.position;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.isLoaded) continue;

            e.update(pPos);
            const d = e.mesh.position.distanceTo(pPos);
            if (d < minDist) { minDist = d; nearest = e; }

            // 이탈 처리 (플레이어 뒤 2km)
            if (e.mesh.position.z > pPos.z + 2000) {
                this.removeEnemy(i);
            }
        }

        this.updateEnemyHUD(nearest, minDist);
        
        // 사격 및 충돌 판정 (단순화된 거리 기반 격추)
        if (this.input.isPressed('KeyF') && nearest && minDist < 600) {
            // 정면 조준 시 데미지 (현재는 단순 클릭/거리 기반 시뮬레이션)
            // 실제 게임에서는 탄환 궤적 계산이 필요하지만, 여기선 테스트 목적으로 HP 감소 적용
            nearest.hp -= 2; 
            if (nearest.hp <= 0) {
                nearest.explode();
                const idx = this.enemies.indexOf(nearest);
                if (idx !== -1) this.removeEnemy(idx);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }

    removeEnemy(idx) {
        const e = this.enemies[idx];
        if (e.variant === 'light_green') this.aceActive = false;
        if (e.variant === 'white') this.eliteAceActive = false;
        e.destroy();
        this.enemies.splice(idx, 1);
    }

    updatePlayerHUD() {
        document.getElementById('p-speed').textContent = Math.round(this.player.currentSpeed);
        document.getElementById('p-alt').textContent = Math.round(this.player.planeGroup.position.y);
        const hpFill = document.getElementById('p-hp-fill');
        hpFill.style.width = (this.player.hp / this.player.maxHp * 100) + '%';
        hpFill.style.background = this.player.hp < 50 ? '#ff0000' : '#00ff00';
    }

    updateEnemyHUD(nearest, dist) {
        const indicator = document.getElementById('target-indicator');
        if (nearest) {
            document.getElementById('e-type').textContent = nearest.variant.toUpperCase() + " ZERO";
            document.getElementById('e-dist').textContent = Math.round(dist);
            document.getElementById('e-state').textContent = nearest.state;

            const screenPos = nearest.mesh.position.clone().project(this.camera);
            if (screenPos.z < 1 && Math.abs(screenPos.x) < 1.1 && Math.abs(screenPos.y) < 1.1) {
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                indicator.style.display = 'block';
                indicator.style.left = x + 'px';
                indicator.style.top = y + 'px';
                indicator.style.borderColor = nearest.isLockable ? '#00ff00' : '#ff0000';
            } else { indicator.style.display = 'none'; }
        } else {
            indicator.style.display = 'none';
            document.getElementById('e-type').textContent = "-";
            document.getElementById('e-dist').textContent = "0";
            document.getElementById('e-state').textContent = "-";
        }
    }
}

new ZeroInterceptStage();
