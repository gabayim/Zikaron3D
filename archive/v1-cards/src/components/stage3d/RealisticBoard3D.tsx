import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { GridGenerator } from '../../engine/GridGenerator';
import { CardNode } from '../../engine/types';
import { useGameStore } from '../../store/useGameStore';
import { SensoryManager } from '../../services/SensoryManager';
import { CapsuleMesh3D } from './CapsuleMesh3D';

interface TabletopStageProps {
  cards: CardNode[];
  biomeId: string;
  onFlipCard: (cardId: string) => void;
}

/**
 * Three.js 3D Tabletop Stage with Warm Studio Lights and Biome Environments
 */
function TabletopStage({ cards, biomeId, onFlipCard }: TabletopStageProps) {
  const biome = GridGenerator.getBiomeConfig(biomeId as any);
  console.log('[TabletopStage] render, cards count:', cards.length);

  // Compute grid boundaries to dynamically center the board
  const { maxRow, maxCol, colSpacing, rowSpacing } = useMemo(() => {
    let mr = 0;
    let mc = 0;
    for (const card of cards) {
      if (card.row > mr) mr = card.row;
      if (card.col > mc) mc = card.col;
    }
    const colsCount = mc + 1;
    // Adapt spacing based on grid dimensions for ideal framing
    const cs = colsCount >= 4 ? 1.35 : 1.48;
    const rs = 1.78;
    return { maxRow: mr, maxCol: mc, colSpacing: cs, rowSpacing: rs };
  }, [cards]);

  const cardPositions = useMemo(() => {
    return cards.map((card) => {
      const x = (card.col - maxCol / 2) * colSpacing;
      const y = (maxRow / 2 - card.row) * rowSpacing - 0.15;
      const z = card.layer === 1 ? 0.22 : 0;
      return { card, position: [x, y, z] as [number, number, number] };
    });
  }, [cards, maxCol, maxRow, colSpacing, rowSpacing]);

  return (
    <>
      {/* ================= LIGHTING ENVIRONMENT ================= */}
      {/* High-visibility Ambient Base */}
      <ambientLight color="#FFFFFF" intensity={1.4} />

      {/* Main Studio Key Light */}
      <directionalLight
        position={[3, 8, 12]}
        intensity={3.0}
        color="#FFFFFF"
      />

      {/* Biome Glow Point Light */}
      <pointLight
        position={[0, 0, 8]}
        intensity={30}
        color={biome.primaryColor}
        decay={1.5}
      />

      {/* Accent Rim Light */}
      <pointLight
        position={[-4, -4, 6]}
        intensity={20}
        color={biome.accentColor}
        decay={1.5}
      />

      {/* ================= 3D REALISTIC TABLETOP PEDESTAL ================= */}
      <group position={[0, -0.15, -0.1]}>
        {/* Main Obsidian Table Surface */}
        <mesh receiveShadow position={[0, 0, -0.15]}>
          <boxGeometry args={[5.2, 8.4, 0.2]} />
          <meshStandardMaterial
            color="#111923"
            metalness={0.3}
            roughness={0.4}
            emissive={biome.primaryColor}
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* Outer Glowing Edge Railing */}
        <mesh position={[0, 0, -0.06]}>
          <boxGeometry args={[5.4, 8.6, 0.04]} />
          <meshStandardMaterial
            color={biome.primaryColor}
            metalness={0.4}
            roughness={0.3}
            emissive={biome.glowColor}
            emissiveIntensity={0.8}
            wireframe={true}
          />
        </mesh>
      </group>

      {/* ================= CARD VAULTS ================= */}
      {cardPositions.map(({ card, position }) => (
        <CapsuleMesh3D
          key={card.id}
          card={card}
          position={position}
          biome={biome}
          onFlip={onFlipCard}
        />
      ))}
    </>
  );
}

export const RealisticBoard3D: React.FC = () => {
  const cards = useGameStore((s) => s.cards);
  const biome = useGameStore((s) => s.biome);
  const flipCard = useGameStore((s) => s.flipCard);

  console.log('[RealisticBoard3D] render, cards count:', cards.length, 'biome:', biome);

  const handleFlip = (cardId: string) => {
    SensoryManager.triggerFlip();
    flipCard(cardId);
  };

  return (
    <View style={styles.container} collapsable={false}>
      <Canvas
        camera={{ position: [0, -0.2, 14.2], fov: 46 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          alpha: true,
        }}
        onCreated={(state) => {
          state.scene.background = new THREE.Color('#FF0088');
        }}
        style={styles.canvas}
      >
        <TabletopStage
          cards={cards}
          biomeId={biome}
          onFlipCard={handleFlip}
        />
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080C',
  },
  canvas: {
    flex: 1,
  },
});
