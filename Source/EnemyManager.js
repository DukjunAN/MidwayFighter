import * as THREE from 'three';
import { AircraftFactory } from './AircraftFactory.js';
import { Stage1Config } from './Stage1.js';

/**
 * [Module] EnemyManager
 * 적 유닛의 생성(Spawn), AI 패턴(LookAt), 오브젝트 풀링을 전담합니다.
 */
export class EnemyManager {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.config = Stage1Config.spawn;
        this.enemies = [];
        this.spawnDist = this.config.distance || 5000; 
        this.poolSize = this.config.poolSize || 10;
        this.enemySpeed = this.config.enemySpeed || 50; 

        this.init();
    }

    async init() {
        for (let i = 0; i < this.poolSize; i++) {
            const types = this.config.types || ['zero', 'd3a'];
            const type = types[Math.floor(Math.random() * types.length)];
            const enemy = AircraftFactory.create(type, this.scene);
            await enemy.load();
            this.resetEnemy(enemy, this.camera.position.z - this.spawnDist - (i * 800));
            this.enemies.push(enemy);
        }
    }

    resetEnemy(enemy, zPos) {
        // 플레이어 고도 500m 기준 스폰 (400m ~ 650m)
        const playerAlt = 500;
        enemy.mesh.position.set(
            (Math.random() - 0.5) * 600,
            (playerAlt - 100) + Math.random() * 250,
            zPos
        );
        enemy.active = true;
        enemy.hp = enemy.config?.stats?.hp || 100;
    }

    update(deltaTime, playerSpeed, cameraPos) {
        const allEnemyFirePoints = [];
        
        this.enemies.forEach(enemy => {
            if (!enemy.isLoaded || !enemy.active) return;

            // 1. 공격 패턴: 플레이어를 향해 기수 고정 (lookAt)
            enemy.mesh.lookAt(cameraPos);

            // 2. 속도 합산 이동 (Player 전진 속도 + 적기 돌진 속도)
            const relativeMove = (playerSpeed + this.enemySpeed) * deltaTime;
            enemy.mesh.position.z += relativeMove;

            // 3. 오브젝트 풀링: 플레이어 뒤 2km 지나면 재배치
            if (enemy.mesh.position.z > cameraPos.z + 2000) {
                this.resetEnemy(enemy, cameraPos.z - this.spawnDist);
            }

            // 비주얼 업데이트 및 사격 포인트 수집
            const firePoints = enemy.update(0.5, cameraPos);
            if (firePoints) {
                allEnemyFirePoints.push(...firePoints);
            }
        });

        return allEnemyFirePoints;
    }

    getNearestDistance(pos) {
        let minDist = Infinity;
        this.enemies.forEach(e => {
            if (e.isLoaded) {
                const d = e.mesh.position.distanceTo(pos);
                if (d < minDist) minDist = d;
            }
        });
        return minDist === Infinity ? 0 : minDist;
    }
}
