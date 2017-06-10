// RedKix data models
'use strict';


angular.module('redKixServices').factory('$rxModelService', ['$log', '$rxRepoService', '$http', '$filter', '$redKixActiveUserService', '$rxApiURLs', '$timeout', '$rxDataApi', '$rxEv', '$rxConfig', '$rxUtilities', 'rxEmailSanitizer', '$q',
    function($log, repoService, $http, $filter, ActiveUser, ApiURLs, $timeout, DataApiService, EmitterService, rxConfig, rxUtilities, rxEmailSanitizer, $q) {
        var CTRL_NAME = '$rxModelService',
            rxConsts = rxConfig.consts,
            repos = null;

        function converterFunctionsIterator(json) {
            var convertedProperties = {};
            var temp;
            for (var field in json) {
                if (converterFunctions[field]) {
                    temp = converterFunctions[field](json[field]);
                    convertedProperties[temp.fieldName] = temp.convertedValue;
                };
            }
            angular.extend(json, convertedProperties);
        }

        var converterFunctions = {
            participantsActivity: function(value) {
                value.forEach(function(v) {
                    v.lastActivityDate = v.lastActivityDate ? normalClientDate(v.lastActivityDate) : null;
                });

                return value;
            },
            lastActivityDate: function(value) {
                return {
                    fieldName: 'lastActivityDate',
                    convertedValue: normalClientDate(value)
                }
            },
            lastSeen: function(value) {
                return {
                    fieldName: 'lastSeen',
                    convertedValue: normalClientDate(value)
                }
            },
            creationDate: function(value) {
                return {
                    fieldName: 'creationDate',
                    convertedValue: normalClientDate(value)
                }
            },
            sentDate: function(value) {
                return {
                    fieldName: 'sentDate',
                    convertedValue: normalClientDate(value)
                }
            },
            receivedDate: function(value) {
                return {
                    fieldName: 'receivedDate',
                    convertedValue: normalClientDate(value)
                }
            },
            title: function(value) {
                return {
                    fieldName: 'label',
                    convertedValue: value
                }
            },
            unreadMessagesCount: function(value) {
                return {
                    fieldName: 'unreadCount',
                    convertedValue: value
                }
            },
            totalMessagesCount: function(value) {
                return {
                    fieldName: 'totalCount',
                    convertedValue: value
                }
            },
            quotationBubbles: function(value) {
                var bubbles = [];
                value.forEach(function(bubble) {
                    bubbles.push({
                        sender: valueOrNull(bubble.sender),
                        bodyHTML: valueOrNull(bubble.bodyHTML),
                        receivedDate: normalClientDate(valueOrNull(bubble.date)),
                        index: bubbles.length,
                        displayName: bubble.displayName
                    });
                });
                return {
                    fieldName: 'quotationBubbles',
                    convertedValue: bubbles
                };
            }
        };

        function normalClientDate(value) {
            return valueOrNull(moment(value).format(), moment().format());
        }


        //    %  example of use:   %
        // <<SERVER SUPPLIED FIELD NAME>>: function(value) {
        //     return {
        //         fieldName: '<<CLIENT MODEL FIELD NAME>>',
        //         convertedValue: <<CONVERTED VALUE CODE USING "value">>
        //     };
        // }

        function getRepos() {
            if (repos) {
                return repos;
            }

            return {
                contacts: repoService.get('contacts'),
                mailBoxFolders: repoService.get('mailBoxFolders'),
                contactDisplayNames: repoService.get('contactDisplayNames'),
                contactFolders: repoService.get('contactFolders'),
                conversations: repoService.get('conversations'),
                threads: repoService.get('threads'),
                messages: repoService.get('messages'),
                files: repoService.get('files')
            };
        }

        function setRepos() {
            repos = repoService.getAllRepos();
        }

        // REPO OPTIONS STRUCTURE //
        // {
        //     skipEventEmitting: true || false,
        //     skipChildrenFetchingAfterLink: true || false
        // }
        // END OF REPO OPTIONS STRUCTURE //

        // Sets two way binding link between the children and parents 
        function link(children, parents, repoOptionz) {
            var repoOptions = repoOptionz || {};

            children = Array.isArray(children) ? children : [children];
            parents = Array.isArray(parents) ? parents : [parents];

            // Sets all parents for children
            children.forEach(function(child) {
                child.addParents.call(child, parents, repoOptions);
            });

            repoOptions = repoOptionz || {};

            // Sets all children for parents
            parents.forEach(function(parent) {
                // adds children and updates inner info (counters & text fields)
                parent.addChildren.call(parent, children, repoOptions);
            });
        }

        // Removes the two way binding link between the children and parents
        function unlink(children, parents, repoOptionz) {
            var repoOptions = repoOptionz || {};

            children = Array.isArray(children) ? children : [children];
            parents = Array.isArray(parents) ? parents : [parents];

            // Removes all parents from children
            children.forEach(function(child) {
                child.removeParents.call(child, parents, repoOptions);
            });

            repoOptions = repoOptionz || {};

            // Removes all children from parents
            parents.forEach(function(parent) {
                // removes children and updates inner info (counters & text fields)
                if (parent.removeChildren) {
                    parent.removeChildren.call(parent, children, repoOptions);
                }
            });
        }

        // TODO: Is there any reason to unlink binding one way only?
        // // Removes the two way binding link between the children and parents
        // function unlinkParents(children, parents, repoOptions) {
        //     // Removes all parents from children
        //     children.forEach(function(child) {
        //         child.removeParents.call(child, parents, repoOptions);
        //     });
        // }

        // // Removes the two way binding link between the children and parents
        // function unlinkChildren(children, parents, repoOptions) {
        //     // Removes all children from parents
        //     parents.forEach(function(parent) {
        //         // removes children and updates inner info (counters & text fields)
        //         parent.removeChildren.call(parent, children, repoOptions);
        //     });
        // }

        function unlinkAllParents(children, repoOptions) {
            children = Array.isArray(children) ? children : [children];

            children.forEach(function(child) {
                unlink(child, child.parents, repoOptions);
            });
        }

        function unlinkAllChildren(parents, repoOptions) {
            parents = Array.isArray(parents) ? parents : [parents];

            parents.forEach(function(parent) {
                unlink(parent.children, parent, repoOptions);
            });
        }

        function unlinkItemChildren(item, repoOptions) {
            var children = item.children;

            if (!children) {
                return;
            }

            unlink(children, item, repoOptions);

        }

        function unlinkItemParents(item, repoOptions) {
            var parents = item.parents;

            if (!parents) {
                return;
            }

            unlink(item, parents, repoOptions);
        }

        // Removes the two way binding link from the childrenOrParents
        function unlinkAll(childrenOrParents, repoOptionz) {
            var repoOptions = repoOptionz || {};

            repoOptions.moveAction = true;

            childrenOrParents = Array.isArray(childrenOrParents) ? childrenOrParents : [childrenOrParents];

            childrenOrParents.forEach(function(childOrParent) {
                // Unlink this object from it's children and parents
                unlinkItemParents(childOrParent, repoOptions);

                repoOptions.moveAction = true;
                unlinkItemChildren(childOrParent, repoOptions);

            });
        }

        // Replaces current parents with new ones
        function replaceParentLinks(children, newParents, repoOptionz) {
            var repoOptions = repoOptionz || {};

            repoOptions.moveAction = true;

            children = Array.isArray(children) ? children : [children];
            newParents = Array.isArray(newParents) ? newParents : [newParents];

            children.forEach(function(child) {
                //check which parents need to be unlinked;
                var specificParentsToRemove = rxUtilities.removeIntersectionByKey(child.parents, newParents);

                specificParentsToRemove.forEach(function(specificParentToRemove) {
                    //unlink specific parent
                    unlink(child, specificParentToRemove, repoOptions);
                });

                repoOptions = repoOptionz || {};
                repoOptions.moveAction = true;

                //check which parents need to be linked;
                var specificNewParents = rxUtilities.removeIntersectionByKey(newParents, child.parents);

                specificNewParents.forEach(function(specificNewParent) {
                    //link specific parent
                    link(child, specificNewParent, repoOptions);
                });
            });
        }

        // TODO: Change it when we get the new api of flattened objects (and then we will get only user uids in participants field,
        // and we get the list of contacts seperately).
        function parseRepoItems(itemz, repo, optionz) {
            var items = itemz,
                repoItems = [],
                options = optionz || {},
                newRepoItem;

            if (!items) {
                // If we wanted the first item only but there are actually no items, we return null instead
                return options.firstOnly ? null : repoItems;
            }

            var repoOptions = {
                skipEventEmitting: true
            };

            if (!Array.isArray(items)) {
                if (typeof(items) !== "object") {
                    items = {
                        uid: items
                    };
                }
                items = [items];
            }

            for (var i = 0; i < items.length; i++) {
                newRepoItem = repo.getItem(items[i]);
                newRepoItem = newRepoItem || repo.addItem.call(repo, items[i], repoOptions);

                repoItems.push(newRepoItem);
            }

            // At this point, there's no chance repoItems is empty
            return options.firstOnly ? repoItems[0] : repoItems;
        }

        function parseMeetingRequest(meetingRequest, contactsRepo) {
            if (meetingRequest) {
                meetingRequest.meetingStart = moment(meetingRequest.meetingStart);
                meetingRequest.meetingEnd = moment(meetingRequest.meetingEnd);
                meetingRequest.requiredAttendees = parseRepoItems(meetingRequest.requiredAttendees, contactsRepo);
                meetingRequest.meetingResponseType = meetingRequest.meetingResponseType ? meetingRequest.meetingResponseType.toLowerCase() : null;
            }

            return valueOrNull(meetingRequest);
        }

        function valueOrNull(value, nullValue) {
            return (value !== undefined) ? value : (nullValue !== undefined ? nullValue : null);
        }

        function valueOrFalse(value) {
            return valueOrNull(value, false);
        }

        function getSentItemsFolder() {
            var filterResults = getRepos().mailBoxFolders.getFilteredData({
                propertyFilters: {
                    type: rxConsts.FOLDER_TYPE.SENT_ITEMS
                }
            });

            return rxUtilities.isArrayNullOrEmpty(filterResults) ? null : filterResults[0];
        }

        function ContactDisplayName(json, apiOptions) {
            var self = this;

            self.uid = valueOrNull(json.uid);
            self.contact = parseRepoItems(self.uid, getRepos().contacts, {
                firstOnly: true
            });
            self.displayName = valueOrNull(json.displayName);
            self.conversationUID = valueOrNull(json.conversationUID);

            self.isPlaceholderObject = function() {
                return !self.conversationUID || !self.mailBoxAddress;
            };

            self.postAdditionCallback = function(repoOptions) {
                // A repo object should always be returned whether it's exist or created                
                if (self.contact) {
                    self.contact.addAssociatedDisplayName(self);
                }
            };
        }

        function Contact(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                contactType: 'contactType',
                displayName: 'displayName',
                alternateDisplayName: 'messageDisplayName',
                isRedkixUser: 'isRedkixUser',
                presenceStatus: 'presenceStatus',
                lastSeen: 'lastSeen'
            };*/
            self.uid = valueOrNull(json.uid) || valueOrNull(json.mailBoxAddress);

            converterFunctionsIterator(json);

            self.jsonDisplayName = valueOrNull(json.displayName);

            self.contactType = valueOrNull(json.contactType);
            self.mailBoxAddress = valueOrNull(self.uid);
            self.avatarURL = json.avatarURL || null;
            self.presenceStatus = rxConsts.SERVER_STRING_TO_CONTACT_PERSENCE_STATUS[json.presenceStatus];
            self.lastSeen = json.lastSeen || null;

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.contactType = self.contactType || rxConsts.CONTACT_TYPE.UNKNOWN;
            }

            // If we send an email to external address, we will model it using uid only becuase that's all we got
            // Then we'll come here and wont have isRedkixUser field, so we determine if it's a RedKix user using the contact type UNKNOWN
            // That's also what the server gives us for external addresses
            self.isRedkixUser = valueOrNull(json.isRedkixUser, self.contactType && self.contactType !== rxConsts.CONTACT_TYPE.UNKNOWN);

            self.isPlaceholderObject = function() {
                if (self.contactType === rxConsts.CONTACT_TYPE.GROUP) {
                    return !self.organizationUID;
                } else if (self.contactType === rxConsts.CONTACT_TYPE.PERSON) {
                    return (!self.firstName || !self.lastName);
                } else {
                    return true;
                }
            };

            self.getDisplayName = function(conversationUID) {
                var contactDisplayName;

                if (conversationUID) {
                    contactDisplayName = self.getContactDisplayNameByConversationUID(conversationUID);
                }

                return contactDisplayName ? contactDisplayName.displayName : (self.jsonDisplayName || null);
            };

            self.getCorrectTitle = function(preferFirstName, conversationUID) {
                var correctDisplayName = self.getDisplayName.call(self, conversationUID);

                if (self && self.firstName && preferFirstName) {
                    return self.firstName.titleCase();
                } else if (self && correctDisplayName) {
                    return correctDisplayName;
                } else if (self && self.mailBoxAddress) {
                    return self.mailBoxAddress;
                } else {
                    return '';
                }
            };

            self.setRelatedContactFolder = function(contactFolderUID) {
                if (contactFolderUID) {
                    var contactFolderRepoObject = parseRepoItems(contactFolderUID, getRepos().contactFolders, {
                        firstOnly: true
                    });

                    // A repo object should always be returned whether it's exist or created
                    if (contactFolderRepoObject) {
                        getRepos().contacts.updateItemFields.call(getRepos().contacts, self, {
                            relatedContactFolder: contactFolderRepoObject
                        });
                    }
                }
            };

            self.addAssociatedDisplayName = function(contactDisplayName) {
                if (contactDisplayName) {
                    self.contactDisplayNames = self.contactDisplayNames || {};

                    // If item doesnt exist, we add it to the array and we send the updated contact display names to the repo
                    if (!self.contactDisplayNames[contactDisplayName.conversationUID]) {
                        self.contactDisplayNames[contactDisplayName.conversationUID] = contactDisplayName;

                        getRepos().contacts.updateItemFields.call(getRepos().contacts, self, {
                            contactDisplayNames: self.contactDisplayNames
                        });
                    }
                }

            };

            self.setAvatarURL = function(avatarURL) {
                var self = this;

                //console.debug('setting image url', avatarURL);

                getRepos().contacts.updateItemFields.call(getRepos().contacts, self, {
                    avatarURL: avatarURL
                }, {
                    notifyServer: true
                });
            };

            self.getContactDisplayNameByConversationUID = function(conversationUID) {
                return self.contactDisplayNames ? self.contactDisplayNames[conversationUID] : null;
            };

            self.getGroupMembers = function() {
                var self = this,
                    members = [];

                console.assert(self.contactType === rxConsts.CONTACT_TYPE.GROUP, "Calling getGroupMembers on a non-group contact " + self.uid);

                if (self.contactType !== rxConsts.CONTACT_TYPE.GROUP) {
                    return [];
                }

                if (!rxUtilities.isArrayNullOrEmpty(self.children)) {
                    members = self.children.map(function(user) {
                        return user.uid;
                    });
                }

                return members;
            };

            if (self.contactType === rxConsts.CONTACT_TYPE.PERSON) {
                User.call(self, json, apiOptions);

            } else if (self.contactType === rxConsts.CONTACT_TYPE.GROUP) {
                Group.call(self, json, apiOptions);
            }
        };

        function User(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                firstName: 'firstName',
                lastName: 'lastName',
                avatarURL: 'avatarURL',
                lastActivityDate: 'lastActivityDate',
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.firstName = valueOrNull(json.firstName);
            self.lastName = valueOrNull(json.lastName);
            self.lastActivityDate = valueOrNull(json.lastActivityDate);

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
            }
        };

        function Group(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                groups: 'groups',
                isSecret: 'isSecret',
                members: 'members',
                bypassInbox: 'bypassInbox',
                organizationUID: 'organizationUID',
                avatarURL: 'avatarURL'
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.parents = parseRepoItems(json.groups, getRepos().contacts);
            self.isSecret = valueOrFalse(json.isSecret);
            self.children = parseRepoItems(json.members, getRepos().contacts);
            self.bypassInbox = valueOrNull(json.bypassInbox);
            self.organizationUID = valueOrNull(json.organizationUID);
            self.avatarURL = self.avatarURL || generateAvatarObject();

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.bypassInbox = valueOrFalse(json.bypassInbox);
                self.unreadCount = 0;
            }

            function generateAvatarObject() {
                var calculatedAvatar = 0,
                    property = self.getCorrectTitle();

                for (var i = 0; i < property.length; i++) {
                    calculatedAvatar += property.charCodeAt(i);
                }

                calculatedAvatar = calculatedAvatar % 10;

                // TODO: Dor fins a way to take it locally
                return 'http://staging.redkix.com/images/groupAvatars/groupPreviewIcon' + calculatedAvatar + '@101x101.png';
            }
        };

        function Folder(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                unreadMessagesCount: 'unreadCount',
                totalMessagesCount: 'totalCount',
                priority: 'priority',
                folderType: 'folderType'
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.uid = valueOrNull(json.uid);
            self.unreadCount = valueOrNull(json.unreadCount);
            self.totalCount = valueOrNull(json.totalCount);
            self.priority = valueOrNull(json.priority);
            self.type = valueOrNull(json.folderType, rxConsts.FOLDER_TYPE.UNKNOWN);
            // self.iconURL = valueOrNull(json.iconURL);
            self.parents = [];
            self.children = [];
            self.unfetchedParents = [];

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.unreadCount = self.unreadCount || 0;
                self.totalCount = self.totalCount || 0;
            }

            self.isPlaceholderObject = function() {
                var self = this;

                return !self.type || self.totalCount === null || self.priority === null;
            };

            self.getUnfetchedParents = function() {
                var self = this;

                return self.unfetchedParents || [];
            };

            self.setUnfetchedParents = function(unfetchedParents) {
                var self = this;

                self.unfetchedParents = unfetchedParents || self.unfetchedParents;
            };

            self.getUnfetchedParentUIDs = function() {
                var self = this;

                return _.pluck(self.unfetchedParents || [], 'uid');
            };

            self.getParentUIDs = function() {
                var self = this;

                return _.pluck(self.parents || [], 'uid');
            };

            self.emptyFolderAndDeleteConversations = function() {
                var self = this;

                var conversations = self.children;

                unlinkAll(self.children, {
                    skipChildrenFetchingAfterLink: true
                });

                repos.conversations.removeItems(conversations);
            }

            self.removeParents = function() {
                // nothing to do
            }

            self.isContactFolder = function() {
                var self = this;

                return self.type === rxConsts.FOLDER_TYPE.PERSON || self.type === rxConsts.FOLDER_TYPE.GROUP;
            };

            if (!self.type || [rxConsts.FOLDER_TYPE.PERSON, rxConsts.FOLDER_TYPE.GROUP, rxConsts.FOLDER_TYPE.UNKNOWN].indexOf(self.type) !== -1) {
                ContactFolder.call(self, json, apiOptions);
            } else {
                MailBoxFolder.call(self, json, apiOptions);
            }
        };

        function MailBoxFolder(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                parentFolderUID: 'parentFolderUID',
                title: 'label'
            };*/

            self.unfetchedParents = valueOrNull(json.parentFolderUID) ? [{
                uid: json.parentFolderUID,
                // We use general folderType so when we fetch parent folders they won't get transformed into a contactFolder but a mailBoxFolder (it's being determined by the folderType)
                folderType: rxConsts.FOLDER_TYPE.GENERAL
            }] : [];
            self.label = valueOrNull(json.label);
            self.isSubFolder = valueOrNull(json.parentFolderUID) ? true : null;

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.isSubFolder = valueOrNull(self.isSubFolder) ? true : false;
            }

            self.addParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('add parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents ? self.parents.slice(0) : [],
                    isSubFolder;

                repoOptions = repoOptions || {};
                // repoOptions.mergeDefaultFields = true;

                updatedParents = rxUtilities.arrayUnique(updatedParents.concat(parentObjects));

                // Just in case (yeah yeah I know it's an add function, but I guess I think about the future more than you do).
                isSubFolder = !rxUtilities.isArrayNullOrEmpty(updatedParents);

                getRepos().mailBoxFolders.updateItemFields.call(getRepos().mailBoxFolders, self, {
                    parents: updatedParents,
                    isSubFolder: isSubFolder
                }, repoOptions);
            };

            self.removeParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('remove parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents || [],
                    isSubFolder;

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;

                updatedParents = rxUtilities.removeIntersectionByKey(updatedParents, parentObjects);

                // If it has no parents, it's not a subfolder anymore
                isSubFolder = !rxUtilities.isArrayNullOrEmpty(updatedParents);

                if (repoOptions.skipRepoUpdate) {
                    self.parents = updatedParents;
                } else {
                    getRepos().mailBoxFolders.updateItemFields.call(getRepos().mailBoxFolders, self, {
                        parents: updatedParents,
                        isSubFolder: isSubFolder
                    }, repoOptions);
                }
            };

            self.addChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('add children has been called', self, childrenObjects, repoOptions);

                // If we add a child of type Conversation, we want to increment the total count of items inside the folder.
                var totalCount = valueOrNull(self.totalCount, 0),
                    updatedChildren = self.children ? self.children.slice(0) : [];

                repoOptions = repoOptions || {};
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.moveAction;
                // repoOptions.mergeDefaultFields = true;

                updatedChildren = rxUtilities.arrayUnique(updatedChildren.concat(childrenObjects));

                var onlyConversationChildren = updatedChildren.filter(function(child) {
                    return (child instanceof Conversation);
                });

                totalCount = onlyConversationChildren.length;

                if (repoOptions.skipRepoUpdate) {
                    self.children = updatedChildren;
                } else {
                    getRepos().mailBoxFolders.updateItemFields.call(getRepos().mailBoxFolders, self, {
                        children: updatedChildren,
                        totalCount: totalCount
                    }, repoOptions);
                }
            };

            self.removeChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('remove children has been called', self, childrenObjects, repoOptions);

                // If we add a child of type Conversation, we want to increment the total count of items inside the folder.
                var totalCount = valueOrNull(self.totalCount, 0),
                    updatedChildren = self.children || [];

                repoOptions = repoOptions || {};
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.moveAction;

                updatedChildren = rxUtilities.removeIntersectionByKey(updatedChildren, childrenObjects);

                var onlyConversationChildren = updatedChildren.filter(function(child) {
                    return (child instanceof Conversation);
                });

                totalCount = onlyConversationChildren.length;

                getRepos().mailBoxFolders.updateItemFields.call(getRepos().mailBoxFolders, self, {
                    children: updatedChildren,
                    totalCount: totalCount
                }, repoOptions);
            };

            self.setSeenState = function(seenState, silentAction) {
                var self = this;

                getRepos().mailBoxFolders.updateItemFields.call(getRepos().mailBoxFolders, self, {
                    unreadCount: self.unreadCount + (!seenState ? 1 : -1)
                });


                if (!silentAction) {
                    // If it's a subfolder need to update parents unread count as well                
                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, seenState);
                    });
                }
            };

            self.postAdditionCallback = function(repoOptions) {
                var self = this;

                //console.debug('post addition callback called', self, repoOptions);

                if (!self.isSubFolder) {
                    return;
                }

                // If parents already exist, we can filter out the unfetched parents from the existing ones
                self.unfetchedParents = rxUtilities.reduceAlreadyFetchedParents(self.parents, self.unfetchedParents, 'uid');

                if (rxUtilities.isArrayNullOrEmpty(self.unfetchedParents)) {
                    //console.debug('There are no parents to fetch although there should be, quiting post addition callback');
                    return;
                }

                var repos = getRepos(),
                    parentObjects = repos.mailBoxFolders.getItems(self.unfetchedParents);

                if (rxUtilities.isArrayNullOrEmpty(parentObjects)) {
                    parentObjects = repos.mailBoxFolders.addItems.call(repos.mailBoxFolders, self.unfetchedParents, {
                        skipChildrenFetchingAfterLink: true,
                        skipEventEmitting: true
                    });
                }

                // Now it's the time for some awesomeness - calling our magical function!
                //console.debug('found parent object, calling link', parentObjects);

                angular.bind(self, link, self, parentObjects, repoOptions)();

                self.unfetchedParents = [];

            };

            self.postChildrenUpdateCallback = function(repoOptions) {
                var self = this;

                //console.debug('post children update callback called', self, repoOptions);

                // //console.debug('post children update callback called', self);
                // fetchToChild();
            };
        }

        function ContactFolder(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                isPinned: 'isPinned',
                contact: 'contact'
                'unreadConversationsCount': 'unreadConversationsCount'
            };*/

            self.isPinned = valueOrNull(json.isPinned);
            self.unreadConversationsCount = valueOrNull(json.unreadConversationsCount);

            if (json.contact && !json.contact.hasOwnProperty('contactType')) {
                json.contact.contactType = self.type;
            }

            self.contact = parseRepoItems(json.contact, getRepos().contacts, {
                firstOnly: true
            });

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.isPinned = valueOrFalse(json.isPinned);
            }

            self.addChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('add children has been called', self, childrenObjects, repoOptions);

                // If we add a child of type Conversation, we want to increment the total count of items inside the folder.
                var totalCount = valueOrNull(self.totalCount, 0),
                    updatedChildren = self.children || [];

                repoOptions = repoOptions || {};
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.moveAction;
                // repoOptions.mergeDefaultFields = true;

                updatedChildren = rxUtilities.arrayUnique(updatedChildren.concat(childrenObjects));

                var onlyConversationChildren = updatedChildren.filter(function(child) {
                    return (child instanceof Conversation);
                });

                totalCount = onlyConversationChildren.length;

                if (repoOptions.skipRepoUpdate) {
                    self.children = updatedChildren;
                } else {
                    getRepos().contactFolders.updateItemFields.call(getRepos().contactFolders, self, {
                        children: updatedChildren,
                        totalCount: totalCount
                    }, repoOptions);
                }
            };

            self.removeChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('remove children has been called', self, childrenObjects, repoOptions);

                // If we add a child of type Conversation, we want to increment the total count of items inside the folder.
                var totalCount = valueOrNull(self.totalCount, 0),
                    updatedChildren = self.children || [];

                repoOptions = repoOptions || {};
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.moveAction;

                updatedChildren = rxUtilities.removeIntersectionByKey(updatedChildren, childrenObjects);

                var onlyConversationChildren = updatedChildren.filter(function(child) {
                    return (child instanceof Conversation);
                });

                totalCount = onlyConversationChildren.length;

                getRepos().contactFolders.updateItemFields.call(getRepos().contactFolders, self, {
                    children: updatedChildren,
                    totalCount: totalCount
                }, repoOptions);
            };

            self.setSeenState = function(seenState, silentAction) {
                var self = this;

                getRepos().contactFolders.updateItemFields.call(getRepos().contactFolders, self, {
                    unreadCount: self.unreadCount + (!seenState ? 1 : -1)
                });


                if (!silentAction && self.parents) {
                    // If it's a subfolder need to update parents unread count as well                
                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, seenState);
                    });
                }
            };

            self.postAdditionCallback = function(repoOptions) {
                var self = this;

                if (self.contact) {
                    self.contact.setRelatedContactFolder(self.uid);

                    if (self.type === rxConsts.FOLDER_TYPE.GROUP) {
                        ActiveUser.addMemberOfGroup(self.contact);
                    }
                }
            };
        }

        function Preview(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                subject: 'subject',
                lastActivityDate: 'lastActivityDate',
                bodyPreview: 'bodyPreview',
                unreadMessagesCount: 'unreadCount',
                participants: 'participants',
                lastReplier: 'lastReplier',
                participantsActivity: 'participantsActivity'
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.uid = valueOrNull(json.uid);
            self.subject = valueOrNull(json.subject);
            self.lastActivityDate = valueOrNull(json.lastActivityDate);
            self.bodyPreview = valueOrNull(json.bodyPreview);
            self.unreadCount = valueOrNull(json.unreadMessagesCount);
            self.unreadCount = self.unreadCount < 0 ? 0 : self.unreadCount;
            self.participants = parseRepoItems(json.participants, getRepos().contacts);
            self.participants = self.participants.length > 0 ? $filter('orderBy')(self.participants, 'lastReplyDate') : self.participants;
            self.lastReplier = parseRepoItems(json.lastReplier, getRepos().contacts, {
                firstOnly: true
            });
            self.parents = [];
            self.children = [];
            self.unfetchedParents = [];

            // Add participants activity in the conversation in reverse order
            if (json.participantsActivity) {
                json.participantsActivity = $filter('orderBy')(json.participantsActivity, 'lastActivityDate', true);

                self.participantsActivity = parseRepoItems(json.participantsActivity.map(function(contact) {
                    return {
                        uid: contact.uid
                    };
                }), getRepos().contacts);
            }

            //TODO: is it necessary? in case we dont want default value assigning
            self.sentState = valueOrNull(json.sentState);
            self.isChat = valueOrNull(json.isChat);

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.unreadCount = self.unreadCount || 0;
                self.sentState = self.sentState || rxConfig.consts.SENT_STATE.SENT;
                self.isChat = valueOrFalse(self.isChat);
                self.parents = [];
                self.children = [];
            }

            // Check if there are 2 chat participants, because group chat contains just 1
            if (self.isChat && self.subject.indexOf('%s') > -1 && self.participants.length > 1) {
                self.subject = sprintf(self.subject, self.participants[0].getCorrectTitle(true), self.participants[1].getCorrectTitle(true));
            }

            self.isPlaceholderObject = function() {
                var self = this;

                return rxUtilities.isArrayNullOrEmpty(self.parents) || rxUtilities.isArrayNullOrEmpty(self.participants);
            };

            self.getUnfetchedParents = function() {
                var self = this;

                return self.unfetchedParents || [];
            };

            self.setUnfetchedParents = function(unfetchedParents) {
                var self = this;

                self.unfetchedParents = unfetchedParents || self.unfetchedParents;
            };

            self.getUnfetchedParentUIDs = function() {
                var self = this;

                return _.pluck(self.unfetchedParents || [], 'uid');
            };

            self.getParentUIDs = function() {
                var self = this;

                return _.pluck(self.parents || [], 'uid');
            };

            // Fetch dependent properties from the children (useful on removal)
            self.fetchDataFromChildren = function(propertiesToFetch) {
                var self = this;

                //console.debug('fetch data from children has been called with', propertiesToFetch);

                // propertiesToFetch ['sentState', 'participants', 'participantsActivity']
                var uniqueParticipants = {},
                    uniqueParticipantsActivity = {},
                    unreadCounter = -1,
                    sentState = rxConsts.SENT_STATE.SENT;

                self.children.forEach(function(childObject) {
                    propertiesToFetch.forEach(function(propertyToFetch) {
                        switch (propertyToFetch) {
                            case 'sentState':
                                sentState = (childObject.sentState === rxConsts.SENT_STATE.FAILED) ? childObject.sentState : null;

                                break;

                            case 'participants':
                                childObject.participants.forEach(function(participant) {
                                    uniqueParticipants[participant.uid] = uniqueParticipants[participant.uid] || participant;
                                });

                                break;

                                // TODO: Implement logics of finding last participants by activity date
                            case 'participantsActivity':
                                // childObject.participants.forEach(function(participant) {
                                //     uniqueParticipants[participant.uid] = uniqueParticipants[participant.uid] || participant;
                                // });
                                break;

                            case 'unreadCount':
                                unreadCounter += childObject.unreadCount;

                                break;

                            case 'isRead':
                                unreadCounter += valueOrFalse(childObject.isRead) ? 0 : 1;

                                break;

                                // TODO: Implement it
                            case 'lastReplier':
                                break;
                        }
                    });
                });

                // Figure which repo item needs to be updated
                var threadOrConvRepo = (self instanceof Conversation) ? getRepos().conversations : getRepos().threads;
                // sentState -> setSentState?
                sentState = (sentState === null) ? rxConsts.SENT_STATE.SENT : rxConsts.SENT_STATE.FAILED;

                threadOrConvRepo.updateItemFields.call(threadOrConvRepo, self, {
                    participants: !rxUtilities.isEmptyObject(uniqueParticipants) ? rxUtilities.objectToArray(uniqueParticipants) : null,
                    unreadCount: (unreadCounter > -1) ? ++unreadCounter : null,
                    sentState: sentState
                });

                // If sentState has been changed and self object is a Thread, we want to notify its parents about it
                if (self instanceof Thread && sentState !== self.sentState) {
                    self.parents.forEach(function(parent) {
                        parent.setSentState(sentState);
                    });
                }
            };

            self.hasGroupParticipants = function() {
                return self.getGroupParticipants().length > 0;
            };

            self.getGroupParticipants = function() {
                var self = this,
                    groupParticipants = [];

                self.participants.forEach(function(participant) {
                    if (participant.contactType === rxConsts.CONTACT_TYPE.GROUP) {
                        groupParticipants.push(participant);
                    }
                });

                return groupParticipants;
            };

            self.getNonGroupParticipants = function() {
                var groups = self.getGroupParticipants();
                var allMembers = "";

                groups.forEach(function(group) {
                    allMembers = allMembers + group.getGroupMembers().join(',');
                })

                var noMembers = [];

                self.participants.forEach(function(user) {
                    if (allMembers.indexOf(user.mailBoxAddress) === -1 && user.contactType !== 'GROUP') {
                        noMembers.push(user);
                    }
                });

                return noMembers;
            };

            self.isConversationObject = function() {
                var self = this;

                return self.hasOwnProperty('threadsCount');
            };

            self.getBylineForItem = function(preview, conversationUID) {
                var nonGroupMembers = [];

                var users = preview.participantsActivity ? preview.participantsActivity : preview.participants;

                if (!users.length) return; // byline is not ready

                var groups = preview.getGroupParticipants();
                var names = [];

                if (groups && groups.length > 0) {
                    // When there is group we just show the last replier 'John to Dev'
                    users = [users[0]];
                    nonGroupMembers = preview.getNonGroupParticipants().sort();
                }

                if (users.length === 1) {

                    var dName = getBylineWithSingleName(users[0], conversationUID, groups, nonGroupMembers);

                    if (dName) {
                        return dName;
                    }

                    // Get here in case the only sender in conversation is the user --> 'You to recipients alphabetical'
                    names = preview.participants.map(function(contact) {
                        return getName(contact, conversationUID, true, true /*isPreview*/ , 20 /*truncateFromIndex*/ );
                    });

                    var onlyReplyerInConversationIsUser = true;
                    var indexOfYou = names.indexOf("You");
                    names.splice(indexOfYou, 1);
                    names.sort();

                    if (names.length === 0) {
                        return "Only you"; // Can be only in sent item folder
                    }
                } else {
                    var appendLast;
                    users.forEach(function(user) {
                        var name = getName(user, conversationUID, true, true, 20 /*truncateFromIndex*/ );

                        if (name) {
                            names.push(name);
                        }
                    });
                }

                var visibleNames = names.splice(0, 3);
                var hiddenNames = names;

                var byline = visibleNames.join(', ');

                if (onlyReplyerInConversationIsUser) {
                    byline = "You to " + byline;

                    if (byline.lastIndexOf(',') === -1) {
                        return byline;
                    }
                }

                // Logic for user to # others
                if (!hiddenNames.length) {
                    // All the participants are shown
                    return byline.substring(0, byline.lastIndexOf(',')) + ' & ' + byline.substring(byline.lastIndexOf(',') + 1);
                }

                if (hiddenNames.length === 1) {
                    return byline + ' & one other';
                }

                return byline + ' & %n others'.replace('%n', hiddenNames.length);

            }

            function getName(user, conversationUID, preferFirstName, userSelfAsYou, truncateFromIndex) {
                if (!user) {
                    return '';
                }

                if (userSelfAsYou && user.mailBoxAddress === ActiveUser.getMailBoxAddress()) {
                    return 'You';
                }

                if (user.getCorrectTitle) {
                    var name = user.getCorrectTitle(preferFirstName, conversationUID);
                } else {
                    var name = user.firstName + user.lastName;
                }

                if (truncateFromIndex && name.length > truncateFromIndex) {
                    name = name.substr(0, truncateFromIndex) + "...";
                }

                return name;

            }

            function getBylineWithSingleName(user, conversationUID, groups, nonGroupMembers) {
                // For single user we show full display name unless there are groups
                var dName = getName(user, conversationUID, groups && groups.length > 0, true, 20);

                if (groups && groups.length > 0) {
                    dName = dName + ' to ' + groups.map(function(g) {
                        return g.getCorrectTitle();
                    }).sort().join(', ');

                    if (nonGroupMembers.length === 1 && nonGroupMembers[0] !== user) {
                        dName = dName + ' & ' + getName(nonGroupMembers[0], conversationUID, true, false, 20);
                    } else if (nonGroupMembers.length > 1) {
                        dName = dName + ' & Others';
                    }
                }

                if (dName !== 'You') {
                    return dName;
                }
            }
        };

        function Conversation(json, apiOptions) {
            var self = this;

            // Inheritance
            Preview.call(self, json, apiOptions);

            /* Server properties (for future use)
            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                threadsCount: 'threadsCount',
                folderUID: 'folderUID',
                displayNameByMailBoxUID: 'contactDisplayNames'
            };*/

            // Convert json fields and values for our convention            
            converterFunctionsIterator(json);

            self.folderUID = valueOrNull(json.folderUID);
            self.unfetchedParents = valueOrNull(self.folderUID) ? [{
                uid: self.folderUID
            }] : [];
            self.threadsCount = valueOrNull(json.threadsCount);
            self.contactDisplayNames = json.displayNameByMailBoxUID ? parseRepoItems(json.displayNameByMailBoxUID, getRepos().contactDisplayNames) : null;

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.threadsCount = self.threadsCount || 0;
                self.contactDisplayNames = self.contactDisplayNames || [];
            }

            self.addParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('add parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents ? self.parents.slice(0) : [];


                repoOptions = repoOptions || {};
                // repoOptions.mergeDefaultFields = true;

                updatedParents = rxUtilities.arrayUnique(updatedParents.concat(parentObjects));

                if (repoOptions.skipRepoUpdate) {
                    self.parents = updatedParents;
                } else {
                    getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                        parents: updatedParents
                    }, repoOptions);
                }
            };

            self.removeParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('remove parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents || [];

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;

                updatedParents = rxUtilities.removeIntersectionByKey(updatedParents, parentObjects);

                if (updatedParents.length === 0) {
                    // console.warn('Oh no, you have just left an orphan conversation, with no mommy and daddy, alone in the big world. Delete it son');
                }

                getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                    parents: updatedParents
                }, repoOptions);
            };

            self.addChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('add children has been called', self, childrenObjects, repoOptions);

                var updatedChildren = self.children || [],
                    threadsCount = valueOrNull(self.threadsCount, 0);

                if (threadsCount === 0) {
                    // console.warn('Something bad just happend, redail 911');
                }

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;
                repoOptions.callbackParams = {
                    numOfChangedChildren: childrenObjects.length
                };
                // If we call post update call back we wont emit the relevant event now, cuz otherwise we'll emit event twice which is redundant.
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.callPostUpdateCallback || repoOptions.moveAction;
                // repoOptions.mergeDefaultFields = true;

                updatedChildren = rxUtilities.arrayUnique(updatedChildren.concat(childrenObjects));

                threadsCount = updatedChildren.length;

                if (repoOptions.skipRepoUpdate) {
                    self.children = updatedChildren;
                } else {
                    getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                        children: updatedChildren,
                        threadsCount: threadsCount
                    }, repoOptions);
                }
            };

            self.removeChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('remove children has been called', self, childrenObjects, repoOptions);

                var updatedChildren = self.children || [],
                    threadsCount = valueOrNull(self.threadsCount, 0);

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;
                repoOptions.callbackParams = {
                    numOfChangedChildren: childrenObjects.length
                };
                // If we call post update call back we wont emit the relevant event now, cuz otherwise we'll emit event twice which is redundant.
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.callPostUpdateCallback || repoOptions.moveAction;

                updatedChildren = rxUtilities.removeIntersectionByKey(updatedChildren, childrenObjects);

                threadsCount = updatedChildren.length;

                // TODO: decide what to do in self case
                if (updatedChildren.length === 0) {
                    // console.error('Oh no, you have just left a parent conversation, with no kids. Delete it kido');
                }

                // Update dependent properties
                getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                    children: updatedChildren,
                    threadsCount: threadsCount
                }, repoOptions);
            };

            self.setSentState = function(sentState, silentAction) {
                var self = this;

                // If the new state is FAILED or PENDING we can change it right away without iterating over the sentState of the children
                if (sentState !== rxConsts.SENT_STATE.SENT) {
                    getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                        sentState: sentState
                    });
                } else {
                    // Fetching only sentState from children because that's what was changed
                    self.fetchDataFromChildren(['sentState']);
                }

                if (!silentAction) {
                    // Parent folders dont have sentState property
                    // self.parents.forEach(function(parent) {
                    //     parent.setSentState(sentState);
                    // });
                }
            };

            self.setSeenState = function(seenState, silentAction) {
                var self = this;

                var threadsUnreadCount = 0;

                self.children.forEach(function(thread) {
                    threadsUnreadCount += thread.unreadCount;
                });

                getRepos().conversations.updateItemFields.call(getRepos().conversations, self, {
                    unreadCount: threadsUnreadCount
                });

                if (!silentAction && self.parents) {
                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, seenState);
                    });
                }
            };

            self.postAdditionCallback = function(repoOptions) {
                var self = this;

                //console.debug('post addition callback called', self, repoOptions);

                // If parents already exist, we can filter out the unfetched parents from the existing ones
                self.unfetchedParents = rxUtilities.reduceAlreadyFetchedParents(self.parents, self.unfetchedParents, 'uid');

                if (rxUtilities.isArrayNullOrEmpty(self.unfetchedParents)) {
                    //console.debug('There are no parents to fetch although there should be, quiting post addition callback');
                    return;
                }

                // There's no chance that the conversation belongs to a mailbox folder and we don't have it cuz we get them all on loading
                // Therefore we assume that if there's no folder parent, we create it as a contact folder that will be a placeholder for
                // the real parent that is about to come.

                var repos = getRepos(),
                    parentMailBoxFolders = repos.mailBoxFolders.getItems(self.unfetchedParents),
                    parentContactFolders = repos.contactFolders.getItems(self.unfetchedParents),
                    parentObjects = rxUtilities.isArrayNullOrEmpty(parentMailBoxFolders) ? parentContactFolders : parentMailBoxFolders;

                if (rxUtilities.isArrayNullOrEmpty(parentObjects)) {
                    parentObjects = repos.contactFolders.addItems.call(repos.contactFolders, self.unfetchedParents, {
                        skipChildrenFetchingAfterLink: true,
                        skipEventEmitting: true
                    });

                    // parentObjects = parentObjects.concat(repos.mailBoxFolders.addItems.call(repos.mailBoxFolders, self.unfetchedParents, {
                    //     skipChildrenFetchingAfterLink: true,
                    //     skipEventEmitting: true
                    // }));
                }

                // Now it's the time for some awesomeness - calling our magical function!
                angular.bind(self, link, self, parentObjects, repoOptions)();

                self.unfetchedParents = [];
            };

            self.postChildrenUpdateCallback = function(repoOptions) {
                var self = this;

                //console.debug('post children update callback called', self, repoOptions);

                if (repoOptions.callbackParams && repoOptions.callbackParams.numOfChangedChildren > 1) {
                    // Fetch dependent children properties (need to specify them)                    
                    self.fetchDataFromChildren(['sentState', 'threadsCount', 'unreadCount']);
                }

                angular.bind(self, fetchToChild, repoOptions)();
            };

            // Fetch data from specified child or most recent one if not specified
            // TODO: Implement callback params for single child that was added instead of finding the most recent one
            function fetchToChild(repoOptions) {
                var self = this;

                //console.debug('fetch to child has been called', self, repoOptions);

                // TODO: Add assigning first child if there is only one
                var childToBeFetched = $filter('orderBy')(self.children, '-lastActivityDate')[0];

                if (!childToBeFetched) {
                    console.error('could not find child to fetch, possible deletion.');
                    return;
                }
                // Exclude unread count so we won't override the unread count of the conversation with the unread count of the thread
                var fieldsToExclude = ['subject', 'unreadCount', 'flowType'];

                repoOptions = repoOptions || {};
                // we use fieldsToMerge field in order to avoid overriding these field because they are dependent properties                
                repoOptions.fieldsToMerge = ['participants', 'participantsActivity'];

                getRepos().conversations.updateItemFields.call(getRepos().conversations, self,
                    childToBeFetched.toParentJSON.call(childToBeFetched, null, fieldsToExclude),
                    repoOptions);
            }

            self.updateByline = function() {
                var self = this;

                // the conversation byline will update the threads byline as well

                self.byline = self.getBylineForItem(self, self.uid);

                // update the byline of the children (if exist)
                if (self.isConversationObject() && self.children.length > 1) {
                    self.children.forEach(function(thread) {
                        thread.byline = self.getBylineForItem(thread, self.uid);
                    });
                }
            };

        };

        function Thread(json, apiOptions) {
            var self = this;

            // Inheritance
            Preview.call(self, json, apiOptions);

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                conversationUID: 'conversationUID',
                flowType: 'flowType',
                attachments: 'attachments'
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.unfetchedParents = valueOrNull(json.conversations, []);
            self.flowType = valueOrNull(json.flowType);
            self.attachments = parseRepoItems(json.attachments, getRepos().files);

            // Get the thread draft from the local storage and prepare a preview for it.
            //TODO: Dor self.draft = rxDraftService.getDraft(self.uid);
            //self.draftPreview = self.draft ? $('<span>' + self.draft + '</span>').text() : '';

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
            }

            self.addParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('add parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents ? self.parents.slice(0) : [];

                repoOptions = repoOptions || {};
                // repoOptions.mergeDefaultFields = true;

                updatedParents = rxUtilities.arrayUnique(updatedParents.concat(parentObjects));

                if (repoOptions.skipRepoUpdate) {
                    self.parents = updatedParents;
                } else {
                    getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                        parents: updatedParents
                    }, repoOptions);
                }
            };

            self.removeParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('remove parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents || [];

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;

                updatedParents = rxUtilities.removeIntersectionByKey(updatedParents, parentObjects, '$key');

                if (updatedParents.length === 0) {
                    // console.warn('Oh no, you have just left an orphan conversation, with no mommy and daddy, alone in the big world. Delete it son');
                }

                getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                    parents: updatedParents
                }, repoOptions);
            };

            self.addChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('add children has been called', self, childrenObjects, repoOptions);

                var updatedChildren = self.children || [];

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;
                repoOptions.callbackParams = {
                    numOfChangedChildren: childrenObjects.length
                };
                // If we call post update call back we wont emit the relevant event now, cuz otherwise we'll emit event twice which is redundant.
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.callPostUpdateCallback || repoOptions.moveAction;
                // repoOptions.mergeDefaultFields = true;

                updatedChildren = rxUtilities.arrayUnique(updatedChildren.concat(childrenObjects));

                // Fetch dependent properties 
                if (repoOptions.skipRepoUpdate) {
                    self.children = updatedChildren;
                } else {
                    getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                        children: updatedChildren
                    }, repoOptions);
                }
            }

            self.removeChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('remove children has been called', self, childrenObjects, repoOptions);

                var updatedChildren = self.children || [];

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;
                repoOptions.callbackParams = {
                    numOfChangedChildren: childrenObjects.length
                };
                // If we call post update call back we wont emit the relevant event now, cuz otherwise we'll emit event twice which is redundant.
                // If it's a removeChildren during moveAction, we don't want to notify the controller cuz we'll do that when adding the new parents.
                repoOptions.skipEventEmitting = repoOptions.skipEventEmitting || repoOptions.callPostUpdateCallback || repoOptions.moveAction;

                updatedChildren = rxUtilities.removeIntersectionByKey(updatedChildren, childrenObjects);

                // TODO: decide what to do in self case
                if (updatedChildren.length === 0) {
                    // console.warn('Oh no, you have just left a parent conversation, with no kids. Delete it kido');
                    // return;
                }

                // Fetch dependent properties                
                getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                    children: updatedChildren
                }, repoOptions);
            };

            self.setSentState = function(sentState, silentAction) {
                var self = this;

                // If the new state is FAILED or PENDING we can change it right away without iterating over the sentState of the children
                if (sentState !== rxConsts.SENT_STATE.SENT) {
                    getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                        sentState: sentState
                    });
                } else {
                    // Fetching only sentState from children because that's what was changed
                    self.fetchDataFromChildren(['sentState']);
                }

                if (!silentAction) {
                    self.parents.forEach(function(parent) {
                        parent.setSentState(sentState);
                    });
                }
            }

            self.setSeenState = function(seenState, silentAction) {
                var self = this;

                var messagesUnreadCount = self.children.filter(function(msg) {
                    return msg.isRead === false;
                }).length;

                getRepos().threads.updateItemFields.call(getRepos().threads, self, {
                    unreadCount: messagesUnreadCount
                });

                if (!silentAction && self.parents) {
                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, seenState);
                    });
                }
            };

            // Mark the thread as read by changing the unreadCount to 0
            // update the children, parents and server
            self.setRead = function(notifyServer) {
                var self = this;

                var unreadCount = self.children.filter(function(message) {
                    return message.isRead == false;
                }).length;

                if (!unreadCount && !self.unreadCount) return; // thread was already read

                // update the unreadCount and notify server
                getRepos().threads.updateItemsFields.call(getRepos().threads, self, {
                    unreadCount: 0
                }, {
                    notifyServer: notifyServer
                });

                // update children
                var unreadMessages = self.children.filter(function(msg) {
                    return msg.isRead === false;
                });

                unreadMessages.forEach(function(message) {
                    message.isRead = true;
                });

                // update parents
                if (self.parents) {
                    var parent = getRepos().conversations.getAllData().filter(function(conversation) {
                        return conversation.uid === self.parents[0].uid && conversation.folderUID === rxConsts.SEARCH_FOLDER_UID;
                    })

                    if (parent.length > 0) {
                        parent[0].setSeenState.call(parent[0], true);
                    }

                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, true);
                    });
                }
            }

            self.toParentJSON = function(parentUID, fieldsToExclude) {
                var self = this;

                function isExcluded(fieldName) {
                    return (fieldsToExclude && fieldsToExclude.indexOf(fieldName) > -1);
                }

                return {
                    // Preview properties
                    uid: parentUID || null,
                    subject: isExcluded('subject') ? null : self.subject,
                    lastActivityDate: self.lastActivityDate,
                    bodyPreview: self.bodyPreview,
                    unreadCount: isExcluded('unreadCount') ? null : self.unreadCount,
                    participants: isExcluded('participants') ? null : self.participants,
                    lastReplier: isExcluded('lastReplier') ? null : self.lastReplier,
                    participantsActivity: isExcluded('participantsActivity') ? null : self.participantsActivity,
                    sentState: (!isExcluded('sentState') && self.sentState === rxConsts.SENT_STATE.FAILED) ? self.sentState : null,
                    folderUID: rxConsts.SEARCH_FOLDER_UID
                };
            };

            self.postAdditionCallback = function(repoOptions) {
                var self = this;

                //console.debug('post addition callback called', self, repoOptions);

                // If parents already exist, we can filter out the unfetched parents from the existing ones
                self.unfetchedParents = rxUtilities.reduceAlreadyFetchedParents(self.parents, self.unfetchedParents, 'folderUID');

                if (rxUtilities.isArrayNullOrEmpty(self.unfetchedParents)) {
                    //console.debug('There are no parents to fetch although there should be, quiting post addition callback');
                    return;
                }

                var repos = getRepos(),
                    parentObjects = repos.conversations.addItems.call(repos.conversations, self.unfetchedParents, {
                        skipChildrenFetchingAfterLink: true,
                        skipEventEmitting: true,
                        includeSkippedItems: true
                    });

                // Now it's the time for some awesomeness - calling our magical function!
                angular.bind(self, link, self, parentObjects, repoOptions)();

                self.unfetchedParents = [];
            };

            self.postChildrenUpdateCallback = function(repoOptions) {
                var self = this;

                //console.debug('post children update callback called', self, repoOptions);

                if (repoOptions.callbackParams && repoOptions.callbackParams.numOfChangedChildren > 1) {
                    // Fetch dependent children properties (need to specify them)                    
                    self.fetchDataFromChildren(['sentState', 'isRead']);
                }

                // Fetch general properties                                    
                angular.bind(self, fetchToChild, repoOptions)();

                if (!rxUtilities.isArrayNullOrEmpty(self.parents)) {
                    angular.bind(self.parents[0], self.parents[0].postChildrenUpdateCallback, {})();
                }
            };

            self.moveToFolder = function(sourceFolder, targetFolder) {
                var self = this;

                if (!sourceFolder || !targetFolder) {
                    $log.error("sourceFolder or targetFolder or conversation was not supplied");
                    return;
                }

                var conversationInFolder = self.getConversationInFolder(sourceFolder);

                if (!conversationInFolder) {
                    $log.error("Could not find conversation in source folder, aborting");
                    return;
                }

                // If the moved thread is the only children of it's parent (has no siblings) we move the whole conversation
                var moveWholeConversation = (conversationInFolder.children.length === 1),
                    externalPayload = {
                        targetFolderUID: targetFolder.uid,
                        sourceFolderUID: sourceFolder.uid,
                        paramName: moveWholeConversation ? 'moveConversation' : 'moveThread'
                    },
                    innerMoveQueuePayload = {
                        sourceFolder: sourceFolder,
                        targetFolder: targetFolder,
                        entities: moveWholeConversation ? [conversationInFolder] : [self],
                        parentEntity: moveWholeConversation ? sourceFolder : conversationInFolder,
                        parentEntityType: moveWholeConversation ? 'mailBoxFolders' : 'conversations',
                        entityType: moveWholeConversation ? 'conversations' : 'threads'
                    };

                if (moveWholeConversation) {
                    externalPayload.conversationsUIDs = [conversationInFolder.uid];
                } else {
                    externalPayload.threadsUIDs = [self.uid];
                }

                EmitterService.invoke(EmitterService.uiEvents.AddDiscussionToMoveQueue, {
                    moveExternal: externalPayload,
                    moveQueue: innerMoveQueuePayload
                }, CTRL_NAME);
            };

            // Get the parent conversation that inside the specified folder 
            self.getConversationInFolder = function(conversationFolder) {
                return self.parents.find(function(conversation) {
                    return conversation.parents.find(function(folder) {
                        return folder.uid === conversationFolder.uid
                    });
                });
            };

            self.unlinkAndRemoveParents = function(parentsToRemoveAndUnlink) {
                var self = this;

                if (!rxUtilities.isArrayNullOrEmpty(parentsToRemoveAndUnlink)) {
                    // Unlink the thread from its removed parents
                    unlink(self, parentsToRemoveAndUnlink, {
                        skipChildrenFetchingAfterLink: true
                    });
                    // Updated item's parents in the repo and notify about the remove action if necessary
                    self.removeParents(parentsToRemoveAndUnlink);
                }
            };

            // Fetch general properties from specified child or most recent one if not specified (useful on addition)
            // TODO: Implement callback params for single child that was added instead of finding the most recent one
            function fetchToChild(repoOptions) {
                var self = this;

                //console.debug('fetch to child has been called', self, repoOptions);

                var childToBeFetched = $filter('orderBy')(self.children, '-receivedDate')[0];

                // Exclude subjcet so we won't override the subject of the thread
                var fieldsToExclude = ['subject', 'flowType'];

                repoOptions = repoOptions || {};
                repoOptions.fieldsToMerge = ['attachments', 'participants', 'participantsActivity'];

                getRepos().threads.updateItemFields.call(getRepos().threads, self, childToBeFetched.toParentJSON.call(childToBeFetched, null,
                    fieldsToExclude), repoOptions);
            }
        };

        function Message(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                bodyHTML: 'bodyHTML',
                endedBodyHTML: 'bodyExtended',
                bodyPreview: 'bodyPreview',
                sentDate: 'sentDate',
                creationDate: 'creationDate',
                receivedDate: 'receivedDate',
                isRead: 'isRead',
                isReadOnly: 'isReadOnly',
                subject: 'subject',
                internetMessageId: 'internetMessageId',
                parentInternetMessageId: 'parentInternetMessageId',
                folderUID: 'folderUID',
                threadUID: 'threadUID',
                conversationUID: 'conversationUID',
                flowType: 'flowType',
                sender: 'sender',
                mailBoxUID: 'mailBoxUID',
                toMailBoxes: 'toMailBoxes',
                ccMailBoxes: 'ccMailBoxes',
                bccMailBoxes: 'bccMailBoxes',
                attachments: 'attachments',
                quotationBubbles: 'quotationBubbles',
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            self.unfetchedParents = valueOrNull(json.threadUID) ? [{
                uid: json.threadUID
            }] : [];

            self.threadUID = valueOrNull(json.threadUID);
            self.conversationUID = valueOrNull(json.conversationUID);
            self.folderUID = valueOrNull(json.folderUID);

            self.uid = valueOrNull(json.uid);
            self.bodyHTML = valueOrNull(json.bodyHTML);
            self.fullBodyHTML = valueOrNull(json.fullBodyHTML);
            self.bodyExtended = valueOrNull(json.extendedBodyHTML);
            self.bodyPreview = valueOrNull(json.bodyPreview);
            self.sentDate = valueOrNull(json.sentDate);
            self.creationDate = valueOrNull(json.creationDate);
            self.receivedDate = valueOrNull(json.receivedDate);
            self.isRead = valueOrNull(json.isRead);
            self.isReadOnly = valueOrNull(json.isReadOnly);
            self.subject = valueOrNull(json.subject);
            self.parentMessageUID = valueOrNull(json.parentMessageUID);
            self.internetMessageId = valueOrNull(json.internetMessageId);
            self.mailBoxUID = valueOrNull(json.mailBoxUID);
            self.flowType = valueOrNull(json.flowType);
            self.sender = parseRepoItems(json.sender, getRepos().contacts, {
                firstOnly: true
            });
            self.toMailBoxes = parseRepoItems(json.toMailBoxes, getRepos().contacts);
            self.ccMailBoxes = parseRepoItems(json.ccMailBoxes, getRepos().contacts);
            self.bccMailBoxes = parseRepoItems(json.bccMailBoxes, getRepos().contacts);
            self.attachments = parseRepoItems(json.attachments, getRepos().files);
            self.sentState = valueOrNull(json.sentState);
            self.quotationBubbles = json.quotationBubbles ? parseQuotationBubbles(json.quotationBubbles) : null;
            self.parents = [];
            self.children = [];
            self.meetingRequest = parseMeetingRequest(json.meetingRequest, getRepos().contacts);
            self.meetingResponseType = valueOrNull(json.meetingResponseType);
            self.isFormatted = false;

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
                self.isRead = valueOrFalse(self.isRead);
                self.isReadOnly = valueOrFalse(self.isReadOnly);
                self.sentState = self.sentState || rxConfig.consts.SENT_STATE.SENT;
            }

            if (valueOrNull(self.bodyHTML)) {
                /* Remove <title></title> tag from the <head></head> tag so inside text won't be included in the message */
                self.bodyHTML = rxEmailSanitizer.sanitize(rxUtilities.removeTitleTagFromHtml(self.bodyHTML));
                // save if the message is formatted of simple-text message.
                self.isFormatted = determineFormattedMessage();

            }

            self.isPlaceholderObject = function() {
                var self = this;

                return rxUtilities.isArrayNullOrEmpty(self.parents) || !self.flowType;
            };

            self.getUnfetchedParents = function() {
                var self = this;

                return self.unfetchedParents || [];
            };

            self.setUnfetchedParents = function(unfetchedParents) {
                var self = this;

                self.unfetchedParents = unfetchedParents || self.unfetchedParents;
            };

            self.getUnfetchedParentUIDs = function() {
                var self = this;

                return _.pluck(self.unfetchedParents || [], 'uid');
            };

            self.getParentUIDs = function() {
                var self = this;

                return _.pluck(self.parents || [], 'uid');
            };

            self.addParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('add parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents ? self.parents.slice(0) : [];

                repoOptions = repoOptions || {};
                // repoOptions.mergeDefaultFields = true;

                parentObjects.forEach(function(parentObject) {
                    updatedParents.push(parentObject);
                });

                // updatedParents = rxUtilities.arrayUnique(updatedParents, '$key');

                if (updatedParents.length > 1) {
                    console.warn('Current message has more than one parent, which is pretty weird dude');
                }

                if (repoOptions.skipRepoUpdate) {
                    self.parents = updatedParents;
                } else {
                    getRepos().messages.updateItemFields.call(getRepos().messages, self, {
                        parents: updatedParents
                    }, repoOptions);
                }
            }

            self.removeParents = function(parentObjects, repoOptions) {
                var self = this;

                //console.debug('remove parents has been called', self, parentObjects, repoOptions);

                var updatedParents = self.parents || [];

                repoOptions = repoOptions || {};
                repoOptions.callPostUpdateCallback = !repoOptions.skipChildrenFetchingAfterLink;

                updatedParents = rxUtilities.removeIntersectionByKey(updatedParents, parentObjects);

                if (updatedParents.length === 0) {
                    // console.warn('Oh no, you have just left an orphan conversation, with no mommy and daddy, alone in the big world. Delete it son');
                }

                getRepos().messages.updateItemFields.call(getRepos().messages, self, {
                    parents: updatedParents
                }, repoOptions);
            };

            self.addChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('add children has been called', self, childrenObjects, repoOptions);

                // Can't add children to a message(at least for now)
            }

            self.removeChildren = function(childrenObjects, repoOptions) {
                var self = this;

                //console.debug('remove children has been called', self, childrenObjects, repoOptions);

                // Can't remove children from a message(at least for now)
            };

            self.setSentState = function(sentState, silentAction) {
                var self = this;

                getRepos().messages.updateItemFields.call(getRepos().messages, self, {
                    sentState: sentState
                });

                if (!silentAction) {
                    self.parents.forEach(function(parent) {
                        parent.setSentState(sentState);
                    });
                }
            };

            self.setSeenState = function(seenStateObject, silentAction) {
                var self = this;

                // Mark the seen message and siblings with the same internetMessageId with  as read/unread.
                var siblingsToUpdate = $filter('filter')(self.parents[0].children, {
                    internetMessageId: self.internetMessageId
                }, true);

                siblingsToUpdate.forEach(function(msg) {
                    getRepos().messages.updateItemFields.call(getRepos().messages, msg, {
                        isRead: seenStateObject.isRead
                    }, {
                        notifyServer: seenStateObject.notifyServer
                    })
                });

                if (!silentAction && self.parents) {
                    self.parents.forEach(function(parent) {
                        parent.setSeenState.call(parent, seenStateObject.isRead);
                    });
                }
            };

            self.toParentJSON = function(parentUID, fieldsToExclude) {
                var self = this;

                //TODO: dor,
                //sentItemsFolder = getSentItemsFolder();

                function isExcluded(fieldName) {
                    return (fieldsToExclude && fieldsToExclude.indexOf(fieldName) > -1);
                }

                /*if (!sentItemsFolder) {
                    $log.error('There is no sent items folder for converting message into thread JSON');
                }*/

                return {
                    // Preview properties
                    uid: parentUID || null,
                    subject: isExcluded('subject') ? null : self.subject,
                    lastActivityDate: self.receivedDate,
                    bodyPreview: rxUtilities.stripHTML(self.bodyHTML ? self.bodyHTML : self.fullBodyHTML),
                    participants: rxUtilities.arrayUnique(self.getAllRecipients.call(self).concat(self.sender)),
                    lastReplier: self.sender,
                    participantsActivity: [self.sender],
                    sentState: isExcluded('sentState') ? null : self.sentState,
                    conversations: [{
                        uid: self.conversationUID,
                        folderUID: rxConsts.SEARCH_FOLDER_UID
                    }],
                    // Thread properties
                    flowType: isExcluded('sentState') ? null : self.flowType
                };
            };

            self.getAllRecipients = function() {
                var self = this;

                var recipients = self.toMailBoxes,
                    combinedRecipients = !rxUtilities.isArrayNullOrEmpty(self.ccMailBoxes) ? rxUtilities.arrayUnique(recipients.concat(self.ccMailBoxes)) : recipients;

                return !rxUtilities.isArrayNullOrEmpty(self.bccMailBoxes) ? rxUtilities.arrayUnique(combinedRecipients.concat(self.bccMailBoxes)) : combinedRecipients;
            };

            self.getAttachmentUIDs = function() {
                return []; //self.attachments.length > 0 ? self.attachments.map(attachment => attachment.uid) : [];
            };

            self.toServer = function() {
                var self = this;

                var msgToServer = clone.call(self),
                    toMailBoxUIDs = [],
                    ccMailBoxUIDs = [],
                    bccMailBoxUIDs = [];

                if (!rxUtilities.isArrayNullOrEmpty(msgToServer.toMailBoxes)) {
                    toMailBoxUIDs = msgToServer.toMailBoxes.map(function(recipient) {
                        return recipient.mailBoxAddress
                    });
                }
                if (!rxUtilities.isArrayNullOrEmpty(msgToServer.ccMailBoxes)) {
                    ccMailBoxUIDs = msgToServer.ccMailBoxes.map(function(recipient) {
                        return recipient.mailBoxAddress
                    });
                }
                if (!rxUtilities.isArrayNullOrEmpty(msgToServer.bccMailBoxes)) {
                    bccMailBoxUIDs = msgToServer.bccMailBoxes.map(function(recipient) {
                        return recipient.mailBoxAddress
                    });
                }

                toMailBoxUIDs = !rxUtilities.isArrayNullOrEmpty(self.addedMailBoxUIDs) ? rxUtilities.arrayUnique(toMailBoxes.concat(self.addedMailBoxUIDs)) : toMailBoxUIDs;

                msgToServer.toMailBoxUIDs = toMailBoxUIDs;
                msgToServer.ccMailBoxUIDs = ccMailBoxUIDs;
                msgToServer.bccMailBoxUIDs = bccMailBoxUIDs;

                if (msgToServer.attachments.length > 0) {
                    msgToServer.attachmentUIDs = msgToServer.attachments.map(function(att) {
                        return att.uid
                    });
                }

                var fieldsToDelete = ['uid', '$key', 'threadUID', 'conversationUID', 'folderUID', 'bodyPreview', 'parents', 'children', 'addedMailBoxUIDs', 'flowType',
                    'sentState', 'sender', 'attachments', 'isRead', 'isReadOnly', 'sentDate', 'creationDate', 'bodyExtended', 'quotationBubbles', 'receivedDate', 'internetMessageId', 'unfetchedParents',
                    'toMailBoxes', 'ccMailBoxes', 'bccMailBoxes'
                ];

                fieldsToDelete.forEach(function(fieldName) {
                    delete msgToServer[fieldName];
                });

                fieldsToDelete = [];

                for (var k in msgToServer) {
                    if (msgToServer[k] === null) {
                        fieldsToDelete.push(k);
                    }
                }

                fieldsToDelete.forEach(function(fieldName) {
                    delete msgToServer[fieldName];
                });

                return msgToServer;
            };

            self.postAdditionCallback = function(repoOptions) {
                var self = this;

                //console.debug('post addition callback called', self, repoOptions);

                // If parents already exist, we can filter out the unfetched parents from the existing ones
                self.unfetchedParents = rxUtilities.reduceAlreadyFetchedParents(self.parents, self.unfetchedParents, 'uid');

                if (rxUtilities.isArrayNullOrEmpty(self.unfetchedParents)) {
                    //console.debug('There are no parents to fetch although there should be, quiting post addition callback');
                    return;
                }

                var repos = getRepos(),
                    parentObjects = repos.threads.getItems(self.unfetchedParents);

                if (rxUtilities.isArrayNullOrEmpty(parentObjects)) {
                    parentObjects = repos.threads.addItems.call(repos.threads, self.unfetchedParents, {
                        skipChildrenFetchingAfterLink: true,
                        skipEventEmitting: true
                    });
                }

                // Now it's the time for some awesomeness - calling our magical function!
                angular.bind(self, link, self, parentObjects, repoOptions)();

                self.unfetchedParents = [];
            }

            self.getFullBodyHTML = function() {
                // if data exists - return it
                // else get it from remote;
                return $q(function(resolve, reject) {
                    if (self.fullBodyHTML) {
                        resolve(self.fullBodyHTML);
                    } else {
                        var options = {
                            url: ApiURLs.fullBodyHTML,
                            method: "GET",
                            params: {
                                messageUID: self.uid
                            }
                        };

                        // If the message mailBoxUID is not the logged in user ,it means that it might belong to a group and we need to send it's uid
                        // In order to get the correct fullBodyHTML for this message
                        if (self.mailBoxUID !== ActiveUser.getMailBoxUID()) {
                            var memberOfGroupUIDs = ActiveUser.getMemberOfGroupUIDs(),
                                messageParticipantUIDs = self.toMailBoxes.concat(self.ccMailBoxes).map(function(contact) {
                                    return contact.uid
                                }),
                                existingGroupParticipants = _.intersection(memberOfGroupUIDs, messageParticipantUIDs);

                            if (existingGroupParticipants.length) {
                                options.params.groupUID = existingGroupParticipants[0];
                            }
                        }

                        DataApiService.remote(options).then(function(response) {
                                if (response.data && self.uid === response.data.uid && response.data.fullBodyHTML) {
                                    self.fullBodyHTML = response.data.fullBodyHTML;
                                } else {
                                    console.error('got wrong data from server', response);

                                    reject('got wrong data from server');
                                }

                                resolve(self.fullBodyHTML);
                            },
                            function(response) {
                                console.error('Couldnt retrieve fullBodyHTML from server', response);

                                reject('Couldnt retrieve fullBodyHTML from server');
                            });
                    }
                });

            };

            function clone(message) {
                var self = this,
                    newMessage = new Message({});

                angular.extend(newMessage, self);

                return newMessage;
            }

            function parseQuotationBubbles(bubbles) {
                bubbles.forEach(function(bubble) {
                    if (bubble.sender && bubble.sender.uid) {
                        bubble.sender = parseRepoItems(bubble.sender, getRepos().contacts, {
                            firstOnly: true
                        });
                    }
                });

                return bubbles;
            }

            function determineFormattedMessage() {
                // formatted messages are defined as messages with a table *only* in the top 3 levels
                // TODO(neilk): make this more tight after BETA
                var isFormatted = false;

                if (self.bodyHTML.indexOf('<table') > -1) {
                    var currentLevelIndex = 0;
                    var currentLevel = $('<div>' + self.bodyHTML + '</div>').contents();
                    while (!isFormatted && currentLevelIndex < 3 && currentLevel.length === 1) {
                        isFormatted = currentLevel.is('table');
                        currentLevelIndex++;
                        currentLevel = currentLevel.contents();
                    }
                }

                return isFormatted;
            }

        };

        function Attachment(json, apiOptions) {
            var self = this;

            // { SERVER_PROEPRTY: CLIENT_CONVERTED_PROPERTY }
            /* Server properties (for future use)
            var SERVER_CLIENT_CONVERTED_PROPERTIES = {
                uid: 'uid',
                name: 'name',
                versionNumber: 'versionNumber',
                size: 'size',
                creatorMailBoxUID: 'creatorMailBoxUID',
                creationDate: 'uploadDate',
                messageUID: 'messageUID',
                contentID: 'contentID',
                isInline: 'isInline',
                inlineIndex: 'inlineIndex'
            };*/

            // Convert json fields and values for our convention
            converterFunctionsIterator(json);

            var repos = getRepos();

            self.uid = valueOrNull(json.uid);
            self.name = valueOrNull(json.name);
            // self.versionNumber = valueOrNull(json.versionNumber);
            self.size = valueOrNull(json.size);
            self.creator = parseRepoItems(json.creatorMailBoxUID, repos.contacts, {
                firstOnly: true
            });
            self.uploadDate = valueOrNull(json.creationDate);
            self.originalMessage = parseRepoItems(json.messageUID, repos.messages, {
                firstOnly: true
            });
            self.type = getTypeFromMimeType(json.mimeType) || parseType(json.name); // fallback to name if mime type isn't present. shouldn't happen thou.
            self.isPreviewSupported = isPreviewSupported(self.name);
            self.contentID = valueOrNull(json.contentID);
            self.isInline = valueOrNull(json.isInline);
            self.inlineIndex = valueOrNull(json.inlineIndex);
            // NOT IN USE
            // self.extension = valueOrNull(json.extention);            
            // self.lastChanged = valueOrNull(json.lastChanged);

            if (!apiOptions || apiOptions && !apiOptions.ignoreUserProperties) {
                // FILL USER DEFAULT VALUES ONLY HERE
            }

            self.isPlaceholderObject = function() {
                var self = this;

                return (!self.creator || (self.originalMessage && self.originalMessage.isPlaceholderObject()));
            };

            self.getDownloadUrl = function(redirect, download) {
                var self = this;

                var parameters = {
                    fileUID: self.uid,
                    redirect: redirect || false,
                    download: download || true,
                    sessionUID: ActiveUser.getSessionToken()
                };

                if (self.versionNumber) {
                    parameters.versionUID = self.versionNumber;
                }

                var link = ApiURLs.getFile + '?' + Object.keys(parameters).map(function(key) {
                    return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
                }).join('&');

                return link;
            };

            self.getPreviewUrl = function(redirect) {
                var self = this;

                var parameters = {
                    fileUID: self.uid,
                    redirect: redirect || true,
                    sessionUID: ActiveUser.getSessionToken()
                };

                if (self.versionNumber) {
                    parameters.versionUID = self.versionNumber;
                }

                var link = ApiURLs.getFile + '?' + Object.keys(parameters).map(function(key) {
                    return encodeURIComponent(key) + '=' + encodeURIComponent(parameters[key]);
                }).join('&');

                return link;
            };

            self.getFileSizeText = function() {
                return rxUtilities.getFileSizeText(self.size);
            }

            //TODO: Add file types to consts
            function parseType(name) {
                if ((/\.(gif|jpg|jpeg|tiff|png)$/i).test(name)) {
                    return 'image';
                }

                if ((/\.(pdf)$/i).test(name)) {
                    return 'pdf';
                }

                return 'other';
            }

            function getTypeFromMimeType(mimeType) {
                return mimeType ? mimeType.split('/')[0] : undefined;
            }

            //TODO: Add function to utilities
            function isPreviewSupported(name) {
                return ((/\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt|py|js|xml|html|css|md|pl|c|m|json)$/i).test(name));
            }
        };

        // INHERITANCE DECLERATION
        User.prototype = Object.create(Contact.prototype);

        Group.prototype = Object.create(Contact.prototype);

        Conversation.prototype = Object.create(Preview.prototype);

        Thread.prototype = Object.create(Preview.prototype);
        // END OF INHERITANCE DECLERATION

        // PROPERTIES DEFINITION
        Object.defineProperty(Folder.prototype, rxConsts.RELATIONAL_FIELDS.PARENT, {
            writable: true,
            enumerable: false
        });

        Object.defineProperty(Message.prototype, rxConsts.RELATIONAL_FIELDS.PARENT, {
            writable: true,
            enumerable: false
        });

        Object.defineProperty(ContactFolder.prototype, 'contact', {
            writable: true,
            enumerable: false
        });

        Object.defineProperty(Contact.prototype, 'relatedContactFolder', {
            writable: true,
            enumerable: false
        });
        // END OF PROPERTIES DEFINITION

        return {
            setRepos: setRepos,
            link: link,
            unlink: unlink,
            // unlinkParents: unlinkParents,
            // unlinkChildren: unlinkChildren,
            unlinkAllParents: unlinkAllParents,
            unlinkAllChildren: unlinkAllChildren,
            unlinkAll: unlinkAll,
            replaceParentLinks: replaceParentLinks,
            ContactDisplayName: ContactDisplayName,
            Contact: Contact,
            Folder: Folder,
            Conversation: Conversation,
            Thread: Thread,
            Message: Message,
            Attachment: Attachment
        };
    }
]);