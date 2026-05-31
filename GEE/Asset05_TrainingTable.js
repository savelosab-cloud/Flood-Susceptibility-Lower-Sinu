//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  Titulo:       Tabla de Entrenamiento para ML
//  Proyecto:     Susceptibilidad a Inundaciones Bajo Sinú
//  Authors:      Sebastian Velosa Bohorquez
//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// *** ASSET 05/05 ***

// =====================================================
// 1. ÁREA DE ESTUDIO
// =====================================================

var cuenca = ee.FeatureCollection(
"users/savelosab_practiques/Cuenca_Baja_RioSinu"
);

var zona_es = cuenca.geometry().dissolve();

Map.centerObject(zona_es,10);

// =====================================================
// 2. CARGAR ASSETS
// =====================================================

var asset01 = ee.Image(
'users/savelosab_practiques/Asset01_Geomorphology'
);

var asset02 = ee.Image(
'users/savelosab_practiques/Asset02_Hydrology'
);

var asset03 = ee.Image(
'users/savelosab_practiques/Asset03_Environmental'
);

var asset04 = ee.Image(
'users/savelosab_practiques/Asset04_FloodInventory'
);

// =====================================================
// 3. STACK DE VARIABLES PREDICTORAS
// =====================================================

var predictors = asset01
.addBands(asset02)
.addBands(asset03);

print(
'Predictor Bands:',
predictors.bandNames()
);


// =====================================================
// 4. VARIABLE OBJETIVO
// =====================================================

var flood = asset04
  .select('Flood')
  .unmask(0)
  .toByte()
  .rename('Flood');

print(
  'Flood classes:',
  flood.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);

// =====================================================
// 5. STACK FINAL
// =====================================================

var stack = predictors.addBands(flood);

print(
  'Stack Final:',
  stack.bandNames()
);

/// =====================================================
// 6. MUESTREO ESTRATIFICADO BALANCEADO
// =====================================================
// Objetivo:
// 2500 inundados
// 2500 no inundados
// Total = 5000 muestras

var samples = stack.stratifiedSample({
  numPoints: 5000,
  classBand: 'Flood',
  classValues: [0, 1],
  classPoints: [2500, 2500],
  region: zona_es,
  scale: 30,
  seed: 42,
  geometries: true
});

print(
  'Total Samples:',
  samples.size()
);

// =====================================================
// 7. VERIFICACIÓN DEL BALANCE DE CLASES
// =====================================================

print(
  'Class Distribution:',
  samples.aggregate_histogram('Flood')
);

// =====================================================
// 8. DIVISIÓN TRAIN / VALIDATION
// =====================================================

samples = samples.randomColumn(
  'random',
  42
);

var training = samples.filter(
  ee.Filter.lt('random', 0.7)
);

var validation = samples.filter(
  ee.Filter.gte('random', 0.7)
);
print(
  'Training Samples:',
  training.size()
);

print(
  'Validation Samples:',
  validation.size()
);

// =====================================================
// 9. VISUALIZACIÓN DE MUESTRAS
// =====================================================

Map.addLayer(
  samples,
  {color: 'yellow'},
  'All Samples'
);

Map.addLayer(
  training,
  {color: 'green'},
  'Training'
);

Map.addLayer(
  validation,
  {color: 'blue'},
  'Validation'
);


print(stack.bandTypes());

// =====================================================
// 10. VERIFICACIÓN DE VARIABLES
// =====================================================

print(
  'Variables finales:',
  samples.first()
);

// =====================================================
// 11. EXPORTAR TABLA COMPLETA
// =====================================================

Export.table.toDrive({
collection: samples,
description: 'Asset05_AllSamples',
folder: 'GEE',
fileFormat: 'CSV'
});

// =====================================================
// 12. EXPORTAR TRAINING
// =====================================================

Export.table.toDrive({
collection: training,
description: 'Asset05_Training',
folder: 'GEE',
fileFormat: 'CSV'
});

// =====================================================
// 13. EXPORTAR VALIDATION
// =====================================================

Export.table.toDrive({
collection: validation,
description: 'Asset05_Validation',
folder: 'GEE',
fileFormat: 'CSV'
});

// =====================================================
// 14. EXPORTAR PREDICTORS
// =====================================================
Export.image.toDrive({
  image: predictors.toFloat(),
  description: 'Predictors_MAGNA3116',
  folder: 'Flood_Model',
  region: zona_es,
  crs: 'EPSG:3116',
  scale: 30,
  maxPixels: 1e13
});