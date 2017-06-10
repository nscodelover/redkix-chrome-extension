// Redkix authentication service.
'use strict';

angular.module('redKixServices').factory('$redKixActiveUserService', ['$rxApiURLs', '$rxDataApi', '$http', '$rxRepoService', '$rxConfig', '$log', '$rxUtilities',
    function(ApiURLs, DataApiService, $http, repoService, rxConfig, $log, rxUtilities) {
        return new RedKixActiveUser();

        function RedKixActiveUser() {
            var self = this;

            var rxConsts = rxConfig.consts,
                rxCookie = rxUtilities.getRxCookie(),
                selfSerializedUserPreferencesFields = ['webPreferences', 'iosPreferences'],
                userPreferences = {
                    trackedUser: true,
                    bypassInboxGroupUIDs: [],
                    soundNotifications: true,
                    desktopNotifications: true,
                    includeUserSignature: false,
                    userSignature: '',
                    includeRedkixSignature: true,
                    webPreferences: '{}'
                },
                userSavedInRepo = false;

            if (!rxCookie || !rxCookie.session || rxCookie.errorMessage) {
                $log.debug('Cookie is missing or corrupted, logging out');
                // $state.go('logout');
                return;
            }

            self.mailBox = rxCookie.mailBox;
            self.activeUserContact = {};
            self.sessionUID = rxCookie.session.uid;
            self.environment = rxCookie.env;
            self.drafts = rxCookie.drafts;
            self.memberOfGroups = [];
            self.bypassingInboxGroups = [];
            //self.avatarURL

            getRemoteUserPreferences.call(self);
            getRemoteRkSignature();
            // We retrieve the active mailbox from server everytime the app loads in order to check if something has changed in the user mailbox
            // If something does changed we need to update our cookie with the updated data from the server.
            getUpdatedMailBoxFromServer.call(self);
            // For first try
            repoCreatedHandler();

            repoService.on(repoService.events.repoCreated, repoCreatedHandler);

            self.get = function() {
                return self.activeUserContact;
            };

            self.getMailBoxUID = function() {
                return self.activeUserContact.uid;
            };
            // currently the same but whatever..    
            self.getMailBoxAddress = function() {
                return self.activeUserContact.mailBoxAddress;
            };

            self.isInitialized = function() {
                return self.mailBox.mailBoxStatus === rxConsts.MAILBOX_INITIALIZATION_STATUS.INITIALIZED;
            };

            self.setIsInitialized = function(state) {
                self.mailBox.mailBoxStatus = state ? rxConsts.MAILBOX_INITIALIZATION_STATUS.INITIALIZED : rxConsts.MAILBOX_INITIALIZATION_STATUS.UNINITIALIZED;

                updateRxCookie();
            };

            self.setMailBoxSettings = function(settings) {
                angular.merge(self.mailBox, settings);

                updateRxCookie();
            };

            self.getDisplayName = function() {
                return self.activeUserContact.getDisplayName();
            };

            self.getSessionToken = function() {
                return self.sessionUID;
            };

            self.getDrafts = function() {
                return self.drafts;
            };

            self.isAuthenticated = function() {
                var rxCookie = rxUtilities.getRxCookie();

                return angular.isDefined(rxCookie);
            };

            self.addMemberOfGroup = function(group) {
                self.memberOfGroups = self.memberOfGroups || [];

                self.memberOfGroups = rxUtilities.arrayUnique(self.memberOfGroups.concat(group));
            };

            self.setMemberOfGroups = function(groups) {
                self.memberOfGroups = [];

                groups.forEach(function(group) {
                    self.memberOfGroups.push(group);

                    if (group.bypassInbox) {
                        self.bypassingInboxGroups.push(group.uid);
                    }
                });
            };

            self.getMemberOfGroups = function() {
                return self.memberOfGroups;
            };

            self.getBypassingInboxGroups = function() {
                return self.bypassingInboxGroups;
            };

            self.getMemberOfGroupUIDs = function() {
                return self.memberOfGroups.map(function(group) {
                    return group.uid;
                });
            };

            self.getEnvironment = function() {
                return self.environment;
            };

            self.getBypassingInboxGroups = function() {
                return self.bypassingInboxGroups;
            };

            self.addBypassingInboxGroup = function(groupUID) {
                self.bypassingInboxGroups.push(groupUID);
            };

            self.removeBypassingInboxGroup = function(groupUID) {
                var index = self.bypassingInboxGroups.indexOf(groupUID);

                if (index > -1) {
                    self.bypassingInboxGroups.splice(index, 1);
                }
            };

            self.getUserPreferences = function() {
                return angular.copy(userPreferences);
            };

            self.setUserPreferences = function(ModifiedUserPreferences, skipSave) {
                if (angular.isDefined(ModifiedUserPreferences.userSignature)) {
                    if (userPreferences.userSignature !== ModifiedUserPreferences.userSignature) {
                        ModifiedUserPreferences.userSignature = EmailSanitizer.removeAddedBrTags(EmailSanitizer.sanitize(ModifiedUserPreferences.userSignature));
                    }
                }

                angular.merge(userPreferences, ModifiedUserPreferences);

                if (skipSave) {
                    console.debug('Skipping save user preferences, probably just a real time update');
                    return;
                }

                var types = {
                    trackedUser: 'boolean',
                    bypassInboxGroupUIDs: 'object',
                    soundNotifications: 'boolean',
                    desktopNotifications: 'boolean',
                    includeUserSignature: 'boolean',
                    userSignature: 'string',
                    includeRedkixSignature: 'boolean',
                    webPreferences: 'string'
                };

                // creating a deep copy to modify only what is being sent to the server
                var serializedModUserPref = serializeUserPreferences(angular.copy(ModifiedUserPreferences));

                var typeCheckValid = _.every(serializedModUserPref, function(value, key) {
                    if (types[key]) {
                        return typeof(value) === types[key];
                    }
                    return true;
                });

                if (!typeCheckValid) {
                    console.error('outbound userPreferences object didnt pass type check!');
                    return;
                }

                var data = {
                    'sessionUID': self.sessionUID
                };

                data = angular.extend(data, serializedModUserPref);

                var options = {
                    url: ApiURLs.userPreferences,
                    method: 'POST',
                    data: JSON.stringify(data),
                    processData: false
                };

                DataApiService.remote(options).then(function(response) {
                    console.log('post user settings returned', response);
                }, function(response) {
                    console.error(response);
                });
            };

            function repoCreatedHandler(repoName) {
                if (!userSavedInRepo) {
                    var contactsRepo = repoService.get('contacts');

                    if (contactsRepo) {
                        self.activeUserContact = contactsRepo.addItem(self.mailBox);

                        userSavedInRepo = true;
                    }
                }
            }

            function getUpdatedMailBoxFromServer() {
                var self = this,
                    data = {
                        sessionUID: self.sessionUID
                    },
                    options = {
                        url: ApiURLs.mailBox,
                        method: "GET",
                        params: data
                    };

                DataApiService.remote(options).then(function(response) {
                        if (response.mailBox) {
                            console.debug('updated mailBox', response.mailBox);

                            setMailBoxSettings(response.mailBox);
                        }
                    },
                    function(response) {
                        console.error('Couldnt retrieve mailbox from server', response);
                    });
            }

            function updateRxCookie() {
                // We create an updated version of our rxCookie using the service properties that are being maintanced by server updates.
                // Then we put it instead of the current rxCookie.
                var updatedCookie = {
                    mailBox: {},
                    session: {
                        uid: self.sessionUID
                    }
                };

                updatedCookie.mailBox = angular.copy(self.mailBox);

                //$log.info('Replacing rxCookie with a new one', updatedCookie);

                rxUtilities.setRxCookie(updatedCookie);
            }

            function deserializeUserPreferences(userPreferences) {
                selfSerializedUserPreferencesFields.forEach(function(fieldToSerialize) {
                    if (userPreferences[fieldToSerialize]) {
                        userPreferences[fieldToSerialize] = angular.fromJson(userPreferences[fieldToSerialize]);
                    }
                });

                return userPreferences;
            }

            function serializeUserPreferences(userPreferences) {
                selfSerializedUserPreferencesFields.forEach(function(fieldToSerialize) {
                    if (userPreferences[fieldToSerialize] && !angular.isString(userPreferences[fieldToSerialize])) {
                        userPreferences[fieldToSerialize] = angular.toJson(userPreferences[fieldToSerialize]);
                    }
                });

                return userPreferences;
            }

            function getRemoteUserPreferences() {
                var self = this,
                    data = {
                        sessionUID: self.sessionUID
                    },
                    options = {
                        url: ApiURLs.userPreferences,
                        method: "GET",
                        params: data
                    };

                DataApiService.remote(options).then(function(response) {
                        if (response.data && response.data.userPreferences) {
                            angular.merge(userPreferences, deserializeUserPreferences(response.data.userPreferences));
                        }

                        console.debug('user preferences', userPreferences);

                        //EmitterService.invoke(EmitterService.coreEvents.userPreferencesLoaded, userPreferences);

                    },
                    function(response) {
                        console.error('Couldnt retrieve user preferences from server', response);
                    });

            }

            function getRemoteRkSignature() {
                // TODO: change it to use DataAPIService
                $http.get('https://s3-us-west-2.amazonaws.com/redkix-shared-storage/signatures.json').then(function(res) {
                        if (res.data.webSignatures) {
                            self.rkSignatures = res.data.webSignatures;
                        }
                    },
                    function(res) {
                        console.log('cannot fetch redkix signatures', res)
                    });
            };
        }
    }
]);