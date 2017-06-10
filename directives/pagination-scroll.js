/**************************************************************************************************************************************************
                rxPaginationScroll

A scroll with virtual paging. For big collection it will put partial portion of the items in the dom according to the scroll position.
We split the collection to virtual pages of constant size. The DOM will contain maximum of 8 pages any given time, and will load and unload pages
according to the scroll. The directive change the scroll size of it's parent DOM container.  First we estimate the scroll size according to the 
collection size, and we adjust this size when the user continue to scroll. When the user finish the scrolling we try to load more pages according
to the scroll position. If the user speed scroll beyond the top page we "lock" the scrolling" and load more pages. We load them with opacity 0 so we can
calculate the right position according to the height, and when we finish loading we show them (opacity 1).


  __________________________
  |        Container       | The container has initial estimated height.
  |                        |
  |                        |
  |                        |
  |                        |
  |       __________       |
  |      |          |      |
  |      |  Page 3  |      |
  |      |          |      |
  |      |          |      |
  |      |          |      |
  |______|__________|______| scroll top position
  |      |__________|   V  |
  |                     i  |
  |       __________    s  |
  |      |          |   i  |
  |      |  Page 4  |   b  |
  |      |          |   l  |
  |      |          |   e  |
  |________________________|
  |      |          |      |
  |      |__________|      |
  |                        |
  |       __________       |
  |      |          |      |
  |      |  Page 5  |      |
  |      |          |      |
  |      |          |      |
  |      |          |      |
  |      |          |      |
  |      |----------|   _  |
  |                     |  |
  |       ----------    |  |
  |      |  Page 6  |   |  |
  |      |          bottomOffset of page 5 - Each page contain abolute offset from bottom (first page is zero)
  |      |          |   |  |
  |      |          |   |  |
  |______|__________|___-__|

**************************************************************************************************************************************************/

(function() {
    'use strict';
    angular.module('rxPaginationScroll', []);
})();

(function() {
    'use strict';

    angular.module('rxPaginationScroll')
        .directive('paginationScroll', function($timeout, $log, $rootScope) {
            var NG_REPEAT_REGEXP = /^\s*(.+)\s+in\s+([\r\n\s\S]*?)\s*(\s+track\s+by\s+(.+)\s*)?$/;

            /**
             * @function throttle
             * @private
             * @param {Function} fn
             * @param {number} delay
             * @returns {Function}
             *
             * @description
             * Return a function that only gets executed once within a given time period.
             */
            function throttle(fn, delay) {
                var timeout,
                    previous = 0;

                return function() {
                    var current = new Date().getTime(),
                        remaining = delay - (current - previous),
                        args = arguments;

                    if (remaining <= 0) {
                        if (timeout) {
                            $timeout.cancel(timeout);
                        }

                        timeout = undefined;
                        previous = current;

                        fn.apply(this, args);
                    } else if (!timeout) {
                        timeout = $timeout(function() {
                            timeout = undefined;
                            previous = new Date().getTime();

                            fn.apply(this, args);
                        }, remaining);
                    }
                };
            }

            /**
             * @function parseNgRepeatExp
             * @private
             * @param {string} expression
             * @returns {Object}
             *
             * @description
             * Parse ngRepeat expression and
             * return the name of the loop variable, the collection and tracking expression
             */
            function parseNgRepeatExp(expression) {
                var matches = expression.match(NG_REPEAT_REGEXP);

                return {
                    item: matches[1],
                    collection: matches[2],
                    trackBy: matches[3]
                };
            }

            function PaginationScroller(scope, element, attrs) {
                var defaultOptions = {
                    scrollThrottle: 200
                };

                // Priviledged properties
                this.scope = scope;
                this.attrs = attrs;
                this.element = $(element);
                this.options = angular.extend({}, defaultOptions, this.scope.$eval(this.attrs.endlessScrollOptions));
                this.status = {};
                this.expression = parseNgRepeatExp(this.attrs.paginationScroll);

                this.pageSize = 15; //TODO: get it from directive arguments
                this.INITIAL_PAGES_TO_LOAD = 1;
                this.MAX_PAGE_TO_LOAD = 5;
                this.maxPages = this.INITIAL_PAGES_TO_LOAD;
                this.pages = [];
                // Watch for events and scope changes
                this._watch();

            }

            PaginationScroller.prototype.getKnownScrollHeight = function() {
                var height = 0;

                this.pages.forEach(function(page) {
                    height += page.height;
                });

                this.topPages.forEach(function(page) {
                    height += page.height;
                })

                this.bottomPages.forEach(function(page) {
                    height += page.height;
                })

                return height;
            }

            PaginationScroller.prototype.getScrollOffsetFromBottom = function() {
                var scrollTop = this.getContainer().parent().scrollTop();
                var scrollHeight = this.getContainer()[0].scrollHeight;
                // If scrolled to bottom, request more items
                var scrollOffsetFromBottom = scrollHeight - scrollTop;
                return scrollOffsetFromBottom;
            }

            /**
            /* Set the model page height according to the DOM element. 
            /* If we are at the first page we also set the container window height.
             */
            PaginationScroller.prototype.setPageHeight = function() {
                var self = this;

                var container = self.getContainer.apply(self);
                var scrollContainer = container.parent();
                var scrollTop = container.parent().scrollTop();
                var scrollHeight = container[0].scrollHeight;

                // We don't have a height in the model --> set digest cycle to redraw and try to get the item height
                $timeout(function(collection) {
                    self.repositionAllPagesAndShow(collection);
                }, 0, false, self.originalItems);
            }

            PaginationScroller.prototype.setContainerKnownHeight = function() {
                var self = this;

                var container = self.getContainer.apply(self);
                var scrollContainer = container.parent();
                var scrollTop = container.parent().scrollTop();
                var scrollHeight = container[0].scrollHeight;

                var scrollTopDiff = scrollContainer.scrollTop() - scrollTop;
                var containerNewHeight = self.getKnownScrollHeight();
                var scrollPosition = scrollTop + containerNewHeight - scrollHeight;
                //$log.debug("rxPaginationScroll  - setPageHeight. Found first page. Set window height " + containerNewHeight + " adjust scroll to " + scrollPosition)
                //adjust the scroll
                scrollContainer.scrollTop(scrollPosition);
                container.css({
                    height: containerNewHeight + 'px'
                });
            }

            PaginationScroller.prototype.enableScrollingIfNeeded = function() {
                var self = this;

                if (self.scrollingIsDisabled) {

                    if (self.enableScrollingTimeout) {
                        return; // There is aloready timeout to enable scrolling --> nothing to do.
                    }

                    self.enableScrollingTimeout = $timeout(function() {
                        self.enableScrolling();
                        self.enableScrollingTimeout = null;
                    }, 10);
                }
            }

            // If user speed scrolling we "lock" the scrolling and add more pages as hidden. This function show all the hidden pages.
            PaginationScroller.prototype.showAllPages = function() {
                this.pages.forEach(function(page) {
                    page.isHidden = false;
                });
            }

            /**
             * @function check
             *
             * @description
             * Check to see if more items need to be fetched
             * by checking if the user has scrolled to the bottom or top.
             */
            PaginationScroller.prototype.check = function(afterAddPageAbove, afterAddPageBelow) {
                var self = this;

                if (self.backgroundTimout) {
                    $timeout.cancel(self.backgroundTimout);
                    self.backgroundTimout = null;
                }

                if (self.lastPageIndex === 0) return;

                // Make sure the check function will be called
                if (self.checkInProgress) {
                    $timeout(function() {
                        self.check();
                    }, 10);
                    return;
                }

                self.checkInProgress = true;

                var container = self.getContainer.apply(self);
                var scrollContainer = container.parent();
                var scrollTop = container.parent().scrollTop();
                var scrollHeight = container[0].scrollHeight;
                var scrollTopOffsetFromBottom = scrollHeight - scrollTop;
                var topPage = self.pages[0];

                if (!topPage.height) {

                    if (self.setPageHeightTimeout) return; // We already waiting to set the height

                    self.setPageHeightTimeout = $timeout(function() {
                        self.setPageHeight();

                        self.setPageHeightTimeout = null;
                        self.checkInProgress = false;

                        // Trigger another check (that can fetch more items) since the height was updated.
                        $timeout(function() {
                            self.check(afterAddPageAbove, afterAddPageBelow);
                        });
                    });
                    // Return since the heights are not ready yet...
                    return;
                }

                var topElementTopOffsetFromBottom = topPage.bottomOffset + topPage.height;
                var heightBufferBeforeAddingItems = 0; //topPage.height * 2 / 3;
                var isScrollUp = scrollTop < self.lastScrollTop || (self.lastScrollTop === 0 && scrollTop > 0) || afterAddPageAbove === true; // the second option is when we modify the container size
                var isScrollDown = scrollTop > self.lastScrollTop || afterAddPageBelow === true;
                var bottomPage = self.pages[self.pages.length - 1];
                var lastPageBottom = scrollHeight - bottomPage.bottomOffset;

                var topElementOffset = scrollHeight - topPage.bottomOffset - topPage.height;

                // Check if we need to add a page above. If we scroll up and passed the window buffer, or if the scroll is close to the top
                if (isScrollUp && topPage.index > 0 && (topElementOffset >= scrollTop - heightBufferBeforeAddingItems || scrollTop < 800)) {
                    self.addSeveralPagesAbove();
                } else {
                    // Trigger loading on background since the scroll position changed
                    self.backgroundTimout = $timeout(function(collection) {
                        //$log.debug("rxPaginationScroll - scrollStopped");
                        self.loadPageOnBackground(collection);
                    }, 300, false, self.originalItems);
                    self.checkInProgress = false;
                    self.enableScrollingIfNeeded();
                }
                self.lastScrollTop = scrollTop;
            };

            /**
             * @function update
             * @param {Array} collection A list of items bound to the directive.
             *
             * @description
             * Insert new items before or after a list of existing items and render them.
             */
            PaginationScroller.prototype.update = function(collection) {
                var beforeItems,
                    afterItems,
                    firstCommonItemIndex,
                    lastCommonItemIndex,
                    oldCollection,
                    i,
                    len;
                var self = this;
                oldCollection = this.previousOriginalItems;

                // Retain reference to original items
                this.originalItems = collection;

                // Get new items
                if (angular.isArray(collection) && angular.isArray(oldCollection)) {
                    // Find first common item index
                    for (i = 0, len = collection.length; i < len; i++) {
                        if (collection[i] === oldCollection[0] && collection[i] !== undefined) {
                            firstCommonItemIndex = i;
                            break;
                        }
                    }

                    // Find last common item index
                    for (i = collection.length - 1; i >= 0; i--) {
                        if (collection[i] === oldCollection[oldCollection.length - 1] && collection[i] !== undefined) {
                            lastCommonItemIndex = i;
                            break;
                        }
                    }

                    if (firstCommonItemIndex) {
                        beforeItems = collection.slice(0, firstCommonItemIndex);
                    }

                    if (lastCommonItemIndex) {
                        afterItems = collection.slice(lastCommonItemIndex + 1);
                    }
                }

                // The collection has changed. Load it again.
                if (angular.isArray(collection)) {
                    this.lastPageIndex = this.pageIndex = Math.floor(collection.length / this.pageSize) - 1;

                    if (this.lastPageIndex < 0) {
                        this.lastPageIndex = this.pageIndex = 0;
                    }

                    // Remove the page height watchers
                    this.pages.forEach(function(page) {
                        if (page.pageHeightWatcher)
                            page.pageHeightWatcher();
                    });

                    this.pages = [];
                    this.bottomPages = [];
                    this.topPages = [];
                    this.minMessageHeight = 150;
                    this.containerSize = this.minMessageHeight * collection.length; // change message to item and get it from outside
                    this.enableScrolling();
                    this.maxPages = this.INITIAL_PAGES_TO_LOAD;
                    this.scrollingIsDisabled = false;

                    // Reset height change timout from previous list 
                    if (this.heightChangeTimeout) {
                        $timeout.cancel(this.heightChangeTimeout);
                        this.heightChangeTimeout = null;
                    }

                    if (this.lastPageIndex > 0) {
                        var self = this;

                        self.pages.push({
                            // Take page size + leftovers
                            items: collection.slice(this.pageSize * this.pageIndex, collection.length),
                            bottomOffset: 0,
                            index: this.lastPageIndex,
                            number: 0,
                            pageHeightWatcher: self.addPageHeightWatcher(0, collection)
                        });

                        // Initiate container
                        var container = this.getContainer.apply(this);

                        //$log.debug("rxPaginationScroll - collection changed: set container height: this.containerSize");
                        container.css({
                            height: this.containerSize + 'px'
                        });

                        // initialy we scroll to bottom
                        container.parent().scrollTop(this.containerSize);
                        console.assert(this.containerSize > 500, "rxPaginationScroll - The container size it soo small " + this.containerSize);
                        container.css({
                            position: 'relative'
                        });

                        $timeout(function(collection) {
                            self.loadPageOnBackground(collection)
                        }, 1000, false, self.originalItems);

                    } else {
                        this.pages.push({
                            items: collection.slice(),
                            index: 0,
                            number: 0
                        });
                        var container = this.getContainer.apply(this);
                        //$log.debug("rxPaginationScroll - collection changed: set container height to nothing");

                        container.css({
                            height: ''
                        });
                        container.css({
                            position: ''
                        });
                    }

                    // Set the message indexes so ng-repeat can continue tracking them and not replace them
                    for (var i = 0; i < self.pages[0].items.length; i++)
                        self.pages[0].items[i].index = i;

                    for (var i = self.pages[0].items.length; i < this.pageSize * 2 - 1; i++)
                        self.pages[0].items.push({
                            messageHidden: true,
                            index: i,
                            bodyHTML: 'empty place holder',
                            attachments: []
                        });


                    this.disableEnableHomeScrolling();
                }

                // Previous collection
                if (angular.isArray(collection)) {
                    this.previousOriginalItems = collection.slice();
                }
            };

            PaginationScroller.prototype.addPageHeightWatcher = function(pageIndex, collection) {
                var self = this;

                return self.scope.$watch('_paginationScroll.pageHeight(' + pageIndex + ')',
                    function(newVal, oldVal) {
                        if (oldVal > 0 && newVal > 0 && !self.heightChangeTimeout) {
                            self.heightChangeTimeout = $timeout(function() {
                                self.repositionAllPagesAndShow(collection);
                                self.heightChangeTimeout = null;
                            }, 1000);
                        }
                    });
            }

            PaginationScroller.prototype.getContainer = function() {
                return this.element.parent();
            }

            PaginationScroller.prototype.getLastPage = function() {
                return this.bottomPages.length > 0 ? this.bottomPages[this.bottomPages.length - 1] : this.pages[this.pages.length - 1];
            }

            // Add a single page above the current loaded pages
            PaginationScroller.prototype.addPageAbove = function(shouldNotEnableScrolling) {
                var self = this;

                if (!this.pages[0].height) {
                    $log.error("rxPaginationScroll - Could not add pages above sinve the top page does not have a height yet");
                    return;
                }

                var totalPageCount = Math.floor(self.originalItems.length / self.pageSize);
                var pageIndex = self.pages[0].index - 1;

                if (pageIndex < 0) {
                    return; // no more pages
                }

                var startIndex = self.pageSize * (pageIndex);
                var endIndex = startIndex + self.pageSize;
                // Add a new page to the top. Set max-height to 0 since we don't know it's actual height yet
                self.pages.unshift({
                    items: self.originalItems.slice(startIndex, endIndex),
                    index: pageIndex,
                    bottomOffset: self.pages[0].bottomOffset + self.pages[0].height,
                    number: self.pages.length,
                    addPageHeightWatcher: self.addPageHeightWatcher(self.pages.length, self.originalItems)
                });

                for (var i = startIndex, j = 0; i < endIndex; i++, j++)
                    self.pages[0].items[j].index = i;

                //$log.debug("rxPaginationScroll - addPageAbove new page index = " + self.pages[0].index);


                if (self.getContainer().parent().scrollTop() < 800 && pageIndex !== 0) {
                    if (self.scrollingIsDisabled) {
                        self.enableScrollingIfNeeded();
                    } else {
                        self.resizeContainerForEstimation(pageIndex);
                    }
                }

                if (!shouldNotEnableScrolling) {
                    self.enableScrollingIfNeeded();
                }

                // If we added the first page we should enable the home button.
                self.disableEnableHomeScrolling();
            }

            // Add several pages while scrolling is disabeled. We do that in two steps:
            // 1. Add them hidden with bottom offset zero,
            // 2. After pages are rendered calculate their final absolute position
            PaginationScroller.prototype.addSeveralPagesAbove = function() {
                var self = this;

                if (self.maxPages != self.MAX_PAGE_TO_LOAD) {
                    self.maxPages = self.MAX_PAGE_TO_LOAD;
                }

                var totalPageCount = Math.floor(self.originalItems.length / self.pageSize);
                var pageIndex = self.pages[0].index - 1;

                for (var pageCounter = 0; pageCounter < self.maxPages && pageIndex >= 0; pageCounter++, pageIndex--) {
                    var startIndex = self.pageSize * pageIndex;
                    var endIndex = startIndex + self.pageSize;

                    // Add a new page to the top.
                    self.pages.unshift({
                        items: self.originalItems.slice(startIndex, endIndex),
                        index: pageIndex,
                        isHidden: true,
                        bottomOffset: 0,
                        number: self.pages.length,
                        addPageHeightWatcher: self.addPageHeightWatcher(self.pages.length, self.originalItems)

                    });

                    for (var i = startIndex, j = 0; i < endIndex; i++, j++)
                        self.pages[0].items[j].index = i;

                }

                // Wait till they will be rendered and calculate their absolut position
                $timeout(function(collection) {
                    self.repositionAllPagesAndShow(collection);
                    self.enableScrolling();

                    // If we added the first page we should enable the home button.
                    self.disableEnableHomeScrolling();
                    self.checkInProgress = false;
                }, 1000, true, self.originalItems);
            }
            PaginationScroller.prototype.pageHeight = function(pageIndex) {

                var pageElement = $('#page-' + (this.pages.length - 1 - pageIndex));

                if (pageElement.length == 0) return 0; // page was not rendered yet

                var elementHeight = pageElement.height();

                return elementHeight;

            }

            PaginationScroller.prototype.repositionAllPagesAndShow = function(collection) {
                var self = this;

                if (self.didCollectionChanged(collection)) {
                    return;
                }

                var foundDiff = false;

                for (var pageIndex = self.pages.length - 1; pageIndex >= 0; pageIndex--) {
                    var pageElement = $('#page-' + pageIndex);

                    if (pageElement.length == 0) {
                        $log.error("rxPaginationScroll - repositionAllPagesAndShow: Could not find element with ID #page-" + pageIndex);
                        return;
                    }

                    var page = self.pages[pageIndex];
                    var newHeight = pageElement.height() - 12;
                    foundDiff = foundDiff || newHeight != page.height;

                    page.height = newHeight;

                    if (page.height < 0) {
                        $log.error("rxPaginationScroll - repositionAllPagesAndShow: page height was not updated yet");
                        $timeout(function() {
                            self.repositionAllPagesAndShow(collection);
                        }, 1000, true);
                        return;
                    }

                    var pageBellow = (pageIndex < self.pages.length - 1) ? self.pages[pageIndex + 1] : null;
                    page.bottomOffset = (pageBellow) ? pageBellow.bottomOffset + pageBellow.height : 0;
                    page.isHidden = false;
                }

                if (self.pages[0].index === 0) {
                    // Found just rendered the first page, update the container real height.
                    self.setContainerKnownHeight();

                    // If we found different between the actual heights an model height we trigger another reposition
                    if (foundDiff) {
                        $timeout(function(collection) {
                            self.repositionAllPagesAndShow(collection);
                        }, 1000, true);
                    }
                }

            }

            PaginationScroller.prototype.addHiddenPageAbove = function(collection) {
                var self = this;

                self.addPageAbove(true);
                self.pages[0].isHidden = true;
            }

            PaginationScroller.prototype.resizeContainerForEstimation = function(pageIndex) {
                var self = this;
                // We scroll till top but we still add more messages to show --> increase the window
                var increasingSize = self.minMessageHeight * self.pageSize * pageIndex;
                self.containerSize += increasingSize;
                //$log.debug("rxPaginationScroll - addPageAbove scroll is near top --> increse window to " + self.containerSize);
                var container = self.getContainer.apply(self);

                // Adjust the scroll (increase the position with the new height addition)
                increasingSize += self.getContainer().parent().scrollTop();
                self.getContainer().parent().scrollTop(increasingSize);

                container.css({
                    height: self.containerSize + 'px'
                });
                self.pages[0].bottomOffset = self.pages[1].bottomOffset + self.pages[1].height;
            }

            /**
             * @function dc.paginationScroll.PaginationScroller#_watch
             * @protected
             *
             * @description
             * Watch for changes to scope properties and events fired by the scope and DOM
             */
            PaginationScroller.prototype._watch = function() {
                var collectionExp = this.expression.collection;
                var self = this;

                if (collectionExp) {
                    // Watch for data changes
                    this.scope.$watch(collectionExp, angular.bind(this, function watch(collection, oldCollection) {
                        if (collection && oldCollection && this.items) {
                            this.items = undefined;
                        }
                    }));

                    this.scope.$watchCollection(collectionExp, angular.bind(this, function watchCollection() {
                        this.update.apply(this, arguments);
                    }));

                    // Watch for onScroll event
                    this.scope.scrollContainer = this.element.parent().parent();
                    this.scope.scrollContainer.on('scroll', this._boundOnScroll = angular.bind(this, this._onScroll));

                    // Watch for $destroy event
                    this.scope.$on('$destroy', angular.bind(this, this._unwatch));
                }
            };

            /**
             * @function _unwatch
             * @protected
             *
             * @description
             * Watch for changes to scope properties and events fired by the scope and DOM
             */
            PaginationScroller.prototype._unwatch = function() {
                if (this._boundOnScroll) {
                    this.window.off('scroll', this._boundOnScroll);
                }
            };

            PaginationScroller.prototype.preventDefault = function(e) {
                e = e || window.event;

                if (e.preventDefault)
                    e.preventDefault();
                e.returnValue = false;
            }

            // Disable the home button default behavior if the first page ewas not loaded yet. In this
            // situation we scroll tilll the top page we loaded. If we already load the first page the home button behavior is restored.
            PaginationScroller.prototype.disableEnableHomeScrolling = function() {
                var self = this;
                if (!this.pages.length || this.pages[0].index === 0) {
                    document.onkeydown = null;
                    return; // if we already found the first page we can enable the home scrolling
                } else if (!document.onkeydown) {
                    document.onkeydown = function(e) {
                        if (e.keyCode === 36 /* home */ && $('.rxxx-message-list')[0] === e.target) {
                            e = e || window.event;
                            if (e.preventDefault)
                                e.preventDefault();
                            e.returnValue = false;
                            var container = self.getContainer();
                            var topPage = self.pages[0];

                            container.parent().scrollTop(container[0].scrollHeight - topPage.bottomOffset - topPage.height);
                            return false;
                        }
                    }
                }
            }

            PaginationScroller.prototype.disableScrolling = function(stopPosition) {
                var self = this;

                if (self.enableScrollingTimeout) {
                    $timeout.cancel(self.enableScrollingTimeout);
                    self.enableScrollingTimeout = null;
                }

                function preventDefaultForScrollKeys(e) {
                    // left: 37, up: 38, right: 39, down: 40,
                    // spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
                    var keys = {
                        37: 1,
                        38: 1,
                        39: 1,
                        40: 1,
                        33: 1,
                        36: 1
                    };

                    if (keys[e.keyCode]) {
                        e = e || window.event;
                        if (e.preventDefault)
                            e.preventDefault();
                        e.returnValue = false;
                        return false;
                    }
                }

                //$log.debug("rxPaginationScroll - Stop scroll at " + stopPosition);
                if (stopPosition > 0) {
                    this.getContainer().parent().scrollTop(stopPosition);
                }

                window.onwheel = this.preventDefault; // modern standard
                window.onmousewheel = document.onmousewheel = this.preventDefault; // older browsers, IE
                document.onkeydown = preventDefaultForScrollKeys;

                this.scrollingIsDisabled = true;
                if (this.pages.length > 0) {
                    $('#scrollingSpinner').css({
                        display: 'flex'
                    });
                };
            }

            PaginationScroller.prototype.enableScrolling = function() {
                var self = this;
                //$log.debug("rxPaginationScroll - Enable scrolling");


                self.scrollingIsDisabled = false;

                if (window.removeEventListener)
                    window.removeEventListener('DOMMouseScroll', self.preventDefault, false);
                window.onmousewheel = document.onmousewheel = null;
                window.onwheel = null;
                window.ontouchmove = null;
                document.onkeydown = null;
                self.disableEnableHomeScrolling();
                $('#scrollingSpinner').css({
                    display: 'none'
                })

            }

            PaginationScroller.prototype.stopScroll = function() {
                this.scrollStopTimeout = null;
                $rootScope.$broadcast('rxEndScroll');
            }

            /**
             * @function _onScroll
             * @protected
             *
             * @description
             * An event handler for scrolling.
             */
            PaginationScroller.prototype._onScroll = function(event) {
                var self = this;

                // notify prefetch on start and stop scrolling events
                if (self.scrollStopTimeout) {
                    $timeout.cancel(self.scrollStopTimeout);
                } else {
                    $rootScope.$broadcast('rxStartScroll');
                }


                self.scrollStopTimeout = $timeout(function() {
                    self.stopScroll();
                }, 300);

                // Stop scrolling if we pass the top message
                var container = this.getContainer();
                var scrollTop = container.parent().scrollTop();
                var scrollHeight = container[0].scrollHeight;
                var topStopPosition = scrollHeight - this.pages[0].bottomOffset - (this.pages[0].height ? this.pages[0].height : 0);

                if (topStopPosition >= scrollTop && this.pages[0].height && scrollTop > 100) {
                    //$log.debug("rxPaginationScroll - onScroll disable scroll: topStopPosition=" + topStopPosition + " scrollTop=" + scrollTop);
                    this.disableScrolling(topStopPosition);
                    this.check();
                }

                if (!this._throttledCheck) {
                    this._throttledCheck = throttle(angular.bind(this, this.check), this.options.scrollThrottle);
                }

                // Check if there's a need to fetch more data
                this._throttledCheck();
            };

            PaginationScroller.prototype.didCollectionChanged = function(collection) {
                var self = this;

                // check if collection was already changed
                if (!collection || collection.length === 0 || !self.originalItems || self.originalItems.length === 0 ||
                    collection[0] !== self.originalItems[0]) {
                    //$log.debug("rxPaginationScroll - didCollectionChanged. Collection changed during timeout work");
                    return true; // collection has changed
                } else
                    return false;
            }

            PaginationScroller.prototype.loadPageOnBackground = function(collection, addHidden) {
                var self = this;

                // Check if there is a page to load (we don't load the first page since it will resize the window. Will be loaded on scroll)
                if (self.checkInProgress && !addHidden) return;

                // check if collection was already changed
                if (self.didCollectionChanged(collection)) {

                    return; // collection has changed
                }


                //$log.debug("rxPaginationScroll - loadPageOnBackground. Number of pages = " + self.pages.length);

                // first check that we have the height for the top page
                var topPage = self.pages[0];

                if (!topPage.height) {
                    $timeout(function() {
                        if (self.didCollectionChanged(collection)) return;

                        self.setPageHeight();

                        // Trigger another loading (that can fetch more items) since the height was updated.
                        $timeout(function(collection) {
                            self.loadPageOnBackground(collection, addHidden);
                        }, 0, true, collection);
                    }, 300);
                    // Return since the heights are not ready yet...
                    return;
                }

                if (self.checkInProgress && !addHidden) return;

                self.checkInProgress = true;

                var pageInViewIndex = self.getIndexOfVisiblePage();

                //$log.debug("rxPaginationScroll - loadPageOnBackground: Page index " + pageInViewIndex + " is in view");

                var topIndex = self.pages[0].index;
                var bottomIndex = self.pages[self.pages.length - 1].index;
                var isBottomPageLoaded = self.bottomPages.length === 0;
                var isTopPageLoaded = self.pages[0].index === 0;

                if (!isTopPageLoaded && topIndex > 0 && (pageInViewIndex - topIndex < self.maxPages - 1)) {
                    addHidden ? self.addHiddenPageAbove() : self.addPageAbove(true);
                } else {
                    // FINISH - no more pages to load
                    self.checkInProgress = false;
                    if (addHidden) {
                        // if we added everything as hidden we show it now and enable the scrolling
                        //$log.debug("rxPaginationScroll - loadPageOnBackground: finish loading hidden pages");
                        self.showAllPages();
                        self.enableScrolling();
                    }
                    return;
                }

                self.checkInProgress = false;

                // Try to load more pages on background
                $timeout(function(collection) {
                    self.loadPageOnBackground(collection, addHidden);
                }, 50, true, collection);
            }

            PaginationScroller.prototype.getIndexOfVisiblePage = function() {
                var self = this;
                var container = self.getContainer();
                var scrollTop = container.parent().scrollTop();
                var scrollHeight = container[0].scrollHeight;
                var pageInViewIndex = -1;
                self.pages.forEach(function(page) {
                    var pageTop = scrollHeight - page.bottomOffset - page.height;

                    if (pageTop <= scrollTop && pageTop + page.height >= scrollTop)
                        pageInViewIndex = page.index;
                });

                if (pageInViewIndex < 0) {
                    $log.error("rxPaginationScroll - Could not find the current page index --> try to reposition");
                    pageInViewIndex = 0;
                    $timeout(function(collection) {
                        self.repositionAllPagesAndShow(collection);
                    }, 1000, true, self.originalItems);
                }

                return pageInViewIndex;
            }

            /**
             * @function dc.paginationScroll.PaginationScroller#_getParent
             * @protected
             * @returns {Object} The parent element of the directive element.
             *
             * @description
             * Find the parent element of the directive and return it.
             */
            PaginationScroller.prototype._getParent = function() {
                if (!this._parent || !this._parent.get(0)) {
                    this._parent = this.element.parent();
                }

                return this._parent;
            };

            /**
             * @constructor dc.paginationScroll.PaginationScrollerTemplate
             * @param {Object} element The directive element.
             * @param {Object} attrs The directive attributes.
             *
             * @description
             * The template of paginationScroll directive.
             */
            function PaginationScrollerTemplate(element, attrs) {
                this.html = this._create(element, attrs);
            }

            /**
             * @function toString
             * @returns {String} The template element as HTML string
             */
            PaginationScrollerTemplate.prototype.toString = function() {
                return this.html;
            };

            /**
             * @function _create
             * @param element {Object}
             * @param attrs {Object}
             * @returns {String} The template element as HTML string
             *
             * @description
             * Create a template element for the directive.
             */
            PaginationScrollerTemplate.prototype._create = function(element, attrs) {
                var elementAttrs = Array.prototype.slice.call(element.prop('attributes'), 0),
                    parsedExp = parseNgRepeatExp(attrs.paginationScroll),
                    ngRepeatExp = parsedExp.item + ' in page.items track by message.index' + (parsedExp.trackBy ? ' ' + parsedExp.trackBy : '');

                // Remove all element attributes as 'replace' already copies over these attributes
                // TODO: DOR why?
                angular.forEach(elementAttrs, function(attr) {
                    element.removeAttr(attr.name);
                });

                // Retain reference to the original repeat expression
                element.attr('ng-repeat', ngRepeatExp);
                var idExp = 'id="' + "{{'page-' + $index}}" + '"';
                var styleExp = 'ng-style="' +
                    "{'bottom': page.bottomOffset+'px'," +
                    " 'opacity': page.isHidden?0:1," + // when speed scrolling we load more pages and hide them till we complete calculate the position
                    " 'position': page.bottomOffset >= 0 ? 'absolute' : ''}" +
                    '"';

                // TODO: need to get the class rxx-message from directive parameter
                var loadingIndicator = "<div id='scrollingSpinner' style='display:none;justify-content:center;margin-top:-38px;'><div class='rx-spinner rx-spinner-small' style='position:fixed;z-index:2'></div></div>"
                var pageExp = "<div>" + loadingIndicator + " <div ng-repeat='page in _paginationScroll.pages track by page.number' " + idExp +
                    " class='rxxx-message-page' " + styleExp + " >";

                return pageExp + element.prop('outerHTML') + "</div> " + "</div>";
            };

            return {
                restrict: 'A',
                scope: true,
                replace: true,

                template: function(element, attrs) {
                    return (new PaginationScrollerTemplate(element, attrs)).toString();
                },

                controller: function($scope, $element, $attrs, $compile) {
                    var paginationScroll = new PaginationScroller($scope, $element, $attrs);

                    $scope._paginationScroll = paginationScroll;
                }
            };
        });
})();