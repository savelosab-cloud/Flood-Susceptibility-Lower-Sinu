//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  Titulo:       Variables hidrologicas en la Subcuenca Hidrográfica del Bajo Sinú 
//  Versión:      1.a
//  Authors:      Sebastian Velosa Bohorquez
//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// *** ASSET 2/5 ***


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

var masterProj = asset01.select('Elevation').projection();

print(
  'MASTER CRS:',
  masterProj.crs()
);

print(
  'MASTER SCALE:',
  masterProj.nominalScale()
);

//ALINEACION

function alignImage(img, method) {

  method = method || 'bilinear';

  return img
    .resample(method)
    .reproject({
      crs: masterProj,
      scale: 30
    })
    .clip(zona_es);
}

// =====================================================
// 2. DATA
// =====================================================

//-----------------------------------------------------
//  DATA MERIT HYDRO
//-----------------------------------------------------

var merit = ee.Image('MERIT/Hydro/v1_0_1');

print('Proyección UPA:', merit.select('upa').projection());
print('Resolución UPA:', merit.select('upa').projection().nominalScale());
//=====================================================
// 3. VARIABLES HIDROLÓGICAS
//=====================================================
//-----------------------------------------------------
// 3.a FLOW ACCUMULATION
//-----------------------------------------------------

// upslope area - upa (cantidad de flujo acumulado)
var flowAccum = merit.select('upa')
                     .clip(zona_es)
                     .rename('FlowAccum')
                      .toFloat();

// alinear

flowAccum = alignImage(flowAccum);

//visualizacion
Map.addLayer(
  flowAccum,
  {
    min: 0,
    max: 500,
    palette: ['white','blue','darkblue']
  },
  'Flow Accumulation'
);

//-----------------------------------------------------
// 3.b  DIRECCIÓN DE FLUJO
//-----------------------------------------------------

var flowDir = merit.select('dir')
                   .clip(zona_es);
                   

Map.addLayer(
  flowDir,
  {
    min: 1,
    max: 8,
    palette: [
      'red','orange','yellow','green',
      'cyan','blue','purple','pink'
    ]
  },
  'Flow Direction'
);
//-----------------------------------------------------
// 3.c  RED DE DRENAJE
//-----------------------------------------------------

// Umbral para definir ríos
// Ajustar según tamaño cuenca
var rivers = flowAccum.gt(200);

Map.addLayer(
  rivers.selfMask(),
  {
    palette:['cyan']
  },
  'Rivers'
);

//-----------------------------------------------------
// 3.d  DISTANCIA A RÍOS
//-----------------------------------------------------

// Convertir ríos a máscara binaria
var riverMask = rivers.selfMask();

// Distancia euclidiana a drenajes
var distanceRiver = riverMask
  .fastDistanceTransform(200)
  .sqrt()
  .multiply(30) // resolución projecto
  .clip(zona_es)
  .rename('DistRiver')
    .toFloat();

distanceRiver = alignImage(distanceRiver);

Map.addLayer(
  distanceRiver,
  {
    min: 0,
    max: 5000,
    palette:['blue','yellow','red']
  },
  'Distance to River'
);

//-----------------------------------------------------
// 4. VARIABLES PARA STACK FINAL
//-----------------------------------------------------

var hydroVariables = ee.Image.cat([
  flowAccum,
  distanceRiver
]);

// =====================================================
// 5. HOMOGENEIZAR PROYECCIÓN FINAL
// =====================================================

hydroVariables = hydroVariables.reproject({
  crs: masterProj,
  scale: 30
});

print('Variables hidrológicas:', hydroVariables.bandNames());

// =====================================================
// 7. VERIFICACIONES
// =====================================================

print(
  'Bandas:',
  hydroVariables.bandNames()
);

print(
  'Projection FlowAccum:',
  hydroVariables.select('FlowAccum')
    .projection()
);

print(
  'Projection DistRiver:',
  hydroVariables.select('DistRiver')
    .projection()
);

print(
  'Resolution FlowAccum:',
  hydroVariables.select('FlowAccum')
    .projection()
    .nominalScale()
);

print(
  'Resolution DistRiver:',
  hydroVariables.select('DistRiver')
    .projection()
    .nominalScale()
);

// =====================================================
// 8. EXPORTAR ASSET 02
// =====================================================

hydroVariables = hydroVariables.toFloat();

Export.image.toAsset({
  image: hydroVariables,
  description: 'Asset02_Hydrology',
  assetId: 'users/savelosab_practiques/Asset02_Hydrology',
  region: zona_es,
  crs: 'EPSG:32618',
  scale: 30,
  maxPixels: 1e13
});