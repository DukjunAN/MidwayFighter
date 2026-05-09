import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

let scene, camera, renderer, controls, transformControls, water, sun;
let raycaster, mouse;
let selectionHelper = null;
const models = [];
let selectedObject = null;

const gameScales = {
    'F4F Wildcat': 1.0,
    'TBF Avenger': 1.1,
    'A6M Zero (White)': 3.0,
    'A6M Zero (Green)': 3.0,
    'A6M Zero (Light Green)': 3.0,
    'D3a Val': 1.1,
    'G3M Nell': 1.6,
    'KI-59': 2.09,
    'Akagi (Carrier)': 100.0,
    'Soryu (Carrier)': 1.0,
    'Shinano (Carrier)': 1.0,
    'Cloud': 3.0
};

const modelPaths = [
    { name: 'F4F Wildcat', path: 'Assets/Player/F4F Wildcat/F4F.glb', category: 'air' },
    { name: 'TBF Avenger', path: 'Assets/Player/TBF-1C/TBF-1C.glb', category: 'air' },
    { name: 'A6M Zero (White)', path: 'Assets/Enemy/A6M Zero/A6M_Zero.glb', category: 'air', texture: 'Assets/Enemy/A6M Zero/texture/zero white/zero white_BaseColor.png' },
    { name: 'A6M Zero (Green)', path: 'Assets/Enemy/A6M Zero/A6M_Zero.glb', category: 'air', texture: 'Assets/Enemy/A6M Zero/texture/zero green/zero zelená 6_BaseColor.png' },
    { name: 'A6M Zero (Light Green)', path: 'Assets/Enemy/A6M Zero/A6M_Zero.glb', category: 'air', texture: 'Assets/Enemy/A6M Zero/texture/zero light green/zero light green _BaseColor.png' },
    { name: 'D3a Val', path: 'Assets/Enemy/D3a/D3a.glb', category: 'air' },
    { name: 'G3M Nell', path: 'Assets/Enemy/G3M/G3M.glb', category: 'air' },
    { name: 'KI-59', path: 'Assets/Enemy/KI59/uploads_files_2403429_ki59.glb', category: 'air' },
    { name: 'Akagi (Carrier)', path: 'Assets/Enemy/carrier/akagi/AKAGI.glb', category: 'ship' },
    { name: 'Soryu (Carrier)', path: 'Assets/Enemy/carrier/soryu/ijn_soryu.glb', category: 'ship' },
    { name: 'Shinano (Carrier)', path: 'Assets/Enemy/carrier/shinano/shinano.gltf', category: 'ship' },
    { name: 'Cloud', path: 'Assets/Enviroment/cloud/cloud.glb', category: 'cloud' },
];

const BASE_Y = 100; 

init();
animate();

function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 5, 2000000);
    camera.position.set(3000, 1500, 4000);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.6; // 밝은 오후에 맞춰 약간 상향
    document.getElementById('container').appendChild(renderer.domElement);

    sun = new THREE.Vector3();

    // Water
    const waterGeometry = new THREE.PlaneGeometry(200000, 200000);
    water = new Water(
        waterGeometry,
        {
            textureWidth: 512,
            textureHeight: 512,
            waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function (texture) {
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            }),
            sunDirection: new THREE.Vector3(),
            sunColor: 0xffffff, // 백색 태양광
            waterColor: 0x001e0f,
            distortionScale: 3.7,
            fog: scene.fog !== undefined
        }
    );
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // Sky
    const sky = new Sky();
    sky.scale.setScalar(200000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms;
    skyUniforms['turbidity'].value = 10; // 맑은 대기
    skyUniforms['rayleigh'].value = 2;    // 푸른 하늘
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.8;

    // [맑은 오후 설정] 태양 고도를 높임
    const parameters = { elevation: 30, azimuth: 180 }; 
    const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
    const theta = THREE.MathUtils.degToRad(parameters.azimuth);
    sun.setFromSphericalCoords(1, phi, theta);
    sky.material.uniforms['sunPosition'].value.copy(sun);
    water.material.uniforms['sunDirection'].value.copy(sun).normalize();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, BASE_Y, 0);

    transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 1.0;
    transformControls.addEventListener('dragging-changed', (event) => {
        controls.enabled = !event.value;
    });
    transformControls.addEventListener('change', updateInfo);
    scene.add(transformControls);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 조명 (밝은 백색광)
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.copy(sun).multiplyScalar(10000);
    scene.add(dirLight);

    updateUIList();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: false });

    document.getElementById('btn-delete-selected').onclick = deleteSelected;
    window.clearScene = clearScene;
}

function updateUIList() {
    const listContainer = document.getElementById('model-list');
    listContainer.innerHTML = ''; 
    modelPaths.forEach((m) => {
        const item = document.createElement('div');
        item.className = 'model-item';
        item.innerHTML = `<strong>${m.name}</strong><br><span style="font-size:10px; color:#888;">${m.category}</span>`;
        item.onclick = () => loadModel(m, item);
        listContainer.appendChild(item);
    });
}

function loadModel(modelData, element) {
    const loader = new GLTFLoader();
    const texLoader = new THREE.TextureLoader();

    loader.load(modelData.path, (gltf) => {
        const model = gltf.scene;
        model.name = modelData.name;
        
        const scale = gameScales[modelData.name] || 1.0;
        model.scale.set(scale, scale, scale);
        
        model.traverse(child => {
            if (child.isMesh) {
                child.frustumCulled = false;
                if (child.material) {
                    if (!child.name.toLowerCase().includes('glass')) {
                        child.material.transparent = false;
                        child.material.opacity = 1.0;
                        child.material.depthWrite = true;
                        child.material.side = THREE.FrontSide;
                    }
                }
            }
        });

        if (modelData.texture) {
            const newTex = texLoader.load(modelData.texture);
            newTex.flipY = false;
            newTex.colorSpace = THREE.SRGBColorSpace;
            model.traverse(child => {
                if (child.isMesh && child.material) {
                    child.material = child.material.clone();
                    child.material.map = newTex;
                }
            });
        }

        // 고도 설정 (배: 100m, 비행기: 200m)
        let targetY = 100; 
        if (modelData.category === 'air') targetY = 200;
        else if (modelData.category === 'cloud') targetY = 300;

        const box = new THREE.Box3().setFromObject(model);
        const minY = box.min.y;
        const yOffset = targetY - minY;
        
        if (modelData.name === 'Akagi (Carrier)') {
            model.position.set(-3000, 100 + (targetY - box.min.y - 100), -80);
        } else {
            model.position.set((models.length % 5) * 500 - 1000, yOffset, 0);
        }
        
        scene.add(model);
        models.push(model);
        element.classList.add('active');
        selectObject(model);

        controls.target.set(model.position.x, targetY, model.position.z);
        controls.update();

    });
}

function selectObject(obj) {
    if (selectionHelper) scene.remove(selectionHelper);
    selectedObject = obj;
    transformControls.attach(obj);
    document.getElementById('status-panel').style.display = 'block';
    document.getElementById('info-name').innerText = `이름: ${obj.name || 'Unknown'}`;
    selectionHelper = new THREE.BoxHelper(obj, 0xffff00);
    scene.add(selectionHelper);
    updateInfo();
}

function updateInfo() {
    if (!selectedObject) return;
    const s = selectedObject.scale.x.toFixed(2);
    document.getElementById('info-scale').innerText = `스케일: ${s}`;
    const p = selectedObject.position;
    document.getElementById('info-pos').innerText = `위치: X:${p.x.toFixed(0)}, Y:${p.y.toFixed(0)}, Z:${p.z.toFixed(0)}`;
    const ry = THREE.MathUtils.radToDeg(selectedObject.rotation.y).toFixed(0);
    document.getElementById('info-rot').innerText = `회전(Y): ${ry}°`;
    if (selectionHelper) selectionHelper.update();
}

function onPointerDown(event) {
    if (event.target.closest('#ui')) return;
    if (transformControls.axis !== null) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(models, true);
    if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && obj.parent !== scene) obj = obj.parent;
        selectObject(obj);
    }
}

function onWheel(event) {
    if (event.ctrlKey && selectedObject) {
        event.preventDefault();
        const scaleAmount = event.deltaY > 0 ? 0.95 : 1.05;
        selectedObject.scale.multiplyScalar(scaleAmount);
        updateInfo();
    }
}

function onKeyDown(event) {
    if (!selectedObject) return;
    const moveStep = event.shiftKey ? 100 : 10;
    switch (event.code) {
        case 'ArrowLeft':  selectedObject.position.x -= moveStep; break;
        case 'ArrowRight': selectedObject.position.x += moveStep; break;
        case 'ArrowUp':    selectedObject.position.z -= moveStep; break;
        case 'ArrowDown':  selectedObject.position.z += moveStep; break;
        case 'PageUp':     selectedObject.position.y += moveStep; break;
        case 'PageDown':   selectedObject.position.y -= moveStep; break;
        case 'KeyW': transformControls.setMode('translate'); break;
        case 'KeyE': transformControls.setMode('rotate'); break;
        case 'KeyR': transformControls.setMode('scale'); break;
        case 'Delete': deleteSelected(); break;
    }
    updateInfo();
}

function deleteSelected() {
    if (selectedObject) {
        scene.remove(selectedObject);
        if (selectionHelper) scene.remove(selectionHelper);
        transformControls.detach();
        const index = models.indexOf(selectedObject);
        if (index > -1) models.splice(index, 1);
        selectedObject = null;
        selectionHelper = null;
        document.getElementById('status-panel').style.display = 'none';
    }
}

function clearScene() {
    models.forEach(m => scene.remove(m));
    if (selectionHelper) scene.remove(selectionHelper);
    models.length = 0;
    selectedObject = null;
    selectionHelper = null;
    transformControls.detach();
    document.querySelectorAll('.model-item').forEach(el => el.classList.remove('active'));
    document.getElementById('status-panel').style.display = 'none';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (water) water.material.uniforms['time'].value += 1.0 / 60.0;
    controls.update();
    if (selectionHelper && selectedObject) {
        selectionHelper.update();
        updateInfo();
    }
    renderer.render(scene, camera);
}
