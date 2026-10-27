import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BiomeConfig, CardNode, CardVisualId } from '../../engine/types';

interface CapsuleMesh3DProps {
  card: CardNode;
  position: [number, number, number];
  biome: BiomeConfig;
  onFlip: (cardId: string) => void;
}

/**
 * Universal 3D geometric symbol rendered in the card's inner chamber.
 * Zero text, letters, or numbers.
 */
function UniversalSymbol3D({ visualId }: { visualId: CardVisualId }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 1.2;
      meshRef.current.rotation.x += delta * 0.4;
    }
  });

  switch (visualId) {
    case 'ruby_gem':
      return (
        <mesh ref={meshRef}>
          <octahedronGeometry args={[0.34, 0]} />
          <meshStandardMaterial
            color="#FF1744"
            roughness={0.1}
            metalness={0.4}
            emissive="#D50000"
            emissiveIntensity={0.6}
          />
        </mesh>
      );
    case 'cosmic_star':
      return (
        <mesh ref={meshRef}>
          <torusKnotGeometry args={[0.22, 0.07, 48, 8, 2, 3]} />
          <meshStandardMaterial
            color="#00E5FF"
            roughness={0.15}
            metalness={0.7}
            emissive="#00B0FF"
            emissiveIntensity={0.7}
          />
        </mesh>
      );
    case 'golden_ring':
      return (
        <mesh ref={meshRef}>
          <torusGeometry args={[0.26, 0.08, 24, 36]} />
          <meshStandardMaterial
            color="#FFD700"
            roughness={0.15}
            metalness={0.95}
            emissive="#FFA000"
            emissiveIntensity={0.5}
          />
        </mesh>
      );
    case 'crystal_prism':
      return (
        <mesh ref={meshRef}>
          <cylinderGeometry args={[0.12, 0.3, 0.55, 6]} />
          <meshStandardMaterial
            color="#E040FB"
            roughness={0.1}
            metalness={0.3}
            emissive="#AA00FF"
            emissiveIntensity={0.6}
          />
        </mesh>
      );
    case 'sacred_flame':
      return (
        <mesh ref={meshRef}>
          <coneGeometry args={[0.28, 0.55, 16]} />
          <meshStandardMaterial
            color="#FF6D00"
            roughness={0.2}
            metalness={0.2}
            emissive="#FF3D00"
            emissiveIntensity={0.8}
          />
        </mesh>
      );
    case 'water_drop':
      return (
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.3, 24, 24]} />
          <meshStandardMaterial
            color="#2979FF"
            roughness={0.05}
            metalness={0.2}
            emissive="#0091EA"
            emissiveIntensity={0.5}
          />
        </mesh>
      );
    case 'emerald_leaf':
      return (
        <mesh ref={meshRef}>
          <dodecahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial
            color="#00E676"
            roughness={0.2}
            metalness={0.5}
            emissive="#00C853"
            emissiveIntensity={0.6}
          />
        </mesh>
      );
    case 'lightning_orb':
      return (
        <mesh ref={meshRef}>
          <icosahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial
            color="#FFEA00"
            roughness={0.1}
            metalness={0.6}
            emissive="#FFD600"
            emissiveIntensity={0.9}
          />
        </mesh>
      );
    case 'mystic_moon':
      return (
        <mesh ref={meshRef}>
          <torusGeometry args={[0.26, 0.09, 16, 24, Math.PI * 1.5]} />
          <meshStandardMaterial
            color="#B388FF"
            roughness={0.2}
            metalness={0.7}
            emissive="#7C4DFF"
            emissiveIntensity={0.6}
          />
        </mesh>
      );
    case 'solar_sun':
      return (
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.26, 18, 18]} />
          <meshStandardMaterial
            color="#FF9100"
            roughness={0.2}
            metalness={0.8}
            emissive="#FF6D00"
            emissiveIntensity={0.7}
          />
        </mesh>
      );
    case 'ancient_shield':
      return (
        <mesh ref={meshRef}>
          <boxGeometry args={[0.42, 0.52, 0.16]} />
          <meshStandardMaterial
            color="#C5A059"
            roughness={0.3}
            metalness={0.92}
            emissive="#8D6E63"
            emissiveIntensity={0.4}
          />
        </mesh>
      );
    case 'celestial_compass':
    default:
      return (
        <mesh ref={meshRef}>
          <octahedronGeometry args={[0.32, 1]} />
          <meshStandardMaterial
            color="#18FFFF"
            roughness={0.15}
            metalness={0.8}
            emissive="#00B8D4"
            emissiveIntensity={0.7}
          />
        </mesh>
      );
  }
}

export const CapsuleMesh3D: React.FC<CapsuleMesh3DProps> = ({
  card,
  position,
  biome,
  onFlip,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  // Target physics values
  const targetRotY = card.isFlipped || card.isMatched ? Math.PI : 0;
  const baseLiftZ = card.layer === 1 ? 0.22 : 0;
  const activeLift = card.isFlipped && !card.isMatched ? 0.35 : 0;
  const targetZ = position[2] + baseLiftZ + activeLift;

  // Spring animation loop running at 60fps
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Critically damped spring physics for Rotation Y
    const currentRotY = groupRef.current.rotation.y;
    groupRef.current.rotation.y += (targetRotY - currentRotY) * Math.min(1, delta * 14);

    // Spring physics for Z-elevation lift
    const currentZ = groupRef.current.position.z;
    groupRef.current.position.z += (targetZ - currentZ) * Math.min(1, delta * 12);

    // Idle hover pulse for matched cards
    if (card.isMatched) {
      groupRef.current.position.z =
        targetZ + Math.sin(state.clock.elapsedTime * 3 + position[0]) * 0.04;
    }

    // TOYBOX gentle wiggle hint
    if (card.wiggling && !card.isFlipped && !card.isMatched) {
      groupRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 14) * 0.07;
    } else {
      groupRef.current.rotation.z *= 0.85; // damp to 0
    }
  });

  const handlePointerDown = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!card.isBlocked && !card.isMatched && !card.isFlipped) {
      onFlip(card.id);
    }
  };

  const cardWidth = 1.15;
  const cardHeight = 1.55;
  const cardDepth = 0.12;

  // Visual appearance when blocked in 2-layer excavation
  const isBlocked = card.isBlocked && !card.isMatched;

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2] + baseLiftZ]}
      onPointerDown={handlePointerDown}
    >
      {/* ================= CARD CASING (Beveled Metallic Vault) ================= */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[cardWidth, cardHeight, cardDepth]} />
        <meshStandardMaterial
          color={isBlocked ? '#2E3842' : '#253342'}
          metalness={isBlocked ? 0.3 : 0.55}
          roughness={isBlocked ? 0.7 : 0.35}
          transparent={isBlocked}
          opacity={isBlocked ? 0.65 : 1.0}
        />
      </mesh>

      {/* ================= BACK FACE (Outer Metallic Chamber with Biome Glow) ================= */}
      <group position={[0, 0, cardDepth / 2 + 0.005]}>
        {/* Outer Bevel Frame */}
        <mesh>
          <boxGeometry args={[cardWidth * 0.92, cardHeight * 0.92, 0.02]} />
          <meshStandardMaterial
            color={biome.primaryColor}
            metalness={0.6}
            roughness={0.3}
            emissive={biome.glowColor}
            emissiveIntensity={isBlocked ? 0.2 : 0.65}
          />
        </mesh>

        {/* Central Core Emblem / Lock */}
        <mesh position={[0, 0, 0.012]}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
          <meshStandardMaterial
            color={isBlocked ? '#455A64' : '#141E28'}
            metalness={0.7}
            roughness={0.25}
            emissive={isBlocked ? '#37474F' : biome.accentColor}
            emissiveIntensity={isBlocked ? 0.2 : 0.8}
          />
        </mesh>
      </group>

      {/* ================= FRONT FACE (Revealed 180° Interior Chamber) ================= */}
      <group position={[0, 0, -cardDepth / 2 - 0.005]} rotation={[0, Math.PI, 0]}>
        {/* Recessed Interior Chamber Backing */}
        <mesh receiveShadow>
          <boxGeometry args={[cardWidth * 0.88, cardHeight * 0.88, 0.02]} />
          <meshStandardMaterial
            color="#080C10"
            metalness={0.95}
            roughness={0.15}
            emissive={biome.primaryColor}
            emissiveIntensity={0.18}
          />
        </mesh>

        {/* Inner Glowing Bezel Rim */}
        <mesh position={[0, 0, 0.008]}>
          <boxGeometry args={[cardWidth * 0.84, cardHeight * 0.84, 0.01]} />
          <meshStandardMaterial
            color={biome.accentColor}
            metalness={0.8}
            roughness={0.2}
            emissive={biome.glowColor}
            emissiveIntensity={0.35}
            wireframe={false}
          />
        </mesh>

        {/* Universal 3D Object Mesh floating in front chamber */}
        <group position={[0, 0, 0.14]}>
          <UniversalSymbol3D visualId={card.visualId} />
        </group>
      </group>
    </group>
  );
};
