'use strict';

angular.module('redKix')

.controller('openGraphCtrl', ['$scope', '$http', '$redKixActiveUserService', '$rxOutbound', '$rxConfig', function($scope, $http, ActiveUser, rxOutbound, rxConfig) {
    var self = this;

    var ignoreUrls = [];
    var thisRunSeenUrls = [];
    var previousRunSeenUrls = [];
    var requestOpenGraphPromise;
    var rxConsts = rxConfig.consts;

    watchForUrls();
    self.checkUrls = watchForUrls;
    self.showContent = false;
    self.reset = reset;
    self.removeOpenGraph = function() {
        self.showContent = false;
        self.openGraphObject = undefined;
        cancelPromise(requestOpenGraphPromise);
        watchForUrls();
    };

    function cancelPromise(promise) {
        if (promise && _.isFunction(promise.resolve)) {
            promise.resolve();
        }
    }

    function watchForUrls() {
        if (_.isFunction(self.stopWatching)) {
            return;
        }
        self.stopWatching = $scope.$watch(_.debounce(function() {
            return self.editorModel;
        }, 300), function() {
            parseLinksForOpenGraph();
            if (!$scope.$root.$$phase) {
                $scope.$apply();
            }
        });
    }

    function reset(resetIgnoredUrls) {
        self.removeOpenGraph();
        if (resetIgnoredUrls) {
            ignoreUrls = [];
        }
    }

    function getHostname(url) {
        var link = document.createElement('a');
        link.setAttribute('href', url);

        return link.hostname;
    }

    function isImage(src) {
        var deferred = Q.defer();

        var image = new Image();
        image.onerror = function() {
            deferred.resolve(false);
        };
        image.onload = function() {
            deferred.resolve(true);
        };
        image.src = src;

        return deferred.promise;
    }

    function goOverUrls(urlStack, deferred) {
        if (!deferred) {
            deferred = Q.defer();
        }

        var localUrlStack = urlStack || [];
        var url = localUrlStack.shift();

        console.info('OPEN GRAPH: running on url', url);

        if (_.isEmpty(urlStack) && _.isEmpty(url)) {
            console.info('OPEN GRAPH: run finished with no urls');
            deferred.reject('no open graph url found');
            return deferred.promise;
        }

        console.info('GETTING OPENGRAPH DATA: ', url);
        requestOpenGraphPromise = deferred;
        rxOutbound.getOpenGraphData(url).then(function(res) {
            var data = res.data;

            if (_.isEmpty(data.openGraph)) {
                console.info('OPEN GRAPH: server returned empty OG for this url. checking next...', url);
                goOverUrls(localUrlStack, deferred);
            } else {
                isImage(data.favicon).then(function(goodImage) {
                    console.info('OPEN GRAPH: selected! STOPPING!!!!!', url);
                    deferred.resolve({
                        url: data.openGraph.url || url,
                        favicon: goodImage ? data.favicon : undefined,
                        siteName: data.openGraph.site_name || getHostname(data.openGraph.url || url),
                        title: data.openGraph.title,
                        description: data.openGraph.description,
                        image: data.openGraph.image,
                        type: data.openGraph.type
                    });
                });
            }
        }, function(error) {
            console.error(error);
            console.info('OPEN GRAPH: not exists! going to next iteration', url);
            goOverUrls(localUrlStack, deferred);
        });

        return deferred.promise;
    }

    function parseLinksForOpenGraph() {
        if (!self.editorModel) {
            return;
        }
        var htmlCopy = self.editorModel.concat('');
        // remove style tags so that css won't be parsed as urls
        var asElement = $('<div>' + htmlCopy + '</div>');
        asElement.find('style').remove();
        // NOTICE(neilkalman-redkix): this is tightly related to quoted-editable-template.html
        asElement.find('[title="forwarded-message"]').remove();
        asElement.find('div[' + rxConsts.SIGNATURE_CLASS + ']').remove();
        htmlCopy = asElement.html();
        var options = {
            newWindow: true,
            stripPrefix: false,
            className: 'rx-url',
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
                    case 'url':
                        var url = match.getUrl();

                        var shouldAddToSeenUrls = thisRunSeenUrls.indexOf(url) === -1;

                        if (shouldAddToSeenUrls) {
                            thisRunSeenUrls.push(url);
                        }

                        return true;
                    default:
                        /* let Autolinker make the element itself */
                        return;
                }
            }
        };
        Autolinker.link(htmlCopy, options);
        // After autolinker ran, we have all seen urls in thisRunSeenUrl
        // first, remove urls already in the ignore list
        var potentialUrls = _.difference(thisRunSeenUrls, ignoreUrls);
        // add all the rest to the ignore list
        ignoreUrls = _.union(ignoreUrls, potentialUrls);

        if (!_.isEmpty(potentialUrls)) {
            // try to find open graph
            // if user cancelled the request while it was happening,
            // userCancellation will be true, (since we're not inside a synced run)
            goOverUrls(potentialUrls).then(function(openGraph) {
                if (_.isObject(openGraph)) {
                    self.openGraphObject = openGraph;
                    self.showContent = true;

                    // stop watching for new urls until open graph reset
                    _.isFunction(self.stopWatching) && self.stopWatching();
                    self.stopWatching = null;

                    if (!$scope.$root.$$phase) {
                        $scope.$apply();
                    }
                }
            }, function(error) {
                console.info(error);
            });
        }
        // thisRunSeenUrls should contain all urls from this run.
        // if anyone of the urls of the previous run was deleted,
        // remove it from the ignore list
        var removedUrls = _.difference(previousRunSeenUrls, thisRunSeenUrls);

        if (!_.isEmpty(removedUrls)) {
            console.info('OPEN GRAPH: urls removed by user', removedUrls);
        }

        ignoreUrls = _.difference(ignoreUrls, removedUrls);
        previousRunSeenUrls = thisRunSeenUrls;
        thisRunSeenUrls = [];
    }
}]);