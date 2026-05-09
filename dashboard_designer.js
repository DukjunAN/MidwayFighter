import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === [ 1. 2D 캔버스 드로잉 로직 ] ===
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
let points = [];
let isClosed = false;

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    draw();
}
window.addEventListener('resize', resizeCanvas);

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const segmentHeight = canvas.height / 4;
    
    // 1. 전체 화면 4등분 가이드라인 (세로로 4칸)
    ctx.setLineDash([10, 5]);
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
        ctx.strokeStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(0, i * segmentHeight);
        ctx.lineTo(canvas.width, i * segmentHeight);
        ctx.stroke();
        
        ctx.fillStyle = '#444';
        ctx.font = '12px monospace';
        ctx.fillText(`SCREEN DIVIDER ${i}/4`, 10, i * segmentHeight - 5);
    }

    // 2. 대시보드 영역 (맨 아래 4번째 칸) 강조
    ctx.setLineDash([]);
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 3 * segmentHeight + 2, canvas.width - 4, segmentHeight - 4);
    
    ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
    ctx.fillRect(0, 3 * segmentHeight, canvas.width, segmentHeight);
    
    ctx.fillStyle = '#0f0';
    ctx.font = 'bold 14px monospace';
    ctx.fillText("▲ DASHBOARD AREA (BOTTOM 1/4) ▲", canvas.width / 2 - 120, 3 * segmentHeight + 25);

    // 2.5 대시보드 영역 내 가로/세로 6등분 가이드라인 (격자)
    ctx.setLineDash([2, 4]);
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)'; // 연한 초록색 격자
    ctx.lineWidth = 1;
    
    // 세로 6등분선
    for (let i = 1; i < 6; i++) {
        const x = (canvas.width / 6) * i;
        ctx.beginPath();
        ctx.moveTo(x, 3 * segmentHeight);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    // 가로 6등분선 (대시보드 영역 내에서만)
    for (let i = 1; i < 6; i++) {
        const y = 3 * segmentHeight + (segmentHeight / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // 3. 대시보드 영역 내의 중심선 (Drawing Origin)
    const cx = canvas.width / 2;
    const cy = 3 * segmentHeight + (segmentHeight / 2); // 맨 아래 칸의 중심
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy);
    ctx.moveTo(cx, 3 * segmentHeight); ctx.lineTo(cx, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    if (points.length === 0) return;

    // 선 그리기
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    if (isClosed && points.length > 2) {
        ctx.closePath();
    }
    ctx.stroke();

    // 꼭짓점 그리기
    ctx.fillStyle = '#0f0';
    points.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === 0 ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();
    });
}

canvas.addEventListener('mousedown', (e) => {
    if (isClosed) return;
    const rect = canvas.getBoundingClientRect();
    points.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    draw();
    update3D();
});

document.getElementById('btn-clear').addEventListener('click', () => {
    points = [];
    isClosed = false;
    draw();
    update3D();
});

document.getElementById('btn-undo').addEventListener('click', () => {
    if (isClosed) {
        isClosed = false;
    } else if (points.length > 0) {
        points.pop();
    }
    draw();
    update3D();
});

document.getElementById('btn-close').addEventListener('click', () => {
    if (points.length > 2) {
        isClosed = true;
        draw();
        update3D();
    }
});

document.getElementById('val-depth').addEventListener('input', update3D);

// === [ 2. 3D 프리뷰 로직 ] ===
const container = document.getElementById('3d-view');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
camera.position.set(0, 50, 150);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

scene.add(new THREE.GridHelper(200, 20, 0x00ff00, 0x333333));
scene.add(new THREE.AxesHelper(50));

let dashboardMesh = null;

function update3D() {
    if (dashboardMesh) {
        scene.remove(dashboardMesh);
        dashboardMesh.geometry.dispose();
        dashboardMesh.material.dispose();
        dashboardMesh = null;
    }

    if (points.length < 3) {
        generateCode();
        return;
    }

    const shape = new THREE.Shape();
    const segmentHeight = canvas.height / 4;
    const cx = canvas.width / 2;
    const cy = 3 * segmentHeight + (segmentHeight / 2); // 맨 아래 칸의 중심
    
    // 캔버스 좌표를 Three.js 좌표계로 변환 (중앙 원점, Y축 반전)
    points.forEach((p, i) => {
        const scale = 40 / segmentHeight;
        const tx = (p.x - cx) * scale;
        const ty = -(p.y - cy) * scale;
        if (i === 0) shape.moveTo(tx, ty);
        else shape.lineTo(tx, ty);
    });

    // 닫힌 도형이 아니면 직선으로 끝점을 이어버림
    if (isClosed) {
        shape.closePath();
    }

    const depth = parseFloat(document.getElementById('val-depth').value);
    const extrudeSettings = {
        depth: depth,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 1,
        bevelThickness: 1
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center(); // 축을 도형의 중앙으로 이동

    const material = new THREE.MeshStandardMaterial({ 
        color: 0xc0c0c0, 
        metalness: 0.8, 
        roughness: 0.2, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
    });
    
    dashboardMesh = new THREE.Mesh(geometry, material);
    scene.add(dashboardMesh);
    
    generateCode();
}

function generateCode() {
    const codeOutput = document.getElementById('code-output');
    if (points.length < 3) {
        codeOutput.value = "// 3개 이상의 점을 찍어주세요.";
        return;
    }

    const depth = document.getElementById('val-depth').value;
    const segmentHeight = canvas.height / 4;
    const cx = canvas.width / 2;
    const cy = 3 * segmentHeight + (segmentHeight / 2); // 맨 아래 칸의 중심

    const vectorCode = points.map(p => {
        // 실제 게임의 UI 카메라 좌표계(-20 ~ 20)에 맞추기 위한 스케일링
        const scale = 40 / segmentHeight;
        const tx = (p.x - cx) * scale;
        const ty = -(p.y - cy) * scale;
        return `new THREE.Vector2(${tx.toFixed(1)}, ${ty.toFixed(1)})`;
    }).join(',\n            ');

    const code = `        // [사용자 커스텀 대시보드 적용 코드]
        // 1. 단면 모양 정의
        const shape = new THREE.Shape([
            ${vectorCode}
        ]);
        
        // 2. 입체(Extrude) 설정
        const extrudeSettings = {
            depth: ${depth},
            bevelEnabled: true,
            bevelSegments: 2,
            steps: 1,
            bevelSize: 1,
            bevelThickness: 1
        };

        const dashGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        dashGeo.center(); // 피벗을 중앙으로

        const dashMat = new THREE.MeshStandardMaterial({ 
            color: 0xc0c0c0, metalness: 0.8, roughness: 0.2, side: THREE.DoubleSide,
            transparent: true, opacity: 0.3 
        });
        
        this.dashboard = new THREE.Mesh(dashGeo, dashMat);
        
        // 주의: 새로 만든 도형의 크기에 따라 위치(position) 조정이 필요할 수 있습니다.
        this.dashboard.position.set(0, -35, -20); 
        this.dashboard.rotation.set(0, 0, 0); // 필요 시 회전 조정 (예: Math.PI / 2)
        this.group.add(this.dashboard);`;

    codeOutput.value = code;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

setTimeout(() => {
    resizeCanvas();
    animate();
}, 100);