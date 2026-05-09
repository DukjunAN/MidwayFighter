import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Stage1Config } from './Stage1.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * [Module] EnvironmentManager
 * 배경(하늘, 바다, 안개, 구름)을 전담 관리합니다.
 */
export class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.config = Stage1Config.environment;
        this.water = null;
        this.sky = null;
        this.clouds = [];
        this.cloudCount = this.config.cloudCount || 20;
        this.cloudModel = null;
        
        this.init();
    }

    async init() {
        // 1. Fog
        this.scene.fog = new THREE.FogExp2(0x8da7b5, 0.00012);

        // 2. Sky & Sun
        this.setupSky();

        // 3. Water
        this.setupWater();

        // [주석 처리: 구름 로딩 및 설정]
        // await this.loadCloudModel();
        // this.setupClouds();
    }

    setupSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = 10;
        uniforms['rayleigh'].value = 2;
        uniforms['mieCoefficient'].value = 0.005;
        uniforms['mieDirectionalG'].value = 0.8;

        const phi = THREE.MathUtils.degToRad(70);
        const theta = THREE.MathUtils.degToRad(180);
        this.sunPos = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(this.sunPos);
    }

    setupWater() {
        // [최적화] 실시간 반사 연산이 포함된 Water.js 대신 단순한 평면 사용
        const waterGeometry = new THREE.PlaneGeometry(200000, 200000);
        const waterMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x004e5f,
            shininess: 10,
            specular: 0x111111
        });
        this.water = new THREE.Mesh(waterGeometry, waterMaterial);
        this.water.rotation.x = -Math.PI / 2;
        this.scene.add(this.water);
    }

    async loadCloudModel() {
        return new Promise((resolve) => {
            const loader = new GLTFLoader();
            loader.load('Assets/Enviroment/cloud/cloud.glb', (gltf) => {
                this.cloudModel = gltf.scene;
                // 구름 재질 최적화 (더 부드럽고 밝게)
                this.cloudModel.traverse(child => {
                    if (child.isMesh) {
                        child.material = new THREE.MeshBasicMaterial({
                            color: 0xffffff,
                            transparent: true,
                            opacity: 0.7,
                            depthWrite: false // 구름끼리 겹칠 때 어색함 방지
                        });
                    }
                });
                resolve();
            });
        });
    }

    setupClouds() {
        if (!this.cloudModel) return;

        for (let i = 0; i < this.cloudCount; i++) {
            const cloud = this.cloudModel.clone();
            this.resetCloud(cloud, -(i * (6000 / this.cloudCount))); 
            this.scene.add(cloud);
            this.clouds.push(cloud);
        }
    }

    resetCloud(cloud, zPos = -6000) {
        const area = this.config.cloudArea || 4000;
        const baseHeight = this.config.cloudHeight || 800;
        
        cloud.position.set(
            (Math.random() - 0.5) * area, 
            baseHeight + (Math.random() - 0.5) * 400, 
            zPos
        );

        // 랜덤 변형으로 다양성 확보
        const scale = 20 + Math.random() * 40;
        cloud.scale.set(scale, scale * 0.6, scale * 1.2);
        cloud.rotation.set(0, Math.random() * Math.PI * 2, 0);
        
        // 각 구름마다 미세하게 다른 투명도
        cloud.traverse(child => {
            if (child.isMesh) child.material.opacity = 0.4 + Math.random() * 0.4;
        });
    }

    update(deltaTime, worldZ, cameraPos) {
        if (this.water) {
            // [최적화] MeshPhongMaterial은 uniforms['time']이 없으므로 제거
            this.water.position.x = cameraPos.x;
            this.water.position.z = cameraPos.z; 
        }

        if (this.sky) {
            this.sky.position.copy(cameraPos);
        }

        /* [주석 처리: 구름 이동 업데이트]
        this.clouds.forEach(cloud => {
            // 카메라 뒤로 1.5km 지나면 앞으로 재배치
            if (cloud.position.z > cameraPos.z + 1500) {
                this.resetCloud(cloud, cameraPos.z - 4500);
            }
        });
        */
    }
}
