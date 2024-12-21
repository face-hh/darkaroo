const browserAPI = chrome || browser;

browserAPI.runtime.onInstalled.addListener(() => {
    console.log("Extension installed and background script running.");
});

browserAPI.action.onClicked.addListener((tab) => {
    if (tab.id) {
        browserAPI.tabs.sendMessage(tab.id, { action: "toggleWebcam" });
    }
});
