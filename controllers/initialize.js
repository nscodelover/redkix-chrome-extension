angular.module('redKix', ['appConfig', 'ngCookies', 'ngDialog', 'cfp.hotkeys',
    'redKixServices', 'ngSanitize', 'ui.tinymce', 'ngTagsInput', 'ngAnimate', 'ngMaterial', 'rxPaginationScroll', 'mgcrea.ngStrap'
]);

tinyMCE.baseURL = '/libs/tinymce';


// Trick for having contacts repo created before active user is running and adding the active user object to it
// Create the data repos
angular.module('redKix').run(['$rxApiURLs', '$rxRepoService', '$rxConfig', '$rxModelService', '$rootScope',
    function(apiUrls, repoService, rxConfig, modelService, $rootScope) {
        var rxConsts = rxConfig.consts;
        $rootScope.online = true;

        repoService.create('contacts', {
            registeredAPIs: {
                groups: {
                    url: apiUrls.groups,
                    method: "GET"
                },
                contacts: {
                    url: apiUrls.contacts,
                    method: "GET"
                },
                avatarURL: {
                    url: apiUrls.updateEntity,
                    method: "POST"
                }
            },
            model: modelService.Contact,
            quietRepo: true,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.CONTACT
        });

        repoService.create('contactDisplayNames', {
            model: modelService.ContactDisplayName,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.CONTACT_DISPLAY_NAME,
            quietRepo: true
        });


        repoService.create('conversations', {
            model: modelService.Conversation,
            registeredAPIs: {
                conversationsAndThreads: {
                    url: apiUrls.conversationsAndThreads,
                    method: "GET"
                },
                moveConversation: {
                    url: apiUrls.moveConversation,
                    method: "PUT"
                }
            },
            hasLoadMoreFunctionality: true,
            limit: 20,
            parentPrimaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.FOLDER,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.CONVERSATION
        });

        repoService.create('threads', {
            model: modelService.Thread,
            registeredAPIs: {
                moveThread: {
                    url: apiUrls.moveThread,
                    method: "PUT"
                },
                readUnread: {
                    url: apiUrls.readUnread,
                    method: "POST"
                }
            },
            parentPrimaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.CONVERSATION,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.THREAD,
            quietRepo: true
        });

        repoService.create('messages', {
            model: modelService.Message,
            registeredAPIs: {
                messages: {
                    url: apiUrls.messages,
                    method: "GET"
                },
                readUnread: {
                    url: apiUrls.readUnread,
                    method: "POST"
                }
            },
            parentPrimaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.THREAD,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.MESSAGE
        });

        repoService.create('files', {
            registeredAPIs: {
                files: {
                    url: apiUrls.getFile,
                    method: "GET"
                }
            },
            model: modelService.Attachment,
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.FILE,
            quietRepo: true
        });

        repoService.create('mailBoxFolders', {
            model: modelService.Folder,
            registeredAPIs: {
                mailBoxFolders: {
                    url: apiUrls.mailBoxFolders,
                    method: "GET"
                },
                moveConversation: {
                    url: apiUrls.moveConversation,
                    method: "PUT"
                }
            },
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.FOLDER
        });

        repoService.create('contactFolders', {
            model: modelService.Folder,
            registeredAPIs: {
                contactFolders: {
                    url: apiUrls.contactFolders,
                    method: "GET"
                },
                moveConversation: {
                    url: apiUrls.moveConversation,
                    method: "PUT"
                },
                contactFoldersPUT: {
                    url: apiUrls.contactFolders,
                    method: "PUT"
                }
            },
            primaryKeyFields: rxConsts.ENTITY_PRIMARY_KEYS.FOLDER
        });

        // TODO: Find a solution for this.
        repoService.setAllRepos();

        modelService.setRepos();

        repoService.getAllRepos().conversations.setCurrentFilters({
            parentFilterValuesObject: {
                uid: rxConsts.SEARCH_FOLDER_UID
            }
        });
    }
]);

angular.module('redKix').run(['$redKixActiveUserService', '$rxDataApi',
    function(ActiveUser, rxDataApi) {
        if (ActiveUser.getSessionToken) {
            rxDataApi.setDefaults({
                request: {
                    withCredentials: false,
                    contentType: "application/json; charset=utf-8",
                    crossDomain: true,
                    processData: false,
                    dataType: "json"
                },
                query: {
                    sessionUID: ActiveUser.getSessionToken()
                },
                params: {
                    sessionUID: ActiveUser.getSessionToken()
                }
            });
        }
    }
]);

// configure rxEmailSanitizer
angular.module('redKix').run(['rxEmailSanitizer', function(rxEmailSanitizer) {
    rxEmailSanitizer.enableSvg(true);
    rxEmailSanitizer.addValidAttrs('style');
    rxEmailSanitizer.addValidElements('style');
    rxEmailSanitizer.removeBlockedElements('style');
    //rxEmailSanitizer.removeUriAttrs('src');
}]);

// configure $$sanitizeUri, which is part of the $compileProvider & is used by rxEmailSanitizer to whitelist certain <img> src= values.
angular.module('redKix').config(function($compileProvider) {
    var imgSrcSanitizationWhitelist = /^\s*((https?|ftp|file|cid):|data:image\/)/;
    $compileProvider.imgSrcSanitizationWhitelist(imgSrcSanitizationWhitelist);
});

angular.module('redKix').config([
    '$compileProvider',
    function($compileProvider) {
        var currentImgSrcSanitizationWhitelist = $compileProvider.imgSrcSanitizationWhitelist();
        var newImgSrcSanitizationWhiteList = currentImgSrcSanitizationWhitelist.toString().slice(0, -1) + '|chrome-extension:' + currentImgSrcSanitizationWhitelist.toString().slice(-1);

        console.log("Changing imgSrcSanitizationWhiteList from " + currentImgSrcSanitizationWhitelist + " to " + newImgSrcSanitizationWhiteList);
        //$compileProvider.imgSrcSanitizationWhitelist(newImgSrcSanitizationWhiteList);
    }
]);

// Change the default place holder of the tags compontnt to be an empty string instead of "Add a tag"
angular.module('redKix').config(function(tagsInputConfigProvider) {
    tagsInputConfigProvider.setDefaults('tagsInput', {
        placeholder: ''
    });
});

// Change the input padding-right of a tag. It is shown when tag is invalid
angular.module('redKix').config(function(tagsInputConfigProvider) {
    tagsInputConfigProvider.setTextAutosizeThreshold(15);
});

angular.module('redKix').run(['$templateCache',
    function($templateCache) {
        $templateCache.put('ngTagsInput/tags-input.html',
            '<div class="host" tabindex="-1" ng-click="eventHandlers.host.click()" ti-transclude-append><div class="tags" ng-class="{focused: hasFocus}"> ' +
            '<ul class="tag-list"><li class="tag-item" ng-repeat="tag in tagList.items track by track(tag)" ' +
            'ng-class="{ selected: tag == tagList.selected , group: tag.contactType === ' + "'GROUP'" + '}" ng-style="{' + "'color': tag.hasOwnProperty('getDisplayName') && tag.getDisplayName($parent.contextObjectUID) ? '#52ADE4':'# 000000'}" + '"' +
            'ng-click="eventHandlers.tag.click(tag)"><ti-tag-item data="::tag"></ti-tag-item></li></ul><input class="input" autocomplete="off" ng-model="newTag.text"' +
            'ng-model-options="{getterSetter: true}" ng-keydown="eventHandlers.input.keydown($event)" ng-focus="eventHandlers.input.focus($event)" ng-blur="eventHandlers.input.blur($event)"' +
            'ng-paste="eventHandlers.input.paste($event)" ng-trim="false" ng-class="{' + "'invalid-tag': newTag.invalid}" + '"ng-disabled="disabled"' +
            'ti-bind-attrs="{type: options.type, placeholder: options.placeholder, tabindex: options.tabindex, spellcheck: options.spellcheck}" ti-autosize></div></div>'
        );

        $templateCache.put('ng-mfb-button-text.tpl.html',
            '<li>' +
            '  <a class="mfb-component__button--child">' +
            '    <div class="mfb-component__child-text">{{label}}' +
            '    </div>' +
            '  </a>' +
            '</li>'
        );

        $templateCache.put('ng-mfb-menu-rx-attach.tpl.html',
            '<ul class="mfb-component--{{position}} mfb-{{effect}}"' +
            '   data-mfb-toggle="{{togglingMethod}}" data-mfb-state="{{menuState}}">' +
            '<li class="mfb-component__wrap">' +
            ' <a ng-click="clicked()" ng-mouseenter="hovered()" ng-mouseleave="hovered()"' +
            '   class="mfb-component__button--main">' +
            '<i class="mfb-component__main-icon--resting {{resting}} mfb-component__main-icon--active {{active}} fixer"></i>' +
            '<div>{{label}}</div>' +
            '</a>' +
            '<ul class="mfb-component__list" ng-transclude>' +
            '</ul>' +
            '</li>' +
            '</ul>'
        );

        $templateCache.put('ngTagsInput/auto-complete.html',
            '<div class="autocomplete" ng-if="suggestionList.visible"><ul class="suggestion-list"><li class="suggestion-item"' +
            'ng-repeat="item in suggestionList.items track by track(item)" ng-class="{selected: item == suggestionList.selected}"' +
            'ng-style="{' + "'border-top': $index>0?'1 px solid #EAECEE':'0px'}" + '" ng-click="addSuggestionByIndex($index)" ng-mouseenter="suggestionList.select($index)">' +
            '<ti-autocomplete-match data="::item"></ti-autocomplete-match></li></ul></div>'
        );

    }
]);


angular.module('redKix').run(['$rxRealTimeManager',
    function(redKixRealTimeManager) {
        if (!redKixRealTimeManager.initialize) return;
        redKixRealTimeManager.initialize();
    }
]);

angular.module('redKix').run(["$rxRepoService",
    function(repoService) {
        var contacts = repoService.getAllRepos().contacts;


    }
]);