var redKixModule = angular.module('redKix');
redKixModule.filter('cut', function() {
    return function(value, wordwise, max, tail) {
        if (!value) return '';

        max = parseInt(max, 10);
        if (!max) return value;
        if (value.length <= max) return value;

        value = value.substr(0, max);
        if (wordwise) {
            var lastspace = value.lastIndexOf(' ');
            if (lastspace != -1) {
                value = value.substr(0, lastspace);
            }
        }

        return value + (tail || ' …');
    };
});

// Filter for displaying a single contact name
redKixModule.filter('displayname', ['$redKixActiveUserService',
    function(ActiveUser) {
        return function(user, conversationUID) {
            if (!user) {
                return '';
            }

            if (user.length > 0) {
                console.assert(user.length === 1, "displayname filter was called with too many users (" + user.length + ")");
                user = user[0];
            }

            if (user.getCorrectTitle) {
                return user.getCorrectTitle(false, conversationUID);
            }
        }
    }
]);

redKixModule.filter('typingOnce', function() {
    return function(users) {
        var typingUsers = [];
        for (var user in users) {
            if (users[user].typing.length > 0)
                typingUsers.push(users[user].user)
        }
        return typingUsers;
    }
});

redKixModule.filter('removeEmptySections', function() {
    return function(sections) {
        if (sections && sections.filter) {
            return sections.filter(function(section) {
                return (section.items && section.items.length > 0);
            });
        } else return false;
    }
});

redKixModule.filter('takeAllParticipants', function() {
    return function(messages) {
        return _.uniq(_.pluck(messages, 'sender'));
    };
});

redKixModule.filter('isUserFolder', function() {
    return function(folders, isUserFolder) {
        return folders.filter(function(folder) {
            return (isUserFolder === (folder.type === "GENERAL"));
        });
    }
});

redKixModule.filter('isUnderUserFolders', function() {
    return function(folders, isUserFolder) {
        return folders.filter(function(folder) {
            return (isUserFolder === (['GENERAL','DELETED_ITEMS','JUNK_EMAIL','CHAT','STARRED','IMPORTANT'].indexOf(folder.type) > -1));
        });
    }
});

redKixModule.filter('isDummyFolder', function() {
    return function(folders) {
        return folders.filter(function(folder) {
            return folder.label;
        });
    };
});

redKixModule.filter('latestVersion', function() {
    return function(smartAttachments) {
        var latest = _.max(smartAttachments, function(smartAttachment) {
            return smartAttachment.versionNumber;
        });
        return [latest];
    };
});

redKixModule.filter('messageTime', function() {
    return function(time) {
        return moment(time).calendar(null, {
            sameDay: '[Today at] h:mm A',
            lastDay: '[Yesterday at] h:mm A',
            lastWeek: '[Last] dddd [at] h:mm A',
            sameElse: 'MMM Do [at] h:mm A'
        });
    };
});

// Filtering distinct data using specific field (Currently for group messages filtering purposes, where we filter by internetMessageId and preferring the UNREAD message one)
redKixModule.filter('unique', ['$rxUtilities', function(rxUtilities) {
    return function(items, filterOn) {

        if (filterOn === false) {
            return items;
        }

        if ((filterOn || angular.isUndefined(filterOn)) && angular.isArray(items)) {
            var hashCheck = {},
                mappedObjectsByFilter = {};

            var extractValueToCompare = function(item) {
                if (angular.isObject(item) && angular.isString(filterOn)) {
                    return item[filterOn];
                } else {
                    return item;
                }
            };

            angular.forEach(items, function(item) {
                if (!mappedObjectsByFilter[extractValueToCompare(item)] || (mappedObjectsByFilter[extractValueToCompare(item)].hasOwnProperty('isRead') && mappedObjectsByFilter[extractValueToCompare(item)].isRead === true)) {
                    mappedObjectsByFilter[extractValueToCompare(item)] = item;
                }
            });

            items = rxUtilities.objectToArray(mappedObjectsByFilter);
        }

        return items;
    };
}]);

redKixModule.filter('rxContactSearch', function() {
    return function(items, query, conversationUID) {
        query = query.toLowerCase();
        var rules = [
            // if display name starts with the query accept the contact
            function(item) {
                var itemDisplayName = item.getDisplayName(conversationUID);
                return itemDisplayName && queryDisplayName(itemDisplayName, query);
            },
            // if the mail box address starts with query accept it
            function(item) {
                return item.mailBoxAddress && item.mailBoxAddress.toLowerCase().startsWith(query);
            },
            // if the first name starts with query accept it
            function(item) {
                return item.firstName && item.firstName.toLowerCase().startsWith(query);
            },
            // if the last name starts with query accept it
            function(item) {
                return item.lastName && item.lastName.toLowerCase().startsWith(query);
            },
            // if the full name (first name last name or the opposite) starts with query accept it
            function(item) {
                if (item.firstName && item.lastName) {
                    return (item.firstName + " " + item.lastName).toLowerCase().startsWith(query) || (item.lastName + " " + item.firstName).toLowerCase().startsWith(query);
                }
                return false;
            }
        ];

        function queryDisplayName(itemDisplayName, query) {
            var itemDisplayNameArray = itemDisplayName.toLowerCase().split(' ');

            return itemDisplayName && itemDisplayNameArray.map(function(namePart) {
                return namePart.startsWith(query);
            }).some(function(namePartStartWith) {
                return namePartStartWith === true;
            });
        }

        // go through each predicate, if any are true, accept it
        return items.filter(function(item) {
            for (var i = 0; i < rules.length; i++) {
                if (rules[i](item)) return true;
            };
            return false;
        });
    }
});

redKixModule.filter('rootFolders', function() {
    return function(folders) {
        return folders ? folders.filter(function(folder) {
            return folder.isSubFolder !== undefined && !folder.isSubFolder;
        }) : [];
    }
});

redKixModule.filter('subFolders', function() {
    return function(folders) {
        return folders ? folders.filter(function(folder) {
            return folder.isSubFolder;
        }) : [];
    }
});

redKixModule.filter('attAttachments', function() {
    return function(attachments) {
        return attachments ? attachments.filter(function(file) {
            return file.$AttBind;
        }) : [];
    }
});

redKixModule.filter('removeChat', function() {
    return function(subject) {
        return subject.replace(/ Chat$/, '');
    }
});
