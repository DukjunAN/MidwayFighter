import * as THREE from 'three';
import { Player } from './Source/Player.js';
import { Input } from './Source/Input.js';
import { Enemy } from './Source/Enemy.js';
import { Bullet } from './Source/Bullet.js';
import { EnvironmentManager } from './Source/Environment.js';

// 공유 수학 객체 (연산 격리)
const _vRadar = new THREE.Vector3();
const _vSpeedLine = new THREE.Vector3();
const _vTemp = new THREE.Vector3();
const _mRadar = new THREE.Matrix4();

const EXPLOSION_GEO = new THREE.SphereGeometry(1, 12, 12);
const EXPLOSION_MAT = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 1.0 });

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 10, 1000000);
        this.camera.rotation.order = 'YXZ';
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.input = new Input();
        this.player = null;
        this.environment = null;
        this.enemyPool = [];
        this.activeEnemies = [];
        this.explosions = [];
        this.playerBullets = [];
        this.isGameStarted = false;
        this.lastTime = performance.now();
        this.lastFireTime = 0;
        this.lastHudUpdate = 0;
        this.spawnTimer = 0;
        this.windLines = null;
        this.audioListener = new THREE.AudioListener();
        this.sounds = { engine: null, gun: null };
        this.radar = { canvas: null, ctx: null, range: 4000 };
        this.init();
    }

    async init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(1);
        document.body.appendChild(this.renderer.domElement);
        this.camera.add(this.audioListener);
        this.loadSounds();
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(100, 500, 100);
        this.scene.add(sun);
        this.environment = new EnvironmentManager(this.scene);
        this.radar.canvas = document.getElementById('radar-canvas');
        if (this.radar.canvas) this.radar.ctx = this.radar.canvas.getContext('2d');
        
        this.setupUIEvents();

        const startBtn = document.getElementById('start-button');
        if (startBtn) {
            startBtn.innerText = "데이터 최적화 중...";
            await this.preloadModels();
            await this.initializeEnemyPool(5); 
            startBtn.innerText = "게임 시작";
            startBtn.addEventListener('click', () => {
                const invertCheck = document.getElementById('invert-pitch');
                if (invertCheck) this.input.invertPitch = invertCheck.checked;
                this.startGame();
            });
        }
        window.addEventListener('resize', () => this.onWindowResize());
        this.animate();
    }

    setupUIEvents() {
        const throttleHandle = document.getElementById('ui-throttle-handle');
        const throttleContainer = document.getElementById('ui-throttle-container');
        const fireBtn = document.getElementById('ui-fire-btn');
        let isDraggingThrottle = false;

        const updateThrottle = (e) => {
            const rect = throttleContainer.getBoundingClientRect();
            const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
            let val = 1 - (clientY - rect.top) / rect.height;
            val = Math.max(0, Math.min(1, val));
            this.input.throttle = val;
            if (throttleHandle) throttleHandle.style.top = `${(1 - val) * 100}%`;
        };

        throttleContainer.addEventListener('mousedown', (e) => { isDraggingThrottle = true; updateThrottle(e); e.stopPropagation(); });
        throttleContainer.addEventListener('touchstart', (e) => { isDraggingThrottle = true; updateThrottle(e); e.stopPropagation(); }, {passive: false});
        
        fireBtn.addEventListener('mousedown', (e) => { this.input.isFiring = true; fireBtn.classList.add('pressing'); e.stopPropagation(); });
        fireBtn.addEventListener('mouseup', () => { this.input.isFiring = false; fireBtn.classList.remove('pressing'); });
        fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.isFiring = true; fireBtn.classList.add('pressing'); e.stopPropagation(); });
        fireBtn.addEventListener('touchend', () => { this.input.isFiring = false; fireBtn.classList.remove('pressing'); });

        window.addEventListener('mousedown', (e) => {
            if (isDraggingThrottle) return;
            this.input.drag.active = true;
            this.input.drag.start.set(e.clientX, e.clientY);
        });
        window.addEventListener('touchstart', (e) => {
            if (isDraggingThrottle || !e.touches[0]) return;
            this.input.drag.active = true;
            this.input.drag.start.set(e.touches[0].clientX, e.touches[0].clientY);
        }, {passive: false});

        window.addEventListener('mousemove', (e) => { 
            if (isDraggingThrottle) updateThrottle(e); 
            if (this.input.drag.active) this.input.drag.delta.set(e.clientX - this.input.drag.start.x, e.clientY - this.input.drag.start.y);
        });
        window.addEventListener('touchmove', (e) => { 
            if (isDraggingThrottle) updateThrottle(e); 
            if (this.input.drag.active && e.touches[0]) this.input.drag.delta.set(e.touches[0].clientX - this.input.drag.start.x, e.touches[0].clientY - this.input.drag.start.y);
        }, {passive: false});

        window.addEventListener('mouseup', () => { isDraggingThrottle = false; this.input.drag.active = false; });
        window.addEventListener('touchend', () => { isDraggingThrottle = false; this.input.drag.active = false; });
    }

    async preloadModels() {
        const dummyF4F = new Player(this.scene, this.camera, 'f4f');
        await dummyF4F.load(); dummyF4F.destroy();
        const dummyZero = new Enemy(this.scene, 'zero', 'green');
        await dummyZero.load(); await dummyZero.applyVariantTexture(); dummyZero.destroy();
    }

    async initializeEnemyPool(count) {
        for (let i = 0; i < count; i++) {
            const variant = i % 2 === 0 ? 'green' : 'light_green';
            const unit = new Enemy(this.scene, 'zero', variant);
            await unit.load(); await unit.applyVariantTexture(); 
            unit.active = false;
            if (unit.mesh) { unit.mesh.visible = true; unit.mesh.position.set(0, -20000, 0); this.scene.add(unit.mesh); }
            this.enemyPool.push(unit);
        }
        this.renderer.render(this.scene, this.camera);
        this.enemyPool.forEach(u => { if (u.mesh) u.mesh.visible = false; });
    }

    loadSounds() {
        const audioLoader = new THREE.AudioLoader();
        this.sounds.engine = new THREE.Audio(this.audioListener);
        audioLoader.load('Assets/Sound/115270__timbre__bi-plane-dives.wav', (buffer) => {
            this.sounds.engine.setBuffer(buffer); this.sounds.engine.setLoop(true); this.sounds.engine.setVolume(0.1);
        });
        this.sounds.gun = new THREE.Audio(this.audioListener);
        audioLoader.load('Assets/Sound/507137__mrthenoronha__machine-gun-2-8-bit.wav', (buffer) => {
            this.sounds.gun.setBuffer(buffer); this.sounds.gun.setVolume(0.15);
        });
    }

    setupSpeedLines(playerPos) {
        const count = 30; const geometry = new THREE.BufferGeometry(); const positions = new Float32Array(count * 6); 
        const basePos = playerPos || new THREE.Vector3(0, 500, 0);
        for (let i = 0; i < count; i++) {
            const idx = i * 6;
            positions[idx] = basePos.x + (Math.random()-0.5)*300; positions[idx+1] = basePos.y + (Math.random()-0.5)*200; positions[idx+2] = basePos.z - 300 - Math.random()*500;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
        if (this.windLines) this.scene.remove(this.windLines);
        this.windLines = new THREE.LineSegments(geometry, material); this.scene.add(this.windLines);
    }

    updateSpeedLines() {
        if (!this.windLines || !this.player || !this.isGameStarted) return;
        const posAttr = this.windLines.geometry.attributes.position;
        const speedFactor = Math.max(0, (this.player.currentSpeed - 250) / 262); 
        this.windLines.material.opacity = speedFactor * 0.3;
        const playerPos = this.player.planeGroup.position;
        
        _vSpeedLine.set(0, 0, -1).applyQuaternion(this.player.planeGroup.quaternion); 

        for (let i = 0; i < 30; i++) {
            const idx = i * 6;
            _vTemp.set(posAttr.array[idx], posAttr.array[idx+1], posAttr.array[idx+2]);
            if (_vTemp.distanceTo(playerPos) > 600) {
                const offset = _vTemp.set((Math.random()-0.5)*300, (Math.random()-0.5)*200, -300-Math.random()*400).applyQuaternion(this.player.planeGroup.quaternion);
                const p1 = _vTemp.copy(playerPos).add(offset);
                const p2 = _vSpeedLine.clone().multiplyScalar(-30).add(p1);
                posAttr.array[idx]=p1.x; posAttr.array[idx+1]=p1.y; posAttr.array[idx+2]=p1.z;
                posAttr.array[idx+3]=p2.x; posAttr.array[idx+4]=p2.y; posAttr.array[idx+5]=p2.z;
            }
        }
        posAttr.needsUpdate = true;
    }

    async startGame() {
        if (this.audioListener.context.state === 'suspended') await this.audioListener.context.resume();
        this.player = new Player(this.scene, this.camera, 'f4f');
        await this.player.init();
        this.player.planeGroup.position.set(0, 500, 0);
        this.player.update(this.input, 0.01); 
        this.player.planeGroup.updateMatrixWorld(true);
        this.setupSpeedLines(this.player.planeGroup.position);
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';
        if (this.sounds.engine) this.sounds.engine.play();
        this.spawnInFront();
        this.isGameStarted = true;
    }

    spawnInFront() {
        if (!this.player) return;
        const p = this.player.planeGroup.position;
        _vTemp.set(0, 0, -1).applyQuaternion(this.player.planeGroup.quaternion); 
        const spawnPos = _vTemp.multiplyScalar(3000).add(p);
        spawnPos.x += (Math.random()-0.5)*400; spawnPos.y += (Math.random()-0.5)*100;
        this.spawnFromPool(spawnPos.x, spawnPos.y, spawnPos.z, 1);
    }

    spawnFromPool(x, y, z, count = 1) {
        let spawnedCount = 0;
        for (const unit of this.enemyPool) {
            if (!unit.active) {
                unit.active = true; unit.hp = unit.config.stats.hp; unit.spawnAt(x, y, z);
                this.activeEnemies.push(unit); spawnedCount++; if (spawnedCount >= count) break;
            }
        }
    }

    onWindowResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        if (this.isGameStarted && this.player) {
            this.input.update(deltaTime); this.player.update(this.input, deltaTime); this.player.planeGroup.updateMatrixWorld(true);
            this.updateSpeedLines();
            this.player.camera.getWorldPosition(_vTemp);
            if (this.environment) this.environment.update(deltaTime, 0, _vTemp);
            if (this.activeEnemies.length === 0) this.spawnInFront();
            let nearestUnit = null; let minDist = Infinity;
            for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
                const u = this.activeEnemies[i];
                if (u.active) {
                    u.update(this.player.planeGroup.position);
                    const d = u.mesh.position.distanceTo(this.player.planeGroup.position);
                    if (d < minDist) { minDist = d; nearestUnit = u; }
                    if (d > 30000) { u.active = false; this.activeEnemies.splice(i, 1); }
                } else { this.activeEnemies.splice(i, 1); }
            }
            const isFiring = this.input.isPressed('KeyF') || this.input.isFiring;
            if (isFiring && now - this.lastFireTime > this.player.fireRate) {
                const shots = this.player.fire();
                shots.forEach(s => this.playerBullets.push(new Bullet(this.scene, s.position, s.direction, { speed: 400 })));
                if (this.sounds.gun && !this.sounds.gun.isPlaying) this.sounds.gun.play();
                this.lastFireTime = now;
            }
            this.updateBullets(deltaTime); this.updateExplosions(deltaTime);
            if (now - this.lastHudUpdate > 100) { this.updateHUD(nearestUnit, minDist); this.lastHudUpdate = now; }
        }
        this.renderer.render(this.scene, this.camera);
    }

    updateBullets(deltaTime) {
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i]; b.update(deltaTime);
            if (b.active) {
                for (const u of this.activeEnemies) {
                    if (u.active && b.mesh.position.distanceTo(u.mesh.position) < 80) {
                        this.createExplosion(u.mesh.position); u.active = false; b.destroy(); break;
                    }
                }
            }
            if (!b.active) this.playerBullets.splice(i, 1);
        }
    }

    createExplosion(pos) {
        const mesh = new THREE.Mesh(EXPLOSION_GEO, EXPLOSION_MAT);
        mesh.position.copy(pos); mesh.scale.setScalar(15); this.scene.add(mesh);
        this.explosions.push({ mesh, life: 1.0 }); this.triggerHitFlash();
    }

    updateExplosions(deltaTime) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i];
            exp.life -= deltaTime * 2.0; exp.mesh.scale.setScalar(exp.mesh.scale.x + deltaTime * 150);
            if (exp.life <= 0) { this.scene.remove(exp.mesh); this.explosions.splice(i, 1); }
        }
    }

    triggerHitFlash() {
        const flash = document.getElementById('hit-flash');
        if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 50); }
    }

    updateHUD(nearestUnit, minDist) {
        document.getElementById('val-hp').innerText = Math.floor(this.player.hp);
        document.getElementById('val-speed').innerText = Math.floor(this.player.currentSpeed);
        document.getElementById('val-alt').innerText = Math.floor(this.player.planeGroup.position.y);
        document.getElementById('val-units').innerText = this.activeEnemies.length;
        const throttleHandle = document.getElementById('ui-throttle-handle');
        if (throttleHandle) throttleHandle.style.top = `${(1 - this.input.throttle) * 100}%`;
        const spdNeedle = document.getElementById('ui-speed-needle-group');
        if (spdNeedle) spdNeedle.setAttribute('transform', `rotate(${(this.player.currentSpeed / 600) * 240 - 120}, 50, 50)`);
        const altNeedle = document.getElementById('ui-alt-needle-group');
        if (altNeedle) altNeedle.setAttribute('transform', `rotate(${(Math.max(0, this.player.planeGroup.position.y) / 1000) * 240 - 120}, 50, 50)`);
        this.updateRadar();
    }

    updateRadar() {
        if (!this.radar.ctx || !this.player) return;
        const ctx = this.radar.ctx; ctx.clearRect(0, 0, 140, 140);
        ctx.beginPath(); ctx.arc(70, 70, 68, 0, Math.PI*2); ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)'; ctx.stroke();
        _mRadar.copy(this.player.planeGroup.matrixWorld).invert();
        this.activeEnemies.forEach(u => {
            if (!u.active) return;
            _vRadar.copy(u.mesh.position).applyMatrix4(_mRadar);
            if (Math.sqrt(_vRadar.x*_vRadar.x + _vRadar.z*_vRadar.z) < 4000) {
                const scale = 60 / 4000;
                ctx.beginPath(); ctx.arc(70 + _vRadar.x * scale, 70 + _vRadar.z * scale, 4, 0, Math.PI*2);
                ctx.fillStyle = _vRadar.y > 50 ? '#fff' : (_vRadar.y < -50 ? '#900' : '#f00'); ctx.fill();
            }
        });
    }
}
window.onload = () => new Game();
