angular.module('redKix')

.directive('rxOpenGraph', [function() {
    return {
        scope: {},
        bindToController: {
            editor: '=rxEditor',
            editorModel: '=rxEditorModel',
            openGraphObject: '=rxOpenGraphObject',
            openGraphId: '@rxOpenGraphId',
            reset: '=rxResetOpenGraph'
        },
        controller: 'openGraphCtrl',
        controllerAs: 'openGraphCtrl',
        templateUrl: 'views/rx-open-graph-container.html'
    };
}]);
