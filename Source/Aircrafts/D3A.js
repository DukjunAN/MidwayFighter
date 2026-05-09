import { BaseAircraft } from '../BaseAircraft.js';

export class D3AAircraft extends BaseAircraft {
    constructor(scene) {
        super(scene);
        this.name = "D3a Val";
        this.modelPath = 'Assets/Enemy/D3a/D3A.glb';
        this.scale = 1.1;
        this.propellerNames = ['lopast2_0']; // 최상위 오브젝트로 변경
        this.propellerAxis = 'z';
        this.gunNames = ['gun01', 'gun02']; // 기총 명칭 수정
        this.bombNames = ['B_30', 'B_30_1', 'B_250']; // 폭탄 추가
        this.muzzleOffset = 0;
    }
}
