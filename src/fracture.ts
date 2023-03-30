import { makeFragmentFromVertices, makeIndependentPhysicsObject } from './helper.js';

abstract class Transform {
  protected scene: BABYLON.Scene;
  protected device: GPUDevice;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    this.device = (scene.getEngine() as any)._device;
  }

  abstract transform(original: BABYLON.Mesh): Promise<void>;
}

export class TestTransform extends Transform{
  constructor(scene: BABYLON.Scene) {
    super(scene);
  }

  async transform(original: BABYLON.Mesh) {
    const origPositions = original.getVerticesData(BABYLON.VertexBuffer.PositionKind)!;

    let idx = 0;
    const half = Math.floor(origPositions.length / 2);
    for (let start = 0; start < origPositions.length; start += half) {
      const positions = origPositions.slice(start, start + half);
      const name = `${original.name}.${idx++}`;
      const mesh = makeFragmentFromVertices(this.scene, name, positions);
      mesh.position.y += 3;
    }

    original.dispose();
  }
}
