import * as THREE from 'three';

/**
 * [Data] Stage1 Config
 * 1스테이지 '운명의 오전'에 대한 환경 및 밸런스 데이터입니다.
 */
export const Stage1Config = {
    id: 'stage1',
    name: 'STAG 1: 운명의 오전',
    lighting: {
        ambientIntensity: 0.4,
        sunIntensity: 0.8,
        sunPosition: new THREE.Vector3(100, 200, 100),
        fogColor: 0x8da7b5,
        fogDensity: 0.00015
    },
    environment: {
        waterColor: 0x004e5f,
        cloudCount: 20, // 50 -> 20 (성능 최적화)
        cloudArea: 2000,
        cloudHeight: 500
    },
    spawn: {
        distance: 4000,
        poolSize: 3, // 적기를 3대로 줄여 CPU 부하 테스트
        enemySpeed: 60,
        types: ['zero', 'd3a']
    }
};
