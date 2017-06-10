// RedKix configuration service
'use strict';


angular.module('redKixServices').service('$rxConfig',
    function() {
        this.consts = {};

        this.consts.RX_COOKIE = {
            NAME: 'rxCookie',
            // Set cookie to be valid for 3 years (until the EXIT \ IPO \ logout \ server deletes db)            
            DAYS_OF_LIFE: 365 * 3
        };

        /**
         * Map of primary key fields of each entity for storing it in the database
         * @const
         */
        this.consts.ENTITY_PRIMARY_KEYS = {
            CONTACT: ['uid'],
            CONTACT_DISPLAY_NAME: ['uid', 'conversationUID'],
            FILE: ['uid'],
            FOLDER: ['uid'],
            CONVERSATION: ['uid', 'folderUID'],
            THREAD: ['uid'],
            MESSAGE: ['uid']
        };

        /**
         * Map of relational fields consts
         * @const
         */
        this.consts.RELATIONAL_FIELDS = {
            PARENT: "parents",
            CHILD: "children"
        };
        /**
         * Map of contact type consts
         * @const
         */
        this.consts.CONTACT_TYPE = {
            PERSON: "PERSON",
            GROUP: "GROUP",
            UNKNOWN: "UNKNOWN"
        };
        /**
         * Map of contact status consts
         * @const
         */
        this.consts.CONTACT_STATUS = {
            UNKNOWN: "unknown",
            ACTIVE: "active",
            NOT_ACTIVE: "notActive"
        };
        /**
         * Map of entity type consts
         * @const
         */
        this.consts.ENTITY_TYPE = {
            CONVERSATION: "Conversation",
            THREAD: "Thread",
            MESSAGE: "Message",
            FOLDER: "Folder",
            GROUP: "OrganizationContact",
            USER: "OrganizationContact",
            FILE: "File"
        };
        /**
         * Map of sent state consts
         * @const
         */
        this.consts.SENT_STATE = {
            SENT: 'SENT',
            PENDING: 'PENDING',
            FAILED: 'FAILED'
        };
        /**
         * Map of flow type consts
         * @const
         */
        this.consts.FLOW_TYPE = {
            REPLY_ALL: "none",
            REPLY_ONE: "reply_one",
            FORWARD: "forward",
            NEW_DISCUSSION: "new_discussion"
        };
        /**
         * Map of folder types
         * @const
         */
        this.consts.FOLDER_TYPE = {
            INBOX: "INBOX",
            GENERAL: "GENERAL",
            PERSON: "PERSON",
            GROUP: "GROUP",
            SENT_ITEMS: "SENT",
            ARCHIVE: "ARCHIVE",
            DELETED_ITEMS: "DELETED_ITEMS",
            JUNK_EMAIL: "JUNK_EMAIL",
            CHAT: "CHAT",
            STARRED: "STARRED",
            IMPORTANT: "IMPORTANT",
            SEARCH: "SEARCH",
            DRAFTS: "DRAFTS",
            OUTBOX: "OUTBOX"
        };

        this.consts.MXP_VIEWED_PROFILE_TYPE = {
            PERSON: "1-1 chat",
            GROUP: "Group"
        };

        /**
         * Map of lose data types
         * @const
         */
        this.consts.LOSE_DATA_TYPE = {
            UNSENT_MSGS: 0,
            NEW_MSG: 1
        };

        /**
         * The time gap that we check before fetching items again (in minutes) per task
         * @const
         */
        this.consts.FETCH_TASK_TIME_GAP = {
            CONVERSATION_AND_THREADS: 180,
            MESSAGES: 180
        };

        /**
         * The fetch chunk size per task (for instance - max messages count to fetch in one request when fetching messages by specifying threadUIDs)
         * @const
         */
        this.consts.FETCH_TASK_CHUNK_SIZE = {
            // Number of conversationUIDs to fetch
            CONVERSATION_AND_THREADS: 20,
            // Number of messages to fetch
            MESSAGES: 5
        };

        /**
         * The fetch task exeuction delay by type
         * @const
         */
        this.consts.FETCH_TASK_EXECUTION_DELAY = {
            CONVERSATION_AND_THREADS: 1000,
            MESSAGES: 500
        };

        /**
         * High priority folder types for fetch
         * @const
         */
        this.consts.PRIORITY_FOLDER_TYPES_FOR_FETCH = ['INBOX', 'SENT'];

        /**
         * Time interval (in seconds) before fetching background starts when not busy
         * @const
         */
        this.consts.BACKGROUND_FETCH_START_DELAY = 30;
        /**
         * The prefetch task types
         * We use strings
         * @const
         */
        this.consts.PREFETCH_TASK_TYPE = {
            GENERIC: "GENERIC",
            CONVERSATION_AND_THREADS: "CONVERSATION_AND_THREADS",
            MESSAGES: "MESSAGES",
            GROUP_MEMBERS: "GROUP_MEMBERS"
        };

        this.consts.MAILBOX_INITIALIZATION_STATUS = {
            UNINITIALIZED: "UNINITIALIZED",
            INITIALIZED: "INITIALIZED"
        }

        this.consts.SEARCH_FOLDER_UID = '11111111-1111-1111-1111-111111111111';
        this.consts.SEARCH_FOLDER_TYPE = "SEARCH";
        /**
         * Map that converts server string of contact presence status to the way we use it
         * We use strings
         * @const
         */
        this.consts.SERVER_STRING_TO_CONTACT_PERSENCE_STATUS = {
            "unknown": this.consts.CONTACT_STATUS.UNKNOWN,
            "active": this.consts.CONTACT_STATUS.ACTIVE,
            "notActive": this.consts.CONTACT_STATUS.NOT_ACTIVE
        };
        this.iframelyKey = "a4c73b87b2a4704602e4ec";
        this.iframelyApiCall = function(url) {
            return "https://iframe.ly/api/iframely?url=" + encodeURI(url) + "&api_key=" + this.iframelyKey;
        };
    });