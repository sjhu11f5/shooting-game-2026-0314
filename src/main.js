import Phaser from 'phaser';

const GAME_W = 480;
const GAME_H = 720;

const STAGES = [
  {
    name: 'STAGE 1 - 宇宙空間',
    bg: 'bg_stage1',
    bossHp: 30, bossSprite: 'boss1', bossScale: 1.5,
    bossName: 'レッドコマンダー',
    enemiesBeforeBoss: 20, enemyInterval: 1500,
  },
  {
    name: 'STAGE 2 - 星雲地帯',
    bg: 'bg_stage2',
    bossHp: 50, bossSprite: 'boss2', bossScale: 1.8,
    bossName: 'ブルーデストロイヤー',
    enemiesBeforeBoss: 25, enemyInterval: 1300,
  },
  {
    name: 'STAGE 3 - 火星軌道',
    bg: 'bg_stage3',
    bossHp: 70, bossSprite: 'boss3', bossScale: 2.0,
    bossName: 'フレイムタイタン',
    enemiesBeforeBoss: 30, enemyInterval: 1100,
  },
  {
    name: 'STAGE 4 - 暗黒星域',
    bg: 'bg_stage4',
    bossHp: 100, bossSprite: 'boss4', bossScale: 2.2,
    bossName: 'ダークオーバーロード',
    enemiesBeforeBoss: 35, enemyInterval: 900,
  },
  {
    name: 'STAGE 5 - 最終決戦',
    bg: 'bg_stage5',
    bossHp: 150, bossSprite: 'boss5', bossScale: 2.5,
    bossName: 'エンペラーゴッド',
    enemiesBeforeBoss: 40, enemyInterval: 700,
  },
];

// ====== プリロードシーン ======
class PreloadScene extends Phaser.Scene {
  constructor() { super('PreloadScene'); }

  preload() {
    // ローディング表示
    const bar = this.add.graphics();
    this.load.on('progress', (v) => {
      bar.clear();
      bar.fillStyle(0x00ccff, 1);
      bar.fillRect(GAME_W / 2 - 150, GAME_H / 2, 300 * v, 20);
    });
    this.add.text(GAME_W / 2, GAME_H / 2 - 30, 'Loading...', {
      fontSize: '24px', fill: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const A = './assets/';
    // 自機
    this.load.image('player', A + 'player.png');
    // 敵
    this.load.image('enemy_basic', A + 'enemy_basic.png');
    this.load.image('enemy_fast', A + 'enemy_fast.png');
    this.load.image('enemy_tank', A + 'enemy_tank.png');
    // ボス
    for (let i = 1; i <= 5; i++) this.load.image('boss' + i, A + 'boss' + i + '.png');
    // 弾
    this.load.image('bullet', A + 'bullet.png');
    this.load.image('bullet_side', A + 'bullet_side.png');
    this.load.image('bullet_laser', A + 'bullet_laser.png');
    this.load.image('enemy_bullet', A + 'enemy_bullet.png');
    // パワーアップ
    this.load.image('powerup_weapon', A + 'powerup_weapon.png');
    this.load.image('powerup_life', A + 'powerup_life.png');
    // エフェクト
    this.load.image('explosion1', A + 'explosion1.png');
    this.load.image('explosion2', A + 'explosion2.png');
    this.load.image('star_effect', A + 'star_effect.png');
    // 背景
    for (let i = 1; i <= 5; i++) this.load.image('bg_stage' + i, A + 'bg_stage' + i + '.png');
    // 効果音（ogg + mp3 フォールバックでiOS対応）
    this.load.audio('sfx_shoot', [A + 'sfx_shoot.ogg', A + 'sfx_shoot.mp3']);
    this.load.audio('sfx_powerup', [A + 'sfx_powerup.ogg', A + 'sfx_powerup.mp3']);
    this.load.audio('sfx_explosion', [A + 'sfx_explosion.ogg', A + 'sfx_explosion.mp3']);
    this.load.audio('sfx_hit', [A + 'sfx_hit.ogg', A + 'sfx_hit.mp3']);
  }

  create() {
    this.scene.start('GameScene');
  }
}

// ====== メインゲームシーン ======
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.score = 0;
    this.gameOver = false;
    this.paused = false;
    this.weaponLevel = 0;
    this.lives = 3;

    this.currentStage = 0;
    this.enemiesKilled = 0;
    this.bossActive = false;
    this.boss = null;
    this.bossHpBarBg = null;
    this.bossHpBar = null;
    this.bossNameText = null;
    this.stageClearShowing = false;

    // 背景（タイル繰り返し）
    this.bgTile = this.add.tileSprite(0, 0, GAME_W, GAME_H, STAGES[0].bg)
      .setOrigin(0, 0).setDepth(0);

    // 自機
    this.player = this.add.image(GAME_W / 2, GAME_H - 80, 'player')
      .setScale(0.6).setDepth(10);

    // グループ
    this.bullets = this.add.group();
    this.enemyBullets = this.add.group();
    this.bossBullets = this.add.group();
    this.enemies = this.add.group();
    this.powerups = this.add.group();
    this.explosions = [];

    // 効果音
    this.sfx = {
      shoot: this.sound.add('sfx_shoot', { volume: 0.3 }),
      powerup: this.sound.add('sfx_powerup', { volume: 0.5 }),
      explosion: this.sound.add('sfx_explosion', { volume: 0.4 }),
      hit: this.sound.add('sfx_hit', { volume: 0.3 }),
    };

    // 入力
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys('W,A,S,D');
    this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.pKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);

    // タイマー
    this.shootTimer = 0;
    this.enemySpawnTimer = 0;
    this.powerupSpawnTimer = 0;
    this.difficulty = 1;

    // UI
    this.scoreText = this.add.text(10, 10, 'SCORE: 0', {
      fontSize: '20px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setDepth(50);
    this.livesText = this.add.text(GAME_W - 10, 10, '♥♥♥', {
      fontSize: '20px', fill: '#ff4444', fontFamily: 'Arial',
    }).setOrigin(1, 0).setDepth(50);
    this.weaponText = this.add.text(10, 36, 'WEAPON: Lv.1', {
      fontSize: '14px', fill: '#00ffcc', fontFamily: 'Arial',
    }).setDepth(50);
    this.stageText = this.add.text(GAME_W / 2, 36, '', {
      fontSize: '14px', fill: '#ffcc00', fontFamily: 'Arial',
    }).setOrigin(0.5, 0).setDepth(50);

    // ポーズ
    this.pauseOverlay = this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7)
      .setVisible(false).setDepth(100);
    this.pauseTitle = this.add.text(GAME_W / 2, GAME_H / 2 - 60, 'PAUSED', {
      fontSize: '48px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false).setDepth(101);
    this.pauseInfo = this.add.text(GAME_W / 2, GAME_H / 2, [
      'ESC / P  : もどる', '', '移動 : 矢印キー / WASD', '射撃 : 自動',
    ].join('\n'), {
      fontSize: '18px', fill: '#aaaaaa', fontFamily: 'Arial', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5).setVisible(false).setDepth(101);
    this.pauseBtn = this.add.text(GAME_W / 2, 14, '❚❚', {
      fontSize: '22px', fill: '#888888', fontFamily: 'Arial',
    }).setOrigin(0.5, 0).setInteractive().setDepth(50);
    this.pauseBtn.on('pointerdown', (e) => { e.stopPropagation(); this.togglePause(); });
    this.escKey.on('down', () => this.togglePause());
    this.pKey.on('down', () => this.togglePause());

    // モバイル
    this.input.on('pointermove', (pointer) => {
      if (!this.gameOver && !this.paused && pointer.isDown) {
        this.player.x = Phaser.Math.Clamp(pointer.x, 20, GAME_W - 20);
        this.player.y = Phaser.Math.Clamp(pointer.y, 20, GAME_H - 20);
      }
    });

    this.showStageStart();
  }

  // ====== 背景 ======
  setupBackground() {
    this.bgTile.setTexture(STAGES[this.currentStage].bg);
  }

  showStageStart() {
    const stage = STAGES[this.currentStage];
    this.stageText.setText(stage.name);
    const title = this.add.text(GAME_W / 2, GAME_H / 2 - 40, stage.name, {
      fontSize: '32px', fill: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(80).setAlpha(0);
    this.tweens.add({
      targets: title, alpha: 1, duration: 500, yoyo: true, hold: 2000,
      onComplete: () => title.destroy(),
    });
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseTitle.setVisible(this.paused);
    this.pauseInfo.setVisible(this.paused);
    this.pauseBtn.setText(this.paused ? '▶' : '❚❚');
  }

  // ====== 敵 ======
  createEnemy(x, y, type) {
    let spriteKey, scale, hp, speed, points, shootChance;
    if (type === 'basic') {
      spriteKey = 'enemy_basic'; scale = 0.5;
      hp = 1; speed = 2 + this.difficulty * 0.3; points = 100;
      shootChance = 0.005 * this.difficulty;
    } else if (type === 'fast') {
      spriteKey = 'enemy_fast'; scale = 0.4;
      hp = 1; speed = 4 + this.difficulty * 0.4; points = 150;
      shootChance = 0;
    } else {
      spriteKey = 'enemy_tank'; scale = 0.6;
      hp = 3; speed = 1 + this.difficulty * 0.2; points = 300;
      shootChance = 0.01 * this.difficulty;
    }
    const e = this.add.image(x, y, spriteKey).setScale(scale).setDepth(5);
    e.type = type; e.hp = hp; e.speed = speed; e.points = points;
    e.shootChance = shootChance;
    e.hitRadius = scale * 50;
    this.enemies.add(e);
    return e;
  }

  // ====== ボス ======
  spawnBoss() {
    this.bossActive = true;
    const stage = STAGES[this.currentStage];

    this.enemies.getChildren().forEach(e => e.destroy());
    this.enemyBullets.getChildren().forEach(b => b.destroy());

    const boss = this.add.image(GAME_W / 2, -80, stage.bossSprite)
      .setScale(stage.bossScale).setDepth(5).setFlipY(true);
    boss.maxHp = stage.bossHp;
    boss.hp = stage.bossHp;
    boss.phase = 0;
    boss.moveTimer = 0;
    boss.shootTimer = 0;
    boss.targetX = GAME_W / 2;
    this.boss = boss;

    this.tweens.add({ targets: boss, y: 110, duration: 2000, ease: 'Power2' });

    this.bossHpBarBg = this.add.rectangle(GAME_W / 2, 60, 300, 14, 0x333333).setDepth(60);
    this.bossHpBar = this.add.rectangle(GAME_W / 2, 60, 300, 14, 0xff4444).setDepth(61);
    this.bossNameText = this.add.text(GAME_W / 2, 74, stage.bossName, {
      fontSize: '14px', fill: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(61);

    const warning = this.add.text(GAME_W / 2, GAME_H / 2, 'WARNING!', {
      fontSize: '48px', fill: '#ff0000', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(80);
    this.tweens.add({
      targets: warning, alpha: 0, duration: 300, yoyo: true, repeat: 4,
      onComplete: () => warning.destroy(),
    });
  }

  updateBoss(delta) {
    if (!this.boss || this.boss.y < 80) return;
    const boss = this.boss;
    const hpRatio = boss.hp / boss.maxHp;

    this.bossHpBar.width = 300 * hpRatio;

    boss.moveTimer += delta;
    if (boss.moveTimer > 2000) {
      boss.moveTimer = 0;
      boss.targetX = Phaser.Math.Between(60, GAME_W - 60);
    }
    boss.x += (boss.targetX - boss.x) * 0.02;

    boss.shootTimer += delta;
    const shootInterval = Math.max(300, 800 - this.currentStage * 100);
    if (boss.shootTimer > shootInterval) {
      boss.shootTimer = 0;
      this.addBossBullet(boss.x, boss.y + 50, 0, 5);
      if (this.currentStage >= 1) {
        this.addBossBullet(boss.x - 25, boss.y + 40, -1, 4.5);
        this.addBossBullet(boss.x + 25, boss.y + 40, 1, 4.5);
      }
      if (this.currentStage >= 2) {
        this.addBossBullet(boss.x - 40, boss.y + 30, -2, 4);
        this.addBossBullet(boss.x + 40, boss.y + 30, 2, 4);
      }
      if (this.currentStage >= 3) {
        const angle = Phaser.Math.Angle.Between(boss.x, boss.y, this.player.x, this.player.y);
        this.addBossBullet(boss.x, boss.y + 40, Math.cos(angle) * 5, Math.sin(angle) * 5);
      }
    }

    if (hpRatio < 0.5) {
      boss.phase += delta * 0.003;
      if (Math.sin(boss.phase) > 0.95) {
        for (let a = 0; a < Math.PI * 2; a += Math.PI / (3 + this.currentStage)) {
          this.addBossBullet(
            boss.x + Math.cos(a) * 30, boss.y + Math.sin(a) * 30,
            Math.cos(a) * 3, Math.sin(a) * 3
          );
        }
      }
    }
  }

  addBossBullet(x, y, vx, vy) {
    const b = this.add.image(x, y, 'enemy_bullet').setScale(0.6).setDepth(4);
    b.vx = vx; b.vy = vy;
    const angle = Math.atan2(vy, vx);
    b.setRotation(angle + Math.PI / 2);
    this.bossBullets.add(b);
  }

  defeatBoss() {
    this.bossActive = false;
    this.stageClearShowing = true;
    this.sfx.explosion.play();

    const bossX = this.boss.x;
    const bossY = this.boss.y;

    for (let i = 0; i < 20; i++) {
      this.time.delayedCall(i * 60, () => {
        this.createExplosion(
          bossX + Phaser.Math.Between(-50, 50),
          bossY + Phaser.Math.Between(-40, 40)
        );
      });
    }

    this.time.delayedCall(600, () => {
      if (this.boss) { this.boss.destroy(); this.boss = null; }
      if (this.bossHpBarBg) { this.bossHpBarBg.destroy(); this.bossHpBarBg = null; }
      if (this.bossHpBar) { this.bossHpBar.destroy(); this.bossHpBar = null; }
      if (this.bossNameText) { this.bossNameText.destroy(); this.bossNameText = null; }
    });

    this.bossBullets.getChildren().forEach(b => b.destroy());

    const bonus = (this.currentStage + 1) * 2000;
    this.score += bonus;
    this.scoreText.setText('SCORE: ' + this.score);

    const clearText = this.add.text(GAME_W / 2, GAME_H / 2 - 50, 'STAGE CLEAR!', {
      fontSize: '40px', fill: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(80);
    const bonusText = this.add.text(GAME_W / 2, GAME_H / 2, '+' + bonus + ' BONUS!', {
      fontSize: '24px', fill: '#ffffff', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(80);

    this.time.delayedCall(3000, () => {
      clearText.destroy();
      bonusText.destroy();
      this.stageClearShowing = false;
      if (this.currentStage < STAGES.length - 1) {
        this.currentStage++;
        this.enemiesKilled = 0;
        this.difficulty = 1 + this.currentStage * 0.5;
        this.setupBackground();
        this.showStageStart();
      } else {
        this.showAllClear();
      }
    });
  }

  showAllClear() {
    this.gameOver = true;
    this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.7).setDepth(90);
    this.add.text(GAME_W / 2, GAME_H / 2 - 80, 'ALL STAGES CLEAR!', {
      fontSize: '36px', fill: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(91);
    this.add.text(GAME_W / 2, GAME_H / 2 - 20, 'FINAL SCORE: ' + this.score, {
      fontSize: '28px', fill: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(91);
    this.add.text(GAME_W / 2, GAME_H / 2 + 20, 'WEAPON: Lv.' + (this.weaponLevel + 1), {
      fontSize: '20px', fill: '#00ffcc', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(91);
    this.add.text(GAME_W / 2, GAME_H / 2 + 80, 'クリック / SPACEでリトライ', {
      fontSize: '18px', fill: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(91);
    this.input.once('pointerdown', () => this.scene.restart());
    this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
  }

  // ====== パワーアップ ======
  createPowerup(x, y) {
    const isWeapon = Math.random() < 0.5;
    const key = isWeapon ? 'powerup_weapon' : 'powerup_life';
    const type = isWeapon ? 'weapon' : 'life';

    const p = this.add.image(x, y, key).setScale(1.2).setDepth(5);
    p.speed = 1.5;
    p.powerType = type;
    p.floatOffset = 0;
    p.baseScale = 1.2;
    this.powerups.add(p);
    return p;
  }

  applyPowerup(type) {
    this.sfx.powerup.play();
    if (type === 'weapon') {
      if (this.weaponLevel < 9) {
        this.weaponLevel++;
        this.weaponText.setText('WEAPON: Lv.' + (this.weaponLevel + 1));
        this.showPowerupMessage(this.getWeaponName(this.weaponLevel) + '！');
      } else {
        this.score += 1000;
        this.scoreText.setText('SCORE: ' + this.score);
        this.showPowerupMessage('MAX! +1000ボーナス！');
      }
    } else {
      if (this.lives < 10) {
        this.lives++;
        this.livesText.setText('♥'.repeat(this.lives));
        this.showPowerupMessage('ライフ回復！');
      } else {
        this.score += 500;
        this.scoreText.setText('SCORE: ' + this.score);
        this.showPowerupMessage('+500ボーナス！');
      }
    }
  }

  getWeaponName(level) {
    const names = [
      'Lv.2 ダブルショット', 'Lv.3 ワイドショット', 'Lv.4 トリプルショット',
      'Lv.5 ラピッドショット', 'Lv.6 5WAYショット', 'Lv.7 ヘビーショット',
      'Lv.8 プラズマショット', 'Lv.9 レーザー追加', 'Lv.10 MAXパワー',
    ];
    return names[level - 1] || '';
  }

  showPowerupMessage(text) {
    const msg = this.add.text(GAME_W / 2, GAME_H / 2 - 100, text, {
      fontSize: '28px', fill: '#ffff00', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: msg, y: msg.y - 40, alpha: 0, duration: 1200,
      onComplete: () => msg.destroy(),
    });
  }

  // ====== 射撃 ======
  shootBullet() {
    this.sfx.shoot.play();
    const px = this.player.x;
    const py = this.player.y - 30;
    const lv = this.weaponLevel;

    if (lv === 0) {
      this.addBullet(px, py, 0, -10, 'bullet', 0.7);
    } else if (lv === 1) {
      this.addBullet(px - 10, py, 0, -10, 'bullet', 0.7);
      this.addBullet(px + 10, py, 0, -10, 'bullet', 0.7);
    } else if (lv === 2) {
      this.addBullet(px, py, 0, -10, 'bullet', 0.7);
      this.addBullet(px - 12, py, -1.5, -10, 'bullet_side', 0.5);
      this.addBullet(px + 12, py, 1.5, -10, 'bullet_side', 0.5);
    } else if (lv === 3) {
      this.addBullet(px, py, 0, -11, 'bullet', 0.8);
      this.addBullet(px - 14, py, 0, -10, 'bullet', 0.7);
      this.addBullet(px + 14, py, 0, -10, 'bullet', 0.7);
    } else if (lv === 4) {
      this.addBullet(px, py, 0, -12, 'bullet', 0.8);
      this.addBullet(px - 14, py, 0, -11, 'bullet', 0.7);
      this.addBullet(px + 14, py, 0, -11, 'bullet', 0.7);
    } else if (lv === 5) {
      this.addBullet(px, py, 0, -12, 'bullet', 0.8);
      this.addBullet(px - 10, py, -1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px + 10, py, 1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px - 20, py, -3, -9, 'bullet_side', 0.5);
      this.addBullet(px + 20, py, 3, -9, 'bullet_side', 0.5);
    } else if (lv === 6) {
      this.addBullet(px, py, 0, -12, 'bullet', 1.0, 2);
      this.addBullet(px - 12, py, -1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px + 12, py, 1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px - 22, py, -3, -9, 'bullet_side', 0.5);
      this.addBullet(px + 22, py, 3, -9, 'bullet_side', 0.5);
    } else if (lv === 7) {
      this.addBullet(px, py, 0, -13, 'bullet', 1.0, 2);
      this.addBullet(px - 12, py, -1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px + 12, py, 1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px - 22, py, -3, -9, 'bullet_side', 0.5);
      this.addBullet(px + 22, py, 3, -9, 'bullet_side', 0.5);
      this.addBullet(px - 8, py + 10, -0.5, -10, 'bullet', 0.5);
      this.addBullet(px + 8, py + 10, 0.5, -10, 'bullet', 0.5);
    } else if (lv === 8) {
      this.addBullet(px, py, 0, -14, 'bullet', 1.0, 2);
      this.addBullet(px - 12, py, -1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px + 12, py, 1.5, -11, 'bullet_side', 0.6);
      this.addBullet(px - 22, py, -3, -9, 'bullet_side', 0.5);
      this.addBullet(px + 22, py, 3, -9, 'bullet_side', 0.5);
      this.addBullet(px - 8, py + 10, -0.5, -10, 'bullet', 0.5);
      this.addBullet(px + 8, py + 10, 0.5, -10, 'bullet', 0.5);
      this.addBullet(px, py - 10, 0, -16, 'bullet_laser', 0.7, 1, true);
    } else {
      this.addBullet(px, py, 0, -14, 'bullet', 1.2, 3);
      this.addBullet(px - 14, py, -1.5, -12, 'bullet_side', 0.7);
      this.addBullet(px + 14, py, 1.5, -12, 'bullet_side', 0.7);
      this.addBullet(px - 24, py, -3, -10, 'bullet_side', 0.5);
      this.addBullet(px + 24, py, 3, -10, 'bullet_side', 0.5);
      this.addBullet(px - 8, py + 10, -0.5, -11, 'bullet', 0.5);
      this.addBullet(px + 8, py + 10, 0.5, -11, 'bullet', 0.5);
      this.addBullet(px - 5, py - 10, 0, -18, 'bullet_laser', 0.7, 1, true);
      this.addBullet(px + 5, py - 10, 0, -18, 'bullet_laser', 0.7, 1, true);
    }
  }

  addBullet(x, y, vx, vy, sprite, scale, damage = 1, piercing = false) {
    const b = this.add.image(x, y, sprite).setScale(scale).setDepth(6);
    b.vx = vx; b.vy = vy; b.damage = damage; b.piercing = piercing;
    const angle = Math.atan2(vy, vx);
    b.setRotation(angle + Math.PI / 2);
    this.bullets.add(b);
  }

  shootEnemyBullet(enemy) {
    const b = this.add.image(enemy.x, enemy.y + 20, 'enemy_bullet')
      .setScale(0.5).setDepth(4);
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
    b.vx = Math.cos(angle) * 4;
    b.vy = Math.sin(angle) * 4;
    b.setRotation(angle + Math.PI / 2);
    this.enemyBullets.add(b);
  }

  createExplosion(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const sprites = ['explosion1', 'explosion2', 'star_effect'];
      const sprite = sprites[Phaser.Math.Between(0, 2)];
      const exp = this.add.image(
        x + Phaser.Math.Between(-10, 10),
        y + Phaser.Math.Between(-10, 10),
        sprite
      )
        .setScale(Phaser.Math.FloatBetween(0.5, 1.2))
        .setDepth(20)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
        .setTint(Phaser.Math.RND.pick([0xffffff, 0xff8800, 0xffcc00, 0xff4444]));
      exp.vx = Phaser.Math.FloatBetween(-3, 3);
      exp.vy = Phaser.Math.FloatBetween(-3, 3);
      exp.life = 1;
      this.explosions.push(exp);
    }
  }

  spawnEnemyWave() {
    const rand = Math.random();
    if (rand < 0.5) {
      this.createEnemy(Phaser.Math.Between(30, GAME_W - 30), -30, 'basic');
    } else if (rand < 0.8) {
      const baseX = Phaser.Math.Between(60, GAME_W - 60);
      for (let i = -1; i <= 1; i++) {
        this.createEnemy(baseX + i * 50, -30 - Math.abs(i) * 25, 'fast');
      }
    } else {
      this.createEnemy(Phaser.Math.Between(40, GAME_W - 40), -40, 'tank');
    }
  }

  // ====== メインループ ======
  update(time, delta) {
    if (this.gameOver) return;
    if (this.paused) return;

    // 背景スクロール
    this.bgTile.tilePositionY -= 1;

    // 自機移動
    const speed = 5;
    if (this.cursors.left.isDown || this.wasd.A.isDown) this.player.x -= speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) this.player.x += speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) this.player.y -= speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) this.player.y += speed;
    this.player.x = Phaser.Math.Clamp(this.player.x, 20, GAME_W - 20);
    this.player.y = Phaser.Math.Clamp(this.player.y, 20, GAME_H - 20);

    if (this.stageClearShowing) { this.updateExplosions(); return; }

    // 自動射撃
    this.shootTimer += delta;
    const shootInterval = this.weaponLevel >= 4 ? 140 : 200;
    if (this.shootTimer > shootInterval) {
      this.shootTimer = 0;
      this.shootBullet();
    }

    // 敵スポーン
    if (!this.bossActive) {
      this.enemySpawnTimer += delta;
      const stage = STAGES[this.currentStage];
      const interval = Math.max(400, stage.enemyInterval - this.difficulty * 80);
      if (this.enemySpawnTimer > interval) {
        this.enemySpawnTimer = 0;
        this.spawnEnemyWave();
      }
      if (this.enemiesKilled >= stage.enemiesBeforeBoss) {
        this.spawnBoss();
      }
    }

    // パワーアップ
    this.powerupSpawnTimer += delta;
    if (this.powerupSpawnTimer > 12000) {
      this.powerupSpawnTimer = 0;
      this.createPowerup(Phaser.Math.Between(40, GAME_W - 40), -20);
    }

    if (this.bossActive) this.updateBoss(delta);

    // 弾移動
    this.bullets.getChildren().forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.y < -20 || b.x < -20 || b.x > GAME_W + 20) b.destroy();
    });
    this.enemyBullets.getChildren().forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.y > GAME_H + 20 || b.x < -20 || b.x > GAME_W + 20) b.destroy();
    });
    this.bossBullets.getChildren().forEach(b => {
      b.x += b.vx; b.y += b.vy;
      if (b.y > GAME_H + 20 || b.y < -20 || b.x < -20 || b.x > GAME_W + 20) b.destroy();
    });

    // 敵移動
    this.enemies.getChildren().forEach(e => {
      e.y += e.speed;
      if (e.y > GAME_H + 40) { e.destroy(); return; }
      if (e.shootChance > 0 && Math.random() < e.shootChance) this.shootEnemyBullet(e);
    });

    // パワーアップ移動（ゆらゆら＋脈動）
    this.powerups.getChildren().forEach(p => {
      p.y += p.speed;
      p.floatOffset += 0.05;
      p.x += Math.sin(p.floatOffset) * 0.8;
      p.setScale(p.baseScale + Math.sin(p.floatOffset * 2) * 0.15);
      p.setRotation(Math.sin(p.floatOffset) * 0.2);
      if (p.y > GAME_H + 20) p.destroy();
    });

    // 自弾 vs 敵
    this.bullets.getChildren().forEach(b => {
      this.enemies.getChildren().forEach(e => {
        if (Math.abs(b.x - e.x) < e.hitRadius && Math.abs(b.y - e.y) < e.hitRadius) {
          e.hp -= b.damage;
          if (!b.piercing) b.destroy();
          if (e.hp <= 0) {
            this.score += e.points;
            this.enemiesKilled++;
            this.scoreText.setText('SCORE: ' + this.score);
            const expCount = e.type === 'tank' ? 10 : 6;
            this.createExplosion(e.x, e.y, expCount);
            this.sfx.explosion.play();
            e.destroy();
          }
        }
      });
    });

    // 自弾 vs ボス
    if (this.bossActive && this.boss) {
      this.bullets.getChildren().forEach(b => {
        if (Math.abs(b.x - this.boss.x) < 50 && Math.abs(b.y - this.boss.y) < 45) {
          this.boss.hp -= b.damage;
          if (!b.piercing) b.destroy();
          this.createExplosion(b.x, b.y);
          if (this.boss.hp <= 0) this.defeatBoss();
        }
      });
    }

    // 自機 vs パワーアップ
    this.powerups.getChildren().forEach(p => {
      if (Math.abs(p.x - this.player.x) < 25 && Math.abs(p.y - this.player.y) < 25) {
        this.applyPowerup(p.powerType);
        p.destroy();
      }
    });

    // 敵弾 vs 自機
    this.enemyBullets.getChildren().forEach(b => {
      if (Math.abs(b.x - this.player.x) < 16 && Math.abs(b.y - this.player.y) < 16) {
        b.destroy(); this.playerHit();
      }
    });

    // ボス弾 vs 自機
    this.bossBullets.getChildren().forEach(b => {
      if (Math.abs(b.x - this.player.x) < 16 && Math.abs(b.y - this.player.y) < 16) {
        b.destroy(); this.playerHit();
      }
    });

    // 敵本体 vs 自機
    this.enemies.getChildren().forEach(e => {
      if (Math.abs(e.x - this.player.x) < e.hitRadius + 12 &&
          Math.abs(e.y - this.player.y) < e.hitRadius + 12) {
        this.createExplosion(e.x, e.y);
        e.destroy(); this.playerHit();
      }
    });

    // ボス本体 vs 自機
    if (this.bossActive && this.boss) {
      if (Math.abs(this.boss.x - this.player.x) < 50 &&
          Math.abs(this.boss.y - this.player.y) < 45) {
        this.playerHit();
      }
    }

    this.updateExplosions();
  }

  updateExplosions() {
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const p = this.explosions[i];
      p.x += p.vx; p.y += p.vy;
      p.life -= 0.03;
      p.setAlpha(p.life);
      p.setScale(p.scaleX * 0.98);
      if (p.life <= 0) { p.destroy(); this.explosions.splice(i, 1); }
    }
  }

  playerHit() {
    this.lives--;
    this.livesText.setText('♥'.repeat(Math.max(this.lives, 0)));
    this.createExplosion(this.player.x, this.player.y);
    this.sfx.explosion.play();

    if (this.lives <= 0) {
      this.gameOver = true;
      this.player.setVisible(false);
      this.add.rectangle(GAME_W / 2, GAME_H / 2, GAME_W, GAME_H, 0x000000, 0.6).setDepth(90);
      this.add.text(GAME_W / 2, GAME_H / 2 - 50, 'GAME OVER', {
        fontSize: '48px', fill: '#ff4444', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(91);
      this.add.text(GAME_W / 2, GAME_H / 2 + 10, 'SCORE: ' + this.score, {
        fontSize: '28px', fill: '#ffffff', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(91);
      this.add.text(GAME_W / 2, GAME_H / 2 + 50, STAGES[this.currentStage].name, {
        fontSize: '18px', fill: '#ffcc00', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(91);
      this.add.text(GAME_W / 2, GAME_H / 2 + 90, 'クリック / SPACEでリトライ', {
        fontSize: '18px', fill: '#aaaaaa', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(91);
      this.input.once('pointerdown', () => this.scene.restart());
      this.input.keyboard.once('keydown-SPACE', () => this.scene.restart());
    } else {
      let blink = 0;
      this.time.addEvent({
        delay: 100, repeat: 15,
        callback: () => { blink++; this.player.setVisible(blink % 2 === 0); }
      });
    }
  }
}

const config = {
  type: Phaser.AUTO,
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#0a0a1a',
  scene: [PreloadScene, GameScene],
  parent: document.body,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

new Phaser.Game(config);
