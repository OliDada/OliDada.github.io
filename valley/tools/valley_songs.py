# The Valley's two songs, written out in the olid-song format so the Studio can open and remix them.
import json
P={ # copies of the Studio presets (music/presets.js), tagged the way the Studio tags them
 'Flute':dict(type='synth',wave='sine',volume=0.3,attack=0.08,decay=0.2,sustain=0.8,release=0.2,vibrato=12,vibratoRate=5,reverb=0.35,role='lead'),
 'Pluck':dict(type='synth',wave='sawtooth',volume=0.2,attack=0.002,decay=0.25,sustain=0,release=0.2,filter=900,resonance=4,filterEnv=0.9,reverb=0.2,delay=0.2,role='keys'),
 'Strings':dict(type='synth',wave='sawtooth',volume=0.11,attack=0.3,decay=0.5,sustain=0.8,release=0.6,filter=2200,unison=3,spread=10,vibrato=6,vibratoRate=5,reverb=0.4,role='pad'),
 'Warm Pad':dict(type='synth',wave='sawtooth',volume=0.1,attack=0.8,decay=1,sustain=0.8,release=1.5,filter=900,unison=3,spread=18,reverb=0.5,role='pad'),
 'Choir':dict(type='synth',wave='triangle',volume=0.16,attack=0.5,decay=0.6,sustain=0.75,release=1,filter=1600,resonance=3,unison=3,spread=16,vibrato=8,vibratoRate=4.5,reverb=0.6,role='pad'),
 'Pluck Bass':dict(type='synth',wave='square',volume=0.2,attack=0.002,decay=0.3,sustain=0.1,release=0.1,filter=700,filterEnv=0.6,octave=-1,role='bass'),
 'Sub Bass':dict(type='synth',wave='sine',volume=0.45,attack=0.005,decay=0.2,sustain=0.9,release=0.1,octave=-1,role='bass'),
 'Saw Lead':dict(type='synth',wave='sawtooth',volume=0.13,attack=0.01,decay=0.2,sustain=0.7,release=0.2,filter=3600,resonance=2,unison=3,spread=14,delay=0.2,role='lead'),
 'Kick':dict(type='drum',kind='kick',volume=0.6,role='drum',kit='classic'),
 'Tom':dict(type='drum',kind='tom',volume=0.45,role='drum',kit='classic'),
 'Hi-hat':dict(type='drum',kind='hat',volume=0.18,role='drum',kit='classic'),
 'Perc':dict(type='drum',kind='perc',volume=0.3,delay=0.2,role='drum',kit='classic'),
}
def inst(preset,color,**o):d=dict(P[preset]);d.update(o);d['preset']=preset;d['color']=color;return d
NOTE={'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11}
def m(n):return NOTE[n[:-1]]+12*(int(n[-1])+1)
def nm(x):return ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'][x%12]+str(x//12-1)
def up(n,k):return nm(m(n)+k)
def held(chords,length=16,vel=.5,start=0):   # [(notes...)] one per slot
    out=[];[out.append([start+i*length,n,length,vel]) for i,c in enumerate(chords) for n in c];return out
def arp(chords,pat,vel=.5,every=2,length=16):
    out=[]
    for i,c in enumerate(chords):
        for k in range(length//every):out.append([i*length+k*every,c[pat[k%len(pat)]],every,round(vel*(1 if k%4==0 else .8),2)])
    return out
def mel(notes,vel=.8):return [[s,n,l,v if len(x)>3 else vel] for x in notes for (s,n,l,*v0) in [x] for v in [(v0[0] if v0 else vel)]]
def song(**k):return dict(format='olid-song',version=1,author='olid.is',game='valley',stepsPerBeat=4,swing=0,fx=dict(delaySteps=3,delayFeedback=0.3),**k)

# ---------------------------------------------------------------- the night Ashford burned (the opening, ~41 s, plays once)
Dm=['D3','F3','A3'];Bb=['Bb2','D3','F3'];C=['C3','E3','G3'];A=['A2','C#3','E3'];Gm=['G2','Bb2','D3']
intro=song(title='The Night Ashford Burned',bpm=70,key='D',scale='minor',volume=0.95,loopFrom=0,
 instruments={'Flute':inst('Flute','#9b87ff',volume=0.24),'Harp':inst('Pluck','#4fd1c5',volume=0.16,filter=1400),
  'Strings':inst('Strings','#ff7aa8',volume=0.1),'Low Strings':inst('Warm Pad','#e07bff',volume=0.12,octave=-1,attack=1.2),
  'Choir':inst('Choir','#5ce0a0',volume=0.12),'Horn':inst('Saw Lead','#ff8a5c',volume=0.1,filter=1500,attack=0.06,vibrato=8,vibratoRate=5,reverb=0.4,delay=0.1),
  'Bass':inst('Pluck Bass','#ffb547',volume=0.24),'Kick':inst('Kick','#6fb6ff',volume=0.55,pitch=0.8,decay=1.4),
  'War Drum':inst('Tom','#ffd95c',volume=0.5,pitch=0.6,decay=1.5,reverb=0.3),'Hat':inst('Hi-hat','#a3e05f',volume=0.12)},
 patterns={
  # dusk over the roofs: a quiet tune, nothing wrong yet
  'dusk':dict(steps=32,chords=[0,5],tracks={
    'Flute':mel([[0,'A4',6],[6,'G4',2],[8,'F4',4],[12,'E4',4],[16,'D4',6],[22,'F4',2],[24,'G4',8]],.75),
    'Harp':arp([['D3','A3','D4','F4','A4'],['Bb2','F3','Bb3','D4','F4']],[0,1,2,3,4,3,2,1],.45),
    'Strings':held([Dm,Bb],16,.4),'Bass':held([['D2'],['Bb1']],16,.45)}),
  # the roots come out of the east: the tune stops, something low starts breathing
  'dread':dict(steps=32,chords=[3,4],tracks={
    'Low Strings':[[0,'D3',32,.7]],'Strings':held([Gm,A],16,.35)+[[16,'Bb3',16,.3]],
    'Choir':[[8,'D4',8,.25],[16,'Eb4',16,.3]],
    'Bass':[[s,'D2' if s<16 else 'A1',2,round(.3+.4*s/32,2)] for s in range(0,32,4)],
    'War Drum':[[24,None,1,.5],[26,None,1,.6],[28,None,1,.7],[29,None,1,.6],[30,None,1,.85],[31,None,1,.9]]}),
  # the town burns
  'fire':dict(steps=64,chords=[0,5,6,4],tracks={
    'Horn':mel([[0,'D4',4],[4,'F4',4],[8,'A4',6],[14,'G4',2],[16,'F4',4],[20,'D4',4],[24,'Bb3',8],[32,'C4',4],[36,'E4',4],[40,'G4',6],[46,'A4',2],[48,'E4',4],[52,'A4',8],[60,'C#5',4]],.85),
    'Choir':held([['D4','A4'],['D4','F4'],['E4','G4'],['C#4','E4']],16,.4),
    'Strings':[[b*16+s,n,2,.35+.15*(s%4==0)] for b,c in enumerate([Dm,Bb,C,A]) for s in range(0,16,2) for n in c],
    'Bass':[[b*16+s,r if s%8!=6 else up(r,7),2,.7] for b,r in enumerate(['D2','Bb1','C2','A1']) for s in range(0,16,2)],
    'War Drum':[[b*16+s,None,1,v] for b in range(4) for s,v in [(0,1),(3,.6),(6,.8),(8,1),(10,.6),(11,.6),(12,.9),(14,.7)]],
    'Kick':[[b*16+s,None,1,1] for b in range(4) for s in (0,8)]}),
  # the bell has stopped
  'hush':dict(steps=16,chords=[0],tracks={'Low Strings':[[0,'D3',16,.45]],'Choir':[[4,'A3',12,.2]]}),
  # out of the west gate and running
  'escape':dict(steps=48,chords=[0,5,0],tracks={
    'Horn':mel([[0,'A4',4],[4,'D5',4],[8,'C5',4],[12,'A4',4],[16,'Bb4',4],[20,'D5',4],[24,'C5',4],[28,'E5',4],[32,'D5',16]],.9),
    'Flute':mel([[16,'F5',8],[24,'G5',8],[32,'A5',16]],.55),
    'Strings':held([Dm],16,.45)+held([Bb],8,.45,16)+held([C],8,.45,24)+[[32,n,16,.5] for n in ['D3','F3','A3','D4']],
    'Choir':held([['D4','A4'],['D4','F4']],16,.45)+[[32,'D4',16,.5],[32,'A4',16,.5]],
    'Bass':[[s,r,2,.75] for s,r in [(s,'D2' if s<16 else 'Bb1' if s<24 else 'C2') for s in range(0,32,2)]]+[[32,'D2',16,.7]],
    'Kick':[[s,None,1,1] for s in range(0,32,4)]+[[32,None,1,1]],
    'Hat':[[s,None,1,.5+.3*(s%4==0)] for s in range(0,32,2)],
    'War Drum':[[s,None,1,.6+.4*(s-24)/8] for s in range(24,32)]+[[32,None,1,1]]})},
 arrangement=['dusk','dread','fire','hush','escape'])

# ---------------------------------------------------------------- The Valley (the game, loops)
G=['G3','B3','D4','G4'];Cc=['C3','G3','C4','E4'];Em=['E3','B3','E4','G4'];D=['D3','A3','D4','F#4'];Am=['A2','E3','A3','C4']
pad=lambda cs,v=.32:held([[c[0],c[1],c[2]] for c in cs],16,v)
bass=lambda rs,v=.42:[[i*16,r,8,v] for i,r in enumerate(rs)]+[[i*16+8,up(r,7),6,v*.8] for i,r in enumerate(rs)]
LUTE=[0,1,2,3,2,1,2,1]
theme=song(title='The Valley',bpm=84,key='G',scale='major',volume=0.75,loopFrom=0,
 instruments={'Flute':inst('Flute','#9b87ff',volume=0.22),'Lute':inst('Pluck','#4fd1c5',volume=0.15,filter=1200,delay=0.15),
  'Strings':inst('Strings','#ff7aa8',volume=0.07,attack=0.6,release=1),'Bass':inst('Sub Bass','#ffb547',volume=0.22),
  'Frame Drum':inst('Tom','#ffd95c',volume=0.18,pitch=0.7,decay=1.2,reverb=0.25),'Tambourine':inst('Hi-hat','#a3e05f',volume=0.07,decay=1.6)},
 patterns={
  'morning':dict(steps=64,chords=[0,3,5,4],tracks={'Lute':arp([G,Cc,Em,D],LUTE,.42),'Strings':pad([G,Cc,Em,D]),'Bass':bass(['G2','C2','E2','D2'])}),
  'theme':dict(steps=64,chords=[0,4,5,3],tracks={
    'Flute':mel([[0,'D5',4],[4,'B4',2],[6,'C5',2],[8,'D5',6],[14,'G5',2],[16,'F#5',4],[20,'E5',2],[22,'D5',2],[24,'A4',8],
                 [32,'B4',4],[36,'C5',2],[38,'D5',2],[40,'E5',6],[46,'D5',2],[48,'C5',4],[52,'B4',4],[56,'A4',8]],.75),
    'Lute':arp([G,D,Em,Cc],LUTE,.38),'Strings':pad([G,D,Em,Cc],.28),'Bass':bass(['G2','D2','E2','C2']),
    'Frame Drum':[[b*16,None,1,.8] for b in range(4)]+[[b*16+10,None,1,.45] for b in range(4)],'Tambourine':[[b*16+s,None,1,.6] for b in range(4) for s in (4,12)]}),
  'answer':dict(steps=64,chords=[3,0,1,0],tracks={
    'Flute':mel([[0,'E5',4],[4,'G5',4],[8,'E5',4],[12,'C5',4],[16,'D5',6],[22,'B4',2],[24,'G4',8],[32,'A4',4],[36,'C5',4],[40,'F#5',4],[44,'E5',2],[46,'D5',2],[48,'G5',14]],.75),
    'Lute':arp([Cc,G],LUTE,.38,length=16)+[[32+k*2,(Am if k<4 else D)[LUTE[k]],2,.36] for k in range(8)]+[[48+k*2,G[LUTE[k]],2,.36] for k in range(8)],
    'Strings':pad([Cc,G])+held([Am[:3]],8,.3,32)+held([D[:3]],8,.3,40)+held([G[:3]],16,.3,48),'Bass':bass(['C2','G2','A2','G2']),
    'Frame Drum':[[b*16,None,1,.8] for b in range(4)]+[[b*16+10,None,1,.45] for b in range(4)],'Tambourine':[[b*16+s,None,1,.6] for b in range(4) for s in (4,12)]}),
  'rest':dict(steps=64,chords=[0,3,0,4],tracks={'Strings':pad([G,Cc,G,D],.3),'Lute':[[b*16+s,c[i],4,.3] for b,c in enumerate([G,Cc,G,D]) for i,s in enumerate((0,4,8,12))],'Bass':[[b*16,r,16,.35] for b,r in enumerate(['G2','C2','G2','D2'])]}),
  'bridge':dict(steps=64,chords=[5,3,0,4],tracks={
    'Flute':mel([[0,'G4',8],[8,'B4',8],[16,'C5',8],[24,'E5',8],[32,'D5',12],[44,'B4',4],[48,'A4',16]],.6),
    'Lute':arp([Em,Cc,G,D],LUTE,.34),'Strings':pad([Em,Cc,G,D],.34),'Bass':bass(['E2','C2','G2','D2'],.38)})},
 arrangement=['morning','theme','answer','rest','bridge','theme','answer','rest'])

import sys
out=sys.argv[1]
for name,s in [('valley-ashford-night.json',intro),('valley-the-valley.json',theme)]:
    json.dump(s,open(out+'/'+name,'w'),indent=1);print(name,sum(p['steps'] for p in [s['patterns'][a] for a in s['arrangement']])*60/s['bpm']/4,'s')
