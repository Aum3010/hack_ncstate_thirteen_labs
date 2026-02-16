import React from 'react'
import { Canvas } from '@react-three/fiber'

function KeyLight() {
  return (
    <directionalLight
      position={[4, 6, 4]}
      intensity={1.1}
      castShadow
      shadow-mapSize-width={512}
      shadow-mapSize-height={512}
      shadow-camera-far={20}
      shadow-camera-left={-5}
      shadow-camera-right={5}
      shadow-camera-top={5}
      shadow-camera-bottom={-5}
    />
  )
}

function AmbientFill() {
  return <ambientLight intensity={0.15} />
}

function Desk() {
  return (
    <group position={[0, -0.4, -1.5]}>
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color="#1f1f24" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}

function Lamp() {
  return (
    <group position={[0.5, 0.1, -1.2]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.5, 12]} />
        <meshStandardMaterial color="#2a2520" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.06, 12]} />
        <meshStandardMaterial color="#d97706" roughness={0.5} metalness={0.2} emissive="#d97706" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function PipeProp() {
  return (
    <group position={[-0.4, -0.35, -1]} rotation={[0, 0, Math.PI * 0.08]}>
      <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
        <meshStandardMaterial color="#3d2914" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0.18, 0.06, 0]}>
        <cylinderGeometry args={[0.05, 0.055, 0.035, 12]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  )
}

function DocumentStack() {
  return (
    <group position={[-0.3, -0.32, -1.1]}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[i * 0.02, i * 0.015, 0]} rotation={[0, 0, (i - 1) * 0.03]} castShadow>
          <boxGeometry args={[0.25, 0.32, 0.015]} />
          <meshStandardMaterial color={i === 0 ? '#2a2520' : i === 1 ? '#252220' : '#1f1f24'} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}

function SceneContent() {
  return (
    <>
      <KeyLight />
      <AmbientFill />
      <Desk />
      <Lamp />
      <PipeProp />
      <DocumentStack />
    </>
  )
}

export default function AuthScene3D() {
  return (
    <div className="auth-scene-3d">
      <Canvas
        camera={{ position: [0, 0, 2.2], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <SceneContent />
      </Canvas>
    </div>
  )
}
