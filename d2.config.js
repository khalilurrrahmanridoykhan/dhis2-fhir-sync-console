/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'fhir-sync-console',
    title: 'FHIR Sync Console',
    description:
        'A control panel for the FHIR Immunization Bridge -- pick or create a DHIS2 Route to a FHIR server, preview what a sync would do, run it, and see history and per-resource errors, all from inside DHIS2.',

    coreCompatibility: '>=2.40',
    minDHIS2Version: '2.40',

    entryPoints: {
        app: './src/App.tsx',
    },

    dataStoreNamespace: 'fhirSyncConsole',

    direction: 'auto',

    // Splits third-party deps (mainly @dhis2/ui) into their own chunk,
    // separate from this app's own code -- purely a build-output cleanliness
    // fix (silences the "chunk larger than 500kB" warning), no functional
    // change. See https://developers.dhis2.org/docs/app-platform/config/d2-config-js-reference#viteconfigextensions
    viteConfigExtensions: {
        build: {
            // The vendor chunk is still >500kB after this split -- that's
            // @dhis2/ui + React + app-runtime themselves, not this app's own
            // code (which is ~29kB on its own, see the App chunk). Nearly
            // every @dhis2/ui component in use somewhere in this app, so
            // there's no meaningful further split available; raising the
            // limit reflects that rather than leaving a warning nothing can
            // act on.
            chunkSizeWarningLimit: 800,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('node_modules')) return 'vendor'
                    },
                },
            },
        },
    },
}

module.exports = config
