import React, { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, ContactShadows, Environment } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Awwwards-level immersive 3D background.
 * Dramatic scale, real materials, environment lighting, mouse parallax.
 * Inspired by: Renaissance Edition, Tenbin Labs, AVA SRG.
 */

const PALETTE = {
  brass: '#b8860b',
  brassLight: '#d4a836',
  wood: '#3d2914',
  woodDark: '#2a1810',
  leather: '#6b2d3a',
  glass: '#0a0a12',
  metal: '#8a7a6a',
  ember: '#d97706',
}

/* ─── Mouse parallax rig ─── */
function ParallaxRig() {
  const { camera } = useThree()
  const basePos = useRef(new THREE.Vector3(0, 0.5, 7))
  useFrame((state) => {
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, basePos.current.x + state.pointer.x * 0.6, 0.04)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, basePos.current.y + state.pointer.y * 0.35, 0.04)
    camera.lookAt(0, 0, 0)
  })
  return null
}

/* ─── Magnifying Glass (dramatic, large, realistic materials) ─── */
function MagnifyingGlass() {
  return (
    <group>
      {/* Handle -- polished wood */}
      <mesh position={[0, -0.45, 0]} rotation={[0, 0, 0.25]}>
        <cylinderGeometry args={[0.045, 0.06, 0.7, 16]} />
        <meshStandardMaterial
          color={PALETTE.wood}
          roughness={0.55}
          metalness={0.1}
        />
      </mesh>
      {/* Handle ferrule (brass ring connecting handle to frame) */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.06, 16]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      {/* Outer frame -- brass torus */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <torusGeometry args={[0.22, 0.025, 16, 48]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.25}
          metalness={0.8}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* Inner frame ring detail */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
        <torusGeometry args={[0.19, 0.008, 8, 48]} />
        <meshStandardMaterial
          color={PALETTE.brassLight}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>
      {/* Glass lens -- reflective, slightly transparent */}
      <mesh position={[0, 0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.012, 32]} />
        <meshPhysicalMaterial
          color="#111118"
          roughness={0.02}
          metalness={0}
          transmission={0.7}
          thickness={0.5}
          transparent
          opacity={0.65}
          ior={1.5}
          envMapIntensity={2}
        />
      </mesh>
    </group>
  )
}

/* ─── Smoking Pipe (dramatic, detailed) ─── */
function SmokingPipe() {
  return (
    <group rotation={[0, 0, -0.15]}>
      {/* Stem -- long curved */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI * 0.07]}>
        <cylinderGeometry args={[0.02, 0.018, 1.1, 12]} />
        <meshStandardMaterial
          color={PALETTE.wood}
          roughness={0.65}
          metalness={0.08}
        />
      </mesh>
      {/* Mouthpiece */}
      <mesh position={[-0.04, -0.54, 0]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial
          color={PALETTE.woodDark}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>
      {/* Bowl */}
      <mesh position={[0.04, 0.55, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.14, 16]} />
        <meshStandardMaterial
          color={PALETTE.woodDark}
          roughness={0.75}
          metalness={0.05}
        />
      </mesh>
      {/* Bowl rim -- brass accent */}
      <mesh position={[0.04, 0.63, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.012, 8, 24]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.35}
          metalness={0.7}
          envMapIntensity={1.2}
        />
      </mesh>
      {/* Bowl interior (dark void) */}
      <mesh position={[0.04, 0.64, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 16]} />
        <meshStandardMaterial color="#050505" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

/* ─── Pocket Watch (floating accent piece) ─── */
function PocketWatch() {
  return (
    <group>
      {/* Case back */}
      <mesh>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 24]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.3}
          metalness={0.8}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* Face */}
      <mesh position={[0, 0.018, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.005, 24]} />
        <meshStandardMaterial
          color="#f0e8d0"
          roughness={0.8}
          metalness={0}
        />
      </mesh>
      {/* Bezel ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.01, 8, 32]} />
        <meshStandardMaterial
          color={PALETTE.brassLight}
          roughness={0.25}
          metalness={0.85}
          envMapIntensity={1.8}
        />
      </mesh>
      {/* Crown / winding knob */}
      <mesh position={[0, 0.17, 0]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.3}
          metalness={0.8}
        />
      </mesh>
      {/* Chain link suggestion */}
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 6]}>
        <torusGeometry args={[0.03, 0.005, 6, 12]} />
        <meshStandardMaterial
          color={PALETTE.brass}
          roughness={0.35}
          metalness={0.7}
        />
      </mesh>
    </group>
  )
}

/* ─── Old Book (accent) ─── */
function OldBook() {
  return (
    <group>
      {/* Cover */}
      <mesh>
        <boxGeometry args={[0.5, 0.07, 0.7]} />
        <meshStandardMaterial
          color={PALETTE.leather}
          roughness={0.85}
          metalness={0}
        />
      </mesh>
      {/* Pages (lighter inside) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.45, 0.05, 0.65]} />
        <meshStandardMaterial
          color="#d4c8a0"
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      {/* Spine detail */}
      <mesh position={[-0.25, 0, 0]}>
        <boxGeometry args={[0.02, 0.08, 0.72]} />
        <meshStandardMaterial
          color={PALETTE.woodDark}
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>
    </group>
  )
}

/* ─── Scene composition ─── */
function SceneContent() {
  return (
    <>
      {/* Dramatic lighting -- warm key, cool fill */}
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.8}
        color="#ffe4b5"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight
        position={[-3, 2, 4]}
        intensity={0.3}
        color="#6b8cff"
      />
      <ambientLight intensity={0.15} />

      {/* Environment map for realistic reflections on brass/glass */}
      <Environment preset="night" />

      {/* Main hero: Magnifying glass -- large, right of center, floating */}
      <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
        <group position={[1.8, 0.3, 0]} rotation={[0.1, -0.3, -0.15]} scale={2.8}>
          <MagnifyingGlass />
        </group>
      </Float>

      {/* Pipe -- left of center, tilted */}
      <Float speed={1.1} rotationIntensity={0.2} floatIntensity={0.45}>
        <group position={[-2.2, -0.4, -0.5]} rotation={[0.2, 0.4, 0.6]} scale={2.2}>
          <SmokingPipe />
        </group>
      </Float>

      {/* Pocket watch -- upper left, smaller */}
      <Float speed={1.8} rotationIntensity={0.35} floatIntensity={0.55}>
        <group position={[-1.2, 1.8, -1]} rotation={[0.5, 0.3, 0.1]} scale={2}>
          <PocketWatch />
        </group>
      </Float>

      {/* Old book -- bottom center, angled */}
      <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.3}>
        <group position={[0.5, -1.8, -0.8]} rotation={[-0.2, 0.6, 0.1]} scale={1.6}>
          <OldBook />
        </group>
      </Float>

      {/* Ground shadows for depth */}
      <ContactShadows
        position={[0, -3, 0]}
        opacity={0.4}
        blur={2.5}
        far={8}
        resolution={256}
        color="#0a0a0f"
      />

      {/* Parallax camera rig */}
      <ParallaxRig />
    </>
  )
}

export default function Scene3DEnvironment() {
  return (
    <div className="scene-3d-environment">
      <Canvas
        camera={{ position: [0, 0.5, 7], fov: 45 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
        frameloop="always"
        shadows
      >
        <SceneContent />
      </Canvas>
    </div>
  )
}
