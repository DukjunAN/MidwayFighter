import { BaseAircraft } from '../BaseAircraft.js';

export class F4FAircraft extends BaseAircraft {
    constructor(scene) {
        super(scene);
        this.name = "F4F Wildcat";
        this.modelPath = 'Assets/Player/F4F Wildcat/F4F_4.glb';
        this.scale = 1.0;
        this.propellerNames = ['F4F_Propellor'];
        this.gunNames = ['gun001', 'gun002', 'gun003', 'gun004', 'gun005', 'gun006'];
        this.muzzleOffset = 0.2;
        this.muzzleScale = 1.0; // 기본 2.0에서 절반인 1.0으로 축소
    }
}
