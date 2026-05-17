#!/usr/bin/env node
/**
 * Generate test fixtures (STL + 3MF) for local development.
 *
 * Writes a few simple solids to public/stls/. Run with:
 *   node packages/plugins/stl-viewer/scripts/generate-fixtures.mjs
 *
 * 3MF generation uses `fflate` (a transitive dep via three's 3MFLoader) to
 * zip the minimal three-part archive (Content_Types, rels, 3dmodel.model).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Default output assumes the plugin is checked out inside a monorepo at
// packages/plugins/stl-viewer/. Override with FIXTURES_DIR for a standalone
// checkout, e.g. `FIXTURES_DIR=./public/stls node scripts/generate-fixtures.mjs`.
const PROJECT_ROOT = join(__dirname, "..", "..", "..", "..");
const OUT_DIR = process.env.FIXTURES_DIR
	? join(process.cwd(), process.env.FIXTURES_DIR)
	: join(PROJECT_ROOT, "public", "stls");

mkdirSync(OUT_DIR, { recursive: true });

// ─── Binary STL writer ───────────────────────────────────────────

function writeBinarySTL(triangles, outPath) {
	// 80-byte header + 4-byte triangle count + 50 bytes per triangle
	const size = 80 + 4 + triangles.length * 50;
	const buf = new ArrayBuffer(size);
	const view = new DataView(buf);
	view.setUint32(80, triangles.length, true);
	let offset = 84;
	for (const tri of triangles) {
		const [a, b, c] = tri;
		const n = computeNormal(a, b, c);
		view.setFloat32(offset, n[0], true);
		view.setFloat32(offset + 4, n[1], true);
		view.setFloat32(offset + 8, n[2], true);
		offset += 12;
		for (const v of [a, b, c]) {
			view.setFloat32(offset, v[0], true);
			view.setFloat32(offset + 4, v[1], true);
			view.setFloat32(offset + 8, v[2], true);
			offset += 12;
		}
		view.setUint16(offset, 0, true);
		offset += 2;
	}
	writeFileSync(outPath, Buffer.from(buf));
	console.log(`wrote ${outPath} (${size} bytes, ${triangles.length} triangles)`);
}

function computeNormal(a, b, c) {
	const ux = b[0] - a[0],
		uy = b[1] - a[1],
		uz = b[2] - a[2];
	const vx = c[0] - a[0],
		vy = c[1] - a[1],
		vz = c[2] - a[2];
	const nx = uy * vz - uz * vy;
	const ny = uz * vx - ux * vz;
	const nz = ux * vy - uy * vx;
	const len = Math.hypot(nx, ny, nz) || 1;
	return [nx / len, ny / len, nz / len];
}

// ─── Solids ──────────────────────────────────────────────────────

function cube(size = 20) {
	const h = size / 2;
	const v = [
		[-h, -h, -h],
		[h, -h, -h],
		[h, h, -h],
		[-h, h, -h],
		[-h, -h, h],
		[h, -h, h],
		[h, h, h],
		[-h, h, h],
	];
	const faces = [
		// bottom
		[0, 1, 2],
		[0, 2, 3],
		// top
		[4, 6, 5],
		[4, 7, 6],
		// front
		[0, 5, 1],
		[0, 4, 5],
		// back
		[3, 2, 6],
		[3, 6, 7],
		// left
		[0, 3, 7],
		[0, 7, 4],
		// right
		[1, 5, 6],
		[1, 6, 2],
	];
	return faces.map(([a, b, c]) => [v[a], v[b], v[c]]);
}

function icosahedron(radius = 15) {
	const t = (1 + Math.sqrt(5)) / 2;
	const verts = [
		[-1, t, 0],
		[1, t, 0],
		[-1, -t, 0],
		[1, -t, 0],
		[0, -1, t],
		[0, 1, t],
		[0, -1, -t],
		[0, 1, -t],
		[t, 0, -1],
		[t, 0, 1],
		[-t, 0, -1],
		[-t, 0, 1],
	].map((p) => {
		const l = Math.hypot(p[0], p[1], p[2]);
		return [(p[0] / l) * radius, (p[1] / l) * radius, (p[2] / l) * radius];
	});
	const faces = [
		[0, 11, 5],
		[0, 5, 1],
		[0, 1, 7],
		[0, 7, 10],
		[0, 10, 11],
		[1, 5, 9],
		[5, 11, 4],
		[11, 10, 2],
		[10, 7, 6],
		[7, 1, 8],
		[3, 9, 4],
		[3, 4, 2],
		[3, 2, 6],
		[3, 6, 8],
		[3, 8, 9],
		[4, 9, 5],
		[2, 4, 11],
		[6, 2, 10],
		[8, 6, 7],
		[9, 8, 1],
	];
	return faces.map(([a, b, c]) => [verts[a], verts[b], verts[c]]);
}

function torus(R = 18, r = 6, segMajor = 48, segMinor = 16) {
	const tris = [];
	for (let i = 0; i < segMajor; i++) {
		for (let j = 0; j < segMinor; j++) {
			const a0 = (i / segMajor) * Math.PI * 2;
			const a1 = ((i + 1) / segMajor) * Math.PI * 2;
			const b0 = (j / segMinor) * Math.PI * 2;
			const b1 = ((j + 1) / segMinor) * Math.PI * 2;
			const v = (a, b) => [
				(R + r * Math.cos(b)) * Math.cos(a),
				(R + r * Math.cos(b)) * Math.sin(a),
				r * Math.sin(b),
			];
			const p00 = v(a0, b0);
			const p10 = v(a1, b0);
			const p11 = v(a1, b1);
			const p01 = v(a0, b1);
			tris.push([p00, p10, p11]);
			tris.push([p00, p11, p01]);
		}
	}
	return tris;
}

// Knurled cylinder — looks like a printed knob/handle
function knurledCylinder(radius = 12, height = 24, segments = 64) {
	const tris = [];
	const halfH = height / 2;
	for (let i = 0; i < segments; i++) {
		const a0 = (i / segments) * Math.PI * 2;
		const a1 = ((i + 1) / segments) * Math.PI * 2;
		// alternate ribs (knurl) — modulate radius slightly
		const r0 = i % 2 === 0 ? radius : radius * 0.94;
		const r1 = (i + 1) % 2 === 0 ? radius : radius * 0.94;
		const p0b = [Math.cos(a0) * r0, -halfH, Math.sin(a0) * r0];
		const p1b = [Math.cos(a1) * r1, -halfH, Math.sin(a1) * r1];
		const p0t = [Math.cos(a0) * r0, halfH, Math.sin(a0) * r0];
		const p1t = [Math.cos(a1) * r1, halfH, Math.sin(a1) * r1];
		tris.push([p0b, p1b, p1t]);
		tris.push([p0b, p1t, p0t]);
		// caps
		tris.push([[0, -halfH, 0], p1b, p0b]);
		tris.push([[0, halfH, 0], p0t, p1t]);
	}
	return tris;
}

// ─── 3MF writer ──────────────────────────────────────────────────

/**
 * Write a minimal binary 3MF file. A 3MF is a zip containing three parts:
 *   - [Content_Types].xml — MIME-type registry for the package
 *   - _rels/.rels         — package-relationship pointer to the model
 *   - 3D/3dmodel.model    — the actual mesh as 3MF XML
 *
 * No textures, no colors, no metadata; just enough to round-trip through
 * three.js's 3MFLoader for fixture testing.
 */
function writeMinimal3MF(triangles, outPath) {
	// Deduplicate vertices so the model is valid 3MF (mesh uses indexed verts).
	const vertMap = new Map();
	const verts = [];
	function vKey(v) {
		// Compact, exact key — these are fixture floats, no fp drift to worry about.
		return `${v[0]},${v[1]},${v[2]}`;
	}
	function addVert(v) {
		const k = vKey(v);
		const existing = vertMap.get(k);
		if (existing !== undefined) return existing;
		const idx = verts.length;
		verts.push(v);
		vertMap.set(k, idx);
		return idx;
	}
	const indexedTris = triangles.map(([a, b, c]) => [
		addVert(a),
		addVert(b),
		addVert(c),
	]);

	const vertXml = verts
		.map((v) => `      <vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`)
		.join("\n");
	const triXml = indexedTris
		.map(
			([a, b, c]) =>
				`      <triangle v1="${a}" v2="${b}" v3="${c}"/>`,
		)
		.join("\n");

	const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
${vertXml}
        </vertices>
        <triangles>
${triXml}
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>
`;

	const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;

	const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/>
</Relationships>
`;

	const archive = zipSync({
		"[Content_Types].xml": strToU8(contentTypes),
		"_rels/.rels": strToU8(rels),
		"3D/3dmodel.model": strToU8(model),
	});
	writeFileSync(outPath, Buffer.from(archive));
	console.log(
		`wrote ${outPath} (${archive.byteLength} bytes, ${verts.length} verts, ${indexedTris.length} triangles)`,
	);
}

// ─── Generate ────────────────────────────────────────────────────

writeBinarySTL(cube(20), join(OUT_DIR, "cube.stl"));
writeBinarySTL(icosahedron(15), join(OUT_DIR, "icosahedron.stl"));
writeBinarySTL(torus(18, 6, 64, 24), join(OUT_DIR, "torus.stl"));
writeBinarySTL(knurledCylinder(12, 24, 96), join(OUT_DIR, "knurled.stl"));

// 3MF counterparts so the same primitives can be tested through the 3MF
// loader path. We re-use the same triangle generators.
writeMinimal3MF(cube(20), join(OUT_DIR, "cube.3mf"));
writeMinimal3MF(icosahedron(15), join(OUT_DIR, "icosahedron.3mf"));
writeMinimal3MF(torus(18, 6, 48, 16), join(OUT_DIR, "torus.3mf"));
