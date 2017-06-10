angular.module('redKixServices').factory('rxPresenceService', ['$timeout', '$rxDataApi', '$rxApiURLs', '$rxRT', '$filter', '$rxRepoService', '$redKixActiveUserService', '$rxEv', '$interval',
    function($timeout, rxDataApi, rxApiURLs, RealTime, $filter, rxRepoService, rxActiveUser, emitterService, $interval) {


        var presenceStatusTimeout;
        var presenceStatusOnline = true;
        var PRESENCE_SERVICE = "rxPresenceService: ";
        var lastPresenceSubscription = '';
        var repos = rxRepoService.getAllRepos();
        var lastWakeUpCall = new Date();
        var MILLISECONDS_TILL_IDLE = 1000 * 60 * 2; // 2 minutes till we turn to idle state
        var TAG = "PresenceService";
        var isIdle = false;

        this.registerToRealtimeEvents = function() {
            var self = this;
            RealTime.on('connect', function() {
                $timeout(function() {
                    lastPresenceSubscription = '';
                    self.subscribeToPresenceEvents();
                    repos.contacts.getItem(rxActiveUser.activeUserContact).presenceStatus = 'active';
                }, 2000);
            });

            RealTime.on('disconnect', function() {
                $timeout(function() {
                    repos.contacts.getItem(rxActiveUser.activeUserContact).presenceStatus = 'not active';
                }, 2000);
            });

            // Change the presence according to onnline/offline status
            emitterService.on(emitterService.uiEvents.online, function() {
                repos.contacts.getItem(rxActiveUser.activeUserContact).presenceStatus = 'active';
            })

            emitterService.on(emitterService.uiEvents.offline, function() {
                repos.contacts.getItem(rxActiveUser.activeUserContact).presenceStatus = 'not active';
            })
        }



        this.subscribeToPresenceEvents = function(selectedThread, selectedFolder) {

            function onlyPinnedContactFoldersFilter(contactFolder) {
                return contactFolder.isPinned;
            };

            function onlyNonGroupRedkixUserFilter(contact) {
                return contact && contact.contactType === "PERSON" && contact.isRedkixUser &&
                    contact.mailBoxAddress != activeMailBoxAddress && contact.uid !== rxActiveUser.activeUserContact;
            };

            // Get contacts for pinned folders
            var contactsToSubscribe = [];

            // Add conversation participants and senders
            if (selectedThread) {
                contactsToSubscribe = contactsToSubscribe.concat(selectedThread.participants);

                // Insert the messages senders since they can be part of a group (not in the participants list)
                if (selectedThread.children) {
                    selectedThread.children.forEach(function(message) {
                        if (message.sender && message.sender.mailBoxAddress !== activeMailBoxAddress) {
                            contactsToSubscribe.push(message.sender);
                        }
                    });
                }

                // Remove groups and non redkix users              
                contactsToSubscribe = $filter('filter')(contactsToSubscribe, onlyNonGroupRedkixUserFilter);

            }

            var mailBoxesToSubscribe = _.uniq(contactsToSubscribe.map(function(contact) {
                return contact.contact ? contact.contact.uid : contact.uid;
            }));

            // Make sure we not already subscribe to this list of contacts
            if (lastPresenceSubscription && lastPresenceSubscription.toString() === mailBoxesToSubscribe.toString()) return;

            lastPresenceSubscription = mailBoxesToSubscribe;

            console.debug(TAG, "Subscribe to presence events: " + mailBoxesToSubscribe);

            if (RealTime.isAlive()) {
                RealTime.send(RealTime.types.PRESENCE_SUBSCRIPTION, {
                        mailBoxUIDsToSubscribe: mailBoxesToSubscribe
                    },
                    null);
            } else {
                $timeout(function() {
                    RealTime.send(RealTime.types.PRESENCE_SUBSCRIPTION, {
                            mailBoxUIDsToSubscribe: mailBoxesToSubscribe
                        },
                        null);
                }, 3000);
            }
        }

        // For every mouse or key event we run this function. It should be as quick as possible.  
        function wakeUp() {
            lastWakeUpCall = new Date();
        }

        function addWakeUpEvent(eventName) {
            document.addEventListener(eventName, wakeUp, false);
        }

        // we sample the idle state every 10 seconds to send the presence status to the server
        $interval(function() {
            var millisecondsSinceLastEvent = (new Date()).getTime() - lastWakeUpCall.getTime();

            if (!isIdle && millisecondsSinceLastEvent > MILLISECONDS_TILL_IDLE) {
                // We turn to be idle
                console.debug(TAG, "Become idle");
                isIdle = true;
                sendPresenceStatus(false);
            } else if (isIdle && millisecondsSinceLastEvent < MILLISECONDS_TILL_IDLE) {
                // got back from idle

                console.debug(TAG, "Wake up from Idle");
                isIdle = false;
                sendPresenceStatus(true);
            }
        }, 1000 * 10);

        addWakeUpEvent("mousemove");
        addWakeUpEvent("touchstart");
        addWakeUpEvent("keyup");

        function sendPresenceStatus(isOnline) {
            if (presenceStatusOnline === isOnline) return; // status did not changed. No reason to update server.

            presenceStatusOnline = isOnline;

            console.debug(TAG, "update server on presence status: ", (isOnline ? "online" : "offline"));
            var request = {
                url: rxApiURLs.userPresence,
                method: "POST",
                data: JSON.stringify({
                    newPresenceStatus: isOnline ? "online" : "offline"
                }),
                params: {}
            };

            rxDataApi.remote(request).then(function(response) {
                console.debug(TAG, "updated presence status on server succeeded: ", response.config.data);
            }, function(respones) {
                console.error(TAG, "fail to update presence on server: ", respones);
            })
        }

        this.isIdle = function() {
            return isIdle;
        }

        return this;
    }
]);