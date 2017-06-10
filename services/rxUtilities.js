// Redkix utillities service.
'use strict';

angular.module('redKixServices').service('$rxUtilities', ['$log', '$sce', '$filter', '$cookies', '$rxConfig',
    function($log, $sce, $filter, $cookies, rxConfig) {

        var self = this,
            rxConsts = rxConfig.consts;

        this.getRxCookie = function() {
            return $cookies.getObject(rxConsts.RX_COOKIE.NAME);
        };

        this.setRxCookie = function(cookieValue) {
            var expireDate = new Date();
            expireDate.setDate(expireDate.getDate() + rxConsts.RX_COOKIE.DAYS_OF_LIFE);

            // TODO: Add encryption - https://github.com/mpetersen/aes-example
            $cookies.putObject(rxConsts.RX_COOKIE.NAME, cookieValue, {
                expires: expireDate
            });
        };

        this.removeRxCookie = function() {
            $cookies.remove(rxConsts.RX_COOKIE.NAME);
        };

        this.generateGUID = function() {
            $log.debug('guid function called');

            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }

            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
                s4() + '-' + s4() + s4() + s4();
        };

        this.removeEscapeChars = function(text) {
            return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        };

        this.removeLineBreaks = function(text) {
            return text.replace(/(\r\n|\n|\r)/gm, "");
        };

        this.stripHTML = function(html) {
            var tmp = document.createElement("DIV");
            tmp.innerHTML = html;
            return tmp.textContent || tmp.innerText || "";
        };

        this.arrayUnique = function(array) {
            var a = array.concat();

            for (var i = 0; i < a.length; ++i) {
                for (var j = i + 1; j < a.length; ++j) {
                    // Added uid checking for modeled objects
                    if (a[i] && a[j] && a[i].$key && a[j].$key && a[i].$key === a[j].$key || a[i] === a[j]) {
                        a.splice(j--, 1);
                    }
                }
            }

            return a;
        };

        this.objectToArray = function(obj) {
            var arr = [];

            for (var p in obj) {
                if (obj.hasOwnProperty(p)) {
                    arr.push(obj[p]);
                }
            }

            return arr;
        };

        this.arrayEquals = function(arr, otherArr) {
            // if the other array is a falsy value, return
            if (!otherArr)
                return false;

            // compare lengths - can save a lot of time 
            if (arr.length != otherArr.length)
                return false;

            for (var i = 0, l = arr.length; i < l; i++) {
                // Check if we have nested otherArrs
                if (arr[i] instanceof Array && otherArr[i] instanceof Array) {
                    // recurse into the nested otherArrs
                    if (!arr[i].equals(otherArr[i]))
                        return false;
                } else if (arr[i].uid && otherArr[i].uid && arr[i].uid != otherArr[i].uid) {
                    // Warning - two different object instances will never be equal: {x:20} != {x:20}
                    return false;
                }
            }
            return true;
        };

        this.isEmptyObject = function(obj) {
            return Object.keys(obj).length === 0
        };

        this.isObjectNullOrEmpty = function(obj) {
            if (!obj || typeof(obj) !== "object") {
                return true;
            }

            return Object.keys(obj).length === 0;
        };

        this.isArrayNullOrEmpty = function(arr) {
            return !arr || arr && arr.length === 0
        };

        this.removeIntersectionByKey = function(sourceArray, removeArray, byKey) {
            byKey = byKey || 'uid';

            if (!sourceArray) {
                return [];
            }

            if (!removeArray) {
                removeArray = [];
            }

            sourceArray = Array.isArray(sourceArray) ? sourceArray : [sourceArray];
            removeArray = Array.isArray(removeArray) ? removeArray : [removeArray];

            var _sourceArray = _.filter(sourceArray, function(sourceItem) {
                return _.indexOf(_.intersection(_.pluck(sourceArray, byKey), _.pluck(removeArray, byKey)), sourceItem[byKey]) === -1
            })
            return _sourceArray;
        };

        this.removeNonNullIntersectionByKey = function(sourceArray, removeArray, byKey) {
            byKey = byKey || 'uid';

            sourceArray = Array.isArray(sourceArray) ? sourceArray : [sourceArray];
            removeArray = Array.isArray(removeArray) ? removeArray : [removeArray];

            var _sourceArray = _.filter(sourceArray, function(sourceItem) {
                if (sourceItem[byKey] === null) {
                    return true;
                }

                return _.indexOf(_.intersection(_.pluck(sourceArray, byKey), _.pluck(removeArray, byKey)), sourceItem[byKey]) === -1
            })
            return _sourceArray;
        };

        this.haveDifferentLinks = function(item, otherItem) {
            return item.children !== otherItem.children || item.parents !== otherItem.parents;
        };

        this.validateEmail = function(email) {
            var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
            return re.test(email);
        };

        String.prototype.capitalizeFirstLetter = function() {
            return this.charAt(0).toUpperCase() + this.slice(1);
        }

        String.prototype.titleCase = function() {
            return this.replace(/\w\S*/g, function(txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            });
        }

        this.getFileSizeText = function(total) {
            return this.getFileSizeTextForUpload(total, total);
        }

        this.getFileSizeTextForUpload = function(uploaded, total) {
            if (total == 0) {
                return '0 bytes';
            } else if (total < 1000000) {
                if (total < 1000) {
                    if (uploaded < total) {
                        return getSizeTextInBytes(uploaded) + '/' + getSizeTextInBytes(total);
                    } else {
                        return getSizeTextInBytes(total);
                    }
                } else if (uploaded < total) {
                    return getSizeTextInKb(uploaded) + '/' + getSizeTextInKb(total);
                } else {
                    return getSizeTextInKb(total);
                }
            } else {
                if (uploaded < total) {
                    return getSizeTextInMb(uploaded) + '/' + getSizeTextInMb(total);
                } else {
                    return getSizeTextInMb(total);
                }
            }
        }


        this.getAvatarInitials = function(displayName, mailBoxAddress) {
            if (displayName || mailBoxAddress) {
                var v = [];

                if (displayName) {
                    var initials = displayName.toLowerCase().split(' ', 2);
                } else {
                    var initials = [mailBoxAddress.toLowerCase()];
                }

                v[0] = initials[0].slice(0, 1);

                if (initials.length > 1) {
                    v[1] = initials[1].slice(0, 1);
                } else {
                    v[1] = '';
                }

                return (v[0] + v[1]).toUpperCase();
            }

            return null;
        }

        this.getAvatarColor = function(avatarInitialsString) {
            var colors = ['#FAC87E', '#E9939B', '#96C8E7', '#A18CD5', '#8CCBD5', '#D5B38C', '#85878A', '#C0E17D', '#7D9AAB', '#8CD595']

            if (!avatarInitialsString) {
                return null;
            }

            return colors[getAvatarColorIndex(avatarInitialsString, colors.length)];
        }

        this.getAvatarDarkColor = function(avatarInitialsString) {
            var colors = ['#B8863E', '#C8636C', '#6B9FBF', '#6A52A5', '#438893', '#85694A', '#545961', '#8AAA4A', '#52788F', '#5DA866']

            if (!avatarInitialsString) {
                return null;
            }

            return colors[getAvatarColorIndex(avatarInitialsString, colors.length)];

        }

        this.downloadLink = function(strPath) {
            var varExt = strPath.split('.');

            if (varExt[varExt.length - 1] == "txt") {
                window.open(strPath);
            } else {
                var iframe;
                iframe = document.getElementById("hiddenDownloader");

                if (iframe == null) {
                    iframe = document.createElement('iframe');
                    iframe.id = "hiddenDownloader";
                    iframe.style.visibility = 'hidden';
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);
                }

                iframe.src = strPath;
            }
            return false;
        }

        this.isMacOS = function() {
            return /Mac OS X/.test(window.navigator.userAgent);
        };

        function getAvatarColorIndex(avatarInitialsString, colorLength) {
            var avatarInitials = avatarInitialsString.toLowerCase().split(''),
                bin;
            if (avatarInitials.length < 2) {
                avatarInitials.push('');
            }

            if (avatarInitials[1] !== '') {
                bin = avatarInitials[0].charCodeAt(0) + (avatarInitials[0].charCodeAt(0) - 65) * 25 + avatarInitials[1].charCodeAt(0) - 39;
            } else {
                bin = avatarInitials[0].charCodeAt(0);
            }

            return (bin - 65) % colorLength;
        }

        function getSizeTextInBytes(size) {
            return (size != undefined) ? size.toString() + 'bytes' : '';
        }

        function getSizeTextInKb(size) {
            return Math.floor(size / 1000).toString() + 'KB';
        }

        function getSizeTextInMb(size) {
            var decimalDigit = Math.floor(size / 100000 % 10).toString();
            return Math.floor(size / 1000000).toString() + '.' + decimalDigit + 'MB';
        }

        this.removeTitleTagFromHtml = function(text) {
            return text.replace(/(<head(.|[\r\n])*?)(<title(.|[\r\n])*?<\/title>)((.|[\r\n])*?<\/head>)/ig, '$1$5');
        };

        this.prepareMsg = function(body) {
            return $sce.trustAsHtml(body);
        };

        this.getDomain = function(userEmail) {
            var domain = userEmail.split('@')[1].split('.')[0];
            return domain;
        };

        this.setTitle = function(activeUser, folder) {
            var user = '';
            var folderTitle = '';
            var title = '';

            if (activeUser.getMailBoxAddress) {
                user = activeUser.getMailBoxAddress();
            }

            if (folder && angular.isNumber(folder.unreadCount)) {
                folderTitle = getFolderTitleString() + getFolderUnreadString();
            }

            title = folderTitle.length ? folderTitle + ' - ' : folderTitle;
            title += user;

            document.title = title;

            function getFolderTitleString() {
                var label = folder.label || '';

                if (folder.contact) {
                    label = folder.contact.getDisplayName();
                }

                return label;
            }

            function getFolderUnreadString() {
                return angular.isNumber(folder.unreadCount) && folder.unreadCount > 0 ? (' (' + self.perpareUnreadPresentation(folder.unreadCount) + ')') : '';
            }
        };

        this.perpareUnreadPresentation = function(unreadCount) {
            return unreadCount <= 99 ? unreadCount : "99+";
        };

        this.reduceAlreadyFetchedParents = function(parents, unfetchedParents, byKey) {
            // If parents already exist, we can filter out the unfetched parents from the existing ones
            if (!this.isArrayNullOrEmpty(parents) && !this.isArrayNullOrEmpty(unfetchedParents)) {
                // When the parents are conversations, the only thing that they don't have in common is their folderUID, that's why we use it to find duplications
                unfetchedParents = this.removeIntersectionByKey(unfetchedParents, parents, byKey);
            }

            return unfetchedParents;
        };

        this.getExtensionFromMimeType = function(mimeType) {
            return mimeTypeToExt[mimeType] && mimeTypeToExt[mimeType].length ? '.' + mimeTypeToExt[mimeType][0] : '';
        }
    }
]);