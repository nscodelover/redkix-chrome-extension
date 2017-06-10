// Redkix utillities service.
'use strict';

angular.module('redKixServices').service('$rxOutbound', ['$q', '$rxDataApi', '$rootScope', '$redKixActiveUserService', '$rxRepoService', '$filter', '$rxApiURLs', '$rxConfig', '$rxUtilities', '$rxModelService', '$http', '$rxEv',
    function($q, DataApi, $rootScope, ActiveUser, repoService, $filter, rxApiURLs, rxConfig, rxUtilities, ModelService, $http, EmitterService) {
        if (!ActiveUser.getSessionToken) return;
        var self = this,
            CTRL_NAME = '$rxOutbound',
            sessionUID = ActiveUser.getSessionToken(),
            activeUserObj = ActiveUser.get(),
            rxConsts = rxConfig.consts,
            repos = repoService.getAllRepos(),
            queueIsRunning = false,
            outboundObjectsQueue = {},
            threadUIDToParentUIDMap = {},
            sentMessagePromise,
            lastSentMessageConversationUID,
            lastSentMessageThreadUID;

        self.sendFieldsToServer = sendFieldsToServer;
        self.createContactFolder = createContactFolderHandler;
        self.createGroup = createGroupHandler;
        self.resolveContacts = resolveContactsHandler;
        self.sendMeetingResponse = sendMeetingResponseHandler;

        self.sendMessage = function(newMsgJSON, parentUID) {
            // IMPORTANT NOTICE - At this point the msg is marked as PENDING sent state            
            console.log('message json about to be sent is', newMsgJSON);

            // rxMixpanel.sendMessage(newMsgJSON, ActiveUser.getUserPreferences(), repos.threads.getItem(newMsgJSON.threadUID));

            var timeNow = moment().format(),
                msgToBeSent = new repos.messages.Model(newMsgJSON),
                serverRequestID = msgToBeSent.uid,
                smartParentUID = parentUID || serverRequestID,
                messageAttachmentUIDs = msgToBeSent.getAttachmentUIDs();

            msgToBeSent.receivedDate = timeNow;
            msgToBeSent.sentState = $rootScope.online ? rxConsts.SENT_STATE.PENDING : rxConsts.SENT_STATE.FAILED;

            if (!msgToBeSent.fullBodyHTML) {
                msgToBeSent.bodyHTML = (msgToBeSent.bodyHTML && msgToBeSent.bodyHTML !== '') ? msgToBeSent.bodyHTML : '<p></p>';
                msgToBeSent.bodyPreview = rxUtilities.stripHTML(msgToBeSent.bodyHTML);
            }

            msgToBeSent.subject = (msgToBeSent.subject) ? msgToBeSent.subject : '';
            msgToBeSent.sender = ActiveUser.get();

            // If we add a new message to existing queue which there are failed sent messages,
            // we automatically mark it as FAILED until the older ones will be resolved and sent
            if (outboundObjectsQueue[smartParentUID] && outboundObjectsQueue[smartParentUID].data && outboundObjectsQueue[smartParentUID].data.length > 0 &&
                outboundObjectsQueue[smartParentUID].data[0].msgToBeSent.sentState === rxConsts.SENT_STATE.FAILED) {
                msgToBeSent.sentState = rxConsts.SENT_STATE.FAILED;
            }
            //TODO: Dor check if we need it.
            /*var sentItemsFolderUID = getSentItemsFolderUID();

            if (!sentItemsFolderUID) {
                return;
            }*/

            msgToBeSent.folderUID = rxConsts.SEARCH_FOLDER_UID;

            // In case there's parentUID (reply all) smartParentUID will contain the parent thread uid.            
            // Otherwise we set the inner parentUID with the serverRequestID so after adding the message to the repo it will be linked to the right thread.
            // Pay attention that this doesn't have anything to do with parentMessageUID.
            // Pay attention that parentUID field is for our inner use only (to link models).
            msgToBeSent.setUnfetchedParents.call(msgToBeSent, [{
                uid: smartParentUID
            }]);

            // If there's no conversationUID, it means that it's a new discussion so we explicitly set the conversationUID as the requestID
            msgToBeSent.conversationUID = msgToBeSent.conversationUID || serverRequestID;

            // OFFLINE MECHANISM PART - READ THE DESCRIPTION //
            // Here we're gonna add the new data before we send it to the server because who said it's gonna be there anytime we need it?
            // IMPORTANT NOTE - when we create the new data we use the following setup -
            // Each entity gets a PENDING sent state (until it will be proven as SENT\FAILED)
            // All the entities get the same uid - which represents the http header field "request-id" that we sent to the server in the POST request,
            // and when we'll get the response from the server, we'll be able to figure out which pending data in the repo has been created succesfully in the server, and then
            // we'll replace the temporary uids with the correct ones that the server gave.
            // END OF THE DIGGING - LETS GO //

            // Adding the msg to be sent to the server with pending sent state
            // If it's a reply all we can fetch children after link. In any other case we didn't create the parent yet so it's a redundant call
            var newMessageInRepo = repos.messages.addItems.call(repos.messages, msgToBeSent, {
                    skipChildrenFetchingAfterLink: $rootScope.online
                })[0],
                newThreadInRepo, newConversationInRepo;

            if (!$rootScope.online) {
                newMessageInRepo.setSentState.call(newMessageInRepo, rxConsts.SENT_STATE.FAILED);
            }
            // TODO: Uncomment this when we get Smart Attachments back to business!
            // Link between the attachments and their original message which we've just created
            // if (messageAttachmentUIDs.length > 0) {
            //     repos.files.updateItemsFields.call(repos.files, messageAttachmentUIDs, {
            //         originalMessage: newMessageInRepo
            //     });
            // }

            switch (msgToBeSent.flowType) {
                case rxConsts.FLOW_TYPE.REPLY_ALL:
                    // At this point the message should be already linked to its parent thread and the thread already fetched itself to the new message
                    // That's why we do nothing here
                    break;
                case rxConsts.FLOW_TYPE.FORWARD:
                    // At this point the message is already linked to the reference of its parent thread.
                    // (it's already exist in the repo but only with an id, so we'll just replace the data with the real thread).
                    newThreadInRepo = repos.threads.addItem.call(repos.threads, newMessageInRepo.toParentJSON.call(newMessageInRepo, serverRequestID), {
                        skipChildrenFetchingAfterLink: true
                    });

                    // Update conversation's last activity date so it'll pop up
                    repos.conversations.updateItemsFields.call(repos.conversations, newThreadInRepo.parents[0], {
                        lastActivityDate: newThreadInRepo.lastActivityDate
                    });
                    break;
                case rxConsts.FLOW_TYPE.REPLY_ONE:
                    // At this point the message is already linked to the reference of its parent thread.
                    // (it's already exist in the repo but only with an id, so we'll just replace the data with the real thread).
                    newThreadInRepo = repos.threads.addItem.call(repos.threads, newMessageInRepo.toParentJSON.call(newMessageInRepo, serverRequestID), {
                        skipChildrenFetchingAfterLink: true
                    });

                    // Update conversation's last activity date so it'll pop up
                    repos.conversations.updateItemsFields.call(repos.conversations, newThreadInRepo.parents[0], {
                        lastActivityDate: newThreadInRepo.lastActivityDate
                    });
                    break;
                case rxConsts.FLOW_TYPE.NEW_DISCUSSION:
                    // At this point the message is already linked to the reference of its parent thread.
                    // (it's already exist in the repo but only with an id, so we'll just replace the data with the real thread).
                    // In this case we don't want to emit event after creating the thread, because we haven't created it parent conversation yet.
                    // Aftter we'll create the conversation, we'll emit the relevant event(s).                    

                    newThreadInRepo = repos.threads.addItem.call(repos.threads, newMessageInRepo.toParentJSON.call(newMessageInRepo, serverRequestID), {
                        skipChildrenFetchingAfterLink: true,
                        skipEventEmitting: true
                    });

                    newConversationInRepo = repos.conversations.addItem.call(repos.conversations, newThreadInRepo.toParentJSON.call(newThreadInRepo, serverRequestID), {
                        skipChildrenFetchingAfterLink: true
                    });

                    break;
            }

            var queueObject = {
                msgToBeSent: newMessageInRepo,
                parentUID: smartParentUID
            };

            addOutboundObjectToQueue(queueObject);
        };

        self.runSendQueue = function() {
            console.debug('Running send queue', outboundObjectsQueue);

            var relevantQueueIndex = getRelevantQueueObjectIndex();

            if ($rootScope.online && relevantQueueIndex) {
                queueIsRunning = true;

                console.debug('Found relevant queue index', relevantQueueIndex);

                var sentData = outboundObjectsQueue[relevantQueueIndex].data[0];

                send(sentData).then(function() {
                    console.debug('xx Send successfuly, continuing to next message');

                    outboundObjectsQueue[relevantQueueIndex].data.shift();

                    self.runSendQueue();
                }, function() {
                    console.error('xx Send operation has failed, aborting operation and marking the current queue pending data as failed');

                    markOutboundObjectsAsFailed(relevantQueueIndex);

                    queueIsRunning = false;
                });
            } else {
                console.debug('finished sending all messages in the queue');

                queueIsRunning = false;
            }
        };

        self.stopSendQueue = function() {
            console.debug('Stopping send queue');

            queueIsRunning = false;

            if (sentMessagePromise) {
                console.debug('Aborting pending post request');

                sentMessagePromise.abort();
            }

            console.debug('Changing all pending messages state to failed');

            var pendingMessages = repos.messages.getFilteredData.call(repos.messages, {
                propertyFilters: {
                    sentState: rxConsts.SENT_STATE.PENDING
                }
            });

            pendingMessages.forEach(function(pendingMessage) {
                pendingMessage.setSentState.call(pendingMessage, rxConsts.SENT_STATE.FAILED);
            });
        };

        /* 
        OUTBOUND QUEUE SPECIFICATIONS
        
        Queue container name - outboundObjectsQueue

        Queue Index - sent message's threadUID (if it's a new thread we use the generate serverRequestID instead)
        
        Queue object structure - 
        {
          outerIndex - Object's outer index (for sorting purposes)

          lastInsertionTime - The last time a sent message was inserted to that index

          data: [{ sent_message_data }, { sent_message_data }] - The data to be sent

          lastParentUID - Last parentUID, to save the parentMessageUID check each iteration [NOT IN USE YET]
        }

        */
        function addOutboundObjectToQueue(queueObject) {
            var queueIndex = queueObject.parentUID;

            outboundObjectsQueue = outboundObjectsQueue || {};

            outboundObjectsQueue[queueIndex] = outboundObjectsQueue[queueIndex] || {};

            var currentQueueObject = outboundObjectsQueue[queueIndex];

            currentQueueObject.outerIndex = currentQueueObject.outerIndex || queueIndex;
            currentQueueObject.data = currentQueueObject.data || [];
            currentQueueObject.data.push(queueObject);
            currentQueueObject.lastInsertionTime = moment().format();

            if (!queueIsRunning) {
                console.debug('xx start running queue');

                self.runSendQueue();
            }
        }

        function getRelevantQueueObjectIndex() {
            var queueObjectsArray = rxUtilities.objectToArray(outboundObjectsQueue);

            // Filters queue objects that has no data to send
            queueObjectsArray = $filter('filter')(queueObjectsArray, function(queueObject) {
                return queueObject.data && queueObject.data.length > 0;
            });

            if (queueObjectsArray.length === 0) {
                return null;
            }
            // Order queue objects by their last insertion time in order to send the newest one
            var sortedQueueObjects = $filter('orderBy')(queueObjectsArray, 'lastInsertionTime', true);

            return sortedQueueObjects[0].outerIndex;
        }

        function markOutboundObjectsAsFailed(queueObjectIndex) {
            if (outboundObjectsQueue[queueObjectIndex] && outboundObjectsQueue[queueObjectIndex].data) {
                outboundObjectsQueue[queueObjectIndex].data.forEach(function(queueObject) {
                    // Mark message as failed sent if it wasn't already set
                    if (queueObject.msgToBeSent.sentState !== rxConsts.SENT_STATE.FAILED) {
                        queueObject.msgToBeSent.setSentState.call(queueObject.msgToBeSent, rxConsts.SENT_STATE.FAILED);
                    }
                });
            }
        }

        function send(queueObject) {
            var {
                msgToBeSent,
                parentUID,
            } = queueObject;

            console.debug('sending message', msgToBeSent);

            var deferred = $q.defer(),
                serverRequestID = msgToBeSent.uid,
                additionalParams;

            // If it's a reply all we need to fetch the parentMessageUID from last sent message            
            if (msgToBeSent.flowType === rxConsts.FLOW_TYPE.REPLY_ALL) {
                var repoMsgFilters = {
                    parentFilterValuesObject: {
                        uid: parentUID
                    },
                    propertyFilters: {
                        sentState: rxConsts.SENT_STATE.SENT
                    }
                };

                var allRepoMessages = repos.messages.getFilteredData.call(repos.messages, repoMsgFilters);

                if (allRepoMessages.length === 0) {
                    // try to replace parent message ID with the parent uid in the model 
                    if (msgToBeSent.parents && msgToBeSent.parents.length > 0) {
                        parentUID = msgToBeSent.parents[0].uid;
                        repoMsgFilters.parentFilterValuesObject = {
                            uid: parentUID
                        };
                        allRepoMessages = repos.messages.getFilteredData.call(repos.messages, repoMsgFilters);
                    }

                    if (allRepoMessages.length === 0 && !msgToBeSent.parents[0].isChat) {
                        // No message was sent yet.
                        console.warn('No message has been sent yet on conversation ' + parentUID);
                        deferred.reject();
                        return deferred.promise;
                    }
                }

                var filteredRepoMessages = $filter('orderBy')(allRepoMessages, 'receivedDate'),
                    newestRelatedMsg = filteredRepoMessages[filteredRepoMessages.length - 1];

                // If its a first message in chat conversation, we need to specify threadUID and conversationUID of the message
                if (msgToBeSent.parents[0].isChat && allRepoMessages.length === 0) {
                    additionalParams = {
                        threadUID: msgToBeSent.parents[0].uid,
                        conversationUID: msgToBeSent.parents[0].parents[0].uid
                    };

                    // A new chat, take the 'to' recipient from the thread recipients
                    msgToBeSent.toMailBoxes = msgToBeSent.parents[0].participants.filter(function(user) {
                        return user.mailBoxAddress !== activeUserObj.mailBoxAddress;
                    });

                } else if (!newestRelatedMsg || (parentUID && newestRelatedMsg.parents[0].uid !== parentUID)) {
                    console.error('Bad thing happend, message has wrong parent..aborting', msgToBeSent, newestRelatedMsg.parents[0].uid, parentUID);

                    deferred.reject();
                    return deferred.promise;
                } else if (newestRelatedMsg && newestRelatedMsg.uid) {
                    msgToBeSent.parentMessageUID = newestRelatedMsg.uid;

                    msgToBeSent.toMailBoxes.push(newestRelatedMsg.sender);
                    // Fetch new message 'to' and 'cc' from thread's last message right before we send it in case there were added participants to the thread until send time
                    var mailBoxAddressesExcludingSelf = rxUtilities.arrayUnique(msgToBeSent.toMailBoxes.concat(newestRelatedMsg.toMailBoxes)).filter(function(user) {
                        return user.mailBoxAddress !== activeUserObj.mailBoxAddress;
                    });

                    msgToBeSent.toMailBoxes = mailBoxAddressesExcludingSelf.length === 0 ? msgToBeSent.toMailBoxes : mailBoxAddressesExcludingSelf;

                    msgToBeSent.ccMailBoxes = rxUtilities.arrayUnique(msgToBeSent.ccMailBoxes.concat(newestRelatedMsg.ccMailBoxes)).filter(function(user) {
                        return user.mailBoxAddress !== activeUserObj.mailBoxAddress;
                    });

                    // Make sure we have no duplications between cc, bcc and to
                    msgToBeSent.ccMailBoxes = rxUtilities.removeIntersectionByKey(msgToBeSent.ccMailBoxes, msgToBeSent.toMailBoxes);
                    msgToBeSent.bccMailBoxes = rxUtilities.removeIntersectionByKey(msgToBeSent.bccMailBoxes, msgToBeSent.ccMailBoxes.concat(msgToBeSent.toMailBoxes));
                }
            }

            msgToBeSent.setSentState.call(msgToBeSent, rxConsts.SENT_STATE.PENDING, true);

            var readyServerMsg = msgToBeSent.toServer.call(msgToBeSent);
            //TODO: dor
            //sentItemsFolderUID = getSentItemsFolderUID();

            if (!rxUtilities.isObjectNullOrEmpty(additionalParams)) {
                angular.merge(readyServerMsg, additionalParams);
            }

            console.debug('ready outbound message is', readyServerMsg);

            sentMessagePromise = postMessage(readyServerMsg, serverRequestID);

            sentMessagePromise.then(function(response) {
                // Data object will contain the following fields:
                // data.threads[], data.messages[], data.conversations[], data.contacts[]
                var data = response.data;

                if (data.messages) {

                    data.messages.forEach(function(message) {
                        // delete message.subject;
                        message.folderUID = rxConsts.SEARCH_FOLDER_UID;
                        repos.messages.replaceItemUID.call(repos.messages, msgToBeSent, message);
                    });
                }

                response.data.conversations[0].folderUID = rxConsts.SEARCH_FOLDER_UID;

                response.data.threads[0].conversations.forEach(function(conversation) {
                    conversation.folderUID = rxConsts.SEARCH_FOLDER_UID;
                });

                var sentItemsFolderUID = rxConsts.SEARCH_FOLDER_UID;
                // Replace the pending items uids in the repo to the new ones we've just received from the server
                if (data.conversations && sentItemsFolderUID) {
                    data.conversations.forEach(function(conversation) {
                        // We create new conversation only in new discussion scenario
                        if (msgToBeSent.flowType === rxConsts.FLOW_TYPE.NEW_DISCUSSION) {
                            var conversationToReplace = repos.conversations.getItem({
                                uid: serverRequestID,
                                folderUID: sentItemsFolderUID
                            });

                            if (conversationToReplace) {
                                // Here we unlink the conversation we temporarily created because the server creates a new conversation for us
                                ModelService.unlinkAll(conversationToReplace, {
                                    skipChildrenFetchingAfterLink: true
                                });

                                repos.conversations.removeItem(conversationToReplace);
                            }
                        }
                    });
                }

                if (data.threads && sentItemsFolderUID) {
                    data.threads.forEach(function(thread) {
                        var threadToReplace = repos.threads.getItem({
                            uid: serverRequestID
                        });

                        if (threadToReplace) {
                            // Here we unlink the thread we created that was found out as redundant because the server chose existing thread for the message we've sent
                            // After we remove our temporary thread, the real thread will be automatically selected
                            ModelService.unlinkAll(threadToReplace, {
                                skipChildrenFetchingAfterLink: true
                            });

                            repos.threads.removeItem(threadToReplace);
                        }
                    });
                }

                // Calling addItems will evenatually call updateItem which models the JSON and calling safeExtend with it on the existing pending item in the repo
                repos.contacts.addItems.call(repos.contacts, data.contacts);

                repos.conversations.addItems.call(repos.conversations, data.conversations, {
                    skipChildrenFetchingAfterLink: true,
                    skipEventEmitting: true
                });

                var addedThreads = repos.threads.addItems.call(repos.threads, data.threads, {
                    skipChildrenFetchingAfterLink: true,
                    skipEventEmitting: true
                });

                addedThreads.forEach(function(thread) {
                    thread.$lastTimeFetched = moment().format();
                });

                var repoMessages = repos.messages.addItems.call(repos.messages, data.messages, {
                    skipChildrenFetchingAfterLink: true
                });

                if (repoMessages[0].internetMessageId <= 0) {
                    console.error("Did not get valid internetMessageId from server after sending message");
                }

                // Mark all chain as SENT successfuly
                msgToBeSent.setSentState.call(msgToBeSent, rxConsts.SENT_STATE.SENT);

                // Continue with the send queue
                if (data.messages) {
                    deferred.resolve();
                } else {
                    console.error("Got corrupted data from post message request (no meesages).");
                    deferred.reject();
                }

                if (repoMessages) {
                    repoMessages.forEach(function(message) {
                        if (message.attachments) {
                            message.attachments.forEach(function(attachment) {
                                repos.files.updateItemFields.call(repos.files, attachment, {
                                    originalMessage: message
                                });
                            });
                        }
                    });
                }
            }, function(err) {
                console.error('post message returned an error:', err);

                deferred.reject();
            });

            return deferred.promise;
        }

        function sendFieldsToServer(data, options) {
            data.sessionUID = sessionUID;

            options.data = JSON.stringify(data);

            return DataApi.remote(options).then(function(response) {
                return response.data;
            }, function(response) {
                console.error(response);
                throw response;
            });
        }

        function resolveContactsHandler(contactUIDs) {
            if (!contactUIDs) {
                return;
            }

            contactUIDs = Array.isArray(contactUIDs) ? contactUIDs : [contactUIDs];
            contactUIDs = contactUIDs.join(',');

            return DataApi.remote({
                url: rxApiURLs.contacts,
                method: "GET",
                query: {
                    contactUIDs: contactUIDs
                },
                params: {
                    contactUIDs: contactUIDs
                },
            }).then(function(response) {
                if (response.data && response.data.contacts) {
                    repos.contacts.addItems(response.data.contacts);
                }
            });
        }

        function createContactFolderHandler(data) {
            var options = {
                url: rxApiURLs.contactFolders,
                method: "POST"
            };

            return sendFieldsToServer(data, options).then(function(data) {
                console.debug('contact folder created', data);

                var newContactFolder = repos.contactFolders.addItem.call(repos.contactFolders, data.contactFolders, {
                    skipEventEmitting: true
                });

                repos.conversations.addItems.call(repos.conversations, data.conversations, {
                    skipChildrenFetchingAfterLink: true,
                    skipEventEmitting: true
                });

                repos.threads.addItems.call(repos.threads, data.threads, {
                    skipChildrenFetchingAfterLink: true,
                    skipEventEmitting: true
                });

                return newContactFolder;
            });
        }

        function sendFieldsToServerHandler(param) {
            sendFieldsToServer(param.payload, param.options);
        }

        function createGroupHandler(data) {
            if (!data) {
                console.error('createGroup expects a data to be defined');
                return;
            }

            data.sessionUID = sessionUID;

            var request = {
                url: rxApiURLs.redkixGroups,
                method: 'POST'
            };

            return sendFieldsToServer(data, request);
        }

        function sendMeetingResponseHandler(messageUID, userResponse) {
            return sendFieldsToServer({
                messageUID: messageUID,
                response: userResponse,
            }, {
                url: rxApiURLs.meetingResponse,
                method: "POST"
            });
        }

        function postMessage(msgData, serverRequestID) {
            if (!msgData) {
                return;
            }

            // The timeout property of the http request takes a deferred value
            // that will abort the underying AJAX request if / when the deferred
            // value is resolved.
            var deferredAbort = $q.defer(),
                dataRequestCustomDeferred;

            msgData.sessionUID = sessionUID;

            var request = {
                url: rxApiURLs.messages,
                method: 'POST',
                data: JSON.stringify(msgData),
                headers: {
                    'X-Request-ID': serverRequestID || msgData.uid
                },
                timeout: deferredAbort.promise
            };

            dataRequestCustomDeferred = DataApi.remote(request).then(function(response) {
                console.debug('^^^^ resp ', response);

                return response;
            }, function(response) {
                console.error(response);
                throw response;
            });

            // Now that we have the promise that we're going to return to the
            // calling context, let's augment it with the abort method. Since
            // the $http service uses a deferred value for the timeout, then
            // all we have to do here is resolve the value and AngularJS will
            // abort the underlying AJAX request.
            dataRequestCustomDeferred.abort = function() {
                deferredAbort.resolve();
            };

            // Since we're creating functions and passing them out of scope,
            // we're creating object references that may be hard to garbage
            // collect. As such, we can perform some clean-up once we know
            // that the requests has finished.
            dataRequestCustomDeferred.finally(
                function() {
                    dataRequestCustomDeferred.abort = angular.noop;
                    deferredAbort = dataRequestCustomDeferred = null;
                }
            );

            return dataRequestCustomDeferred;
        }

        function getSentItemsFolderUID() {
            var sentItemsFolder = repos.mailBoxFolders.getFilteredData.call(repos.mailBoxFolders, {
                propertyFilters: {
                    type: rxConsts.FOLDER_TYPE.SENT_ITEMS
                }
            });

            if (rxUtilities.isArrayNullOrEmpty(sentItemsFolder)) {
                console.error('Could not find sent items folder, go to your room kido.');
                return null;
            }

            return sentItemsFolder[0].uid;
        }

        EmitterService.on(EmitterService.uiEvents.sendFieldsToServer, sendFieldsToServerHandler); // TODO: remove this pairing from repo
    }
]);