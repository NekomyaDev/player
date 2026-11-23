// A tiny VRM 1.0 for the tests, made here so the repository needs no one else's model: a humanoid skeleton (the bones
// VRM requires, plus neck and chest), a box for the head and one for the body, and the expressions the player sets
// (happy, sad, aa, ee, ou, blinkLeft, blinkRight; no morphs behind them), and looking done by expressions. Returns the
// .vrm (GLB) bytes. spec 0 writes it as VRM 0.x, mirrored as those files are (facing -Z, the left arm at -X). unit scales
// every length, as an exporter's unit setting can. A file can be spoiled for the tests of what the player refuses:
// noMesh (a skeleton alone), draco (says it is compressed), outsideImage (a picture by URL), bigImage (a PNG header
// claiming 9000 x 9000 px). blender writes it as VRM Add-on for Blender does: its generator, MToon materials, a texture
// with KHR_texture_transform, emissive strength, a hair chain on spring bones with a collider on the head, a node
// constraint (1.0), the meta it leaves when nothing is filled in ("undefined", empty strings, texture -1), the humanoid's
// extra fields. And what such a file may get wrong: licenseUrl (1.0's own written otherwise), missing (humanoid bones
// left out), spec1 (another VRMC_vrm specVersion), noMeta, circular (a node constraint whose source hangs under it)
export function tinyVrm({ spec = 1, unit = 1, noMesh = false, draco = false, outsideImage = '', bigImage = false, blender = false, licenseUrl = 'https://vrm.dev/licenses/1.0/',
  missing = [], spec1 = '1.0', noMeta = false, circular = false } = {}) {
  const mirror = spec === 0 ? -1 : 1
  // [bone, parent, translation]
  const bones = [
    ['hips', -1, [0, 1, 0]], ['spine', 'hips', [0, 0.12, 0]], ['chest', 'spine', [0, 0.15, 0]], ['neck', 'chest', [0, 0.22, 0]],
    ['head', 'neck', [0, 0.08, 0]],
    ['leftUpperArm', 'chest', [0.18, 0.18, 0]], ['leftLowerArm', 'leftUpperArm', [0.25, 0, 0]], ['leftHand', 'leftLowerArm', [0.22, 0, 0]],
    ['rightUpperArm', 'chest', [-0.18, 0.18, 0]], ['rightLowerArm', 'rightUpperArm', [-0.25, 0, 0]], ['rightHand', 'rightLowerArm', [-0.22, 0, 0]],
    ['leftUpperLeg', 'hips', [0.09, -0.05, 0]], ['leftLowerLeg', 'leftUpperLeg', [0, -0.42, 0]], ['leftFoot', 'leftLowerLeg', [0, -0.42, 0]],
    ['rightUpperLeg', 'hips', [-0.09, -0.05, 0]], ['rightLowerLeg', 'rightUpperLeg', [0, -0.42, 0]], ['rightFoot', 'rightLowerLeg', [0, -0.42, 0]],
  ]
  const index = Object.fromEntries(bones.map(([n], i) => [n, i]))
  const nodes = bones.map(([name, , t]) => ({ name, translation: [t[0] * mirror * unit, t[1] * unit, t[2] * unit], children: [] }))
  bones.forEach(([n, p]) => { if (p !== -1) nodes[index[p]].children.push(index[n]) })
  // the boxes: the head's on the head bone, the body's (scaled) on the chest
  if (!noMesh) {
    nodes.push({ name: 'headBox', mesh: 0, translation: [0, 0.1 * unit, 0], scale: [0.2 * unit, 0.22 * unit, 0.2 * unit] })
    nodes.push({ name: 'bodyBox', mesh: 1, translation: [0, -0.05 * unit, 0], scale: [0.36 * unit, 0.5 * unit, 0.2 * unit] })
    nodes[index.head].children.push(nodes.length - 2)
    nodes[index.chest].children.push(nodes.length - 1)
  }
  // a hair chain under the head (not humanoid bones), for the spring bones
  const hair = []
  if (blender) {
    for (const [i, y] of [[0, 0.12], [1, -0.1], [2, -0.1]]) {
      hair.push(nodes.length)
      nodes.push({ name: `J_Sec_Hair${i + 1}`, translation: [0, y * unit, -0.08 * unit * (i ? 0 : 1)] })
      ;(i ? nodes[hair[i - 1]] : nodes[index.head]).children = [...(i ? nodes[hair[i - 1]].children ?? [] : nodes[index.head].children ?? []), nodes.length - 1]
    }
  }
  // an upper-arm twist helper turning with the lower arm (a node constraint, 1.0)
  let twist = -1
  if (blender) {
    twist = nodes.length
    nodes.push({ name: 'J_Sec_L_UpperArmTwist', translation: [0.12 * mirror * unit, 0, 0] })
    nodes[index.leftUpperArm].children = [...(nodes[index.leftUpperArm].children ?? []), twist]
  }
  for (const n of nodes) if (!n.children?.length) delete n.children
  const mapped = bones.filter(([b]) => !missing.includes(b))

  // a unit box: 8 corners, 12 triangles
  const P = new Float32Array([-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, .5, -.5, -.5, -.5, .5, .5, -.5, .5, .5, .5, .5, -.5, .5, .5])
  const I = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5])
  // a PNG's first bytes, claiming a picture far too big (the player reads the size, never decodes it)
  const pngHead = new Uint8Array(24)
  pngHead.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  new DataView(pngHead.buffer).setUint32(16, 9000); new DataView(pngHead.buffer).setUint32(20, 9000)
  // a real picture for blender's texture: a 1 x 1 white PNG
  const png1 = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0))
  const pic = bigImage ? pngHead : blender ? png1 : null
  const UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1])
  const pad = (4 - (I.byteLength % 4)) % 4
  const uvAt = P.byteLength + I.byteLength + pad, picAt = uvAt + (blender ? UV.byteLength : 0)
  const bin = new Uint8Array(picAt + (pic ? pic.length + ((4 - (pic.length % 4)) % 4) : 0))
  bin.set(new Uint8Array(P.buffer), 0)
  bin.set(new Uint8Array(I.buffer), P.byteLength)
  if (blender) bin.set(new Uint8Array(UV.buffer), uvAt)
  if (pic) bin.set(pic, picAt)
  const prim = (material) => ({ attributes: { POSITION: 0, ...(blender ? { TEXCOORD_0: 2 } : {}) }, indices: 1, material })
  const BLENDER = 'VRM Add-on for Blender v2.20.77'
  const empty = {}
  const range = { inputMaxValue: 90, outputScale: 1 }
  const lookAt = { type: 'expression', rangeMapHorizontalInner: range, rangeMapHorizontalOuter: range, rangeMapVerticalDown: range, rangeMapVerticalUp: range }
  const curve = { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 1 }
  const extra0 = blender ? { useDefaultValues: true, min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, axisLength: 0 } : {}
  const VRM0 = {
    exporterVersion: blender ? BLENDER : 'LivLiv Player tests', specVersion: '0.0',
    ...(noMeta ? {} : { meta: blender
      ? { title: 'undefined', version: '', author: '', contactInformation: '', reference: '', texture: -1, allowedUserName: 'OnlyAuthor', violentUssageName: 'Disallow', sexualUssageName: 'Disallow', commercialUssageName: 'Disallow', otherPermissionUrl: '', licenseName: 'Redistribution_Prohibited', otherLicenseUrl: '' }
      : { title: 'Tiny 0', author: 'LivLiv Player tests', allowedUserName: 'Everyone', violentUssageName: 'Disallow', sexualUssageName: 'Disallow', commercialUssageName: 'Allow', licenseName: 'CC0' } }),
    humanoid: { humanBones: mapped.map(([bone]) => ({ bone, node: index[bone], ...extra0 })), ...(blender ? { armStretch: 0.05, legStretch: 0.05, upperArmTwist: 0.5, lowerArmTwist: 0.5, upperLegTwist: 0.5, lowerLegTwist: 0.5, feetSpacing: 0, hasTranslationDoF: false } : {}) },
    firstPerson: { lookAtTypeName: 'BlendShape', lookAtHorizontalInner: curve, lookAtHorizontalOuter: curve, lookAtVerticalDown: curve, lookAtVerticalUp: curve,
      ...(blender ? { firstPersonBone: index.head, firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 }, meshAnnotations: noMesh ? [] : [{ mesh: 0, firstPersonFlag: 'Auto' }, { mesh: 1, firstPersonFlag: 'Auto' }] } : {}) },
    blendShapeMaster: { blendShapeGroups: [['joy', 'Joy'], ['sorrow', 'Sorrow'], ['a', 'A'], ['e', 'E'], ['u', 'U'], ['blink', 'Blink'], ['lookup', 'LookUp'], ['lookdown', 'LookDown'], ['lookleft', 'LookLeft'], ['lookright', 'LookRight'], ...(blender ? [['unknown', 'Surprised'], ['neutral', 'Neutral']] : [])].map(([presetName, name]) => ({ name, presetName, binds: [], ...(blender ? { materialValues: [], isBinary: false } : {}) })) },
    ...(blender ? {
      secondaryAnimation: {
        boneGroups: [{ comment: '', stiffiness: 1, gravityPower: 0, gravityDir: { x: 0, y: -1, z: 0 }, dragForce: 0.4, center: -1, hitRadius: 0.02, bones: [hair[0]], colliderGroups: [0] }],
        colliderGroups: [{ node: index.head, colliders: [{ offset: { x: 0, y: 0.1, z: 0 }, radius: 0.1 }] }],
      },
      materialProperties: [0, 1].map((i) => ({ name: `Mat${i}`, shader: 'VRM/MToon', renderQueue: 2000, keywordMap: {}, tagMap: { RenderType: 'Opaque' },
        floatProperties: { _Cutoff: 0.5, _BumpScale: 1, _ShadeShift: 0, _ShadeToony: 0.9, _ReceiveShadowRate: 1, _ShadingGradeRate: 1, _LightColorAttenuation: 0, _IndirectLightIntensity: 0.1, _OutlineWidth: 0, _BlendMode: 0, _CullMode: 2, _OutlineWidthMode: 0, _OutlineColorMode: 0, _SrcBlend: 1, _DstBlend: 0, _ZWrite: 1, _MToonVersion: 38 },
        vectorProperties: { _Color: [1, 1, 1, 1], _ShadeColor: [0.97, 0.81, 0.86, 1], _MainTex: [0, 0, 1, 1], _EmissionColor: [0, 0, 0, 1], _OutlineColor: [0, 0, 0, 1] },
        textureProperties: { _MainTex: 0, _ShadeTexture: 0 } })),
    } : {}),
  }
  const VRM1 = {
    specVersion: spec1,
    ...(noMeta ? {} : { meta: blender
      ? { name: 'undefined', version: '', authors: [''], copyrightInformation: '', contactInformation: '', references: [], thirdPartyLicenses: '', licenseUrl, avatarPermission: 'onlyAuthor', allowExcessivelyViolentUsage: false, allowExcessivelySexualUsage: false, commercialUsage: 'personalNonProfit', allowPoliticalOrReligiousUsage: false, allowAntisocialOrHateUsage: false, creditNotation: 'required', allowRedistribution: false, modification: 'prohibited', otherLicenseUrl: '' }
      : { name: 'Tiny', version: '1', authors: ['LivLiv Player tests'], licenseUrl, avatarPermission: 'everyone', commercialUsage: 'personalNonProfit' } }),
    humanoid: { humanBones: Object.fromEntries(mapped.map(([n]) => [n, { node: index[n] }])) },
    lookAt: blender ? { ...lookAt, offsetFromHeadBone: [0, 0.06, 0] } : lookAt,
    expressions: { preset: { happy: empty, sad: empty, aa: empty, ee: empty, ou: empty, blinkLeft: empty, blinkRight: empty, lookUp: empty, lookDown: empty, lookLeft: empty, lookRight: empty,
      ...(blender ? { neutral: { isBinary: false, overrideBlink: 'none', overrideLookAt: 'none', overrideMouth: 'none' }, surprised: empty, relaxed: empty, angry: empty, ih: empty, oh: empty, blink: empty } : {}) },
      custom: { Surprised: empty, Wink: empty } },
    ...(blender ? { firstPerson: { meshAnnotations: noMesh ? [] : [{ node: nodes.findIndex((n) => n.name === 'headBox'), type: 'auto' }] } } : {}),
  }
  const mtoon = { specVersion: '1.0', transparentWithZWrite: false, renderQueueOffsetNumber: 0, shadeColorFactor: [0.97, 0.81, 0.86], shadingShiftFactor: 0, shadingToonyFactor: 0.9, giEqualizationFactor: 0.9,
    matcapFactor: [1, 1, 1], parametricRimColorFactor: [0, 0, 0], rimLightingMixFactor: 1, parametricRimFresnelPowerFactor: 5, parametricRimLiftFactor: 0, outlineWidthMode: 'none', outlineWidthFactor: 0,
    outlineColorFactor: [0, 0, 0], outlineLightingMixFactor: 1, uvAnimationScrollXSpeedFactor: 0, uvAnimationScrollYSpeedFactor: 0, uvAnimationRotationSpeedFactor: 0, shadeMultiplyTexture: { index: 0 } }
  const texTransform = { KHR_texture_transform: { offset: [0, 0], scale: [1, 1] } }
  const compressed = draco ? ['KHR_draco_mesh_compression'] : []
  const used = blender ? (spec === 0 ? ['VRM', 'KHR_texture_transform', 'KHR_materials_emissive_strength'] : ['VRMC_vrm', 'VRMC_springBone', 'VRMC_node_constraint', 'VRMC_materials_mtoon', 'KHR_texture_transform', 'KHR_materials_emissive_strength']) : [spec === 0 ? 'VRM' : 'VRMC_vrm']
  const picView = 2 + (blender ? 1 : 0)
  const material = (rgb) => ({
    ...(blender ? { name: 'Mat', alphaMode: 'OPAQUE', doubleSided: false, emissiveFactor: [0, 0, 0] } : {}),
    pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: 1, ...(blender ? { baseColorTexture: { index: 0, texCoord: 0, extensions: texTransform } } : {}) },
    ...(blender ? { extensions: { KHR_materials_emissive_strength: { emissiveStrength: 1 }, ...(spec === 0 ? {} : { VRMC_materials_mtoon: mtoon }) } } : {}),
  })
  const json = {
    asset: { version: '2.0', generator: blender ? (spec === 0 ? 'Khronos glTF Blender I/O v4.2.83' : BLENDER) : 'LivLiv Player tests' },
    extensionsUsed: [...used, ...compressed],
    ...(compressed.length ? { extensionsRequired: compressed } : {}),
    ...(outsideImage ? { images: [{ uri: outsideImage }] } : pic ? { images: [{ bufferView: picView, mimeType: 'image/png', ...(blender ? { name: 'tex' } : {}) }] } : {}),
    ...(blender ? { samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], textures: [{ sampler: 0, source: 0 }] } : {}),
    scene: 0, scenes: [{ nodes: [index.hips] }], nodes,
    ...(noMesh ? {} : { meshes: [{ primitives: [prim(0)] }, { primitives: [prim(1)] }] }),
    materials: [material([1, 0.82, 0.74]), material([0.3, 0.45, 0.9])],
    buffers: [{ byteLength: bin.byteLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: P.byteLength, target: 34962 },
      { buffer: 0, byteOffset: P.byteLength, byteLength: I.byteLength, target: 34963 },
      ...(blender ? [{ buffer: 0, byteOffset: uvAt, byteLength: UV.byteLength, target: 34962 }] : []),
      ...(pic ? [{ buffer: 0, byteOffset: picAt, byteLength: pic.length }] : []),
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
      { bufferView: 1, componentType: 5123, count: I.length, type: 'SCALAR' },
      ...(blender ? [{ bufferView: 2, componentType: 5126, count: 8, type: 'VEC2' }] : []),
    ],
    extensions: spec === 0 ? { VRM: VRM0 } : {
      VRMC_vrm: VRM1,
      ...(blender ? {
        VRMC_springBone: { specVersion: '1.0', colliders: [{ node: index.head, shape: { sphere: { offset: [0, 0.1, 0], radius: 0.1 } } }], colliderGroups: [{ name: 'head', colliders: [0] }],
          springs: [{ name: 'hair', joints: hair.map((node) => ({ node, hitRadius: 0.02, stiffness: 1, gravityPower: 0, gravityDir: [0, -1, 0], dragForce: 0.4 })), colliderGroups: [0] }] },
      } : {}),
    },
  }
  if (blender && spec !== 0) {
    const roll = { VRMC_node_constraint: { specVersion: '1.0', constraint: { roll: { source: index.leftLowerArm, rollAxis: 'X', weight: 0.5 } } } }
    if (circular) nodes[index.neck].extensions = { VRMC_node_constraint: { specVersion: '1.0', constraint: { rotation: { source: index.head, weight: 0.1 } } } }
    else nodes[twist].extensions = roll
  }
  const text = new TextEncoder().encode(JSON.stringify(json))
  const jlen = text.length + ((4 - (text.length % 4)) % 4)
  const glb = new Uint8Array(12 + 8 + jlen + 8 + bin.byteLength)
  const v = new DataView(glb.buffer)
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, glb.length, true)
  v.setUint32(12, jlen, true); v.setUint32(16, 0x4e4f534a, true)
  glb.fill(0x20, 20, 20 + jlen); glb.set(text, 20)
  v.setUint32(20 + jlen, bin.byteLength, true); v.setUint32(24 + jlen, 0x004e4942, true)
  glb.set(bin, 28 + jlen)
  return glb
}
