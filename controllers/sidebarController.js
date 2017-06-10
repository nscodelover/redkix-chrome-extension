angular.module('redKix').controller('sidebarController', ['$scope', 'ngDialog', '$rootScope', '$filter', '$http', '$rxConfig', '$rxRepoService', '$rxEv', '$timeout', '$redKixActiveUserService',

    function($scope, ngDialog, $rootScope, $filter, $http, $rxConfig, rxRepoService, EmitterService, $timeout, activeUser) {
        var CTRL_NAME = "sidebarController",
            repos = rxRepoService.getAllRepos(),
            rxConsts = $rxConfig.consts,
            lastSearchQuery;

        $scope.closeSidebar = function() {
            sendMessageToActiveTab({
                operation: 'rx-hide-sidebar'
            });
        };

        function expandSidebar() {
            sendMessageToActiveTab({
                operation: 'rx-expand-full-width-sidebar'
            });
        };

        function shrinkSidebarToNormal() {
            sendMessageToActiveTab({
                operation: 'rx-shrink-to-normal-width-sidebar'
            });
        }

        function sendMessageToActiveTab(request, responseCallback) {
            request.sendToActiveTab = true;
            sendMessageToBackground(request, responseCallback);
        }

        function sendMessageToBackground(request, responseCallback) {
            if (responseCallback) {
                chrome.runtime.sendMessage(request, null, responseCallback);
            } else {
                chrome.runtime.sendMessage(request, null, function(a) {});
            }
        }

        $scope.composeNewMessage = function() {
            //expandSidebar();
            createComposeModal({});
        };

        $scope.closeComposeDialog = function() {
            ngDialog.closeAll();
        }

        sendMessageToBackground({
            operation: 'rx-register-to-navigation-event'
        }, activeTabeNavigationHandler)
        chrome.runtime.onMessage.addListener(
            function(request, sender, sendResponse) {
                switch (request.operation) {
                    case 'rx-server-data':
                        //console.info("Got data from server!!!!!");
                        break;
                }
            });


        function activeTabeNavigationHandler() {
            $timeout(function() {
                getSearchQuery(function(pluginData) {
                    sendMessageToBackground({
                        operation: 'rx-register-to-navigation-event'
                    }, activeTabeNavigationHandler);

                    if (!pluginData.searchQuery || pluginData.searchQuery === lastSearchQuery) return; // the search criteria did not changed --> nothing to do

                    clearSearchFolder();
                    fetchConversationAccordingToSubject();

                }, 1000);
            });
        }

        function createComposeModal(populateModalData) {

            getPluginDataForCompose(function(pluginData) {
                createComposeModalWithData({
                    flowType: rxConsts.FLOW_TYPE.NEW_DISCUSSION
                }, pluginData.subject, pluginData.body, pluginData.searchQuery);
            });
        }

        function adjustTemplate(template, metadata) {
            if (template.join) {
                template = template.join(" ");
            }

            Object.keys(metadata).forEach(function(propertyName) {
                if (metadata[propertyName]) {
                    template = template.replace("meta." + propertyName, "`" + metadata[propertyName] + "`");
                    template = template.replace("{{meta." + propertyName + "}}", metadata[propertyName]);
                }
            });

            return template;
        }


        function createComposeModalWithData(populateModalData, subject, body, searchQuery) {
            var dialogScope = $scope.$new();

            populateModalData.subject = subject;
            populateModalData.bodyHtml = body;
            populateModalData.searchQuery = searchQuery;

            var options = {
                template: '/views/compose-modal.html',
                controller: 'ComposeModalCtrl',
                scope: dialogScope,
                className: "ngdialog-theme-redkix ngdialog-theme-compose",
                name: 'compose',
                data: populateModalData,
                showClose: false,
                closeByDocument: true,
                closeByEscape: true,
                disableAnimation: true,
                preCloseCallback: function(value) {
                    if (value === "POST" || dialogScope.canCloseDialogWithoutWarning()) {
                        return true; // For the Send case we don't have to check anything
                    }

                    //EmitterService.invoke(EmitterService.uiEvents.newDiscPreviewDataChanged, null, CTRL_NAME);

                    var nestedConfirmDialog = ngDialog.openConfirm({
                        template: './discard-message-warning-dialog.html',
                        plain: false,
                        overlay: true,
                        name: 'error',
                        disableAnimation: true,
                        showClose: false,
                        className: 'ngdialog-theme-redkix-confirm ngdialog-theme-default ngdialog-theme-compose-error',
                    });

                    // NOTE: return the promise from openConfirm
                    return nestedConfirmDialog;
                }
            };

            newDiscussionDialog = ngDialog.open(options);
        }

        function ngDialogOpenedHandler(e, $dialog) {
            $scope.uiState.isModalDialogOpen = true;

            if (newDiscussionDialog && $dialog.name === 'compose') {
                $rootScope.userMayLoseData = rxConsts.LOSE_DATA_TYPE.NEW_MSG;
                startComposeDialogEnterAnimation($dialog.dialog);
                $("#to-input input").focus();
            } else if (newDiscussionDialog && $dialog.name === 'error') {
                // nested dialog
                startNestedDialogAnimation($dialog.dialog);
            }
        }

        function ngDialogClosingHandler(e, $dialog) {
            var dialogName = $dialog.data('$ngDialogOptions').name;
            if (newDiscussionDialog && dialogName === 'compose') {
                $rootScope.userMayLoseData = null;
            } else if (newDiscussionDialog && dialogName === 'error') {
                //reverse the nested dialog animation
                $($dialog.find('.ngdialog-content')).velocity("reverse");
            }

            // reverse the compose dialog animation (if available)
            if (newDiscussionDialog) {
                var composeDialogContentElement = $('#' + newDiscussionDialog.id + ' .ngdialog-content');
                if (composeDialogContentElement.velocity) {
                    composeDialogContentElement.velocity("reverse");
                }
            }
        }

        function ngDialogClosed(e, $dialog) {
            if (ngDialog.getOpenDialogs().length === 1) {
                $scope.state.name = "previews";
            }
        }

        function fetchConversationAndThreads(searchQuery) {
            var promise = repos.conversations.getRemoteData({
                url: repos.conversations.registeredAPIs.conversationsAndThreads,
                query: {
                    folderUID: $rxConfig.consts.SEARCH_FOLDER_UID,
                    query: searchQuery
                }
            }).promise;
            return promise;
        }

        function getPluginDataForCompose(callback) {
            sendMessageToBackground({
                operation: 'rx-get-plugin-data-for-compose'
            }, callback);
        }

        function getSearchQuery(callback) {
            sendMessageToBackground({
                operation: 'rx-get-search-query'
            }, callback);
        }



        function fetchMessagesForThreads() {
            var query = {
                threadUIDs: repos.threads.getAllData().filter(function(thread) {
                    return !thread.$lastTimeFetched;
                }).map(thread => thread.uid).join(',')
            };
            if (query.threadUIDs.length === 0) return;

            var promise = repos.conversations.getRemoteData({
                url: repos.messages.registeredAPIs.messages,
                query
            }).promise;
            return promise;
        }

        function fetchMoreConversationsAndThreads(searchQuery) {
            return repos.conversations.loadMore({
                url: repos.conversations.registeredAPIs.conversationsAndThreads,
                query: {
                    folderUID: $rxConfig.consts.SEARCH_FOLDER_UID,
                    query: searchQuery
                }
            }).promise;

        }

        function fetchConversationAccordingToSubject() {
            getSearchQuery(function(pluginData) {
                lastSearchQuery = pluginData.searchQuery;
                fetchConversationAndThreads("\"" + pluginData.searchQuery + "\"").then(function(data) {
                        // fetch the messages
                        var fetchPromise = fetchMessagesForThreads();
                        if (fetchPromise) {
                            fetchPromise.then(function(data) {
                                //console.info("Finish to fetch messages");
                                if (repos.conversations.hasMore()) {
                                    fetchMoreConversationsAndThreads(lastSearchQuery).then(function(data) {
                                        fetchMessagesForThreads();
                                    })
                                }
                            }, function error(err) {
                                console.error("Fail to fetch messages", err);
                            });
                        }
                    }, function error(err) {
                        console.error("Fail to fetch messages", err);
                    }

                );
            });
        }

        // Remove any conversation inside the search folder (unlink it)
        // TODO: Need to delete conversations/thread/messages that has no parents
        function clearSearchFolder() {

            var searchFolder = repos.mailBoxFolders.getItem($rxConfig.consts.SEARCH_FOLDER_UID);
            if (searchFolder) {
                searchFolder.$lastTimeFetched = null;
                searchFolder.emptyFolderAndDeleteConversations();
            }

            EmitterService.invoke(EmitterService.uiEvents.previewsReset, {});
            repos.conversations.clearAllItems();
        }

        if (activeUser.getSessionToken) {
            fetchConversationAccordingToSubject();
        }

        $rootScope.$on('ngDialog.closing', ngDialogClosingHandler);
        $rootScope.$on('ngDialog.closed', ngDialogClosed);
        EmitterService.on(EmitterService.uiEvents.openComposeModal, createComposeModalWithData);

        $scope.$on('$destroy', function() {
            EmitterService.off(EmitterService.uiEvents.openComposeModal, createComposeModalWithData);
        });

    }
]);
