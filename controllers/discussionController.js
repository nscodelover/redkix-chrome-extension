'use strict';

angular.module('redKix').controller('discussionCtrl', ['$scope', '$rootScope',
    '$rxRepoService', '$rxEv', '$document', '$compile', '$location', '$filter', '$http', '$timeout', '$redKixActiveUserService', '$rxApiURLs', '$rxUtilities', '$rxConfig', '$sce', '$anchorScroll', 'hotkeys', '$log', '$filter', '$rxRT', 'rxPresenceService',

    function($scope, $rootScope, repoService, EmitterService, $document, $compile, location, filter, http, $timeout, ActiveUser, APIURLs, rxUtilities, rxConfig, $sce, $anchorScroll, hotkeys, $log, $filter, RealTime, rxPresenceService) {
        // ---------------- User Vars ---------------- // 
        var CTRL_NAME = 'discussionCtrl',
            container = null,
            rxConsts = rxConfig.consts,
            repos = repoService.getAllRepos(),
            activeUserMailBoxAddress = ActiveUser.getMailBoxAddress(),
            discussionLoaded = false,
            readMessagesUIDs = [],
            hasLocalData = false;

        // ------------------- END ------------------- //
        // ------------ Function Handlers ------------ //
        function repoCollectionChangedHandler(items) {
            $log.debug('### collection changed on discussion ctrl');

            if ($scope.isConversationViewActive && $scope.selectedThread && !rxUtilities.isArrayNullOrEmpty(items)) {
                setDiscussion(items);
            }
        };

        // Insert the the items to the unread and read lists.
        function addMessagesToLists(itemsToAdd) {
            if (itemsToAdd.length === 0) return; // nothing to add

            var unreadMessagesBeforeLength = $scope.unreadMessages.length;
            var latestReadMessage = $scope.readMessages.length !== 0 ? $scope.readMessages[$scope.readMessages.length - 1] : null;

            // Divide the messages to read/unread lists
            itemsToAdd.forEach(function(message) {
                if (!message.internetMessageId) {
                    // case where we just sent a meesage
                    message.internetMessageId = ($scope.unreadMessages.length + 1) * -1; //Create a temporary internet ID that will be replace when the server respond.
                    $scope.unreadMessages.push(message);
                } else if (message.isRead) {
                    $scope.readMessages.push(message);
                } else {
                    $scope.unreadMessages.push(message);
                }
            });

            $scope.readMessages = filter('unique')($scope.readMessages, 'internetMessageId');

            if (unreadMessagesBeforeLength !== $scope.unreadMessages.length) {
                $scope.unreadMessages = filter('unique')($scope.unreadMessages, 'internetMessageId');
                $scope.unreadMessages = filter('orderBy')($scope.unreadMessages, 'receivedDate');
                unreadMessagesBeforeLength = $scope.unreadMessages.length;
            }

            $scope.readMessages = filter('orderBy')($scope.readMessages, 'receivedDate');
            var firstUnreadMessage = $scope.unreadMessages[0];

            // Check if some read messages are newer than the first unread message and move it to the unread messages list
            for (var i = $scope.readMessages.length - 1; firstUnreadMessage && i >= 0; i--) {
                var readMessage = $scope.readMessages[i];
                if (moment.duration(moment(firstUnreadMessage.receivedDate).diff(readMessage.receivedDate)).asSeconds() < 0) {
                    console.assert(!isInRealtime(), "Change read list during realtime event!!!!")
                    $scope.unreadMessages.push($scope.readMessages.pop());
                } else {
                    break;
                }
            }

            if (unreadMessagesBeforeLength !== $scope.unreadMessages.length) {
                $scope.unreadMessages = filter('unique')($scope.unreadMessages, 'internetMessageId');
                $scope.unreadMessages = filter('orderBy')($scope.unreadMessages, 'receivedDate');
            }

            // update unread count only it is not shown yet
            if (!$scope.unreadCount) {
                $scope.unreadCount = 0;
                $scope.unreadMessages.forEach(function(message) {
                    $scope.unreadCount += message.isRead ? 0 : 1;
                });
            };

            setConversationAsRead();

            console.assert(rxUtilities.arrayUnique($scope.readMessages.concat($scope.unreadMessages)).length === $scope.readMessages.concat($scope.unreadMessages).length, "Got some message duplication in conversation");
        }

        function setConversationAsRead() {
            console.assert($scope.selectedThread, 'Selected thread is null, could not mark as read');

            // mark thread as read
            if ($scope.supressSetRead || !$scope.unreadMessages.length) return;

            // Send to server. We are using timeout since if we are in real time the thread does
            // not contains the new messages yet.§
            $timeout(function(selectedThread) {
                selectedThread.setRead(true);
            }, 1000, true, $scope.selectedThread);
        }

        function repoItemsAddedHandler(items) {
            //$log.debug('collection item added on discussion ctrl ', items);

            if ($scope.selectedThread && !rxUtilities.isArrayNullOrEmpty(items)) {
                items.forEach(function(item) {
                    if (item.sender && item.sender.uid) {
                        clearTyping(item.sender.uid);
                    }
                });

                var noMessagesYet = $scope.readMessages.length === 0 && $scope.unreadMessages.length === 0;
                var unreadMessageCountBeforeAdd = $scope.unreadMessages.length;

                if (!$scope.selectedThread.$lastTimeFetched) {
                    // Make sure we got here from realtime event and the thread is already empty (not including chat case)
                    console.assert(isInRealtime() && (noMessagesYet || $scope.selectedThread.isChat))

                    // Save the real time messages if it's arrive before the API call.
                    $scope.messagesFromRealTime = items;
                    return;
                } else if ($scope.messagesFromRealTime) {
                    items = items.concat($scope.messagesFromRealTime);
                    $scope.messagesFromRealTime = null;
                }

                // If we don't have messages yet we still hiding the UI --> need to arm pre-scroll to make 
                var needToArmPreScroll = $scope.readMessages.length == 0;

                // Make sure added items will contain only new items
                var allItems = $scope.readMessages.concat($scope.unreadMessages);
                var addedItems = rxUtilities.removeIntersectionByKey(items, allItems);
                addedItems = rxUtilities.removeNonNullIntersectionByKey(addedItems, allItems, 'internetMessageId');

                addMessagesToLists(addedItems);

                $scope.activateScroll.saveCurrentDistanceFromBottom();

                if (isInRealtime()) {
                    $scope.$apply();
                }

                $scope.activateScroll.activate();


                if (needToArmPreScroll) {
                    var lastMessage = getMessageToScrollTo();
                    if (lastMessage) {
                        if ($scope.unreadMessages.length) {
                            $scope.preScrollControl.arm('unread_seperator_line');
                        } else {
                            $scope.preScrollControl.arm('msg_' + lastMessage.uid);
                        }
                    }
                }

                if (!$scope.discussionLoaded) {
                    $scope.discussionLoaded = true;
                }

                // we hide the unread line if we get new message
                if (!noMessagesYet && unreadMessageCountBeforeAdd != $scope.unreadMessages.length && isInRealtime()) {
                    if (!$scope.supressSetRead) {
                        $scope.shouldShowUnreadLine = false;
                    }
                    // got new message --> prevent the preScroll to try scroll when height is changed
                    //$scope.preScrollControl.disarm();
                }
            }

        }

        function isInRealtime() {
            return !$scope.$$phase;
        }

        function repoItemsRemovedHandler(items) {
            $log.debug('collection item removed on discussion ctrl ', items);

            if ($scope.selectedThread && !rxUtilities.isArrayNullOrEmpty(items)) {
                $scope.readMessages = rxUtilities.removeIntersectionByKey($scope.readMessages, items);
            }
        }

        function repoItemsUpdatedHandler(items) {
            // $log.debug('collection item updated to discussion ctrl', items);
        }

        function resetViewHandler() {
            $scope.discussionLoaded = false;
            $scope.discussion = null;
            $scope.typingUsers = {};
            $scope.selectedAttachment = null;
            $scope.selectedFile = null;
            $scope.supressSetRead = false;
            $scope.unreadCount = 0;
            $scope.shouldShowUnreadLine = true;
            $scope.selectedThread = null;

            hasLocalData = false;

            while ($scope.unreadMessages.length) $scope.unreadMessages.pop();
            while ($scope.readMessages.length) $scope.readMessages.pop();

            $scope.quotationBubblesView = {
                shouldShow: false
            };

            if ($scope.chipCounterObject) {
                $scope.chipCounterObject.firstLineContactsCounter = 0;
                $scope.chipCounterObject.offsetsFromRight = {};
                $scope.chipCounterObject.initiated = [];
            }

            $scope.conversationByline = [];
            readMessagesUIDs = [];
        }

        function discussionSelectedHandler(thread) {
            resetViewHandler();

            $scope.preScrollControl.hide && $scope.preScrollControl.hide();

            loadDiscussion(thread);

            if (hasLocalData && ($scope.readMessages.length > 0 || $scope.unreadMessages.length > 0)) {
                if ($scope.unreadMessages.length) {
                    $scope.preScrollControl.arm && $scope.preScrollControl.arm('unread_seperator_line');
                } else {
                    var lastMessage = $scope.readMessages[$scope.readMessages.length - 1];
                    $scope.preScrollControl.arm && $scope.preScrollControl.arm('msg_' + lastMessage.uid);
                }
            }
        };

        $scope.trustBodyHTML = function(body) {
            return $sce.trustAsHtml(body);
        };

        $scope.prepareMsg = rxUtilities.prepareMsg;

        $scope.showQuotationBubblesView = function(msg) {
            var quoteDataArray = msg.quotationBubbles.map(function(quote) {
                return {
                    quote: quote
                };
            })
            $scope.quotationBubblesView = {
                shouldShow: true,
                quotationBubbles: quoteDataArray,
                message: msg
            };

            // Give angular a chance to digest and prepare the quotation Bubbles View before we start the animation
            $timeout(function() {
                // we first scroll to the end, and after that we start the animation.
                location.hash('quotes-view-bottom');
                $anchorScroll();

                var animationDuration = 0.3;

                for (var index = 0; index < msg.quotationBubbles.length; index++) {
                    animateSingleQuote(msg, index, animationDuration);
                }

                angular.element('.quote-bubbles-container').css('transition', 'all .5s ease-in-out');
                angular.element('.quote-bubbles-container').css('background-color', 'rgba(243, 247, 250, 0.76)');

                $timeout(showQuotationBubblesWhenAnimationFinished, animationDuration * 1000);

                // Sometimes the quote bubbles are not ready to be shown after the animation duration. For that we will try to show 
                // them also after 2 seconds
                $timeout(showQuotationBubblesWhenAnimationFinished, 2000);
            });
        }

        function showQuotationBubblesWhenAnimationFinished() {
            // Animation completed hide the duplicate bubbles and show the 'real' ones.
            angular.element('.quote-bubble-dup').hide();
            angular.element('.quote-bubble').parent().css('opacity', '1');
            angular.element('.quote-bubbles-container').css('transition', 'none');
        }

        /**
         * Animate the quotation bubble move from their place in the conversation view, to their place in the quotation view.
         * We create a duplicated elements of quotes for this animation. We position each duplicate quote in an absolute position
         * according to the stacked quotes and move them into the 'real' quote position. After the animation ends we hide the duplicat
         * items and show the original.
         **/
        function animateSingleQuote(msg, quoteIndex, animationDuration) {
            // Get the absolute position of the stacked quote (so we can start the duplicate quote animation from there). 
            var quoteElement = angular.element("#" + msg.uid + '-stacked-quote-0'),
                startOffset = quoteElement.offset().top,
                startWidth = quoteElement.width(),
                startHeight = quoteElement.height();

            var dupElement = angular.element('#quote-dup-' + quoteIndex);
            dupElement.css('top', startOffset);
            dupElement.find('.quote-bubble').css("width", startWidth);
            dupElement.find('.quote-bubble').css("height", startHeight);

            // filter elemnt that will not be shown on screen (because of scrolling)
            var targetElement = angular.element('#quote-' + quoteIndex);
            var targetOffsetTop = targetElement.offset().top;
            if (targetOffsetTop + targetElement.height() < 44) {
                dupElement.css('opacity', '0');
                return;
            } else {
                dupElement.css('visibility', 'visible');
            }

            // Set transition animation for each and every property we are going to change
            dupElement.css('transition', 'all ' + animationDuration + 's ease-in-out');
            dupElement.find('.quote-bubble').css('transition', 'all ' + animationDuration + 's ease-in-out');

            // Set the properties that brings the dup element to its target place
            dupElement.css('top', targetOffsetTop - 12);
            dupElement.find('.quote-bubble').css('height', targetElement.height());
            dupElement.find('.quote-bubble').css('width', targetElement.find('.quote-bubble').width() + 20);
            dupElement.find('.quote-bubble').css('margin', '13px 48px 0px 48px');
        }

        $scope.hideQuotionBubblesView = function() {
            $scope.quotationBubblesView = {
                shouldShow: false
            };
        }

        $scope.getAvatarDarkColor = function(contactOrDisplayName) {
            var correctTitle = contactOrDisplayName.getCorrectTitle ? contactOrDisplayName.getCorrectTitle(false, $scope.selectedThread.parents[0].uid) : contactOrDisplayName;
            var avatarInitials = rxUtilities.getAvatarInitials(correctTitle);

            return rxUtilities.getAvatarDarkColor(avatarInitials);
        }

        // Counter for the "& X others" string
        $scope.othersCounter = function() {
            return $scope.conversationByline && $scope.chipCounterObject ? $scope.conversationByline.length - $scope.chipCounterObject.firstLineContactsCounter : 0;
        }

        function loadDiscussion(thread) {
            hasLocalData = false;

            $scope.selectedThread = thread;
            $scope.unreadMessages = [];
            $scope.readMessages = [];

            if (thread) {
                RealTime.createSocket();
            }

            // Temporary solution to trigger in-view when loading a conversation with recycled messages
            $scope.marginToTriggerInView = $scope.marginToTriggerInView === 1 ? 0 : 1;

            $scope.conversationByline = $scope.getConversationByline(thread);

            // Initiate the chipCounterObject that will be filled by the contact-chip directive
            $scope.chipCounterObject = {
                firstLineContactsCounter: 0,
                offsetsFromRight: {},
                initiated: []
            };

            // Hide "Archive" "Delete" buttons according to the current folder 
            //$scope.insideDeleteFolder = $rootScope.selectedFolder.type === rxConsts.FOLDER_TYPE.DELETED_ITEMS;
            //$scope.insideArchiveFolder = $rootScope.selectedFolder.type === rxConsts.FOLDER_TYPE.ARCHIVE;

            $log.debug('^^^^^ loading discussion', $scope.selectedThread);

            EmitterService.invoke(EmitterService.uiEvents.toggleResetChange, null, CTRL_NAME); //broadcast changed state            

            var query = {
                    threadUIDs: [$scope.selectedThread.uid]
                },
                repoOptions = {
                    parentUID: query.threadUIDs[0]
                };

            var existingData = repos.messages.getFilteredData.call(repos.messages);

            if (existingData.length) {
                handleMessagesData(existingData);
                hasLocalData = true;
            }

            rxPresenceService.subscribeToPresenceEvents($scope.selectedThread);

            function handleMessagesData(data) {
                data = filter('unique')(data, 'internetMessageId');

                $log.debug('^^^ received specific discussion messages ', data);
                // We take the date at index 0 just for now, because the query has no meaning and therefore we get all the data unfiltered,
                // instead of the relevant data only.
                setDiscussion(data);

                $scope.discussionLoaded = true;
            }
        }




        function getMessageToScrollTo() {
            if ($scope.unreadMessages.length) {
                return $scope.unreadMessages[0];
            } else if ($scope.readMessages.length) {
                return $scope.readMessages[$scope.readMessages.length - 1];
            }

            return null;
        }

        function setDiscussion(data) {
            $log.debug('set discussion called with data', data);
            $log.debug('selected thread is', $scope.selectedThread);

            $scope.preConversation = null;

            $scope.unreadMessages = [];
            $scope.readMessages = [];
            addMessagesToLists(data);
        }

        var forwardedMessageHandler = function(forwardObject) {
            $log.debug('forward msg handler', forwardObject);
            $scope.forwardMessage = forwardObject.msg;
            $log.debug('ready forwarded message', $scope.forwardMessage);
        };

        var scrollTo = function(id, delay) {
            var element = null;
            var dTime = (delay !== undefined) ? delay : 2000;
            setTimeout(function() {
                element = angular.element(document.getElementById(id));
            }, dTime);
        };

        function viewToggleHandler(bol) {
            $scope.viewToggle = bol;
        }

        function moveConversationHandler(targetFolder) {
            if (!targetFolder) {
                console.error("no destination given to move conversation");
                return;
            }
        }

        function moveThreadToArchiveHandler() {
            moveConversationToFolderWithType(rxConsts.FOLDER_TYPE.ARCHIVE);
        }

        function moveThreadToTrashHandler() {
            moveConversationToFolderWithType(rxConsts.FOLDER_TYPE.DELETED_ITEMS);
        }

        function moveConversationToFolderWithType(folderType) {
            var folder = repos.mailBoxFolders.getFilteredData({
                propertyFilters: {
                    type: folderType
                }
            });

            moveConversationHandler(folder[0]);
        }

        // bind cmd+delete to archive conversation
        hotkeys.bindTo($scope).add({
            combo: rxUtilities.isMacOS() ? 'mod+ctrl+a' : 'ctrl+shift+a',
            description: 'Archive the conversation',
            callback: moveThreadToArchiveHandler
        });

        // ------------------- END ------------------- //

        // ---------------- Scope Vars --------------- //
        $scope.activeUser = ActiveUser.get();
        $scope.preScrollControl = {};
        $scope.rxConsts = rxConfig.consts;
        $scope.discussionLoaded = false;
        $scope.readMessages = [];
        $scope.unreadMessages = [];
        $scope.typingUsers = {};
        $scope.shouldHideArchiveFolder = false;

        $scope.moveThreadToArchive = moveThreadToArchiveHandler;
        $scope.moveThreadToTrash = moveThreadToTrashHandler;
        $scope.viewToggleHandler = viewToggleHandler;

        $scope.dropdownFolderView = [{
            "text": "<i class=\"fa fa-folder\"></i>&nbsp;&nbsp;haaa",
            "click": ""
        }];

        $scope.myTree = {};

        $scope.moveTo = function() {
            $scope.mailBoxFolders = repos.mailBoxFolders.getFilteredData.call(repos.mailBoxFolders);
            $scope.dropdownFolderView = $scope.mailBoxFolders || [];

            function setFolderTreeParams() {
                var labelPresent = false;
                for (var i = 0; i < $scope.mailBoxFolders.length; i++) {
                    if ($scope.mailBoxFolders[i].type && $scope.mailBoxFolders[i].type == 'LABEL') {
                        labelPresent = true;
                        break;
                    }
                }
                if (!labelPresent) {
                    $scope.mailBoxFolders.push({
                        label: 'folders',
                        type: 'LABEL'
                    });
                }

                for (var i = 0; i < $scope.mailBoxFolders.length; i++) {
                    checkFolderType($scope.mailBoxFolders[i]);
                }

                function checkFolderType(folder) {
                    switch (folder.type) {
                        case 'GENERAL':
                            folder.sortNum = 2;
                            folder.classes = ['nonsystem-folder'];
                            folder.iconLeaf = ['icon icon-folder-action icon-folder-action-dims'];
                            folder.selectedIcon = 'icon-folder-active';
                            break;
                        case 'LABEL':
                            folder.sortNum = 1;
                            folder.classes = ['not-folder'];
                            break;
                        default:
                            folder.sortNum = 0;
                            folder.classes = ['system-folder'];
                            if (folder.label === "Inbox") { // this makes sure inbox is on the top
                                folder.sortNum = -1;
                            }
                    }
                    if (folder.children && folder.children.length > 0) {
                        for (var j = 0; j < folder.children.length; j++) {
                            checkFolderType(folder.children[j]);
                        }
                    }
                }

                $scope.mailBoxFolders.sort(function(a, b) { // sorts folders by type
                    if (a.sortNum > b.sortNum) {
                        return 1;
                    }
                    if (a.sortNum < b.sortNum) {
                        return -1;
                    }
                    return 0;
                });
            }
        };

        $scope.headerStyle = {
            opacityIn: 0,
            opacityOut: 1
        };

        // ------------------- END ------------------- //

        // ------------- Local Functions ------------- //
        function userTyping(userTypingRTObj) {
            $log.debug('received user typing notification in controller', userTypingRTObj);

            if ($scope.selectedThread && userTypingRTObj.threadUID === $scope.selectedThread.uid && userTypingRTObj.mailBoxUID !== activeUserMailBoxAddress) {
                var _typingUser = repos.contacts.getItem(userTypingRTObj.mailBoxUID);

                $scope.activateScroll.saveCurrentDistanceFromBottom();

                if (!_typingUser) {
                    return;
                }

                if (!$scope.typingUsers[_typingUser.uid]) {
                    $scope.typingUsers[_typingUser.uid] = {
                        user: _typingUser,
                        typing: []
                    };
                }

                var promise = $timeout(function() {
                    // clearTypingUser(user.uid);
                    if ($scope.typingUsers[_typingUser.uid]) {
                        $scope.typingUsers[_typingUser.uid].typing.shift();

                        $log.debug('typingUsers changed [T/O CLEARED]: ', $scope.typingUsers);
                    }
                }, 6000);
                $scope.activateScroll.activate();
                $scope.typingUsers[_typingUser.uid].typing.push(promise);

                $scope.$apply();

                $log.debug('typingUsers changed [ADDED]: ', $scope.typingUsers);
            }
        }

        function clearTyping(userId) {
            if (userId && $scope.typingUsers[userId]) {
                var user = $scope.typingUsers[userId];
                for (var i = 0; i < user.typing.length; i++) {
                    $timeout.cancel(user.typing[i]);
                };
                user.typing = [];
            } else {
                for (var userId in $scope.typingUsers) {
                    var user = $scope.typingUsers[userId];
                    for (var i = 0; i < user.typing.length; i++) {
                        $timeout.cancel(user.typing[i]);
                    };
                }
                $scope.typingUsers = {};
            }
        }

        $scope.isAttachmentImage = function(attachment) {
            return (/\.(gif|jpg|jpeg|tiff|png)$/i).test(attachment.name);
        }

        $scope.getAttachmentThumb = function(attachment) {
            if (attachment.type === 'image') {
                var parameters = {
                    fileUID: attachment.uid,
                    redirect: true,
                    sessionUID: ActiveUser.getSessionToken()
                }

                if (attachment.versionNumber) {
                    parameters.versionUID = attachment.versionNumber
                }

                var link = APIURLs.getFile + '?' + Object.keys(parameters).map(function(key) {
                    return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
                }).join('&');

                attachment.thumbnail = link;

                return link;
            } else {
                var parameters = {
                    fileUID: attachment.uid,
                    sessionUID: ActiveUser.getSessionToken()
                };

                var link = APIURLs.thumbnails + '?' + Object.keys(parameters).map(function(key) {
                    return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
                }).join('&');

                attachment.thumbnail = link;

                return link;
            }
        }

        $scope.selectAttachment = function(attachment) {
            $log.debug('selected attachment:', attachment);

            $scope.selectedAttachment = attachment;
        };

        $scope._selectAttachment = function(attachment) {
            $log.debug('selected attachment:', attachment);

            $scope.downloadAttachment(attachment);
        };

        $scope.downloadAttachment = function(attachment) {
            $log.debug('download attachment:', attachment);

            if (!attachment.originalMessage) {
                $log.debug('Attachment not ready for download');
                return;
            }

            var link = attachment.getDownloadUrl(true, true);
            rxUtilities.downloadLink(link);
        };

        $scope.previewDocument = function(attachment) {
            $log.debug('preview doc: ', attachment);

            if (attachment.isPreviewSupported || attachment.type === 'image') {
                EmitterService.invoke(EmitterService.uiEvents.initializeFilePreviewer, attachment);
            }
        };

        $scope.getConversationByline = function(thread) {
            if (!thread) return [];

            var users = thread.participants;

            // Sort users alphabeticly where groups are first
            users = users.sort(function(p1, p2) {
                if (p1.contactType === p2.contactType) {
                    return p1.getDisplayName() < p2.getDisplayName() ? -1 : 1;
                }

                return p1.contactType === "GROUP" ? -1 : 1;
            });

            // Clear the $$hashKey so the dom will be rebuild and the positionTop change event will be called
            users.forEach(function(user) {
                user.$$hashKey = undefined;
            })

            return users;
        }

        $scope.popover = {
            "title": "Add participants"
        };

        $scope.toggleMoveDiscussionPopover = function() {
            EmitterService.invoke(EmitterService.uiEvents.toggleMoveDiscussionPopover, null, CTRL_NAME);
        };

        $scope.markUnreadFromHere = function(messageToMark) {
            var allMessages = $scope.readMessages.concat($scope.unreadMessages);

            //mark everything above this message as read and below as unread 
            var messageToMarkIndex = allMessages.indexOf(messageToMark);
            console.assert(messageToMarkIndex >= 0, "Could not find the message to mark unread from");

            var massagesToMarkAsRead = [];
            var messagesToMarkAsUnread = [];

            allMessages.forEach(function(message, index) {
                var oldIsReadValue = message.isRead;
                var newIsReadVal = index < messageToMarkIndex;

                if (message.isRead != newIsReadVal) {
                    // Value has changed --> update the message and insert it to the right list
                    message.setSeenState({
                        isRead: newIsReadVal
                    });

                    if (newIsReadVal) {
                        massagesToMarkAsRead.push(message);
                    } else {
                        messagesToMarkAsUnread.push(message);
                    }
                }
            });

            // Notify the server with two seperate calls one for unread and one for read
            if (massagesToMarkAsRead.length) {
                repos.messages.updateItemsFields.call(repos.messages, massagesToMarkAsRead, {
                    isRead: true
                }, {
                    notifyServerOnly: true
                });
            };

            if (messagesToMarkAsUnread.length) {
                repos.messages.updateItemsFields.call(repos.messages, messagesToMarkAsUnread, {
                    isRead: false
                }, {
                    notifyServerOnly: true
                });
            };

            $scope.supressSetRead = true;
            $scope.shouldShowUnreadLine = true;

            // Build the read/unread lists again and scroll to the read/unread line
            $scope.unreadMessages = [];
            $scope.readMessages = [];
            addMessagesToLists(allMessages);
        }

        $scope.backToPreviews = function() {
            //RealTime.disconnect();
            $timeout(function() {
                resetViewHandler();
            }, 300);
        }

        // Thread updated we need to update the byline list 
        function threadsRepoItemsUpdatedHandler(items) {
            if (items && items.length && $scope.selectedThread && $scope.conversationByline &&
                items[0].uid === $scope.selectedThread.uid &&
                $scope.selectedThread.participants.length != $scope.conversationByline.length) {

                $scope.conversationByline = $scope.getConversationByline(items[0]);
                $scope.chipCounterObject = {
                    firstLineContactsCounter: 0,
                    offsetsFromRight: {},
                    initiated: []
                };
            }
        };

        // ------------------- END ------------------- //
        // ------------- Event Listeners ------------- //
        //RealTime.on(RealTime.events.USER_TYPING, userTyping);

        repos.messages.on(repos.messages.events.collectionChanged, repoCollectionChangedHandler);
        repos.messages.on(repos.messages.events.itemsAdded, repoItemsAddedHandler);
        repos.messages.on(repos.messages.events.itemsUpdated, repoItemsUpdatedHandler);
        repos.messages.on(repos.messages.events.itemsRemoved, repoItemsRemovedHandler);
        repos.threads.on(repos.threads.events.itemsUpdated, threadsRepoItemsUpdatedHandler);

        RealTime.on(RealTime.events.USER_TYPING, userTyping);

        // To reset the discussion display
        EmitterService.on(EmitterService.uiEvents.resetMessagesView, resetViewHandler);
        EmitterService.on(EmitterService.uiEvents.discussionSelected, discussionSelectedHandler);

        // Very Very important to unsubscribe to events on destroy!
        $scope.$on('$destroy', function() {
            repos.messages.off(repos.messages.events.collectionChanged, repoCollectionChangedHandler);
            repos.messages.off(repos.messages.events.itemsAdded, repoItemsAddedHandler);
            repos.messages.off(repos.messages.events.itemsUpdated, repoItemsUpdatedHandler);
            repos.messages.off(repos.messages.events.itemsRemoved, repoItemsRemovedHandler);
            repos.threads.off(repos.threads.events.itemsUpdated, threadsRepoItemsUpdatedHandler);

            EmitterService.off(EmitterService.uiEvents.resetMessagesView, resetViewHandler);
            EmitterService.off(EmitterService.uiEvents.discussionSelected, discussionSelectedHandler);

        });
        // ------------------- END ------------------- //
        // ---------- Controller Initializers -------- //
        // ------------------- END ------------------- //
    }
]);

angular.module('redKix').controller('DiscussionTreeClosedCtrl', function($sce, $scope) {
    $scope.$on('$destroy', function() {
        $('#DiscTreeViewPort').scrollTop(0);
    });
});