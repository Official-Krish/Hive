import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Avatar from "./Avatar";

export default function AvatarTest() {
  return (
    <div className="h-screen w-full bg-black">
      <Canvas
        camera={{
          position: [0, 1, 5],
          fov: 45,
          near: 0.01,
          far: 100,
        }}
      >
        <ambientLight intensity={5} />

        <directionalLight position={[5, 10, 5]} intensity={5} />

        <Avatar />

        <gridHelper args={[20, 20]} />

        <axesHelper args={[5]} />

        <OrbitControls target={[0, 0.5, 0]} />
      </Canvas>
    </div>
  );
}
