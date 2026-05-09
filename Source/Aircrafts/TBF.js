import { BaseAircraft } from '../BaseAircraft.js';

export class TBFAircraft extends BaseAircraft {
    constructor(scene) {
        super(scene);
        this.name = "TBF Avenger";
        this.modelPath = 'Assets/Player/TBF-1C/TBF-1C.glb';
        this.scale = 1.1;
        this.propellerNames = ['Propella'];
        this.propellerAxis = 'z'; // 'y'에서 'z'로 원복
        this.gunNames = ['guns01', 'guns02']; // 주 기총 2정만 유지 (프로펠러 쪽 사격 제거)
        this.rearGunNames = ['Object_4', 'Object_8']; // 후방 기총으로 분리
        this.bombNames = ['Object_2']; // 어뢰 추가
        this.muzzleOffset = 0; // 오리진 신뢰
    }
}
