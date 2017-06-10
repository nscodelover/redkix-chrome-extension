// Data Repo - serving models instances
'use strict';

angular.module('redKixServices').factory('$rxRepoService', ['$q', '$filter', '$rxDataApi', '$rxConfig', '$rxUtilities', '$log', '$rxEv',
    function($q, $filter, dataApi, rxConfig, rxUtilities, $log, EmitterService) {
        function serviceInstance() {
            Emitter(this);
            // Will hold all repos
            var self = this,
                repos = {},
                globalOptions = {},
                events = {
                    repoCreated: 'repo-created'
                };

            self.events = events;

            function Repo(options) {
                Emitter(this);

                var self = this,
                    repoName = options.model.name,
                    data = {},
                    registeredAPIs = options.registeredAPIs,
                    rxConsts = rxConfig.consts,
                    model = options.model,
                    parentPrimaryKeyFields = options.parentPrimaryKeyFields,
                    hasLoadMoreFunctionality = options.hasLoadMoreFunctionality || false,
                    quietRepo = options.quietRepo || false,
                    lastMetadata = {},
                    repoConfigsCache = {},
                    primaryKeyFields = options.primaryKeyFields,
                    // CONFIG OBJECT STRUCTURE - 
                    // currentRepoConfig.repoOptions = { parentUID: 'parentUID' , propertyFilters : { isRead: true, unreadCount: 1 } }  
                    currentRepoConfig = {
                        repoOptions: {}
                    },
                    events = {
                        itemsRemoved: 'collection-item-removal',
                        itemsAdded: 'collection-item-addition',
                        itemsUpdated: 'collection-item-update',
                        itemUIDReplacement: 'collection-item-uid-replacement',
                        unprocessedItems: 'unprocessed-items'
                    };

                self.parentPrimaryKeyFields = parentPrimaryKeyFields;
                self.primaryKeyFields = primaryKeyFields;
                self.registeredAPIs = registeredAPIs;
                self.Model = model;
                self.events = events;

                self.getItem = function(indexesObjectOrString) {
                    var self = this;

                    var key = indexesObjectOrString;

                    if (primaryKeyFields && !rxUtilities.isObjectNullOrEmpty(indexesObjectOrString)) {
                        key = buildItemKey(indexesObjectOrString);
                    }

                    return data[key];
                };

                self.getItems = function(indexesObjectsOrStringsArray) {
                    var self = this,
                        _items = [],
                        _tempItem;

                    indexesObjectsOrStringsArray = Array.isArray(indexesObjectsOrStringsArray) ? indexesObjectsOrStringsArray : [indexesObjectsOrStringsArray];

                    if (rxUtilities.isArrayNullOrEmpty(indexesObjectsOrStringsArray)) {
                        return _items;
                    }

                    indexesObjectsOrStringsArray.forEach(function(indexesObjectOrString) {
                        _tempItem = self.getItem(indexesObjectOrString);

                        if (_tempItem) {
                            _items.push(_tempItem);
                        }
                    });

                    return _items;
                };

                self.getExistingAndMissingItems = function(indexesObjectsOrStringsArray) {
                    var self = this,
                        existingAndMissingItemsObject = {
                            existing: [],
                            missing: []
                        },
                        _tempItem;

                    indexesObjectsOrStringsArray = Array.isArray(indexesObjectsOrStringsArray) ? indexesObjectsOrStringsArray : [indexesObjectsOrStringsArray];

                    if (rxUtilities.isArrayNullOrEmpty(indexesObjectsOrStringsArray)) {
                        return existingAndMissingItemsObject;
                    }

                    indexesObjectsOrStringsArray.forEach(function(indexesObjectOrString) {
                        _tempItem = self.getItem(indexesObjectOrString);

                        if (_tempItem) {
                            existingAndMissingItemsObject.existing.push(_tempItem);
                        } else {
                            existingAndMissingItemsObject.missing.push(indexesObjectOrString);
                        }
                    });

                    return existingAndMissingItemsObject;
                };

                self.getItemsIndexObject = function(indexesObjectsOrStringsArray) {
                    var self = this,
                        items = self.getItems(indexesObjectsOrStringsArray),
                        itemsIndexObjectsArr = [];

                    items.forEach(function(item) {
                        itemsIndexObjectsArr.push(self.getItemIndexObject(item));
                    });

                    return itemsIndexObjectsArr;
                };

                self.getItemIndexObject = function(item) {
                    var indexObject = {};

                    for (var indexField in primaryKeyFields) {
                        if (item[indexField]) {
                            indexObject[indexField] = item[indexField];
                        }
                    }

                    return indexObject;
                };

                self.getAllDbKeys = function() {
                    if (!data) {
                        return [];
                    }

                    var allKeys = Object.keys(data);

                    return allKeys;
                };

                self.addItem = function(item, options) {
                    var self = this;

                    if (!item) {
                        return null;
                    }

                    options = options || {};

                    // Calling updateItem whether the item is modeled or not (updateItem will handle it)
                    var repoItem = self.getItem(item);

                    if (repoItem) {
                        if (options.skipItemUpdate && !repoItem.isPlaceholderObject()) {
                            return options.includeSkippedItems ? repoItem : null;
                        }

                        return updateItem.call(self, item, options);
                    }

                    // If it's a real time ENTITY_MODIFIED object and it doesn't exist, we won't create it cuz it contains thin data
                    if (options.realtimeModification && options.skipMissingItemsAddition) {
                        return null;
                    }

                    // Check if item is a model before adding
                    var addedItem = add.call(self, item, options);

                    // TODO: make sure it can be added
                    if (!options.skipEventEmitting && addedItem) {
                        emitEventIfNecessary.call(self, events.itemsAdded, addedItem);
                    }

                    // Suppose to be single item always
                    if (addedItem.length === 1) {
                        return addedItem[0];
                    }

                    $log.error('Something very weird happend in the repo, returning more than one item from addItem function', item, addedItem);

                    return addedItem;
                };

                self.addItems = function(items, options) {
                    var self = this;

                    items = Array.isArray(items) ? items : [items];

                    if (rxUtilities.isArrayNullOrEmpty(items)) {
                        return null;
                    }

                    options = options || {};

                    //$log.debug('Repo addItems called with', repoName, items, options);

                    var addedItems = [],
                        newItem;

                    items.forEach(function(item) {
                        newItem = self.addItem.call(self, item, {
                            // We explicitly send it as true because we want to emit the event after adding all the items
                            skipEventEmitting: true,
                            skipChildrenFetchingAfterLink: options.skipChildrenFetchingAfterLink,
                            skipItemUpdate: options.skipItemUpdate,
                            includeSkippedItems: options.includeSkippedItems,
                            realtimeModification: options.realtimeModification,
                            fromAddItemsFunction: true
                        });

                        if (newItem) {
                            addedItems.push(newItem);
                        }
                    });

                    if (!quietRepo && !options.skipEventEmitting && addedItems) {
                        emitEventIfNecessary.call(self, events.itemsAdded, addedItems);
                    }

                    if (addedItems && options.customFilters) {
                        return runThroughFilters.call(self, addedItems, options.customFilters);
                    }

                    return addedItems;
                };

                self.removeItem = function(item, skipEventEmitting) {
                    var self = this;

                    var itemToDelete = self.getItem(item);

                    if (itemToDelete) {
                        if (!skipEventEmitting) {
                            emitEventIfNecessary.call(self, events.itemsRemoved, [itemToDelete]);
                        }

                        //$log.debug('found item and deleted', itemToDelete);

                        delete data[itemToDelete.$key];
                    } else {
                        //$log.debug('could not find item to delete ' + item);
                    }
                };


                self.removeItems = function(items) {
                    var self = this;

                    items = Array.isArray(items) ? items : [items];

                    if (rxUtilities.isArrayNullOrEmpty(items)) {
                        return;
                    }

                    emitEventIfNecessary.call(self, events.itemsRemoved, items);

                    items.forEach(function(item) {
                        self.removeItem.call(self, item, true);
                    });
                };

                self.hasData = function() {
                    return self.getAllDbKeys().length > 0;
                };

                self.getCurrentRepoConfig = function() {
                    var self = this;

                    return currentRepoConfig || {};
                };

                // self.setCurrentRepoConfig = function(repoOptions) {
                //     var self = this;

                //     currentRepoConfig = repoOptions || {};
                // };

                self.getCurrentFilters = function() {
                    var self = this;

                    var filters = angular.copy(currentRepoConfig.repoOptions || {});

                    if (filters.query) {
                        filters.parentUID = rxConsts.SEARCH_FOLDER_UID;
                    }

                    return filters;
                };

                self.setCurrentFilters = function(filters) {
                    var self = this;

                    currentRepoConfig.repoOptions = filters || currentRepoConfig.repoOptions || {};
                };

                // OPTIONS STRUCTURE
                // {
                //     notifyServer: true || false,
                //     fieldsToMerge: ['participants', 'participantsActivity'],
                //     mergeDefaultFields: true || false
                // }
                self.updateItemFields = function(item, properties, optionz) {
                    var self = this,
                        itemToUpdate = self.getItem(item),
                        options = optionz || {};

                    if (!itemToUpdate) {
                        console.warn('this is absolutely RUDE! - calling updateItemFields with a uid that doesnt even exist!', item.uid);
                        return;
                    }

                    //$log.debug('updating fields in the item ', itemToUpdate, ' with ', properties, ' options ', options);

                    extendItemAndEmitCorrectEvent.call(self, itemToUpdate, properties, options);

                    if (options.notifyServer) {
                        var apiRequest = buildApiURLPayload.call(self, itemToUpdate, properties);

                        if (!apiRequest) {
                            console.warn('Could not find property relevant api url, aborting');
                            return;
                        }

                        // TODO: this is temporary, next line needs to be here in some variance, after unpairing repo from outbound.
                        EmitterService.invoke(EmitterService.uiEvents.sendFieldsToServer, apiRequest);
                        // sendFieldsToServer(apiRequest.payload, apiRequest.options);
                    }
                };

                // OPTIONS STRUCTURE
                // {
                //     notifyServer: true || false,
                //     notifyServerOnly: true || false,
                //     fieldsToMerge: ['participants', 'participantsActivity'],
                //     mergeDefaultFields: true || false
                // }
                self.updateItemsFields = function(items, properties, optionz) {
                    var self = this,
                        options = optionz || {},
                        optionsWithoutNotifyServer = angular.copy(options);

                    items = Array.isArray(items) ? items : [items];

                    items.filter(function(item) {
                        if (!self.getItem(item)) {
                            console.warn('this is absolutely RUDE! - calling updateItemFields with a uid that doesnt even exist!', item);
                            return false;
                        }

                        return true;
                    });

                    //$log.debug('updating fields in the items ', items, 'with ', properties, ' options ', options);

                    if (!options.notifyServerOnly) {
                        optionsWithoutNotifyServer.notifyServer = false;

                        items.forEach(function(item) {
                            self.updateItemFields.call(self, item, properties, optionsWithoutNotifyServer);
                        });
                    }

                    if (options.notifyServer || options.notifyServerOnly) {
                        var apiRequest = buildApiURLPayload.call(self, items, properties);

                        if (!apiRequest) {
                            console.warn('Could not find property relevant api url, aborting');
                            return;
                        }

                        // TODO: this is temporary, next line needs to be here in some variance, after unpairing repo from outbound.
                        EmitterService.invoke(EmitterService.uiEvents.sendFieldsToServer, apiRequest);
                        // sendFieldsToServer(apiRequest.payload, apiRequest.options);
                    }
                };

                // this function replaces an item's uid,
                self.replaceItemUID = function(oldIndexesObjectOrString, newIndexesObjectOrString) {
                    var self = this,
                        oldItem = self.getItem(oldIndexesObjectOrString),
                        newItem = self.getItem(newIndexesObjectOrString),
                        oldItemKey = oldItem.$key,
                        newItemKey = newItem ? newItem.$key : buildItemKey(newIndexesObjectOrString);

                    // it does self for a uid that most likely we created on client, and exchanges it with a uid that the server gave
                    if (!newItem && oldItem && oldItemKey !== newItemKey) {
                        Object.defineProperty(data, newItemKey,
                            Object.getOwnPropertyDescriptor(data, oldItemKey));

                        data[newItemKey].$key = newItemKey;
                        data[newItemKey].uid = newIndexesObjectOrString.uid;

                        delete data[oldItemKey];

                        //$log.debug('replaced old item key', oldItemKey, ' with new one', newItemKey, ' and new item uid', newIndexesObjectOrString.uid);

                        emitEventIfNecessary.call(self, events.itemUIDReplacement, {
                            uid: newIndexesObjectOrString.uid
                        }, true);
                    } else if (newItem && oldItem) {
                        // If the user created a new thread with someone he already has one, we notify the controller to delete the old thread we've created
                        //$log.debug('replaced old item key', oldItemKey, ' with existing one', newItemKey);

                        emitEventIfNecessary.call(self, events.itemsRemoved, oldItem, true);
                    }
                };

                self.loadMore = function(requestOptions) {
                    var self = this,
                        {
                            url,
                            repoOptions
                        } = requestOptions;

                    if (!url.url) {
                        $log.error('No url specified for fetching more data, are you drunk?');
                        return;
                    }

                    if (!hasLoadMoreFunctionality) {
                        $log.error('This repo does not has load more functionality. You should go see a doctor');
                        return;
                    }

                    url = url.url;

                    var query = {},
                        parentFilterValuesObject = self.getCurrentFilters().parentFilterValuesObject;

                    if (parentPrimaryKeyFields) {
                        query.folderUID = parentFilterValuesObject[parentPrimaryKeyFields[0]];
                    }

                    if (!query.folderUID) {
                        $log.error('No folderUID specified for fetching more data, aborting.');
                        return;
                    }

                    if (!rxUtilities.isObjectNullOrEmpty(parentFilterValuesObject) && !rxUtilities.isEmptyObject(lastMetadata) && lastMetadata[parentFilterValuesObject[parentPrimaryKeyFields[0]]]) {
                        query.startEvaluatedKey = lastMetadata[parentFilterValuesObject[parentPrimaryKeyFields[0]]].lastEvaluatedKey;
                    }

                    if (requestOptions.query && requestOptions.query.query) {
                        query.query = requestOptions.query.query;
                    }

                    return queryData.call(self, url, query, repoOptions);
                };

                self.hasMore = function() {
                    var self = this,
                        parentFilterValuesObject = self.getCurrentFilters().parentFilterValuesObject;

                    if (!hasLoadMoreFunctionality) {
                        $log.error('This repo does not has load more functionality. You should go see a doctor');
                        return false;
                    }

                    var parentFilterValue = !rxUtilities.isObjectNullOrEmpty(parentFilterValuesObject) ? parentFilterValuesObject[parentPrimaryKeyFields[0]] : null;
                    var relevantLastMetaDataObject = parentFilterValue && !rxUtilities.isEmptyObject(lastMetadata) ? lastMetadata[parentFilterValue] : {};
                    var hasLastEvaluatedKey = !rxUtilities.isObjectNullOrEmpty(relevantLastMetaDataObject) ? relevantLastMetaDataObject.lastEvaluatedKey : false;

                    return hasLastEvaluatedKey;
                };

                // TODO: Move to outbound service
                self.remove = function(what) {
                    var self = this;

                    $log.error('Remove looks like shit, implement self function.');

                    if (!self.getItem(what)) {
                        return 'cannot delete';
                    }

                    var options = {
                        url: url,
                        method: 'DELETE',
                        params: what
                    };

                    return dataApi.remote(options).then(function(response) {
                        //$log.debug('deleted:', what);

                        delete data[buildItemKey(what)];

                        self.emit(events.itemsRemoved);
                    }, function(response) {
                        $log.error(response);

                        throw response;
                    });

                };

                self.getRemoteData = function(requestOptions) {
                    var self = this,
                        {
                            url,
                            query,
                            repoOptions
                        } = requestOptions;

                    //$log.debug('repo get remote data called', url, query, repoOptions);

                    if (!url.url) {
                        $log.error('Called remote data without url, are you drunk? aborting request.');
                        return null;
                    }

                    url = url.url;

                    repoConfigsCache[url] = repoConfigsCache[url] || {};
                    repoConfigsCache[url].repoOptions = repoOptions || repoConfigsCache[url].repoOptions || {};

                    if (!rxUtilities.isObjectNullOrEmpty(repoConfigsCache[url].repoOptions)) {
                        currentRepoConfig.repoOptions = !rxUtilities.isObjectNullOrEmpty(currentRepoConfig.repoOptions) ?
                            angular.merge(currentRepoConfig.repoOptions, repoConfigsCache[url].repoOptions) : repoConfigsCache[url].repoOptions;
                    }

                    return queryData.call(self, url, query);
                };


                self.getAllData = function() {
                    var self = this;

                    return toArray.call(self, data);
                };

                self.getFilteredData = function(filters) {
                    var self = this;

                    if (rxUtilities.isObjectNullOrEmpty(data)) {
                        return [];
                    } else if (rxUtilities.isObjectNullOrEmpty(filters)) {
                        return getDataForView.call(self);
                    }

                    return runAllDataThroughFilters.call(self, filters);
                };

                self.setRepos = function(repos) {
                    var self = this;

                    self.repos = repos;
                };

                self.updateItemsLastFetchTime = function(data) {
                    var self = this,
                        itemsToUpdateLastTimeFetch = [];

                    if (data.folderUID && data.conversationUIDs) {
                        var conversationKeys = [];

                        if (data.conversationUIDs.indexOf(',') > -1) {
                            data.conversationUIDs = data.conversationUIDs.split(',');
                        }

                        data.conversationUIDs = Array.isArray(data.conversationUIDs) ? data.conversationUIDs : [data.conversationUIDs];

                        data.conversationUIDs.forEach(function(convUID) {
                            conversationKeys.push({
                                uid: convUID,
                                folderUID: data.folderUID
                            });
                        });

                        itemsToUpdateLastTimeFetch = self.repos.conversations.getItems(conversationKeys);
                    } else if (data.folderUID) {
                        var folderItem = self.repos.mailBoxFolders.getItem(data.folderUID);

                        itemsToUpdateLastTimeFetch = folderItem ? [folderItem] : [];
                    } else if (data.threadUIDs) {
                        if (data.threadUIDs.indexOf(',') > -1) {
                            data.threadUIDs = data.threadUIDs.split(',');
                        }

                        data.threadUIDs = Array.isArray(data.threadUIDs) ? data.threadUIDs : [data.threadUIDs];

                        itemsToUpdateLastTimeFetch = self.repos.threads.getItems(data.threadUIDs);
                    }

                    var timeNow = moment().format();

                    itemsToUpdateLastTimeFetch.forEach(function(item) {
                        item.$lastTimeFetched = timeNow;
                    });
                };

                self.clearAllItems = function() {
                    data = {};
                }

                function buildItemKey(item) {
                    if (item.$key) {
                        return item.$key;
                    } else if (!rxUtilities.isArrayNullOrEmpty(primaryKeyFields) && primaryKeyFields.length > 1) {
                        // We don't want to hash the indexes if they contain only one field - that's stupid.
                        var preHash = [];
                        // concat all values that produce the key
                        for (var i = 0; i < primaryKeyFields.length; i++) {
                            if (item.hasOwnProperty(primaryKeyFields[i])) {
                                preHash.push(item[primaryKeyFields[i]]);
                            }
                        }

                        return CryptoJS.MD5(preHash.join()).toString();
                    } else {
                        return item.hasOwnProperty('uid') ? item.uid : item;
                    }
                }

                function isFilteredRepo() {
                    return (currentRepoConfig.repoOptions && !rxUtilities.isObjectNullOrEmpty(currentRepoConfig.repoOptions.parentFilterValuesObject));
                }

                function add(what, options) {
                    var self = this;

                    if (!what) {
                        return;
                    }

                    var item, addedItems = [],
                        existingItem;
                    // var localDB = localManage ? getLocalDB() : null;

                    options = options || {};

                    if (!Array.isArray(what)) {
                        what = [what];
                    }

                    for (var i = 0; i < what.length; i++) {
                        // Not suppose to happen - if it was already exists we were calling updateItem with self item
                        existingItem = self.getItem(what[i]);

                        if (existingItem) {
                            $log.error('The Repo is trying to add an existing item, you should have called updateItem instead kido ', existingItem);

                            addedItems.push(what[i]);

                            continue;
                        }

                        // $scope.newMessage is already a model when calling addItem (known issue)                        
                        item = (what[i] instanceof model) ? what[i] : new model(what[i]);

                        var key = buildItemKey(item);

                        item.$key = key;

                        // CHANGING UID TO OUR OWN INTERNAL UID
                        // item.uid = key;

                        if (key) {
                            data[key] = item;
                        } else {
                            $log.error('Could not create item key ', key, what, repoName);
                        }

                        addedItems.push(item);
                    }

                    addedItems.forEach(function(newItem) {
                        if (newItem.postAdditionCallback) {
                            newItem.postAdditionCallback.call(newItem, options);
                        }
                    });

                    return addedItems;
                }

                function updateItem(item, options) {
                    var self = this;

                    var itemToUpdate = self.getItem(item),
                        newItem = null,
                        callPostAdditionCallback = false;

                    if (item === itemToUpdate) {
                        return itemToUpdate;
                    }

                    options = options || {};

                    //$log.debug('item to update is', itemToUpdate, ' with ', item);

                    if (!(item instanceof model)) {
                        newItem = new model(item, {
                            ignoreUserProperties: true
                        });
                    }

                    item = newItem || item;

                    //$log.debug('calling extendItemAndEmitCorrectEvent with', itemToUpdate, item);

                    if ((itemToUpdate.isPlaceholderObject && itemToUpdate.isPlaceholderObject()) || (parentPrimaryKeyFields && itemToUpdate.parents.length < item.unfetchedParents.length)) {
                        callPostAdditionCallback = true;
                    } else if (!options.realtimeModification && item.lastActivityDate && itemToUpdate.lastActivityDate === item.lastActivityDate) {
                        // If last activity date hasn't changed, no update is needed                    
                        //$log.debug('items last activity date hasnt changed, aborting update ', item.uid);
                        return null;
                    }

                    // If callPostAdditionCallback is true, we don't need to emit event when calling extenItemAndEmitCorrectEvent function, because during the postAdditionCallback
                    // function, the conversation is linking with new parent(s) - an action which emits event to the controllers anyway. So we just want to prevent the same event from being emitted twice.
                    // fromAddItemsFunction flag flows from addItems -> addItems -> updateItem (this function) so the event emitting will wait until adding all the items.
                    if (!callPostAdditionCallback && options.fromAddItemsFunction && options.skipEventEmitting) {
                        options.skipEventEmitting = false;
                    }

                    extendItemAndEmitCorrectEvent.call(self, itemToUpdate, item, {
                        mergeDefaultFields: true,
                        skipEventEmitting: callPostAdditionCallback || options.skipEventEmitting
                    });

                    if (callPostAdditionCallback && itemToUpdate.postAdditionCallback) {
                        itemToUpdate.postAdditionCallback.call(itemToUpdate, {
                            skipEventEmitting: options.skipEventEmitting,
                            skipChildrenFetchingAfterLink: true
                        });
                    }

                    return itemToUpdate;
                }

                // OPTIONS STRUCTURE
                // {
                //     notifyServer: true || false,
                //     fieldsToMerge: ['participants', 'participantsActivity'],
                //     mergeDefaultFields: true || false
                // }
                function safeExtend(dst, src, options) {
                    var self = this;

                    var safeExtendOptions = angular.copy(options) || {};

                    removeNull(src, ['children', 'parents']);

                    safeExtendOptions.fieldsToMerge = safeExtendOptions.fieldsToMerge || [];

                    // Preserve old parents and children of dst  
                    if (safeExtendOptions.mergeDefaultFields) {
                        safeExtendOptions.fieldsToMerge = safeExtendOptions.fieldsToMerge.concat(['children', 'parents']);
                    }

                    var mergeObjects = [];

                    safeExtendOptions.fieldsToMerge.forEach(function(fieldToMerge) {
                        // Create merge object only if self property appears in both src and dst
                        if (valueOrNull(src[fieldToMerge]) && valueOrNull(dst[fieldToMerge])) {
                            mergeObjects.push({
                                field: fieldToMerge,
                                src: src[fieldToMerge],
                                dst: dst[fieldToMerge]
                            });
                        }
                    });

                    // We explicitly shallow copy the dst item's fields here
                    angular.extend(dst, src);

                    mergeObjects.forEach(function(mergeObject) {
                        dst[mergeObject.field] = rxUtilities.arrayUnique(mergeObject.src.concat(mergeObject.dst));
                    });

                    function removeNullIn(prop, obj) {
                        var pr = obj[prop];
                        if (pr === null || pr === undefined || typeof(pr) === "function" || (typeof(pr) === "object" && rxUtilities.isEmptyObject(pr)) || Array.isArray(pr) && pr.length === 0) {
                            delete obj[prop];
                        }
                    }

                    function removeNull(obj, ignoreProperties) {
                        for (var i in obj) {
                            if (ignoreProperties.indexOf(i) > -1) continue;
                            removeNullIn(i, obj);
                        }
                    }
                }

                /*Check if properties1 has the same values like properties2 */
                function hasSamePropertiesValue(properties1, properties2) {
                    for (var property in properties1) {
                        if (properties1.hasOwnProperty(property)) {
                            if (properties1[property] !== properties2[property]) return false;
                        }
                    }

                    return true;
                }

                function extendItemAndEmitCorrectEvent(itemToUpdate, properties, optionz) {
                    var self = this,
                        options = optionz || {};

                    if (quietRepo) {
                        if (!hasSamePropertiesValue(properties, itemToUpdate)) {
                            safeExtend.call(self, itemToUpdate, properties, options);
                            emitEventIfNecessary.call(self, events.itemsUpdated, itemToUpdate, true);
                        }

                        return;
                    }

                    var passedFiltersBeforeUpdate = !options.skipEventEmitting ?
                        !rxUtilities.isArrayNullOrEmpty(runThroughFilters.call(self, itemToUpdate)) : null,
                        passedFiltersAfterUpdate;

                    safeExtend.call(self, itemToUpdate, properties, options);

                    // Remove these fields so they wont continue to the post update callback
                    options.fieldsToMerge = null;
                    options.mergeDefaultFields = null;

                    if (options && options.callPostUpdateCallback) {
                        var postUpdateOptions = {};

                        angular.copy(options, postUpdateOptions);

                        // We remove it to avoid circular function call after calling the callback                        
                        postUpdateOptions.callPostUpdateCallback = false;
                        // We used this options to prevent emitting the event after postAdditionCallback, but now we want it to happen after calling postUpdateCallback
                        postUpdateOptions.skipEventEmitting = false;
                        // This param doesn't need to continue to postUpdateCallback (cuz it doesnt update parents nor children)
                        postUpdateOptions.moveAction = false;

                        itemToUpdate.postChildrenUpdateCallback.call(itemToUpdate, postUpdateOptions);
                    }

                    if (options.moveAction && !options.skipEventEmitting && !quietRepo) {
                        // If we got here it's surely a moveAction coming from addParents function (cuz addChildren function sents skipEventEmitting param)
                        // This statement is only for unfiltered repos (e.g folders..and contacts but it's a quiet repo), cuz if it doesn't have filters
                        // It wont recognize any change and then we'll invoke itemUpdated every time we move an item, instead of remove \ add.
                        // Now we just need to check if it's the before or after move action - and emit the correct event.
                        var correctEventToEmit = !isFilteredRepo() ? events.itemsUpdated : ((properties.parents && properties.parents.length === 0) ? events.itemsRemoved : events.itemsAdded);

                        emitEventIfNecessary.call(self, correctEventToEmit, itemToUpdate, true);
                    } else if (!options.skipEventEmitting && !quietRepo) {
                        passedFiltersAfterUpdate = !rxUtilities.isArrayNullOrEmpty(runThroughFilters.call(self, itemToUpdate));

                        // We check if the the item before the update passed the filters and after the update it didn't, and vice versa
                        if (passedFiltersBeforeUpdate !== passedFiltersAfterUpdate) {
                            // We check if the item passed filters before update and now it doesnt, which means it was removed. Otherwise we assume it was added
                            if (passedFiltersBeforeUpdate) {
                                emitEventIfNecessary.call(self, events.itemsRemoved, itemToUpdate, true);
                            } else {
                                emitEventIfNecessary.call(self, events.itemsAdded, itemToUpdate, true);
                            }
                        } else if (passedFiltersBeforeUpdate) {
                            // Sending true because the data is already filtered
                            emitEventIfNecessary.call(self, events.itemsUpdated, itemToUpdate, true);
                        }
                    }
                }

                // TODO: Maybe build payloads for move actions
                // TODO: Implement read unread for threads (threadsUIDs)
                function buildApiURLPayload(items, properties) {
                    var self = this;
                    // In case of a single item
                    items = Array.isArray(items) ? items : [items];

                    var itemUIDs = items.map(function(item) {
                        return item.mailBoxAddress || item.uid;
                    });

                    if (properties.hasOwnProperty('isRead')) {
                        var relevantURLParam = registeredAPIs.readUnread;
                        return {
                            options: {
                                url: relevantURLParam.url,
                                method: relevantURLParam.method
                            },
                            payload: {
                                isRead: properties.isRead,
                                messagesUIDs: itemUIDs
                            }
                        }
                    } else if (properties.hasOwnProperty('unreadCount')) {
                        if (itemUIDs.length === 0) {
                            $log.error("buildApiURLPayload for thread without any item!!!");
                            return;
                        }

                        var relevantURLParam = registeredAPIs.readUnread;

                        return {
                            options: {
                                url: relevantURLParam.url,
                                method: relevantURLParam.method
                            },
                            payload: {
                                isRead: properties.unreadCount === 0,
                                threadUID: itemUIDs[0]
                            }
                        }
                    } else if (properties.hasOwnProperty('avatarURL')) {
                        var relevantURLParam = registeredAPIs.avatarURL;
                        return {
                            options: {
                                url: relevantURLParam.url,
                                method: relevantURLParam.method
                            },
                            payload: {
                                entityUIDs: itemUIDs,
                                entityType: "OrganizationContact",
                                properties: properties
                            }
                        }
                    } else if (properties.hasOwnProperty('isPinned')) {
                        var relevantURLParam = registeredAPIs.contactFoldersPUT;

                        properties.contactFolderUID = itemUIDs[0];

                        return {
                            options: {
                                url: relevantURLParam.url,
                                method: relevantURLParam.method
                            },
                            payload: properties
                        }
                    }

                    return null;
                }

                function valueOrNull(value, nullValue) {
                    return (value !== undefined) ? value : (nullValue !== undefined ? nullValue : null);
                }

                function toArray(obj) {
                    var self = this;

                    var arr = rxUtilities.objectToArray(obj);

                    return arr;
                }

                function runAllDataThroughFilters(filters) {
                    var self = this;

                    return runThroughFilters.call(self, null, filters);
                }

                function runThroughFilters(items, filters) {
                    var self = this;

                    if (!items) {
                        items = toArray.call(self, data);
                    } else {
                        // Safety check if it's a single item
                        items = Array.isArray(items) ? items : [items];
                    }

                    var parentFilterValuesObject = currentRepoConfig.repoOptions.parentFilterValuesObject || {},
                        chosenFilters = currentRepoConfig.repoOptions.propertyFilters;

                    if (!rxUtilities.isArrayNullOrEmpty(parentPrimaryKeyFields) && rxUtilities.isObjectNullOrEmpty(parentFilterValuesObject)) {
                        //$log.debug('no parentFilterValuesObject specified although there is a parentPrimaryKeyFields array for this repo', repoName);

                        return [];
                    }

                    items = items.filter(function(item) {
                        return !item.isPlaceholderObject();
                    });

                    if (rxUtilities.isObjectNullOrEmpty(filters) && rxUtilities.isObjectNullOrEmpty(currentRepoConfig.repoOptions)) {
                        //$log.debug('no filters', repoName, items);
                        return items;
                    }

                    if (!rxUtilities.isObjectNullOrEmpty(filters)) {
                        parentFilterValuesObject = filters.parentFilterValuesObject || parentFilterValuesObject;
                        chosenFilters = filters.propertyFilters || chosenFilters;
                    }

                    var filteredData = rxUtilities.isObjectNullOrEmpty(parentFilterValuesObject) ? items : _.filter(items,
                        function(item) {
                            if (!item) {
                                $log.error('Something bad happend when running data through filters in the repo ', repoName, items);
                                return false;
                            }

                            return $filter('filter')(item.parents, parentFilterValuesObject).length;
                        });

                    if (!rxUtilities.isObjectNullOrEmpty(chosenFilters)) {
                        filteredData = $filter('filter')(filteredData, chosenFilters, true);
                    }

                    if (filters && filters.orderBy) {
                        filteredData = $filter('orderBy')(filteredData, filters.orderBy);
                    }

                    return filteredData;
                }

                function getDataForView(items) {
                    var self = this;

                    return rxUtilities.isArrayNullOrEmpty(items) && rxUtilities.isObjectNullOrEmpty(data) ? [] : runThroughFilters.call(self, items);
                }

                // function emitUnprocessedItemsIfNeeded(conversationsAndThreadsObject) {
                //     var self = this,
                //         currentRepoFilters = self.getCurrentFilters(),
                //         folderUID;

                //     if (defaultFilterField) {
                //         folderUID = currentRepoFilters[defaultFilterField];
                //     }

                //     if (!folderUID) {
                //         return;
                //     }

                //     var passedFiltersConversations = $filter('filter')(conversationsAndThreadsObject.conversations, {
                //         folderUID: folderUID
                //     });

                //     if (passedFiltersConversations.length) {
                //         invokeEvent(self.events.unprocessedItems, conversationsAndThreadsObject);
                //     }
                // }

                function queryData(url, query, options) {
                    var self = this;

                    if (!url) {
                        $log.error('No url specified when requesting remote data, are you drunk on Monday morning again? Aborting.');
                        return;
                    }

                    query = query || {};
                    options = options || {};
                    // The timeout property of the http request takes a deferred value
                    // that will abort the underying AJAX request if / when the deferred
                    // value is resolved.
                    var deferredAbort = $q.defer(),
                        dataRequestCustomDeferred = {};

                    //$log.debug('repo query data using params', repoName, url, query);

                    var currentRepoFilters = self.getCurrentFilters(),
                        request = {
                            url: url,
                            method: "GET",
                            params: query,
                            timeout: deferredAbort.promise
                        };

                    var existData = getDataForView.call(self),
                        hadData = false;

                    if (!query.startEvaluatedKey && existData && existData.length > 0) {
                        //$log.debug('Wohoo! rapidly serving data to user before requesting from server');

                        hadData = true;

                        dataRequestCustomDeferred.existingData = existData;
                    }

                    dataRequestCustomDeferred.promise = dataApi.remote(request).then(function(response) {
                        self.handleResponseFromServer(response, query);
                    }, function(response) {
                        if (response && response.status !== -1) {
                            var errorMsg = response.data ? response.data.errorMessage || 'Unknown error' : 'Unknown error';

                            $log.error('$$$ %s ERROR', Date(), errorMsg);
                        }

                        return ($q.reject(response));
                    });

                    // Now that we have the promise that we're going to return to the
                    // calling context, let's augment it with the abort method. Since
                    // the $http service uses a deferred value for the timeout, then
                    // all we have to do here is resolve the value and AngularJS will
                    // abort the underlying AJAX request.
                    dataRequestCustomDeferred.promise.abort = function() {
                        deferredAbort.resolve();
                    };

                    // Since we're creating functions and passing them out of scope,
                    // we're creating object references that may be hard to garbage
                    // collect. As such, we can perform some clean-up once we know
                    // that the requests has finished.
                    dataRequestCustomDeferred.promise.finally(
                        function() {
                            dataRequestCustomDeferred.promise.abort = angular.noop;
                            deferredAbort = request = null;
                            dataRequestCustomDeferred = {};
                        }
                    );

                    return dataRequestCustomDeferred;
                }

                this.handleResponseFromServer = function(response, query) {

                    //$log.debug('$$$ %s GOT THE DATA', Date(), repoName, response.data);


                    if (hasLoadMoreFunctionality && response.data.metadata && query.folderUID) {
                        // Here we set the evaluated key of the next page if we haven't reached the bottom yet
                        lastMetadata[query.folderUID] = response.data.metadata.lastEvaluatedKey && query.startEvaluatedKey !== response.data.metadata.lastEvaluatedKey ? response.data.metadata : null;
                    }

                    self.updateItemsLastFetchTime(query);

                    // When we request data from server, we assume it's most updated so we dont need to fetch children data after link
                    // Beyond that we don't want to emit events for adding items cuz we do it once we finish to add them all
                    var addedItems = [],
                        skipEventEmitting = false,
                        skipChildrenFetchingAfterLink = true;

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.contacts)) {
                        self.repos.contacts.addItems.call(self.repos.contacts, response.data.contacts, {
                            skipEventEmitting: skipEventEmitting
                        });
                    }

                    if (options.skipItemsProcessing) {
                        emitUnprocessedItemsIfNeeded.call(self, {
                            conversations: response.data.conversations,
                            threads: response.data.threads
                        });

                        return;
                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.folders)) {
                        addedItems = self.repos.mailBoxFolders.addItems.call(self.repos.mailBoxFolders, response.data.folders, {
                            skipEventEmitting: skipEventEmitting,
                            skipChildrenFetchingAfterLink: skipChildrenFetchingAfterLink
                        });
                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.contactFolders)) {
                        addedItems = self.repos.contactFolders.addItems.call(self.repos.contactFolders, response.data.contactFolders, {
                            skipEventEmitting: skipEventEmitting
                        });
                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.threads)) {
                        self.repos.threads.addItems.call(self.repos.threads, response.data.threads, {
                            skipEventEmitting: skipEventEmitting,
                            skipChildrenFetchingAfterLink: skipChildrenFetchingAfterLink
                        });
                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.conversations)) {
                        addedItems = self.repos.conversations.addItems.call(self.repos.conversations, response.data.conversations, {
                            skipEventEmitting: skipEventEmitting,
                            skipChildrenFetchingAfterLink: skipChildrenFetchingAfterLink
                        });

                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.attachments)) {
                        self.repos.files.addItems.call(self.repos.files, response.data.attachments, {
                            skipEventEmitting: skipEventEmitting
                        });
                    }

                    if (!rxUtilities.isArrayNullOrEmpty(response.data.messages)) {
                        addedItems = self.repos.messages.addItems.call(self.repos.messages, response.data.messages, {
                            skipEventEmitting: skipEventEmitting,
                            skipChildrenFetchingAfterLink: skipChildrenFetchingAfterLink,
                            skipItemUpdate: true
                        });
                    }

                    // We emit event even if there are no added items because we also want to know when there's no data and display a relevant message to the user
                    if (!quietRepo) {
                        emitEventIfNecessary.call(self, events.itemsAdded, addedItems);
                    }

                    // For groups until they won't be represented as contacts but folders
                    return (getDataForView.call(self));
                }




                // EVENT EMITTING FUNCTIONS
                function emitEventIfNecessary(eventToEmit, items, dataIsAlreadyFiltered) {
                    var self = this;

                    // If its a single item
                    items = Array.isArray(items) ? items : [items];

                    if (!items.length) {
                        invokeEvent.call(self, eventToEmit, []);
                        return;
                    }

                    if (dataIsAlreadyFiltered) {
                        invokeEvent.call(self, eventToEmit, items);
                        return;
                    }

                    var filteredItems = runThroughFilters.call(self, items);

                    if (filteredItems.length > 0) {
                        invokeEvent.call(self, eventToEmit, filteredItems);
                    }
                }

                function invokeEvent(e, data) {
                    //$log.debug('invoking: ', e, ' with ', data);

                    self.emit(e, data);
                }

                // END OF EVENT EMITTING FUNCTIONS
            }

            self.create = function(name, options, force) {
                if (!repos[name] || force) {
                    options.repoName = name;

                    repos[name] = new Repo(options);

                    invokeEvent(events.repoCreated, name);
                }

                return repos[name];
            };

            self.get = function(name) {
                return repos[name];
            };

            self.getAllRepos = function() {
                return {
                    contacts: repos.contacts,
                    mailBoxFolders: repos.mailBoxFolders,
                    contactDisplayNames: repos.contactDisplayNames,
                    contactFolders: repos.contactFolders,
                    conversations: repos.conversations,
                    threads: repos.threads,
                    messages: repos.messages,
                    files: repos.files
                };
            }

            self.setAllRepos = function() {
                for (var k in repos) {
                    repos[k].setRepos.call(repos[k], repos);
                }
            };

            self.setGlobalOptions = function(options) {
                globalOptions = options;
            }

            function invokeEvent(e, data) {
                //$log.debug('invoking: ', e, ' with ', data);

                self.emit(e, data);
            }

            window.repos = self.getAllRepos; // TODO: remove self! this is for developers
        }

        return new serviceInstance();
    }
]);