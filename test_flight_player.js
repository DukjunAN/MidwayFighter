import * as THREE from 'three';
import { Player } from './Source/Player.js';
import { Input } from './Source/Input.js';
import { Bullet } from './Source/Bullet.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * [Test Room] FlightTester
 * 바다를 제거하고 거대한 섬 지형 위를 비행하는 환경입니다.
 */
class FlightTester {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000000);
        this.camera.rotation.order = 'YXZ'; 
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        this.sounds = { engine: null, gun: null };

        this.input = new Input();
        this.player = null;
        this.bullets = [];
        this.lastTime = performance.now();
        this.lastFireTime = 0;
        this.hitIntensity = 0; 

        this.drone = null;
        this.droneAngle = 0;
        this.windLines = null;

        this.controls = null;
        this.throttleAssemblage = null;
        this.throttleAngle = 0;
        
        this.init();
    }

    async init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.5;
        document.body.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.setupEnvironment();
        this.setupSpeedLines();
        this.loadSounds();
        this.setup3DThrottle();

        // [섬 설정] 바다 대신 바닥 역할을 할 거대 지형
        this.islandConfig = {
            id: 'elba',
            path: 'Assets/Enviroment/terrain/day22_elba_island.glb',
            pos: new THREE.Vector3(0, -100, 0), 
            scale: new THREE.Vector3(200, 80, 200), // 가로 세로 200m 유지, 높이만 2배(80) 확대
            isLoaded: false,
            mesh: null
        };
        // this.loadIslandModel(); // 배경 제거를 위해 비활성화

        // [추가] 오디오 재개 리스너
        const resumeAudio = () => {
            if (this.audioListener.context.state === 'suspended') {
                this.audioListener.context.resume();
            }
            window.removeEventListener('mousedown', resumeAudio);
        };
        window.addEventListener('mousedown', resumeAudio);

        await this.loadAircraft('f4f');
        
        document.getElementById('btn-f4f').onclick = () => this.loadAircraft('f4f');
        document.getElementById('btn-tbf').onclick = () => this.loadAircraft('tbf');
        document.getElementById('btn-hit').onclick = () => this.simulateHit();
        document.getElementById('btn-spawn-drone').onclick = () => this.spawnDrone();
        window.addEventListener('resize', () => this.onWindowResize());
        
        this.animate();
    }

    setup3DThrottle() {
        // --- Materials ---
        const aluminumMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.2
        });
        const plasticMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.1,
            roughness: 0.8
        });
        const buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });

        // --- Geometries ---
        const baseGeometry = new THREE.BoxGeometry(4, 0.5, 5);
        const axisGeometry = new THREE.CylinderGeometry(0.2, 0.2, 4, 32);
        const leverArmGeometry = new THREE.BoxGeometry(0.3, 3, 0.3);
        const leverGripGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 32);
        const buttonGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 16);

        // --- Meshes ---
        const throttleGroup = new THREE.Group();
        // 화면 좌측 하단 구석 혹은 특정 위치에 배치 (비행기 근처가 아닌 UI처럼 고정되거나 별도 위치)
        // 일단 원점에 배치하되 비행기 업데이트 시 씬에서 고정되도록 함.
        throttleGroup.position.set(-15, -5, -20); 
        this.scene.add(throttleGroup);

        const baseMesh = new THREE.Mesh(baseGeometry, aluminumMaterial);
        baseMesh.position.y = 0.25;
        throttleGroup.add(baseMesh);

        const axisMesh = new THREE.Mesh(axisGeometry, aluminumMaterial);
        axisMesh.rotation.z = Math.PI / 2;
        axisMesh.position.y = 1;
        throttleGroup.add(axisMesh);

        this.throttleAssemblage = new THREE.Group();
        this.throttleAssemblage.position.set(0, 1, 0);
        throttleGroup.add(this.throttleAssemblage);

        const leverArmMesh = new THREE.Mesh(leverArmGeometry, plasticMaterial);
        leverArmMesh.position.y = 1.5;
        this.throttleAssemblage.add(leverArmMesh);

        const leverGripMesh = new THREE.Mesh(leverGripGeometry, plasticMaterial);
        leverGripMesh.rotation.x = Math.PI / 2;
        leverGripMesh.position.y = 3;
        this.throttleAssemblage.add(leverGripMesh);

        const buttonA = new THREE.Mesh(buttonGeometry, buttonMaterial);
        buttonA.position.set(0, 3, 0.5);
        this.throttleAssemblage.add(buttonA);

        const buttonB = buttonA.clone();
        buttonB.position.z = 0.2;
        this.throttleAssemblage.add(buttonB);
    }

    async loadIslandModel() {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        loader.load(this.islandConfig.path, (gltf) => {
            this.islandConfig.mesh = gltf.scene;
            this.islandConfig.mesh.scale.copy(this.islandConfig.scale);
            this.islandConfig.mesh.position.copy(this.islandConfig.pos);
            this.scene.add(this.islandConfig.mesh);
            this.islandConfig.isLoaded = true;
        });
    }

    async spawnDrone() {
        if (this.drone) this.scene.remove(this.drone);
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const loader = new GLTFLoader();
        loader.load('Assets/Enemy/A6M Zero/A6M_Zero.glb', (gltf) => {
            this.drone = gltf.scene;
            this.drone.scale.setScalar(0.15); 
            this.drone.position.set(200, 600, -500);
            this.scene.add(this.drone);
            this.droneAngle = 0;
        });
    }

    loadSounds() {
        const audioLoader = new THREE.AudioLoader();
        this.sounds.engine = new THREE.Audio(this.audioListener);
        audioLoader.load('Assets/Sound/115270__timbre__bi-plane-dives.wav', (buffer) => {
            this.sounds.engine.setBuffer(buffer);
            this.sounds.engine.setLoop(true);
            this.sounds.engine.setVolume(0.15);
            if (this.player && this.player.isLoaded) this.sounds.engine.play();
        });
        this.sounds.gun = new THREE.Audio(this.audioListener);
        audioLoader.load('Assets/Sound/507137__mrthenoronha__machine-gun-2-8-bit.wav', (buffer) => {
            this.sounds.gun.setBuffer(buffer);
            this.sounds.gun.setVolume(0.2);
        });
    }

    setupSpeedLines() {
        const count = 60;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 6); 
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
        this.windLines = new THREE.LineSegments(geometry, material);
        this.scene.add(this.windLines);
    }

    updateSpeedLines(speed) {
        if (!this.windLines || !this.player) return;
        const posAttr = this.windLines.geometry.attributes.position;
        const speedFactor = Math.max(0, (speed - 250) / 262); 
        this.windLines.material.opacity = speedFactor * 0.5;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.player.planeGroup.quaternion);
        const playerPos = this.player.planeGroup.position;
        for (let i = 0; i < 60; i++) {
            const idx = i * 6;
            let p1 = new THREE.Vector3(posAttr.array[idx], posAttr.array[idx+1], posAttr.array[idx+2]);
            if (p1.distanceTo(playerPos) > 600 || p1.length() === 0) {
                const offset = new THREE.Vector3((Math.random()-0.5)*300, (Math.random()-0.5)*300, -400-Math.random()*400).applyQuaternion(this.player.planeGroup.quaternion);
                p1.copy(playerPos).add(offset);
                const p2 = p1.clone().add(forward.clone().multiplyScalar(-30 - Math.random() * 50));
                posAttr.array[idx]=p1.x; posAttr.array[idx+1]=p1.y; posAttr.array[idx+2]=p1.z;
                posAttr.array[idx+3]=p2.x; posAttr.array[idx+4]=p2.y; posAttr.array[idx+5]=p2.z;
            }
        }
        posAttr.needsUpdate = true;
    }

    setupEnvironment() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6); this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(100, 200, 100); this.scene.add(sun);
    }

    async loadAircraft(type) {
        if (this.player) { this.scene.remove(this.player.planeGroup); this.player.destroy(); }
        this.player = new Player(this.scene, this.camera, type);
        await this.player.init();
        if (this.sounds.engine && !this.sounds.engine.isPlaying) this.sounds.engine.play();
    }

    simulateHit() { 
        this.hitIntensity = 1.0; 
        if (this.player) this.player.takeDamage(20);
        const flash = document.getElementById('hit-flash');
        if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 100); }
    }

    onWindowResize() { 
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); 
        this.renderer.setSize(w, h); 
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        const deltaTime = Math.min((now - this.lastTime) / 1000, 0.1);
        this.lastTime = now;

        if (this.player && this.player.isLoaded) {
            this.input.update(deltaTime);

            // [수정] 3D 스로틀 모델을 input.throttle과 동기화 (0.0~1.0 -> 0~90도)
            this.throttleAngle = this.input.throttle * 90;
            if (this.throttleAssemblage) {
                this.throttleAssemblage.rotation.x = -THREE.MathUtils.degToRad(this.throttleAngle);
            }

            this.player.update(this.input, deltaTime);
            
            if (this.drone) {
                this.droneAngle += deltaTime * 0.3;
                this.drone.position.set(Math.sin(this.droneAngle)*400, 600+Math.sin(this.droneAngle*2)*100, Math.cos(this.droneAngle)*400-500);
            }

            this.updateSpeedLines(this.player.currentSpeed);

            const isFiring = this.input.isPressed('KeyF');
            if (isFiring && now - this.lastFireTime > this.player.fireRate) {
                const shots = this.player.fire();
                shots.forEach(s => this.bullets.push(new Bullet(this.scene, s.position, s.direction, { speed: 50 })));
                if (this.sounds.gun) { if (this.sounds.gun.isPlaying) this.sounds.gun.stop(); this.sounds.gun.play(); }
                this.lastFireTime = now;
            }

            for (let i = this.bullets.length - 1; i >= 0; i--) {
                const b = this.bullets[i]; b.update();
                if (b.active && this.drone && b.mesh.position.distanceTo(this.drone.position) < 25) {
                    this.drone.scale.setScalar(0.25); setTimeout(() => { if(this.drone) this.drone.scale.setScalar(0.15); }, 100);
                    b.destroy();
                }
                if (!b.active) this.bullets.splice(i, 1);
            }

            if (this.hitIntensity > 0) {
                this.player.planeGroup.position.x += (Math.random()-0.5)*this.hitIntensity*2;
                this.player.planeGroup.position.y += (Math.random()-0.5)*this.hitIntensity*2;
                this.hitIntensity -= deltaTime*2.0;
            }

            this.camera.rotation.z = this.player.currentRoll * -0.15;
            
            const axes = this.input.getAxis();
            document.getElementById('val-in-x').innerText = axes.x.toFixed(2); 
            document.getElementById('val-in-y').innerText = axes.y.toFixed(2);
            document.getElementById('val-hp').innerText = Math.floor(this.player.hp); 
            document.getElementById('val-speed').innerText = Math.floor(this.player.currentSpeed);
            
            // 아날로그 속도계 바늘 업데이트 (0 ~ 600 km/h 범위를 -120도 ~ 120도 범위로 매핑)
            const speed = this.player.currentSpeed;
            const needleAngle = (speed / 600) * 240 - 120;
            const needleGroup = document.getElementById('ui-speed-needle-group');
            if (needleGroup) {
                needleGroup.setAttribute('transform', `rotate(${needleAngle}, 50, 50)`);
            }

            const digitalSpeed = document.getElementById('ui-speed-digital');
            if (digitalSpeed) {
                digitalSpeed.textContent = Math.floor(speed);
            }

            // 아날로그 고도계 바늘 업데이트 (0 ~ 1000m 범위를 -120도 ~ 120도 범위로 매핑)
            const alt = this.player.planeGroup.position.y;
            const altAngle = (Math.max(0, alt) / 1000) * 240 - 120;
            const altNeedle = document.getElementById('ui-alt-needle-group');
            const digitalAlt = document.getElementById('ui-alt-digital');
            if (altNeedle) altNeedle.setAttribute('transform', `rotate(${altAngle}, 50, 50)`);
            if (digitalAlt) digitalAlt.textContent = Math.floor(alt);

            document.getElementById('val-pitch').innerText = THREE.MathUtils.radToDeg(this.player.currentPitch).toFixed(2);
            document.getElementById('val-roll').innerText = THREE.MathUtils.radToDeg(this.player.currentRoll).toFixed(2);
            document.getElementById('val-pos').innerText = `${Math.floor(this.player.planeGroup.position.x)}, ${Math.floor(this.player.planeGroup.position.y)}, ${Math.floor(this.player.planeGroup.position.z)}`;
            
            const ohText = document.getElementById('overheat-text'); if (ohText) ohText.style.display = this.player.isOverheated ? 'inline' : 'none';
        }

        this.renderer.render(this.scene, this.camera);
    }
}
new FlightTester();
