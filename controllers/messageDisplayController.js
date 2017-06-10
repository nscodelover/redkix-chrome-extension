'use strict';

angular.module('redKix').controller('messageDisplayCtrl', ['$scope', '$rxEv', '$filter', '$sce', '$timeout', '$rxUtilities',

    function($scope, EmitterService, $filter, $sce, $timeout, rxUtilities) {
        // ---------------- User Vars ---------------- // 
        var CTRL_NAME = 'messageDisplayCtrl',
            FLOW_TYPES = {
                REPLY_ALL: "none",
                REPLY_ONE: "reply_one",
                FORWARD: "forward"
            };

        $scope.selectedFlowType = null;
        // ------------------- END ------------------- //
        // ------------ Function Handlers ------------ //

        function replyAllHandler() {
            $scope.selectedFlowType = FLOW_TYPES.REPLY_ALL;
            EmitterService.invoke(EmitterService.uiEvents.replyAll, {}, CTRL_NAME);
        }

        function replyOneHandler() {
            $scope.selectedFlowType = FLOW_TYPES.REPLY_ONE;
            EmitterService.invoke(EmitterService.uiEvents.openComposeModal, {
                relatedMessage: $scope.message,
                flowType: $scope.selectedFlowType
            }, CTRL_NAME);
        }

        var forwardMessageHandler = function() {
                $scope.selectedFlowType = FLOW_TYPES.FORWARD;
                EmitterService.invoke(EmitterService.uiEvents.openComposeModal, {
                    relatedMessage: $scope.message,
                    flowType: $scope.selectedFlowType
                }, CTRL_NAME);
            }
            // ------------------- END ------------------- //

        // ---------------- Scope Vars --------------- //
        $scope.toggleInline = false;
        $scope.replyAll = replyAllHandler;
        $scope.replyOne = replyOneHandler;
        $scope.forward = forwardMessageHandler;
        $scope.messageDetails = {
            show: false
        };

        $scope.stripHTML = rxUtilities.stripHTML;

        $scope.prepareMsg = rxUtilities.prepareMsg;

        $scope.trustBodyHTML = function(body) {
            return $sce.trustAsHtml(body);
        };

        function urlifyBody(body) {
            if (body) {
                var rex = /(<a href=")?(?:https?:\/\/)?(?:\w+\.)+\w+/g;
                var str = body.replace(rex, function($0, $1) {
                    return $1 ? $0 : '<a href="' + $0 + '">' + $0 + '</a>';
                });
                return str;
            } else return null;
        }

        $scope.compressToggleFunc = function() {
            $scope.compressToggle = !$scope.compressToggle;
        }

        $scope.dropdown = [{
                "text": "<i class=\"fa fa-reply\" ></i>&nbsp;&nbsp;Reply",
                "click": "replyOne()"
            }, {
                "text": "<i class=\"fa fa-reply-all\"></i>&nbsp;&nbsp;Reply all",
                "click": "replyAll()"
            }, {
                "text": "<i class=\"fa fa-long-arrow-right disabled\"></i>&nbsp;&nbsp;Forward",
                "click": "forward()"
            },
            // {
            //   "divider": true
            // },
            {
                "text": "<i class=\"fa fa-external-link\"></i>&nbsp;&nbsp;View original",
                "click": "compressToggleFunc()"
            }
        ];

        $scope.quoteData = {};

        // This function is called as part of the ng-if directive in the single-message.html. It
        // will be called if there are quotation bubbles to update since we recycle messages.
        $scope.updateQuoteData = function() {
            $scope.quoteData.quote = $scope.message.quotationBubbles[0];
            return true;
        }

        function resetViewHandler() {
            // Need to recycle the messages temporary fields like if the message details is poen or close.
            $scope.messageDetails.show = false;
        }

        // ------------------- END ------------------- //

        // ------------- Local Functions ------------- //
        function addAttachmentsFileSizeString() {
            if ($scope.message) {
                $scope.message.attachments.forEach(function(attachment) {
                    attachment.fileSizeText = rxUtilities.getFileSizeText(attachment.size);
                });
            }

        }
        // ------------------- END ------------------- //
        // ------------- Event Listeners ------------- //
        EmitterService.on(EmitterService.uiEvents.discussionSelected, resetViewHandler);

        // Very Very important to unsubscribe to events on destroy!
        $scope.$on('$destroy', function() {
            if ($scope.toggleInline && $scope.selectedFlowType === FLOW_TYPES.REPLY_ALL) {}
            EmitterService.off(EmitterService.uiEvents.discussionSelected, resetViewHandler);
        });

        // ------------------- END ------------------- //

        // ---------- Controller Initializers -------- // 
        addAttachmentsFileSizeString();
        // ------------------- END ------------------- //
    }
]);