# three-geojson

Three.js shape loaders for [GeoJSON](https://geojson.org/) and [WKT](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry) formats. World GeoJSON file courtesy of [geojson-maps](https://geojson-maps.kyd.au/).

# Examples

[WGS84 GeoJSON Lines](https://gkjohnson.github.io/three-geojson/example/bundle/globe.html)

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

```js
{
  // list of features in the file
  features: Array<Feature>,

  // list of all geometries in the file
  geometries: Array<Polygon|LineString|Points>,

  // list of specific geometry types
  polygons: Array<Polygon|LineString|Points>,
  lineStrings: Array<Polygon|LineString|Points>,
  points: Array<Polygon|LineString|Points>,
}
```

**Feature**

Definition of a feature that includes properties originally defined in the GeoJSON file.

```js
{
  type: 'Feature',
  id: string | null,
  properties: object,
  geometries: Array<Polygon|LineString|Points>,
}
```

**Points**

Definition of a parsed set of point geometry.

```js
{
  type: string,
  feature: Feature,
  data: Vector3 | Array<Vector3>,
}
```

**LineString**

Definition of a parsed set of line string geometry.

```js
{
  type: string,
  feature: Feature,

  // function for building three.js LineSegments from the line data
  getLineObject(): LineSegments,
}
```

**Polygon**

Definition of a parsed set of polygon geometry.

```js
{
  type: string,
  feature: Feature,

  // functions for building three.js LineSegments and Mesh from the line data
  getLineObject(): LineSegments,
  getMeshObject( options: {
    thickness: number,
    offset: number,
    generateNormals: boolean,
  } ): Mesh,
}
```

## GeoJSONLoader

### flat

```js
flat = false: boolean
```

If true then the third component for any coordinate is ignored.

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

## GeoJSONTransformer

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

**spec**
- https://github.com/stevage/geojson-spec
  - https://stevage.github.io/geojson-spec/
- https://en.wikipedia.org/wiki/GeoJSON
- https://geojson.org/

**Tools**
- @turf/unkink-polygon
- https://github.com/mapbox/delaunator
- three.js' earcut
- https://www.npmjs.com/package/cdt2d
- https://github.com/mapbox/wellknown
