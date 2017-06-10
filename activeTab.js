var COOKIE_NAME = 'rxSF';
var SF_KEY_NAME = 'rxSF';
var RX_SECRET = 'rxSecret';
var COOKIE_DAYS_OF_LIFE = 365 * 3;

var discussLogoURL, composeCloseURL, composeModalURL,
    autoCompletePartialURL, tagsInputPartialURL, editorStyleURL, parseResult, deskLogoURL,
    numOfDiscussions = 0;


function rxGetDataURLFromImg(imageElement) {
    var canvas = document.createElement('canvas');
    canvas.width = imageElement.width;
    canvas.height = imageElement.height;
    canvas.getContext('2d').drawImage(imageElement, 0, 0, imageElement.width, imageElement.height);
    var dataUrl = canvas.toDataURL("image/png");

    return dataUrl;
}

if (document.title !== 'RedKix') {
    chrome.runtime.onMessage.addListener(
        function(request, sender, sendResponse) {

            // Make sure we are in the right frame of the site (according to the url)
            if (request.url !== document.location.href) return;

            switch (request.operation) {
                case 'rx-create-sidebar':
                    createSidebar();
                    break;

                case 'rx-hide-sidebar':
                    hideSidebar();
                    break;

                case 'rx-show-sidebar':
                    showSidebar();
                    break;

                case 'rx-expand-full-width-sidebar':
                    expandSidebarToFullWidth();
                    break;

                case 'rx-shrink-to-normal-width-sidebar':
                    shrinkSidebarToRegularWidth();
                    break;

                case 'rx-parse-template':
                    try {
                        var illegaCharsCodes = [10];
                        illegaCharsCodes.forEach(function(charCode) {
                            request.template = request.template.replace(RegExp(String.fromCharCode(charCode), "g"), " ");
                        });

                        var parsedTemplate = eval(request.template).trim();
                    } catch (err) {
                        console.error("Fail to eval() expression: " + request.template, err);
                        sendResponse({
                            parsedTemplate: "Fail to evaluate plugin template for site <br> <b>url:</b> " + document.location.href + "<br> <b>template:</b>" + request.template
                        });
                    }
                    sendResponse({
                        parsedTemplate: parsedTemplate
                    });
                    return true;

                case 'rx-get-url':
                    var url = document.location.href.slice(0);
                    sendResponse({
                        url: url
                    });
                    return true;

                case 'rx-get-site-meta-data':
                    var metadata = getSiteMetadata();
                    sendResponse(metadata);
                    return true;
                case 'rx-eval-expressions':
                    var expressionValues = getExpressionValues(request.expressionToEvaluate);
                    sendResponse(expressionValues);
                    return true;
            }
        });
}

// go over the template and replace any call to rxGetDataURLFromImg with the data url of the expression parameter.
function replaceImageToDataUrl(template) {
    var dataUrlRegExp = RegExp("rxGetDataURLFromImg\\([^\\)]*\\)", "g");
    var funcCallExpArray = [];

    var funcCallExp = dataUrlRegExp.exec(template);

    if (!funcCallExp) return null;

    //get the image
    var imageSelector = funcCallExp[0].replace("rxGetDataURLFromImg(", "");
    try {
        var imageElement = eval(imageSelector)[0];
        var dataUrl = rxGetDataURLFromImg(imageElement);
        return "'" + dataUrl + "'";
    } catch (err) {
        console.error("replaceImageToDataUrl: Fail to get DataUrlFromImage selector ", imageSelector, imageElement);
    };

    return "fail";
}

function getExpressionValues(expressions) {
    expressions.forEach(function(exp) {
        try {
            // check if this should be image with data URL
            exp.value = replaceImageToDataUrl(exp.exp);
            if (!exp.value) {
                exp.value = eval(exp.exp).trim();
            }
        } catch (err) {
            console.error("Fail to eval() expression: " + exp.exp, err);
            exp.value = "fail";
        }
    });

    return expressions;
}

function parseTemplate(template) {
    return "parsed template: " + template;
}

function getSiteMetadata() {
    // get meta data according to open graph
    var openGraphProperties = [{
        name: "title",
        fallback: getTitle
    }, {
        name: "type",
    }, {
        name: "url",
        fallback: getUrl
    }, {
        name: "description",
    }, {
        name: "image",
    }, {
        name: "site_name"
    }];

    var metadata = {};
    openGraphProperties.forEach(function(property) {
        var metaElement = document.querySelectorAll("[property='og:" + property.name + "']");
        if (metaElement && metaElement.length) {
            metadata[property.name] = metaElement[0].content;
        } else {
            metaElement = document.querySelectorAll("[name='" + property.name + "']");
            if (metaElement && metaElement.length) {
                metadata[property.name] = metaElement[0].content;
            } else if (property.fallback) {
                metadata[property.name] = property.fallback();
            } else {
                metadata[property.name] = "";
            }
        }
    });

    var documentTitle = $("title")[0].innerText;
    if (documentTitle && documentTitle.length > 0)
        metadata.title = documentTitle;

    return metadata;
}

function getTitle() {
    return document.title;
}

function getUrl() {
    return document.location.hostname;
}

function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    } else var expires = "";
    document.cookie = name + "=" + value + expires + "; path=/";
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

function deleteCookie(name) {
    createCookie(name, "", -1);
}

// Avoid recursive frame insertion...
var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
var dissapearClass = 'dissappear-to-right';
var htmlShrinkClass = "rk-html-shrink";
var animateHtmlMarginClass = "rx-animate-slide-right";

function createSidebar() {
    if (!location.ancestorOrigins.contains(extensionOrigin)) {
        var iframe = document.getElementById("rxSidebarFrame");
        if (!iframe) {

            iframe = document.createElement('iframe');
            iframe.id = "rxSidebarFrame";
            // Must be declared at web_accessible_resources in manifest.json
            iframe.src = chrome.runtime.getURL('views/sidebar-frame.html');

            // Some styles for a fancy sidebar
            addCssClassToDoc(dissapearClass, 'transform:translateX(342px)')
            iframe.style.display = 'none';
            setFrameStyle(iframe)

            // classes for shrinnking the main html when the sidebar is visible
            addCssClassToDoc(htmlShrinkClass, 'margin-right:322px;position:relative;');
            addCssClassToDoc(animateHtmlMarginClass, 'transition: margin-right 0.6s;');
            document.documentElement.className += " " + animateHtmlMarginClass;
            setTimeout(function() {
                iframe.style.display = 'block';
                iframe.className = dissapearClass;
                //removeFixedPositionElements(["#oneHeader", ".forceHighlightsStencilDesktop.s1FixedTop"]);
            }, 400);
            document.body.appendChild(iframe);
        }
    } else {
        console.error("createSidebar was clled on the extension itself (not a real error)");
    }
}

function removeFixedPositionElements(fixedPositionSelectors, retry) {
    if (!fixedPositionSelectors) return;
    if (retry > 6) return;

    fixedPositionSelectors.forEach(function(elementSelector) {
        var element;
        if (elementSelector.startsWith("#")) {
            element = document.getElementById(elementSelector.slice(1))
        } else if (elementSelector.startsWith(".")) {
            element = document.getElementsByClassName(elementSelector.slice(1))
        }

        if (!element || !element.length) {
            //console.error("removeFixedPosisionElements:  could not locate the element using selector " + elementSelector);
            setTimeout(
                function() {
                    removeFixedPositionElements(fixedPositionSelectors, retry ? retry + 1 : 1)
                }, 3000);
            return;
        }

        element[0].style.position = "relative";
    })
}

function setFrameStyle(iframe) {
    iframe.style.right = "0";
    iframe.style.top = "0";
    iframe.style.position = "fixed";
    iframe.style.height = "100%";
    iframe.style.width = "322px";
    iframe.style.zIndex = "2999999999";
    iframe.style.backgroundColor = "aliceblue";
    iframe.style.transition = "transform .6s";
    iframe.style.borderLeft = "1px solid #EBECEE";
    iframe.style.borderTop = "1px solid #EBECEE";
    iframe.style.borderRight = "none";
    iframe.style.borderRadius = "5px 0px 0px 5px";
}

function addCssClassToDoc(className, cssProperties) {
    var style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = '.' + className + ' { ' + cssProperties + ' }';
    document.getElementsByTagName('head')[0].appendChild(style);


}

function hideSidebar() {
    var iframe = document.getElementById("rxSidebarFrame");
    iframe.className = dissapearClass;

    document.documentElement.className = document.documentElement.className.replace(htmlShrinkClass, "");
}

function showSidebar() {

    var iframe = document.getElementById("rxSidebarFrame");
    if (iframe) {
        iframe.className = ''; // remove translateX;
        document.documentElement.className += " " + htmlShrinkClass;
    }
    onScrollExtensionArea();
}

function expandSidebarToFullWidth() {
    var iframe = document.getElementById("rxSidebarFrame");
    setFrameStyle(iframe);
    iframe.style.width = "100%";
}

function shrinkSidebarToRegularWidth() {
    var iframe = document.getElementById("rxSidebarFrame");
    setFrameStyle(iframe);
    iframe.style.width = "322px";
}

function onScrollExtensionArea() {
    document.getElementById("rxSidebarFrame").addEventListener("mouseenter", function() {
        document.getElementsByTagName("html")[0].style.overflowY = "hidden";
    });

    document.getElementById("rxSidebarFrame").addEventListener("mouseout", function() {
        document.getElementsByTagName("html")[0].style.overflowY = "auto";
    });
}