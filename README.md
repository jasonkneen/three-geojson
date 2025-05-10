# three-geojson

Three.js shape loaders for [GeoJSON](https://geojson.org/) and [WKT](https://en.wikipedia.org/wiki/Well-known_text_representation_of_geometry) formats.

# Use

# API

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

### loadAsync

```js
loadAsync( url: string ): Promise<GeoJSONResult>
```

### parse

```js
parse( content: string | object ): GeoJSONResult
```

## WKTLoader

_extends GeoJSONLoader_

## GeoJSONTransformer

### constructor

```js
constructor( ellipsoid = WGS84_ELLIPSOID: Ellipsoid )
```

### transformPoint

```js
transformPoint( point: Vector3, target: Vector3 ): Vector3
```

### transformGeometry

```js
transformGeometry( geometry: BufferGeometry ): BufferGeometry
```

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
