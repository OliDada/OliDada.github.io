// src/orbitReturnButton.js
export function createOrbitReturnButton(onClick) {
  const orbitReturnBtn = document.createElement('button');
  orbitReturnBtn.textContent = 'Return to Orbit';
  orbitReturnBtn.style.position = 'fixed';
  orbitReturnBtn.style.left = '50%';
  orbitReturnBtn.style.bottom = '100px';
  orbitReturnBtn.style.transform = 'translateX(-50%)';
  orbitReturnBtn.style.zIndex = '1000';
  orbitReturnBtn.style.padding = '14px 36px';
  orbitReturnBtn.style.fontSize = '20px';
  orbitReturnBtn.style.display = 'none';
  orbitReturnBtn.style.background = 'linear-gradient(90deg, #232526 0%, #414345 100%)';
  orbitReturnBtn.style.color = '#FFD700';
  orbitReturnBtn.style.border = '2px solid #00BFFF';
  orbitReturnBtn.style.borderRadius = '24px';
  orbitReturnBtn.style.boxShadow = '0 0 16px 4px #00BFFF88, 0 0 4px 1px #FFD70088';
  orbitReturnBtn.style.letterSpacing = '1px';
  orbitReturnBtn.style.textShadow = '0 0 4px #FFD700, 0 0 1px #00BFFF';
  orbitReturnBtn.style.fontFamily = 'Orbitron, Arial, sans-serif';
  orbitReturnBtn.style.transition = 'background 0.3s, box-shadow 0.3s, color 0.3s';
  orbitReturnBtn.onmouseover = () => {
    orbitReturnBtn.style.background = 'linear-gradient(90deg, #606c88 0%, #3f4c6b 100%)';
    orbitReturnBtn.style.color = '#FFFFFF';
    orbitReturnBtn.style.boxShadow = '0 0 24px 8px #3f4c6b88, 0 0 8px 2px #FFD70088';
  };
  orbitReturnBtn.onmouseout = () => {
    orbitReturnBtn.style.background = 'linear-gradient(90deg, #232526 0%, #414345 100%)';
    orbitReturnBtn.style.color = '#FFD700';
    orbitReturnBtn.style.boxShadow = '0 0 16px 4px #00BFFF88, 0 0 4px 1px #FFD70088';
  };
  orbitReturnBtn.addEventListener('click', onClick);
  document.body.appendChild(orbitReturnBtn);
  return orbitReturnBtn;
}

export function updateOrbitReturnBtn(orbitReturnBtn, currentMode, surfacePitch) {
  if (currentMode === 'surface') {
    if (surfacePitch > Math.PI / 2 - 0.4) {
      orbitReturnBtn.style.display = 'block';
    } else {
      orbitReturnBtn.style.display = 'none';
    }
  } else {
    orbitReturnBtn.style.display = 'none';
  }
}
