var navigatorConfig = {
    // Qlik Sense Application bindings
    QS: {
        default: {
            appId: `44bbc661-afbf-4e27-b7e9-3fed7bfcb234`,
            sheetId: `7b6d255b-eec5-4217-bce6-071ec5ef3c94`
        },
        selection: {
            appId: `7e65953a-585d-4636-af0a-e18b53f5fe98`,
            sheetId: `317a70ad-334f-4e1b-9758-6a91e4982e70`
        },
        template: {
            /* Optional
               When creating an ODAG Link, you have to specify an "Default view when opened"
               ("Представление при открытии по умолчанию") option. It will be used to load generated application.
               If that option were not specified, will try to use the next value from this config.
             */
            sheetId: ``
        }
    },
    // Static report list (for the left-menu)
    staticReportList: [
        {
            title: `Основной отчёт 1`,
            description: `Можно добавить описание`,
            appId: `590b6bb6-6bb2-4166-b314-53e813308601`,
            sheetId: `3963fc3b-bba2-45de-9a4b-8b3e4a81e28e`
        },
        {
            title: `Основной отчёт 2`,
            description: ``,
            appId: `b419597d-c113-4368-98b0-aa6dd160ca68`,
            sheetId: `3963fc3b-bba2-45de-9a4b-8b3e4a81e28e`

        },
        {
            title: `Основной отчёт 3`,
            description: ``,
            appId: `5045b160-462b-47eb-a209-acc9338a9509`,
            sheetId: `ec9c6b5f-b8a9-44e3-8ca7-a9f4a297de40`
        }
    ],
    fixIFrameSheetHeight: true, // Make expanded sheets full-height
    clearSelectionsFor: {
        // Clear selections before load to the Iframe:
        "default": false, // Default application
        "select": false, // Selection application
        "result": false, // Generated application
        "result-static": false // Application from staticReportList
    }
};