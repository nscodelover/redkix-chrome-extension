'use strict';

angular.module('redKix').controller('ComposeModalCtrl', ['$scope', '$rootScope', '$timeout', '$rxRepoService', 'ngDialog', '$q', '$filter',
    '$rxOutbound', '$rxUtilities', '$log', '$rxConfig', '$redKixActiveUserService', '$rxDataApi', 'hotkeys', '$sce',
    function($scope, $rootScope, $timeout, repoService, ngDialog, $q, $filter,
        rxOutbound, rxUtilities, $log, rxConfig, ActiveUser, DataApi, hotkeys, $sce) {
        // ---------------- User Vars ---------------- //
        var CTRL_NAME = 'ComposeModalCtrl',
            repos = repoService.getAllRepos(),
            rxConsts = rxConfig.consts,
            FLOW_TYPES = rxConsts.FLOW_TYPE,
            sessionUID = ActiveUser.getSessionToken(),
            invokedFromThisCtrl = false,
            initialMessageBody = null,
            attachDialogID,
            subject = $scope.ngDialogData.subject,
            body = $scope.ngDialogData.bodyHtml,
            searchQuery = $scope.ngDialogData.searchQuery,
            timeoutId;

        // ------------------- END ------------------- //

        // ------------ Function Handlers ------------ //
        function init() {
            // Resolve contacts that have no display name, before we open compose modal and start searching them
            //resolveContactsIfNecessary(repos.contacts.getAllData());

            // if there is a related message
            if ($scope.ngDialogData.relatedMessage) {
                fetchNewMessage($scope.ngDialogData.relatedMessage, $scope.ngDialogData.flowType);
                retrieveEditableQuoteData($scope.ngDialogData.relatedMessage, $scope.ngDialogData.flowType);
            } else {
                // If it is a new message
                resetForm();
            }

            // according to the flow, we change different parts of the message's body
            var flowType = $scope.ngDialogData.flowType;

            $scope.bodyByFlow = flowType === FLOW_TYPES.FORWARD || flowType === FLOW_TYPES.REPLY_ONE ? 'fullBodyHTML' : 'bodyHTML';
            //addSignatures();
        }

        /*function resolveContactsIfNecessary(contacts) {
            var contactsToResolve = [];

            contactsToResolve = contacts.filter(function(contact) {
                return contact && !(contact.getDisplayName());
            });

            if (contactsToResolve.length) {
                return rxOutbound.resolveContacts(contactsToResolve.map(contact => contact.mailBoxAddress));
            }

            return $q.when();
        }


        function addSignatures() {
            var userPreferences = ActiveUser.getUserPreferences(),
                rkSignature = userPreferences.includeRedkixSignature && ActiveUser.rkSignatures ? _.sample(ActiveUser.rkSignatures).replace('<referrer>', ActiveUser.getMailBoxAddress()) : '';

            $scope.newMessageJSON[$scope.bodyByFlow] = userPreferences.includeRedkixSignature || userPreferences.includeUserSignature ? '<br><br>' : '';
            $scope.newMessageJSON[$scope.bodyByFlow] += userPreferences.includeUserSignature ? `<p> ${userPreferences.userSignature.replace(/\n/g,'<br>')} </p>` : '';
            $scope.newMessageJSON[$scope.bodyByFlow] += userPreferences.includeRedkixSignature ? `<p> ${rkSignature} </p>` : '';
        }*/

        function doesMessageContainsData() {
            // Check recipients is not empty
            if ($scope.newMessageJSON.toMailBoxes.length > 0 || $scope.newMessageJSON.ccMailBoxes.length > 0 || $scope.newMessageJSON.bccMailBoxes.length > 0) {
                return true;
            }

            // check body is not empty
            if ($scope.newMessageJSON[$scope.bodyByFlow] && $scope.newMessageJSON[$scope.bodyByFlow] !== initialMessageBody && initialMessageBody != null) {
                return true;
            }

            if ($scope.newMessageJSON.subject) {
                return true;
            }

            var containsValidFiles = false;

            if (containsValidFiles) {
                return true;
            }

            return false;
        }

        hotkeys.bindTo($scope).add({
            combo: 'mod+enter',
            description: 'send the message',
            callback: sendHotkey,
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA', 'DIV']
        });

        function sendHotkey(event) {
            if (!$scope.sendDisabled) {
                console.log('hotsend executed');
                event.preventDefault();
                postMessageHandler();
            }
        }
        /*

                $scope.myFiles = [];
                $scope.files = [];

                $scope.openFileDialog = function() {
                    // The div of the file dialog can show the dialog only if it's being clicked.
                    // we cannot put this div inside the popover since it is auto closed.
                    angular.element('#fileDialogDiv').click();
                }

                $scope.$watch('myFiles', function(files) {
                    $scope.formUpload = false;
                    if (files && files.length > 0) {
                        for (var i = 0; i < files.length; i++) {
                            $scope.errorMsg = null;
                            (function(file) {
                                extendFile(file);
                                if (!file.name) {
                                    var extension = rxUtilities.getExtensionFromMimeType(file.type);
                                    file.name = 'file' + ($scope.files.length + i + 1) + extension;
                                }
                                // $scope.generateThumb(file);
                                $scope.files.push(file);

                                uploadFile(file, false);
                            })(files[i]);
                        }
                    }
                });

                function addBoxFiles(files) {
                    if (files && files.length > 0) {
                        for (var i = 0; i < files.length; i++) {
                            $scope.errorMsg = null;
                            (function(file) {
                                extendFile(file);
                                if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file.name)) {
                                    file.dataUrl = file.url;
                                }
                                $scope.files.push(file);

                                $scope.$apply();

                                $log.debug('files changed: ', $scope.files);

                                uploadFileWGET(file, false);
                            })(files[i]);
                        }
                    }
                }

                // $scope.$watch('boxFiles', function(files) {
                //     $log.debug('boxFiles changed: ', files);
                //     if (files != null) {
                //         for (var i = 0; i < files.length; i++) {
                //             $scope.errorMsg = null;
                //             (function(file) {
                //                 extendFile(file);
                //                 if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(file.name)) {
                //                     file.dataUrl = file.url;
                //                 }
                //                 $scope.files.push(file);
                //                 $scope.$apply();
                //                 $log.debug('files changed: ', $scope.files);
                //                 // uploadFileWGET(file);
                //             })(files[i]);
                //         }
                //     }
                // });

                $scope.attachmentNotReadyCounter = 0;

                $scope.generateThumb = function(file) {
                    if (file != null) {
                        $log.debug('% Generation thumb for: ', file.name);
                        if ($scope.fileReaderSupported && file.type.indexOf('image') > -1) {
                            $timeout(function() {
                                var fileReader = new FileReader();
                                fileReader.readAsDataURL(file);
                                fileReader.onload = function(e) {
                                    $timeout(function() {
                                        file.dataUrl = e.target.result;
                                    });
                                }
                            });
                        }
                    }
                };

                $scope.openAttachModal = function() {
                    $scope.shouldShowAttachFilesPopup = true;
                }

                // Set the canCloseDialogWithoutWarning function so the preCloseCallback of the dialog creator can call to determine if the warning dialog is needed.
                $scope.$parent.canCloseDialogWithoutWarning = function() {
                    return !doesMessageContainsData();
                };

                function extendFile(file) {
                    file.remove = function() {
                        file.ignore = true;
                        $log.debug(file);
                        if (file.status === 'progress')
                            file.upload.abort();
                        if (file.abortUpload)
                            file.abortUpload();
                    }
                }

                function uploadFileWGET(file, isSmartAttachment) {
                    // api request with all data available
                    $scope.attachmentNotReadyCounter++;
                    fileManager.remoteUpload(file, null, isSmartAttachment).then(function(res) {
                        $scope.attachmentNotReadyCounter--;

                        repos.files.addItems.call(repos.files, file, {
                            skipEventEmitting: true
                        });
                    }, function(res) {
                        $scope.attachmentNotReadyCounter--;

                    });
                }

                function onProgressHandler() {
                    // The file.percentComplete has change, reflect it in the UI (call digest).
                    $timeout(function() {
                        $scope.$digest();
                    }, 0);
                }

                function uploadFile(file, isSmartAttachment) {
                    $scope.attachmentNotReadyCounter++;


                    file.percentCompleted = 0;
                    onProgressHandler(0);

                    // Ask Redkix server for S3 server link
                    fileManager.getReady(file, null, isSmartAttachment).then(function(res) {
                        $log.debug('get ready res', res);

                        $scope.attachmentNotReadyCounter--;

                        if (!res.data.file.signedRequest) {
                            repos.files.addItems.call(repos.files, file, {
                                skipEventEmitting: true
                            });
                            return;
                        }

                        // Upload to S3 Server
                        fileManager.fileUploadWithSignedRequest(file, res.data.file.signedRequest, false, onProgressHandler).then(function() {
                            $log.debug('file upload succeeded');

                            fileManager.updateFileUploadStatus(file, 'FINISHED').then(function(res) {
                                $log.debug('file status updated successfuly');

                                repos.files.addItems.call(repos.files, file, {
                                    skipEventEmitting: true
                                });
                            }, function(err) {
                                console.error("Failed updating file's status", err);
                            });

                        }, function(err) {
                            console.error('received error during file upload to s3', err);

                            fileManager.updateFileUploadStatus(file, 'ERROR').then(function(res) {
                                $log.debug('file status updated successfuly');
                            }, function(err) {
                                console.error("Failed updating file's status", err);
                            });
                        });
                    }, function(res) {
                        $scope.attachmentNotReadyCounter--;

                        if (res && res.fileTooBigMessage) {
                            // open error dialog if it is not opened already
                            if (ngDialog.getOpenDialogs().length === 1) {
                                openErrorDialog(res.fileTooBigMessage);
                            }

                            // Remove the file from the array
                            $scope.files.splice($scope.files.indexOf(file), 1);
                        }
                    });
                }
        */
        function fetchNewMessage(relatedMessage) {
            // Generating request-uid that will be replaced when we get server ok response
            var uid = rxUtilities.generateGUID(),
                flowType = flowType ? flowType : FLOW_TYPES.NEW_DISCUSSION,
                parentMessageUID = relatedMessage ? relatedMessage.uid : null,
                toMailBoxes,
                threadUID = relatedMessage && !rxUtilities.isArrayNullOrEmpty(relatedMessage.parents) ? relatedMessage.parents[0].uid : null,
                subject = relatedMessage && !rxUtilities.isArrayNullOrEmpty(relatedMessage.parents) ? relatedMessage.parents[0].subject : null,
                conversationUID = relatedMessage ? relatedMessage.conversationUID : null

            switch (flowType) {
                case FLOW_TYPES.REPLY_ONE:
                    if (relatedMessage) {
                        toMailBoxes = [relatedMessage.sender];
                    }
                    subject = ('Re: ').concat(stripAllPrefixes(relatedMessage.subject));
                    break;
                case FLOW_TYPES.FORWARD:
                    subject = ('Fw: ').concat(stripAllPrefixes(relatedMessage.subject));
                    break;
                default: // new discussion case (REPLY_ALL doesnt arrive here)
                    if (relatedMessage) {
                        toMailBoxes = [relatedMessage.sender];
                    }
                    break;
            }

            $scope.newMessageJSON = {
                uid: uid,
                flowType: flowType,
                conversationUID: conversationUID,
                parentMessageUID: parentMessageUID,
                toMailBoxes: toMailBoxes || [],
                ccMailBoxes: [],
                bccMailBoxes: [],
                threadUID: threadUID,
                subject: $scope.ngDialogData.subject,
                sentState: rxConsts.SENT_STATE.PENDING,
                isRead: true,
                bodyHTML: $scope.ngDialogData.bodyHtml ? $scope.ngDialogData.bodyHtml : ''
            };

            $log.debug('fetched new message is', $scope.newMessageJSON);
        }

        function retrieveEditableQuoteData(relatedMessage, flowType) {
            if (flowType === FLOW_TYPES.FORWARD || flowType === FLOW_TYPES.REPLY_ONE) {
                // encapsulate the scope for the quotes' template
                var quotedScope = $rootScope.$new();
                getDataBasedOnFlow(relatedMessage, flowType).then(function(editableQuotesData) {
                    quotedScope.editableQuotesData = editableQuotesData;
                    var quotedEditableTemplate = $templateRequest('../views/quoted-editable-template.html').then(function(template) {
                        var parsedTemplate = $compile(template)(quotedScope);
                        //timeout in order to get the rendered HTML (after the current $digest is finished)
                        $timeout(function() {
                            $scope.newMessageJSON[$scope.bodyByFlow] = $scope.newMessageJSON[$scope.bodyByFlow].concat(EmailSanitizer.sanitize(parsedTemplate.prop('innerHTML')));
                        });
                    }, function() {
                        console.error('can\'t find the required template for editable quotes');
                    });
                }, function() {
                    console.log('can\'t find fullBodyHTML for the requested message');
                });
            }
        }

        function getDataBasedOnFlow(relatedMessage, flowType) {
            var deferred = $q.defer(),
                editableQuotesData = {};

            editableQuotesData.relatedMsgUserDisplayName = relatedMessage.sender.getDisplayName(relatedMessage.conversationUID);
            editableQuotesData.relatedMsgUserEmail = relatedMessage.sender.mailBoxAddress;
            editableQuotesData.relatedMsgSentDate = moment(relatedMessage.sentDate).format('LL [at] H:mm A');
            editableQuotesData.relatedMsgBodyHTML = relatedMessage.bodyHTML;
            editableQuotesData.subject = relatedMessage.subject;
            editableQuotesData.toParticipants = relatedMessage.toMailBoxes;
            editableQuotesData.ccParticipants = relatedMessage.ccMailBoxes;
            editableQuotesData.contextObjectUID = relatedMessage.conversationUID;
            editableQuotesData.flowType = flowType;
            // get all quotes
            relatedMessage.getFullBodyHTML().then(function(_fullBodyHTML) {
                var html = rxUtilities.removeTitleTagFromHtml(angular.copy(_fullBodyHTML));
                editableQuotesData.parsedQuotes = $sce.trustAsHtml(flowType === FLOW_TYPES.REPLY_ONE ? replaceWithNames(html) : html);
                deferred.resolve(editableQuotesData);
            }, function() {
                deferred.reject();
            });

            if (flowType === FLOW_TYPES.FORWARD) {
                // Add related message attachments
                relatedMessage.attachments.forEach(function(attachment) {
                    var attachmentCopy = {};

                    angular.extend(attachmentCopy, attachment);
                    attachmentCopy.originalMessage = null;
                    attachmentCopy.percentCompleted = 100;
                    attachmentCopy.percentCompletedText = attachmentCopy.fileSizeText;

                    extendFile(attachmentCopy); // self extend so we will have the remove function

                    attachmentCopy.isForwarded = true;

                    $scope.files.push(attachmentCopy);
                });
            }

            function replaceWithNames(text) {
                var element = $('<div>' + text + '</div>');
                var cidImgTags = element.find("[src*='cid:']");

                $.each(cidImgTags, function(index) {
                    var matched = relatedMessage.attachments.filter(function(item) {
                        return item.contentID === $(cidImgTags[index]).attr('src').replace('cid:', '');
                    });

                    if (matched.length > 0) {
                        $(cidImgTags[index]).replaceWith('&lt;' + matched[0].name + '&gt;');
                    }
                });

                return element.html();
            }

            return deferred.promise;
        }

        function postMessageHandler() {
            if ($scope.sendDisabled) {
                return;
            }

            // if compose is not valid - return
            if ($scope.newMessageJSON.toMailBoxes.length === 0 && $scope.newMessageJSON.ccMailBoxes.length === 0 && $scope.newMessageJSON.bccMailBoxes.length === 0) {
                // make sure we don'thave other error dialog open already
                if (ngDialog.getOpenDialogs().length === 1) {
                    openErrorDialog('Please provide at least one participant');
                }
                return;
            }

            $scope.sendDisabled = true;

            // pull the latest content from tinyMCE right before sending.
            $scope.newMessageJSON[$scope.bodyByFlow] = $scope.tinyMCEEditor.getContent();
            console.log('message-- ', $scope.tinyMCEEditor.getContent());

            var array = $scope.newMessageJSON[$scope.bodyByFlow].split(' ');
            var sanitizedArray = [];

            for (var i = 0; i <= array.length; i++) {
                if (undefined !== array[i] && array[i].indexOf('fixed') == -1) {
                    sanitizedArray.push(array[i]);
                }
            }

            $scope.newMessageJSON[$scope.bodyByFlow] = sanitizedArray.join(' ');
            console.log('message after -- ', $scope.newMessageJSON[$scope.bodyByFlow]);
            var entireMsg = $("<div>" + $scope.newMessageJSON[$scope.bodyByFlow] + "</div>");

            $scope.newMessageJSON.toMailBoxes = fixExternalAndUnknownRecipients($scope.newMessageJSON.toMailBoxes);
            $scope.newMessageJSON.ccMailBoxes = fixExternalAndUnknownRecipients($scope.newMessageJSON.ccMailBoxes);
            $scope.newMessageJSON.bccMailBoxes = fixExternalAndUnknownRecipients($scope.newMessageJSON.bccMailBoxes);
            // Add the search query so this message will be part of the search result next time. In addition add some spaces so it will not be shown in the previews.
            $scope.newMessageJSON.bodyHTML = $scope.newMessageJSON.bodyHTML + Array(80).join("&nbsp;") + "<table style=\"display:none\"><tr><td><div>" + searchQuery + "</div></td></tr></table>";
            rxOutbound.sendMessage($scope.newMessageJSON);

            $scope.closeThisDialog("POST");
        }

        function fixExternalAndUnknownRecipients(recipients) {
            if (!recipients) {
                return [];
            }

            recipients.forEach(function(rcp) {
                if (!rcp.uid) {
                    rcp.uid = rcp.mailBoxAddress;
                }

                if (!rcp.uid) {
                    console.error('Something bad has happend when trying to fix recipients before send', rcp);
                }
            });

            return recipients;
        }

        function resetForm() {
            $rootScope.userMayLoseData = null;

            fetchNewMessage(null, FLOW_TYPES.NEW_DISCUSSION);

            if ($rootScope.selectedFolder && $rootScope.selectedFolder.isContactFolder()) {
                $log.debug('selected contact folder is', $rootScope.selectedFolder);

                // Trick to let the required directive recognize the automatically added group recipient
                $timeout(function() {
                    $timeout(function() {
                        console.assert($rootScope.selectedFolder.contact, "selectedFolder.contact field is empty");

                        $scope.newMessageJSON.toMailBoxes = [$rootScope.selectedFolder.contact];
                    });
                });
            }

        }

        $scope.html = [];

        $scope.tagChanged = function() {
            //happens when another participant is added or removed. here for future use.
        }

        // A new tag item was added to the recipients. If this tag is not modeled yet (user did not select it from a list but instead wrote it's full mail address), we extend it.
        $scope.onTagAdded = function($tag) {
            if (!$tag.uid) {
                var contact = repos.contacts.getItem($tag.mailBoxAddress);
                if (contact) {
                    angular.extend($tag, contact);
                }
            }
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

        $scope.loadTags = function($query) {
            var deferred = $q.defer();

            var resultArray = repos.contacts.getAllData.call(repos.contacts);

            resultArray = $filter('rxContactSearch')(resultArray, $query, $scope.newMessageJSON.conversationUID);

            // notify next cycle after promise is returned
            $timeout(function() {
                deferred.notify(resultArray);
            });

            var query = {
                    query: $query
                },
                options = {
                    url: repos.contacts.registeredAPIs.contacts.url,
                    method: repos.contacts.registeredAPIs.contacts.method,
                    params: query,
                    query: query
                },
                addedItems = [];

            clearTimeout(timeoutId);
            timeoutId = setTimeout(function() {
                DataApi.remote(options).then(function(response) {
                    if (response.data && !rxUtilities.isArrayNullOrEmpty(response.data.contacts)) {
                        addedItems = repos.contacts.addItems(response.data.contacts);
                    } else {
                        addedItems = [];
                    }
                    deferred.resolve(addedItems);
                }, function(err) {
                    deferred.resolve(addedItems);
                });
            }, 300);

            return deferred.promise;
        };

        function openErrorDialog(message) {
            var nestedDialog = ngDialog.openConfirm({
                template: '\
                        <p>' + message + '</p>\
                        <div class="ngdialog-buttons">\
                        <button type="button" style="width:80px;margin:auto;" class="rx-btn" ng-click="confirm()">\
                        <div>OK</div></button>\
                        </div>',
                plain: true,
                showClose: false,
                name: 'error',
                disableAnimation: false, // We will override the default animation using velocity but we still want to a to animate the closing dialog so we need ngDialog to wait before destroying the dialog.
                className: 'ngdialog-theme-redkix-confirm ngdialog-theme-default ngdialog-theme-compose-error',

            });

            return nestedDialog
        }

        function ngDialogOpenedHandler(e, $dialog) {
            // Emphesis the recipient label when the recipient input get focus.
            if ($dialog.name == 'compose') {
                bindToFocusEvent("#to-input input", function(hasFocus) {
                    $scope.toRecipientHasFocus = hasFocus;
                });
                bindToFocusEvent("#cc-input input", function(hasFocus) {
                    $scope.ccRecipientHasFocus = hasFocus;
                });
                bindToFocusEvent("#bcc-input input", function(hasFocus) {
                    $scope.bccRecipientHasFocus = hasFocus;
                });
            }

            $timeout(function() {
                var flowType = $scope.ngDialogData.flowType;

                if (flowType === FLOW_TYPES.REPLY_ONE) {
                    $('.compose-modal .contenteditable.mce-tinymce').focus();
                } else {
                    $('#to-input input').focus();
                }
            }, 250);
        }

        function bindToFocusEvent(elementSelector, focusChangedHandler) {
            $(elementSelector).focus(function() {
                focusChangedHandler(true);
            });
            $(elementSelector).focusout(function() {
                focusChangedHandler(false);
            });
        }

        // ------------------- END ------------------- //
        // ---------------- Scope Vars --------------- //
        var editorStyleURL = '/styles/editorStyle.css';
        $scope.tinymceOptionsFull = {
            autoresize_bottom_margin: 0,
            // toolbar: 'undo redo | bold italic | ltr rtl | alignleft aligncenter alignright alignjustify | bullist numlist | link image emoticons | fontselect fontsizeselect | forecolor backcolor',
            skin: 'light',
            toolbar: false,
            menubar: false,
            forced_root_block: false,
            statusbar: false,
            paste_data_images: true,
            // height: '350px',
            inline: true,
            browser_spellcheck: true,
            setup: function(ed) {

                ed.on('KeyDown', function(e) {
                    var mod = /Mac/.test(navigator.platform) ? e.metaKey : e.ctrlKey;
                    if (mod && e.keyCode === 13) {
                        sendHotkey(e);
                    }
                });

                ed.on('init', function(e) {
                    // Save the initial message body, so we can know if user change it before sending.
                    initialMessageBody = $scope.newMessageJSON[$scope.bodyByFlow];
                    $scope.tinyMCEEditor = ed;
                });
            }
        };
        $scope.chevronSide = "glyphicon-chevron-up";
        $scope.tagsControl = {};

        $scope.toggleCcBcc = function() {
            $scope.CcBcc = !$scope.CcBcc;
        };

        function discardPostHandler() {
            $rootScope.userMayLoseData = null;

            if ($scope.modal) {
                $scope.closeThisDialog("DISCARD");
                return;
            }
        }

        // Set the canCloseDialogWithoutWarning function so the preCloseCallback of the dialog creator can call to determine if the warning dialog is needed.
        $scope.$parent.canCloseDialogWithoutWarning = function() {
            return !doesMessageContainsData();
        };

        $scope.discardPost = discardPostHandler;
        $scope.postMessage = postMessageHandler;

        // ------------------- END ------------------- //

        // ------------- Local Functions ------------- //
        // ------------------- END ------------------- //

        // ------------- Event Listeners ------------- //
        var ngDialogDeregistrationEventHandler = $rootScope.$on('ngDialog.opened', ngDialogOpenedHandler);

        // Very Very important to unsubscribe to events on destroy!
        $scope.$on('$destroy', function() {
            ngDialogDeregistrationEventHandler();
        });
        // ------------------- END ------------------- //

        // ---------- Controller Initializers -------- //
        init();
        // ------------------- END ------------------- //
    }
]);