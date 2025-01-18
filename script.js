const originalBackground = "images/1.jpg";

// Function to change the background to a random color
function changeBackgroundColor() {
    // Generate a random color
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    // Set the new background color (image will be replaced)
    document.body.style.backgroundColor = randomColor;
    document.body.style.backgroundImage = ""; // Remove the image
}

// Function to revert to the original background image
function revertToOriginalBackground() {
    // Revert to the original background image
    document.body.style.backgroundColor = ""; // Remove the color
    document.body.style.backgroundImage = `url('${originalBackground}')`;
}