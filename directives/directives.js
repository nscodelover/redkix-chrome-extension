var redKix = angular.module('redKix');

redKix.directive('ngUndragged', ['$parse', '$timeout', '$location', '$rxEv',
    function(parse, timeout, location, EventEmitter) {
        return function(scope, elem, attr) {
            var dropbox = angular.element('dropbox');
            var toggleDrop = false;
            var leaveTimeout = null;
            elem[0].addEventListener('dragleave', function(evt) {
                leaveTimeout = timeout(function() {
                    if (toggleDrop === true) {
                        toggleDrop = false;
                        EventEmitter.invoke(EventEmitter.uiEvents.fileDraggedIntoView, toggleDrop);
                    }
                }, 100);
            }, false);
            elem[0].addEventListener('dragover', function(evt) {
                timeout.cancel(leaveTimeout);
                if (toggleDrop === false) {
                    toggleDrop = true;
                    EventEmitter.invoke(EventEmitter.uiEvents.fileDraggedIntoView, toggleDrop);
                }
            }, false);
        }
    }
]);

redKix.directive('showonhoverparent',
    function() {
        return {
            link: function(scope, element, attrs) {
                element.parent().parent().bind('mouseenter', function() {
                    element.css('opacity', 1);
                });
                element.parent().parent().bind('mouseleave', function() {
                    element.css('opacity', 0);
                });
            }
        };
    });

// redKix.directive('resizePreview', function() {
//     return function($scope, $element) {
//         $scope.getElementDimensions2 = function() {
//             return {
//                 'h': $element.height(),
//                 'w': $element.width()
//             };
//         };
//         var l;
//         $scope.$watch($scope.getElementDimensions2, function(newValue, oldValue) {
//             $scope.headerWidth = newValue.w;
//             if ($scope.preview && $scope.preview.namesConCat) {
//                 $scope.numOfPartsToShow = Math.floor($element.width() / ($scope.preview.namesConCat.length + 20));
//             }
//         }, true);

//         $element.bind('resize', function() {
//             $scope.$apply();
//         });
//     }
// });


redKix.directive('avatarInitials', ['$rxUtilities', '$rxConfig', function(rxUtilities, rxConfig) {
    return {
        restrict: 'E',
        require: 'ngModel',
        scope: {
            user: '=ngModel',
            context: '=',
            hidePresence: '='
        },
        template: `<div class="avatar-content" ng-style="{'border-radius': user.hasOwnProperty('organizationUID') ? '20%' : '50%'}">` +
            `<img ng-if="user.avatarURL" class="avatar" ng-src="{{user.avatarURL}}" />` +
            `<div rx-fit-text="1.1" ng-if="!user.avatarURL" class="avatar-initials" ng-style="{'background': avatarBgColor}">` +
            `{{avatarInitials}}` +
            `</div> </div>` +
            `<div class="avatar-status contact-active"></div>` +
            `<div class="avatar-status contact-not-active" ng-show="!hidePresence && user.presenceStatus && user.presenceStatus !== 'active'" ></div>` , 
            // `<div class="avatar-status contact-active" ng-show="!hidePresence && user.presenceStatus && user.presenceStatus === 'active'" ></div>`,
        
        link: function(scope, element, attrs, ctrl) {
            if (!ctrl) {
                return;
            }

            scope.user = Array.isArray(scope.user) ? scope.user[0] : scope.user;

            if (scope.context && typeof(scope.context) === "object") {
                scope.contextObjectUID = contextObject.hasOwnProperty('threadsCount') ? contextObject.uid : contextObject.conversationUID;
            } else if (scope.context && typeof(scope.context) === "string") {
                scope.contextObjectUID = scope.context;
            }

            scope.$watch(function() {
                if (!scope.user) return '';
                // Set watch for contact displayName field
                return ctrl.$modelValue.getDisplayName ? ctrl.$modelValue.getDisplayName(scope.contextObjectUID || null) : ctrl.$modelValue.mailBoxAddress;
            }, function(newValue) {
                if (scope.user && !scope.user.avatarURL) {
                    scope.avatarInitials = rxUtilities.getAvatarInitials(scope.user.getDisplayName ? scope.user.getDisplayName(scope.contextObjectUID || null) : null, scope.user.mailBoxAddress);
                    scope.user.avatarBgColor = rxUtilities.getAvatarColor(scope.avatarInitials);
                    scope.avatarBgColor = scope.user.avatarBgColor;
                }
                if (scope.user && scope.user.contactType === rxConfig.consts.CONTACT_TYPE.GROUP) {
                    element.addClass('group-avatar');
                }

                // TODO: Verify in the future that when changing contact avatar it's updated all across the app
                ctrl.$setViewValue(scope.user);
                ctrl.$render();
            });

            if (!scope.user) {
                return;
            }

            if (scope.user && scope.user.contactType === rxConfig.consts.CONTACT_TYPE.GROUP) {
                element.addClass('group-avatar');
            }

        }
    };
}]);

redKix.directive('rxUsername', function($parse) {
    return {
        restrict: 'A',
        scope: {
            user: '=',
            context: '='
        },
        link: function(scope, element, attrs) {
            var correctTitle = scope.user.getCorrectTitle(false, scope.context);

            element.append(correctTitle);

            scope.$watch(
                function(scope) {
                    // This becomes the value we're "watching".
                    return scope.user.getDisplayName(false, scope.context);
                },
                function(newValue) {
                    if (newValue) {
                        element.text(newValue);
                    }
                }
            );
        }
    }
});


redKix.directive('selectionIgnore', [

    function() {
        return {
            restrict: 'A',
            priority: -1,
            link: function(scope, element, attrs) {
                element.on('click', function(event) {
                    if (attrs.selectionIgnore === 'true') {
                        event.selectionModelIgnore = true;
                    }
                });
            }
        };
    }
]);

//   Sticky Headers directive - component by Noam  //
redKix.directive('followMeBarIgnore', function($parse) {
    return {
        require: '^followMeContainer',
        restrict: 'A',
        link: function(scope, element, attrs, tabsCtrl) {
            stickies = element;
            var thisSticky = element.wrap('<div class="followWrap" />');
            thisSticky.parent().height(thisSticky[0].offsetHeight + 1);
            var pos = thisSticky.position().top;
            tabsCtrl.setHeaderOffset(thisSticky[0].offsetHeight + 1);
            tabsCtrl.addPane({
                pos: pos,
                elm: thisSticky,
                parent: thisSticky.parent(),
                ignore: true
            });
        }
    }
});

//   Sticky Headers directive - component by Noam  //
redKix.directive('followMeBar', function($parse) {
    return {
        require: '^followMeContainer',
        restrict: 'A',
        link: function(scope, element, attrs, tabsCtrl) {
            stickies = element;
            if (attrs.followMeBar === 'true') {
                var thisSticky = element.wrap('<div class="followWrap" />');
                thisSticky.parent().height(27);
                var pos = thisSticky.position().top;
                tabsCtrl.addPane({
                    pos: pos,
                    elm: thisSticky,
                    parent: thisSticky.parent()
                });
            }
        }
    }
});
//   Sticky Headers Container directive - component by Noam  //
redKix.directive('followMeContainer', function($parse, $timeout) {
    return {
        restrict: 'A',
        scope: false,
        controller: function($scope, $element) {
            var panes = $scope.panes = [];
            var headerOffset = 0;
            var useFixedHeaderOffset = $scope.selectedFolder === null;
            var container = $element;

            $scope.$watch('selectedFolder', function() {
                useFixedHeaderOffset = $scope.selectedFolder === null;
            });

            this.setHeaderOffset = function(offset) {
                headerOffset = offset;
            }

            this.addPane = function(pane) {
                panes.push(pane);
                // console.log("panel added");
                $timeout(function() {
                    for (var i = panes.length - 1; i >= 0; i--) {
                        if (panes[i].parent.html() === '' || panes[i].parent.parent().length === 0) {
                            panes[i].parent.remove();
                            panes.splice(i, 1);
                            // console.log('pane ',i, 'removed');
                        }
                    };
                });
                // window.panes = panes;
            };

            var scroll = function() {
                angular.forEach(panes, function(pane, i) {
                    if (pane.ignore) {
                        return;
                    }

                    var thisSticky = pane,
                        nextSticky = panes[i + 1],
                        prevSticky = panes[i - 1];

                    // thisSticky.pos = thisSticky.elm.position().top;
                    thisSticky.elm.parent().parent().css('transform', 'none');
                    if (thisSticky.pos <= container.scrollTop() - (useFixedHeaderOffset ? headerOffset : 0)) {
                        thisSticky.elm.addClass("fixed");
                        // window.thisSticky = thisSticky.elm;
                        if (nextSticky && thisSticky.elm.parent().parent() && thisSticky.elm.parent().parent().position().top + nextSticky.pos - thisSticky.elm.outerHeight() <= 0) {
                            thisSticky.elm.addClass("absolute").css("top", nextSticky.pos - thisSticky.elm.outerHeight());
                        }
                    } else {
                        thisSticky.elm.removeClass("fixed");
                        if (prevSticky && prevSticky.elm.parent().parent().position().top + thisSticky.pos - prevSticky.elm.outerHeight() >= 0) {
                            prevSticky.elm.removeClass("absolute").removeAttr("style");
                        }
                    }
                });
            };

            $element.on('scroll', function() {
                scroll();
            });
        },
    }
});

redKix.directive('overFlown', ['$interval',
    function($interval) {
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                element.ready(function() {
                    element.css('opacity', 0);
                    if (scope.preview && scope.preview.numOfPartsToShow) {
                        scope.numOfPartsToShow = scope.preview.numOfPartsToShow;
                        element.css('opacity', 1);
                    } else {
                        var stop = $interval(function() {
                            if (!scope.done) {
                                if (scope.numOfPartsToShow >= 2 && element[0].scrollWidth > element.innerWidth()) {
                                    scope.numOfPartsToShow--;
                                    // console.log('reduced', scope.numOfPartsToShow, element, element[0].scrollWidth, element.innerWidth());
                                } else {
                                    clear();
                                }
                            }
                        });
                        var clear = function() {
                            $interval.cancel(stop);
                            stop = undefined;
                            // console.log('stopped', element, element[0].scrollWidth , element.innerWidth());
                            scope.done = true;
                            if (scope.preview) {
                                scope.preview.numOfPartsToShow = scope.numOfPartsToShow;
                            }
                            element.css('opacity', 1);

                        }
                    }
                });


            }
        }
    }
]);

redKix.directive('elastic', [
    '$timeout',
    function($timeout) {
        return {
            restrict: 'A',
            link: function($scope, element, attrs) {
                $scope.initialHeight = $scope.initialHeight || element[0].style.height;
                var resize = function() {
                    element[0].style.height = $scope.initialHeight;
                    element[0].style.height = "" + element[0].scrollHeight + "px";
                };
                $scope.$watch(attrs['ngModel'], resize);
                $timeout(resize, 0);
            }
        };
    }
]);

redKix.directive('simpleSticky', function($window) {
    var windowEl = angular.element('#conversation-content');
    var upperEl = angular.element('#upper-header');

    var checks = [];


    //the function will be run
    function addCheck(fn) {
        checks.push(fn);
    }

    var throttleRunChecks = function() {
        var pageYOffset = windowEl.scrollTop();

        angular.forEach(checks, function(fn) {
            fn.apply(null, [pageYOffset]);
        });
    };

    windowEl.on('scroll resize', throttleRunChecks);

    return {
        restrict: 'A',
        link: function(scope, element, attrs) {

            //70 because of sticky nav at top
            var showFromTopSticky = parseInt(attrs.simpleSticky, 10) || 70,
                positionNormal = element.css('position'),
                showFromTopNormal = element.css('top'),
                startFromTop = element.offset().top + 75,
                isAffixed;

            //check if affix state has changed
            function checkPosition(pageYOffset) {
                var shouldAffix = startFromTop - pageYOffset < 200;
                if (shouldAffix) shouldChange(pageYOffset);
            }

            function shouldChange(pageYOffset) {
                upperEl.css({
                    transform: 'translateY(' + (startFromTop - pageYOffset <= 0 ? 0 : (startFromTop - pageYOffset) * 0.33) + 'px)'
                });
            }

            //handle class changes, CSS changes
            function handleAffixing(shouldAffix) {
                if (shouldAffix) {
                    //don't worry - we are't triggering paint storms because these only run when cross threshold (transform isn't really appropriate)
                    element.css({
                        top: showFromTopSticky + 'px',
                        width: "inherit",
                        position: "fixed"
                    });
                } else {
                    element.css({
                        top: showFromTopNormal,
                        position: positionNormal
                    });
                }
                //element.toggleClass('affix', shouldAffix)
            }

            //register a callback, handles deregistration when pass in scope
            addCheck(function(pageYOffset) {
                checkPosition(pageYOffset);
            });

            checkPosition();
        }
    };
});


redKix.directive("stylePhotoAttachment", function($animate, $timeout) {
    return {
        link: function(scope, element, attrs) {
            scope.$watch(function() {
                return element[0].naturalWidth;
            }, doClassThings);

            element.bind("load", doClassThings);

            function doClassThings(val) {
                // success, "onload" catched
                $timeout(function() {
                    if (element[0].naturalWidth > 200) {
                        $animate.addClass(element, "image-padding-200-plus");
                        $animate.removeClass(element, "image-padding-200-minus");
                    }
                    if (element[0].naturalWidth <= 200) {
                        $animate.addClass(element, "image-padding-200-minus");
                        $animate.removeClass(element, "image-padding-200-plus");
                    }
                }, 0);
            };
        }
    }
});

redKix.directive("rxUrlify", ['$compile', '$rxEv', '$rxRepoService', function($compile, EmitterService, RepoService) {
    return {
        priority: 11,
        link: function(scope, element, attrs) {
            scope.openCompose = function(email) {
                /* email to lowercase to use as id */
                email = email.toLowerCase();
                /* open compose with the given email in the "To:" field */
                EmitterService.invoke(EmitterService.uiEvents.openComposeModal, {
                    relatedMessage: {
                        sender: RepoService.getAllRepos().contacts.getItem(email) ? RepoService.getAllRepos().contacts.getItem(email) : email
                    }
                }, 'URLIFY-DIRECTIVE');
            };
            var options,
                defaultOptions = {
                    newWindow: true,
                    stripPrefix: false,
                    className: "rx-url",
                    twitter: false,
                    hashtag: false,
                    phone: false,
                    /**
                     * replaceFn replaces things that Autolinker finds with specific elements we want.
                     * Special cases:
                     *   * email: for emails, we add a clickable element that opens the compose dialog
                     */
                    replaceFn: function(autolinker, match) {
                        switch (match.getType()) {
                            case 'email':
                                var email = match.getEmail();
                                var tag = new Autolinker.HtmlTag({
                                    tagName: 'a',
                                    attrs: {
                                        'rx-compose-link': email,
                                        'ng-click': "openCompose('" + email + "')",
                                        'class': 'redkix-compose'
                                    },
                                    innerHtml: email
                                });
                                console.debug("URLIFY-DIRECTIVE: made a redkix compose link for the email", email);

                                return tag;
                            default:
                                /* let Autolinker make the element itself */
                                return;
                        }
                    }
                },
                rxUrlifyOptions = attrs.rxUrlifyOptions,
                userOptions = scope[rxUrlifyOptions] || rxUrlifyOptions;

            options = angular.extend({},
                defaultOptions, (userOptions && angular.isObject(userOptions)) ? userOptions : {});

            scope.$watch('message.bodyHTML', function(newvalue) {
                element.find('a').attr('target', '_blank');
                element.html(Autolinker.link(element.html(), options));
                var allEmails = element.find('[rx-compose-link]');
                allEmails.removeAttr('rx-compose-link');
                if (allEmails.length > 0) {
                    $compile(element.contents())(scope.$new());
                }
            });
        }
    }
}]);

redKix.directive("rxEmbedify", ['$rxUtilities', '$timeout', function(rxUtilities, $timeout) {
    return {
        priority: 10,
        link: function(scope, element, attrs) {
            function cidfy(element) {
                $(element).find('style').remove(); // removes <style> tags from html body
                /* *************
                 *      INIT    *
                 * *********** *
                 */
                var _message = scope.message || scope.newMessageJSON;
                var _attachments = scope.message ? scope.message.attachments : angular.copy(scope.files);
                var imageNodes = $(element).find('img[src]');

                if (!_message || !_attachments) return;

                /* to know which files have been processed */
                _attachments.forEach(function(item) {
                    if (item.isInline) {
                        item.hideFromView = true;
                    }
                    angular.extend(item, {
                        isProcessed: false
                    });
                });

                /* *************
                 *      CID    *
                 * *********** *
                 * handle all the CID's first.
                 */
                $.each(imageNodes, function(index) {
                    if ($(imageNodes[index]).attr('src').indexOf('cid:') > -1) {
                        var matched = _attachments.filter(function(item) {
                            return item.contentID === $(imageNodes[index]).attr('src').replace('cid:', '') && isImageAttachement(item);
                        })
                        if (matched.length > 0) {
                            $(imageNodes[index]).attr('src', matched[0].getDownloadUrl().replace('redirect=false', 'redirect=true'));
                            matched[0].hideFromView = true;
                            matched[0].isProcessed = true;
                        }
                    }
                });

                // for cases where there is no bodyHTML but contentID is still passed in the attachment,
                // bind it to the view as an image (this can't happen with forward, so we check that fullBodyHTML is undefined so we sure it's not the compose modal)
                if (!_message.bodyHTML && _message.fullBodyHTML === undefined) {
                    _attachments.forEach(function(item) {
                        if (item.contentID && !item.hideFromView && isImageAttachement(item)) {
                            element.append('<img src="' + item.getDownloadUrl().replace('redirect=false', 'redirect=true') + '"/>');
                            item.hideFromView = true;
                            item.isProcessed = true;
                        }
                    })
                }

                /* ***************** *
                 *      RICH TEXT    *
                 * ***************** *
                 * after we eliminated all CIDs, it's time for rich text.
                 */
                var attachments = _attachments || [];
                attachments = attachments.filter(function(item) {
                    return !item.isProcessed && angular.isNumber(item.inlineIndex) && item.inlineIndex >= 0;
                });
                // get all img elements that still have cid.
                var imgElements = element.find("img[src*='cid']");
                attachments.forEach(function(item) {
                    if (item.inlineIndex >= 0 && item.contentID === null && isImageAttachement(item)) {
                        if (attachments.length > 0) {
                            $(imgElements[item.inlineIndex]).attr('src', item.getDownloadUrl().replace('redirect=false', 'redirect=true'));
                            item.hideFromView = true;
                            item.isProcessed = true;
                        }
                    }
                });
            }

            if (scope.unwatchAttachments) {
                scope.unwatchAttachments();
            }

            scope.unwatchAttachments = scope.$watch(function() {
                var _attachments = scope.message ? scope.message.attachments : scope.files;
                return element.html() + (scope.newMessageJSON && scope.newMessageJSON.fullBodyHTML ? scope.newMessageJSON.fullBodyHTML : '') + (!rxUtilities.isArrayNullOrEmpty(_attachments) ? _attachments.map(isPlaceholderAttachment).every(itemIsFalse) : '');
            }, function(newvalue) {
                cidfy(element);
            });

            // Helping functions
            // ==================
            function isImageAttachement(item) {
                return item.type === 'image' || (item.type === 'other' && item.name.toLowerCase().indexOf("picture (device independent bitmap)") > -1);
            }

            function isPlaceholderAttachment(file) {
                return file && file.isPlaceholderObject && file.isPlaceholderObject();
            }

            function itemIsFalse(item) {
                return item === false;
            }
        }
    }
}]);

redKix.directive("rxAttfy", function($http) {
    return {
        priority: 10,
        link: function(scope, element, attrs) {

            function ATTfy(element) {
                // identify ATT000XX.txt files
                scope.AttBindAttachments = scope.message.attachments.filter(function(item) {
                    return (angular.isString(item.name) && item.name.search(/(ATT)\d+(.txt|.html|.htm)/) === 0);
                });

                // for each ATT file hide it from view and download the content
                angular.forEach(scope.AttBindAttachments, function(file) {
                    file.hideFromView = true;

                    //check if cache exists
                    if (!file.$AttBind) {
                        $http.get(file.getDownloadUrl().replace('redirect=false', 'redirect=true')).then(function(result) {
                            // set cache
                            file.$AttBind = result.data;
                        });
                    }
                });
            };

            scope.$watch(function() {
                return element.html();
            }, function(newvalue) {
                ATTfy(element);
            });
        }

    }

});

redKix.directive("simpleText", function() {
    return {
        priority: 10,
        link: function(scope, element, attrs) {
            scope.$watch(element.html(), function(newvalue) {
                if (element.children().length === 0) {
                    element.addClass('simple-text');
                }
            });
        }
    }
});

redKix.directive("atMentions", function() {
    return {
        link: function(scope, element, attrs) {
            var lastPartText = tinyMCE.activeEditor.lastRng.endContainer.textContent;
            var shouldTriggerAtMention = lastPartText.slice(-1) === "@" && lastPartText.slice(-2).search(/(?:\s|^)@/) === 0;
        }
    }
});

redKix.directive("keepScrollAtBottom", function($interval, $timeout) {
    return {
        link: function(scope, element, attrs) {
            var scrollElement = $('#conversation-content');
            scope.$watch(function() {
                return element[0].scrollHeight
            }, doChange);
            scope.$watch('showInlineEditor', doTimedChange);

            function doTimedChange(newValue, oldValue) {
                var interval = $timeout(doChange);
                $timeout(function() {
                    $interval.cancel(interval)
                }, 1000);
            }

            function doChange(newValue, oldValue) {
                if (newValue > oldValue && scrollElement[0].scrollHeight - scrollElement[0].scrollTop - scrollElement.height() <= 200) {
                    // scrollElement.scrollTopAnimated(scrollElement[0].scrollHeight, 350);
                    scrollElement[0].scrollTop = scrollElement[0].scrollHeight;
                }
            }
        }
    }
});

/**
 * Will fix scroll to bottom by a certain delta. This will ONLY happen if rx-fix-scroll-by is switched from FALSE to TRUE.
 * HTML PARAMS:
 * @param  {String} rx-fix-scroll-by the $scope variable to watch in order to activate the scroll. the var should be one of the following:
 *  * true - the element should scroll if distance from bottom is smaller than delta
 *  * false - the element shouldn't scroll.
 *  * force - overrides rx-fix-scroll-delta. this will force the item to scroll even if the distance is larger than the delta
 *  NOTICE: The value doesn't change back to false on it's own. This is in order to allow us to "silence" the scroll if we want (see description)
 * @param  {Number} rx-fix-scroll-delta determines the delta from the bottom that should be scrolled
 */
redKix.directive("rxFixScroll", function($interval, $timeout) {
    return {
        link: function(scope, element, attrs) {
            var fixByVar = attrs.rxFixScrollBy;
            var scrollDeltaFromBottom = attrs.rxFixScrollDelta || 110;
            var lastScrollTop = element.scrollTop();
            var distanceFromBottom = 0;

            if (fixByVar) {
                scope.$parent[fixByVar] = {};
                scope.$parent[fixByVar].activate = function() {
                    if (distanceFromBottom < scrollDeltaFromBottom) {
                        $timeout(function() {
                            stopOnUserScroll().on();
                            element.stop(true).animate({
                                scrollTop: element.prop('scrollHeight')
                            }, 600, 'swing', stopOnUserScroll().off);
                        });
                        return true;
                    } else {
                        return false;
                    }
                };
                scope.$parent[fixByVar].hasScrollbars = function() {
                    return element.prop('scrollHeight') - element.height() > 0;
                };
                scope.$parent[fixByVar].saveCurrentDistanceFromBottom = function() {
                    distanceFromBottom = element.prop('scrollHeight') - element.height() - element.scrollTop();
                    return distanceFromBottom;
                };
            }


            function stopOnUserScroll() {
                var stopAnimation = function() {
                    var st = element.scrollTop();

                    if (st < lastScrollTop) {
                        element.stop(true);
                    }

                    lastScrollTop = st;
                };

                var on = function() {
                    element.scroll(stopAnimation);
                }

                var off = function() {
                    element.off('scroll', stopAnimation);
                }

                return {
                    on: on,
                    off: off
                };
            }
        }
    }
});

redKix.directive('switch', function() {
    return {
        restrict: 'E',
        replace: true,
        transclude: true,
        template: function(element, attrs) {
            var html = `
            <span 
            class="switch ${attrs.class}"
            ng-click="${attrs.disabled ? attrs.ngModel : attrs.ngModel + '=!' + attrs.ngModel + ';' + attrs.ngChange + '()'}"
            ng-class="{ checked: ${attrs.ngModel}, disabled: ${attrs.disabled} }">
            <div class="side-icon icon-on" ng-class="'${attrs.iconOn}'"></div>
            <div class="side-icon icon-off" ng-class="'${attrs.iconOff}'"></div>
            <small></small>
            <input type="checkbox" id="${attrs.id}"
            name="${attrs.name}" ng-model="${attrs.ngModel}" style="display:none" />
            </span>
            `
            return html;
        }
    }
});


redKix.directive("preScroll", function($location, $anchorScroll, $timeout) {

    return {
        restrict: "A",
        scope: {
            preScroll: '='
        },
        link: function(scope, elem, attrs) {
            // extend given control object
            scope.innerControl = scope.preScroll || {};

            // check how many children (i.e. ng-repeat items) are live in the DOM
            var monitorChildren = function() {

                return elem.find("#" + scope.innerControl.id).length > 0;
            };

            var repeatParts, repeatItemLength, watchHandle;

            // hide this element 
            scope.innerControl.hide = function() {
                if (elem.css('opacity') != '0') {
                    elem.css('opacity', 0);
                    console.log("preScroll Scrolling hiding");
                }
            };

            // add the arming function for the pre scroll operation
            scope.innerControl.arm = function(itemUID) {
                scope.innerControl.id = itemUID;
                console.log("preScroll armed to:", itemUID);

                unwatchScrollHeight();

                //watch number of ng-repeat items in the DOM
                if (watchHandle) watchHandle();

                watchHandle = scope.$watch(monitorChildren, function(result) {
                    // if there are no children, return but keep looking
                    if (!elem.children()[0]) return;

                    // if has expected number of children
                    if (result) {
                        watchHandle();

                        scope.showElementTimeout = $timeout(function() {
                            scope.showElementTimeout = null;
                            // scroll to message
                            scrollToItem('#' + scope.innerControl.id, 3);

                        });
                    }
                });
            };

            // prevent scrolling
            scope.innerControl.disarm = function() {
                unwatchScrollHeight();
            }

            // Watch the scroll height. When it changes we need to fix the scroll position
            function scrollContainerHeight() {
                return elem[0].scrollHeight;
            }

            function unwatchScrollHeight() {
                if (scope.unwatchHeight) {
                    scope.unwatchHeight();
                    scope.unwatchHeight = null;
                    console.log("preScroll unwatch height");
                }

                $timeout.cancel(scope.scrollAfterHeightChangeTimeout);
            }

            function scrollToItem(itemUIDSelector, times) {
                if (elem.find(itemUIDSelector).length > 0) {
                    $location.hash(scope.innerControl.id);
                    console.log("preScroll Scrolling to " + scope.innerControl.id);
                    $anchorScroll();
                    $location.hash('');
                    elem.animate({
                        opacity: 1
                    }, 200);

                    // Watch the container scroll height for 5 seconds since images can arrive in delay
                    // and the container height can change the scroll position
                    scope.unwatchHeight = scope.$watch(scrollContainerHeight, function(newVal, oldVal) {
                        if (oldVal != 0 && newVal > oldVal) {
                            console.debug("preScroll container height changed");
                            $timeout.cancel(scope.scrollAfterHeightChangeTimeout);
                            scope.scrollAfterHeightChangeTimeout = $timeout(function() {
                                $timeout.cancel(scope.scrollAfterHeightChangeTimeout);
                                $location.hash(scope.innerControl.id);
                                console.log("preScroll after height change - Scrolling to " + scope.innerControl.id);
                                $anchorScroll();
                                $location.hash('');
                            }, 250);
                        }
                    });

                    // For safety reasons  we will unwatch the container height after 5 seconds
                    $timeout(unwatchScrollHeight, 5000);

                    // make sure the animation succeeded
                    $timeout(function() {
                        elem.css('opacity', 1);
                    }, 300);
                } else {
                    if (times === 0) {
                        console.error("preScroll Could not scroll to message");
                        elem.css('opacity', 1);
                        return;
                    }

                    // try to scroll again
                    $timeout(function() {
                        scrollToItem(itemUIDSelector, times - 1);
                    }, 100);
                }
            }
        }
    }
})

redKix.directive("preScrollPrev", function($location, $anchorScroll, $timeout) {

    return {
        restrict: "A",
        scope: {
            preScrollPrev: '='
        },
        link: function(scope, elem, attrs) {
            // extend given control object
            scope.innerControl = scope.preScrollPrev || {};

            // check how many children (i.e. ng-repeat items) are live in the DOM
            var monitorGrandChildren = function() {
                var count = 0,
                    children = elem.children();

                for (var i = 0; i < children.length; i++) {
                    count = count + children[i].children.length;
                };
                return count;
            };

            var repeatParts, repeatItemLength, watchHandle;

            // hide this element 
            scope.innerControl.hide = function() {
                elem.fadeOut(0);
            };

            // add the arming function for the pre scroll operation
            scope.innerControl.arm = function(itemUID) {

                // if no uid passed - no scrolling will be performed
                if (!itemUID) {

                    elem.fadeIn();
                    return
                };

                console.log("preScroll armed to:", itemUID);
                //watch number of ng-repeat items in the DOM
                watchHandle = scope.$watch(monitorGrandChildren, function(result) {
                    // if there are no children, return but keep looking
                    if (!elem.children()[0]) {
                        return
                    };

                    // look for the element

                    if ($('#' + itemUID).length > 0) {
                        $location.hash(itemUID);
                        console.log("preScroll Scrolling to " + itemUID);

                        $anchorScroll();

                        // bring the element back into view
                        // elem.css('opacity', 1);

                        elem.fadeIn();

                        // disable the watch on children
                        watchHandle();
                    }
                });
            }
        }
    }
})


redKix.directive('requiredAny', function() {
    // holding the state of each group of inputs
    var groups = {};

    // check if at least one control in the group is not empty
    function determineIfRequired(groupName) {
        var group = groups[groupName];

        if (!group) return false;

        var keys = Object.keys(group);

        return keys.every(function(key) {
            return (key === 'isRequired') || !group[key];
        });
    }

    return {
        restrict: 'A',
        require: '?ngModel',
        //isolate scope 
        // scope: {},  
        link: function postLink(scope, elem, attrs, modelCtrl) {

            // modelCtrl.$validators.requiredOne = function(modelValue, viewValue) {
            //     if (modelCtrl.$isEmpty(modelValue)) {
            //         // consider empty models to be invalid
            //         return false;
            //     }

            //     if (modelValue.length > 0) {
            //         // it is valid
            //         return true;
            //     }

            //     // it is invalid
            //     return false;
            // };
            // require `ngModel` and groupName
            if (!modelCtrl || !attrs.requiredAny) return;

            // Get a hold on the group's state object
            // (if it doesn't exist, initialize it first)
            var groupName = attrs.requiredAny;

            if (groups[groupName] === undefined) {
                groups[groupName] = {
                    isRequired: true
                };
            }

            var group = scope.group = groups[groupName];

            // Clean up when the element is removed
            scope.$on('$destroy', function() {
                delete(group[scope.$id]);

                if (Object.keys(group).length <= 1) {
                    delete(groups[groupName]);
                }
            });

            // Updates the validity state for the 'required' error-key
            // based on the group's status
            function updateValidity() {
                if (group.isRequired) {
                    modelCtrl.$$parentForm.$setValidity('noRecipients', false);
                } else {
                    modelCtrl.$$parentForm.$setValidity('noRecipients', true);
                }
            }

            // Updates the group's state and this control's validity
            function validate(value) {
                group[scope.$id] = (value > 0);
                group.isRequired = determineIfRequired(groupName);

                updateValidity();

                return group.isRequired ? undefined : value;
            };

            // Make sure re-validation takes place whenever:
            //   the control's value changes
            //   the group's `isRequired` property changes
            scope.$watch(function() {
                return modelCtrl.$viewValue ? modelCtrl.$viewValue.length : 0;
            }, function(newValue) {
                validate(newValue);
            });
            // scope.$watch(function() {
            //     return modelCtrl.$modelValue ? modelCtrl.$viewValue.length : 0;
            // }, function(newValue) {
            //     validate(newValue);
            // });
            // modelCtrl.$validators.requireOne = validate;
            // modelCtrl.$parsers.unshift(validate);
            scope.$watch('group.isRequired', updateValidity);
        }
    };
});

redKix.directive('rxCroppable', ['$document', function($document) {
    return {
        scope: {
            'newAvatarFile': '=rxCroppableData',
            'scale': '=rxCroppableScaleBy'
        },
        link: function(scope, element, attr) {
            /* get directive attributes */
            var maskElement = attr.rxCroppableMask || '.mask';

            scope.newAvatarFile = {};

            /* get mask params */
            var maskBorder = getSizeOnly($(maskElement).css('border-left')),
                maskLeft = getSizeOnly($(maskElement).css('left')),
                maskTop = getSizeOnly($(maskElement).css('top')),
                maskRadius = getSizeOnly($(maskElement).css('width'));

            /* init img params */
            var startPosX = maskLeft + maskBorder,
                startPosY = maskTop + maskBorder,
                shortDim;

            /* params for mouse & global things */
            var moveStartX = 0,
                moveStartY = 0,
                x = 0,
                y = 0;

            element.on('load', function() {
                var _w = getSizeOnly(element.css('width')),
                    _h = getSizeOnly(element.css('height')),
                    style = {
                        position: 'relative',
                        cursor: 'pointer',
                        top: startPosY + 'px',
                        left: startPosX + 'px'
                    };
                // set width OR height according to the circle's radius
                shortDim = _w > _h ? 'height' : 'width';
                style[shortDim] = maskRadius + 'px';
                // get original properties before changing them
                scope.newAvatarFile['url'] = element.attr('src');
                scope.newAvatarFile['fileWidth'] = getSizeOnly(element.css('width'));
                scope.newAvatarFile['fileHeight'] = getSizeOnly(element.css('height'));

                scope.newAvatarFile['sourceX'] = 0;
                scope.newAvatarFile['sourceY'] = 0;
                scope.newAvatarFile['side'] = shortDim === 'height' ? scope.newAvatarFile['fileHeight'] : scope.newAvatarFile['fileWidth'];
                element.css(style);
            });

            // scale according to given param
            scope.$watch('scale', refreshStyle);
            // start drags
            element.on('mousedown', mousedownHandler);

            function refreshStyle(newValue, oldValue) {
                if (shortDim && newValue && oldValue) {
                    x = getSizeOnly(element.css('left'));
                    y = getSizeOnly(element.css('top'));
                    var elementCenterX = x + (oldValue * maskRadius / 2);
                    var elementCenterY = y + (oldValue * maskRadius / 2);
                    var newY = elementCenterY - (newValue * maskRadius / 2);
                    var newX = elementCenterX - (newValue * maskRadius / 2);
                    var width = getSizeOnly(element.css('width'));
                    var height = getSizeOnly(element.css('height'));
                    var endY = newY + height;
                    var endX = newX + width;
                    var isTopImgOutsideMask = newY < startPosY;
                    var isBottomImgOutsideMask = endY > (startPosY + maskRadius);
                    var isLeftImgOutsideMask = newX < startPosX;
                    var isRightImgOutsideMask = endX > (startPosX + maskRadius);
                    var style = {};
                    var newTop;
                    var newLeft;
                    if (isTopImgOutsideMask && isBottomImgOutsideMask) {
                        style['top'] = newY + 'px';
                        newTop = newY;
                    }
                    if (!isTopImgOutsideMask) {
                        style['top'] = startPosY + 'px';
                        newTop = startPosY;
                    }
                    if (!isBottomImgOutsideMask) {
                        style['top'] = startPosY + maskRadius - height + 'px';
                        newTop = startPosY + maskRadius - height;
                    }
                    if (isLeftImgOutsideMask && isRightImgOutsideMask) {
                        style['left'] = newX + 'px';
                        newLeft = newX;
                    }
                    if (!isLeftImgOutsideMask) {
                        style['left'] = startPosX + 'px';
                        newLeft = startPosX;
                    }
                    if (!isRightImgOutsideMask) {
                        style['left'] = startPosX + maskRadius - width + 'px';
                        newLeft = startPosX + maskRadius - width;
                    }

                    style[shortDim] = newValue * maskRadius + 'px';
                    var scaleBack = getScaleBackBy(newValue);
                    scope.newAvatarFile['sourceX'] = (startPosX - newLeft) * scaleBack;
                    scope.newAvatarFile['sourceY'] = (startPosY - newTop) * scaleBack;
                    scope.newAvatarFile['side'] = maskRadius * scaleBack;
                    element.css(style);
                }
            }

            function getSizeOnly(cssValue) {
                return parseInt(cssValue.replace(/px.*$/, ""));
            }

            function mousedownHandler(event) {
                // Prevent default dragging of selected content
                var y = getSizeOnly(element.css('top'));
                var x = getSizeOnly(element.css('left'));
                event.preventDefault();
                moveStartX = event.pageX - x;
                moveStartY = event.pageY - y;
                $document.on('mousemove', mousemoveHandler);
                $document.on('mouseup', mouseupHandler);
            }

            function mousemoveHandler(event) {
                y = event.pageY - moveStartY;
                x = event.pageX - moveStartX;
                var width = getSizeOnly(element.css('width'));
                var height = getSizeOnly(element.css('height'));
                var endY = y + height;
                var endX = x + width;
                var isTopImgOutsideMask = y < startPosY;
                var isBottomImgOutsideMask = endY > (startPosY + maskRadius);
                var isLeftImgOutsideMask = x < startPosX;
                var isRightImgOutsideMask = endX > (startPosX + maskRadius);
                var newTop;
                var newLeft;
                if (isTopImgOutsideMask && isBottomImgOutsideMask) {
                    newTop = y;
                    element.css({
                        top: newTop + 'px'
                    });
                }
                if (!isTopImgOutsideMask) {
                    newTop = startPosY;
                    element.css({
                        top: newTop + 'px'
                    });
                }
                if (!isBottomImgOutsideMask) {
                    newTop = startPosY + maskRadius - height;
                    element.css({
                        top: newTop + 'px'
                    });
                }
                if (isLeftImgOutsideMask && isRightImgOutsideMask) {
                    newLeft = x;
                    element.css({
                        left: newLeft + 'px'
                    });
                }
                if (!isLeftImgOutsideMask) {
                    newLeft = startPosX;
                    element.css({
                        left: newLeft + 'px'
                    });
                }
                if (!isRightImgOutsideMask) {
                    newLeft = startPosX + maskRadius - width;
                    element.css({
                        left: newLeft + 'px'
                    });
                }

                var scaleBack = getScaleBackBy(scope.scale);
                scope.newAvatarFile['sourceX'] = (startPosX - newLeft) * scaleBack;
                scope.newAvatarFile['sourceY'] = (startPosY - newTop) * scaleBack;
            }

            function getScaleBackBy(scaleValue) {
                var result;
                if (shortDim === 'height') {
                    result = scope.newAvatarFile['fileHeight'] / (maskRadius * scaleValue);
                } else {
                    result = scope.newAvatarFile['fileWidth'] / (maskRadius * scaleValue);
                }
                return result;
            }

            function mouseupHandler() {
                $document.off('mousemove', mousemoveHandler);
                $document.off('mouseup', mouseupHandler);
            }
        }
    };
}]);

redKix.directive('rxSameHeightAs', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            var otherElement = $(attrs.rxSameHeightAs);
            var wantedHeight = otherElement.css('height');
            element.css({
                height: wantedHeight
            });
        }
    };
});

redKix.directive('autofocus', ['$timeout',
    function($timeout) {
        return {
            restrict: 'A',
            link: function($scope, $element) {
                if ($element.prop('tagName') === 'TAGS-INPUT') {
                    var input = $element.find('input');
                    $timeout(function() {
                        input[0].focus();
                    }, 100);
                } else {
                    // Trick for waiting to second digest cycle (to support shitty safari)
                    $timeout(function() {
                        $timeout(function() {
                            $element[0].focus();
                        });
                    });
                }
            }
        };
    }
]);

/**
 * DIRECTIVE to resize text inside an element as a result of change in the element's width [dynamic text size]
 * @param  {[number]}    rxFitText: will give an initial factor to size the text to. The text will be sized by the element's width & the compressor number
 * @param  {[object]}    rxFitTextOptions: give the directive some options. options are:
 *                                           * minFontSize: don't go UNDER this certain size
 *                                           * maxFontSize: don't go ABOVE this certain size
 */
redKix.directive('rxFitText', ['$timeout', function($timeout) {
    return {
        restrict: 'A',
        scope: {
            kompressor: '=rxFitText',
            options: '&rxFitTextOptions'
        },
        link: function(scope, element) {
            // Setup options
            var compressor = scope.kompressor || 1,
                settings = $.extend({
                    'minFontSize': Number.NEGATIVE_INFINITY,
                    'maxFontSize': Number.POSITIVE_INFINITY
                }, scope.options);

            var resizer = function() {
                var fontSize = Math.max(Math.min(element.width() / (compressor * 2), parseFloat(settings.maxFontSize)), parseFloat(settings.minFontSize));
                var roundFontSize = Math.round(fontSize);
                var fix = element.width() >= 23 ? 1 : 0;
                element.css({
                    'font-size': roundFontSize,
                    'line-height': element.height() + fix + 'px'
                });
            };

            // Call once to set.
            resizer();

            scope.$watch(function() {
                return element.width();
            }, resizer);
        }
    }
}]);

// Directive for displaying meeting invites of each messages with action buttons
redKix.directive('meetingInvite', ['$redKixActiveUserService', '$rxOutbound', function(ActiveUser, rxOutbound) {
    return {
        restrict: 'E',
        scope: {
            message: '='
        },
        templateUrl: '/views/meeting-request.html',
        link: function(scope, element) {
            var meetingRequest = scope.message.meetingRequest;

            var choiceRunning = false,
                inviteAnimationObject = getInviteAnimationObject();

            scope.changeResponseMenuOpened = false;
            scope.activeMailBoxUID = ActiveUser.getMailBoxUID();
            scope.invite = {
                month: meetingRequest.meetingStart.format("MMM"),
                day: meetingRequest.meetingStart.format("D"),
                details: [{
                    icon: "icon-invite-datetime",
                    text: buildDateString(meetingRequest.meetingStart, meetingRequest.meetingEnd)
                }, {
                    icon: "icon-invite-location",
                    text: meetingRequest.meetingLocation
                }]
            };

            scope.openChangeResponse = openChangeResponseHandler;
            scope.initiateInviteAnswer = function(answer) {
                inviteAnswer(answer, true);
            };
            scope.answers = {
                accept: {
                    iconClass: "icon-calendar-accept",
                    textClass: "accept",
                    text: "Accepted",
                    responseToServer: "accept"
                },
                decline: {
                    iconClass: "icon-calendar-decline",
                    textClass: "decline",
                    text: "Declined",
                    responseToServer: "decline"
                },
                tentative: {
                    iconClass: "icon-calendar-maybe",
                    textClass: "maybe",
                    text: "Maybe",
                    responseToServer: "tentative"
                }
            };

            // If the meeting hasn't been responded yet and the active user is not the meeting organizer, we display the action buttons menu
            if (meetingRequest.meetingResponseType === 'none' && scope.activeMailBoxUID !== meetingRequest.meetingOrganizerMailBox.uid) {
                openChangeResponseHandler();
            }

            // This function gets both start and end meeting dates and formats them into one meeting date string
            function buildDateString(meetingStart, meetingEnd) {
                var dateFormat = "dddd, MMMM Do *h:mm A*";
                var dateString = '';

                if (meetingStart && meetingEnd) {
                    if (meetingStart.isSame(meetingEnd)) {
                        dateFormat = dateFormat + ', YYYY';
                        dateString = meetingStart.format(dateFormat);
                    } else if (meetingStart.isSame(meetingEnd, 'day')) {
                        dateString = meetingStart.format(dateFormat) + meetingEnd.format("* - h:mm A*, YYYY");
                    } else {
                        dateString = meetingStart.format(dateFormat);
                        dateFormat = dateFormat + ', YYYY';

                        if (!meetingStart.isSame(meetingEnd, 'year')) {
                            dateString = meetingStart.format(dateFormat);
                        }
                        dateString = dateString + meetingEnd.format(" - " + dateFormat);
                    }
                } else if (meetingStart) {
                    meetingStart.format(dateFormat + ', YYYY');
                }

                console.assert(dateString, "Meeting invite date string is empty!");

                return dateString.replace(new RegExp(/\*([^\*]*)\*/g), '<b>$1</b>');
            }

            function inviteAnswer(answer, sendToServer) {
                if (!choiceRunning && meetingRequest.meetingResponseType !== answer) {
                    choiceRunning = true;

                    meetingRequest.meetingResponseType = answer;

                    //animate the controls
                    inviteAnimationObject.select();

                    //send invite answer to server
                    if (sendToServer) {
                        var userResponse = scope.answers[answer].responseToServer;

                        if (!scope.message.meetingRequest || !userResponse) return;

                        rxOutbound.sendMeetingResponse(scope.message.uid, userResponse).then(function(response) {
                                scope.message.meetingRequest.meetingResponseType = userResponse.toLowerCase();
                            },
                            function(response) {
                                console.error('Couldnt set meeting request response to', userResponse);
                            });
                    }
                }
            }

            function openChangeResponseHandler() {
                scope.changeResponseMenuOpened = true;

                inviteAnimationObject.unselect();
            }

            function getInviteAnimationObject() {
                function unselect() {
                    $(element.find('.buttons')).velocity({
                        opacity: [1, 0],
                        translateX: [0, 20]
                    }, {
                        duration: 800,
                        easing: [400, 25],
                        display: "flex",
                        complete: function() {
                            choiceRunning = false;
                        }
                    });
                    $(element.find('.answer')).velocity({
                        opacity: [0, 1],
                        translateX: [-20, 0]
                    }, {
                        duration: 800,
                        easing: [400, 25],
                        display: "none"
                    });
                    $(element.find('.change')).velocity("fadeOut", {
                        duration: 200
                    });
                }

                function select() {
                    $(element.find('.buttons')).velocity({
                        opacity: [0, 1],
                        translateX: [20, 0]
                    }, {
                        duration: 800,
                        easing: [400, 25],
                        display: "none",
                        complete: function() {
                            choiceRunning = false;
                        }
                    });
                    $(element.find('.answer')).velocity({
                        opacity: [1, 0],
                        translateX: [0, -20]
                    }, {
                        duration: 800,
                        easing: [400, 25],
                        display: "flex"
                    })

                    $(element.find('.change')).velocity("fadeIn", {
                        duration: 200
                    });
                }

                return {
                    select: select,
                    unselect: unselect
                };
            }
        }
    };
}]);

// contact-chip directive is used for representinve a contact as an elipsis chip with presence status indication.
// it can also get an index and an object for communicating with it's container, about how many chips are presented
// on the first line and what thier offset from the right border. We need this to 'glue' the "& 3 others" string 
// next to the right visible chip. 
redKix.directive('rxContactChip', ['$rxUtilities', '$rxConfig', '$rootScope', '$timeout', function(rxUtilities, rxConfig, $rootScope, $timeout) {
    var firstLineTopPosition;
    var resizeTimeout;
    var UNINITIALIZED_CHIP = -1;

    return {
        restrict: 'E',
        scope: {
            contact: '=',
            chipCounterObject: '=',
            chipIndex: '='
        },
        templateUrl: 'contact-chip-template.html',
        link: function(scope, element, attrs, ctrl) {

            ////  function binders to the element attributes ///
            scope.elementTopPosition = function() {
                if (scope.chipCounterObject && !scope.chipCounterObject.initiated[scope.chipIndex]) {
                    // discussion was reset we return UNINITIALIZED_CHIP so we will be called again for each chip and return it's real size
                    scope.chipCounterObject.initiated[scope.chipIndex] = true;
                    return UNINITIALIZED_CHIP;
                }

                return element[0].offsetTop;
            };

            scope.parentWidth = function() {
                return element.parent().width();
            };

            if (scope.chipCounterObject) {
                // When the top position of an element is changes we update the chip counter
                scope.$watch('elementTopPosition()', function(newVal, oldVal) {
                    if ((scope.chipIndex === 0 || !firstLineTopPosition) && newVal != UNINITIALIZED_CHIP) {
                        firstLineTopPosition = newVal;
                    }

                    if (newVal === UNINITIALIZED_CHIP) {
                        // We just reset the discussion control --> we will get here later with a 'real' top position value;
                        return;
                    }

                    if (oldVal === newVal) {
                        if (newVal === firstLineTopPosition) {
                            // The element is on the first line --> increase the counter
                            scope.chipCounterObject.firstLineContactsCounter++;
                        }
                    } else if (newVal === firstLineTopPosition) {
                        // elemnt moved to the first line
                        scope.chipCounterObject.firstLineContactsCounter++;
                    } else if (oldVal === firstLineTopPosition) {
                        // Element moved from the first line another line
                        scope.chipCounterObject.firstLineContactsCounter--;
                    }

                });
                scope.$watch('parentWidth()', function(newVal, oldVal) {
                    var offsetFromRight = element.parent().width() - (element.position().left + element.width());
                    scope.chipCounterObject.offsetsFromRight[scope.chipIndex] = offsetFromRight * -1 - 20 /*20px container margin*/ - 2 /*chip margin */ ;

                });
            }
        }
    };
}]);

/**
 * Make elements copy specific text inside of them instead of all html.
 * The directive gets a css selector as an input, and copies the text inside that element instead.
 */
redKix.directive('rxCopyTextOnly', function() {
    return {
        restrict: 'A',
        scope: {
            rxCopyTextOnly: '@'
        },
        link: function(scope, element, attrs, ctrl) {

            element[0].addEventListener('copy', addLink);


            function addLink(event) {
                event.preventDefault();

                var copytext = element.find(scope.rxCopyTextOnly || '').text().trim();

                if (event.clipboardData) {
                    event.clipboardData.setData('Text', copytext);
                }
            }
        }
    };
});

redKix.directive('rxDisableEnter', function() {
    return {
        restrict: 'A',
        link: function(scope, element) {
            $(element).bind('keypress', function(e) {
                if (e.keyCode == 13) {
                    return false;
                }
            });
        }
    };
});
