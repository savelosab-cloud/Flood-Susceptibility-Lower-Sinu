//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
//  Titulo:       Variables Geomorfologicas en la Subcuenca Hidrográfica del Bajo Sinú 
//  Versión:      1.a
//  Authors:      Sebastian Velosa Bohorquez
//  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// *** ASSET 1/5 ***

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
// 2. DATA
// =====================================================

// =====================================================
// 2.a DEM COPERNICUS
// =====================================================
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30')
              .select('DEM')
              .mosaic()
              .clip(zona_es)
              .rename('Elevation');

//-----------------------------------------------------
// 2.b REPROYECCIÓN MAESTRA
//-----------------------------------------------------
dem = dem.reproject({
  crs: 'EPSG:32618',
  scale: 30
});

print(dem.projection());
print(dem.projection().nominalScale());

//-----------------------------------------------------
// 2.c GRID MAESTRO
//-----------------------------------------------------

// Proyección del DEM
var proj = dem.select('Elevation').projection();

//GRID MAESTRO DEL PROYECTO
var masterProjection = proj;

// Resolución
print('Resolución:', proj.nominalScale());

// CRS
print('CRS:', proj);

//-----------------------------------------------------
// 2.d FUNCIÓN DE ALINEACIÓN
//-----------------------------------------------------

function alignImage(img, method) {
  method = method || 'bilinear';
return img
    .resample(method)
    .reproject({
      crs: proj,
      scale: 30
    })
    .clip(zona_es);
}

// =====================================================
// 3. VARIABLES GEOMORFOLÓGICAS 
// =====================================================

// =====================================================
// 3.a ELEVATION
// =====================================================

// (Ver DEM)

// =====================================================
// 3.b PENDIENTE
// =====================================================
var slope = ee.Terrain.slope(dem)
              .rename('Slope');

// Alinear pendiente
slope = alignImage(slope, 'bilinear');

print(
  slope.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: zona_es,
    scale: 30,
    maxPixels: 1e13
  })
);
// =====================================================
// 3.c CURVATURA
// =====================================================

// Aproximación usando filtro laplaciano
var kernel = ee.Kernel.laplacian8();

// Suavizar DEM
var demSmooth = dem.focal_mean({
  radius: 1,
  units: 'pixels'
});

// Curvatura
var curvature = demSmooth
                    .convolve(kernel)
                    .rename('Curvature');

// Alinear curvatura
curvature = alignImage(curvature);

// =====================================================
// 3.d HAND (Height Above Nearest Drainage)
// =====================================================

// Dataset MERIT Hydro
var merit = ee.Image('MERIT/Hydro/v1_0_1');

// HAND
var hand = merit.select('hnd')
                .clip(zona_es)
                .rename('HAND');

// Alinear HAND
hand = alignImage(hand);


// =====================================================
// 4. VISUALIZACION
// =====================================================

// Visualización DEM
Map.addLayer(dem,
{
  min: -20,
  max: 500,
  palette: ['blue','green','yellow','brown','white']
},
'Elevation');

// Visualización pendiente
Map.addLayer(slope,
{
  min: 0,
  max: 45,
  palette: ['white','yellow','orange','red']
},
'Slope');

// Visualización curvatura
Map.addLayer(curvature,
{
  min: -20,
  max: 20,
  palette: ['blue','white','red']
},
'Curvature');

// Visualización HAND
Map.addLayer(hand,
{
  min: 0,
  max: 20,
  palette: ['blue','cyan','yellow','red']
},
'HAND');

// =====================================================
// 5. IMAGEN MULTIBANDA
// =====================================================

var geomorphology = ee.Image.cat([
  dem,
  slope,
  curvature,
  hand
]);

// =====================================================
// 6. HOMOGENEIZAR PROYECCIÓN FINAL
// =====================================================

geomorphology = geomorphology.reproject({
  crs: proj,
  scale: 30
});


print('Imagen multibanda:', geomorphology);
print('Bandas:', geomorphology.bandNames());

// =====================================================
// 7. PIXELES VALIDOS
// =====================================================
var validMask = geomorphology
  .mask()
  .reduce(ee.Reducer.min());

// Visualizar máscara
Map.addLayer(
  validMask,
  {
    min:0,
    max:1,
    palette:['red','green']
  },
  'Valid Pixels'
);

// Aplicar máscara
geomorphology = geomorphology.updateMask(validMask);

// =====================================================
// 8. VERIFICACIONES
// =====================================================

print(
  'MASTER CRS:',
  masterProjection.crs()
);

print(
  'MASTER SCALE:',
  masterProjection.nominalScale()
);


// Bandas
print(
  'Bandas:',
  geomorphology.bandNames()
);

// Proyección por banda
print(
  'Projection DEM:',
  geomorphology.select('Elevation').projection()
);

print(
  'Projection Slope:',
  geomorphology.select('Slope').projection()
);

print(
  'Projection Curvature:',
  geomorphology.select('Curvature').projection()
);

print(
  'Projection HAND:',
  geomorphology.select('HAND').projection()
);

// Resolución 
print(
  'Resolution DEM:',
  geomorphology.select('Elevation')
    .projection()
    .nominalScale()
);
print(
  'Resolution HAND:',
  geomorphology.select('HAND')
    .projection()
    .nominalScale()
);


// =====================================================
// 9. EXPORTAR STACK
// =====================================================

geomorphology = geomorphology.toFloat();

Export.image.toAsset({
  image: geomorphology,
  description: 'Asset01_Geomorphology',
  assetId: 'users/savelosab_practiques/Asset01_Geomorphology',
  region: zona_es,
  crs: 'EPSG:32618',
  scale: 30,
  maxPixels: 1e13
});

//copia local
Export.image.toDrive({
  image: geomorphology,
  description: 'Geomorphology_Stack',
  folder: 'GEE',
  fileNamePrefix: 'geomorphology_stack',
  region: zona_es,
  scale: 30,
  crs: 'EPSG:32618',
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});

// =====================================================
// 10. EXPORTAR VARIABLES RASTER (OPCIONAL)
// =====================================================

// Elevación
Export.image.toDrive({
  image: dem,
  description: 'Elevation_ALOS',
  folder: 'GEE',
  fileNamePrefix: 'Elevation_ALOS',
  region: aoi,
  scale: 30,
  maxPixels: 1e13
});

// Pendiente
Export.image.toDrive({
  image: slope,
  description: 'Slope_ALOS',
  folder: 'GEE',
  fileNamePrefix: 'Slope_ALOS',
  region: aoi,
  scale: 30,
  maxPixels: 1e13
});

// Curvatura
Export.image.toDrive({
  image: curvature,
  description: 'Curvature_ALOS',
  folder: 'GEE',
  fileNamePrefix: 'Curvature_ALOS',
  region: aoi,
  scale: 30,
  maxPixels: 1e13
});

// HAND
Export.image.toDrive({
  image: hand,
  description: 'HAND_MERIT',
  folder: 'GEE',
  fileNamePrefix: 'HAND_MERIT',
  region: aoi,
  scale: 30,
  maxPixels: 1e13
});
