//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  Titulo:       Variables Ambientales y antropicas en la Subcuenca Hidrográfica del Bajo Sinú 
//  Checkpoint:   1.a
//  Authors:      Sebastian Velosa Bohorquez
//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// *** ASSET 3/5 ***

// =====================================================
// 1. ÁREA DE ESTUDIO
// =====================================================

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
// 2. PROYECCIÓN MAESTRA DEL PROYECTO
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

// FUNCION DE ALINEACION

function alignImage(img, method){

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
// 3. DATA
// =====================================================

//-----------------------------------------------------
// SENTINEL-2
//-----------------------------------------------------

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(zona_es)
  .filterDate('2024-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20))
  .median()
  .clip(zona_es);



// =====================================================
// 4. VARIABLES AMBIENTALES
// =====================================================
//-----------------------------------------------------
// 4.1. NDVI
//-----------------------------------------------------

var ndvi = s2.normalizedDifference(['B8','B4'])
             .rename('NDVI').toFloat();


Map.addLayer(
  ndvi,
  {
    min:-1,
    max:1,
    palette:['brown','yellow','green']
  },
  'NDVI'
);


//-----------------------------------------------------
// 4.2 NDWI
//-----------------------------------------------------

var ndwi = s2.normalizedDifference(['B3','B8'])
             .rename('NDWI').toFloat();


Map.addLayer(
  ndwi,
  {
    min:-1,
    max:1,
    palette:['brown','white','blue']
  },
  'NDWI'
);

//-----------------------------------------------------
// 4.3 LAND COVER
//-----------------------------------------------------

var worldcover = ee.ImageCollection('ESA/WorldCover/v100')
                    .first()
                    .select('Map')
                    .rename('LandCover')
                    .clip(zona_es);

Map.addLayer(
  worldcover,
  {},
  'ESA WorldCover'
);

//=====================================================
// VARIABLES ANTROPOGÉNICAS
// Urbanización - Built-up - Roads
//=====================================================
//-----------------------------------------------------
// 2. GHSL BUILT-UP - superficie construida
//-----------------------------------------------------

var built = ee.ImageCollection('JRC/GHSL/P2023A/GHS_BUILT_S')
                .first()
                .select(0)
                .clip(zona_es)
                .rename('BuiltUp')
                .toFloat();

built = alignImage(built);
                
Map.addLayer(
  built,
  {
    min:0,
    max:100
  },
  'Built-up Surface'
);
print(built);



//-----------------------------------------------------
// 7. VARIABLES AMBIENTALES MULTIBANDA
//-----------------------------------------------------

var environmentalVariables = ee.Image.cat([
  ndvi,
  ndwi,
  worldcover,
  built
]);

environmentalVariables = environmentalVariables
  .reproject({
    crs: masterProj,
    scale: 30
  });
  
environmentalVariables = environmentalVariables.toFloat();


//VERIFICACIONES

print(
  'Bandas:',
  environmentalVariables.bandNames()
);

print(
  'NDVI Projection:',
  environmentalVariables
    .select('NDVI')
    .projection()
);

print(
  'LandCover Projection:',
  environmentalVariables
    .select('LandCover')
    .projection()
);

print(
  'BuiltUp Projection:',
  environmentalVariables
    .select('BuiltUp')
    .projection()
);

print(
  environmentalVariables.reduceRegion({
    reducer: ee.Reducer.count(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);

Export.image.toAsset({
  image: environmentalVariables,
  description: 'Asset03_Environmental',
  assetId:
    'users/savelosab_practiques/Asset03_Environmental',
  region: zona_es,
  crs: 'EPSG:32618',
  scale: 30,
  maxPixels: 1e13
});

print('Environmental Variables', environmentalVariables);

