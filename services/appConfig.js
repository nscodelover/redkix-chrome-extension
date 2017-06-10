"use strict";

var appConfig = {
    appConfig: {
        clientName: 'develop',
        version: '4.65.2',
        initialServer: {
            name: 'production',
            main: 'https://prod-clientapi.redkix.com',
            alternate: 'https://prod-clientapi.redkix.com',
            realtime: 'https://prod-wsserver.redkix.com:443'
        },
        superUserAPIMapping: {
            develop: {
                name: 'develop',
                main: 'https://dev-clientapi.redkix.com',
                alternate: 'https://dev-clientapi.redkix.com',
                realtime: 'https://dev-wsserver.redkix.com:443'
            },
            integration: {
                name: 'integration',
                main: 'https://int-clientapi.redkix.com',
                alternate: 'https://int-clientapi.redkix.com',
                realtime: 'https://int-wsserver.redkix.com:443'
            },
            staging: {
                name: 'staging',
                main: 'https://stg-clientapi.redkix.com',
                alternate: 'https://stg-clientapi.redkix.com',
                realtime: 'https://stg-wsserver.redkix.com:443'
            },
            production: {
                name: 'production',
                main: 'https://prod-clientapi.redkix.com',
                alternate: 'https://prod-clientapi.redkix.com',
                realtime: 'https://prod-wsserver.redkix.com:443'
            },
            local: {
                name: 'local',
                main: 'http://localhost:3000',
                alternate: 'http://localhost:3000',
                realtime: 'http://localhost:80'
            }
        },
        mixPanel: {
            name: 'develop',
            token: 'e6d16e7a59f1ea827f81b03cee6d32a7'
        }
    },
};

if (typeof angular !== 'undefined') {
    angular.module('appConfig', [])

    .constant('appConfig', {
        clientName: 'develop',
        version: '4.65.2',
        initialServer: {
            name: 'production',
            main: 'https://prod-clientapi.redkix.com',
            alternate: 'https://prod-clientapi.redkix.com',
            realtime: 'https://prod-wsserver.redkix.com:443'
        },
        superUserAPIMapping: {
            develop: {
                name: 'develop',
                main: 'https://dev-clientapi.redkix.com',
                alternate: 'https://dev-clientapi.redkix.com',
                realtime: 'https://dev-wsserver.redkix.com:443'
            },
            integration: {
                name: 'integration',
                main: 'https://int-clientapi.redkix.com',
                alternate: 'https://int-clientapi.redkix.com',
                realtime: 'https://int-wsserver.redkix.com:443'
            },
            staging: {
                name: 'staging',
                main: 'https://stg-clientapi.redkix.com',
                alternate: 'https://stg-clientapi.redkix.com',
                realtime: 'https://stg-wsserver.redkix.com:443'
            },
            production: {
                name: 'production',
                main: 'https://prod-clientapi.redkix.com',
                alternate: 'https://prod-clientapi.redkix.com',
                realtime: 'https://prod-wsserver.redkix.com:443'
            },
            local: {
                name: 'local',
                main: 'http://localhost:3000',
                alternate: 'http://localhost:3000',
                realtime: 'http://localhost:80'
            }
        },
        mixPanel: {
            name: 'develop',
            token: 'e6d16e7a59f1ea827f81b03cee6d32a7'
        }
    })

    ;

}