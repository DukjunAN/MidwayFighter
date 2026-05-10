/**
 * [Master Metadata] 기체별 독립 설정 데이터 레코드
 * 로직(Code)과 데이터(JSON)를 분리하여 안정성을 극대화합니다.
 */
export const AircraftPresets = {
    'f4f': {
        id: 'f4f_wildcat',
        name: 'F4F Wildcat',
        modelPath: 'Assets/Player/F4F Wildcat/F4F_4.glb',
        scale: 6.5, // 1.0 -> 6.5 로 상향 (가시성 확보)
        altitude: 500,
        stats: { hp: 200, speed: 2.0, agility: 0.8, fireRate: 120 },
        propeller: { 
            parts: ['F4F_Propellor'], 
            axis: 'z', 
            autoCenter: false 
        },
        weapons: { 
            main: ['gun001', 'gun002', 'gun003', 'gun004', 'gun005', 'gun006'],
            autoRear: false,
            muzzleOffset: 0.2,
            muzzleScale: 1.0 
        }
    },
    'tbf': {
        id: 'tbf_avenger',
        name: 'TBF Avenger',
        modelPath: 'Assets/Player/TBF-1C/TBF-1C.glb',
        scale: 1.1,
        altitude: 500,
        stats: { hp: 200, speed: 0.7, agility: 0.4, fireRate: 200 },
        propeller: { 
            parts: ['Propella'], 
            axis: 'z', 
            autoCenter: false 
        },
        weapons: { 
            main: ['guns01', 'guns02'],
            rear: ['Object_4', 'Object_8'],
            bombs: ['Object_2'], // 어뢰/폭탄 추가
            autoRear: true,
            muzzleOffset: 0
        },
        ai: { type: 'torpedo_bomber' }
    },
    'g3m': {
        id: 'g3m_nell',
        name: 'G3M Nell',
        modelPath: 'Assets/Enemy/G3M/G3M.glb',
        scale: 1.6,
        altitude: 500,
        stats: { hp: 500, speed: 0.5, agility: 0.2, fireRate: 300 },
        propeller: { 
            parts: ['Propella1', 'Propella2'], 
            axis: 'z', 
            autoCenter: false 
        },
        weapons: { 
            main: ['gun01', 'gun02', 'gun03'], 
            bombs: ['Box06', 'Box15', 'Box07', 'Box14', 'Box09', 'Box17', 'Box11', 'B0x19'], // 다수 폭탄 추가
            autoRear: false, 
            muzzleOffset: 0,
            fireReverse: true 
        },
        ai: { type: 'heavy_bomber' }
    },
    'd3a': {
        id: 'd3a_val',
        name: 'D3a Val',
        modelPath: 'Assets/Enemy/D3a/D3A.glb',
        scale: 1.1,
        altitude: 500,
        stats: { hp: 120, speed: 0.9, agility: 0.7, fireRate: 180 },
        propeller: { 
            parts: ['lopast2_0'], 
            axis: 'z', 
            autoCenter: false 
        },
        weapons: { 
            main: ['gun01', 'gun02'], 
            bombs: ['B_30', 'B_30_1', 'B_250'], // 날개 및 동체 폭탄 추가
            autoRear: false, 
            muzzleOffset: 0 
        },
        ai: { type: 'dive_bomber' }
    },
    'zero': {
        id: 'a6m_zero',
        name: 'A6M Zero',
        modelPath: 'Assets/Enemy/A6M Zero/A6M_Zero.glb',
        scale: 3.0,
        altitude: 500,
        stats: { hp: 100, speed: 1.2, agility: 1.0, fireRate: 150 },
        propeller: { 
            parts: ['propeller'], 
            axis: 'z', 
            autoCenter: false 
        },
        weapons: { 
            main: ['gun01', 'gun02'],
            autoRear: false,
            muzzleOffset: 0,
            muzzleScale: 0.5
        },
        ai: { type: 'fighter' }
    }
};
