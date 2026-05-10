import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Stage1Config } from './Stage1.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * [Module] EnvironmentManager
 * 정적 월드 마커와 물리적 이동감을 제공하는 환경 관리자입니다.
 */
export class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.water = null;
        this.sky = null;
        this.clouds = [];
        this.cloudCount = 20; 
        this.cloudModel = null;
        this.sunPos = new THREE.Vector3();
        this.lastCamZ = 0;
        
        this.init();
    }

    async init() {
        // 1. Fog (Snippet: 0x87ceeb, 0.00003)
        this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.00003);

        // 2. Sky & Sun (Snippet: phi 86)
        this.setupSky();

        // 3. Water (Snippet: 0x001e0f, 3.7)
        this.setupWater();

        // 4. Clouds (최소화 배치)
        await this.setupClouds();
    }

    setupSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        const uniforms = this.sky.material.uniforms;
        const phi = THREE.MathUtils.degToRad(86); 
        const theta = THREE.MathUtils.degToRad(180);
        this.sunPos.setFromSphericalCoords(1, phi, theta);
        uniforms['sunPosition'].value.copy(this.sunPos);
    }

    setupWater() {
        const waterGeometry = new THREE.PlaneGeometry(1000000, 1000000);
        this.water = new Water(
            waterGeometry,
            {
                textureWidth: 512,
                textureHeight: 512,
                waterNormals: new THREE.TextureLoader().load('https://threejs.org/examples/textures/waternormals.jpg', function (texture) {
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                }),
                sunDirection: this.sunPos,
                sunColor: 0xffffff,
                waterColor: 0x001e0f,
                distortionScale: 3.7,
                side: THREE.FrontSide
            }
        );
        this.water.rotation.x = -Math.PI / 2;
        this.scene.add(this.water);
    }

    async setupClouds() {
        const loader = new GLTFLoader();
        try {
            const gltf = await new Promise((resolve, reject) => {
                loader.load('Assets/Enviroment/cloud/cloud.glb', resolve, undefined, reject);
            });
            this.cloudModel = gltf.scene;
            this.cloudModel.traverse(child => {
                if (child.isMesh) {
                    child.material = new THREE.MeshBasicMaterial({
                        color: 0xffffff,
                        transparent: true,
                        opacity: 0.8,
                        depthWrite: false,
                        fog: false
                    });
                }
            });

            for (let i = 0; i < this.cloudCount; i++) {
                const cloud = this.cloudModel.clone();
                this.resetCloud(cloud, true);
                this.scene.add(cloud);
                this.clouds.push(cloud);
            }
        } catch (error) {
            console.error('Failed to load clouds:', error);
        }
    }

    resetCloud(cloud, isInitial = false) {
        const rangeX = 20000;
        const rangeZ = 40000;
        const x = (Math.random() - 0.5) * rangeX;
        const z = isInitial ? (Math.random() - 0.5) * rangeZ : this.lastCamZ - rangeZ;
        const y = 1000 + Math.random() * 1000;
        
        cloud.position.set(x, y, z);
        const scale = 30 + Math.random() * 50;
        cloud.scale.set(scale, scale * 0.6, scale);
        cloud.rotation.y = Math.random() * Math.PI * 2;
    }

    update(deltaTime, worldZ, cameraPos) {
        this.lastCamZ = cameraPos.z;

        if (this.water) {
            // 시간 기반 애니메이션
            this.water.material.uniforms['time'].value += deltaTime * 0.5;
            
            // 바다가 카메라를 따라오게 설정 (무한 평면 효과)
            this.water.position.x = cameraPos.x;
            this.water.position.z = cameraPos.z; 
        }

        if (this.sky) {
            this.sky.position.copy(cameraPos);
        }

        this.clouds.forEach(cloud => {
            const distZ = cloud.position.z - cameraPos.z;
            if (distZ > 5000) {
                this.resetCloud(cloud);
            }
        });
    }
}
