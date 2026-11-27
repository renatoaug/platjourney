// The CSP build of MapLibre has the same API as the package's main entry, without its own types.
declare module 'maplibre-gl/dist/maplibre-gl-csp' {
  import maplibregl from 'maplibre-gl'
  export default maplibregl
}
