(function(){
'use strict';
const start=document.querySelector('#start'),toggle=document.querySelector('#controlsToggle'),controls=document.querySelector('#menuControls'),back=document.querySelector('#controlsBack');
function show(on){controls.hidden=!on;toggle.setAttribute('aria-expanded',String(on));(on?back:toggle).focus();}
toggle.addEventListener('click',()=>show(controls.hidden));back.addEventListener('click',()=>show(false));
start.addEventListener('keydown',e=>{if(e.code==='Escape'&&!controls.hidden){e.preventDefault();show(false);return;}if(!controls.hidden)return;if(e.code!=='ArrowDown'&&e.code!=='ArrowUp')return;e.preventDefault();const buttons=[...start.querySelectorAll('.menu-options button')];const i=buttons.indexOf(document.activeElement);buttons[(i+(e.code==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();});
document.querySelector('#go').focus({preventScroll:true});
})();
