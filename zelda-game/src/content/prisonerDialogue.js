const english = [
    [
        "Please, you have to get me out of here!",
        "I was collecting herbs for the wizard when that lumberjack attacked me.",
        "The next thing I know, I'm locked up in here!"
    ],
    [
        "Please, you have to get me out of here!"
    ],
    [
        "I need you to find a way to free me."
    ],

];


const freedEnglish = [
    [
        "Thank you for freeing me!",
        "I don't think I would have survived much longer.",
        "Could you help me get out of here?"
    ]
];


const icelandic = [
    [
        "Gerdu þad, Þu verdur bjarga mer!",
        "Eg var ad safna jurtum fyrir galdrakallinn þegar thessi skogarhogsmadur reðst a mig.",
        "Naesta sem eg veit, þa er eg fastur herna!"
    ],
    [
        "Þu verdur ad koma mer hedan! Gerdu þad!"
    ],
    [
        "Þu þarft að finna leid til ad opna hurdina."
    ],

];


const freedIcelandic = [
    [
        "Takk fyrir ad bjarga mer!",
        "Eg held ad eg hefdi ekki lifad þetta af mikid lengur.",
        "Geturdu hjalpad mer að komast hedan ut?"
    ]
];


const prisonerLines = {
    english, 
    icelandic
};




export const prisonerFreedLines = {
    english: freedEnglish,
    icelandic: freedIcelandic
};

export default prisonerLines;