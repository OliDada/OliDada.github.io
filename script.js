const originalBackground = "images/1.jpg";

function changeBackgroundColor() {
    const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16);

    document.body.style.backgroundColor = randomColor;
    document.body.style.backgroundImage = 'none'; // Remove the image
}


function revertToOriginalBackground() {
    document.body.style.backgroundColor = ""; // Remove the color
    document.body.style.backgroundImage = `url('${originalBackground}')`;
}