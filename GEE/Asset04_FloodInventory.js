//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  Titulo:       Inventario de Inundaciones en la Subcuenca Hidrográfica del Bajo Sinú 
//  Checkpoint:   1.a
//  Authors:      Sebastian Velosa Bohorquez
//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// *** ASSEt 4/5 ***

// =====================================================
// 1. ÁREA DE ESTUDIO
// =====================================================

// Área de estudio
var cuenca = ee.FeatureCollection("users/savelosab_practiques/Cuenca_Baja_RioSinu");
var zona_es = cuenca.geometry().dissolve();

// Centrar mapa
Map.centerObject(zona_es, 10);

// Mostrar
Map.addLayer(zona_es,
{
  color: 'red'
},
'Subcuenca Hidrográfica del Bajo Sinú');

// =====================================================
// PROYECCIÓN MAESTRA DEL PROYECTO
// =====================================================

var asset01 = ee.Image(
  'users/savelosab_practiques/Asset01_Geomorphology'
);

var masterProj =
  asset01.select('Elevation').projection();

print('MASTER CRS:', masterProj);
print(
  'MASTER SCALE:',
  masterProj.nominalScale()
);

// =====================================================
// 2. DATA - SENTINEL-1
// =====================================================

// PRE-INUNDACION
var pre = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(zona_es)
  .filterDate('2025-12-01', '2025-12-30')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VV'))
  .select('VV')
  .median()
  .clip(zona_es);
  
  print(pre); 

// POST-INUNDACION
var post = ee.ImageCollection('COPERNICUS/S1_GRD')
  .filterBounds(zona_es)
  .filterDate('2026-02-05', '2026-02-10')
  .filter(ee.Filter.eq('instrumentMode', 'IW'))
  .filter(ee.Filter.listContains(
    'transmitterReceiverPolarisation', 'VV'))
  .select('VV')
  .median()
  .clip(zona_es);
  
  print(post); 

  // Visualización
Map.addLayer(pre, {min:-25,max:0}, 'VV PRE');
Map.addLayer(post, {min:-25,max:0}, 'VV POST');

// =====================================================
// 3. CAMBIO DE BACKSCATTER
// =====================================================
var deltaVV = pre.subtract(post);

Map.addLayer(deltaVV,
{
  min:0,
  max:10,
  palette:['white','blue']
},
'Delta VV');

// =====================================================
// 4. OTSU
// =====================================================
function otsu(histogram) {

  histogram = ee.Dictionary(histogram);

  var counts = ee.Array(histogram.get('histogram'));
  var means = ee.Array(histogram.get('bucketMeans'));

  var size = means.length().get([0]);
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);

  var sum = means.multiply(counts)
    .reduce(ee.Reducer.sum(), [0]).get([0]);

  var mean = sum.divide(total);

  var indices = ee.List.sequence(1, size);

  var bss = indices.map(function(i) {

    var aCounts = counts.slice(0, 0, i);

    var aCount = aCounts
      .reduce(ee.Reducer.sum(), [0]).get([0]);

    var aMeans = means.slice(0, 0, i);

    var aMean = aMeans.multiply(aCounts)
      .reduce(ee.Reducer.sum(), [0]).get([0])
      .divide(aCount);

    var bCount = total.subtract(aCount);

    var bMean = sum.subtract(aCount.multiply(aMean))
      .divide(bCount);

    return aCount.multiply(aMean.subtract(mean).pow(2))
      .add(
        bCount.multiply(bMean.subtract(mean).pow(2)));
  });

  return means.sort(bss).get([-1]);
}

// Histograma sobre DELTA

var histogram = ee.Dictionary(
  post.reduceRegion({
    reducer: ee.Reducer.histogram(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  }).get('VV')
);

// Umbral Otsu
var threshold = otsu(histogram);

print('Threshold:', threshold);

// Inundación

var water = post.lt(threshold); //añade una varibale de agua menor que el umbral -14,8

Map.addLayer(
  water.selfMask(),
  {palette:['blue']},
  'Water'
);
// =====================================================
// 5. REMOVER AGUA PERMANENTE
// =====================================================

// JRC WATER

var gsw = ee.Image(
  'JRC/GSW1_4/GlobalSurfaceWater');

var permanentWater =
  gsw.select('seasonality').gte(8);

Map.addLayer(
  permanentWater.selfMask(),
  {palette:['cyan']},
  'Permanent Water');
  
var permanot = permanentWater
  .unmask(0)
  .not()
  .clip(zona_es);
  
// Visualizar
Map.addLayer(
  permanot,
  {min: 0, max: 1, palette: ['black', 'white']},
  'No agua permanente'
);


// =====================================================
// 6. GENERACION CAPA DE INUNDACIONES
// =====================================================

var flood = permanot.and(water)
  .rename('Flood')
  .toByte();

flood = flood
  .reproject({
    crs: masterProj,
    scale: 30
  })
  .clip(zona_es);
  
print(
  'Flood Histogram',
  flood.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);

print(
  flood.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);
//Visualizacion
Map.addLayer(
  flood.selfMask(),
  {palette:['red']},
  'Flood');

// VERIFICACION

print(
  'Flood Projection:',
  flood.projection()
);

print(
  'Flood Resolution:',
  flood.projection().nominalScale()
);

print(
  'Flood Pixels',
  flood.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);

print(
  'Flood Area (ha)',
  flood.multiply(
    ee.Image.pixelArea()
  ).divide(10000)
   .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: zona_es,
      scale: 30,
      maxPixels: 1e13
   })
);

// =====================================================
// 7. EXPORTAR ASSET 04 INVENTARIO DE INUNDACIÓN
// =====================================================


Export.image.toAsset({
  image: flood,
  description: 'Asset04_FloodInventory',
  assetId:
    'users/savelosab_practiques/Asset04_FloodInventory',
  region: zona_es,
  crs: 'EPSG:32618',
  scale: 30,
  maxPixels: 1e13
});