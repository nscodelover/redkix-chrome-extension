/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 *                          RedKix Custom Sanitizer                        *
 *   - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -   *
 *   This is an angular sanitizer factory to allow looser rules that fit   *
 *   better for email html and css rules. no javascript is allowed.        *
 *   HTML:                                                                 *
 *   http://www.logicalthings.com/2011/01/html-email-coding-like-its-1999/ *
 *   CSS:                                                                  *
 *   https://www.campaignmonitor.com/css/                                  *
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

angular.module('redKixServices').service('rxEmailSanitizer', ['$$sanitizeUri', function($$sanitizeUri) {
    var self = this;

    var svgEnabled = true;

    // Regular Expressions for parsing tags and attributes
    var SURROGATE_PAIR_REGEXP = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g,
        // Match everything outside of normal chars and " (quote character)
        NON_ALPHANUMERIC_REGEXP = /([^\#-~ |!])/g;

    /* * * * * * * * * * * *
     *   ALLOWED ELEMENTS  *
     * * * * * * * * * * * */

    // Safe Void Elements : http://dev.w3.org/html5/spec/Overview.html#void-elements
    var voidElements = toMap("area,br,col,hr,img,wbr");

    // Elements that optionally close : http://dev.w3.org/html5/spec/Overview.html#optional-tags
    var optionalEndTagBlockElements = toMap("colgroup,dd,dt,li,p,tbody,td,tfoot,th,thead,tr"),
        optionalEndTagInlineElements = toMap("rp,rt"),
        optionalEndTagElements = angular.extend({},
            optionalEndTagInlineElements,
            optionalEndTagBlockElements);

    // Safe Block Elements(always close)
    var blockElements = angular.extend({}, optionalEndTagBlockElements, toMap("address,article," +
        "aside,blockquote,caption,center,del,dir,div,dl,figure,figcaption,footer,h1,h2,h3,h4,h5," +
        "h6,header,hgroup,hr,ins,map,menu,nav,ol,pre,section,table,ul"));

    // Inline Elements - HTML5
    var inlineElements = angular.extend({}, optionalEndTagInlineElements, toMap("a,abbr,acronym,b," +
        "bdi,bdo,big,br,cite,code,del,dfn,em,font,i,img,ins,kbd,label,map,mark,q,ruby,rp,rt,s," +
        "samp,small,span,strike,strong,sub,sup,time,tt,u,var"));

    // SVG Elements : https://wiki.whatwg.org/wiki/Sanitization_rules#svg_Elements
    // Note: the elements animate,animateColor,animateMotion,animateTransform,set are intentionally omitted.
    // (They can potentially allow for arbitrary javascript to be executed).
    var svgElements = toMap("circle,defs,desc,ellipse,font-face,font-face-name,font-face-src,g,glyph," +
        "hkern,image,linearGradient,line,marker,metadata,missing-glyph,mpath,path,polygon,polyline," +
        "radialGradient,rect,stop,svg,switch,text,title,tspan");

    var validElements = angular.extend({},
        voidElements,
        blockElements,
        inlineElements,
        optionalEndTagElements);


    /* * * * * * * * * * * *
     *   BLOCKED ELEMENTS  *
     * * * * * * * * * * * */

    // Blocked Elements (will be stripped)
    var blockedElements = toMap("script,style");


    /* * * * * * * * * * * * *
     *   ALLOWED ATTRIBUTES  *
     * * * * * * * * * * * * */

    //Attributes that have href and hence need to be sanitized
    var uriAttrs = toMap("background,cite,href,longdesc,src,usemap,xlink:href");

    var htmlAttrs = toMap('abbr,align,alt,axis,bgcolor,border,cellpadding,cellspacing,class,clear,' +
        'color,cols,colspan,compact,coords,dir,face,headers,height,hreflang,hspace,' +
        'ismap,lang,language,nohref,nowrap,rel,rev,rows,rowspan,rules,' +
        'scope,scrolling,shape,size,span,start,summary,tabindex,target,title,type,' +
        'valign,value,vspace,width');

    // SVG attributes : https://wiki.whatwg.org/wiki/Sanitization_rules#svg_Attributes
    // (without "id" and "name" attributes)
    var svgAttrs = toMap('accent-height,accumulate,additive,alphabetic,arabic-form,ascent,' +
        'baseProfile,bbox,begin,by,calcMode,cap-height,class,color,color-rendering,content,' +
        'cx,cy,d,dx,dy,descent,display,dur,end,fill,fill-rule,font-family,font-size,font-stretch,' +
        'font-style,font-variant,font-weight,from,fx,fy,g1,g2,glyph-name,gradientUnits,hanging,' +
        'height,horiz-adv-x,horiz-origin-x,ideographic,k,keyPoints,keySplines,keyTimes,lang,' +
        'marker-end,marker-mid,marker-start,markerHeight,markerUnits,markerWidth,mathematical,' +
        'max,min,offset,opacity,orient,origin,overline-position,overline-thickness,panose-1,' +
        'path,pathLength,points,preserveAspectRatio,r,refX,refY,repeatCount,repeatDur,' +
        'requiredExtensions,requiredFeatures,restart,rotate,rx,ry,slope,stemh,stemv,stop-color,' +
        'stop-opacity,strikethrough-position,strikethrough-thickness,stroke,stroke-dasharray,' +
        'stroke-dashoffset,stroke-linecap,stroke-linejoin,stroke-miterlimit,stroke-opacity,' +
        'stroke-width,systemLanguage,target,text-anchor,to,transform,type,u1,u2,underline-position,' +
        'underline-thickness,unicode,unicode-range,units-per-em,values,version,viewBox,visibility,' +
        'width,widths,x,x-height,x1,x2,xlink:actuate,xlink:arcrole,xlink:role,xlink:show,xlink:title,' +
        'xlink:type,xml:base,xml:lang,xml:space,xmlns,xmlns:xlink,y,y1,y2,zoomAndPan', true /* lowercaseKeys */ );

    var validAttrs = angular.extend({},
        uriAttrs,
        svgAttrs,
        htmlAttrs);


    self.validElements = validElements;

    self.sanitize = function(html) {
        var buf = [];
        htmlParser(html, htmlSanitizeWriter(buf, function(uri, isImage) {
            return !/^unsafe:/.test($$sanitizeUri(uri, isImage));
        }));
        return buf.join('');
    };

    self.removeAddedBrTags = function(html) {
        if (angular.isString(html)) {
            html = html.replace(/&#10;/g, '\n');
        }
        return html;
    }

    self.enableSvg = function(enableSvg) {
        if (angular.isDefined(enableSvg)) {
            svgEnabled = enableSvg;
            return this;
        } else {
            return svgEnabled;
        }
    };

    self.addValidElements = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var customValidElements = toMap(str, lowercaseKeys);
            validElements = angular.extend(validElements, customValidElements);
        }
    };

    self.addValidAttrs = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var customValidAttrs = toMap(str, lowercaseKeys);
            validAttrs = angular.extend(validAttrs, customValidAttrs);
        }
    };

    self.addBlockedElements = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var customBlockedElements = toMap(str, lowercaseKeys);
            blockedElements = angular.extend(blockedElements, customBlockedElements);
        }
    };

    self.addUriAttrs = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var customUriAttrs = toMap(str, lowercaseKeys);
            uriAttrs = angular.extend(uriAttrs, customUriAttrs);
        }
    };

    self.removeValidElements = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var validElementsToRemove = angular.isString(str) ? toMap(str, lowercaseKeys) : str;
            for (var key in validElementsToRemove) {
                delete validElements[key]
            }
        }
    };

    self.removeValidAttrs = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var validAttrsToRemove = toMap(str, lowercaseKeys);
            for (var key in validAttrsToRemove) {
                delete validAttrs[key]
            }
        }
    };

    self.removeBlockedElements = function(str, lowercaseKeys) {
        if (angular.isDefined(str)) {
            var BlockedElementsToRemove = toMap(str, lowercaseKeys);
            for (var key in BlockedElementsToRemove) {
                delete blockedElements[key]
            }
        }
    };

    function sanitizeText(chars) {
        var buf = [];
        var writer = htmlSanitizeWriter(buf, angular.noop);
        writer.chars(chars);
        return buf.join('');
    }

    function toMap(str, lowercaseKeys) {
        var obj = {},
            items = str.split(','),
            i;
        for (i = 0; i < items.length; i++) {
            obj[lowercaseKeys ? angular.lowercase(items[i]) : items[i]] = true;
        }
        return obj;
    }

    var inertBodyElement;
    (function(window) {
        var doc;
        if (window.document && window.document.implementation) {
            doc = window.document.implementation.createHTMLDocument("inert");
        } else {
            throw Error('noinert', "Can't create an inert html document");
        }
        var docElement = doc.documentElement || doc.getDocumentElement();
        var bodyElements = docElement.getElementsByTagName('body');

        // usually there should be only one body element in the document, but IE doesn't have any, so we need to create one
        if (bodyElements.length === 1) {
            inertBodyElement = bodyElements[0];
        } else {
            var html = doc.createElement('html');
            inertBodyElement = doc.createElement('body');
            html.appendChild(inertBodyElement);
            doc.appendChild(html);
        }
    })(window);

    /**
     * @example
     * htmlParser(htmlString, {
     *     start: function(tag, attrs) {},
     *     end: function(tag) {},
     *     chars: function(text) {},
     *     comment: function(text) {}
     * });
     *
     * @param {string} html string
     * @param {object} handler
     */
    function htmlParser(html, handler) {
        if (html === null || html === undefined) {
            html = '';
        } else if (typeof html !== 'string') {
            html = '' + html;
        }
        inertBodyElement.innerHTML = html;

        //mXSS protection
        var mXSSAttempts = 5;
        do {
            if (mXSSAttempts === 0) {
                throw Error("Failed to sanitize html because the input is unstable");
            }
            mXSSAttempts--;

            // strip custom-namespaced attributes on IE<=11
            if (document.documentMode <= 11) {
                stripCustomNsAttrs(inertBodyElement);
            }
            html = inertBodyElement.innerHTML; //trigger mXSS
            inertBodyElement.innerHTML = html;
        } while (html !== inertBodyElement.innerHTML);

        var node = inertBodyElement.firstChild;
        while (node) {
            switch (node.nodeType) {
                case 1: // ELEMENT_NODE
                    handler.start(node.nodeName.toLowerCase(), attrToMap(node.attributes));
                    break;
                case 3: // TEXT NODE
                    handler.chars(node.textContent);
                    break;
            }

            var nextNode;
            if (!(nextNode = node.firstChild)) {
                if (node.nodeType == 1) {
                    handler.end(node.nodeName.toLowerCase());
                }
                nextNode = node.nextSibling;
                if (!nextNode) {
                    while (nextNode == null) {
                        node = node.parentNode;
                        if (node === inertBodyElement) break;
                        nextNode = node.nextSibling;
                        if (node.nodeType == 1) {
                            handler.end(node.nodeName.toLowerCase());
                        }
                    }
                }
            }
            node = nextNode;
        }

        while (node = inertBodyElement.firstChild) {
            inertBodyElement.removeChild(node);
        }
    }

    function attrToMap(attrs) {
        var map = {};
        for (var i = 0, ii = attrs.length; i < ii; i++) {
            var attr = attrs[i];
            map[attr.name] = attr.value;
        }
        return map;
    }


    /**
     * Escapes all potentially dangerous characters, so that the
     * resulting string can be safely inserted into attribute or
     * element text.
     * @param value
     * @returns {string} escaped text
     */
    function encodeEntities(value) {
        return value.
        replace(/&/g, '&amp;').
        replace(SURROGATE_PAIR_REGEXP, function(value) {
            var hi = value.charCodeAt(0);
            var low = value.charCodeAt(1);
            return '&#' + (((hi - 0xD800) * 0x400) + (low - 0xDC00) + 0x10000) + ';';
        }).
        replace(NON_ALPHANUMERIC_REGEXP, function(value) {
            // Allow hebrew characters for now. NOTE: might be a security breach.
            var alef = 1488;
            var taf = 1514;
            if (value.charCodeAt(0) >= alef && value.charCodeAt(0) <= taf) {
                return value;
            }

            return '&#' + value.charCodeAt(0) + ';';
        }).
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
    }

    /**
     * create an HTML/XML writer which writes to buffer
     * @param {Array} buf use buf.join('') to get out sanitized html string
     * @returns {object} in the form of {
     *     start: function(tag, attrs) {},
     *     end: function(tag) {},
     *     chars: function(text) {},
     *     comment: function(text) {}
     * }
     */
    function htmlSanitizeWriter(buf, uriValidator) {
        svgEnabled
            ? validElements = angular.extend(validElements, svgElements) : self.removeValidElements(svgElements);
        var ignoreCurrentElement = false;
        var out = angular.bind(buf, buf.push);
        return {
            start: function(tag, attrs) {
                tag = angular.lowercase(tag);
                if (!ignoreCurrentElement && blockedElements[tag]) {
                    ignoreCurrentElement = tag;
                }
                if (!ignoreCurrentElement && validElements[tag] === true) {
                    out('<');
                    out(tag);
                    angular.forEach(attrs, function(value, key) {
                        var lkey = angular.lowercase(key);
                        var isImage = (tag === 'img' && lkey === 'src') || (lkey === 'background');
                        if (validAttrs[lkey] === true &&
                            (uriAttrs[lkey] !== true || uriValidator(value, isImage))) {
                            out(' ');
                            out(key);
                            out('="');
                            out(encodeEntities(value));
                            out('"');
                        }
                    });
                    out('>');
                }
            },
            end: function(tag) {
                tag = angular.lowercase(tag);
                if (!ignoreCurrentElement && validElements[tag] === true && voidElements[tag] !== true) {
                    out('</');
                    out(tag);
                    out('>');
                }
                if (tag == ignoreCurrentElement) {
                    ignoreCurrentElement = false;
                }
            },
            chars: function(chars) {
                if (!ignoreCurrentElement) {
                    out(encodeEntities(chars));
                }
            }
        };
    }


    /**
     * When IE9-11 comes across an unknown namespaced attribute e.g. 'xlink:foo' it adds 'xmlns:ns1' attribute to declare
     * ns1 namespace and prefixes the attribute with 'ns1' (e.g. 'ns1:xlink:foo'). This is undesirable since we don't want
     * to allow any of these custom attributes. This method strips them all.
     *
     * @param node Root element to process
     */
    function stripCustomNsAttrs(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            var attrs = node.attributes;
            for (var i = 0, l = attrs.length; i < l; i++) {
                var attrNode = attrs[i];
                var attrName = attrNode.name.toLowerCase();
                if (attrName === 'xmlns:ns1' || attrName.indexOf('ns1:') === 0) {
                    node.removeAttributeNode(attrNode);
                    i--;
                    l--;
                }
            }
        }

        var nextNode = node.firstChild;
        if (nextNode) {
            stripCustomNsAttrs(nextNode);
        }

        nextNode = node.nextSibling;
        if (nextNode) {
            stripCustomNsAttrs(nextNode);
        }
    }

}]);