angular.module('redKix')

.service('rxOpenGraphService', ['$rxConfig', function(rxConfig) {
    var self = this;

    self.generateTemplateFromData = generateTemplateFromData;
    var rxConsts = rxConfig.consts;

    function generateTemplateFromData(openGraph) {
        return [
            '<br/>',
            '<a href="', openGraph.url, '" class="' + rxConsts.OPENGRAPH_CLASSES.SITE_URL_CLASS + '" target="_blank" style="text-decoration: none;">',
                '<div style="width: 100%; margin-top: 13px;white-space: normal;">',
                    '<div class="' + rxConsts.OPENGRAPH_CLASSES.SITE_NAME_CLASS + '" style="height: 16px; color: #c4c4cc; font-size: 12px">',
                        openGraph.siteName,
                    '</div>',
                    '<div style="background: #c4c5cc; padding-left: 2px;">',
                        '<div style="background: white; padding: 0 0 0 16px; margin-top: 12px; color: navy">',
                            '<div class="' + rxConsts.OPENGRAPH_CLASSES.TITLE_CLASS + '" style=";display:flex;">',
                                openGraph.image ? ['<img class="' + rxConsts.OPENGRAPH_CLASSES.IMAGE_URL_CLASS +'" src="', openGraph.image, '" style="width:auto; height: auto; max-height:100px;">'].join('') : '',
                                '<div style="margin-left:15px">',
                                    '<div style="color: #00aaff; margin-bottom: 4px; font-size: 16px">',
                                        '<font color="#00aaff"><b>', openGraph.title, '</b></font>',
                                    '</div>',
                                    '<div class="' + rxConsts.OPENGRAPH_CLASSES.DESCRIPTION_CLASS + '" style="line-height: 1.33; color: #454760; margin-bottom: 16px; font-size: 15px">',
                                        openGraph.description,
                                    '</div>',
                                '</div>',
                            '</div>',
                        '</div>',
                    '</div>',
                '</div>',
            '</a>'
        ].join('');
    }
}]);
