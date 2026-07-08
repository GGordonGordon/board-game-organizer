import JSZip from 'jszip'
import type { PrintPart } from './geometry'

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const num = (v: number) => {
  const r = Math.round(v * 1000) / 1000
  return Object.is(r, -0) ? '0' : String(r)
}

/**
 * Bundle print parts into a single 3MF file: millimetre units, one named
 * object per part (e.g. box + lid), so 3D modelling software imports them
 * ready to edit.
 */
export async function partsTo3mf(parts: PrintPart[]): Promise<Blob> {
  let objects = ''
  let items = ''
  let xCursor = 0
  parts.forEach((part, idx) => {
    const id = idx + 1
    const pos = part.mesh.positions
    const tri = part.mesh.indices
    let vertices = ''
    let maxX = 0
    for (let i = 0; i < pos.length; i += 3) {
      vertices += `<vertex x="${num(pos[i])}" y="${num(pos[i + 1])}" z="${num(pos[i + 2])}"/>`
      if (pos[i] > maxX) maxX = pos[i]
    }
    let triangles = ''
    for (let i = 0; i < tri.length; i += 3) {
      triangles += `<triangle v1="${tri[i]}" v2="${tri[i + 1]}" v3="${tri[i + 2]}"/>`
    }
    objects += `<object id="${id}" type="model" name="${escapeXml(part.name)}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`
    // lay parts side by side so they don't import on top of each other
    items += `<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${num(xCursor)} 0 0"/>`
    xCursor += maxX + 10
  })
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <resources>${objects}</resources>
 <build>${items}</build>
</model>`

  const zip = new JSZip()
  zip.file('[Content_Types].xml', CONTENT_TYPES)
  zip.file('_rels/.rels', RELS)
  zip.file('3D/3dmodel.model', model)
  const blob = await zip.generateAsync({ type: 'blob' })
  return new Blob([blob], { type: 'model/3mf' })
}
