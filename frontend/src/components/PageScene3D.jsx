import React from 'react'
import { Canvas } from '@react-three/fiber'

function KeyLight() {
  return (
    <directionalLight position={[3, 4, 3]} intensity={1} />
  )
}

function AmbientFill() {
  return <ambientLight intensity={0.25} />
}

function PipeProp() {
  return (
    <group position={[-0.3, -0.2, 0]} rotation={[0, 0, Math.PI * 0.1]}>
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.25, 8]} />
        <meshStandardMaterial color="#3d2914" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0.15, 0.05, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.03, 12]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  )
}

function BillsScene() {
  return (
    <group>
      <PipeProp />
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.2 + i * 0.08, -0.15 + i * 0.02, 0.1 + i * 0.02]} rotation={[0, 0, (i - 1) * 0.05]}>
          <boxGeometry args={[0.2, 0.26, 0.02]} />
          <meshStandardMaterial color={i === 0 ? '#2a2520' : i === 1 ? '#252220' : '#1f1f24'} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

function CalendarScene() {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.15, 0.2, 0.02]} />
        <meshStandardMaterial color="#2a2520" roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0.04, 0.06, 0.02]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.03, 0.03, 0.01, 12]} />
        <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.3} />
      </mesh>
      <PipeProp />
    </group>
  )
}

function MoneyScene() {
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.1 + i * 0.12, -0.1, 0]} rotation={[0, 0, (i - 1) * 0.2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
          <meshStandardMaterial color="#d97706" roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      <PipeProp />
    </group>
  )
}

function RiskScene() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshStandardMaterial color="#6b2d3a" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0.2, -0.15, 0]}>
        <boxGeometry args={[0.08, 0.15, 0.02]} />
        <meshStandardMaterial color="#1f1f24" roughness={0.9} metalness={0} />
      </mesh>
      <PipeProp />
    </group>
  )
}

function ProfileScene() {
  return (
    <group>
      <mesh position={[0, 0, 0]} rotation={[0, 0, 0.05]}>
        <boxGeometry args={[0.18, 0.24, 0.02]} />
        <meshStandardMaterial color="#2a2520" roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0.08, 0.08, 0.02]}>
        <cylinderGeometry args={[0.025, 0.025, 0.01, 16]} />
        <meshStandardMaterial color="#d97706" roughness={0.4} metalness={0.3} />
      </mesh>
      <PipeProp />
    </group>
  )
}

function DefaultScene() {
  return (
    <group>
      <mesh position={[0, 0, -0.2]}>
        <boxGeometry args={[0.2, 0.2, 0.15]} />
        <meshStandardMaterial color="#1f1f24" roughness={0.8} metalness={0.1} />
      </mesh>
      <PipeProp />
    </group>
  )
}

const SCENES = {
  bills: BillsScene,
  calendar: CalendarScene,
  money: MoneyScene,
  risk: RiskScene,
  profile: ProfileScene,
  default: DefaultScene,
}

export default function PageScene3D({ theme = 'default', className = '' }) {
  const Scene = SCENES[theme] || SCENES.default
  return (
    <div className={`page-scene-3d ${className}`.trim()}>
      <Canvas
        camera={{ position: [0, 0, 0.8], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <KeyLight />
        <AmbientFill />
        <Scene />
      </Canvas>
    </div>
  )
}
