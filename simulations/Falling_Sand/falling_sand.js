// Falling sand simulation — refactored with ParticleSim class

function make2DArray(cols, rows) {
    let arr = new Array(cols);
    for (let i = 0; i < cols; i++) {
        arr[i] = new Array(rows);
        for (let j = 0; j < rows; j++) arr[i][j] = 0;
    }
    return arr;
}

let w = 3;
let sandA, sandB, colorCycle;
let currentBrush = 'sand';
let sandBtn, waterBtn, fireBtn;
let sim; // ParticleSim instance

class ParticleSim {
    constructor(cellSize, canvasW, canvasH) {
        this.w = cellSize;
        this.cols = floor(canvasW / this.w);
        this.rows = floor(canvasH / this.w);
        this.type = make2DArray(this.cols, this.rows); // 0 empty,1 sand,2 water
        this.seed = make2DArray(this.cols, this.rows);
        this.varGrid = make2DArray(this.cols, this.rows);
        this.hue = make2DArray(this.cols, this.rows);
        this.sat = make2DArray(this.cols, this.rows);
        this.bri = make2DArray(this.cols, this.rows);
        this.phase = make2DArray(this.cols, this.rows);
    }

    inBounds(x,y){ return x>=0 && x<this.cols && y>=0 && y<this.rows; }

    setCircleAt(px, py, radiusCells = 3, probability = 0.6, type = 'sand'){
        const cx = floor(px/this.w), cy = floor(py/this.w), r = radiusCells;
        for(let dx=-r; dx<=r; dx++){
            for(let dy=-r; dy<=r; dy++){
                const x=cx+dx, y=cy+dy;
                if(!this.inBounds(x,y)) continue;
                const baseDist = Math.sqrt(dx*dx+dy*dy);
                const jitterDist = baseDist + (random()-0.5)*0.4;
                if(jitterDist>r) continue;
                const falloff = 1 - (jitterDist/(r+0.0001));
                const localProb = probability * (0.5 + 0.5*falloff);
                if(random() < localProb){
                    let nx = x + floor(random(-1,2));
                    let ny = y + floor(random(-1,2));
                    if(nx<0) nx=0; if(nx>=this.cols) nx=this.cols-1;
                    if(ny<0) ny=0; if(ny>=this.rows) ny=this.rows-1;
                    
                    // ADD NEW PARTICLES HERE
                    if(type === 'sand'){
                        this.type[nx][ny] = 1;
                        this.seed[nx][ny] = ((frameCount + random()*5) % colorCycle) / colorCycle;
                        this.varGrid[nx][ny] = (random()-0.5)*0.32;
                    } else if(type === 'water'){
                        this.type[nx][ny] = 2;
                        const baseHue = (window._waterHueBase != null) ? window._waterHueBase : 200;
                        const hueRange = (window._waterHueRange != null) ? window._waterHueRange : 6;
                        const satBase = (window._waterSat != null) ? window._waterSat : 80;
                        const briBase = (window._waterBri != null) ? window._waterBri : 90;
                        // per-particle base color and phase
                        this.hue[nx][ny] = constrain(baseHue + random(-hueRange,hueRange), 0, 360);
                        this.sat[nx][ny] = constrain(satBase + random(-8,8), 0, 100);
                        this.bri[nx][ny] = constrain(briBase + random(-6,6), 0, 100);
                        this.phase[nx][ny] = random();
                        this.seed[nx][ny] = 0;
                        this.varGrid[nx][ny] = 0;
                    } else if(type === 'fire'){
                        // Example for fire particle (not implemented in step logic)
                        this.type[nx][ny] = 3; // let's say 3 represents fire
                        this.seed[nx][ny] = random(); // could be used for animation phase
                        this.varGrid[nx][ny] = random(); // could be used for size or brightness variation  
                    }
                }
            }
        }
    }

    step(){
        // allocate next grids
        const nextType = make2DArray(this.cols,this.rows);
        const nextSeed = make2DArray(this.cols,this.rows);
        const nextVar  = make2DArray(this.cols,this.rows);
        const nextHue  = make2DArray(this.cols,this.rows);
        const nextSat  = make2DArray(this.cols,this.rows);
        const nextBri  = make2DArray(this.cols,this.rows);
        const nextPhase= make2DArray(this.cols,this.rows);

        for(let j=this.rows-1;j>=0;j--){
            let colsOrder = [...Array(this.cols).keys()];
            if(random()<0.5) colsOrder.reverse();
            for(let ii=0; ii<colsOrder.length; ii++){
                let i = colsOrder[ii];
                const t = this.type[i][j];

                // ADD PARTICLE UPDATE LOGIC HERE
                if(t===0) continue;

                if(t===1){ // sand
                    if(j < this.rows-1){
                        if(this.type[i][j+1]===0 && nextType[i][j+1]===0){
                            nextType[i][j+1]=1; nextSeed[i][j+1]=this.seed[i][j]; nextVar[i][j+1]=this.varGrid[i][j];
                        } else {
                            const leftEmpty = (i>0 && this.type[i-1][j+1]===0 && nextType[i-1][j+1]===0);
                            const rightEmpty= (i<this.cols-1 && this.type[i+1][j+1]===0 && nextType[i+1][j+1]===0);
                            if(leftEmpty && rightEmpty){ if(random()<0.5){ nextType[i-1][j+1]=1; nextSeed[i-1][j+1]=this.seed[i][j]; nextVar[i-1][j+1]=this.varGrid[i][j]; } else { nextType[i+1][j+1]=1; nextSeed[i+1][j+1]=this.seed[i][j]; nextVar[i+1][j+1]=this.varGrid[i][j]; } }
                            else if(leftEmpty){ nextType[i-1][j+1]=1; nextSeed[i-1][j+1]=this.seed[i][j]; nextVar[i-1][j+1]=this.varGrid[i][j]; }
                            else if(rightEmpty){ nextType[i+1][j+1]=1; nextSeed[i+1][j+1]=this.seed[i][j]; nextVar[i+1][j+1]=this.varGrid[i][j]; }
                            else { if(nextType[i][j]===0){ nextType[i][j]=1; nextSeed[i][j]=this.seed[i][j]; nextVar[i][j]=this.varGrid[i][j]; } }
                        }
                    } else { if(nextType[i][j]===0){ nextType[i][j]=1; nextSeed[i][j]=this.seed[i][j]; nextVar[i][j]=this.varGrid[i][j]; } }
                } else if(t===2){ // water
                    let moved = false;
                    const copy = (sx,sy,tx,ty)=>{ nextHue[tx][ty]=this.hue[sx][sy]; nextSat[tx][ty]=this.sat[sx][sy]; nextBri[tx][ty]=this.bri[sx][sy]; nextPhase[tx][ty]=this.phase[sx][sy]; };
                    if(j < this.rows-1 && this.type[i][j+1]===0 && nextType[i][j+1]===0){ nextType[i][j+1]=2; copy(i,j,i,j+1); moved=true; }
                    else {
                        let dirs = (random()<0.5)?[-1,1]:[1,-1];
                        for(let d of dirs){ let ni=i+d; if(ni<0||ni>=this.cols) continue; if(j < this.rows-1 && this.type[ni][j+1]===0 && nextType[ni][j+1]===0){ nextType[ni][j+1]=2; copy(i,j,ni,j+1); moved=true; break;} if(this.type[ni][j]===0 && nextType[ni][j]===0){ nextType[ni][j]=2; copy(i,j,ni,j); moved=true; break;} }
                    }
                    if(!moved && nextType[i][j]===0){ nextType[i][j]=2; nextHue[i][j]=this.hue[i][j]; nextSat[i][j]=this.sat[i][j]; nextBri[i][j]=this.bri[i][j]; nextPhase[i][j]=this.phase[i][j]; }
                } else if(t===3){ // fire (not implemented in rendering or spawning logic yet)
                    // Example logic for fire particle (could rise up and then disappear)
                    if(j > 0 && this.type[i][j-1]===0 && nextType[i][j-1]===0){ nextType[i][j-1]=3; nextSeed[i][j-1]=this.seed[i][j]; nextVar[i][j-1]=this.varGrid[i][j]; }
                    else if(nextType[i][j]===0){ nextType[i][j]=3; nextSeed[i][j]=this.seed[i][j]; nextVar[i][j]=this.varGrid[i][j]; }
                }
            }
        }

        // commit
        this.type = nextType; this.seed = nextSeed; this.varGrid = nextVar;
        this.hue = nextHue; this.sat = nextSat; this.bri = nextBri; this.phase = nextPhase;
    }

    render(){
        noStroke();
        const t = (frameCount % colorCycle)/colorCycle;
        for(let i=0;i<this.cols;i++){
            for(let j=0;j<this.rows;j++){
                const p = this.type[i][j];

                // ADD RENDERING LOGIC HERE
                if(p===1){
                    // smooth time-based cycle between sandA and sandB with per-particle phase offset
                    const globalT = (frameCount % colorCycle) / colorCycle;
                    const seed = (this.seed[i][j] != null) ? this.seed[i][j] : 0.5;
                    const phase = (seed + globalT) % 1;
                    const triangle = 1 - Math.abs(2 * phase - 1); // back-and-forth wave
                    const jitter = (noise(i*0.05, j*0.05) - 0.5) * 0.06 + (this.varGrid[i][j] || 0) * 0.02;
                    // blend triangle with seed slightly to avoid perfectly uniform bands
                    const mix = constrain(triangle * 0.9 + seed * 0.1 + jitter, 0, 1);
                    const c = lerpColor(sandA, sandB, mix);
                    fill(c); rect(i * this.w, j * this.w, this.w, this.w);
                } else if(p===2){
                    const baseHue = (this.hue[i][j] != null) ? this.hue[i][j] : (window._waterHueBase || 200);
                    const baseSat = (this.sat[i][j] != null) ? this.sat[i][j] : (window._waterSat || 80);
                    const baseBri = (this.bri[i][j] != null) ? this.bri[i][j] : (window._waterBri || 90);
                    const ph = (this.phase[i][j] != null) ? this.phase[i][j] : 0;
                    const speed = 0.02; const hueAmp = (window._waterHueRange || 6) * 0.6; const briAmp = 3;
                    const timePhase = frameCount * speed + ph;
                    const shimmer = Math.sin(TWO_PI * timePhase);
                    const hue = constrain(baseHue + shimmer * hueAmp, 0, 360);
                    const sat = constrain(baseSat + shimmer*2, 0, 100);
                    const bri = constrain(baseBri + shimmer*briAmp, 0, 100);
                    fill(color(hue, sat, bri)); rect(i*this.w, j*this.w, this.w, this.w);
                } else if(p===3){
                    // Example rendering for fire particle (not implemented in logic yet)
                    const baseHue = 30; // orange
                    const baseSat = 100;
                    const baseBri = 100;
                    const ph = (this.phase[i][j] != null) ? this.phase[i][j] : 0;
                    const speed = 0.05; const hueAmp = 10; const briAmp = 20;
                    const timePhase = frameCount * speed + ph;
                    const shimmer = Math.sin(TWO_PI * timePhase);
                    const hue = constrain(baseHue + shimmer * hueAmp, 0, 360);
                    const sat = baseSat;
                    const bri = constrain(baseBri + shimmer*briAmp, 0, 100);
                    fill(color(hue, sat, bri)); rect(i*this.w, j*this.w, this.w, this.w);
                }
            }
        }
    }
}

function setup(){
    createCanvas(800,800);
    sim = new ParticleSim(w, width, height);

    colorMode(HSB,360,100,100);
    sandA = color(40,50,95); sandB = color(30,67,95);
    window._waterHueBase = 200; window._waterHueRange = 6; window._waterSat = 80; window._waterBri = 90;
    colorCycle = 600;

    createBrushButtons();
}

function createBrushButtons(){
    // ADD MORE BRUSHES HERE
    sandBtn = createButton('Sand'); waterBtn = createButton('Water'); fireBtn = createButton('Fire');
    sandBtn.position(10,10); waterBtn.position(80,10); fireBtn.position(150,10);
    sandBtn.mousePressed(()=>{ currentBrush='sand'; sandBtn.style('background-color','#ddd'); waterBtn.style('background-color',''); fireBtn.style('background-color',''); });
    waterBtn.mousePressed(()=>{ currentBrush='water'; waterBtn.style('background-color','#ddd'); sandBtn.style('background-color',''); fireBtn.style('background-color',''); });
    fireBtn.mousePressed(()=>{ currentBrush='fire'; fireBtn.style('background-color','#ddd'); waterBtn.style('background-color',''); sandBtn.style('background-color',''); });
    sandBtn.style('background-color','#ddd');
}

function mouseDragged(){ if(mouseButton === LEFT) sim.setCircleAt(mouseX, mouseY, 3, 0.6, currentBrush === 'water', currentBrush === 'fire' ? 'fire' : 'sand'); }
function mousePressed(){ if(mouseButton === LEFT) sim.setCircleAt(mouseX, mouseY, 3, 0.6, currentBrush === 'water', currentBrush === 'fire' ? 'fire' : 'sand'); }

function draw(){ background(0); sim.step(); if(mouseIsPressed && mouseButton===LEFT) sim.setCircleAt(mouseX, mouseY, 3, 0.6, currentBrush === 'water' ? 'water' : 'sand'); sim.render(); }
