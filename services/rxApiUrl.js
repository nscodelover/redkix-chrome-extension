'use strict';
// Redkix api urls - to map all api server urls

angular.module('redKixServices').factory('$rxApiURLs', ['$cookies', 'appConfig', '$rxConfig', '$log', '$rxUtilities',
    function($cookies, AppConfig, rxConfig, $log, rxUtilities) {
        var rxConsts = rxConfig.consts,
            chosenConfig = {
                client: {
                    name: AppConfig.clientName
                },
                server: AppConfig.initialServer,
            },
            rxCookie = rxUtilities.getRxCookie();

        console.assert(rxCookie, "no rxCookie found");
        var _env = rxCookie ? rxCookie.env : null;

        // sandbox regular users 
        if (AppConfig.superUserAPIMapping) {
            if (_env && (_env.indexOf('http://') > -1 || _env.indexOf('https://') > -1)) {

                chosenConfig.server.name = 'custom';
                chosenConfig.server.main = _env;
                chosenConfig.server.alternate = rxCookie.altEnv || _env;
                chosenConfig.server.realtime = rxCookie.rtEnv || _env;

                if (chosenConfig.server.realtime.indexOf('clientapi') > -1) {
                    chosenConfig.server.realtime = chosenConfig.server.realtime.replace('clientapi', 'wsserver').concat(':80');
                }
            } else if (_env && _env[0] === '!') {

                var tempConfig = AppConfig.superUserAPIMapping[_env.slice(1)];

                if (tempConfig) {
                    chosenConfig.server = tempConfig;
                    chosenConfig.server.main = chosenConfig.server.alternate;
                }
            } else if (_env) {

                var tempConfig = AppConfig.superUserAPIMapping[_env];

                if (tempConfig) {
                    chosenConfig.server = tempConfig;
                }
            }
        }

        var mainAPIURL = chosenConfig.server.main,
            alternateAPIURL = chosenConfig.server.alternate,
            realtimeURL = chosenConfig.server.realtime;

        //$log.info('Chosen Config at reload: ', chosenConfig);


        // FILES FLOW WITH GATEWAY //

        // POST FILE -> /files (same env)
        // GET FILE PREVIEW -> /files/preview (same env)
        // GET FILE VERSIONS -> /files/versions (same env)

        // FILE CLIENT API FUNCTIONS
        // POST FILE URL -> /files
        // GET FILE -> /files
        // GET THUMBNAIL -> /files/thumbnail

        return {
            login: mainAPIURL + '/login',
            logout: mainAPIURL + '/logout',
            deleteAccount: mainAPIURL + '/accounts',
            mailBox: mainAPIURL + '/mailbox',
            conversationsAndThreads: mainAPIURL + '/conversationsAndThreads',
            messages: mainAPIURL + '/messages',
            mailBoxFolders: mainAPIURL + '/folders',
            contactFolders: mainAPIURL + '/contactFolders',
            groups: mainAPIURL + '/groupContacts',
            userPresence: mainAPIURL + '/presenceStatus',
            // FILE APIS //
            postFile: mainAPIURL + '/files',
            postFileURL: alternateAPIURL + '/files',
            filePreviews: mainAPIURL + '/files/preview',
            fileVersions: mainAPIURL + '/files/versions',
            getFile: alternateAPIURL + '/files',
            thumbnails: alternateAPIURL + '/files/thumbnail',
            updateFileStatus: mainAPIURL + '/files/status',
            // END OF FILE APIS //
            // users: 'user-base', //'http://private-ba8f-redkix.apiary-mock.com/rkDirectory',
            realtime: realtimeURL,
            readUnread: mainAPIURL + '/readUnread',
            userPreferences: mainAPIURL + '/userPreferences',
            contacts: mainAPIURL + '/contacts',
            moveConversation: mainAPIURL + '/conversations',
            moveThread: mainAPIURL + '/threads',
            resolveContacts: mainAPIURL + '/resolveContacts',
            updateEntity: mainAPIURL + '/updateEntity',
            fullBodyHTML: mainAPIURL + '/fullBodyHTML',
            redkixGroups: mainAPIURL + '/group',
            meetingResponse: mainAPIURL + '/meetingResponse'
        };
    }
]);