import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * [Module] ControlUI (Car-Style Cockpit)
 * 둥근 대시보드와 신규 스로틀(Throttle.glb)의 정밀 조작을 관리합니다.
 */
export class ControlUI {
    constructor(uiScene) {
        this.uiScene = uiScene;
        this.loader = new GLTFLoader();
        this.group = new THREE.Group();
        
        this.joystickPivot = new THREE.Group();
        this.joystickModel = null;
        
        this.throttlePivot = new THREE.Group();
        this.throttleModel = null;
        this.throttleLever = null; 
        
        this.radar = null;
        this.dashboard = null;
        
        this.init();
    }

    async init() {
        // [사용자 커스텀 대시보드 적용 코드]
        // 1. 단면 모양 정의
        const shape = new THREE.Shape([
            new THREE.Vector2(-54.9, 7.2),
            new THREE.Vector2(-36.2, 13.1),
            new THREE.Vector2(-19.1, 19.0),
            new THREE.Vector2(-0.4, 19.0),
            new THREE.Vector2(18.0, 19.3),
            new THREE.Vector2(36.7, 13.7),
            new THREE.Vector2(54.1, 7.0),
            new THREE.Vector2(54.1, -18.9),
            new THREE.Vector2(0.4, -18.9),
            new THREE.Vector2(-54.4, -18.7),
            new THREE.Vector2(-54.1, 7.2)
        ]);
        
        // 2. 입체(Extrude) 설정
        const extrudeSettings = {
            depth: 40,
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
            transparent: false, opacity: 1.0 
        });
        
        this.dashboard = new THREE.Mesh(dashGeo, dashMat);
        
        // [대시보드 모양 보존]
        // 사용자 요청에 따라 모양을 수정하지 않고 원래 비율(1.0)을 유지합니다.
        this.dashboard.scale.set(1.0, 1.0, 1.0); 
        this.dashboard.position.set(0, 0, -20); 
        this.group.add(this.dashboard);

        // 2. 조이스틱 (대시보드 하단 가시 범위 내 배치)
        this.joystickPivot.position.set(0, -12, 15);
        this.joystickPivot.rotation.set(THREE.MathUtils.degToRad(40), THREE.MathUtils.degToRad(-91), 0); 
        this.group.add(this.joystickPivot);

        this.loader.load('Assets/Control UI/joystick.glb', (gltf) => {
            this.joystickModel = gltf.scene;
            this.joystickModel.scale.setScalar(7.11); 
            this.joystickPivot.add(this.joystickModel);
        });

        // 3. 스로틀 (대시보드 하단 가시 범위 내 배치)
        this.throttlePivot.position.set(-31, -12, 13);
        this.throttlePivot.rotation.set(THREE.MathUtils.degToRad(91), 0, 0);
        this.throttlePivot.scale.setScalar(100.1); 
        this.group.add(this.throttlePivot);

        this.loader.load('Assets/Control UI/Throttle.glb', (gltf) => {
            console.log('Throttle.glb loaded successfully');
            this.throttleModel = gltf.scene;
            this.throttleModel.scale.setScalar(1.0); 
            this.throttlePivot.add(this.throttleModel);
            
            this.throttleModel.traverse(child => {
                if (child.isMesh) {
                    child.material.side = THREE.DoubleSide;
                }
                if (child.name.includes('Object_6')) {
                    this.throttleLever = child;
                }
            });
        });

        this.uiScene.add(this.group);
    }

    update(input) {
        const rawAxes = input.getAxis(); // 원본 축 값 가져오기
        const axes = {
            x: THREE.MathUtils.clamp(rawAxes.x, -1, 1),
            y: THREE.MathUtils.clamp(rawAxes.y, -1, 1)
        };

        if (this.joystickModel) {
            // 조이스틱 애니메이션 (표준화된 axes.y 기준)
            // axes.y = 1 (밀기/Down) -> RZ 50도
            // axes.y = -1 (당기기/Up) -> RZ -40도
            let targetRZ = 0;
            if (axes.y > 0) {
                targetRZ = axes.y * 50; 
            } else {
                targetRZ = axes.y * 40; 
            }
            this.joystickModel.rotation.z = THREE.MathUtils.degToRad(targetRZ);
            
            // Roll (axes.x): 기존 X축 회전 유지
            this.joystickModel.rotation.x = -axes.x * 0.4;
        }
        
        if (this.throttleLever) {
            // 스로틀 레버 (Object_6) 물리 작동 - 방향 반전 수정
            // 기존 speedIntent (A: 1, Z: -1) 에 -0.7을 곱하여 방향 반전
            const speedIntent = (input.isPressed('KeyA') ? 1 : 0) + (input.isPressed('KeyZ') ? -1 : 0);
            this.throttleLever.rotation.x = THREE.MathUtils.lerp(this.throttleLever.rotation.x, -speedIntent * 0.7, 0.1);
        }

        if (this.scanLine) this.scanLine.rotation.z -= 0.05;
    }
}
