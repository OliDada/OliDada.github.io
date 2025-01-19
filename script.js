const originalBackground = "images/1.jpg";

function changeBackgroundColor() {
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    // Set the random color as the background and remove the image
    document.body.style.backgroundColor = randomColor;
    document.body.style.backgroundImage = "none";

    // Save the new background settings to localStorage
    localStorage.setItem("backgroundColor", randomColor);
    localStorage.setItem("backgroundImage", "none");
}

function revertToOriginalBackground() {
    // Reset to the original background image
    document.body.style.backgroundColor = ""; // Clear any set background color
    document.body.style.backgroundImage = `url('${originalBackground}')`;

    // Save the original background settings to localStorage
    localStorage.setItem("backgroundColor", "");
    localStorage.setItem("backgroundImage", `url('${originalBackground}')`);
}

function applySavedBackground() {
    // Retrieve saved background settings from localStorage
    const savedColor = localStorage.getItem("backgroundColor");
    const savedImage = localStorage.getItem("backgroundImage");

    // Apply the saved background, or default to the original
    document.body.style.backgroundColor = savedColor || "";
    document.body.style.backgroundImage = savedImage || `url('${originalBackground}')`;
}

// Apply the saved background when the page loads
applySavedBackground();


