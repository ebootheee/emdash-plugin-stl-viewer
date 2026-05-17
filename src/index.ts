/**
 * 3D Model Viewer plugin for EmDash CMS (STL + 3MF).
 *
 * Native-format trusted plugin. Registers a `stl-viewer` Portable Text block
 * (kept under the original type for backward compatibility) backed by an
 * Astro component that lazy-loads three.js on viewport entry. STL is decoded
 * with `STLLoader`; 3MF is decoded with `3MFLoader` (lazy-imported only when
 * a 3MF URL is encountered).
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { stlViewerPlugin } from "emdash-plugin-stl-viewer";
 * plugins: [stlViewerPlugin()]
 * ```
 */
import { definePlugin } from "emdash";
import type { PluginDescriptor, ResolvedPlugin } from "emdash";

export interface StlViewerOptions {}

const PLUGIN_ID = "stl-viewer";
const PLUGIN_VERSION = "0.2.0";

export function stlViewerPlugin(
	options: StlViewerOptions = {},
): PluginDescriptor<StlViewerOptions> {
	return {
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		entrypoint: "emdash-plugin-stl-viewer",
		componentsEntry: "emdash-plugin-stl-viewer/astro",
		options,
	};
}

export function createPlugin(_options: StlViewerOptions = {}): ResolvedPlugin {
	return definePlugin({
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		admin: {
			portableTextBlocks: [
				{
					type: "stl-viewer",
					label: "3D Model (STL or 3MF)",
					icon: "code",
					description:
						"Embed an interactive 3D preview of an STL or 3MF file",
					placeholder: "Paste STL or 3MF URL...",
					fields: [
						{
							type: "text_input",
							action_id: "id",
							label: "Model URL (.stl or .3mf)",
							placeholder: "https://… or /_emdash/api/media/file/…",
						},
						{
							type: "select",
							action_id: "format",
							label: "Format",
							options: [
								{ label: "Auto-detect from URL (default)", value: "auto" },
								{ label: "STL", value: "stl" },
								{ label: "3MF", value: "3mf" },
							],
						},
						{
							type: "text_input",
							action_id: "title",
							label: "Title (optional)",
							placeholder: "e.g. Bracket v3",
						},
						{
							type: "text_input",
							action_id: "caption",
							label: "Caption (optional)",
						},
						{
							type: "select",
							action_id: "material",
							label: "Material",
							options: [
								{ label: "Matte plastic (default)", value: "matte" },
								{ label: "Glossy plastic", value: "glossy" },
								{ label: "Brushed metal", value: "metal" },
								{ label: "Normal map (rainbow)", value: "normal" },
								{ label: "Clay (unlit)", value: "clay" },
							],
						},
						{
							type: "text_input",
							action_id: "color",
							label: "Color (hex, e.g. #22d3ee)",
							placeholder: "#cfd1d4",
						},
						{
							type: "select",
							action_id: "height",
							label: "Viewer height",
							options: [
								{ label: "Compact (320px)", value: "compact" },
								{ label: "Standard (440px)", value: "standard" },
								{ label: "Tall (560px)", value: "tall" },
							],
						},
						{
							type: "toggle",
							action_id: "autoRotate",
							label: "Auto-rotate when idle",
							initial_value: true,
						},
						{
							type: "toggle",
							action_id: "showGrid",
							label: "Show ground plane",
							initial_value: true,
						},
					],
				},
			],
		},
	});
}

export default createPlugin;
