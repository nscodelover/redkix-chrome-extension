// Redkix realtime event listener and manager service. initialized in Redkix Controller
'use strict';

angular.module('redKixServices').factory('$rxRealTimeManager', ['$rootScope', '$rxRepoService', '$rxRT', '$rxEv', '$redKixActiveUserService', '$timeout', '$filter', '$q', '$rxModelService', '$rxOutbound', '$rxUtilities', '$rxConfig', '$log',
    function($rootScope, RepoService, RealTime, EmitterService, ActiveUser, $timeout, $filter, $q, ModelService, rxOutbound, rxUtilities, rxConfig, $log) {
        if (!ActiveUser.get) return {};

        function manager() {
            var self = this,
                moveQueue = {},
                activeUser = ActiveUser.get(),
                rxConsts = rxConfig.consts,
                repos = RepoService.getAllRepos(),
                isRedkixFocused = true;

            this.initialize = initialize;
            this.dispose = dispose;
            this.addToMoveQueue = addToMoveQueue;

            function initialize(params) {
                if (!params) {
                    //Realtime event listeners//
                    self.rTEvents = [
                        //     eventName: 'CONVERSATION_MOVED',
                        //     handler: deprecatedEvent //deprecated handler:conversationMoved
                        // }, {
                        //     eventName: 'FOLDER_CREATED',
                        //     handler: deprecatedEvent //deprecated handler:folderCreated
                        // }, {
                        //     eventName: 'FOLDER_MODIFIED',
                        //     handler: deprecatedEvent //deprecated handler:folderModified
                        // }, {
                        //     eventName: 'FOLDER_MOVED',
                        //     handler: deprecatedEvent //deprecated handler:folderMoved
                        // }, {
                        //     eventName: 'ITEM_CREATED',
                        //     handler: deprecatedEvent //deprecated handler:itemCreated
                        // }, {
                        //     eventName: 'ITEM_MODIFIED',
                        //     handler: deprecatedEvent //deprecated handler:itemModified
                        // },
                        {
                            eventName: 'ENTITY_CREATED',
                            handler: entityCreated
                        }, {
                            eventName: 'ENTITY_MODIFIED',
                            handler: entityModified
                        }, {
                            eventName: 'ENTITY_DELETED',
                            handler: entityDeleted
                        }, {
                            eventName: 'ENTITY_MOVED',
                            handler: entityMoved
                        }, {
                            eventName: 'MESSAGE_RECEIVED',
                            handler: messageCreated
                        }
                    ];
                    ////////////////////////////
                    for (var i = 0; i < self.rTEvents.length; i++) {
                        RealTime.on(RealTime.events[self.rTEvents[i].eventName], self.rTEvents[i].handler);
                    };
                    ///////// Rx Events
                    EmitterService.on(EmitterService.uiEvents.AddDiscussionToMoveQueue, addToMoveQueue);
                }
            }

            function deprecatedEvent(data) {
                console.error('Deprecated event received: ', data);
            }

            function dispose() {
                for (var i = 0; i < self.rTEvents.length; i++) {
                    RealTime.off(RealTime.events[self.rTEvents[i].eventName], self.rTEvents[i].handler)
                }

                EmitterService.off(EmitterService.uiEvents.AddDiscussionToMoveQueue, addToMoveQueue);

                RealTime.disconnect();
            }

            function addToMoveQueue(param) {
                angular.forEach(param.moveQueue.entities, function(entity) {
                    var item = repos[param.moveQueue.entityType].getItem(entity);

                    if (item) {
                        var targetFolder = param.moveQueue.targetFolder,
                            sourceFolder = param.moveQueue.sourceFolder;

                        rxOutbound.sendFieldsToServer(param.moveExternal, {
                            url: repos[param.moveQueue.entityType].registeredAPIs[param.moveExternal.paramName].url,
                            method: repos[param.moveQueue.entityType].registeredAPIs[param.moveExternal.paramName].method,
                        });

                        // We currently don't move items from contact folders by design, so we're just sending the move payload to the server without actually moving it.
                        if (!sourceFolder.isContactFolder()) {
                            if (item.isConversationObject()) {
                                // Move conversation logics
                                // Link conversation to its new parent
                                ModelService.link(item, targetFolder, {
                                    skipChildrenFetchingAfterLink: true
                                });

                                // Unlink conversation from its old parent
                                ModelService.unlink(item, sourceFolder, {
                                    skipChildrenFetchingAfterLink: true
                                });
                            } else {
                                // Move thread logics
                                // Check if the thread already has a parent conversation in the target folder
                                var parentEntityInTargetFolder = item.getConversationInFolder(targetFolder);

                                if (!parentEntityInTargetFolder) {
                                    // If it doesn't have, we deliberately create it
                                    // Convert the moved thread to a conversation object
                                    parentEntityInTargetFolder = item.toParentJSON(item.parents[0].uid);

                                    // Set the temporary conversation folderUID to the target folder
                                    parentEntityInTargetFolder.folderUID = targetFolder.uid;

                                    // Add it to the conversations repo so it'll pop up in the folder when navigating to it
                                    parentEntityInTargetFolder = repos[param.moveQueue.parentEntityType].addItem(parentEntityInTargetFolder);
                                }

                                var movedThreadIndex = -1;

                                // Find thread index inside the parent conversation
                                $filter('orderBy')(param.moveQueue.parentEntity.children, 'lastActivityDate', true).forEach(function(thread, index) {
                                    if (movedThreadIndex === -1 && thread.uid === item.uid) {
                                        movedThreadIndex = index;
                                    }
                                });

                                // Link the moved thread to its target parent conversation
                                ModelService.link(item, parentEntityInTargetFolder, {
                                    skipChildrenFetchingAfterLink: true
                                });

                                // Unlink thread from its parent conversation
                                ModelService.unlink(item, param.moveQueue.parentEntity, {
                                    skipChildrenFetchingAfterLink: true
                                });

                                EmitterService.invoke(EmitterService.uiEvents.postThreadMoveAction, {
                                    movedThread: item,
                                    parentConversation: parentEntityInTargetFolder,
                                    movedThreadIndex: movedThreadIndex
                                });
                            }

                        }
                    } else {
                        console.error('Cannot find repo item of type:', param.moveQueue.entityType, ' to move:', entity);
                    }
                });
            }

            ///////////// RTM handlers
            function entityCreated(data) {
                switch (data.entityType) {
                    case 'contact':
                    case 'message':
                    case 'thread':
                    case 'conversation':
                    case 'file':
                        messageCreated(data, {
                            skipNotification: true
                        });
                        break;
                    case 'folder':
                        folderCreatedHandler(data);
                        break;
                    default:
                        console.error("Unsupported entityType in entityCreated");
                }
            }

            function entityDeleted(data) {
                var relevantRepo;

                switch (data.entityType) {
                    case 'message':
                        relevantRepo = repos.messages;
                }

                if (!relevantRepo) {
                    //console.error('deleted entity type is not supported, aborting');
                    return;
                }

                data.entities.forEach(function(deletionObject) {
                    var objectToDelete = relevantRepo.getItem.call(relevantRepo, deletionObject);

                    if (objectToDelete) {
                        // Link deleted object from its parents
                        ModelService.unlinkAllParents.call(ModelService, objectToDelete, {
                            skipChildrenFetchingAfterLink: true
                        });

                        relevantRepo.removeItem(objectToDelete);
                    } else {
                        console.warn('Deleted entity was not found', deletionObject.uid, ' - probably it was not there before');
                    }
                });
            }

            function entityModified(data) {

                // There's a situation where a thread is being moved to other folder and what we usually do is create the suitable folder under the target folder,
                // In order to support offline mode and don't wait for server response anyway.
                // The real problem happens when a user moves a conversation and another connected device of his get's the entity modified notification for a conversation that he doesn't really have.
                // In that case, we will deliberately fetch this conversation from the server in order to complete this event handling.
                if (data.entityType === 'conversation') {
                    // filter out missing items and update only the existing ones
                    fetchMissingItemsIfNecessary(data.entities);
                }

                for (var i = 0; i < data.entities.length; i++) {
                    var entityType = data.entityType;

                    if (entityType === 'OrganizationContact') {
                        entityType = 'contact';
                    }

                    if (entityType === 'userPreferences') {
                        delete data.entities[i].uid;

                        ActiveUser.setUserPreferences(data.entities[i], true);

                        continue;
                    } else if (entityType === 'folder') {
                        entityType = (data.entities[i].folderType === 'PERSON' || data.entities[i].folderType === 'GROUP') ? 'contactFolder' : 'mailBoxFolder';
                    } else if (entityType === 'mailbox') {
                        ActiveUser.setMailBoxSettings(data.entities[i]);
                        continue;
                    } else if (entityType === 'thread') {
                        //updateExistingThreadParentsIfPossible(data.entities[i]);
                    } else if (entityType === 'conversation') {
                        data.entities[i].folderUID = rxConsts.SEARCH_FOLDER_UID;
                    }

                    repos[entityType + 's'].addItem.call(repos[entityType + 's'], data.entities[i], {
                        skipChildrenFetchingAfterLink: true,
                        realtimeModification: true,
                        skipMissingItemsAddition: true
                    });
                };
            }

            function updateExistingThreadParentsIfPossible(threads) {
                threads = Array.isArray(threads) ? threads : [threads];

                if (!rxUtilities.isArrayNullOrEmpty(threads)) {
                    threads.forEach(function(thread) {
                        var existingThread = repos.threads.getItem(thread);

                        // Here we check if there are parent that should be removed because we get the updated state of the thread's parents
                        if (existingThread) {
                            existingThread.unlinkAndRemoveParents(rxUtilities.removeIntersectionByKey(existingThread.parents, thread.conversations, 'folderUID'));
                        }
                    });
                }
            }

            function entityMoved(data) {
                if (['folder', 'conversation'].indexOf(data.entityType) === -1) {
                    console.error('There is no move handler for entity of type:', data.entityType);
                }

                var entityUIDToCurrentParentUIDs = {},
                    parentRepoName,
                    parentFieldName,
                    relevantRepo = repos[data.entityType + 's'],
                    checkPossibleFetchNecessity = false;

                switch (data.entityType) {
                    case 'conversation':
                        parentRepoName = 'mailBoxFolders';
                        parentFieldName = 'folderUID';
                        checkPossibleFetchNecessity = true;
                        break;
                    case 'folder':
                        parentRepoName = 'mailBoxFolders';
                        relevantRepo = repos.mailBoxFolders;
                        parentFieldName = 'parentFolderUID';
                        break;
                }

                if (!relevantRepo) {
                    $log.error('Unsupported moved entity type.');

                    return;
                }

                data.entities.forEach(function(entity) {
                    var entityToMove = relevantRepo.getItem(entity);

                    if (entityToMove) {
                        var parentItemFromRepo = entity[parentFieldName] ? repos[parentRepoName].getItem({
                            uid: entity[parentFieldName]
                        }) : [];

                        moveEntities(entityToMove, parentItemFromRepo);
                    }
                    /*else if (checkPossibleFetchNecessity) {
                                           // If we move a conversation which we dont have to the currently displayed folder, we need to fetch it from the server
                                           if (relevantRepo.getCurrentFilters().parentFilterValuesObject.uid === entity[parentFieldName]) {
                                               rxPrefetchService.addFetchConversationAndThreadsTask({
                                                   folderUID: entity[parentFieldName],
                                                   conversationUIDs: [entity.uid]
                                               }, true);
                                           }
                                       }*/
                });

                function moveEntities(entityToMove, newParents) {
                    // If the new parent is null it's a sub folder that was changed to a root folder, so we just remove its parents
                    if (rxUtilities.isArrayNullOrEmpty(newParents)) {
                        ModelService.unlinkAllParents(entityToMove, {
                            moveAction: true
                        });
                    } else {
                        ModelService.replaceParentLinks(entityToMove, newParents);
                    }
                }
            }

            function messageCreated(data, options) {
                var shouldGetChanges = data.isGetChanges;

                for (var i = 0; i < data.entities.length; i++) {
                    singleMessageCreator(data.entities[i], options, shouldGetChanges);
                }
            }
            ///////// manager local functions //////////
            function getMissingConversationUIDs(items) {
                var existingAndMissingItems = repos.conversations.getExistingAndMissingItems(items);

                return _.pluck(existingAndMissingItems.missing, 'uid');
            }

            // Returns missing keys
            function fetchMissingItemsIfNecessary(items) {
                var conversationUIDsGroupedByFolderUID = _.groupBy(items, 'folderUID'),
                    totalMissingItems = [],
                    missingKeys;

                // Collect missing items but don't fetch them, so they won't be added and waste cpu time because they don't belong to the current opened folder
                for (var folderUID in conversationUIDsGroupedByFolderUID) {
                    missingKeys = getMissingConversationUIDs(conversationUIDsGroupedByFolderUID[folderUID]);

                    /*if (missingKeys.length) {
                        rxPrefetchService.addFetchConversationAndThreadsTask({
                            folderUID: folderUID,
                            conversationUIDs: missingKeys
                        }, true);
                    }*/

                    totalMissingItems = totalMissingItems.concat(missingKeys);
                }

                return totalMissingItems;
            }

            // We use shouldGetChanges to determine whether we need to fetch incoming real time entities if they don't exist
            function singleMessageCreator(data, options, shouldGetChanges) {
                if (data.contacts) {
                    repos.contacts.addItems.call(repos.contacts, data.contacts);
                }

                /*if (data.threads) {
                    // Update existing threads parents so they won't just merge with the new ones
                    updateExistingThreadParentsIfPossible(data.threads);

                    repos.threads.addItems.call(repos.threads, data.threads, {
                        skipChildrenFetchingAfterLink: true,
                        realtimeModification: true
                    });
                }

                if (data.conversations) {
                    if (shouldGetChanges) {
                        // filter out missing items and update only the existing ones
                        var missingItemsKeys = fetchMissingItemsIfNecessary(data.conversations);

                        if (missingItemsKeys.length) {
                            data.conversations = $filter('filter')(data.conversations, function(conversation) {
                                return missingItemsKeys.indexOf(conversation.uid) === -1;
                            });
                        }
                    }

                    repos.conversations.addItems.call(repos.conversations, data.conversations, {
                        skipChildrenFetchingAfterLink: true,
                        realtimeModification: true
                    });
                }*/

                if (data.attachments) {
                    repos.files.addItems.call(repos.files, data.attachments, {
                        skipChildrenFetchingAfterLink: true,
                        realtimeModification: true
                    });
                }

                if (data.messages) {
                    var repoMessages = [];

                    data.messages.forEach(function(item) {
                        item.threadUID = item.threadUID ? item.threadUID : (data.activeThreadUID || null);

                        var messageExists = repos.messages.getFilteredData.call(repos.messages, {
                            parentFilterValuesObject: {
                                threadUID: item.threadUID
                            },
                            propertyFilters: {
                                internetMessageId: item.internetMessageId
                            }
                        });

                        if (messageExists.length === 0) {
                            var addedMessage = repos.messages.addItem.call(repos.messages, item, {
                                skipChildrenFetchingAfterLink: true,
                                realtimeModification: true
                            });

                            if (!options || (options && !options.skipNotification)) {
                                /// add message to conversation
                                repoMessages.push(addedMessage);
                                // popup notification
                                dispatchNotification(addedMessage);
                            }
                        }
                    });
                }
            }

            function folderCreatedHandler(data) {
                var folder, parent, relevantRepo;

                for (var i = 0; i < data.entities.length; i++) {
                    if (!rxUtilities.isArrayNullOrEmpty(data.entities[i].contacts)) {
                        repos.contacts.addItems(data.entities[i].contacts);
                    }

                    for (var j = 0; j < data.entities[i].folders.length; j++) {
                        if (data.entities[i].folders[j].folderType === rxConsts.FOLDER_TYPE.PERSON || data.entities[i].folders[j].folderType === rxConsts.FOLDER_TYPE.GROUP) {
                            relevantRepo = repos.contactFolders;
                        } else {
                            relevantRepo = repos.mailBoxFolders;
                        }

                        relevantRepo.addItems.call(relevantRepo, data.entities[i].folders[j], {
                            realtimeModification: true
                        });
                    };
                };
            }

            function dispatchNotification(message) {
                if (message && message.sender.uid && message.sender.uid !== activeUser.uid && message.bodyPreview) {
                    var notifBody = [(message.sender.getCorrectTitle(false, message.conversationUID)), ': ', message.bodyPreview].join(''),
                        threadUID = message.getParentUIDs()[0],
                        title;

                    if (message.parents[0].meetingRequest && message.parents[0].meetingRequest.meetingStart) {
                        title = "invite for " + moment(message.parents[0].meetingRequest.meetingStart).format("MMM Do") + ": " + message.parents[0].subject;
                    } else {
                        title = message.parents[0].subject;
                    }

                    if (!message.folderUID) {
                        var inboxFolder = repos.mailBoxFolders.getFilteredData({
                            propertyFilters: {
                                type: rxConsts.FOLDER_TYPE.INBOX
                            }
                        });

                        inboxFolder = inboxFolder.length !== 0 ? inboxFolder[0] : '';

                        // default to inbox if we don't get a folderUID. This is done foe the Gmail case since they don't send us a folderUid
                        message.folderUID = inboxFolder.uid;
                    }
                }
            }

            function updateFocusState(newState) {
                isRedkixFocused = newState;
            }

            // ------------- Event Listeners ------------- //
            EmitterService.on(EmitterService.uiEvents.redkixIsFocused, updateFocusState);
            // ------------------- END ------------------- //

        };

        return new manager();
    }
]);