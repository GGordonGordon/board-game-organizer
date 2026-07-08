import type { MeshData } from './geometry'

/** Serialize an indexed triangle mesh (mm units) to binary STL. */
export function meshToStl(mesh: MeshData): Blob {
  const triCount = mesh.indices.length / 3
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const view = new DataView(buffer)
  // 80-byte header left zeroed
  view.setUint32(80, triCount, true)

  const pos = mesh.positions
  let offset = 84
  for (let t = 0; t < triCount; t++) {
    const i0 = mesh.indices[t * 3] * 3
    const i1 = mesh.indices[t * 3 + 1] * 3
    const i2 = mesh.indices[t * 3 + 2] * 3
    const ax = pos[i0], ay = pos[i0 + 1], az = pos[i0 + 2]
    const bx = pos[i1], by = pos[i1 + 1], bz = pos[i1 + 2]
    const cx = pos[i2], cy = pos[i2 + 1], cz = pos[i2 + 2]
    // normal = (b - a) × (c - a), normalized
    const ux = bx - ax, uy = by - ay, uz = bz - az
    const vx = cx - ax, vy = cy - ay, vz = cz - az
    let nx = uy * vz - uz * vy
    let ny = uz * vx - ux * vz
    let nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    if (len > 0) {
      nx /= len
      ny /= len
      nz /= len
    }
    view.setFloat32(offset, nx, true)
    view.setFloat32(offset + 4, ny, true)
    view.setFloat32(offset + 8, nz, true)
    view.setFloat32(offset + 12, ax, true)
    view.setFloat32(offset + 16, ay, true)
    view.setFloat32(offset + 20, az, true)
    view.setFloat32(offset + 24, bx, true)
    view.setFloat32(offset + 28, by, true)
    view.setFloat32(offset + 32, bz, true)
    view.setFloat32(offset + 36, cx, true)
    view.setFloat32(offset + 40, cy, true)
    view.setFloat32(offset + 44, cz, true)
    view.setUint16(offset + 48, 0, true)
    offset += 50
  }
  return new Blob([buffer], { type: 'model/stl' })
}
