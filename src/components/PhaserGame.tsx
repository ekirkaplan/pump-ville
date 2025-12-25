'use client';

import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { WorldResponse, SpawnPoint } from '@/lib/types';

type MessageText = Phaser.GameObjects.Text & { walletAddress?: string };

class GameScene extends Phaser.Scene {
    private map!: Phaser.Tilemaps.Tilemap;
    private tileset!: Phaser.Tilemaps.Tileset;
    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private wallsLayer!: Phaser.Tilemaps.TilemapLayer;
    private characters: Phaser.Physics.Arcade.Sprite[] = [];
    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private characterMap: Map<string, Phaser.Physics.Arcade.Sprite> = new Map(); // wallet -> sprite
    private messageTexts: MessageText[] = [];
    private walletLabels: Map<string, Phaser.GameObjects.Text> = new Map(); // wallet -> label

    // Ayarlar (ENV ile override edilebilir)
    private CHAR_COUNT = parseInt(process.env.NEXT_PUBLIC_CHAR_COUNT || '2', 10);
    private SPRITE_SCALE = parseFloat(process.env.NEXT_PUBLIC_SPRITE_SCALE || '0.20');
    private SPRITE_COLS = parseInt(process.env.NEXT_PUBLIC_SPRITE_COLS || '3', 10); // ← senin spritelar için 3

    // runtime hesapları
    private cols: Record<string, number> = {};
    private fw:   Record<string, number> = {};
    private fh:   Record<string, number> = {};

    constructor() { super({ key: 'GameScene' }); }

    preload() {
        // Harita
        this.load.tilemapTiledJSON('map', '/map.json');
        this.load.image('tiles32', '/tiles32.png');       // Tiled tileset adı: "Tiles32"
        this.load.image('tree', '/tree.png');             // Tiled tileset adı: "Tree"
        this.load.image('home', '/home.png');             // Tiled tileset adı: "PumpHouse"

        // Spriteları HAM RESİM olarak yükle
        for (let i = 1; i <= this.CHAR_COUNT; i++) {
            this.load.image(`raw-${i}`, `/${i}.png`);
        }
    }

    create() {
        // --- Tilemap
        this.map = this.make.tilemap({ key: 'map' });
        
        // Tiled'deki tileset adlarıyla EŞLE:
        const tsBase  = this.map.addTilesetImage('Tiles32', 'tiles32');
        const tsTree  = this.map.addTilesetImage('Tree', 'tree');
        this.map.addTilesetImage('PumpHouse', 'home');

        // Ground katmanı: aynı katmanda birden fazla tileset kullanıldığı için DİZİ ver
        this.groundLayer = this.map.createLayer('Desen Katmanı 1', [tsBase, tsTree], 0, 0)!;
        this.wallsLayer = this.groundLayer; // tek katman ise buradan collision ver
        this.groundLayer.setCollisionByProperty({ collides: true });
        this.groundLayer.setDepth(0);

        // --- NESNE KATMANI: ev ve ağaçları sprite olarak oluştur ---
        const objLayer = this.map.getObjectLayer('Nesneler');
        if (objLayer) {
            console.log('🌳 Processing Nesneler layer...');
            
            // Tiled'den firstgid'leri oku (map.json'unda PumpHouse=4, Tree=5)
            const houseFirstGid = this.map.getTileset('PumpHouse')?.firstgid ?? 4;
            const treeFirstGid  = this.map.getTileset('Tree')?.firstgid ?? 5;
            
            console.log(`🏠 House firstgid: ${houseFirstGid}`);
            console.log(`🌳 Tree firstgid: ${treeFirstGid}`);

            // 1) Evleri oluştur
            const houses = this.map.createFromObjects('Nesneler', {
                gid: houseFirstGid,
                key: 'home',
            }) as Phaser.GameObjects.Image[];

            // 2) Ağaçları oluştur
            const trees = this.map.createFromObjects('Nesneler', {
                gid: treeFirstGid,
                key: 'tree',
            }) as Phaser.GameObjects.Image[];

            console.log(`🏠 Found ${houses.length} houses`);
            console.log(`🌳 Found ${trees.length} trees`);

            // Statik collider grubu (gerekirse)
            const staticGroup = this.physics.add.staticGroup();

            const place = (img: Phaser.GameObjects.Image, type: 'house'|'tree') => {
                // Tiled tile-object koordinatı genelde alt çizgiye göredir; alt-orta hizala
                img.setOrigin(0.5, 1);
                img.setDepth(img.y);

                // Statik gövde: sadece ayak izi (alt bant)
                this.physics.add.existing(img, true);
                const body = img.body as Phaser.Physics.Arcade.StaticBody;

                const w = img.width, h = img.height;
                // Ev ve ağaç için farklı "footprint" oranı
                const footW = w * (type === 'house' ? 0.65 : 0.55);
                const footH = h * (type === 'house' ? 0.25 : 0.20);
                const offX  = (w - footW) / 2;
                const offY  = h - footH;

                body.setSize(footW, footH);
                body.setOffset(offX, offY);
                body.updateFromGameObject();

                staticGroup.add(img);
            };

            houses.forEach(i => place(i, 'house'));
            trees.forEach(i => place(i, 'tree'));

            // Karakterlerle çarpışma (karakterler spawn olduktan sonra eklenecek)
            this.time.delayedCall(1000, () => {
                this.characters.forEach(player => {
                    this.physics.add.collider(player, staticGroup);
                });
            });

            console.log(`✅ Created ${houses.length} houses and ${trees.length} trees from Nesneler layer`);
        }

        // Dünya sınırı
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // --- Ham resimlerden spritesheet üret (SÜTUN sayısı ENV’den)
        for (let i = 1; i <= this.CHAR_COUNT; i++) {
            const rawKey = `raw-${i}`;
            const img = this.textures.get(rawKey).getSourceImage() as HTMLImageElement;
            if (!img) { console.warn('Görsel yok:', rawKey); continue; }

            // Manuel frame boyutları
            const fw = parseInt(process.env.NEXT_PUBLIC_SPRITE_W || '320', 10);
            const fh = parseInt(process.env.NEXT_PUBLIC_SPRITE_H || '475', 10);

            const key = `char-${i}`;
            if (this.textures.exists(key)) this.textures.remove(key); // HMR temizliği
            if (this.anims.exists(`${key}-idle-down`)) {
                this.anims.remove(`${key}-idle-down`);
                this.anims.remove(`${key}-walk-down`);
                this.anims.remove(`${key}-idle-left`);
                this.anims.remove(`${key}-walk-left`);
                this.anims.remove(`${key}-idle-right`);
                this.anims.remove(`${key}-walk-right`);
                this.anims.remove(`${key}-idle-up`);
                this.anims.remove(`${key}-walk-up`);
            }

            this.textures.addSpriteSheet(key, img, { frameWidth: fw, frameHeight: fh, margin: 0, spacing: 0 });

            this.cols[key] = 3; // 3 sütun
            this.fw[key] = fw;
            this.fh[key] = fh;

            console.log(`${key} → img=${img.width}x${img.height}  frame=${fw}x${fh}`);
        }

        // --- Animasyonlar
        this.createCharacterAnimations();

        // --- Veri çek + spawn
        this.loadCharacters();

        // --- Kamera (tam ekran, zoom yok)
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2);

        // pan (sağ tık ile hareket)
        let dragging = false, sx = 0, sy = 0, cx = 0, cy = 0;
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
            if (p.rightButtonDown()) { dragging = true; sx = p.x; sy = p.y; cx = this.cameras.main.scrollX; cy = this.cameras.main.scrollY; }
        });
        this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!dragging || !p.rightButtonDown()) return;
            const cam = this.cameras.main;
            cam.scrollX = cx - (p.x - sx);
            cam.scrollY = cy - (p.y - sy);
        });
        this.input.on('pointerup', () => dragging = false);

        this.cursors = this.input.keyboard?.createCursorKeys();
    }

    private createCharacterAnimations() {
        const make = (key: string) => {
            const cols = this.cols[key] || this.SPRITE_COLS; // 3
            const row = (r: number) => [r * cols + 0, r * cols + 1, r * cols + 2]; // 4. sütunu kullanma

            this.anims.create({ key: `${key}-idle-down`,  frames: [{ key, frame: row(0)[1] }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: `${key}-walk-down`,  frames: this.anims.generateFrameNumbers(key, { frames: row(0) }), frameRate: 8, repeat: -1 });

            this.anims.create({ key: `${key}-idle-left`,  frames: [{ key, frame: row(1)[1] }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: `${key}-walk-left`,  frames: this.anims.generateFrameNumbers(key, { frames: row(1) }), frameRate: 8, repeat: -1 });

            this.anims.create({ key: `${key}-idle-right`, frames: [{ key, frame: row(2)[1] }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: `${key}-walk-right`, frames: this.anims.generateFrameNumbers(key, { frames: row(2) }), frameRate: 8, repeat: -1 });

            this.anims.create({ key: `${key}-idle-up`,    frames: [{ key, frame: row(3)[1] }], frameRate: 1, repeat: -1 });
            this.anims.create({ key: `${key}-walk-up`,    frames: this.anims.generateFrameNumbers(key, { frames: row(3) }), frameRate: 8, repeat: -1 });
        };

        for (let i = 1; i <= this.CHAR_COUNT; i++) {
            const key = `char-${i}`;
            if (this.textures.exists(key)) {
                make(key);
                console.log(`Created animations for ${key}`);
            }
        }
    }

    private async loadCharacters() {
        try {
            const tokenMint = process.env.NEXT_PUBLIC_TOKEN_MINT;
            const minHold = process.env.NEXT_PUBLIC_MIN_HOLD || '10000';
            const url = `/api/world?mint=${tokenMint}&min=${minHold}&charCount=${this.CHAR_COUNT}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Failed to fetch world data');
            const world: WorldResponse = await res.json();
            if (world.characters?.length) this.spawnCharacters(world.characters);
            else console.warn('No characters to spawn');
        } catch (e) {
            console.error(e);
        }
    }

    private spawnCharacters(chars: Array<{ owner: string; charId: number; balance: number }>) {
        const spawnPoints = this.getSpawnPoints();

        // Test wallet'ı öncelik ver
        const testWallet = 'J311MsgsfcChafguWmahyxdzHvYchMcWM8vVoc4bqGWe';
        const testChar = chars.find(c => c.owner === testWallet);
        const otherChars = chars.filter(c => c.owner !== testWallet);

        // Test wallet'ı başa al
        const sortedChars = testChar ? [testChar, ...otherChars] : chars;

        // İstersen ENV ile sınırla
        const MAX_SPAWN = parseInt(process.env.NEXT_PUBLIC_MAX_SPAWN || '50', 10);
        const list = sortedChars.slice(0, MAX_SPAWN);

        console.log(`🎯 Spawning ${list.length} characters, test wallet priority: ${testChar ? '✅' : '❌'}`);
        if (testChar) {
            console.log(`🎮 Test wallet will spawn as character: ${testChar.charId}`);
        }

        list.forEach((c, i) => {
            console.log(`👤 Character ${i + 1}: ${c.owner.slice(0, 8)}...${c.owner.slice(-4)} (charId: ${c.charId}, balance: ${c.balance})`);
            
            const key = `char-${c.charId}`;
            if (!this.textures.exists(key)) {
                console.warn(`❌ Texture not found for: ${key}`);
                return;
            }

            const p = this.getValidSpawnPoint(spawnPoints, i);
            const s = this.physics.add.sprite(p.x, p.y, key, 1);

            // Basit çözüm: sprite'ı yukarı kaydır
            const frameHeight = this.fh[key] || 384;
            const scale = this.SPRITE_SCALE;
            const displayHeight = frameHeight * scale;
            
            // Sprite'ı yukarı kaydır ki bacakları görünsün
            s.y = p.y - displayHeight + 60; // Daha çok yukarı, bacakları tam göster

            // Merkezi hizala, alt anchor
            s.setOrigin(0.5, 1);
            s.setScale(this.SPRITE_SCALE);
            s.setDepth(s.y);
            s.setCollideWorldBounds(true);

            // Body: sadece ayaklar (scale’e göre)
            const FW = this.fw[key] || 256;
            const FH = this.fh[key] || 384;
            const dispW = FW * this.SPRITE_SCALE;
            const dispH = FH * this.SPRITE_SCALE;
            const bodyW = dispW * 0.35;
            const bodyH = dispH * 0.22;
            s.body.setSize(bodyW, bodyH, false);
            s.body.setOffset((dispW - bodyW) * 0.5, dispH - bodyH);

            // Idle
            const idleKey = `${key}-idle-down`;
            if (this.anims.exists(idleKey)) {
                s.play(idleKey);
            } else {
                s.setFrame(1);
            }

            this.physics.add.collider(s, this.wallsLayer);
            this.characters.push(s);
            
            // Karakteri wallet ile eşleştir
            this.characterMap.set(c.owner, s);
            
            // Wallet adresini karakterin üstünde göster
            this.createWalletLabel(c.owner, s);
            
            // Random hareket başlat
            this.addRandomMovement(s, key);

            // DEBUG: doğru kesildi mi?
            const fr = s.frame;
            console.log(`${key} frame cut=${fr.cutWidth}x${fr.cutHeight} display=${s.displayWidth.toFixed(1)}x${s.displayHeight.toFixed(1)}`);
        });

        this.cameras.main.centerOn(this.map.widthInPixels / 2, this.map.heightInPixels / 2);
    }

    private getSpawnPoints(): SpawnPoint[] {
        const pts: SpawnPoint[] = [];
        const layer = this.map.getObjectLayer('Spawns');
        if (layer) {
            layer.objects.forEach(o => {
                if (o.x != null && o.y != null) pts.push({ x: o.x, y: o.y });
            });
        }
        return pts;
    }

    private getValidSpawnPoint(spawnPoints: SpawnPoint[], index: number): SpawnPoint {
        if (spawnPoints.length) return spawnPoints[index % spawnPoints.length];

        const ts = this.map.tileWidth;
        for (let i = 0; i < 200; i++) {
            const tx = Phaser.Math.Between(1, this.map.width - 2);
            const ty = Phaser.Math.Between(1, this.map.height - 2);
            const t = this.groundLayer.getTileAt(tx, ty);
            if (t && t.collides !== true) {
                return { x: tx * ts + ts / 2, y: ty * ts + ts / 2 };
            }
        }
        return { x: this.map.widthInPixels / 2, y: this.map.heightInPixels / 2 };
    }

    private addRandomMovement(sprite: Phaser.Physics.Arcade.Sprite, charKey: string) {
        const moveCharacter = () => {
            // Sprite hâlâ aktif mi kontrol et
            if (!sprite || !sprite.active || sprite.scene !== this) {
                return; // Sprite destroy olmuş, dur
            }
            
            // Random yön seç (0=down, 1=left, 2=right, 3=up)
            const direction = Phaser.Math.Between(0, 3);
            const distance = Phaser.Math.Between(32, 96); // 1-3 tile
            
            let targetX = sprite.x;
            let targetY = sprite.y;
            let walkAnim = '';
            let idleAnim = '';
            
            switch (direction) {
                case 0: // down
                    targetY += distance;
                    walkAnim = `${charKey}-walk-down`;
                    idleAnim = `${charKey}-idle-down`;
                    break;
                case 1: // left
                    targetX -= distance;
                    walkAnim = `${charKey}-walk-left`;
                    idleAnim = `${charKey}-idle-left`;
                    break;
                case 2: // right
                    targetX += distance;
                    walkAnim = `${charKey}-walk-right`;
                    idleAnim = `${charKey}-idle-right`;
                    break;
                case 3: // up
                    targetY -= distance;
                    walkAnim = `${charKey}-walk-up`;
                    idleAnim = `${charKey}-idle-up`;
                    break;
            }
            
            // Hedef pozisyon sınırlar içinde mi kontrol et
            const mapBounds = {
                left: 32,
                right: this.map.widthInPixels - 32,
                top: 32,
                bottom: this.map.heightInPixels - 32
            };
            
            if (targetX < mapBounds.left || targetX > mapBounds.right ||
                targetY < mapBounds.top || targetY > mapBounds.bottom) {
                // Sınır dışı, tekrar dene
                const delay = Phaser.Math.Between(1000, 3000);
                this.time.delayedCall(delay, moveCharacter);
                return;
            }
            
            // Hedef tile walkable mı kontrol et
            const tileX = Math.floor(targetX / this.map.tileWidth);
            const tileY = Math.floor(targetY / this.map.tileHeight);
            const targetTile = this.groundLayer.getTileAt(tileX, tileY);
            
            if (targetTile && targetTile.collides !== true) {
                // Yürüme animasyonu başlat
                try {
                    if (this.anims.exists(walkAnim)) {
                        sprite.play(walkAnim);
                    }
                } catch (e) {
                    console.warn('Animation error:', walkAnim, e);
                }
                
                // Hareket et
                this.tweens.add({
                    targets: sprite,
                    x: targetX,
                    y: targetY,
                    duration: Phaser.Math.Between(1500, 2500),
                    ease: 'Power2',
                    onComplete: () => {
                        // Sprite hâlâ aktif mi kontrol et
                        if (!sprite || !sprite.active) return;
                        
                        try {
                            // Idle animasyona geç
                            if (this.anims.exists(idleAnim)) {
                                sprite.play(idleAnim);
                            }
                            sprite.setDepth(sprite.y);
                        } catch (e) {
                            console.warn('Animation error:', idleAnim, e);
                        }
                    }
                });
            }
            
            // Sonraki hareketi planla
            const nextMoveDelay = Phaser.Math.Between(2000, 5000);
            this.time.delayedCall(nextMoveDelay, moveCharacter);
        };
        
        // İlk hareketi başlat
        const initialDelay = Phaser.Math.Between(1000, 3000);
        this.time.delayedCall(initialDelay, moveCharacter);
    }

    private createWalletLabel(walletAddress: string, sprite: Phaser.Physics.Arcade.Sprite) {
        // Wallet adresini kısalt (ilk 4 + son 4 karakter)
        const shortAddress = walletAddress.slice(0, 4) + '...' + walletAddress.slice(-4);
        
        // Label oluştur
        const label = this.add.text(sprite.x, sprite.y - 90, shortAddress, {
            fontSize: '12px',
            color: '#ffff00', // Sarı renk
            backgroundColor: '#00000080',
            padding: { x: 4, y: 2 },
            borderRadius: 6,
        });

        label.setOrigin(0.5, 1);
        label.setDepth(9000); // Mesajların altında
        
        // Tıklanabilir yap
        label.setInteractive({ useHandCursor: true });
        label.on('pointerdown', () => {
            const solscanUrl = `https://solscan.io/account/${walletAddress}`;
            window.open(solscanUrl, '_blank');
            console.log(`Opening Solscan for: ${walletAddress}`);
        });

        // Hover efekti
        label.on('pointerover', () => {
            label.setStyle({ backgroundColor: '#ffff0040' });
        });
        label.on('pointerout', () => {
            label.setStyle({ backgroundColor: '#00000080' });
        });

        this.walletLabels.set(walletAddress, label);
        console.log(`✅ Created wallet label for: ${shortAddress}`);
    }

    public showUserMessage(walletAddress: string, message: string) {
        console.log(`🔍 Looking for wallet: ${walletAddress}`);
        console.log(`🗺️ Available wallets in map:`, Array.from(this.characterMap.keys()));
        
        const sprite = this.characterMap.get(walletAddress);
        if (!sprite) {
            console.warn('❌ Character not found for wallet:', walletAddress);
            console.log('Available characters:', this.characterMap);
            return;
        }

        console.log(`✅ Found sprite for wallet: ${walletAddress} at position (${sprite.x}, ${sprite.y})`);

        // Önceki mesajı temizle
        const existingTextIndex = this.messageTexts.findIndex(t => t.walletAddress === walletAddress);
        if (existingTextIndex >= 0) {
            console.log('🗑️ Removing existing message');
            this.messageTexts[existingTextIndex].destroy();
            this.messageTexts.splice(existingTextIndex, 1);
        }

        // Yeni mesaj oluştur
        const messageText = this.add.text(sprite.x, sprite.y - 70, message, {
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#000000aa',
            padding: { x: 8, y: 6 },
            borderRadius: 12,
            wordWrap: { width: 250, useAdvancedWrap: true }
        });

        messageText.setOrigin(0.5, 1);
        messageText.setDepth(10000); // En üstte göster
        messageText.walletAddress = walletAddress; // Wallet referansı ekle

        this.messageTexts.push(messageText);

        console.log(`💬 Message created at (${messageText.x}, ${messageText.y}): "${message}"`);

        // 5 saniye sonra mesajı sil
        this.time.delayedCall(5000, () => {
            const textIndex = this.messageTexts.findIndex(t => t === messageText);
            if (textIndex >= 0) {
                messageText.destroy();
                this.messageTexts.splice(textIndex, 1);
                console.log('🗑️ Message expired and removed');
            }
        });

        console.log(`✅ Message displayed for ${walletAddress}: "${message}"`);
    }

    update() {
        // Mesajları karakterin pozisyonuna göre güncelle
        this.messageTexts.forEach(messageText => {
            const walletAddress = messageText.walletAddress;
            if (!walletAddress) return;
            const sprite = this.characterMap.get(walletAddress);
            if (sprite && messageText.active) {
                messageText.setPosition(sprite.x, sprite.y - 70);
            }
        });

        // Wallet labellarını karakterin pozisyonuna göre güncelle
        this.walletLabels.forEach((label, walletAddress) => {
            const sprite = this.characterMap.get(walletAddress);
            if (sprite && label.active) {
                label.setPosition(sprite.x, sprite.y - 90);
            }
        });

        this.characters.forEach(c => c.setDepth(c.y));
        if (this.cursors) {
            const cam = this.cameras.main, v = 10;
            if (this.cursors.left?.isDown) cam.scrollX -= v;
            if (this.cursors.right?.isDown) cam.scrollX += v;
            if (this.cursors.up?.isDown) cam.scrollY -= v;
            if (this.cursors.down?.isDown) cam.scrollY += v;
        }
    }
}

interface PhaserGameProps {
    onGameReady?: (game: Phaser.Game) => void;
}

export default function PhaserGame({ onGameReady }: PhaserGameProps) {
    const gameRef = useRef<Phaser.Game | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && !gameRef.current) {
            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                width: '100%',
                height: '100%',
                parent: 'phaser-game',
                physics: {
                    default: 'arcade',
                    arcade: { gravity: { y: 0 }, debug: false },
                },
                render: { pixelArt: true, antialias: false, roundPixels: true },
                scale: { 
                    mode: Phaser.Scale.FIT, 
                    autoCenter: Phaser.Scale.CENTER_BOTH,
                    width: '100%',
                    height: '100%'
                },
                scene: GameScene,
            };
            gameRef.current = new Phaser.Game(config);
            
            if (onGameReady) {
                onGameReady(gameRef.current);
            }
        }
        return () => { gameRef.current?.destroy(true); gameRef.current = null; };
    }, [onGameReady]);

    return (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-black">
            <div id="phaser-game" className="w-full h-full flex items-center justify-center" />
        </div>
    );
}
