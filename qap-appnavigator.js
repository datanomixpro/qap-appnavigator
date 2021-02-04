const $iframeMain = $(`#iframeMain`);
const $staticReportList = $(`#staticReportList`);
const $lastReportList = $(`#lastReportList`);
const $currentSheetTitle = $(`#currentSheetTitle`);
const $breadcrumb = $(`#breadcrumb`);
let currentState = `default`;/* default, select, result-static, result */
let currentSheetId;

function getRandomInt() {
    return  Math.floor(Math.random()*900000) + 100000;
}

/* =========== Standard Mashup Configuration ============*/
const prefix = window.location.pathname.substr( 0, window.location.pathname.toLowerCase().lastIndexOf( "/extensions" ) + 1 );
const connectionConfig = {
    host: window.location.hostname,
    prefix: prefix,
    port: window.location.port,
    isSecure: window.location.protocol === "https:"
};
require.config( {
    baseUrl: ( connectionConfig.isSecure ? "https://" : "http://" ) + connectionConfig.host + (connectionConfig.port ? ":" + connectionConfig.port : "") + connectionConfig.prefix + "resources"
} );

require( ["js/qlik"], function ( qlik ) {
    const selectionApp = qlik.openApp(navigatorConfig.QS.selection.appId, connectionConfig);

    createStaticReportList();
    createLastReportList();
    loadDefaultApp();

    $(`#btnNewReport`).on(`click`, function() {
        loadSelectionApp();
    });

    $(document).on(`click`, ".report-list .list-item", function() {
        const appId = $(this).attr("data-appId");
        const sheetId = $(this).attr("data-sheetId");
        const isStaticResult = $(this).hasClass("result-static");
        currentState = isStaticResult ? `result-static` : `result`;
        loadSheetToIframe(appId, sheetId, $iframeMain);
    });

    $(document).on(`click`, `.logo-link`, function() {
        return loadDefaultApp();
    });

    $(document).on(`click`, `.breadcrumb-link`, function() {
        const target = $(this).attr(`data-link`);
        switch(target) {
            case `default`:
                return loadDefaultApp();
            case `select`:
                return loadSelectionApp();
            default:
                break;
        }
    });

    /* ======== Click Generate new app handler  =========*/
    /*  Will wait for all requests for the link to complete, then update last reports */
    function checkIfExistsPendingRequest(linkId) {
        const ODAGurl = `${window.location.protocol}//${connectionConfig.host}${connectionConfig.port ? ":" + connectionConfig.port : "" }${connectionConfig.prefix}api/odag/v1`;
        return ajaxCall({
            method: "get",
            url: `${ODAGurl}/links/${linkId}/requests?Xrfkey=12345678qwertyui&selectionAppId=${navigatorConfig.QS.selection.appId}&selectionAppSheet=${navigatorConfig.QS.selection.sheetId}`,
            headers: {
                "x-Qlik-XrfKey": "12345678qwertyui"
            }
        })
            .then(requests => {
                let isPendingRequest = false;

                for (let i = 0; i < requests.length; i++) {
                    const request = requests[i];
                    if (request.state === `queued` || request.state === `validating` || request.state === `loading`) {
                        isPendingRequest = true;
                        break;
                    }
                }
                return isPendingRequest;
            })
    };

    async function waitForRequestsComplete(callback, count = 0, clickedLinkId) {
        if (count > 30) {
            return callback('timeout');
            console.log('pending request timeout');
        }
        count++;
        let isPendingRequest = false;
        try {
            isPendingRequest = await checkIfExistsPendingRequest(clickedLinkId);
        } catch (error) {
            return callback(false);
        }

        if (isPendingRequest) {
            return setTimeout(() => {
                waitForRequestsComplete(callback, count, clickedLinkId);
            }, 500);
        }

        return callback(false);
    }

    $(document).on(`mouseup`, `button[tid="odag-toolbar-navpoint-popover_generate_app_button"]`, function() {
        // Get clicked link ID
        const clickedLinkId = angular.element(this).scope().$parent.$parent.$parent.item.data.odagLinkRefID;
        setTimeout(() => {
            waitForRequestsComplete(function() {
                createLastReportList();
            }, 0, clickedLinkId);
        }, 5000);
    });
    /* ======== END: Click Generate new app handler  =========*/

    function loadSheetToIframe(appId, sheetId, iFrame, opts = "currsel%2Cctxmenu") {
        // Set current Sheet ID
        currentSheetId = sheetId;

        // Set default iFrame height
        $iframeMain.css(`height`, "100%");

        // When click on left links or "Generate new button"
        // Hide linkNavigator and remove Iframe listeners
        $(`#linkNavigator`).html(``);

        updateBreadCrumbs(`Загрузка`);
        updateSheetNameAndBreadCrumbsFromApp(appId, sheetId);

        let clearSelection = "";
        if (navigatorConfig.clearSelectionsFor && navigatorConfig.clearSelectionsFor[currentState] === true) {
            clearSelection = "&select=clearall";
        }

        const url = (connectionConfig.isSecure ? "https://" : "http://" ) + connectionConfig.host + (connectionConfig.port ? ":" + connectionConfig.port : "" ) + connectionConfig.prefix + "single/" + `?appid=${appId}&sheet=${sheetId}&opt=${opts}${clearSelection}`;
        iFrame.attr("src", url);
    }

    function updateBreadCrumbs(name = "") {
        const defaultElement = `<li class="breadcrumb-item text-muted">
                                    <a class="text-muted breadcrumb-link" data-link="default">Основные показатели</a>
                                </li>`;
        const selectElement = `<li class="breadcrumb-item text-muted">
                                    <a class="text-muted breadcrumb-link" data-link="select">Конструктор отчетов</a>
                                </li>`;
        const resultElement = `<li class="breadcrumb-item text-muted">
                                    <a  class="text-muted">${name}</a>
                                </li>`;
        switch (currentState) {
            case `default`:
                $breadcrumb.html(defaultElement);
                break;
            case `result-static`:
                $breadcrumb.html(defaultElement + resultElement);
                break;
            case `select`:
                $breadcrumb.html(defaultElement + selectElement);
                break;
            case `result`:
                $breadcrumb.html(defaultElement + selectElement + resultElement);
                break;
        }
    }

    function updateSheetNameAndBreadCrumbsFromApp(appId, sheetId) {
        function closeAppIfNotSelection(appToClose) {
            if (appId !== navigatorConfig.QS.selection.appId) {
                //TODO: Close app only if it was opened manually
                //appToClose.close();
            }
        }

        $currentSheetTitle.text("Загрузка...");
        let qlikApp;
        if (appId === navigatorConfig.QS.selection.appId) {
            qlikApp = selectionApp;
        } else {
            qlikApp = qlik.openApp(appId, connectionConfig);
        }

        qlikApp.getAppLayout(layout => {
            // If sheet was changed due this request fetching
            if (sheetId !== currentSheetId) {
                return;
            }
            updateBreadCrumbs(layout.qTitle || `Нет названия`);
        });

        qlikApp.getAppObjectList(`sheet`, response => {
            // If sheet was changed due this request fetching
            if (sheetId !== currentSheetId) {
                return;
            }
            const sheets = response.qAppObjectList.qItems;
            if (!sheets || !sheets.length) {
                closeAppIfNotSelection(qlikApp);
                return $currentSheetTitle.text("Нет листов");
            }
            const list = sheets.find(list => list.qInfo.qId === sheetId);
            if (!list) {
                closeAppIfNotSelection(qlikApp);
                return $currentSheetTitle.text("Лист не найден");
            }

            closeAppIfNotSelection(qlikApp);
            $currentSheetTitle.text(list.qMeta.title);
        });
    }

    function loadSelectionApp() {
        currentState = `select`;
        //updateBreadCrumbs(`select`);
        loadSheetToIframe(navigatorConfig.QS.selection.appId, navigatorConfig.QS.selection.sheetId, $iframeMain);
        selectionApp.getObject("linkNavigator", "AppNavigationBar", {
            sheetId: navigatorConfig.QS.selection.sheetId,
            openAppCallback: function (appId, targetSheetId) {
                createLastReportList();
                targetSheetId = targetSheetId || navigatorConfig.QS.template.sheetId;
                if (!targetSheetId) {
                   return alert('Template Target Sheet ID is not specified');
                }
                currentState = `result`;
                loadSheetToIframe(appId, targetSheetId, $iframeMain);
            }
        });
    }

    function loadDefaultApp() {
        currentState = `default`;
        loadSheetToIframe(navigatorConfig.QS.default.appId, navigatorConfig.QS.default.sheetId, $iframeMain);

        if (!navigatorConfig.fixIFrameSheetHeight) {
            return;
        }
        $iframeMain[0].onload = function () {
            const iFrameDocument = $iframeMain[0].contentWindow.document;
            // set up the mutation observer
            const observer = new MutationObserver(function (mutations, me) {
                // `mutations` is an array of mutations that occurred
                // `me` is the MutationObserver instance
                const readySheet = iFrameDocument.getElementsByClassName("qvt-sheet");
                if (readySheet.length > 0) {
                    const qvtSheet = iFrameDocument.getElementsByClassName("qvt-sheet")[0];
                    const sheetCssHeight = qvtSheet.style.height;
                    if (sheetCssHeight === "100%") {
                        return;
                    }
                    const sheetFullHeight = qvtSheet.scrollHeight;
                    const additionalHeight = sheetFullHeight / 10; // Add 1/10 of the height Fix
                    iFrameDocument.getElementsByClassName("qvt-sheet")[0].style.height = "100%";
                    $iframeMain.css(`height`, sheetFullHeight + additionalHeight + "px");
                    me.disconnect(); // stop observing
                    return;
                }
            });

            // start observing
            observer.observe(iFrameDocument, {
                childList: true,
                subtree: true
            });
        };
    }

    function createStaticReportList() {
        navigatorConfig.staticReportList.forEach(report => {
            let description = "";
            if (report.description && report.description.trim().length) {
                description = `<a class="text-muted text-hover-primary font-weight-bold">${report.description}</a>`;
            }
            $staticReportList.append(
                `<div class="list-item result-static hoverable p-2 p-lg-3 mb-2" data-appId="${report.appId}" data-sheetId="${report.sheetId}">
                    <div class="d-flex align-items-center">
                        <div class="d-flex flex-column flex-grow-1 mr-2">
                            <span class="text-dark-75 font-size-h8 mb-0">${report.title}</span>
                            ${description}
                        </div>
                    </div>
                </div>`);
        });
    }

    function ajaxCall(data) {
        return new Promise((resolve, reject) => {
            const requestId = getRandomInt();
            data.success = function(result) {
                console.log(`Ajax success [${requestId}]`, result);
                return resolve(result);
            };
            data.error = function(jqXHR, status, thrown) {
                console.log(`Ajax error [${requestId}]`, jqXHR);
                return reject(jqXHR);
            };
            data.contentType= "application/json";

            if (typeof data.data === "object" && data.method === "post") {
                data.data = JSON.stringify(data.data);
            }
            console.log(`Ajax [${requestId}]`, data);
            $.ajax(data);
        });
    }

    function getLastOdagRequestsForLink(linkId) {
        const ODAGurl = `${window.location.protocol}//${connectionConfig.host}${connectionConfig.port ? ":" + connectionConfig.port : "" }${connectionConfig.prefix}api/odag/v1`;
        return ajaxCall({
            method: "get",
            url: `${ODAGurl}/links/${linkId}/requests?Xrfkey=12345678qwertyui&selectionAppId=${navigatorConfig.QS.selection.appId}&selectionAppSheet=${navigatorConfig.QS.selection.sheetId}`,
            headers: {
                "x-Qlik-XrfKey": "12345678qwertyui"
            }
        })
            .then(requests => {
                let topRequest = null;
                requests.forEach(request => {
                    if (request.state !== "succeeded" || !request.targetSheet) {
                        return;
                    }
                    let finishedDate = new Date(request.loadState ? request.loadState.finishedAt : undefined);

                    if (!finishedDate || finishedDate.toString() === "Invalid Date") {
                        return;
                    }

                    if (!topRequest) {
                        return topRequest = request;
                    }

                    const currentFinishedDate = new Date(topRequest.loadState.finishedAt);

                    if (finishedDate > currentFinishedDate) {
                        return topRequest = request;
                    }
                });
                return topRequest;
            })
    }

    function createLastReportList() {
        $lastReportList.html(``);
        selectionApp.getObjectProperties(navigatorConfig.QS.selection.sheetId)
            .then(sheetProperties => {
                return sheetProperties.getNavPoints();
            })
            .then(navPoints => {
                if (!navPoints || !navPoints.length) {
                    return;
                }

                return Promise.all(navPoints.map(navPoint => {
                    const linkId = navPoint.odagLinkRefID;
                    return getLastOdagRequestsForLink(linkId)
                        .catch(error => {
                            showError(error.responseText);
                            console.log(error);
                            return Promise.resolve();
                        })
                }));
            })
            .then(requests => {
                // Remove null values and sort by finished Date
                requests.filter(request => request)
                    .sort((a, b) => {
                        const aDate = new Date(a.loadState.finishedAt);
                        const bDate = new Date(b.loadState.finishedAt);
                        return bDate - aDate;
                    })
                    .forEach(request => {
                        const generatedAppId = request.generatedApp.id;
                        const generatedSheetId = request.targetSheet;
                        const templateAppName = request.link.templateApp.name;
                        const requestDate = new Date(request.loadState.finishedAt).toLocaleString();
                        $lastReportList.append(`<div class="list-item hoverable p-2 p-lg-3 mb-2" data-appId="${generatedAppId}" data-sheetId="${generatedSheetId}">
                                                    <div class="d-flex align-items-center">
                                                        <div class="d-flex flex-column flex-grow-1 mr-2">
                                                            <span class="text-dark-75 font-size-h8 mb-0">${templateAppName}</span>
                                                            <a class="text-muted text-hover-primary font-weight-bold">${requestDate}</a>
                                                        </div>
                                                    </div>
                                                </div>`);
                    });
            })

    }

    function showError(error) {
        $( '#popupText' ).html( error);
        $( '#alert-error').fadeIn( 1000 );
    }

    $( "#closePopup" ).click( function () {
        $( '#alert-error' ).hide();
    } );

    qlik.on( "error", function ( error ) {
        showError(error.message);
    });
});

