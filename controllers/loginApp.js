/**
/* Create the redKixLogin module that depands on:
/* ngAnimate: For the sliding of the login error form
/* ngSanitize: For ngBindHtml to enable binding to login message with a bold email
 **/
//var redKixLogin = angular.module('redKix', ['appConfig', 'ngAnimate', 'ngSanitize', 'redKixServices', 'ngCookies']);

angular.module('redKix').controller('loginCtrl', ['$scope', 'appConfig', '$timeout', '$rxConfig', '$rxUtilities',
    function($scope, appConfig, $timeout, rxConfig, rxUtilities) {
        var rxConsts = rxConfig.consts;

        function onGoogleSuccess(googleUser) {
            if (googleUser.getBasicProfile) {
                console.log('Logged in as: ' + googleUser.getBasicProfile().getName());
            } else if (googleUser.code) {
                GoogleSignInCallback(googleUser);
            }
        }

        function onGoogleFailure(error) {
            console.log(error);
        }

        var SCOPES = 'https://www.googleapis.com/auth/gmail.labels https://mail.google.com/ https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly https://www.googleapis.com/auth/admin.directory.group.member.readonly profile email https://www.googleapis.com/auth/groups';

        function renderButton() {
            gapi.signin2.render('google-signin', {
                'scope': SCOPES,
                'width': 240,
                'height': 50,
                'longtitle': true,
                'theme': 'dark',
                'onsuccess': onGoogleSuccess,
                'onfailure': onGoogleFailure,
                'redirecturi': 'postmessage',
                'accesstype': 'offline'
            });
        };

        angular.element(document).ready(function() {
            cheet('shift g m a i l', renderButton)
        });

        function GoogleSignInCallback(authResult) {
            if (authResult['code']) {
                // Send the code to the server
                var params = {
                    code: authResult.code
                };
                var loginUrl = chosenConfig.server.main + '/OAuthLogin';

                $.ajax({
                    type: 'POST',
                    url: loginUrl,
                    processData: false,
                    contentType: 'application/json; charset=utf-8',
                    dataType: 'json',
                    xhrFields: {
                        withCredentials: false // cookie auth is disabled!
                    },
                    crossDomain: true,
                    success: function(response) {
                        loginSucceed(response);
                    },
                    data: JSON.stringify(params)
                });
            } else {
                // There was an error.
            }
        }

        if (window.forWrapper) {
            window.forWrapper.loggedIn = false;
        }

        // ---------------- User Vars ---------------- // 
        var chosenConfig = {};
        // ------------------- END ------------------- //

        // ------------ Function Handlers ------------ //
        function backToLoginHandler(accountDetailsForm) {
            $scope.showAccountDetails = false;
            // Restore the form state (reset pristine of inputs).
            accountDetailsForm.server.$setPristine();
            accountDetailsForm.userName.$setPristine();

            $scope.credentials.userName = '';
            $scope.credentials.server = '';
        }

        function loginHandler() {
            console.log('Chosen Config at login: ', chosenConfig);

            $scope.loginButtonBusy = true;

            var loginUrl = chosenConfig.server.main + '/login';

            // If it's a non rk user we don't allow him to login to nightly
            if (['nightly'].indexOf(chosenConfig.client.name) > -1 && $scope.credentials.email.indexOf('@redkix.com') === -1) {
                // Do something?
                console.error('This instance is blocked for non rk users');
                loginFailed({});
            } else {
                var serverURL = $scope.credentials.server,
                    userName = $scope.credentials.userName,
                    _data = {
                        emailAddress: $scope.credentials.email,
                        password: $scope.credentials.password,
                        server: serverURL || null,
                        // domain: $form.find('input[name="domain"]').val(),
                        userName: userName || null
                    },
                    options = {
                        type: "POST",
                        url: loginUrl,
                        data: JSON.stringify(_data),
                        contentType: "application/json; charset=utf-8",
                        crossDomain: true,
                        processData: false,
                        dataType: "json",
                        xhrFields: {
                            withCredentials: false // cookie auth is disabled!
                        },
                        timeout: 60000
                    };

                $.ajax(options).success(function(response) {
                    if (response.errorMessage) {
                        loginFailed(response);
                        $scope.$apply();
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
                        return;
                    }

                    loginSucceed(response);
                    $scope.$apply();

                }).error(function(response) {
                    loginFailed(response);
                    $scope.$apply();
                });
            }
        }

        function sendMessageToBackground(request, responseCallback) {
            if (responseCallback) {
                chrome.runtime.sendMessage(request, null, responseCallback);
            } else {
                chrome.runtime.sendMessage(request, null, function(a) {});
            }
        }

        function loginSucceed(response) {
            var cookieValue = response;

            if (chosenConfig.server.name === 'custom') {
                // if custom url, take url
                cookieValue.env = chosenConfig.server.main;
                cookieValue.altEnv = chosenConfig.server.alternate;
                cookieValue.rtEnv = chosenConfig.server.realtime;
            } else {
                // else take env name
                cookieValue.env = chosenConfig.server.name;
            }

            rxUtilities.setRxCookie(cookieValue);
            sendMessageToBackground({
                    operation: "rx-set-session-cookie",
                    cookieValue: cookieValue
                })
                //ignite();

            $scope.isLoggedOut = false;

            var companyExtract = /(?:@(.*))/g;

            if (response && response.mailBox.uid) {
                window.activeMailBoxAddress = response.mailBox.uid;
            }

            location.reload();
        }

        function loginFailed(response) {
            // should parse the error and display proper message
            // for now just showing a default failed message
            $scope.loginButtonBusy = false;

            $scope.errorBlink = true;

            setTimeout(function() {
                $scope.errorBlink = false;
            }, 1000);

            if (response.status === 401 || response.status === 404) {
                $scope.loginFailureMessage = 'We are having trouble finding the mail server for <b>' + $scope.credentials.email + '</b>. Please add the details manually below to add your account.';
                $scope.showAccountDetails = true;
                $scope.page.name = 'extraDetails';
            } else {
                $scope.loginFailureMessage = 'We are having trouble finding your account.';
            }

            $scope.$digest();
        }

        $scope.logout = function() {
                rxUtilities.removeRxCookie();
                sendMessageToBackground({
                    operation: "rx-logout",
                });

                $scope.isLoggedOut = true;
                document.location.reload();
            }
            // ------------------- END ------------------- //

        // ---------------- Scope Vars --------------- //
        $scope.page = {};
        $scope.page.name = localStorage.getItem('skipLoginFlow') ? 'login' : 'welcome';
        $scope.showAccountDetails = false;
        $scope.credentials = {
            server: '',
            userName: '',
            email: '',
            password: ''
        };
        $scope.isLoggedOut = true;
        $scope.backToLogin = backToLoginHandler;
        $scope.login = loginHandler;
        $scope.rememberFlow = function() {
                localStorage.setItem('skipLoginFlow', 'skipLoginFlow');
            }
            // ------------------- END ------------------- //

        // ------------- Local Functions ------------- //
        function ignite() {
            cheet.disable('shift e n v');
            //  no need to start the bootstrap yet
            //window.angular.bootstrap(document, ['redKix']);
        }

        function initialize() {
            if (appConfig) {
                initializeAppConfig(appConfig);
            }

            var rxCookie = rxUtilities.getRxCookie();

            if (rxCookie) {
                if (['nightly'].indexOf(chosenConfig.client.name) > -1 && rxCookie.mailBox.mailBoxAddress.indexOf('@redkix.com') === -1) {
                    rxUtilities.removeRxCookie();
                    rxCookie = null;
                }
            }

            if (rxCookie) {
                $scope.isLoggedOut = false;

                window.activeMailBoxAddress = rxCookie.mailBox.mailBoxAddress;

                $(document).ready(ignite);
                return;
            }

            showLogin();
        }

        function initializeAppConfig(appConfig) {
            // puts the config file's initial server as the chosen server
            chosenConfig.client = {
                name: appConfig.clientName
            };

            if (appConfig.initialServer) {
                chosenConfig.server = appConfig.initialServer;
            }

            // enable environment chooser if config file has the superUserAPIMapping field
            if (appConfig.superUserAPIMapping) {
                cheet('shift e n v', function() {
                    var envs = [],
                        i = 0,
                        promptStr = '';

                    for (var envName in appConfig.superUserAPIMapping) {
                        envs.push(envName);

                        promptStr += '\n [' + i + '] ' + envName;

                        i++;
                    };

                    var promptResponse = prompt('The default server space is: ' + chosenConfig.server.name + '\nChoose environment:' + promptStr);

                    if (promptResponse && (promptResponse.indexOf('http://') > -1 || promptResponse.indexOf('https://') > -1)) {
                        if (promptResponse[promptResponse.length - 1] === '/') {
                            promptResponse = promptResponse.substring(0, promptResponse.length - 1);
                        }

                        var alternatePromptResponse = prompt("Enter alternate server address: ", promptResponse);

                        chosenConfig.server = {
                            name: 'custom',
                            main: promptResponse,
                            alternate: alternatePromptResponse,
                            realtime: promptResponse.replace('clientapi', 'wsserver').concat(':80')
                        };

                        if (promptResponse.indexOf('clientapi') === -1) {
                            var realtimeAddress = prompt('Enter the realtime server address (with port!!!) : ');

                            if (realtimeAddress) {
                                if (realtimeAddress[realtimeAddress.length - 1] === '/') {
                                    realtimeAddress = realtimeAddress.substring(0, realtimeAddress.length - 1);
                                }

                                chosenConfig.server.realtime = realtimeAddress;
                            }
                        }
                    } else if (promptResponse !== '' && promptResponse !== null && promptResponse !== undefined && !isNaN(promptResponse)) {
                        chosenConfig.server = appConfig.superUserAPIMapping[envs[promptResponse]];
                    } else if (promptResponse) {
                        var customAPIURL = 'https://' + promptResponse + '-clientapi.redkix.com';

                        chosenConfig.server = {
                            name: 'custom',
                            main: customAPIURL,
                            alternate: customAPIURL,
                            realtime: customAPIURL.replace('clientapi', 'wsserver').concat(':443')
                        };
                    } else {
                        console.error('bad input! follow instructions! ;)');
                    }
                });
            } else {
                // this is production env, send ga data...
                (function(i, s, o, g, r, a, m) {
                    i['GoogleAnalyticsObject'] = r;
                    i[r] = i[r] || function() {

                        (i[r].q = i[r].q || []).push(arguments)
                    }, i[r].l = 1 * new Date();
                    a = s.createElement(o),

                        m = s.getElementsByTagName(o)[0];
                    a.async = 1;
                    a.src = g;
                    m.parentNode.insertBefore(a, m)

                })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

                ga('create', 'UA-68470304-1', 'auto');

                ga('send', 'pageview');
            }
        }

        function showLogin() {
            $scope.showAccountDetails = false;
        }
        // ------------------- END ------------------- //

        // ---------- Controller Initializers -------- // 
        initialize();
        // ------------------- END ------------------- //
    }
]);