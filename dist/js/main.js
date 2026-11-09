import { dataLayer } from './data.js';
import { createRaster } from './raster.js';
import { createGlobe } from './globe.js';
import { mountLandscout } from './interface.js';

const locations=[{"id":"ANA","name":"Anaheim","lon":-117.9145,"lat":33.8321,"dx":0.035,"dy":0.024},{"id":"SA","name":"Santa Ana","lon":-117.8755,"lat":33.7452,"dx":0.029,"dy":0.022},{"id":"CM","name":"Costa Mesa","lon":-117.9084,"lat":33.6666,"dx":0.027,"dy":0.019},{"id":"GG","name":"Garden Grove","lon":-117.9414,"lat":33.7743,"dx":0.027,"dy":0.017},{"id":"IRV","name":"Irvine","lon":-117.7879,"lat":33.6846,"dx":0.039,"dy":0.024},{"id":"LF","name":"Lake Forest","lon":-117.6873,"lat":33.6456,"dx":0.027,"dy":0.02},{"id":"LN","name":"Laguna Niguel","lon":-117.7083,"lat":33.5225,"dx":0.034,"dy":0.037}];
const icons={"layers":"<path d=\"m3 8 9-5 9 5-9 5zM3 12l9 5 9-5M3 16l9 5 9-5\"/>","search":"<circle cx=\"10\" cy=\"10\" r=\"6.5\"/><path d=\"m15 15 5 5\"/>","sliders":"<path d=\"M4 7h7m4 0h5M4 17h2m4 0h10\"/><circle cx=\"13\" cy=\"7\" r=\"2\"/><circle cx=\"8\" cy=\"17\" r=\"2\"/>","plus":"<path d=\"M12 5v14M5 12h14\"/>","minus":"<path d=\"M5 12h14\"/>","home":"<path d=\"M4 9V5h4m8 0h4v4M4 15v4h4m8 0h4v-4\"/><circle cx=\"12\" cy=\"12\" r=\"3\"/>","chev":"<path d=\"m9 5 7 7-7 7\"/>","left":"<path d=\"m14 6-6 6 6 6\"/>","pin":"<path d=\"M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"2\"/>","upload":"<path d=\"M12 15V4m-5 5 5-5 5 5M4 15v5h16v-5\"/>","external":"<path d=\"M13 4h7v7m0-7-10 10M10 5H5v14h14v-5\"/>","eye":"<path d=\"M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>","near":"<circle cx=\"12\" cy=\"12\" r=\"8\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/>","download":"<path d=\"M12 4v10m-4-4 4 4 4-4M4 17v3h16v-3\"/>"};
const imagery=await (await fetch('/imagery/manifest.json')).json();
const model=dataLayer(locations,imagery.images);
await model.municipal().catch(()=>false);
mountLandscout(model,icons,createRaster,createGlobe);
