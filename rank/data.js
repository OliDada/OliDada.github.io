// Rank — data. Every item carries real numbers; each measure in game.js ranks one list by one number.
// Add items here and new days appear on their own.
// One list, many days. Each set has items with several numbers, and each
// "measure" is one way to rank them. Add items or measures and new days appear.

const CITIES = [
  ["Reykjavík","Iceland",64.15,-21.94],["Akureyri","Iceland",65.68,-18.09],["Nuuk","Greenland",64.18,-51.69],
  ["Tromsø","Norway",69.65,18.96],["Oslo","Norway",59.91,10.75],["Stockholm","Sweden",59.33,18.07],
  ["Helsinki","Finland",60.17,24.94],["Copenhagen","Denmark",55.68,12.57],["Edinburgh","UK",55.95,-3.19],
  ["Dublin","Ireland",53.35,-6.26],["London","UK",51.51,-0.13],["Amsterdam","Netherlands",52.37,4.90],
  ["Berlin","Germany",52.52,13.40],["Warsaw","Poland",52.23,21.01],["Paris","France",48.86,2.35],
  ["Vienna","Austria",48.21,16.37],["Madrid","Spain",40.42,-3.70],["Lisbon","Portugal",38.72,-9.14],
  ["Rome","Italy",41.90,12.50],["Athens","Greece",37.98,23.73],["Istanbul","Türkiye",41.01,28.98],
  ["Moscow","Russia",55.76,37.62],["Cairo","Egypt",30.04,31.24],["Casablanca","Morocco",33.57,-7.59],
  ["Lagos","Nigeria",6.52,3.38],["Addis Ababa","Ethiopia",9.03,38.74],["Nairobi","Kenya",-1.29,36.82],
  ["Kinshasa","DR Congo",-4.44,15.27],["Cape Town","South Africa",-33.92,18.42],["Dubai","UAE",25.20,55.27],
  ["Tehran","Iran",35.69,51.39],["Delhi","India",28.61,77.21],["Mumbai","India",19.08,72.88],
  ["Bangkok","Thailand",13.76,100.50],["Singapore","Singapore",1.35,103.82],["Jakarta","Indonesia",-6.21,106.85],
  ["Manila","Philippines",14.60,120.98],["Ulaanbaatar","Mongolia",47.89,106.91],["Beijing","China",39.90,116.40],
  ["Shanghai","China",31.23,121.47],["Seoul","South Korea",37.57,126.98],["Tokyo","Japan",35.68,139.69],
  ["Perth","Australia",-31.95,115.86],["Sydney","Australia",-33.87,151.21],["Auckland","New Zealand",-36.85,174.76],
  ["Honolulu","USA",21.31,-157.86],["Anchorage","USA",61.22,-149.90],["Vancouver","Canada",49.28,-123.12],
  ["San Francisco","USA",37.77,-122.42],["Los Angeles","USA",34.05,-118.24],["Mexico City","Mexico",19.43,-99.13],
  ["Chicago","USA",41.88,-87.63],["Toronto","Canada",43.65,-79.38],["New York","USA",40.71,-74.01],
  ["Havana","Cuba",23.11,-82.37],["Bogotá","Colombia",4.71,-74.07],["Lima","Peru",-12.05,-77.04],
  ["Rio de Janeiro","Brazil",-22.91,-43.17],["Buenos Aires","Argentina",-34.60,-58.38],["Santiago","Chile",-33.45,-70.67],
].map(([name,sub,lat,lon]) => ({name,sub,lat,lon}));

// area km², population (millions, approx.), highest point m
const COUNTRIES = [
  ["Iceland",103000,0.39,2110],["Norway",385207,5.5,2469],["Sweden",450295,10.5,2097],["Finland",338455,5.6,1324],
  ["Denmark",42924,5.9,171],["United Kingdom",243610,68,1345],["Ireland",70273,5.3,1039],["France",551695,68,4806],
  ["Germany",357588,84,2962],["Spain",505990,48,3715],["Portugal",92212,10.6,2351],["Italy",301340,59,4748],
  ["Switzerland",41285,8.9,4634],["Greece",131957,10.4,2918],["Poland",312696,37.6,2499],["Egypt",1002450,112,2629],
  ["Nigeria",923768,225,2419],["Kenya",580367,55,5199],["South Africa",1221037,63,3450],["Ethiopia",1104300,127,4550],
  ["Japan",377975,124,3776],["China",9596961,1410,8849],["India",3287263,1440,8586],["Indonesia",1904569,280,4884],
  ["Australia",7692024,27,2228],["New Zealand",268021,5.2,3724],["Canada",9984670,41,5959],["United States",9833520,335,6190],
  ["Mexico",1964375,130,5636],["Brazil",8515767,212,2995],["Argentina",2780400,46,6961],["Chile",756102,19.6,6893],
  ["Peru",1285216,34,6768],["Russia",17098246,144,5642],["Nepal",147516,30,8849],["Mongolia",1564116,3.5,4374],
  ["Türkiye",783562,85,5137],["Vietnam",331212,100,3143],["Thailand",513120,72,2565],["South Korea",100210,51.7,1950],
].map(([name,area,pop,peak]) => ({name,area,pop,peak}));

const MOUNTAINS = [
  ["Everest","Nepal/China",8849],["K2","Pakistan/China",8611],["Kangchenjunga","Nepal/India",8586],
  ["Aconcagua","Argentina",6961],["Chimborazo","Ecuador",6263],["Denali","USA",6190],["Kilimanjaro","Tanzania",5895],
  ["Elbrus","Russia",5642],["Mount Kenya","Kenya",5199],["Ararat","Türkiye",5137],["Vinson","Antarctica",4892],
  ["Puncak Jaya","Indonesia",4884],["Mont Blanc","France/Italy",4806],["Matterhorn","Switzerland/Italy",4478],
  ["Mount Rainier","USA",4392],["Mauna Kea","Hawaii",4207],["Fuji","Japan",3776],["Aoraki / Mount Cook","New Zealand",3724],
  ["Teide","Spain",3715],["Zugspitze","Germany",2962],["Olympus","Greece",2918],["Galdhøpiggen","Norway",2469],
  ["Kosciuszko","Australia",2228],["Hvannadalshnúkur","Iceland",2110],["Hekla","Iceland",1491],
  ["Ben Nevis","UK",1345],["Table Mountain","South Africa",1085],
].map(([name,sub,h]) => ({name,sub,h}));

// height m, year completed (negative = BC)
const STRUCTURES = [
  ["Burj Khalifa","Dubai",828,2010],["Merdeka 118","Kuala Lumpur",679,2023],["Tokyo Skytree","Tokyo",634,2012],
  ["Shanghai Tower","Shanghai",632,2015],["Canton Tower","Guangzhou",604,2010],["Abraj Al-Bait Clock Tower","Mecca",601,2012],
  ["Lotte World Tower","Seoul",555,2017],["CN Tower","Toronto",553,1976],["One World Trade Center","New York",541,2014],
  ["Ostankino Tower","Moscow",540,1967],["Taipei 101","Taipei",508,2004],["Petronas Towers","Kuala Lumpur",452,1998],
  ["Empire State Building","New York",443,1931],["Willis Tower","Chicago",442,1974],["Eiffel Tower","Paris",330,1889],
  ["Burj Al Arab","Dubai",321,1999],["Chrysler Building","New York",319,1930],["The Shard","London",310,2012],
  ["Gateway Arch","St. Louis",192,1965],["Space Needle","Seattle",184,1962],["The Gherkin","London",180,2004],
  ["Washington Monument","Washington D.C.",169,1884],["Ulm Minster","Ulm",162,1890],["Cologne Cathedral","Cologne",157,1880],
  ["Great Pyramid of Giza","Egypt",139,-2560,true],["St. Peter's Basilica","Vatican City",137,1626],
  ["Elizabeth Tower (Big Ben)","London",96,1859],["Statue of Liberty","New York",93,1886],
  ["Hallgrímskirkja","Reykjavík",75,1986],["Leaning Tower of Pisa","Pisa",56,1372],
].map(([name,sub,h,year,circa]) => ({name,sub,h,year,circa:!!circa}));

const EVENTS = [
  ["Great Pyramid of Giza built",-2560,true],["Julius Caesar assassinated",-44],["Fall of the Western Roman Empire",476],
  ["Vikings settle Iceland",874,true],["Iceland's Althing founded",930],["Battle of Hastings",1066],["Magna Carta sealed",1215],
  ["Black Death reaches Europe",1347],["Gutenberg's printing press",1440,true],["Columbus reaches the Americas",1492],
  ["First telescope",1608],["Shakespeare dies",1616],["Newton's Principia published",1687],
  ["US Declaration of Independence",1776],["French Revolution begins",1789],["Darwin's On the Origin of Species",1859],
  ["Suez Canal opens",1869],["Bell patents the telephone",1876],["Eiffel Tower opens",1889],["First modern Olympics",1896],
  ["First Nobel Prizes",1901],["Wright brothers' first flight",1903],["Titanic sinks",1912],["Panama Canal opens",1914],
  ["Penicillin discovered",1928],["Iceland becomes a republic",1944],["Sputnik launched",1957],["First human in space",1961],
  ["Moon landing",1969],["First email sent",1971],["First Star Wars film",1977],["Chernobyl disaster",1986],
  ["Fall of the Berlin Wall",1989],["Game Boy released",1989],["First Harry Potter book",1997],["Google founded",1998],
  ["Euro notes and coins introduced",2002],["Facebook launched",2004],["YouTube launched",2005],["First iPhone",2007],
  ["Bitcoin launched",2009],
].map(([name,year,circa]) => ({name,year,circa:!!circa}));

// typical adult weight, kg
const ANIMALS = [
  ["Blue whale",150000],["Orca",5000],["African elephant",6000],["Hippopotamus",1500],["Walrus",1200],["Giraffe",1200],
  ["Moose",500],["Saltwater crocodile",500],["Polar bear",450],["Tiger",220],["Lion",190],["Gorilla",160],
  ["Reindeer",120],["Ostrich",110],["Giant panda",100],["Harbour seal",100],["Human",70],["Komodo dragon",70],
  ["Red kangaroo",60],["Capybara",50],["Cheetah",50],["Grey wolf",40],["Emperor penguin",30],["Beaver",20],
  ["Koala",9],["Red fox",6],["Golden eagle",5],["House cat",4.5],["Arctic fox",4],["Chicken",2.5],
  ["Atlantic puffin",0.5],["Hamster",0.12],["House mouse",0.02],["Hummingbird",0.004],
].map(([name,kg]) => ({name,kg}));
window.RANK_DATA = { CITIES, COUNTRIES, MOUNTAINS, STRUCTURES, EVENTS, ANIMALS };
