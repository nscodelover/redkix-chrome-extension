'use strict';

angular.module('redKix').controller('newReplyCtrl', ['$rootScope', '$scope', '$http', '$rxEv', '$timeout', '$rxRepoService', 'ngDialog', '$q', '$filter', '$redKixActiveUserService', '$rxApiURLs', '$rxOutbound', '$rxConfig', '$rxUtilities', '$rxRT',
    function($rootScope, $scope, $http, EmitterService, $timeout, repoService, ngDialog, $q, $filter, ActiveUser, apiUrls, rxOutbound, rxConfig, rxUtilities, RealTime) {
        // ---------------- User Vars ---------------- // 
        var CTRL_NAME = 'newReplyCtrl',
            activeUserObj = ActiveUser.get(),
            rxConsts = rxConfig.consts,
            repos = repoService.getAllRepos(),
            FLOW_TYPES = rxConsts.FLOW_TYPE,
            invokedFromThisCtrl = false,
            blockTypingNotification = false;

        $scope.editorPlaceholderLabel = '<span class="tinymce-placeholder" contenteditable="false">Reply All...</span>';


        // Determine if the reply message contains any data in the body or in the attachments.
        function doesReplyMessageHasData() {

            return $scope.newMessageBodyHTML !== '';
        }

        $scope.$watch(doesReplyMessageHasData, function(newValue) {
            $scope.$parent.replyForm.$setValidity('Message has no data', newValue);
        });

        function openErrorDialog(message) {
            var nestedDialog = ngDialog.openConfirm({
                template: '\
                        <p>' + message + '</p>\
                        <div class="ngdialog-buttons">\
                        <button type="button" style="width:80px" class="ngdialog-button ngdialog-button-cancel" ng-click="confirm()">\
                        <div>OK</div></button>\
                        </div>',
                plain: true,
                overlay: true,
                showClose: false,
                disableAnimation: true,
                name: 'confirm',
                className: 'ngdialog-theme-redkix-confirm ngdialog-theme-default',
            });
            return nestedDialog
        }

        function onProgressHandler() {
            // The file.percentComplete has change, reflect it in the UI (call digest).
            $timeout(function() {
                $scope.$digest();
            }, 0);
        }


        function setSelectedThread() {
            $scope.selectedThread = threadsRepo.getItem(stateParams.threadId);

            console.debug('setting selected thread to', $scope.selectedThread);
        }

        function newReplyHandler() {
            // after a new reply, editor stays focused
            InlineEditor.open(true);
        }


        function resetReplyBox(stayFocused) {
            stayFocused = typeof stayFocused === 'boolean' ? stayFocused : false;

            // Reset reply text area, and stay focused if needed
            InlineEditor.close(stayFocused);
            $scope.silentInject = true;

            $scope.newMessageBodyHTML = "";
        }

        function postMessageHandler() {
            $scope.newMessageJSON.bodyHTML = tinyMCE.get($('#innerEditor').children()[0].id).getContent();

            rxOutbound.sendMessage($scope.newMessageJSON, $scope.selectedThread.uid);

            // stay focused
            resetReplyBox(true);
        }

        function stripAllPrefixes(subject) {

            if (!subject) return '';

            var prefixes = ['fwd:', 'fw:', 're:'];

            // Trim spaces at the begining 
            subject = subject.replace(/^\s\s*/, '');

            do {
                var prefixRemoved = false;
                prefixes.forEach(function(prefix) {

                    if (subject.toLowerCase().indexOf(prefix) == 0) {
                        // Remove the prefix and trim the start
                        subject = subject.slice(prefix.length).replace(/^\s\s*/, '');

                        prefixRemoved = true;
                    }
                });
            }
            while (prefixRemoved);

            return subject;
        }


        function fetchNewMessage() {
            if (!$scope.selectedThread) {
                setSelectedThread();
            }

            console.debug('Fetch to selected thread ', $scope.selectedThread, ' flow type is reply all');

            // Generating request-uid that will be replaced when we get server ok response            
            var uid = rxUtilities.generateGUID(),
                conversationUID = $scope.selectedThread ? $scope.selectedThread.parents[0].uid : null,
                threadUID = $scope.selectedThread ? $scope.selectedThread.uid : null,
                subject = $scope.selectedThread ? $scope.selectedThread.subject : null;

            // Notice!!! - The 'to' and 'cc' are updated according to the last message in the thread just before the message
            // is sent (rxOutbound.send())

            $scope.newMessageJSON = {
                uid: uid,
                flowType: FLOW_TYPES.REPLY_ALL,
                conversationUID: conversationUID,
                toMailBoxes: [], // Notice!!! - The 'to' and 'cc' are updated according to the last message
                ccMailBoxes: [], // in the thread just before the message is sent (rxOutbound.send())
                bccMailBoxes: [],
                threadUID: threadUID,
                subject: subject,
                sentState: rxConfig.consts.SENT_STATE.PENDING,
                isRead: true
            };

            console.debug('fetched new message is', $scope.newMessageJSON);
        }

        function replyMessageHandler() {
            fetchNewMessage();

            $scope.newMessageJSON.bodyHTML = $scope.newMessageBodyHTML;

            $scope.newMessageJSON.subject = ('Re: ').concat(stripAllPrefixes($scope.newMessageJSON.subject));
            console.debug('^^^^ new reply is ', $scope.newMessageJSON);

            postMessageHandler();
        }

        // var inlineReplyElement = angular.element('.border-proxy');
        // inlineReplyElement.on('click', function() {
        //     InlineEditor.open(true);
        // });


        $scope.showInlineEditor = false;

        var InlineEditor = {
            open: function(focusEditor) {
                $scope.showInlineEditor = true;

                if (focusEditor && tinymce.editors[0]) {
                    tinymce.editors[0].focus();
                    tinymce.editors[0].$().addClass('mce-focus');
                }

                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            },
            close: function(focusEditor) {
                $scope.showInlineEditor = false;

                if (focusEditor) {
                    tinymce.editors[0].focus();
                }

                if (tinymce.editors[0]) {
                    tinymce.editors[0].$().removeClass('mce-focus');
                }

                if (!$scope.$$phase) {
                    $scope.$apply();
                }
            }
        };

        /**
         * Will watch $scope.newMessageBodyHTML in order to enable or disable UI features.
         * The following UI features are currently Enabled \ Disabled:
         *  - Toggle the SEND button
         *  - Toggle user is typing
         *  - Toggle user my lose data browser notification
         * The features are toggle OFF together by:
         *  - if a silent injection into newMessageBodyHTML was triggered
         *  - if the new value of newMessageBodyHTML is the editor placeholder
         *  @listens change:newMessageBodyHTML
         */
        $scope.InlineEditor = InlineEditor;
        $scope.$watch('newMessageBodyHTML', function(newVal, oldVal) {
            if (!($scope.silentInject || newVal === $scope.editorPlaceholderLabel) && newVal && newVal !== oldVal && newVal !== '') {
                userIsTyping();

            } else {
                $scope.sendDisabled = true;

            }

            $scope.silentInject = false;
        }, true);

        function keyUpHandler(keyCode, e) {
            // pulseUserAvatarWhenTyping();

            var _prevLength = 0;
            var embedlyData = [];

            if (keyCode == 13 && e.ctrlKey) {
                var strToFind = '<p>&nbsp;</p>',
                    index = $scope.newMessageBodyHTML.lastIndexOf(strToFind),
                    stringCheck = rxUtilities.removeLineBreaks($scope.newMessageBodyHTML).replace(strToFind, '').replace(strToFind, '');

                if (stringCheck === '') {
                    $scope.newMessageBodyHTML = '';
                    return;
                }

                if ($scope.newMessageBodyHTML.endsWith(strToFind)) {
                    $scope.newMessageBodyHTML = $scope.newMessageBodyHTML.substring(0, index);
                }

                if ($scope.newMessageBodyHTML !== '') {
                    replyMessageHandler();
                }
            }
        }


        $scope.discard = function() {
            $scope.newMessageBodyHTML = '';

            resetReplyBox(true);

        }

        $scope.registerLoadingElmnt = function() {
            var loadingElm = angular.element(document.querySelector('#urlLoading'));
            var embedlyElmnt
            var i = setInterval(function() {
                embedlyElmnt = document.querySelector('#embedlyElmnt');
                if (!embedlyElmnt) {
                    embedlyElmnt = angular.element(embedlyElmnt);
                    loadingElm.hide();
                    clearInterval(i);
                }
            }, 200);
        }

        var userEditorAvatar = angular.element(document.querySelector('#userEditorAvatar'));
        var pulseUserAvatarWhenTyping = _.throttle(function() {
            userEditorAvatar.velocity('callout.pulse', 430);
        }, 530);

        function userIsTyping() {
            // if the user is hidden (bcc in the OP message), don't send user typing
            // send user typing only when the user replies all
            if (!(isActiveUserHidden() || blockTypingNotification)) {
                var bccUsers = $scope.message ? $scope.message.bccMailBoxes : [];
                // Add bcc if exists (only sender can see). This results in bcc seeing "is typing" notifications for the sender ONLY
                var notificationRecipients = $scope.selectedThread.participants.concat(bccUsers).filter(function(user) {
                    return user.mailBoxAddress !== activeUserObj.mailBoxAddress;
                }).map(function(user) {
                    return user.mailBoxAddress;
                });

                notificationRecipients = rxUtilities.arrayUnique(notificationRecipients);

                RealTime.send(RealTime.types.USER_TYPING, {
                    isTyping: true,
                    threadUID: $scope.selectedThread.uid,
                    conversationUID: $scope.selectedThread.parents[0].uid,
                }, notificationRecipients);

                blockTypingNotification = true;

                setTimeout(function() {
                    blockTypingNotification = false;
                }, 5000);
            }
        }

        // Checks if user is not in the thread participants explicitly, or as part of a group he belongs to
        function isActiveUserHidden() {
            var memberOfGroupUIDs = ActiveUser.getMemberOfGroupUIDs(),
                activeUserInParticipants = $scope.selectedThread.participants.filter(function(participant) {
                    return angular.equals(participant.uid, activeUserObj.uid) || memberOfGroupUIDs.indexOf(participant.uid) > -1;
                });

            return activeUserInParticipants.length === 0;
        }

        // ------------------- END ------------------- //
        // ---------------- Scope Vars --------------- //

        $scope.fileReaderSupported = window.FileReader != null && (window.FileAPI == null || FileAPI.html5 != false); // checks if FileLoader exists to display uploaded images on the fly 
        $scope.tinymceOptionsInline = {
            autoresize_bottom_margin: 0,
            skin: 'light',
            // toolbar: 'undo redo | bold italic | ltr rtl | alignleft aligncenter alignright alignjustify | bullist numlist | link image emoticons | fontselect fontsizeselect | forecolor backcolor',
            toolbar: false,
            menubar: false,
            forced_root_block: false,
            statusbar: false,
            paste_data_images: true,
            height: '350px',
            inline: true,
            browser_spellcheck: true,
            setup: function(editor) {
                editor.setHTMLContent = function(content) {
                    editor.setContent(content, {
                        format: 'html'
                    });
                };

                editor.getHTMLContent = function() {
                    return editor.getContent({
                        format: 'html'
                    });
                };

                editor.on('focus', function(e) {
                    var editorIsEmpty = editor.getHTMLContent().indexOf($scope.editorPlaceholderLabel) > -1;

                    if (editorIsEmpty) {
                        editor.setHTMLContent(editor.getHTMLContent().replace($scope.editorPlaceholderLabel, ''));
                        editor.undoManager.clear();
                        // set cursor at end of text in tinymce
                        editor.selection.select(editor.getBody(), true);
                        editor.selection.collapse(false);
                    }

                    if ($scope.isEditorDirty) {
                        $scope.isEditorDirty = false;
                        editor.selection.select(editor.getBody(), true);
                        editor.selection.collapse(false);
                    } else if (!editorIsEmpty && !$scope.showInlineEditor) {
                        $scope.showInlineEditor = true;
                    }

                    editor.$().closest('.border-proxy').addClass('border-focus');
                });

                editor.on('blur', function(e) {
                    var editorContent = editor.getContent();
                    // NOTE(@neilk): two different cases for safari and chrome
                    if ((editorContent === '' || editorContent === '&nbsp;') && !$scope.isEditorDirty) {
                        editor.setHTMLContent($scope.editorPlaceholderLabel);
                        InlineEditor.close();
                    }

                    editor.$().closest('.border-proxy').removeClass('border-focus');
                });
                editor.on('KeyDown', function(e) {
                    if (!$scope.showInlineEditor && isPrintableKey(e.keyCode)) {
                        InlineEditor.open(true);
                    }

                    if (!$scope.silentInject && isPrintableKey(e.keyCode)) {
                        userIsTyping();
                    }


                    var mod = /Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
                    if (mod && e.keyCode === 13) { 
                        sendHotkey(e);
                    }

                    // If we got arrow key and we don't have any text in the editor we navigate to the next/prev copnversation
                    if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && editor.getHTMLContent() === '') {
                        var messageEvent = e.code === 'ArrowUp' ? EmitterService.uiEvents.selectPrevPreview : EmitterService.uiEvents.selectNextPreview;
                        EmitterService.invoke(messageEvent, null, CTRL_NAME);
                    }
                });

                editor.on('paste', function(e) {
                    if (editor.getHTMLContent() === $scope.editorPlaceholderLabel) {
                        editor.setHTMLContent('');
                    }

                    $timeout(function() {
                        editor.fire('change');
                    });
                });

                editor.on('KeyUp', function(e) {
                    $timeout(function() {
                        editor.fire('change');
                    });
                });
            }
        };

        $scope.forceEditorOpen = function() {
            $scope.isEditorDirty = true;
        };

        $scope.focusEditor = function() {
            tinymce.editors[0].focus();
        };

        function isPrintableKey(keycode) {
            var valid =
                (keycode > 47 && keycode < 58) || // number keys
                keycode == 32 || keycode == 13 || // spacebar & return key(s) (if you want to allow carriage returns)
                (keycode > 64 && keycode < 91) || // letter keys
                (keycode > 95 && keycode < 112) || // numpad keys
                (keycode > 185 && keycode < 193) || // ;=,-./` (in order)
                (keycode > 218 && keycode < 223); // [\]' (in order)

            return valid;
        }

        // NOTE(@neilk): added this for disabling the placeholder in tinymce only when the user starts typing.
        // might be useful so I'm leaving this here.
        function isDeleteOrBackspaceKey(key) {
            if (key == 8 || key == 46) { // 8 - backspace; 46 - delete
                return true;
            }
        }
 
        function sendHotkey(event) { 
            event.stopPropagation();
            event.preventDefault();

            // if the user type very quickly and pressed on sendshortcut we may not have a chance to run digest so we use jquery for the check.
            if ($scope.sendDisabled && $('#ui-tinymce-0').text().length > 0 ) {
                $scope.newMessageBodyHTML = $('#ui-tinymce-0').text();
                $scope.sendDisabled = false;
            }

            if (!$scope.sendDisabled) {
                console.log('hotsend executed');
                $scope.sendDisabled = true; 
                $scope.postReply();
                $timeout(function() {
                    if (!$scope.$$phase) {
                        $scope.$apply(function() {
                            tinyMCE.activeEditor.getElement().blur();
                            InlineEditor.close(true);
                            $scope.newMessageBodyHTML = "";
                            tinyMCE.activeEditor.setContent("");
                        });
                    }
                });
            }
        }

        function discussionSelectedHandler() {
            resetReplyBox();

            // if editor is in focus we shoud not add the "Reply All..." placeholder
            var hasFocus = tinymce.editors && tinymce.editors[0] && tinymce.editors[0].$().hasClass('mce-edit-focus');
            var placeHolder = hasFocus ? '' : $scope.editorPlaceholderLabel;

            $scope.newMessageBodyHTML = placeHolder;
            $scope.silentInject = !hasFocus;

        }

        $scope.formatPopoverFunctions = {
            bold: function() {
                tinyMCE.activeEditor.execCommand('bold');
            },
            italic: function() {
                tinyMCE.activeEditor.execCommand('italic');
            },
            link: function() {
                var linkAttrs = {
                    href: 'http://www.redkix.com',
                    target: null,
                    rel: null,
                    "class": 'rklink',
                    title: null
                };
                tinyMCE.activeEditor.execCommand('mceInsertLink', true, linkAttrs);
            },
            H1: function() {
                tinyMCE.activeEditor.formatter.apply('h1');
            },
        };
        $scope.state = false;
        $scope.formatPopoverTools = {
            bold: {
                "order": 1,
                "text": "bold",
                "click": "formatPopoverFunctions['bold']()",
                "state": $scope.state,
                "icon": 'fa fa-bold'
            },
            italic: {
                "order": 2,
                "text": "italic",
                "click": "formatPopoverFunctions['italic']()",
                "state": $scope.state,
                "icon": 'fa fa-italic'
            },
            link: {
                "order": 3,
                "text": "link",
                "click": "formatPopoverFunctions['link']()",
                "state": $scope.state,
                "icon": 'fa fa-link',
                "trueStateIcon": 'fa fa-link',
                "falseStateIcon": 'fa fa-chain-broken',
            },
            H1: {
                "order": 4,
                "text": "H1",
                "click": "formatPopoverFunctions['H1']()",
                "state": $scope.state,
                "icon": '',
            }
        };
        // var formatPopover = $popover($('#innerEditor'), {
        //     container: $('#innerEditor'),
        //     target: $('#innerEditor'),
        //     title: 'My Title',
        //     content: $scope.formatPopoverTools,
        //     trigger: 'manual',
        //     placement: 'top',
        //     scope: $scope,
        //     contentTemplate: '/views/composeFloater.html',
        // });
        // console.debug('Happened Once', formatPopover);
        // formatPopover.$promise.then(function() {
        //     tinyMCE.activeEditor.formatter.formatChanged('bold', function(state) {
        //         $scope.formatPopoverTools['bold'].state = state;
        //     });
        //     tinyMCE.activeEditor.formatter.formatChanged('italic', function(state) {
        //         $scope.formatPopoverTools['italic'].state = state;
        //     });

        //     tinyMCE.activeEditor.on('mouseUp', selectedTextMouseUp);

        //     $scope.$watch(angular.bind(this, function() { // watches changes to text selection
        //         return tinyMCE.activeEditor.selection.getContent();
        //     }), function(newVal, oldVal) {
        //         console.debug('Selection changed to ' + newVal);
        //     });

        //     function selectedTextMouseUp(e) {
        //         $scope.$apply();
        //         setTimeout(function() {
        //             if (!tinyMCE.activeEditor.selection.isCollapsed()) {
        //                 var bookmarkNum = tinyMCE.activeEditor.selection.getBookmark().id;
        //                 var bookmarkStart = $('#' + bookmarkNum + '_start');
        //                 bookmarkStart.css({
        //                     'font-family': 'initial'
        //                 });
        //                 var bookmarkEnd = $('#' + bookmarkNum + '_end');
        //                 bookmarkEnd.css({
        //                     'font-family': 'initial'
        //                 });
        //                 formatPopover.$options.target = bookmarkStart;
        //                 formatPopover.show();
        //             } else {
        //                 formatPopover.hide();
        //             }
        //         }, 10);

        //     };
        //     var editorElement = $(tinyMCE.activeEditor.bodyElement);
        //     editorElement.on('scroll', scrollHider);

        //     function scrollHider() {
        //         if (formatPopover && formatPopover.$isShown)
        //             formatPopover.hide();
        //     }
        // });

        $scope.chevronSide = "glyphicon-chevron-up";
        $scope.tagsControl = {};
        $scope.userData = activeUserObj;
        //file upload scope vars
        $scope.fileProperties = []; // UI properties of file being uploaded
        $scope.upload = []; // upload object
        $scope.fileQueue = []; // complete file upload repo
        $scope.queue = []; // file upload queue
        $scope.uploadRunning = false; // indicates if the queue loader is running
        $scope.postMessage = postMessageHandler;
        $scope.postReply = replyMessageHandler;
        $scope.keyUp = keyUpHandler;
        // ------------------- END ------------------- //



        // ------------- Local Functions ------------- //
        function getEmbedly(url) {
            var url = escape(url);
            return $http.get('http://api.embed.ly/1/oembed?url=' + url);
        }

        function urlify(text) {
            var urlRegex = /\b(www.\w+.\w{2,})?(https?:\/\/[^\s]+)?/g;
            var list = text.match(urlRegex) || [];
            var pReg = /(<\/p>)?(&nbsp;)?/g;
            var res = [];
            for (var i = list.length - 1; i >= 0; i--) {
                var l = list[i].replace(pReg, '');
                if (l != "") {
                    res.push(l);
                    text = text.replace(l, '<a class="linkInRedKix">' + l + '</a>');
                }
            };
            return {
                urls: res,
                bodyHTML: text
            };
        }
        // ------------------- END ------------------- //

        // ------------- Event Listeners ------------- //
        EmitterService.on(EmitterService.uiEvents.replyAll, newReplyHandler);
        EmitterService.on(EmitterService.uiEvents.discussionSelected, discussionSelectedHandler);

        // Very Very important to unsubscribe to events on destroy!
        $scope.$on('$destroy', function() {
            EmitterService.off(EmitterService.uiEvents.replyAll, newReplyHandler);
            EmitterService.off(EmitterService.uiEvents.discussionSelected, resetReplyBox);
            // EmitterService.off(EmitterService.uiEvents.fileDraggedIntoView, fileDraggedIntoViewHandler);
        });

        // ------------------- END ------------------- //

        // ---------- Controller Initializers -------- // 
        // ------------------- END ------------------- //
    }
]);