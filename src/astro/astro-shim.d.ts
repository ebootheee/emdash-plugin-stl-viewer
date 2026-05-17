// Allow `tsc --noEmit` to see .astro components as importable modules.
// Astro itself uses a Vite plugin (not tsc) to compile them, so this is
// purely a type hint for the IDE / standalone typecheck pass.
declare module "*.astro" {
	const component: unknown;
	export default component;
}
