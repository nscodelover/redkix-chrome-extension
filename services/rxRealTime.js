'use strict';
// realtime service

/*
  Example of usage:
    $rxRT.on($rxRT.events.NewMessageRecieved, function(data){
      //do whatever you want with the data that just came.
    });

  * NOTE: Remember to unsign when not needed anymore *
    you can pass the exact callback you wish to unsign:
      $rxRT.off($rxRT.events.NewMessageRecieved, function(data){
        //do whatever you want with the data that just came.
      });
    or, you can unsign all callbacks waiting for a specific event:
      $rxRT.off($rxRT.events.NewMessageRecieved);

*/

angular.module('redKixServices').factory('$rxRT', ['$rxApiURLs', '$redKixActiveUserService', '$rootScope',
    function(urls, ActiveUser, $rootScope) {
        // return null;
        return new RTSocket();

        function RTSocket() {
            // window.socket = this; // exposing RTSocket for testing
            // Extending this object to support eventEmitting.
            Emitter(this);

            var self = this,
                CTRL_NAME = 'rxRealTime',
                _socketUrl = buildSocketUrl(),
                _socketIOEvent = 'realTimeEvent',
                _types = {
                    REFRESH_PREVIEWS: 'refresh-previews',
                    MESSAGE_RECEIVED: 'message-received',
                    USER_STATUS_CHANGED: 'user-status-changed',
                    USER_TYPING: 'user-typing',
                    CONVERSATION_MOVED: 'conversation-moved',
                    ITEM_CREATED: 'item-created',
                    ITEM_MODIFIED: 'item-modified',
                    ENTITY_CREATED: 'entity-created',
                    ENTITY_DELETED: 'entity-deleted',
                    ENTITY_MODIFIED: 'entity-modified',
                    ENTITY_MOVED: 'entity-moved',
                    FOLDER_CREATED: 'folder-created',
                    FOLDER_MODIFIED: 'folder-modified',
                    FOLDER_MOVED: 'folder-moved',
                    GET_FOLDERS: 'getFolders',
                    GET_CHANGES: 'get-changes',
                    PRESENCE_SUBSCRIPTION: 'presence'
                },
                senderEmailAddress;

            this.types = _types;

            this.broadcast = broadcast;

            this.events = {
                DATA_RECEIVED: 'ws-data-received', //Global data received event
                REFRESH_PREVIEWS: 'ws-refresh-previews',
                MESSAGE_RECEIVED: 'ws-message-received',
                USER_STATUS_CHANGED: 'ws-user-status',
                USER_TYPING: 'ws-user-typing',
                CONVERSATION_MOVED: 'ws-conversation-moved',
                TICK: 'ws-timer-tick', // tick event for reconnect timer
                ITEM_CREATED: 'ws-item-created',
                ITEM_MODIFIED: 'ws-item-modified',
                ENTITY_CREATED: 'ws-entity-created',
                ENTITY_DELETED: 'ws-entity-deleted',
                ENTITY_MODIFIED: 'ws-entity-modified',
                ENTITY_MOVED: 'ws-entity-moved',
                FOLDER_CREATED: 'ws-folder-created',
                FOLDER_MODIFIED: 'ws-folder-modified',
                FOLDER_MOVED: 'ws-folder-moved',
                GET_FOLDERS: 'ws-getFolders',
                GET_CHANGES: 'ws-get-changes'
            };

            // var options = {
            //     autoConnect: false,
            //     reconnection: false,
            //     forceNew: true
            // };

            var options = {
                    autoConnect: true,
                    reconnection: true,
                    secure: true,
                    // forceNew: true,
                },
                typeToEvent = {},
                invoker = {};

            this.createSocket = function() {
                if (!this.ws) {
                    this.ws = createSocket(_socketUrl, options);
                    initialize();
                }
            }


            function buildSocketUrl() {
                if (!ActiveUser.getSessionToken) return;
                return urls.realtime + ('/?sessionUID=' + ActiveUser.getSessionToken());
            }

            function createSocket(url, options) {
                var _ws = null;

                _ws = io(url, options);

                _ws.on('connect', function() {
                    //console.info('WS CONNECTED');
                    //console.info('WS ADDRESS:', buildSocketUrl());
                    self.emit('connect');
                });

                _ws.on('disconnect', function() {
                    //console.info('WS DISCONNECTED');
                    // if (interval) {
                    //     clearInterval(interval);
                    //     interval = null;
                    // }
                    self.emit('disconnect');
                });

                _ws.on('connect_error', function(e) {
                    console.error('WS ERROR:', e);
                    //console.info('WebSocket is ' + self.isAlive() ? 'alive' : 'not alive');

                    if (_ws) {
                        //console.info("WS = " + _ws);
                    }
                    //startRetryMechanism();// currently we rely on the reconnect mechanism of socket.io. Will try to reconnect infinitely.
                });

                _ws.on(_socketIOEvent, function(data) {
                    //console.info('WS DATA RECEIVED:', data);
                    broadcast(data);
                    $rootScope.$apply();
                });


                return _ws;
            }

            function broadcast(data) {
                if (Array.isArray(data)) {
                    for (var i = 0; i < data.length; i++) {
                        broadcastSingle(data[i]);
                    };
                } else {
                    broadcastSingle(data);
                };
            }

            function broadcastSingle(data) {
                var e = typeToEvent[data.type] ? typeToEvent[data.type] : typeToEvent[data.notificationType];
                if (!e) {
                    console.error("realtime agent received unrecognized type: ", data);
                    return;
                }
                //console.debug('broadcast: ', data, e);
                invoker[e](data);
            }

            function initialize() {
                senderEmailAddress = ActiveUser.getMailBoxAddress();

                buildSocketUrl();
                // create invoker and typeToEvent
                generateObjects();
                // connect to ws server
                self.ws.connect();
                // _ws = io(urls.realtime, options);
            }


            // intialize the RT object
            // build the invoker and typeToEvent objects, based on written types and events.
            // one iteration to build both objects
            function generateObjects() {
                for (var type in _types) {
                    // writes to typeToEvent
                    typeToEvent[_types[type]] = type;
                    // console.debug('generated', _types[type], _types, type, typeToEvent);
                    // writes to invoker
                    invoker[type] = (function(type) {
                        return function(data) {
                            //console.debug('### WS INVOKE: ', type, data);
                            self.emit(self.events[type], data);
                        };
                    })(type);
                }
                window.invoker = invoker;
            }

            this.isAlive = function() {
                return self.ws && self.ws.io && self.ws.io.readyState === 'open';
            }


            var count, retryin, interval;

            function retry() {
                //console.debug('RETRY!');

                retryin = 0;
                self.ws = createSocket(urls.realtime, options);
                self.ws.connect();
            }

            // reconnect to WS server
            this.retry = retry;

            // This function is called when error occure in socket.io connect. It can be called multiple times on multiple threads.
            function startRetryMechanism() {
                if (interval) {
                    console.debug('skip retrying mechanism (retrying already in progress...');
                    return;
                }

                interval = -1; // just for locking this code. Will set the real value later in this function.
                //console.debug('start retry mechanism...');

                //destroy the socket and wait 30 seconds to create a new connection
                count = 30;

                if (self.ws) {
                    self.ws.destroy();
                    self.ws.io.cleanup();
                }

                self.ws = null;
                interval = setInterval(tick, 1000);

                function tick() {
                    count = count - 1;

                    if (count <= 0 && interval) {
                        clearInterval(interval);
                        interval = null;
                        retry();
                        return;
                    }

                    retryin = count % 60;
                    self.emit(self.events.TICK, retryin);
                    // console.debug('retry in %s seconds', retryin);
                }

            }

            this.send = function(type, content, recipients) {
                if (self.isAlive()) {

                    var additionalParams = {
                        mailBoxUID: ActiveUser.getMailBoxAddress(), //set the added data for the message
                        notificationType: type
                    };

                    angular.extend(content, additionalParams);

                    var req = {
                        content: content,
                        recipientsEmailAddresses: recipients
                    };

                    //console.debug('### WS: emit to server - ', _socketIOEvent, req);
                    self.ws.emit(_socketIOEvent, req);
                }
            }

            this.disconnect = function() {
                if (self.ws) {
                    self.ws.destroy();
                    self.ws.io.cleanup();
                    self.ws = null;
                }
            }
        }
    }
]);