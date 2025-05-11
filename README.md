# three-geojson

Three.js shape loaders for [GeoJSON](https://geojson.org/) ([readable html](https://stevage.github.io/geojson-spec/)) and [WKT](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry) formats. Supports generation of three.js line geometry in addition to flat and extruded tringulated meshes.

Uses [@turfjs/unkink-polygon](https://www.npmjs.com/package/@turf/unkink-polygon) and [wellknown parser](https://github.com/mapbox/wellknown). World GeoJSON file courtesy of [geojson-maps](https://geojson-maps.kyd.au/).

> [!NOTE]
> This project is not hosted on npm and must be installed via Github repository.

# Examples

[WGS84 GeoJSON Lines](https://gkjohnson.github.io/three-geojson/example/bundle/globe.html)

[Extruded GeoJSON Polygon](https://gkjohnson.github.io/three-geojson/example/bundle/extruded.html)

# Use

```js
// load the content
const result = await new GeoJSON().loadAsync( url );

// extract polygon lines and project them onto the globe
const transformer = new GeoJSONTransformer();
result.polygons.forEach( polygon => {

  const line = polygon.getLineObject();
  transformer.transformGeometry( line.geometry );
  scene.add( line );

} );
```

# API

## GeoJSONResult

```ts
{
  // list of features in the file
  features: Array<Feature>,

  // list of all geometries in the file
  geometries: Array<Polygon|LineString|Points>,

  // lists of specific geometry types
  polygons: Array<Polygon>,
  lines: Array<LineString>,
  points: Array<Points>,
}
```

**Feature**

Definition of a feature that includes properties originally defined in the GeoJSON file.

```ts
{
  type: 'Feature',
  id: string | null,
  properties: object,

  // list of all geometries in the feature
  geometries: Array<Polygon|LineString|Points>,

  // lists of specific geometry types
  polygons: Array<Polygon>,
  lines: Array<LineString>,
  points: Array<Points>,
}
```

**Points**

Definition of a parsed set of point geometry.

```ts
{
  type: string,
  feature: Feature,
  data: Vector3 | Array<Vector3>,
}
```

**LineString**

Definition of a parsed set of line string geometry.

```ts
{
  type: string,
  feature: Feature,

  // function for building three.js LineSegments from the line data
  getLineObject( options: {
    flat = false: boolean,
  } ): LineSegments,
}
```

**Polygon**

Definition of a parsed set of polygon geometry.

```ts
{
  type: string,
  feature: Feature,

  // functions for building three.js LineSegments and Mesh from the line data
  getLineObject( options: {
    flat = false: boolean,
  } ): LineSegments,

  getMeshObject( options: {
    thickness = 0: number,
    offset = 0: number,
    generateNormals = true: boolean,
    flat = false: boolean,
  } ): Mesh,
}
```

## GeoJSONLoader

### decomposePolygons

```js
decomposePolygons = true: boolean
```

If true then self-intersecting polygons are decomposed into individual parts to enable triangulation.

### fetchOptions

```js
fetchOptions = {}: object
```

Options passed to fetch.

### loadAsync

```js
loadAsync( url: string ): Promise<GeoJSONResult>
```

Loads and parses a geojson file.

### parse

```js
parse( content: string | object ): GeoJSONResult
```

Parses geojson content. Takes a raw or stringified json object.

## WKTLoader

_extends GeoJSONLoader_

Loads and converts the WKT file to GeoJSON using [mapbox's wellknown](wellknown parser](https://github.com/mapbox/wellknown)) package, then parses it using the GeoJSONLoader parse function.

## GeoJSONEllipsoidTransformer

Utility for transforming points and geometry from lat / lon values to an ellipsoidal projection.

### constructor

```js
constructor( ellipsoid = WGS84_ELLIPSOID: Ellipsoid )
```

### transformPoint

```js
transformPoint( point: Vector3, target: Vector3 ): Vector3
```

Transforms a point in the GeoJSON lon, lat, height format to a cartesian value.

### transformGeometry

```js
transformGeometry( geometry: BufferGeometry ): BufferGeometry
```

Transforms geometry position attribute buffer to cartesian frame in-place assuming the values are in the GeoJSON lon, lat, height format.
