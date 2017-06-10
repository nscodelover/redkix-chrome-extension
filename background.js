var sessionInfo = null;
var tabIdToData = {};
var callbackForNavigationEvent = {};
var toggle = false;

function hashCode(str) {
    var hash = 0,
        i, chr, len;
    if (str.length == 0) return hash;
    for (i = 0, len = str.length; i < len; i++) {
        chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

function ifExists(collection, node) {
    var exists = false;

    collection.forEach(function(collectionItem) {
        if (exists) {
            return;
        }

        if (collectionItem.subject === node.subject) {
            exists = true;
            return;
        }
    });

    return exists;
}

function findNodeIndex(collection, node) {
    var index = -1;

    collection.forEach(function(collectionItem, idx) {
        if (index > -1) {
            return;
        }

        if (collectionItem.subject === node.subject) {
            index = idx;
            return;
        }
    });

    return index;
}

function runParsingScriptOnActiveTab(caller, responseCallback) {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function(tabs) {
        if (tabs && tabs.length > 0) {
            //console.info("Got active tab. Length=" + tabs.length + " tabs[0]" + tabs[0].url);
            chrome.tabs.sendMessage(tabs[0].id, {
                caller: caller
            }, responseCallback);
        } else {
            runParsingScriptOnActiveTab(caller, responseCallback);
        }
    });
}

function getActiveTab(callBack) {
    chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
    }, function(tabs) {
        if (tabs && tabs.length > 0) {
            if (tabs.length > 1) {
                console.error("got more than one active tab", tabs);
            }
            return callBack(tabs[0]);
        } else {
            callBack(null);
        }
    });
}

function getSidebarTab(callback) {
    chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
    }, function(tabs) {
        if (tabs && tabs.length > 0) {
            if (tabs.length > 1) {
                console.error("got more than one active tab", tabs);
            }
            return callBack(tabs[0]);
        } else {
            callBack(null);
        }
    });
}

function disableExtensionIconIfNeeded(tab) {
    if (tab.url.indexOf(".redkix.com") > 0) {
        chrome.browserAction.setIcon({
            path: "redkix-logo-disable.png",
            tabId: tab.id
        });
        chrome.browserAction.setTitle({
            title: "Redkix extension is disabled for this site",
            tabId: tab.id
        })
    }
}

function navigationOccured(data) {
    if (!sessionInfo) {
        sessionInfo = getCookieObject();
        if (!sessionInfo) {
            console.warn("Redkix - No session cookie");
            sendMessageToActiveTab({
                operation: 'rx-create-sidebar'
            }, function(a) {});
            return;
        }
    }

    getActiveTab(function(tab) {
        if (!tab) {
            console.warn("Could not locate active tab");
            return;
        }

        disableExtensionIconIfNeeded(tab);

        getActiveTabSearchQuery(function(pluginData) {
            console.assert(pluginData, "No plugin data");

            var request = getUrlForEnv(sessionInfo.env) + "//conversationsAndThreads?";
            var json = {
                folderUID: "11111111-1111-1111-1111-111111111111",
                query: "\"" + pluginData.searchQuery + "\"",
                sessionUID: sessionInfo.session
            };
            var tabData = null;
            //console.info("Send request: ", request, json);

            $.getJSON(request, json).done(function(data) {
                console.log("getJson success", data);
                tabData = data;
            }).fail(function(error) {
                console.error("getJSON error", error);
            }).always(function() {
                updateExtensionIconBadgeAccordingToData(tabData, tab);
                disableExtensionIconIfNeeded(tab);
                tabIdToData[tab.id] = tabData;
            });
        });

        sendMessageToActiveTab({
            operation: 'rx-create-sidebar'
        }, function(a) {});
    });

}

function updateExtensionIconBadgeAccordingToData(data, tab) {
    if (!data || !data.conversations || !data.conversations.length) {
        chrome.browserAction.setBadgeText({
            text: ''
        });

        chrome.browserAction.setTitle({
            title: "Open redkix extension to start new conversation on current web site",
            tabId: tab.id
        });

    } else {
        chrome.browserAction.setBadgeText({
            text: data.conversations.length.toString()
        });

        chrome.browserAction.setTitle({
            title: "Open redkix to conversations on this site",
            tabId: tab.id
        });
    }
}

function onHistoryStateUpdatedListener_(data) {
    navigationOccured(data);
}

function onCompletedListener_(data) {
    navigationOccured(data);
}

function getActiveTabSearchQuery(callback) {
    var pluginData = {};
    getActivePlugin(function(plugin) {
        if (!plugin.searchQuery) {
            console.error("No searchQuery field in plugin", plugin.name);
            return;
        }

        var messageRequest = {
            template: plugin.searchQuery,
            operation: "rx-parse-template"
        }

        // Get search query
        sendMessageToActiveTab(messageRequest, function(searchQueryResponse) {
            pluginData.searchQuery = searchQueryResponse.parsedTemplate;
            callback(pluginData);
        });

    });
}

function getActiveTabDataForCompose(callback) {
    var pluginData = {};
    getActivePlugin(function(plugin) {
        // get meta data of the site
        sendMessageToActiveTab({
            operation: 'rx-get-site-meta-data'
        }, function(metadata) {
            var subjectTemplate = adjustTemplate(plugin.subjectTemplate, metadata);
            var messageRequest = {
                    template: subjectTemplate,
                    operation: "rx-parse-template"
                }
                // Get the subject
            sendMessageToActiveTab(messageRequest, function(subjectResponse) {
                pluginData.subject = subjectResponse.parsedTemplate;
                //open the body template file
                getFileContent(plugin.bodyTemplateFile, function(bodyTemplate) {
                    bodyTemplate = adjustTemplate(bodyTemplate, metadata);

                    var eValExpressionArray = [];
                    var evalRegExp = /{{[^{}]*}}/g;
                    var encounteredExp = {};

                    for (var exp = evalRegExp.exec(bodyTemplate); exp; exp = evalRegExp.exec(bodyTemplate)) {
                        var expressionToEval = exp[0].slice(2, -2);
                        if (encounteredExp[expressionToEval]) continue; // already have this expression
                        encounteredExp[expressionToEval] = true;
                        eValExpressionArray.push({
                            exp: expressionToEval
                        });
                    }

                    messageRequest.expressionToEvaluate = eValExpressionArray;
                    messageRequest.operation = "rx-eval-expressions";

                    // Get the body
                    sendMessageToActiveTab(messageRequest, function(expressionsValues) {
                        expressionsValues.forEach(function(expressionValue) {
                            var expression = "{{" + expressionValue.exp + "}}";
                            while (bodyTemplate.indexOf(expression) >= 0) {
                                bodyTemplate = bodyTemplate.replace(expression, expressionValue.value);
                            }
                        });

                        pluginData.body = bodyTemplate;

                        var searchQueryTemplate = adjustTemplate(plugin.searchQuery, metadata);

                        messageRequest.template = searchQueryTemplate;
                        messageRequest.operation = "rx-parse-template";

                        // Get search query
                        sendMessageToActiveTab(messageRequest, function(searchQueryResponse) {
                            pluginData.searchQuery = searchQueryResponse.parsedTemplate;
                            callback(pluginData);
                        });

                    })
                });
            });
        });
    });
}

function comparePluginPriority(plugin1, plugin2) {
    if (plugin1.priority > plugin2.priority)
        return -1;
    else
        return 1;
}

function adjustTemplate(template, metadata) {
    if (template.join) {
        template = template.join(" ");
    }

    Object.keys(metadata).forEach(function(propertyName) {
        template = template.replace(RegExp("{{meta." + propertyName + "}}", "g"), metadata[propertyName]);
        template = template.replace(RegExp("meta." + propertyName, "g"), metadata[propertyName] ? metadata[propertyName] : '');
    });

    return template;
}



function getActivePlugin(callback) {
    sendMessageToActiveTab({
        operation: 'rx-get-url'
    }, function(response) {
        if (!response) return;
        getJsonFileContent('/plugins/plugins.json', function(plugins) {
            getAllPlugings(plugins.plugins, function(plugins) {
                var sortedPlugins = plugins.sort(comparePluginPriority);
                for (i = 0; i < sortedPlugins.length; i++) {
                    var plugin = plugins[i];
                    if (RegExp(plugin.urlMatcher).test(response.url)) {
                        //console.info("Found a match to plugin: " + plugin.name);
                        return callback(plugin);
                    }
                }
                console.error("Could not find a plugin to match url: " + response.url);

            });
        });
    });
}

function getAllPlugings(pluginNames, callback) {
    var allPlugins = [];
    getNextPlugin(pluginNames, allPlugins, function() {
        callback(allPlugins);
    });
}

function getNextPlugin(pluginNames, pluginsArray, callback) {
    if (!pluginNames.length) {
        callback();
        return;
    }

    var pluginName = pluginNames.pop();
    getJsonFileContent('/plugins/' + pluginName, function(plugin) {
        pluginsArray.push(plugin);
        getNextPlugin(pluginNames, pluginsArray, callback);
    });
}

function getJsonFileContent(fileName, callback) {
    $.getJSON(chrome.extension.getURL(fileName)).done(function(fileContent) {
        callback(fileContent);
    }).fail(function(error) {
        console.error("Fail to get content of Json file: " + fileName, error);
    });
}

function getFileContent(fileName, callback) {
    $.get(chrome.extension.getURL(fileName)).done(function(fileContent) {
        callback(fileContent);
    }).fail(function(error) {
        console.error("Fail to get content of Json file: " + fileName, error);
    });
}

function sendMessageToActiveTab(request, sendResponse) {
    getActiveTab(function(tab) {
        if (!tab) return;
        request.url = tab.url;
        chrome.tabs.sendMessage(tab.id, request, null, function(response) {
            sendResponse(response);
        });
    });
}

chrome.webNavigation.onHistoryStateUpdated.addListener(
    onHistoryStateUpdatedListener_);
chrome.webNavigation.onCompleted.addListener(
    onCompletedListener_);

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (callbackForNavigationEvent[tabId]) {
        callbackForNavigationEvent[tabId]();
        callbackForNavigationEvent[tabId] = null;
    }

    navigationOccured({});
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.sendToActiveTab) {
            sendMessageToActiveTab(request, sendResponse);
            return true;
        } else {
            switch (request.operation) {
                case 'rx-get-search-query':
                    getActiveTabSearchQuery(sendResponse);
                    return true;

                case 'rx-get-plugin-data-for-compose':
                    getActiveTabDataForCompose(sendResponse);

                    return true;

                case 'rx-set-session-cookie':
                    setSessionCookie(request.cookieValue);
                    navigationOccured({});
                    break;
                case 'rx-reset-session-cookie':
                    resetSessionCookie(request.cookieValue);
                    break;
                case 'rx-register-to-navigation-event':
                    registerToNavigationEvent(sender, sendResponse);
                    return true;
                case 'rx-logout':
                    logOut();
                    break;
                case 'rx-refresh':
                    navigationOccured({});
                    break;
            }
        }
    });

function logOut() {
    sessionInfo = null;
    resetSessionCookie();
    clearCookies();
    getActiveTab(function(tab) {
        updateExtensionIconBadgeAccordingToData({}, tab);
    });
}

function registerToNavigationEvent(sender, callback) {
    callbackForNavigationEvent[sender.tab.id] = callback;
}

chrome.browserAction.onClicked.addListener(
    function(tab) {
        var op = '';
        toggle = !toggle;
        if (toggle) {
            op = 'rx-show-sidebar';     
        } else {
            op = 'rx-hide-sidebar';
        }

        sendMessageToActiveTab({
            operation: op
        }, function(a) {});
    });


function setSessionCookie(cookieValue) {
    var expDays = 365 * 3;
    // TODO: Add encryption - https://github.com/mpetersen/aes-example
    //console.info("set cookie session uid:", cookieValue);
    setCookie("session", cookieValue.session.uid, expDays);
    setCookie("env", cookieValue.env, expDays);
    sessionValue = cookieValue.session.uid;
}

function resetSessionCookie() {
    var expDays = 365 * 3;
    // TODO: Add encryption - https://github.com/mpetersen/aes-example
    setCookie("session", "", expDays);
    setCookie("env", "", expDays);
    sessionValue = null;
}

function getUrlForEnv(env) {
    envMap = {
        integration: 'https://int-clientapi.redkix.com',
        staging: 'https://stg-clientapi.redkix.com',
        production: 'https://prod-clientapi.redkix.com'
    };

    console.assert(envMap[env], "Could not locate url for environment: " + env);
    return envMap[env];
}

function getCookieObject() {
    cookieObject = {};

    cookieObject.session = getCookie("session");
    cookieObject.env = getCookie("env");
    if (!cookieObject.session || !cookieObject.env) {
        return null;
    } else {
        return cookieObject;
    }
}

function clearCookies() {
    document.cookie = "";
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires=" + d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return null;
}

chrome.commands.onCommand.addListener(function(command) {
    if (command == "toggle-pin") {
        console.log('resetting parsing data');
        parsingData = {};
        // runParsingScriptOnActiveTab('oldAgent', function(response) {
        //     if (response !== null) {
        //         var parseResults = JSON.parse(response);

        //         parseResults.forEach(function(parseResult) {
        //             var idx = findNodeIndex(parsingData, parseResult);

        //             if (idx === -1) {
        //                 parsingData.push(parseResult);
        //             } else {
        //                 console.log('updating node', parseResult, ' with the old one', parsingData[idx]);
        //                 parsingData[idx] = parseResult;
        //             }
        //         });

        //         findRedKixTab();

        //         console.log('total parsing data', parsingData);
        //     }
        // });
    }
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(tab) {
        updateExtensionIconBadgeAccordingToData(tabIdToData[activeInfo.tabId], tab);

    })
});

function isRedKixTab(tab) {
    return tab.title.toLowerCase().indexOf('redkix') > -1;
}

function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    } else var expires = "";

    return name + "=" + value + expires + "; path=/";
}

function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}