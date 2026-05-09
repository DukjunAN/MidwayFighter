import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AircraftFactory } from './Source/AircraftFactory.js';
import { Bullet } from './Source/Bullet.js';

class AircraftTestApp {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.currentAircraft = null;
        this.controls = null;
        this.keys = {};
        this.helpers = [];
        this.bullets = [];
        this.fallingBombs = []; // 떨어지는 폭탄 리스트 초기화
        this.lastFireTime = 0;
        this.lastBombTime = 0; // 마지막 폭탄 투하 시간
        this.fireInterval = 100; // ms

        this.init();
    }

    async init() {
        // Renderer Setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        this.renderer.setClearColor(0x111111);
        document.body.appendChild(this.renderer.domElement);

        this.camera.position.set(5, 5, 10);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.target.set(0, 0, 0);

        this.setupEnvironment();

        const select = document.getElementById('aircraft-select');
        select.addEventListener('change', (e) => this.loadAircraft(e.target.value));

        document.getElementById('reset-camera').addEventListener('click', () => this.resetCamera());
        document.getElementById('show-helpers').addEventListener('change', () => this.updateHelpers());
        document.getElementById('propeller-axis').addEventListener('change', (e) => {
            if (this.currentAircraft) this.currentAircraft.propellerAxis = e.target.value;
        });
        document.getElementById('muzzle-offset').addEventListener('input', (e) => {
            if (this.currentAircraft) this.currentAircraft.muzzleOffset = parseFloat(e.target.value);
        });
        document.getElementById('copy-config').addEventListener('click', () => this.copyConfig());

        window.addEventListener('keydown', (e) => this.keys[e.code] = true);
        window.addEventListener('keyup', (e) => this.keys[e.code] = false);
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        await this.loadAircraft(select.value);
        this.animate();
    }

    setupEnvironment() {
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
        const directional = new THREE.DirectionalLight(0xffffff, 1.2);
        directional.position.set(100, 100, 100);
        this.scene.add(directional);
        this.scene.add(new THREE.GridHelper(20, 20, 0x444444, 0x222222));
    }

    async loadAircraft(id) {
        if (this.currentAircraft) this.currentAircraft.destroy();
        this.bullets.forEach(b => b.destroy());
        this.bullets = [];
        this.fallingBombs = []; 

        this.currentAircraft = AircraftFactory.create(id, this.scene);
        if (this.currentAircraft) {
            this.setStatus(`${this.currentAircraft.name} 로드 중...`);
            try {
                await this.currentAircraft.load();
                document.getElementById('propeller-axis').value = this.currentAircraft.propellerAxis;
                document.getElementById('muzzle-offset').value = this.currentAircraft.muzzleOffset;
                this.updateHierarchy();
                this.updateHelpers();
                this.resetCamera();
                this.setStatus(this.createAircraftStatus(), false);
            } catch (error) {
                console.error(error);
                this.setStatus(`${this.currentAircraft.name} 로드 실패: ${error.message}`, true);
            }
        }
    }

    resetCamera() {
        if (!this.currentAircraft?.mesh) return;
        const box = new THREE.Box3().setFromObject(this.currentAircraft.mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const distance = Math.max(size.x, size.y, size.z, 1) * 2.2;
        this.controls.target.copy(center);
        this.camera.position.set(center.x + distance, center.y + distance * 0.5, center.z + distance);
        this.camera.updateProjectionMatrix();
        this.controls.update();
    }

    createAircraftStatus() {
        const ac = this.currentAircraft;
        return `${ac.name} 로드 완료<br>프로펠러: ${ac.propellers.length}개<br>총구: ${ac.guns.length}개<br>폭탄: ${ac.bombs.length}개`;
    }

    setStatus(message, isError = false) {
        const status = document.getElementById('status');
        status.innerHTML = message;
        status.className = isError ? 'error' : 'ok';
    }

    updateHierarchy() {
        const container = document.getElementById('hierarchy');
        container.innerHTML = '';
        if (!this.currentAircraft?.mesh) return;
        const traverse = (object, depth = 0) => {
            const div = document.createElement('div');
            div.style.paddingLeft = `${depth * 10}px`;
            div.textContent = (object.name || 'unnamed') + ` [${object.type}]`;
            container.appendChild(div);
            object.children.forEach(child => traverse(child, depth + 1));
        };
        traverse(this.currentAircraft.mesh);
    }

    updateHelpers() {
        this.helpers.forEach(h => h.parent ? h.parent.remove(h) : this.scene.remove(h));
        this.helpers = [];
        if (!this.currentAircraft?.mesh || !document.getElementById('show-helpers').checked) return;
        const axes = new THREE.AxesHelper(5);
        this.scene.add(axes);
        this.helpers.push(axes);
    }

    copyConfig() {
        if (!this.currentAircraft) return;
        console.log(JSON.stringify(this.currentAircraft, null, 4));
        alert('설정이 콘솔에 출력되었습니다.');
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        if (this.currentAircraft && this.currentAircraft.isLoaded) {
            const isAuto = document.getElementById('propeller-auto').checked;
            const speedBase = parseFloat(document.getElementById('propeller-speed').value);
            const isFiring = document.getElementById('fire-test').checked || this.keys.Space;

            this.currentAircraft.update(isAuto ? speedBase : 0, isFiring);

            if (isFiring && time - this.lastFireTime > this.fireInterval) {
                const shots = this.currentAircraft.fire();
                shots.forEach(s => this.bullets.push(new Bullet(this.scene, s.position, s.direction, { speed: 15 })));
                this.lastFireTime = time;
            }

            // 폭탄 투하 (B 키)
            if (this.keys.KeyB && time - this.lastBombTime > 500) {
                const bombInfo = this.currentAircraft.dropBomb();
                if (bombInfo) {
                    this.fallingBombs.push({
                        mesh: bombInfo.mesh,
                        velocity: bombInfo.velocity,
                        gravity: new THREE.Vector3(0, -0.05, 0)
                    });
                    this.lastBombTime = time;
                }
            }
        }

        // 탄환 업데이트
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            this.bullets[i].update();
            if (!this.bullets[i].active) this.bullets.splice(i, 1);
        }

        // 폭탄 업데이트
        for (let i = this.fallingBombs.length - 1; i >= 0; i--) {
            const b = this.fallingBombs[i];
            b.velocity.add(b.gravity);
            b.mesh.position.add(b.velocity);
            if (b.mesh.position.y < 0) {
                this.scene.remove(b.mesh);
                this.fallingBombs.splice(i, 1);
            }
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new AircraftTestApp();
