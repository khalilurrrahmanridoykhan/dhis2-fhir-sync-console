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
}

module.exports = config
