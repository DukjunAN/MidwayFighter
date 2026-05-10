import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const modelCache = new Map();

const SHARED_GEOS = {
    muzzle: new THREE.CylinderGeometry(0, 0.08, 0.8, 6)
};
const SHARED_MATS = {
    muzzle: new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8 })
};

export class BaseAircraft {
    constructor(scene, config = null) {
        this.scene = scene;
        this.config = config;
        
        this.name = config?.name || "Base Aircraft";
        this.modelPath = config?.modelPath || "";
        this.scale = config?.scale || 1.0;
        this.propellerNames = config?.propeller?.parts || [];
        this.propellerAxis = config?.propeller?.axis || 'z';
        this.gunNames = config?.weapons?.main || [];
        this.muzzleOffset = config?.weapons?.muzzleOffset || 0;
        this.muzzleScale = config?.weapons?.muzzleScale || 2.0; 
        this.fireReverse = config?.weapons?.fireReverse || false; 
        this.altitude = config?.altitude || 500;

        this.mesh = null;
        this.propellers = [];
        this.guns = [];
        this.muzzleFlashes = [];
        this.isLoaded = false;
    }

    async load() {
        if (modelCache.has(this.modelPath)) {
            const cachedScene = modelCache.get(this.modelPath);
            this.mesh = cachedScene.clone(); 
            this.setupMesh();
            return this.mesh;
        }

        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.load(this.modelPath, (gltf) => {
                modelCache.set(this.modelPath, gltf.scene);
                this.mesh = gltf.scene.clone();
                this.setupMesh();
                resolve(this.mesh);
            }, undefined, reject);
        });
    }

    setupMesh() {
        if (!this.mesh) return;
        
        this.mesh.visible = false;
        this.mesh.scale.setScalar(this.scale);
        this.mesh.rotation.y = Math.PI;

        this.propellers = [];
        this.guns = [];

        this.mesh.traverse(child => {
            const name = child.name.toLowerCase();
            if (this.propellerNames.some(p => name.includes(p.toLowerCase()))) {
                this.propellers.push(child);
            }
            if (this.gunNames.some(g => name.includes(g.toLowerCase()))) {
                this.guns.push(child);
            }
            if (child.isMesh && child.material) {
                this.applyRobustMaterial(child);
            }
        });

        this.muzzleFlashes = this.guns.map(gun => this.attachMuzzleFlash(gun));
        this.scene.add(this.mesh);
        this.isLoaded = true;
    }

    attachMuzzleFlash(parentObject) {
        const flash = new THREE.Group();
        const mesh = new THREE.Mesh(SHARED_GEOS.muzzle, SHARED_MATS.muzzle);
        mesh.scale.setScalar(this.muzzleScale);
        mesh.rotation.x = this.fireReverse ? -Math.PI / 2 : Math.PI / 2;
        const zDir = this.fireReverse ? -1 : 1;
        mesh.position.z = (this.muzzleOffset + (0.8 * this.muzzleScale) / 2) * zDir; 
        flash.add(mesh);
        flash.visible = false;
        parentObject.add(flash);
        return flash;
    }

    applyRobustMaterial(child) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
            mat.side = THREE.DoubleSide;
            if (/glass|canopy|window/i.test(child.name)) {
                mat.transparent = true;
                mat.opacity = 0.3;
            }
        });
    }

    update(rotSpeed, isFiring) {
        if (!this.isLoaded || !this.mesh) return;
        this.propellers.forEach(prop => {
            if (this.propellerAxis === 'x') prop.rotateX(rotSpeed);
            else if (this.propellerAxis === 'z') prop.rotateZ(rotSpeed);
            else prop.rotateY(rotSpeed);
        });
        this.muzzleFlashes.forEach(flash => {
            // 사격 중일 때 랜덤하게 깜빡여서 뮤즐 효과 극대화
            flash.visible = isFiring ? Math.random() > 0.2 : false;
        });
    }

    fire() {
        if (!this.isLoaded) return [];
        const firePoints = [];
        this.guns.forEach(gun => {
            const wp = new THREE.Vector3();
            const wq = new THREE.Quaternion();
            gun.getWorldPosition(wp);
            gun.getWorldQuaternion(wq);
            const dir = new THREE.Vector3(0, 0, this.fireReverse ? -1 : 1).applyQuaternion(wq);
            firePoints.push({ position: wp, direction: dir });
        });
        return firePoints;
    }

    destroy() {
        if (this.mesh) this.scene.remove(this.mesh);
        this.isLoaded = false;
    }
}
