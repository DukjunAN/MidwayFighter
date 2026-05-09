import { BaseAircraft } from '../BaseAircraft.js';

export class G3MAircraft extends BaseAircraft {
    constructor(scene) {
        super(scene);
        this.name = "G3M Nell";
        this.modelPath = 'Assets/Enemy/G3M/G3M.glb';
        this.scale = 1.6;
        this.propellerNames = ['Propella1', 'Propella2'];
        this.propellerAxis = 'z';
        this.gunNames = ['gun01', 'gun02', 'gun03'];
        this.bombNames = ['Box06', 'Box15', 'Box07', 'Box14', 'Box09', 'Box17', 'Box11', 'B0x19'];
        this.muzzleOffset = 0;
        this.fireReverse = true; 
    }
}
