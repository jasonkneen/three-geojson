import { Box3, Vector3 } from 'three';

// TODO
// - add parse to geometry function? polygons can be returned triangulated with outer edges defined so they can be extruded
// - add an extrude helper for polygons

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

	const dimension =
		Array.isArray( object.coordinates ) ?
			object.coordinates[ 0 ].length :
			object.coordinates.length;

	return {
		id: object.id ?? null,
		type: object.type,
		dimension: dimension,
		boundingBox: parseBounds( object.bbox ),
		data: null,
	};

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
		case 'Feature':
		case 'FeatureCollection':

			object.data.forEach( o => traverse( o, callback ) );

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
		const features = {};
		const geometries = {};

		traverse( root, object => {

			if ( object.id !== null ) {

				const map = object.type === 'Feature' ? features : geometries;
				map[ object.id ] = object;

			}

		} );

		return {
			features,
			geometries,
			root,
		};

	}

	parseObject( object ) {

		const parseCoordinate = this.flat ? parseCoordinate2d : parseCoordinate3d;

		switch ( object.type ) {

			case 'Point': {

				return {
					...getBase( object ),
					data: parseCoordinate( object.coordinates ),
				};

			}

			case 'MultiPoint': {

				return {
					...getBase( object ),
					data: parseCoordinateArray( object.coordinates ),
				};

			}

			case 'LineString': {

				return {
					...getBase( object ),
					data: new Line( parseCoordinateArray( object.coordinates ) ),
				};

			}

			case 'MultiLineString': {

				return {
					...getBase( object ),
					data: object.coordinates.map( arr => new Line( parseCoordinateArray( arr ) ) ),
				};

			}

			case 'Polygon': {

				const [ shape, holes ] = parsePolygon( object.coordinates );
				return {
					...getBase( object ),
					data: new Polygon( shape, holes ),
				};

			}

			case 'MultiPolygon': {

				return {
					...getBase( object ),
					data: object.coordinates.map( arr => {

						const [ shape, holes ] = parsePolygon( arr );
						return new Polygon( shape, holes );

					} ),
				};

			}

			case 'GeometryCollection': {

				return {
					...getBase( object ),
					data: object.geometries.map( obj => this.parseObject( obj ) ),
				};

			}

			case 'Feature': {

				return {
					...getBase( object ),
					properties: object.properties,
					data: this.parseObject( object.geometry ),
				};

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
