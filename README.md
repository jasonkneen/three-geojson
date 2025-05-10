# three-geojson

Three.js shape loaders for [GeoJSON](https://geojson.org/) and [WKT](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry) formats.

World GeoJSON file courtesy of [geojson-maps](https://geojson-maps.kyd.au/).

# Use

# API

## GeoJSONResult

TODO

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
