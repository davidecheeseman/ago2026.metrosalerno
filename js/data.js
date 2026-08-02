// ─── DATA ──────────────────────────────────────
const ST=[
  {id:"SA",name:"Salerno FS",lat:40.6754966,lng:14.7726212,km:0,term:1},
  {id:"TO",name:"Torrione",lat:40.6703629,lng:14.7902878,km:1.2},
  {id:"PA",name:"Pastena",lat:40.6649417,lng:14.7998167,km:2.1},
  {id:"ME",name:"Mercatello",lat:40.6588268,lng:14.8047320,km:3.2},
  {id:"AR",name:"Arbostella",lat:40.6517094,lng:14.8131339,km:4.2},
  {id:"ST",name:"Stadio Arechi",lat:40.6483170,lng:14.8243343,km:5.7,term:1},
];
const DU={id:"DV",name:"Duomo-Via Vernieri",lat:40.6814033,lng:14.7623481};
const FU=[
  {id:"ASI",name:"ASI",lat:40.6545,lng:14.8380},
  {id:"OS",name:"Ospedale",lat:40.6500,lng:14.8490},
  {id:"PC",name:"Pontecagnano",lat:40.6390,lng:14.8690},
  {id:"SA2",name:"S. Antonio",lat:40.6330,lng:14.8810},
  {id:"AE",name:"Aeroporto ✈",lat:40.6204,lng:14.9082},
];
const SEG=[4,3,3,3,4],CUM=[0];SEG.forEach((s,i)=>CUM.push(CUM[i]+s));
const TOT=CUM[CUM.length-1];

// ─── POINTS OF INTEREST ─────────────────────────
const POI={
  SA:[
    {n:"Duomo di San Matteo",icon:"⛪",lat:40.6787,lng:14.7588,walk:12,cat:"cultura"},
    {n:"Lungomare Trieste",icon:"🌊",lat:40.6738,lng:14.7620,walk:8,cat:"passeggiata"},
    {n:"Giardini della Minerva",icon:"🌿",lat:40.6800,lng:14.7555,walk:15,cat:"cultura"},
    {n:"Villa Comunale",icon:"🌳",lat:40.6726,lng:14.7651,walk:6,cat:"parco"},
    {n:"Stazione Marittima",icon:"⛴️",lat:40.6720,lng:14.7565,walk:10,cat:"trasporti"},
    {n:"Corso V. Emanuele",icon:"🛍️",lat:40.6760,lng:14.7640,walk:5,cat:"shopping"},
  ],
  DV:[
    {n:"Centro Storico Alto",icon:"🏛️",lat:40.6795,lng:14.7595,walk:5,cat:"cultura"},
    {n:"Via dei Mercanti",icon:"🛍️",lat:40.6780,lng:14.7590,walk:4,cat:"shopping"},
    {n:"Pasticceria Pantaleone",icon:"🍰",lat:40.6778,lng:14.7585,walk:5,cat:"food"},
  ],
  TO:[
    {n:"Pasticceria Svizzera",icon:"🍰",lat:40.6722,lng:14.7855,walk:4,cat:"food"},
    {n:"Spiaggia Santa Teresa",icon:"🏖️",lat:40.6698,lng:14.7815,walk:8,cat:"spiaggia"},
    {n:"Lungomare Marconi",icon:"🌊",lat:40.6705,lng:14.7850,walk:3,cat:"passeggiata"},
  ],
  PA:[
    {n:"Spiaggia di Pastena",icon:"🏖️",lat:40.6670,lng:14.7925,walk:5,cat:"spiaggia"},
    {n:"Porticciolo di Pastena",icon:"⚓",lat:40.6660,lng:14.7940,walk:6,cat:"passeggiata"},
    {n:"Lungomare Colombo",icon:"🌊",lat:40.6675,lng:14.7960,walk:3,cat:"passeggiata"},
  ],
  ME:[
    {n:"Parco del Mercatello",icon:"🌳",lat:40.6660,lng:14.8050,walk:4,cat:"parco"},
    {n:"Centro Commerciale",icon:"🛍️",lat:40.6640,lng:14.8100,walk:5,cat:"shopping"},
  ],
  AR:[
    {n:"Parco Arbostella",icon:"🌳",lat:40.6610,lng:14.8180,walk:3,cat:"parco"},
    {n:"Zona Industriale",icon:"🏢",lat:40.6590,lng:14.8200,walk:6,cat:"lavoro"},
  ],
  ST:[
    {n:"Stadio Arechi",icon:"⚽",lat:40.6570,lng:14.8285,walk:4,cat:"sport"},
    {n:"Ospedale Ruggi",icon:"🏥",lat:40.6560,lng:14.8260,walk:5,cat:"servizi"},
  ],
};


export { ST, DU, FU, SEG, CUM, TOT, POI };
