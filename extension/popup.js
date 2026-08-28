const saveButton = document.getElementById("saveButton");

saveButton.addEventListener("click", function () {
    console.log("Save button clicked!");
});


document
    .getElementById("saveButton")
    .addEventListener("click", async () => {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        chrome.tabs.sendMessage(
            tab.id,
            {action: "extractProduct"},
            (response) => {
                console.log(response);
            }
        );
    });