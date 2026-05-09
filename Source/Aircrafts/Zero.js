import { BaseAircraft } from '../BaseAircraft.js';

export class ZeroAircraft extends BaseAircraft {
    constructor(scene) {
        super(scene);
        this.name = "A6M Zero";
        this.modelPath = 'Assets/Enemy/A6M Zero/A6M_Zero.glb';
        this.scale = 3.0;
        this.propellerNames = ['propeller']; // 'propellar'에서 수정
        this.propellerAxis = 'z'; // 'y'에서 'z'로 수정
        this.gunNames = ['gun01', 'gun02'];
        this.muzzleOffset = 0; 
        this.muzzleScale = 0.5; // 제로기 모델 스케일이 커서 화염 크기 별도 축소
    }
}
