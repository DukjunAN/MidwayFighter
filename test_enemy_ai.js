import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AircraftFactory } from './Source/AircraftFactory.js';
import { Enemy } from './Source/Enemy.js';
import { Player } from './Source/Player.js';
import { EnvironmentManager } from './Source/Environment.js';

class MockInput {
    constructor() {
        this.keys = {};
        this.throttle = 0.5;
        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }
    update(deltaTime) {
        if (this.keys['KeyA']) this.throttle = Math.min(1.0, this.throttle + deltaTime);
        if (this.keys['KeyZ']) this.throttle = Math.max(0.0, this.throttle - deltaTime);
    }
    isPressed(code) { 
        if (code === 'KeyF' && this.keys['KeyF']) return true;
        return !!this.keys[code]; 
    }
    getAxis() {
        let x = 0, y = 0;
        if (this.isPressed('ArrowLeft')) x -= 1;
        if (this.isPressed('ArrowRight')) x += 1;
        if (this.isPressed('ArrowUp')) y += 1;
        if (this.isPressed('ArrowDown')) y -= 1;
        return { x, y };
    }
}

class EnemyAITestApp {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 20000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.player = null;
        this.input = new MockInput();
        this.environment = null;
        this.units = []; 
        
        this.textureLoader = new THREE.TextureLoader();
        this.textureCache = new Map();
        
        this.zeroTextures = {
            green: 'Assets/Enemy/A6M Zero/texture/zero green/zero zelená 6_BaseColor.png',
            light_green: 'Assets/Enemy/A6M Zero/texture/zero light green/zero light green _BaseColor.png',
            white: 'Assets/Enemy/A6M Zero/texture/zero white/zero white_BaseColor.png'
        };

        this.descriptions = {
            'zero_green': '녹색: 직선 접근 후 공격 및 이탈 (표준형)',
            'zero_light_green': '엷은 녹색: 측면 우회 접근 후 공격',
            'zero_white': '하얀색: 지그재그 회피 기동하며 접근',
            'd3a': 'D3A Val: 고고도 접근 후 급강하 폭격 기동',
            'g3m': 'G3M Nell: 육상 공격기 (느린 속도, 직선 비행)'
        };

        this.log = [];
        this.projectionLines = new THREE.Group();
        this.spawnBeacon = null;
        
        this.viewMode = 'chase'; 
        this.cameraRotation = { yaw: Math.PI, pitch: -0.1 }; 
        this.lookSensitivity = 0.002;
        
        this.lastTime = performance.now();
        this.autoSpawnEnabled = true;
        this.spawnTimer = 0;
        this.spawnInterval = 15.0; // 15초 주기
        this.lightGreenInScene = false; // 에이스 존재 여부
        
        this.init();
    }

    async init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);

        this.environment = new EnvironmentManager(this.scene);
        this.player = new Player(this.scene, this.camera, 'f4f');
        await this.player.init();
        this.player.planeGroup.position.set(0, 500, 0);

        this.setupTacticalGrid();
        this.setupUI();
        this.setupMouseLook();

        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        await this.spawnFormation('zero_green', 0, 600, 2000);
        
        this.animate();
    }

    setupMouseLook() {
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 2) this.renderer.domElement.requestPointerLock();
        });

        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.cameraRotation.yaw -= e.movementX * this.lookSensitivity;
                this.cameraRotation.pitch -= e.movementY * this.lookSensitivity;
                this.cameraRotation.pitch = THREE.MathUtils.clamp(this.cameraRotation.pitch, -Math.PI/2, Math.PI/2);
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 2) document.exitPointerLock();
        });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyV') {
                this.viewMode = this.viewMode === 'chase' ? 'orbit' : 'chase';
                if (this.viewMode === 'orbit') {
                    this.cameraRotation.yaw = this.player.currentYaw + Math.PI;
                    this.cameraRotation.pitch = -0.2;
                }
            }
            if (e.code === 'KeyL') this.logCurrentPosition();
        });
    }

    setupTacticalGrid() {
        this.scene.add(this.projectionLines);
        this.spawnBeacon = new THREE.Group();
        this.scene.add(this.spawnBeacon);

        // Ground line reuse
        this.groundLine = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 10, gapSize: 5, transparent: true, opacity: 0.3 })
        );
        this.scene.add(this.groundLine);
    }

    updateProjectionLines(nearestUnit) {
        if (nearestUnit && nearestUnit.mesh) {
            const pos = nearestUnit.mesh.position;
            const points = [pos, new THREE.Vector3(pos.x, 0, pos.z)];
            this.groundLine.geometry.setFromPoints(points);
            this.groundLine.computeLineDistances();
            this.groundLine.visible = true;
        } else {
            this.groundLine.visible = false;
        }
    }

    setupUI() {
        const select = document.getElementById('enemy-select');
        const spawnBtn = document.getElementById('spawn-btn');
        const resetBtn = document.getElementById('reset-btn');
        const desc = document.getElementById('unit-description');
        
        const autoSpawnBtn = document.createElement('button');
        autoSpawnBtn.id = 'auto-spawn-btn';
        autoSpawnBtn.textContent = 'AUTO SPAWN: ON';
        autoSpawnBtn.style.background = '#007bff';
        autoSpawnBtn.style.marginLeft = '10px';
        autoSpawnBtn.addEventListener('click', () => {
            this.autoSpawnEnabled = !this.autoSpawnEnabled;
            autoSpawnBtn.textContent = `AUTO SPAWN: ${this.autoSpawnEnabled ? 'ON' : 'OFF'}`;
            autoSpawnBtn.style.background = this.autoSpawnEnabled ? '#007bff' : '#444';
        });
        document.getElementById('ui').appendChild(autoSpawnBtn);

        select.addEventListener('change', (e) => desc.textContent = this.descriptions[e.target.value]);
        spawnBtn.addEventListener('click', () => {
            this.spawnFormation(select.value, 0, this.player.planeGroup.position.y + 100, this.player.planeGroup.position.z - 2000); 
        });
        resetBtn.addEventListener('click', () => {
            this.player.planeGroup.position.set(0, 500, 0);
            this.player.currentPitch = 0;
            this.player.currentRoll = 0;
            this.player.currentYaw = 0;
            this.spawnFormation('zero_green', 0, 600, 2000);
        });
        document.getElementById('copy-log-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(this.log, null, 2));
            alert('Log copied!');
        });
        document.getElementById('clear-log-btn').addEventListener('click', () => { this.log = []; this.updateLogUI(); });
    }

    async spawnFormation(type, x, y, z, append = false) {
        if (!append) {
            this.units.forEach(u => u.destroy());
            this.units = [];
            this.spawnBeacon.clear();
            this.lightGreenInScene = false;
        }

        const offsets = [
            { dx: 0, dy: 0, dz: 0 },
            { dx: -60, dy: 20, dz: 80 },
            { dx: 60, dy: -20, dz: 80 }
        ];

        let aceAssigned = false;

        for (const offset of offsets) {
            let baseType = type;
            let variant = 'green';
            let texturePath = null;
            
            // 에이스(엷은 녹색) 배정 로직
            if (type === 'zero_green' && !this.lightGreenInScene && !aceAssigned) {
                variant = 'light_green';
                aceAssigned = true;
                this.lightGreenInScene = true;
            } else if (type.startsWith('zero_')) {
                baseType = 'zero';
                variant = type.replace('zero_', '');
            }
            
            texturePath = this.zeroTextures[variant] || this.zeroTextures['green'];
            
            const unit = new Enemy(this.scene, baseType, variant);
            this.units.push(unit);
            
            try {
                await unit.load();
                if (texturePath) await this.applyCachedTexture(unit.mesh, texturePath);
                unit.spawnAt(x + offset.dx, y + offset.dy, z + offset.dz);
                
                const bGeo = new THREE.CylinderGeometry(0.5, 0.5, 4000, 8);
                const bMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05 });
                const beacon = new THREE.Mesh(bGeo, bMat);
                beacon.position.set(x + offset.dx, 0, z + offset.dz);
                this.spawnBeacon.add(beacon);
            } catch (error) { console.error(error); }
        }
    }

    async applyCachedTexture(mesh, texturePath) {
        let texture = this.textureCache.get(texturePath);
        if (!texture) {
            texture = await new Promise(resolve => {
                this.textureLoader.load(texturePath, tex => {
                    tex.flipY = false;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    resolve(tex);
                });
            });
            this.textureCache.set(texturePath, texture);
        }

        mesh.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => { 
                    if (!/glass|canopy|window/i.test(child.name)) {
                        mat.map = texture;
                        mat.needsUpdate = true;
                    }
                });
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const currentTime = performance.now();
        const deltaTime = Math.min(0.1, (currentTime - this.lastTime) / 1000);
        this.lastTime = currentTime;

        this.input.update(deltaTime);
        if (this.player && this.player.isLoaded) {
            this.player.update(this.input, deltaTime);
            if (this.environment) {
                this.environment.update(deltaTime, 0, this.camera.position);
            }
        }

        if (this.autoSpawnEnabled) {
            this.spawnTimer += deltaTime;
            if (this.spawnTimer >= this.spawnInterval) {
                const randomX = (Math.random() - 0.5) * 800; 
                const randomY = 450 + Math.random() * 250; 
                this.spawnFormation('zero_green', randomX, randomY, this.player.planeGroup.position.z - 2000, true);
                this.spawnTimer = 0;
            }
        }

        if (this.viewMode === 'orbit') {
            const dist = 150;
            const target = this.player.planeGroup.position;
            const x = target.x + dist * Math.sin(this.cameraRotation.yaw) * Math.cos(this.cameraRotation.pitch);
            const y = target.y + dist * Math.sin(this.cameraRotation.pitch);
            const z = target.z + dist * Math.cos(this.cameraRotation.yaw) * Math.cos(this.cameraRotation.pitch);
            this.camera.position.set(x, y, z);
            this.camera.lookAt(target);
        }

        let nearestUnit = null;
        let minDist = Infinity;

        this.units.forEach(unit => {
            if (unit.isLoaded) {
                unit.update(this.player.planeGroup.position);
                const d = unit.mesh.position.distanceTo(this.player.planeGroup.position);
                if (d < minDist) {
                    minDist = d;
                    nearestUnit = unit;
                }
            }
        });

        for (let i = this.units.length - 1; i >= 0; i--) {
            const u = this.units[i];
            if (!u.active || u.mesh.position.z > this.player.planeGroup.position.z + 1500) {
                if (u.variant === 'light_green') this.lightGreenInScene = false; // 에이스 제거 시 플래그 리셋
                u.destroy();
                this.units.splice(i, 1);
            }
        }
        
        this.updateProjectionLines(nearestUnit);
        this.updateHUD(nearestUnit, minDist);
        this.updateCoordinates();
        this.renderer.render(this.scene, this.camera);
    }

    updateHUD(nearestUnit, minDist) {
        const indicator = document.getElementById('target-indicator');
        if (nearestUnit && nearestUnit.mesh) {
            document.getElementById('unit-state').textContent = nearestUnit.state;
            document.getElementById('unit-speed').textContent = nearestUnit.speed.toFixed(2);
            document.getElementById('unit-dist').textContent = minDist.toFixed(1);
            
            const screenPos = nearestUnit.mesh.position.clone().project(this.camera);
            if (screenPos.z < 1 && Math.abs(screenPos.x) < 1.1 && Math.abs(screenPos.y) < 1.1) {
                const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
                const y = (-screenPos.y * 0.5 + 0.5) * window.innerHeight;
                indicator.style.display = 'block';
                indicator.style.left = `${x - 10}px`;
                indicator.style.top = `${y - 10}px`;
                indicator.style.borderColor = nearestUnit.isLockable ? '#00ff00' : '#ff0000';
            } else { indicator.style.display = 'none'; }
        } else {
            indicator.style.display = 'none';
        }
    }

    updateCoordinates() {
        const coordsEl = document.getElementById('coords');
        if (this.player && this.player.isLoaded) {
            const pos = this.player.planeGroup.position;
            coordsEl.innerHTML = `PLAYER X: ${pos.x.toFixed(1)} Y: ${pos.y.toFixed(1)} Z: ${pos.z.toFixed(1)}<br>MODE: ${this.viewMode.toUpperCase()} (V to toggle) | UNITS: ${this.units.length}`;
        }
    }

    logCurrentPosition() {
        if (this.units.length === 0) return;
        this.units.forEach((unit, idx) => {
            if (!unit.mesh) return;
            const pos = unit.mesh.position;
            const entry = { formationIdx: idx, unit: unit.variant || unit.type, x: parseFloat(pos.x.toFixed(2)), y: parseFloat(pos.y.toFixed(2)), z: parseFloat(pos.z.toFixed(2)), time: new Date().toLocaleTimeString() };
            this.log.push(entry);
        });
        this.updateLogUI();
    }

    updateLogUI() {
        const logEl = document.getElementById('pos-log');
        logEl.innerHTML = this.log.map((e, i) => `<div class="log-entry">[${i}] ${e.unit}: ${e.x}, ${e.y}, ${e.z} (${e.time})</div>`).join('');
    }
}

new EnemyAITestApp();
