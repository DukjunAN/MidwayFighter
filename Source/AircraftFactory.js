import { F4FAircraft } from './Aircrafts/F4F.js';
import { ZeroAircraft } from './Aircrafts/Zero.js';
import { TBFAircraft } from './Aircrafts/TBF.js';
import { G3MAircraft } from './Aircrafts/G3M.js';
import { D3AAircraft } from './Aircrafts/D3A.js';

export class AircraftFactory {
    static create(type, scene) {
        switch (type.toLowerCase()) {
            case 'f4f': return new F4FAircraft(scene);
            case 'zero': return new ZeroAircraft(scene);
            case 'tbf': return new TBFAircraft(scene);
            case 'g3m': return new G3MAircraft(scene);
            case 'd3a': return new D3AAircraft(scene);
            default:
                console.error(`Unknown aircraft type: ${type}`);
                return null;
        }
    }
}
