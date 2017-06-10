'use strict';

angular.module('redKix').controller('previewsCtrl', ['$scope', '$rootScope', '$q', '$rxRepoService', '$rxEv', '$filter', '$redKixActiveUserService', '$timeout', 'ngDialog', '$rxApiURLs', '$rxDataApi', '$rxUtilities', '$rxConfig', '$mdUtil', '$mdSidenav', 'hotkeys', '$log', '$rxRT',
    function($scope, $rootScope, $q, repoService, EmitterService, $filter, ActiveUser, $timeout, ngDialog, ApiURLs, DataApiService, rxUtilities, rxConfig, $mdUtil, $mdSidenav, hotkeys, $log, RealTime) {
        // ---------------- User Vars ---------------- //
        var CTRL_NAME = 'previewsCtrl',
            groupInfoDialog = null,
            groupPhotoUploadDialog = null,
            bypassInboxChanged = false,
            bypassingGroups = [],
            lastSelectedThread, rxConsts = rxConfig.consts,
            repos = repoService.getAllRepos(),
            navigationParams = {},
            lastFetchedSection = null,
            lastFetchedSectionItemsLength = null,
            loadConversationTimeout,
            currentSelection,
            savedSelectionsByFolders = {},
            threadMoveOperationConversationUID;

        // constants for the scrolling calculation
        var PREVIEW_HEIGHT = 97;
        var HEADER_HEIGHT = 25;
        var HEIGHT_DIFF = (HEADER_HEIGHT - PREVIEW_HEIGHT);
        var THREAD_HEIGHT = 57;


        // ------------------- END ------------------- //
        // ------------ Function Handlers ------------ //


        function clearPreviews() {
            $scope.selectedPreview = null;
            $scope.selectedThread = null;
            $scope.sections = [];
            $scope.previews = [];
            $scope.pinnedConversations = [];
            $scope.sortedPreviewsAndSections = [];
            threadMoveOperationConversationUID = null;
            if ($scope.scrollerListener) {
                $scope.scrollerListener.collectionReset();
            }

            if ($scope.search && (!$scope.selectedFolder || $scope.selectedFolder.uid !== rxConsts.SEARCH_FOLDER_UID)) {
                $scope.search.searchString = '';
            }

            cancelSearchTimeout();
        }

        /**
         * PARAMS:
         *   * conversation: object or UID
         *   * thread: objecy or UID
         *   * resetAllSelections: Flag to reset selection and empty out the conversation view
         *   * useSavedSelection: select the conversation+thread selected in one of the save mechanisms: url or savedSelectionsByFolders
         * MORE INFO:
         *   * When we get the data as UID, first, we look for the correct conversation & thread in the visible previews.
         *   * Default selection is working by the specs mentioned in the Paper
         *       [https://paper.dropbox.com/doc/Auto-selecting-conversations-xxeXsZewzX0rpvZFdtWCg]
         */
        function selectPreview(conversation, thread, resetAllSelections, useSavedSelection) {
            $log.debug('select preview called', conversation, thread);

            var passedConversation, passedThread;

            if (conversation && conversation.type === 'section') {
                return;
            }

            if (resetAllSelections) {
                emptySelection();
                return;
            }

            var previousSelectedConversation = currentSelection ? currentSelection.conversation : null;

            //passedConversation = selectConversation(conversation);

            passedThread = selectThread(thread);

            function selectThread(thread) {

                repos.messages.setCurrentFilters({
                    parentFilterValuesObject: {
                        uid: thread.uid
                    }
                });

                EmitterService.invoke(EmitterService.uiEvents.discussionSelected, thread);

                $scope.state.name = 'discussion';

                return thread;
            }

            function emptySelection() {
                if (currentSelection) {
                    if (angular.isObject(currentSelection.conversation)) {
                        currentSelection.conversation.selected = false;
                    }
                    if (angular.isObject(currentSelection.thread)) {
                        currentSelection.thread.selected = false;
                    }

                    currentSelection = undefined;
                    $scope.selectedPreview = null;
                    $scope.selectedThread = null;
                }

                EmitterService.invoke(EmitterService.uiEvents.resetMessagesView, CTRL_NAME);
            }

            function getConversationByUID(conversationUID) {
                var selected;

                angular.forEach($scope.sortedPreviewsAndSections, function(conversation) {
                    if (!selected && conversation['uid'] === conversationUID) {
                        selected = conversation;
                    }
                });

                if (selected) {
                    return selected;
                } else {
                    // CASE: NOT FOUND: select first conversation
                    // If the first preview is a header, we select the next one since there is no two consecutive headers.
                    $log.debug('conversation UID not found. selecting the first one');

                    return getFirstConversation();
                }
            }

            function getThreadByUID(threadUID) {
                var selected;

                angular.forEach(currentSelection.conversation.children, function(thread) {
                    if (thread['uid'] === threadUID) {
                        selected = thread;
                    }
                });

                if (selected) {
                    return selected;
                } else {
                    // CASE: NOT FOUND
                    $log.debug('Thread UID not found. selecting the first child instead');

                    return currentSelection.conversation.children[0];
                }
            }

            function getFirstConversation() {
                if (!$scope.sortedPreviewsAndSections[0]) return;

                return $scope.sortedPreviewsAndSections[0].type == "section" ? $scope.sortedPreviewsAndSections[1] : $scope.sortedPreviewsAndSections[0];
            }
        };

        function loadPreviewsHandler(folderUID, forceGet) {
            $scope.isPreviewsViewActive = true;

            var existingData = repos.conversations.getFilteredData.call(repos.conversations);

            $log.debug('existing data is', existingData);

            // handling existing data immediately
            //console.info('timeout cancelled (empty case)');

            handleConversationsAndThreadsData(existingData);

            defaultlySelectItem();

            function handleConversationsAndThreadsData(data) {
                $log.debug('Returned data from repo is', data);

                $scope.newUser = false;
                // prepares $scope.previews with current data
                $scope.previews = data;

                $scope.isEmpty = $scope.previews.length === 0;

                $log.debug('ready previews before sections', $scope.previews);

                addPreviewsToSections($scope.previews);

                $scope.hasMore = repos.conversations.hasMore.call(repos.conversations);
            }
        }

        function loadMoreHandler($event, section) {
            $log.debug('$$$ %s LOAD MORE DATA', Date());
            $scope.loadMoreHandler = true;
        }

        function conversationsRepoItemsAddedHandler(items) {
            //$log.debug('conversations item added ', items);
            $scope.loadMoreHandler = false;

            // In search we need to create the field searchActivityDate if it does not exist.
            // we sort by this field since the server can overrid the lastactivitydat field.
            items.forEach(function(item) {
                if (!item.searchActivityDate) {
                    item.searchActivityDate = item.lastActivityDate;
                }
            });

            // In some cases server retrun empty items although it has more items to give for the next request
            // if we already have items in view the getIndex will ask for more, but if view is empty we need to ask it explicitly
            if (!items.length && !$scope.previews.length && repos.conversations.hasMore.call(repos.conversations)) {
                // Ask server for more
                $scope.loadMore();
            }

            if (!rxUtilities.isArrayNullOrEmpty(items)) {
                // remove added items that are already in the view
                items = rxUtilities.removeIntersectionByKey(items, $scope.previews);

                if (items.length === 0) {
                    $log.debug('items already exist, no reason to add');

                    $scope.hasMore = repos.conversations.hasMore.call(repos.conversations);

                    $scope.isEmpty = $scope.previews.length === 0;

                    if (!$scope.selectPreview && !$scope.selectedThread) {
                        defaultlySelectItem();
                    }

                    return;
                }

                var uniqItems = rxUtilities.arrayUnique(items);

                if (items.length != uniqItems.length) {
                    console.error("Got duplicate items in the given added items array");
                    items = uniqItems;
                }

                if (items.length > 0) {
                    if (rxUtilities.isArrayNullOrEmpty($scope.previews)) {
                        // if we have messages we open real time
                        RealTime.createSocket();
                    }
                    $scope.previews = $scope.previews || [];
                    $scope.previews = $scope.previews.concat(items);

                    $scope.isEmpty = $scope.previews.length === 0;

                    addPreviewsToSections(items, {
                        skipClear: true
                    });

                    $scope.hasMore = repos.conversations.hasMore.call(repos.conversations);


                    if (!$scope.selectPreview && !$scope.selectedThread) {
                        defaultlySelectItem();
                    }
                }
            } else {
                $scope.isEmpty = rxUtilities.isArrayNullOrEmpty($scope.previews) || $scope.previews.length === 0;

                if ($scope.isEmpty) {
                    $scope.hasMore = false;
                } else {
                    $scope.hasMore = repos.conversations.hasMore.call(repos.conversations);
                }
            }
        }

        function conversationsRepoItemsUpdatedHandler(items) {
            //$log.debug('conversations item updated to prev ctrl ', items);

            if ($scope.isPreviewsViewActive && !rxUtilities.isArrayNullOrEmpty(items)) {
                $scope.previews = rxUtilities.removeIntersectionByKey($scope.previews, items);

                $scope.sortedPreviewsAndSections = rxUtilities.removeIntersectionByKey($scope.sortedPreviewsAndSections, items);
                updateSectionsIndexesAndRemoveEmptySections();

                conversationsRepoItemsAddedHandler(items);

                // in move thread operation we need to scroll to the new selected item
                if (threadMoveOperationConversationUID && threadMoveOperationConversationUID === items[0].uid) {
                    scrollToSelectedPreviewIfNeeded();
                    threadMoveOperationConversationUID = null;
                }
            }
        }


        function conversationsRepoCollectionChangedHandler(items) {
            $log.debug('conversations changed on prev ctrl');

            if ($scope.isPreviewsViewActive && !rxUtilities.isArrayNullOrEmpty(items)) {
                $scope.previews = items;

                addPreviewsToSections($scope.previews);
            }
        };

        // Try to mark the navigated conversation / thread as selected if it has been already loaded
        function defaultlySelectItem(useSavedSelection) {
            var discUID = navigationParams.discussionId,
                threadUID = navigationParams.threadId;

            // selectPreview(discUID, threadUID, useSavedSelection || false, !(discUID && threadUID));
        }

        function threadsRepoItemsAddedHandler(items) {
            //$log.debug('threads item added ', items);

            if ($scope.isPreviewsViewActive && !rxUtilities.isArrayNullOrEmpty(items)) {
                // Update the byline of the added threads conversations
                items.forEach(function(item) {
                    item.parents.foreach(function(conversation) {
                        conversation.updateByline();
                    })
                });
            }
        }

        function threadsRepoItemsRemovedHandler(items) {
            if ($scope.isPreviewsViewActive && !rxUtilities.isArrayNullOrEmpty($scope.selectedConversations) && items) {
                $scope.selectedConversations[0].children = rxUtilities.removeIntersectionByKey($scope.selectedConversations[0].children, items);
            }

            // Update the byline of the added threads conversations
            items.forEach(function(item) {
                item.parents.forEach(function(conversation) {
                    conversation.updateByline();
                })
            });
        }

        function threadsRepoItemsUpdatedHandler(items) {
            //$log.debug('threads item updated to prev ctrl ', items);
            // Update the byline of the added threads conversations
            items.forEach(function(item) {
                item.parents.forEach(function(conversation) {
                    conversation.updateByline();
                })
            });
        }

        function contactsRepoItemsUpdatedHandler(items) {
            if (!$scope.$$phase && items[0].presenceStatus) {
                $log.debug('previewController - ', 'contact item updated', items[0].uid);
            }
        }

        function threadsUIDReplacementHandler(data) {
            if ($scope.isPreviewsViewActive && $scope.selectedPreview && $scope.selectedThread.uid === data[0].uid) {
                selectPreview($scope.selectedPreview.uid, $scope.selectedThread.uid);
            }
        }

        function scrollTo(id, delay) {
            $log.debug('** scrolling to ');
            var element = null;
            var dTime = (delay !== undefined) ? delay : 2000;
            setTimeout(function() {
                element = angular.element(document.getElementById(id));
                if (element.context && !elementInViewport(element)) {
                    $log.debug('** we got the element ');

                    $('#forOverFlown').scrollTo(element, 330, 600);

                    return;
                }
            }, dTime);
        };

        function scrollToTop() {
            $log.debug('** scrolling to top');
            $('#forOverFlown').scrollTop(0);
        }

        function elementInViewport(el) {
            var top = el.offsetTop;
            var left = el.offsetLeft;
            var width = el.offsetWidth;
            var height = el.offsetHeight;

            while (el.offsetParent) {
                el = el.offsetParent;
                top += el.offsetTop;
                left += el.offsetLeft;
            }

            return (
                top < (window.pageYOffset + window.innerHeight) &&
                left < (window.pageXOffset + window.innerWidth) &&
                (top + height) > window.pageYOffset &&
                (left + width) > window.pageXOffset
            );
        }

        // bind hotkeys for navigation through the previews
        hotkeys.bindTo($scope).add({
            combo: 'down',
            description: 'Move to the next item',
            callback: moveToItem
        }).add({
            combo: 'up',
            description: 'Move to the previous item',
            callback: moveToItem
        }).add({
            combo: rxUtilities.isMacOS() ? 'command+backspace' : 'del',
            description: 'Delete the conversation',
            callback: deleteItem
        });

        function getSelectedPreviewIndex() {
            var selectedIndex = -1;

            angular.forEach($scope.sortedPreviewsAndSections, function(preview, index) {
                if (preview.selected) {
                    selectedIndex = index;
                }
            });

            return selectedIndex;
        }

        function postThreadMoveActionHandler(data) {
            var movedThread = data.movedThread,
                parentConversation = data.parentConversation,
                movedThreadIndex = data.movedThreadIndex;

            // If the selected conversation is the parent of the moved thread
            if ($scope.selectedPreview.uid === parentConversation.uid) {
                if (movedThreadIndex >= $scope.selectedPreview.children.length) {
                    movedThreadIndex = $scope.selectedPreview.children.length - 1;
                }

                updateSectionsIndexesAndRemoveEmptySections();

                selectPreview($scope.selectedPreview, $filter('orderBy')($scope.selectedPreview.children, 'lastActivityDate', true)[movedThreadIndex]);
                threadMoveOperationConversationUID = $scope.selectedPreview.uid;
            }
        }

        function getSelectedThreadIndex() {
            var selectedThreadIndex = 0;
            var orderedThreads = $filter('orderBy')($scope.selectedPreview.children, ['-lastActivityDate', 'uid']);

            if (orderedThreads.length) {
                angular.forEach(orderedThreads, function(thread, index) {
                    if (thread.selected) {
                        selectedThreadIndex = index;
                    }
                });
            }
            return selectedThreadIndex;
        }

        function moveToItem(event, hotkey) {
            event.preventDefault();

            if (!$scope.selectedPreview) return;

            if (event.code === 'ArrowDown') {
                selectNextPreviewHandler();
            } else if (event.code === 'ArrowUp') {
                selectPreviousPreviewHandler();
            }
        }

        function selectNextOrPrevPreview(shouldSelectNext) {
            var selectedPreview;
            var selectedPreviewIndex = getSelectedPreviewIndex();
            var orderedThreads = $filter('orderBy')($scope.selectedPreview.children, ['-lastActivityDate', 'uid']);
            var selectedThreadIndex = getSelectedThreadIndex();


            if ($scope.sortedPreviewsAndSections.length > 1) {
                if (shouldSelectNext) {
                    if (selectedThreadIndex < $scope.selectedPreview.children.length - 1) {
                        // need to select the next thread
                        orderedThreads[selectedThreadIndex + 1].selected = true;
                        orderedThreads[selectedThreadIndex].selected = false;
                    } else if ($scope.sortedPreviewsAndSections.length - 1 > selectedPreviewIndex) {
                        selectedPreview = $scope.sortedPreviewsAndSections[selectedPreviewIndex + 1];
                        if (selectedPreview.type === 'section') {
                            selectedPreview = $scope.sortedPreviewsAndSections[selectedPreviewIndex + 2];
                        }
                    }
                } else { //  select previous
                    if (selectedThreadIndex > 0) {
                        // need to select the previous thread
                        orderedThreads[selectedThreadIndex - 1].selected = true;
                        orderedThreads[selectedThreadIndex].selected = false;
                    } else if (selectedPreviewIndex > 1) {
                        selectedPreview = $scope.sortedPreviewsAndSections[selectedPreviewIndex - 1];

                        if (selectedPreview.type === 'section') {
                            selectedPreview = $scope.sortedPreviewsAndSections[selectedPreviewIndex - 2];
                        }
                    }
                }
            }

            if (selectedPreview) {
                orderedThreads[selectedThreadIndex].selected = false;
                selectPreview(selectedPreview);
                scrollToSelectedPreviewIfNeeded();

                // If we are going up to a conversation with multiple threads, we need to select the last thread
                if (selectedPreview.children.length && event.code === 'ArrowUp') {
                    orderedThreads = $filter('orderBy')(selectedPreview.children, ['-lastActivityDate', 'uid']);
                    orderedThreads[0].selected = false;
                    orderedThreads[orderedThreads.length - 1].selected = true;
                }
            }
        }

        function selectPreviousPreviewHandler() {
            selectNextOrPrevPreview(false);
        }

        function selectNextPreviewHandler() {
            selectNextOrPrevPreview(true);
        }

        function scrollToSelectedPreviewIfNeeded() {
            var selectedPreviewIndex = getSelectedPreviewIndex();

            if (selectedPreviewIndex === -1) return;

            var selectedPreviewOffset = selectedPreviewIndex * PREVIEW_HEIGHT + $scope.dynamicItems.getDiffFromConstantHeightTillIndex(selectedPreviewIndex);
            if ($scope.selectedPreview.children.length > 1) {
                // if we have threads, calculate it's offset
                var selectedThreadIndex = getSelectedThreadIndex();
                selectedPreviewOffset += PREVIEW_HEIGHT + (selectedThreadIndex + 1) * THREAD_HEIGHT;
            }

            $timeout(function() {
                var container = $('.md-virtual-repeat-scroller').first();
                var containerScrollTop = container.scrollTop();

                if (selectedPreviewOffset < containerScrollTop) {
                    // scroll up
                    container.scrollTop(selectedPreviewOffset - 2 * PREVIEW_HEIGHT);
                } else if (selectedPreviewOffset + PREVIEW_HEIGHT * 2 > containerScrollTop + window.innerHeight) {
                    // scroll down
                    container.scrollTop(selectedPreviewOffset - window.innerHeight + 3 * PREVIEW_HEIGHT);
                }
            });
        }

        function deleteItem(event, hotkey) {

            var deletedItemsFolder = repos.mailBoxFolders.getAllData().find(function(f) {
                return f.type === rxConsts.FOLDER_TYPE.DELETED_ITEMS;
            });

            if (deletedItemsFolder === $scope.selectedPreview.parents[0]) {
                return; // We are already in the deleted items folder
            }

            if (deletedItemsFolder) {
                $scope.selectedThread.moveToFolder($scope.selectedFolder, deletedItemsFolder);
            }
        }

        // ------------------- END ------------------- //

        // ---------------- Scope Vars --------------- //
        $scope.rxConsts = rxConsts;
        $scope.isPreviewsViewActive = true; //false;
        $scope.selectedFolder = null;
        $scope.previewsTitle = null;
        $scope.hasMore = true;
        $scope.previews = [];
        $scope.followChecked = false;
        $scope.tooltip = {
            'title': 'Follow'
        };
        $scope.selectedPreview = null;
        $scope.selectedPreviews = [];
        $scope.selectedThreads = [];
        $scope.selectedDiscussionUID = null;
        $scope.selectedConversations = [];
        $scope.bypassInbox = null;
        $scope.groupInfoModalCloseButtonText = "CLOSE";

        // file upload section //
        $scope.myGroupPhotoFiles = [];
        $scope.files = [];
        $scope.uploadRunning = false;
        // file upload section end //

        $scope.selectDiscussion = selectPreview;
        $scope.loadPreviews = loadPreviewsHandler;

        $scope.loadMore = loadMoreHandler;
        $scope.showUnreadDetermine = function(preview) {
            return preview && preview.unreadCount > 0 && preview.sentState !== rxConsts.SENT_STATE.FAILED;
        }

        function createSection(title, lastActivityDate) {
            return {
                type: 'section',
                title: title,
                lastActivityDate: lastActivityDate,
                searchActivityDate: lastActivityDate
            };
        }

        function getNewSections() {
            var now = moment();
            var sections = [createSection('last hour', moment().format()),
                createSection('today', moment().subtract(1, 'hour').format()),
                createSection('yesterday', moment().startOf('day').add(10, 'second').format()),
                createSection('earlier this week', moment().subtract(1, 'day').add(9, 'second').startOf('day').format()),
                createSection('last week', moment().startOf('week').add(8, 'second').format()),
                createSection('earlier this month', moment().subtract(1, 'week').add(7, 'second').startOf('week').format()),
                createSection('last month', moment().startOf('month').add(6, 'second').format()),
                createSection('older', moment().subtract(1, 'months').add(5, 'second').startOf('month').format())
            ];

            var earlierThisMonthIndex = 5;

            if (now.day() === 0) {
                // On sunday we don't need the earlier this week and yesterday
                sections.splice(2, 2);
                earlierThisMonthIndex -= 2;
            }

            if (now.date() < 7) {
                // On the first week of the month we don't need last week and eralier this month
                sections.splice(earlierThisMonthIndex, 1);
            }
            return sections;
        }

        // Go over the sections and remove empty one. In addition update two fields:
        // 1. index - the index of the section inside the visiblePreviews array
        // 2. sectionBefore - the number of sections before this current section
        // Thos fields will help us return a quick answer in the getDiffFromConstantHeightTillIndex function called by the virtual repeater.
        function updateSectionsIndexesAndRemoveEmptySections() {
            // Update the sections index and remove empty sections
            var sectionsBefore = 0;

            if ($scope.sortedPreviewsAndSections.length) {
                for (var previewIndex = 0, sectionIndex = 0; previewIndex < $scope.sortedPreviewsAndSections.length && sectionIndex < $scope.sections.length; previewIndex++) {
                    if ($scope.sortedPreviewsAndSections[previewIndex].type === 'section') {
                        if (sectionIndex && $scope.sections[sectionIndex - 1].index == previewIndex - 1) {
                            // The previous header is empty --> remove it
                            $scope.sortedPreviewsAndSections.splice(previewIndex - 1, 1);
                            previewIndex--;

                            $scope.sections.splice(sectionIndex - 1, 1);
                            sectionIndex--;
                        }
                        $scope.sortedPreviewsAndSections[previewIndex].index = previewIndex;
                        $scope.sortedPreviewsAndSections[previewIndex].sectionsBefore = sectionIndex;

                        sectionIndex++;

                    }
                }

                if ($scope.sortedPreviewsAndSections[$scope.sortedPreviewsAndSections.length - 1].type === 'section') {
                    $scope.sortedPreviewsAndSections.splice(-1, 1);
                    $scope.sections.splice(-1, 1);
                }

                // We changed the indexes of the section --> Reset theindexes cache
                $scope.indexCache = {};
            }
        }

        function addPreviewsToSections(previewz, options) {
            var sections,
                previews = Array.isArray(previewz) ? previewz : [previewz];

            options = options || {};

            $scope.isEmpty = (previews.length === 0);

            // update the byline for the added conversations
            previews.forEach(function(preview) {
                preview.updateByline();
            });

            // If we are in search folder the server can override the lastActivityDate field
            // of a conversation it already retrun (server limitation). So in search
            // we create a temporary field in the conversation that will hold the 'first retruned'
            // lastActivityDate and will sort by it.
            var orderBy = 'searchActivityDate';
            $scope.sections = $filter('orderBy')(getNewSections(), orderBy, true);
            $scope.sortedPreviewsAndSections = options.skipClear ? $scope.previews : previews;
            $scope.sortedPreviewsAndSections = $filter('orderBy')($scope.sortedPreviewsAndSections.concat($scope.sections), orderBy, true);


            updateSectionsIndexesAndRemoveEmptySections();
        }

        $scope.reload = function() {
            document.location.reload();

            sendMessageToBackground({
                operation: 'rx-refresh'
            });

            function sendMessageToBackground(request, responseCallback) {
                if (responseCallback) {
                    chrome.runtime.sendMessage(request, null, responseCallback);
                } else {
                    chrome.runtime.sendMessage(request, null, function(a) {});
                }
            }
        }


        // ------------------- END ------------------- //

        // ------------- Local Functions ------------- //

        // ------------------- END ------------------- //

        // ------------- Event Listeners ------------- //
        repos.conversations.on(repos.conversations.events.collectionChanged, conversationsRepoCollectionChangedHandler);
        repos.conversations.on(repos.conversations.events.itemsAdded, conversationsRepoItemsAddedHandler);
        repos.conversations.on(repos.conversations.events.itemsUpdated, conversationsRepoItemsUpdatedHandler);

        repos.threads.on(repos.threads.events.itemsAdded, threadsRepoItemsAddedHandler);
        repos.threads.on(repos.threads.events.itemsRemoved, threadsRepoItemsRemovedHandler);
        repos.threads.on(repos.threads.events.itemsUpdated, threadsRepoItemsUpdatedHandler);
        repos.threads.on(repos.threads.events.itemUIDReplacement, threadsUIDReplacementHandler);

        repos.contacts.on(repos.contacts.events.itemsUpdated, contactsRepoItemsUpdatedHandler);

        EmitterService.on(EmitterService.uiEvents.selectPrevPreview, selectPreviousPreviewHandler);
        EmitterService.on(EmitterService.uiEvents.selectNextPreview, selectNextPreviewHandler);
        EmitterService.on(EmitterService.uiEvents.previewsReset, clearPreviews);


        // Very Very important to unsubscribe to events on destroy!
        $scope.$on('$destroy', function() {
            repos.conversations.off(repos.conversations.events.itemsUpdated, conversationsRepoItemsUpdatedHandler);
            repos.conversations.off(repos.conversations.events.collectionChanged, conversationsRepoCollectionChangedHandler);
            repos.conversations.off(repos.conversations.events.itemsAdded, conversationsRepoItemsAddedHandler);

            repos.threads.off(repos.threads.events.itemsAdded, threadsRepoItemsAddedHandler);
            repos.threads.off(repos.threads.events.itemsRemoved, threadsRepoItemsRemovedHandler);
            repos.threads.off(repos.threads.events.itemsUpdated, threadsRepoItemsUpdatedHandler);
            repos.threads.off(repos.threads.events.itemUIDReplacement, threadsUIDReplacementHandler);

            repos.contactFolders.off(repos.contactFolders.events.itemsUpdated, contactFoldersRepoItemsUpdatedHandler);

            EmitterService.off(EmitterService.uiEvents.folderSelected, folderSelectedHandler);
            EmitterService.off(EmitterService.uiEvents.postThreadMoveAction, postThreadMoveActionHandler);

        });

        function cancelSearchTimeout() {
            if ($scope.startSearchTimeout) {
                $timeout.cancel($scope.startSearchTimeout);
                $scope.startSearchTimeout = null;
            }
        }

        function cancelLoadMoreTimeout() {
            if ($scope.loadMoreTimeout) {
                $timeout.cancel($scope.loadMoreTimeout);
                $scope.loadMoreTimeout = null;
            }
        }

        // Search string search --> trigger a 5 second timeout to start the search
        $scope.searchStringChanged = function() {
            cancelSearchTimeout();

            // If there's no search string and we're in the search folder --> return to original folder
            if ($scope.search.searchString.length === 0 && $scope.selectedFolder.uid === rxConsts.SEARCH_FOLDER_UID) {
                clearSearchFolder();

                var currentFilters = repos.conversations.getCurrentFilters();
                currentFilters.searchQuery = null;

                state.go('home.folder', {
                    folderId: $scope.folderUIDBeforeSearch
                });
                // Cancel any search task in the prefetch
                rxPrefetchService.cancelSearchTasks({
                    folderUID: rxConsts.SEARCH_FOLDER_UID
                });

                cancelLoadMoreTimeout();

                return;
            } else if ($scope.search.searchString.length > 2) {
                $scope.startSearchTimeout = $timeout(function() {
                    startSearch();
                }, 1500);
            }
        }

        $scope.searchBoxKeyPressedHandler = function($event) {
            if ($event.keyCode === 13 && $scope.search.searchString && $scope.search.searchString.length > 0) {
                startSearch();
            }
        }

        $scope.clearSearchString = function() {
            $scope.search.searchString = '';
            $scope.searchStringChanged();
        }

        // Remove any conversation inside the search folder (unlink it)
        // TODO: Need to delete conversations/thread/messages that has no parents
        function clearSearchFolder() {
            clearPreviews();

            var searchFolder = repos.mailBoxFolders.getItem(rxConsts.SEARCH_FOLDER_UID);

            searchFolder.$lastTimeFetched = null;

            $scope.isPreviewsViewActive = false;

            searchFolder.emptyFolderAndDeleteConversations();

            $scope.isPreviewsViewActive = true;

            cancelLoadMoreTimeout();
        }

        // Start the search process. Navigate to the search folder with the given search string
        // as a query. If we are already in the search folder we cancel all the search task and initiate new ones.
        function startSearch() {
            cancelSearchTimeout();

            var currentFilters = repos.conversations.getCurrentFilters();

            if ($scope.search.searchString === currentFilters.searchQuery) return; // same search

            EmitterService.invoke(EmitterService.uiEvents.resetMessagesView, CTRL_NAME);

            // save query string before clearSearchFolder
            currentFilters.searchQuery = $scope.search.searchString;

            clearSearchFolder();

            //restore query string
            $scope.search.searchString = currentFilters.searchQuery;

            // Cancel any search task in the prefetch
            rxPrefetchService.cancelSearchTasks({
                folderUID: rxConsts.SEARCH_FOLDER_UID
            });

            // Block any 'itemAdded' event getting to previews handler till the navigation completes.
            repos.conversations.setCurrentFilters({});

        }

        // ------------------- END ------------------- //

        // ---------- Controller Initializers -------- //

        // ------------------- END ------------------- //
    }
]);
