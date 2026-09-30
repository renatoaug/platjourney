/** The plugins of a plain build: none. A deploy with plugins points `platjourney-plugins` (Vite
 * alias and tsconfig path, set by PLUGINS_WEB) at its own module exporting the same shape. */
import type { PluginModule } from '../ui/plugin-slot'

const plugins: PluginModule = {}
export default plugins
