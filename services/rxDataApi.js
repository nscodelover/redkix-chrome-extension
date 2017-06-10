angular.module('redKixServices').factory('$rxDataApi', ['$q', '$http', '$rxUtilities',
    function($q, $http, rxUtilities) {
        return new _serviceInstance();

        function _serviceInstance() {
            var self = this,
                defaultOptions = {
                    request: {},
                    query: {},
                    data: {}
                };

            self.setDefaults = function(newDefaults) {
                angular.extend(defaultOptions, newDefaults);
            };

            self.remote = function(request) {
                angular.merge(request, defaultOptions.request);

                if (request.hasOwnProperty('query')) {
                    if (!rxUtilities.isObjectNullOrEmpty(defaultOptions.query) && rxUtilities.isObjectNullOrEmpty(request.query)) {
                        request.query = {};
                    }

                    angular.merge(request.query, defaultOptions.query);
                }

                if (request.hasOwnProperty('params')) {
                    if (!rxUtilities.isObjectNullOrEmpty(defaultOptions.params) && rxUtilities.isObjectNullOrEmpty(request.params)) {
                        request.params = {};
                    }

                    angular.merge(request.params, defaultOptions.params);
                }

                return $http(request);
            };
        }
    }
]);
