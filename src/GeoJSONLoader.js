import { Box3, Vector3 } from 'three';

// TODO
// - add parse to geometry function? polygons can be returned triangulated with outer edges defined so they can be extruded
// - add an extrude helper for polygons

function extractForeignKeys( object ) {

	const result = { ...object };
	delete result.type;
	delete result.bbox;

	switch ( object.type ) {

		case 'Point':
		case 'MultiPoint':
		case 'LineString':
		case 'MultiLineString':
		case 'Polygon':
		case 'MultiPolygon':

			delete result.coordinates;
			break;

		case 'GeometryCollection':

			delete result.geometries;
			break;

		case 'Feature':

			delete result.id;
			delete result.properties;
			delete result.geometry;
			break;

		case 'FeatureCollection':

			delete result.features;
			break;

	}

	return result;

}

function parseBounds( arr ) {

	if ( ! arr ) {

		return null;

	} else if ( arr.length === 4 ) {

		const box = new Box3();
		box.min.set( arr[ 0 ], arr[ 1 ], 0 );
		box.max.set( arr[ 2 ], arr[ 3 ], 0 );
		return box;

	} else if ( arr.length === 6 ) {

		const box = new Box3();
		box.min.set( arr[ 0 ], arr[ 1 ], arr[ 2 ] );
		box.max.set( arr[ 3 ], arr[ 4 ], arr[ 5 ] );
		return box;

	}

}

function getBase( object ) {

	return {
		type: object.type,
		boundingBox: parseBounds( object.bbox ),
		data: null,
		foreign: extractForeignKeys( object ),
	};

}

function getDimension( coordinates ) {

	return coordinates.length;

}

function parseCoordinate3d( arr ) {

	return arr.length === 2 ?
		new Vector3( ...arr, 0 ) :
		new Vector3( ...arr );

}

function parseCoordinate2d( arr ) {

	return new Vector3( arr[ 0 ], arr[ 1 ], 0 );

}

function traverse( object, callback ) {

	callback( object );

	switch ( object.type ) {

		case 'GeometryCollection':
		case 'FeatureCollection':

			object.data.forEach( o => traverse( o, callback ) );
			break;

		case 'Feature':
			traverse( object.data, callback );
			break;

	}

}

class Polygon {

	constructor( shape, holes ) {

		// TODO: clean up lines / shapes (handle 3d?), then triangulate
		// TODO: add helper for extrusion

		this.isPolygon = true;
		this.shape = shape;
		this.holes = holes;
		this.triangulation = null;

	}

}

class Line {

	constructor( vertices ) {

		this.isLine = true;
		this.vertices = vertices;

	}

}

export class GeoJSONLoader {

	constructor() {

		this.fetchOptions = {};
		this.flat = false;

	}

	loadAsync( url ) {

		return fetch( url )
			.then( res => res.json() )
			.then( json => this.parse( json ) );

	}

	parse( json ) {

		if ( typeof json === 'string' ) {

			json = JSON.parse( json );

		}

		const root = this.parseObject( json );
		const features = [];
		const geometries = [];

		traverse( root, object => {

			if ( object.type !== 'FeatureCollection' && object.type !== 'GeometryCollection' ) {

				if ( object.type === 'Feature' ) {

					features.push( object );

				} else {

					geometries.push( object );

					if ( object.feature ) {

						object.feature.geometries.push( object );

					}

				}

			}

		} );

		return {
			features,
			geometries,
			root,
		};

	}

	parseObject( object, feature = null ) {

		const parseCoordinate = this.flat ? parseCoordinate2d : parseCoordinate3d;

		switch ( object.type ) {

			case 'Point': {

				return {
					...getBase( object ),
					feature,
					data: parseCoordinate( object.coordinates ),
					dimension: getDimension( object.coordinates ),
				};

			}

			case 'MultiPoint': {

				return {
					...getBase( object ),
					feature,
					data: parseCoordinateArray( object.coordinates ),
					dimension: getDimension( object.coordinates[ 0 ] ),
				};

			}

			case 'LineString': {

				return {
					...getBase( object ),
					feature,
					data: new Line( parseCoordinateArray( object.coordinates ) ),
					dimension: getDimension( object.coordinates[ 0 ] ),
				};

			}

			case 'MultiLineString': {

				return {
					...getBase( object ),
					feature,
					data: object.coordinates.map( arr => new Line( parseCoordinateArray( arr ) ) ),
					dimension: getDimension( object.coordinates[ 0 ][ 0 ] ),
				};

			}

			case 'Polygon': {

				const [ shape, holes ] = parsePolygon( object.coordinates );
				return {
					...getBase( object ),
					feature,
					data: new Polygon( shape, holes ),
					dimension: getDimension( object.coordinates[ 0 ][ 0 ] ),
				};

			}

			case 'MultiPolygon': {

				return {
					...getBase( object ),
					feature,
					data: object.coordinates.map( arr => {

						const [ shape, holes ] = parsePolygon( arr );
						return new Polygon( shape, holes );

					} ),
					dimension: getDimension( object.coordinates[ 0 ][ 0 ][ 0 ] ),
				};

			}

			case 'GeometryCollection': {

				return {
					...getBase( object ),
					feature,
					data: object.geometries.map( obj => this.parseObject( obj, feature ) ),
				};

			}

			case 'Feature': {

				const feature = {
					...getBase( object ),
					id: object.id ?? null,
					properties: object.properties,
					geometries: [],
					data: null,
				};

				feature.data = this.parseObject( object.geometry, feature );
				return feature;

			}

			case 'FeatureCollection': {

				return {
					...getBase( object ),
					data: object.features.map( feat => this.parseObject( feat ) ),
				};

			}

		}

		function parseCoordinateArray( arr ) {

			return arr.map( coord => parseCoordinate( coord ) );

		}

		function parsePolygon( arr ) {

			return arr.map( loop => parseCoordinateArray( loop ) );

		}

	}

}
