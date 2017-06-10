'use strict';
// Event Emitter!!

angular.module('redKixServices').factory('$rxEv', ['$log',
    function($log) {
        return new rxEmitter();

        function rxEmitter() {
            Emitter(this);
            var _self = this;

            this.uiEvents = {
                discussionSelected: 'discussion-selected',
                folderSelected: 'folder-selected',
                openComposeModal: 'new-discussion-dialog',
                toggleResetChange: 'toggle-reset-change',
                newDiscPreviewDataChanged: 'new-disc-preview-data-changed',
                userHasBeenSet: 'user-has-been-set',
                scrollToMsg: 'scroll-to-msg',
                newReply: 'new-reply',
                replyAll: 'reply-all',
                replyDiscard: 'discard-reply',
                dragFile: 'drag-file',
                fileDraggedIntoView: 'file-dragged-into-view',
                newDiscSentResponse: 'new-disc-sent-response',
                groupSelected: 'group-selected',
                initializeFilePreviewer: 'initialize-file-previewer',
                clearPreview: 'clear-selected-conversation',
                AddDiscussionToMoveQueue: 'add-discussion-to-move-queue',
                groupsLoaded: 'groups-loaded',
                initializeCompleted: 'initialize-completed',
                resetMessagesView: 'reset-messages-view',
                sendFieldsToServer: 'send-fields-to-server',
                toggleMoveDiscussionPopover: 'toggle-move-discussion-popover',
                wakeUp: 'wake-up',
                offline: 'offline',
                online: 'online',
                activeContactFolderCreation: 'active-contact-folder-creation',
                postThreadMoveAction: 'post-thread-move-action',
                redkixIsFocused: 'redkix-is-focused',
                selectNextPreview: 'select-next-preview',
                selectPrevPreview: 'select-prev-preview',
                previewsReset: 'reset-preview'
            };

            this.coreEvents = {
                userPreferencesLoaded: 'user-preferences-loaded'
            };

            this.otherEvents = {
                customEvent: 'custom'
            };

            this.invoke = function(selectedEvent, params, caller) {
                if (selectedEvent === undefined) {
                    console.error('Event undefined invoked from: ' + (caller || 'not-provided'));
                    return;
                }
                _self.emit(selectedEvent, params);
                $log.debug('Event: ' + selectedEvent + ', invoked from: ' + (caller || 'not-provided'));
            };
        }
    }
]);