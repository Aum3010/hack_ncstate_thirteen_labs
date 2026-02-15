import React from 'react'
import { Canvas } from '@react-three/fiber'

function KeyLight() {
  return <directionalLight position={[2, 3, 2]} intensity={0.9} />
}

function AmbientFill() {
  return <ambientLight intensity={0.3} />
}

function PipeProp() {
  return (
    <group position={[-0.2, -0.15, 0]} rotation={[0, 0, Math.PI * 0.08]}>
      <mesh position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
        <meshStandardMaterial color="#3d2914" roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position={[0.12, 0.04, 0]}>
        <cylinderGeometry args={[0.045, 0.05, 0.025, 12]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  )
}

function DataCube() {
  return (
    <mesh position={[0.15, 0, 0]} castShadow>
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial color="#1f1f24" roughness={0.7} metalness={0.1} />
    </mesh>
  )
}

function SceneContent() {
  return (
    <>
      <KeyLight />
      <AmbientFill />
      <PipeProp />
      <DataCube />
    </>
  )
}

export default function DashboardViewport3D() {
  return (
    <div className="dashboard-viewport-3d">
      <Canvas
        camera={{ position: [0, 0, 0.6], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 2]}
      >
        <SceneContent />
      </Canvas>
    </div>
  )
}
