import React, { useRef, useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Award, ChevronLeft, ChevronRight, Check, Shield } from 'lucide-react-native';
import { BiomeTrophy, TrophyModelType, TrophyTier } from '../../engine/types';
import { gameStorage } from '../../store/storage';
import { SensoryManager } from '../../services/SensoryManager';

const STORAGE_EQUIPPED_TROPHIES = 'zikaron3d_equipped_trophies';

// Default Catalog of Biome Figurines
export const BIOME_TROPHY_CATALOG: BiomeTrophy[] = [
  {
    id: 'trophy_crystal_1',
    name: 'Amethyst Spire',
    biome: 'CRYSTAL_CAVERN',
    tier: 'GOLD',
    unlocked: true,
    equippedSlot: 1,
    modelType: 'crystal_monolith',
    glowColor: '#E040FB',
    achievementDescription: 'Clear Crystal Cavern with 100% accuracy',
  },
  {
    id: 'trophy_cyber_1',
    name: 'Quantum Gyroscope',
    biome: 'NEON_CYBER',
    tier: 'OBSIDIAN',
    unlocked: true,
    equippedSlot: 2,
    modelType: 'cyber_quantum',
    glowColor: '#00E5FF',
    achievementDescription: 'Reach an 8x Fever Combo in Neon Cyber',
  },
  {
    id: 'trophy_gold_1',
    name: 'Solar Scarab',
    biome: 'ANCIENT_GOLD',
    tier: 'GOLD',
    unlocked: true,
    equippedSlot: 3,
    modelType: 'ancient_scarab',
    glowColor: '#FFD700',
    achievementDescription: 'Excavate 50 Golden Vaults',
  },
  {
    id: 'trophy_volcanic_1',
    name: 'Magma Monolith',
    biome: 'VOLCANIC_CORE',
    tier: 'SILVER',
    unlocked: true,
    modelType: 'volcanic_totem',
    glowColor: '#FF3D00',
    achievementDescription: 'Survive Volcanic Core with 1 flip remaining',
  },
  {
    id: 'trophy_zen_1',
    name: 'Jade Blossom',
    biome: 'ZEN_GARDEN',
    tier: 'BRONZE',
    unlocked: true,
    modelType: 'zen_lotus',
    glowColor: '#00E676',
    achievementDescription: 'Complete 10 Zen Garden untimed meditations',
  },
];

/**
 * 3D Model Mesh for each Biome Figurine
 */
const FigurineMesh: React.FC<{
  modelType: TrophyModelType;
  glowColor: string;
  tier: TrophyTier;
  scale?: number;
}> = ({ modelType, glowColor, tier, scale = 1.0 }) => {
  const meshGroupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshGroupRef.current) {
      meshGroupRef.current.rotation.y += delta * 0.9;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x += delta * 1.4;
      ringRef.current.rotation.z += delta * 0.8;
    }
  });

  const tierMetalness = tier === 'OBSIDIAN' ? 0.95 : tier === 'GOLD' ? 0.9 : 0.7;
  const tierRoughness = tier === 'OBSIDIAN' ? 0.1 : 0.25;

  return (
    <group ref={meshGroupRef} scale={[scale, scale, scale]}>
      {/* Pedestal Base */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.55, 0.65, 0.18, 32]} />
        <meshStandardMaterial
          color="#121824"
          metalness={0.9}
          roughness={0.2}
          emissive="#0A0E17"
        />
      </mesh>

      {/* Pedestal Metallic Inset Ring */}
      <mesh position={[0, -0.54, 0]}>
        <cylinderGeometry args={[0.48, 0.48, 0.04, 32]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={0.65}
          metalness={0.8}
        />
      </mesh>

      {/* Unique Geometric Figurine */}
      {modelType === 'crystal_monolith' && (
        <group position={[0, 0, 0]}>
          <mesh>
            <octahedronGeometry args={[0.48, 0]} />
            <meshStandardMaterial
              color="#E040FB"
              emissive={glowColor}
              emissiveIntensity={0.7}
              metalness={tierMetalness}
              roughness={tierRoughness}
            />
          </mesh>
          <mesh scale={[0.3, 0.75, 0.3]}>
            <cylinderGeometry args={[0.1, 0.25, 1.1, 6]} />
            <meshStandardMaterial
              color="#FFFFFF"
              emissive="#D500F9"
              emissiveIntensity={0.4}
              transparent
              opacity={0.75}
            />
          </mesh>
        </group>
      )}

      {modelType === 'volcanic_totem' && (
        <group position={[0, -0.1, 0]}>
          <mesh position={[0, 0.1, 0]}>
            <boxGeometry args={[0.45, 0.65, 0.45]} />
            <meshStandardMaterial
              color="#1C1310"
              metalness={0.6}
              roughness={0.8}
              emissive="#FF3D00"
              emissiveIntensity={0.4}
            />
          </mesh>
          <mesh position={[0, 0.52, 0]}>
            <coneGeometry args={[0.26, 0.38, 16]} />
            <meshStandardMaterial
              color="#FF5722"
              emissive={glowColor}
              emissiveIntensity={0.9}
              roughness={0.2}
            />
          </mesh>
        </group>
      )}

      {modelType === 'cyber_quantum' && (
        <group position={[0, 0.05, 0]}>
          <mesh ref={ringRef}>
            <torusGeometry args={[0.42, 0.06, 16, 32]} />
            <meshStandardMaterial
              color="#00E5FF"
              emissive={glowColor}
              emissiveIntensity={0.8}
              metalness={0.95}
              roughness={0.1}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.2, 24, 24]} />
            <meshStandardMaterial
              color="#18FFFF"
              emissive="#00B0FF"
              emissiveIntensity={0.6}
              metalness={0.9}
            />
          </mesh>
        </group>
      )}

      {modelType === 'ancient_scarab' && (
        <group position={[0, 0, 0]}>
          <mesh>
            <dodecahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial
              color="#FFD700"
              metalness={0.95}
              roughness={0.15}
              emissive="#FFA000"
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0, 0.45, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color="#FFE082"
              emissive={glowColor}
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      )}

      {modelType === 'zen_lotus' && (
        <group position={[0, -0.05, 0]}>
          <mesh>
            <torusGeometry args={[0.36, 0.12, 16, 24, Math.PI * 1.8]} />
            <meshStandardMaterial
              color="#00E676"
              metalness={0.7}
              roughness={0.3}
              emissive={glowColor}
              emissiveIntensity={0.6}
            />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
            <meshStandardMaterial
              color="#B9F6CA"
              emissive="#00C853"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}
    </group>
  );
};

export interface TrophyShelf3DProps {
  mode?: 'showcase' | 'race_banner';
  opponentTrophies?: string[];
  onEquipChange?: (equippedIds: string[]) => void;
}

export const TrophyShelf3D: React.FC<TrophyShelf3DProps> = ({
  mode = 'showcase',
  opponentTrophies = ['trophy_volcanic_1', 'trophy_cyber_1', 'trophy_crystal_1'],
  onEquipChange,
}) => {
  const [trophies, setTrophies] = useState<BiomeTrophy[]>(() => {
    const saved = gameStorage.getString(STORAGE_EQUIPPED_TROPHIES);
    if (saved) {
      try {
        const equippedIds: string[] = JSON.parse(saved);
        return BIOME_TROPHY_CATALOG.map((t) => ({
          ...t,
          equippedSlot: (equippedIds.indexOf(t.id) !== -1
            ? ((equippedIds.indexOf(t.id) + 1) as 1 | 2 | 3)
            : undefined),
        }));
      } catch {}
    }
    return BIOME_TROPHY_CATALOG;
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Top 3 equipped trophies
  const playerTop3 = useMemo(() => {
    return trophies
      .filter((t) => t.equippedSlot !== undefined)
      .sort((a, b) => (a.equippedSlot || 0) - (b.equippedSlot || 0))
      .slice(0, 3);
  }, [trophies]);

  const opponentTop3 = useMemo(() => {
    return opponentTrophies
      .map((id) => BIOME_TROPHY_CATALOG.find((t) => t.id === id))
      .filter(Boolean) as BiomeTrophy[];
  }, [opponentTrophies]);

  const selectedTrophy = trophies[selectedIndex];

  const handleToggleEquip = (trophyId: string) => {
    SensoryManager.triggerFlip();
    const currentEquipped = trophies.filter((t) => t.equippedSlot !== undefined);
    const target = trophies.find((t) => t.id === trophyId);
    if (!target) return;

    let updated: BiomeTrophy[];

    if (target.equippedSlot) {
      // Unequip
      updated = trophies.map((t) =>
        t.id === trophyId ? { ...t, equippedSlot: undefined } : t
      );
    } else {
      // Equip into first available slot 1, 2, or 3
      const takenSlots = currentEquipped.map((t) => t.equippedSlot);
      let freeSlot: 1 | 2 | 3 = 1;
      if (!takenSlots.includes(1)) freeSlot = 1;
      else if (!takenSlots.includes(2)) freeSlot = 2;
      else if (!takenSlots.includes(3)) freeSlot = 3;
      else freeSlot = 3; // Replace slot 3 if all filled

      updated = trophies.map((t) => {
        if (t.id === trophyId) return { ...t, equippedSlot: freeSlot };
        if (t.equippedSlot === freeSlot) return { ...t, equippedSlot: undefined };
        return t;
      });
    }

    setTrophies(updated);
    const newEquippedIds = updated
      .filter((t) => t.equippedSlot !== undefined)
      .map((t) => t.id);

    gameStorage.setString(STORAGE_EQUIPPED_TROPHIES, JSON.stringify(newEquippedIds));
    if (onEquipChange) onEquipChange(newEquippedIds);
  };

  // =========================================================================
  // MODE: RACE BANNER (Rendered at top of 1v1 Ghost Race view)
  // =========================================================================
  if (mode === 'race_banner') {
    return (
      <View style={styles.bannerContainer}>
        {/* Player Top 3 Showcase */}
        <View style={styles.bannerSide}>
          <Text style={styles.bannerPlayerLabel}>YOU</Text>
          <View style={styles.trophyMiniRow}>
            {playerTop3.map((trophy, i) => (
              <View key={trophy.id || i} style={styles.miniTrophyCell}>
                <Canvas style={styles.miniCanvas}>
                  <ambientLight intensity={0.8} />
                  <pointLight position={[2, 3, 2]} intensity={2.0} color={trophy.glowColor} />
                  <FigurineMesh
                    modelType={trophy.modelType}
                    glowColor={trophy.glowColor}
                    tier={trophy.tier}
                    scale={0.85}
                  />
                </Canvas>
              </View>
            ))}
          </View>
        </View>

        {/* VS Emblem Badge */}
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Opponent Ghost Top 3 Showcase */}
        <View style={[styles.bannerSide, styles.bannerSideRight]}>
          <Text style={styles.bannerRivalLabel}>GHOST RIVAL</Text>
          <View style={styles.trophyMiniRow}>
            {opponentTop3.map((trophy, i) => (
              <View key={trophy.id || i} style={styles.miniTrophyCell}>
                <Canvas style={styles.miniCanvas}>
                  <ambientLight intensity={0.8} />
                  <pointLight position={[-2, 3, 2]} intensity={2.0} color={trophy.glowColor} />
                  <FigurineMesh
                    modelType={trophy.modelType}
                    glowColor={trophy.glowColor}
                    tier={trophy.tier}
                    scale={0.85}
                  />
                </Canvas>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // =========================================================================
  // MODE: FULL 3D SHOWCASE & FIGURINE CAROUSEL
  // =========================================================================
  return (
    <View style={styles.showcaseContainer}>
      {/* Header */}
      <View style={styles.showHeaderRow}>
        <View style={styles.headerTitleWrap}>
          <Award size={20} color="#FFD700" />
          <Text style={styles.showcaseTitle}>BIOME FIGURINES</Text>
        </View>
        <Text style={styles.equippedCount}>
          {playerTop3.length}/3 EQUIPPED
        </Text>
      </View>

      {/* 3D Showcase Stage Canvas */}
      <View style={styles.canvasContainer}>
        <Canvas camera={{ position: [0, 0.4, 2.6], fov: 42 }}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[3, 5, 4]} intensity={1.5} />
          <pointLight position={[-3, 2, 2]} intensity={1.2} color={selectedTrophy.glowColor} />
          <pointLight position={[0, -2, 1]} intensity={0.8} color="#00E5FF" />
          <FigurineMesh
            key={selectedTrophy.id}
            modelType={selectedTrophy.modelType}
            glowColor={selectedTrophy.glowColor}
            tier={selectedTrophy.tier}
            scale={1.2}
          />
        </Canvas>

        {/* Carousel Navigation Arrows */}
        <TouchableOpacity
          onPress={() => {
            SensoryManager.triggerFlip();
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : trophies.length - 1));
          }}
          style={[styles.arrowButton, styles.arrowLeft]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            SensoryManager.triggerFlip();
            setSelectedIndex((prev) => (prev < trophies.length - 1 ? prev + 1 : 0));
          }}
          style={[styles.arrowButton, styles.arrowRight]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronRight size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Figurine Info & Equip Controls */}
      <View style={styles.detailsBox}>
        <View style={styles.nameRow}>
          <Text style={styles.figurineName}>{selectedTrophy.name}</Text>
          <View
            style={[
              styles.tierTag,
              {
                borderColor: selectedTrophy.glowColor,
                backgroundColor: 'rgba(255,255,255,0.06)',
              },
            ]}
          >
            <Text style={[styles.tierText, { color: selectedTrophy.glowColor }]}>
              {selectedTrophy.tier}
            </Text>
          </View>
        </View>

        <Text style={styles.descriptionText}>
          {selectedTrophy.achievementDescription}
        </Text>

        {/* Equip Button */}
        <TouchableOpacity
          onPress={() => handleToggleEquip(selectedTrophy.id)}
          activeOpacity={0.8}
          style={[
            styles.equipBtn,
            selectedTrophy.equippedSlot !== undefined && styles.equipBtnActive,
          ]}
        >
          {selectedTrophy.equippedSlot !== undefined ? (
            <>
              <Check size={18} color="#05080E" />
              <Text style={styles.equipBtnTextActive}>
                EQUIPPED (SLOT {selectedTrophy.equippedSlot})
              </Text>
            </>
          ) : (
            <>
              <Shield size={18} color="#FFD700" />
              <Text style={styles.equipBtnText}>EQUIP FOR 1v1 GHOST RACE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Race Banner Mode Styles
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 16, 26, 0.92)',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    marginHorizontal: 16,
    marginTop: 8,
  },
  bannerSide: {
    flex: 1,
  },
  bannerSideRight: {
    alignItems: 'flex-end',
  },
  bannerPlayerLabel: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  bannerRivalLabel: {
    color: '#FF1744',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  trophyMiniRow: {
    flexDirection: 'row',
    gap: 4,
  },
  miniTrophyCell: {
    width: 36,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#070C14',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  miniCanvas: {
    width: '100%',
    height: '100%',
  },
  vsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 6,
  },
  vsText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '900',
  },

  // Showcase Mode Styles
  showcaseContainer: {
    backgroundColor: 'rgba(10, 16, 28, 0.95)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.25)',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  showHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  showcaseTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  equippedCount: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  canvasContainer: {
    height: 190,
    borderRadius: 16,
    backgroundColor: '#070C14',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  detailsBox: {
    marginTop: 14,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  figurineName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  tierTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  descriptionText: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  equipBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    borderWidth: 1.5,
    borderColor: '#FFD700',
  },
  equipBtnActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  equipBtnText: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  equipBtnTextActive: {
    color: '#05080E',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});

export default TrophyShelf3D;
