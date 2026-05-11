import * as THREE from 'three';
import { Player } from './Source/Player.js';
import { Input } from './Source/Input.js';
import { Enemy } from './Source/Enemy.js';
import { Bullet } from './Source/Bullet.js';
import { EnvironmentManager } from './Source/Environment.js';

// 공유 수학 객체
const _vRadar = new THREE.Vector3();
const _vTemp = new THREE.Vector3();
const _mRadar = new THREE.Matrix4();

const EXPLOSION_GEO = new THREE.SphereGeometry(1, 12, 12);
const EXPLOSION_MAT = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 1.0 });

class Game {
    constructor() {
        this.container = document.getElementById('game-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, 1080 / 1920, 10, 1000000);
        // [변경] 시뮬레이션 소스의 회전 순서 YXZ 적용
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
        this.lockTarget = null;

        // [추가] 시뮬레이션 물리 변수
        this.currentPitch = 0;
        this.currentRoll = 0;
        this.currentYaw = 0;
        this.targetPitch = 0;
        this.targetRoll = 0;

        this.altWarningActive = false;
        this.altWarningTimer = 10.0;
        this.shakeAmount = 0;
        this.shakeDuration = 0;

        this.init();
    }

    async init() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8; 
        this.container.appendChild(this.renderer.domElement);
        this.camera.add(this.audioListener);
        this.scene.add(this.camera); 
        this.loadSounds();
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(0, 500, -500);
        this.scene.add(sun);
        this.environment = new EnvironmentManager(this.scene);
        
        this.setupUIEvents();

        const startBtn = document.getElementById('start-button');
        if (startBtn) {
            startBtn.innerText = "데이터 최적화 중...";
            try {
                await this.preloadModels();
                await this.initializeEnemyPool(10); 
            } catch (err) {
                console.error("Asset loading failed, but continuing:", err);
            }
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

    triggerShake(amount = 2, duration = 0.2) {
        this.shakeAmount = amount;
        this.shakeDuration = duration;
    }

    updateCameraShake(deltaTime) {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= deltaTime;
            const x = (Math.random() - 0.5) * this.shakeAmount;
            const y = (Math.random() - 0.5) * this.shakeAmount;
            this.camera.position.x += x;
            this.camera.position.y += y;
            if (this.shakeDuration <= 0) this.shakeAmount = 0;
        }
    }

    setupUIEvents() {
        const fireBtn = document.getElementById('ui-fire-btn');
        const joystickContainer = document.getElementById('ui-joystick-container');
        const joystickHandle = document.getElementById('ui-joystick-handle');
        
        let isDraggingJoystick = false;
        let lastTapTime = 0;
        let flickStartX = 0;
        let flickStartY = 0;
        let flickStartTime = 0;

        const updateJoystick = (e) => {
            const rect = joystickContainer.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
            const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;

            let dx = clientX - centerX;
            let dy = clientY - centerY;
            const maxRadius = rect.width / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > maxRadius) {
                dx *= maxRadius / dist;
                dy *= maxRadius / dist;
            }

            if (joystickHandle) {
                joystickHandle.style.left = `calc(50% + ${dx}px)`;
                joystickHandle.style.top = `calc(50% + ${dy}px)`;
            }

            this.input.drag.active = true;
            this.input.drag.delta.set(dx * (250 / maxRadius), dy * (250 / maxRadius));
        };

        const resetJoystick = () => {
            isDraggingJoystick = false;
            this.input.drag.active = false;
            this.input.drag.delta.set(0, 0);
            if (joystickHandle) {
                joystickHandle.style.left = '50%';
                joystickHandle.style.top = '50%';
            }
        };

        const handleJoystickDown = (e) => {
            const now = performance.now();
            if (now - lastTapTime < 300) this.input.activateBoost();
            lastTapTime = now;

            const clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
            const clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
            flickStartX = clientX;
            flickStartY = clientY;
            flickStartTime = now;

            isDraggingJoystick = true;
            updateJoystick(e);
            e.stopPropagation();
        };

        const handleJoystickUp = (e) => {
            if (isDraggingJoystick) {
                const now = performance.now();
                const duration = now - flickStartTime;
                const clientX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : e.clientX;
                const clientY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : e.clientY;
                
                const dx = clientX - flickStartX;
                const dy = clientY - flickStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (duration < 250 && dist > 50) {
                    const dir = dx > 0 ? 1 : -1;
                    this.input.activateEvade(dir);
                }
                resetJoystick();
            }
        };
        
        joystickContainer.addEventListener('mousedown', handleJoystickDown);
        joystickContainer.addEventListener('touchstart', (e) => { handleJoystickDown(e); }, {passive: false});

        fireBtn.addEventListener('mousedown', (e) => { this.input.isFiringUI = true; fireBtn.classList.add('pressing'); e.stopPropagation(); });
        fireBtn.addEventListener('mouseup', () => { this.input.isFiringUI = false; fireBtn.classList.remove('pressing'); });
        fireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.input.isFiringUI = true; fireBtn.classList.add('pressing'); e.stopPropagation(); });
        fireBtn.addEventListener('touchend', () => { this.input.isFiringUI = false; fireBtn.classList.remove('pressing'); });

        window.addEventListener('mousemove', (e) => { if (isDraggingJoystick) updateJoystick(e); });
        window.addEventListener('touchmove', (e) => { if (isDraggingJoystick) updateJoystick(e); }, {passive: false});
        window.addEventListener('mouseup', (e) => { handleJoystickUp(e); });
        window.addEventListener('touchend', (e) => { handleJoystickUp(e); });
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

    setupSpeedLines(cameraPos) {
        const count = 100;
        const geometry = new THREE.BufferGeometry(); const positions = new Float32Array(count * 6); 
        for (let i = 0; i < count; i++) {
            const idx = i * 6;
            positions[idx] = (Math.random()-0.5)*500; positions[idx+1] = (Math.random()-0.5)*300; positions[idx+2] = -300 - Math.random()*1000;
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
        if (this.windLines) this.scene.remove(this.windLines);
        this.windLines = new THREE.LineSegments(geometry, material); this.scene.add(this.windLines);
    }

    updateSpeedLines() {
        if (!this.windLines || !this.player || !this.isGameStarted) return;
        const posAttr = this.windLines.geometry.attributes.position;
        const speedFactor = Math.max(0, (this.player.currentSpeed - 200) / 300); 
        this.windLines.material.opacity = speedFactor * 0.7;
        this.windLines.position.copy(this.camera.position);
        const count = posAttr.count / 2;
        for (let i = 0; i < count; i++) {
            const idx = i * 6;
            posAttr.array[idx+2] += 20; posAttr.array[idx+5] += 20;
            if (posAttr.array[idx+2] > 100) {
                posAttr.array[idx] = (Math.random()-0.5)*600; posAttr.array[idx+1] = (Math.random()-0.5)*300; posAttr.array[idx+2] = -800 - Math.random()*500;
                posAttr.array[idx+3] = posAttr.array[idx]; posAttr.array[idx+4] = posAttr.array[idx+1]; posAttr.array[idx+5] = posAttr.array[idx+2] + 100;
            }
        }
        posAttr.needsUpdate = true;
    }

    async startGame() {
        if (this.audioListener.context.state === 'suspended') await this.audioListener.context.resume();
        this.player = new Player(this.scene, this.camera, 'f4f');
        await this.player.init();
        
        // [변경] 시뮬레이션 소스의 기체 배치 (Toy Model)
        this.camera.position.set(0, 500, 1000); 
        this.player.planeGroup.position.set(0, -60, -300); // 시뮬레이션 소스 좌표 적용
        this.camera.add(this.player.planeGroup);

        this.setupSpeedLines(this.camera.position);
        document.getElementById('title-screen').style.display = 'none';
        document.getElementById('game-ui').style.display = 'block';
        
        // [변경] 새로운 HUD 디자인 활성화
        document.getElementById('central-hud').style.display = 'block';
        document.getElementById('reticle').style.display = 'block';

        if (this.sounds.engine) this.sounds.engine.play();
        this.isGameStarted = true;
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

    spawnRailEnemy() {
        const spawnZ = this.camera.position.z - (5000 + Math.random() * 3000);
        const spawnX = this.camera.position.x + (Math.random() - 0.5) * 2000;
        const spawnY = this.camera.position.y + (Math.random() - 0.5) * 1000;
        this.spawnFromPool(spawnX, spawnY, spawnZ, 1);
    }

    onWindowResize() {
        const h = window.innerHeight; const w = h * (9 / 16);
        this.renderer.setSize(w, h); this.camera.aspect = 9 / 16; this.camera.updateProjectionMatrix();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;
        
        if (this.isGameStarted && this.player) {
            const axes = this.input.getAxis();
            const isFiringKey = this.input.isPressed('KeyF');
            const isFiring = this.input.isFiringUI || isFiringKey;
            
            this.input.update(deltaTime); 

            // [변경] 시뮬레이션 소스의 부드러운 스티어링 물리 엔진 통합
            const lerpFactor = 1 - Math.pow(0.01, deltaTime); 
            
            this.targetRoll = axes.x * 0.4;
            this.targetPitch = axes.y * 0.25;

            this.currentPitch += (this.targetPitch - this.currentPitch) * lerpFactor * 3; 
            this.currentRoll += (this.targetRoll - this.currentRoll) * lerpFactor * 3;
            
            // Roll(기울기)에 비례하여 Yaw(방향)가 변하는 정밀 비행
            this.currentYaw -= this.currentRoll * deltaTime * 1.5;

            // 카메라 회전 적용 (YXZ 순서)
            this.camera.rotation.set(this.currentPitch, this.currentYaw, -this.currentRoll * 0.2, 'YXZ');
            
            // [변경] 카메라 전진 (바라보는 방향으로 이동)
            const speedMultiplier = 50.0; 
            const moveSpeed = (this.player.currentSpeed / 3.6) * speedMultiplier;
            this.camera.translateZ(-moveSpeed * deltaTime);

            // 고도 제한 및 경고
            const actualAlt = Math.floor(this.camera.position.y);
            const warningEl = document.getElementById('alt-warning');
            if (actualAlt > 5000 || actualAlt < 50) {
                if (!this.altWarningActive) { this.altWarningActive = true; if (warningEl) warningEl.style.display = 'block'; }
            } else {
                if (this.altWarningActive) { this.altWarningActive = false; if (warningEl) warningEl.style.display = 'none'; }
            }

            if (actualAlt <= 0) {
                this.createExplosion(this.player.planeGroup.position);
                this.isGameStarted = false; alert("CRASH: 바다 충돌!"); location.reload();
            }

            this.player.update(this.input, deltaTime); 
            this.updateLockOn(); this.updateCameraShake(deltaTime); this.updateSpeedLines();
            if (this.environment) this.environment.update(deltaTime, 0, this.camera.position);
            
            this.spawnTimer += deltaTime;
            if (this.spawnTimer > 1.5 && this.activeEnemies.length < 5) { this.spawnRailEnemy(); this.spawnTimer = 0; }

            for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
                const u = this.activeEnemies[i];
                if (u.active) {
                    u.update(this.camera.position);
                    if (u.mesh.position.distanceTo(this.camera.position) > 10000) { u.active = false; this.activeEnemies.splice(i, 1); }
                } else { this.activeEnemies.splice(i, 1); }
            }

            // [변경] 조준 및 사격 (카메라 정면 발사)
            if (isFiring && now - this.lastFireTime > this.player.fireRate) {
                const fireDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
                this.player.fire().forEach(s => {
                    this.playerBullets.push(new Bullet(this.scene, s.position, fireDir, { speed: 4000 }));
                });
                if (this.sounds.gun && !this.sounds.gun.isPlaying) this.sounds.gun.play();
                this.lastFireTime = now;
            }

            this.updateBullets(deltaTime); this.updateExplosions(deltaTime);
            if (now - this.lastHudUpdate > 100) { this.updateHUD(); this.lastHudUpdate = now; }
        }
        this.renderer.render(this.scene, this.camera);
    }

    updateLockOn() {
        this.lockTarget = null; let closestDist = Infinity;
        this.activeEnemies.forEach(u => {
            if (!u.active) return;
            const relPos = _vTemp.copy(u.mesh.position).applyMatrix4(_mRadar.copy(this.camera.matrixWorld).invert());
            if (relPos.z < 0 && relPos.z > -5000) {
                const screenPos = u.mesh.position.clone().project(this.camera);
                const offset = Math.hypot(screenPos.x, screenPos.y);
                if (offset < 0.3) {
                    const dist = u.mesh.position.distanceTo(this.camera.position);
                    if (dist < closestDist) { closestDist = dist; this.lockTarget = u; }
                }
            }
        });
        this.activeEnemies.forEach(u => { u.mesh.scale.setScalar(u === this.lockTarget ? 2.0 : 1.0); });
    }

    updateBullets(deltaTime) {
        for (let i = this.playerBullets.length - 1; i >= 0; i--) {
            const b = this.playerBullets[i]; b.update(deltaTime);
            if (b.active) {
                for (const u of this.activeEnemies) {
                    if (u.active && b.mesh.position.distanceTo(u.mesh.position) < 300) { this.createExplosion(u.mesh.position); u.active = false; b.destroy(); break; }
                }
            }
            if (!b.active) this.playerBullets.splice(i, 1);
        }
    }

    createExplosion(pos) {
        const mesh = new THREE.Mesh(EXPLOSION_GEO, EXPLOSION_MAT);
        mesh.position.copy(pos); mesh.scale.setScalar(15); this.scene.add(mesh);
        this.explosions.push({ mesh, life: 1.0 }); this.triggerHitFlash(); this.triggerShake(5, 0.2);
    }

    updateExplosions(deltaTime) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const exp = this.explosions[i]; exp.life -= deltaTime * 2.0; exp.mesh.scale.setScalar(exp.mesh.scale.x + deltaTime * 150);
            if (exp.life <= 0) { this.scene.remove(exp.mesh); this.explosions.splice(i, 1); }
        }
    }

    triggerHitFlash() {
        const flash = document.getElementById('hit-flash');
        if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 50); }
    }

    updateHUD() {
        if (!this.player) return;
        const actualAlt = Math.floor(this.camera.position.y);
        document.getElementById('val-hp').innerText = Math.floor(this.player.hp);
        document.getElementById('alt-val').innerText = Math.max(0, actualAlt) + "m";
        document.getElementById('speed-val').innerText = Math.floor(this.player.currentSpeed) + "km/h";
        document.getElementById('val-units').innerText = this.activeEnemies.length;
        document.getElementById('alt-val-central').innerText = Math.max(0, actualAlt);
        document.getElementById('speed-val-central').innerText = Math.floor(this.player.currentSpeed);
    }
}
const game = new Game();
